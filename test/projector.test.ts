import * as football from './football';
import {EventMetadata} from '../src';
/*
 * When we're firing up a projector, we usually want to play back all events from
 * the beginning of time. There's some sleight of hand we have to pull to make sure that
 * we can smoothly handle the archive (stored in S3) and then switch to handling events
 * as they arrive (from a dynamo change stream).
 *
 * The dynamo change stream provides a live feed of events over the last 24 hours. The
 * S3 archive provides "chunks" - files containing a batch of events collected from the
 * live feed.
 *
 * We make the new projector keep track of its mode (catch_up, transition, live)
 * and a "payload of state". When a new projector receives a message, it first checks to
 * see if it's in catch_up mode.
 *
 * If so, it ignores the message it was passed and instead reads from the
 * archive, one chunk at a time. Each time we update our projceted state, we also
 * record the projector state to the datastore, with mode "catch_up" and the payload
 * {chunk, last_event}
 *
 * If we time out before processing the final chunk, we return an error from our lambda.
 * This means that we'll be passed the _same_ message over and over until we process it
 * successfully.
 *
 * When we've read the final chunk from the archive, we record our mode as "transition"
 * and our payload as {last_chunk last_event}. In transition mode, we read through the
 * live stream, returning success from our lambda, until we hit an event > last_event.
 *
 * When we process our first new live event, we record our mode as "live" and our payload
 * as {last_chunk, last_event}.
 *
 * If we need to return a projector to catch up mode, we need to read through all chunks
 * since last_chunk, ignoring any event <= last_event.
 */

interface EmptyState {
  type: 'EMPTY';
}

interface LiveState {
  type: 'LIVE';
  payload: {
    lastEvent: string;
  };
}

interface CatchupState {
  type: 'CATCHUP';
  payload: {
    chunk: string;
    lastEvent: string;
  };
}

type ActiveState = CatchupState | LiveState;
type ProjectorState = EmptyState | ActiveState;

interface StateStore {
  get(): Promise<ProjectorState>;
  put(s: ProjectorState): Promise<void>;
}

interface Chunk<TEvent extends EventMetadata> {
  id: string;
  events: Array<TEvent>;
}

type Archive<TEvent extends EventMetadata> = (
  currentChunk: string
) => AsyncGenerator<Chunk<TEvent>>;

class ProjectorSource<TEvent extends EventMetadata> {
  #states: StateStore;
  #archive: Archive<TEvent>;
  #live: AsyncGenerator<TEvent>;
  #onEvent: (e: TEvent) => Promise<void>;

  constructor(
    archive: Archive<TEvent>,
    live: AsyncGenerator<TEvent>,
    onEvent: (e: TEvent) => Promise<void>,
    stateStore: StateStore
  ) {
    this.#states = stateStore;
    this.#archive = archive;
    this.#live = live;
    this.#onEvent = onEvent;
  }

  async process<TState extends ActiveState>(
    e: TEvent,
    state: TState
  ): Promise<TState> {
    if (e.id <= state.payload.lastEvent) return state;
    await this.#onEvent(e);
    const s = {...state};
    s.payload.lastEvent = e.id;
    return s;
  }

  async runCatchup(state: CatchupState) {
    for await (const chunk of this.#archive(state.payload.chunk)) {
      state = {
        type: 'CATCHUP',
        payload: {chunk: chunk.id, lastEvent: state.payload.lastEvent},
      };
      for (const e of chunk.events) {
        state = await this.process(e, state);
        await this.#states.put(state);
      }
    }

    const liveState = {
      type: 'LIVE' as const,
      payload: {lastEvent: state.payload.lastEvent},
    };
    await this.runLive(liveState);
  }

  async runLive(state: LiveState) {
    for await (const e of this.#live) {
      state = await this.process(e, state);
      this.#states.put(state);
    }
  }

  async run() {
    const state = await this.#states.get();
    if (state.type === 'EMPTY') {
      await this.runCatchup({
        type: 'CATCHUP',
        payload: {
          chunk: '',
          lastEvent: '',
        },
      });
    } else if (state.type === 'CATCHUP') {
      await this.runCatchup(state);
    } else {
      await this.runLive(state);
    }
  }
}

const goal = (
  sequence: number,
  parts: Partial<football.GoalPayload> = {},
  stream = 'my-game'
) => ({
  sequence,
  id: sequence.toString(),
  stream,
  type: 'GOAL_SCORED' as const,
  data: {
    time: 10,
    text: 'ooh, cracking that',
    side: 'HOME' as const,
    player: 'Albert Knebworth',
    location: 1,
    situation: 1,
    ...parts,
  },
});

type Goal = football.GoalEvent & EventMetadata;

async function* gen<TEvent>(source: Iterable<TEvent>) {
  for (const elem of source) yield elem;
}

function spyProjector<TEvent>(elems: Array<TEvent>) {
  return async function (e: TEvent) {
    elems.push(e);
  };
}

function spyStateHandler(states: Array<ProjectorState>) {
  return {
    async get() {
      return (states.length && states[states.length - 1]) || {type: 'EMPTY'};
    },
    async put(s: ProjectorState) {
      states.push(s);
    },
  };
}

describe('For a projector with empty state', () => {
  /*
   * New projectors start in the empty state.
   * Their first job is to read the entire archive, and then move to handling live events.
   */

  describe('When the archive is empty', () => {
    /*
     * In this scenario, we've created a new projector on an empty event store.
     * As a result, there are no archived events, and we should start to process the
     * live events as they arrive.
     *
     * We should write our projectorState with a mode of 'live' and a high watermark
     * corresponding to the last processed event
     * */

    const states: Array<ProjectorState> = [];
    const archived: Array<Chunk<Goal>> = [];
    const elems: Array<Goal> = [];
    const live: Array<Goal> = [goal(1)];

    const source = new ProjectorSource<Goal>(
      _ => gen(archived),
      gen(live),
      spyProjector(elems),
      spyStateHandler(states)
    );

    beforeAll(async () => {
      await source.run();
    });

    it('should record a live state', () => {
      expect(states).toHaveLength(1);
      expect(states[0].type).toEqual('LIVE');
    });

    it('should have the correct last event', () => {
      expect(states[0]).toHaveProperty('payload.lastEvent', live[0].id);
    });

    it('should process the event', () => {
      expect(elems[0]).toBe(live[0]);
    });
  });

  describe('When there is no overlap between the live events and the archive', () => {
    /*
     * In this scenario, we process a chunk of archived events and then process the
     * live events. Fortunately - almost inconceivably - there are no events in common
     * between the two sources
     */

    const states: Array<ProjectorState> = [];
    const elems: Array<Goal> = [];

    const archived: Array<Chunk<Goal>> = [
      {id: 'chunk-1', events: [goal(1, {player: 'Jimmy Backfoot'})]},
    ];
    const live: Array<Goal> = [goal(2, {player: 'Sidney Carmichael'})];

    const source = new ProjectorSource(
      _ => gen(archived),
      gen(live),
      spyProjector(elems),
      spyStateHandler(states)
    );

    beforeAll(async () => {
      await source.run();
    });

    it('should have recorded two states', () => {
      expect(states).toHaveLength(2);
    });

    it('should start in catchup', () => {
      expect(states[0].type).toEqual('CATCHUP');
      expect(states[0]).toHaveProperty('payload.lastEvent', '1');
    });

    it('should record a live state', () => {
      expect(states[1].type).toEqual('LIVE');
      expect(states[1]).toHaveProperty('payload.lastEvent', '2');
    });

    it('should process both events', () => {
      expect(elems).toHaveLength(2);
    });

    it('should process the archived events first', () => {
      expect(elems[0].data.player).toEqual('Jimmy Backfoot');
      expect(elems[1].data.player).toEqual('Sidney Carmichael');
    });
  });

  describe('When events appear in both the archive and the live feed', () => {
    /*
     * In this scenario, we process a chunk of archived events and then process the
     * a live event. The live event is already in the archive so we should not process
     * it a second time.
     */
    const states: Array<ProjectorState> = [];
    const elems: Array<Goal> = [];

    const archived: Array<Chunk<Goal>> = [
      {
        id: 'chunk-1',
        events: [
          goal(1, {player: 'Jimmy Backfoot'}),
          goal(2, {player: 'Sidney Carmichael'}),
        ],
      },
    ];
    const live: Array<Goal> = [goal(2, {player: 'Sidney Carmichael again'})];

    const source = new ProjectorSource(
      _ => gen(archived),
      gen(live),
      spyProjector(elems),
      spyStateHandler(states)
    );

    beforeAll(async () => {
      await source.run();
    });

    it('should not process the duplicate event', () => {
      expect(elems).toHaveLength(2);
    });

    it('should process the archived events first', () => {
      expect(elems[0].data.player).toEqual('Jimmy Backfoot');
      expect(elems[1].data.player).toEqual('Sidney Carmichael');
    });
  });
});

describe('For a projector in the catchup state', () => {
  describe('When the current chunk is part read', () => {
    /*
     * In this scenario, our projector has run previously and was processing chunk-1.
     * It may have timed out or otherwise terminated before completing the catchup phase so there are still events
     * to read in chunk-1.
     * We should skip the previously handled events in chunk-1, process the remainder, and then move on to chunk-2
     * before handling the live events.
     * */

    const chunk1 = 'CHUNK-1';
    const chunk2 = 'CHUNK-2';

    const states: Array<ProjectorState> = [
      {
        type: 'CATCHUP',
        payload: {
          chunk: chunk1,
          lastEvent: '2',
        },
      },
    ];
    const elems: Array<Goal> = [];
    const archive: Array<Chunk<Goal>> = [
      {
        id: chunk1,
        events: [
          goal(1, {player: 'Jimmy Backfoot'}),
          goal(2, {player: 'Sidney Carmichael'}),
          goal(3, {player: 'Albert Bagenhot'}),
        ],
      },
      {
        id: chunk2,
        events: [goal(4, {player: 'Jimmy Backfoot'})],
      },
    ];

    const live: Array<Goal> = [];

    const source = new ProjectorSource<Goal>(
      _ => gen(archive),
      gen(live),
      spyProjector(elems),
      spyStateHandler(states)
    );

    beforeAll(async () => {
      await source.run();
    });

    it('should process the new event in chunk-1', () => {
      const goal3 = archive[0].events[2];
      expect(elems[0]).toEqual(goal3);
    });

    it('should process the new event in chunk-2', () => {
      const goal4 = archive[1].events[0];
      expect(elems[1]).toEqual(goal4);
    });

    it('should have processed two events', () => {
      expect(elems).toHaveLength(2);
    });

    it('should update its state to point at chunk-2', () => {
      expect(states.pop()).toEqual({
        type: 'CATCHUP',
        payload: {
          chunk: chunk2,
          lastEvent: '4',
        },
      });
    });
  });

  describe('When the current chunk is completely read', () => {});
});

describe('For a projector in the live state', () => {});
