import {Chunk, EventMetadata, ProjectorSource, ProjectorState} from '../src';
import * as football from './football';

interface ProjectorContextParams {
  initialState?: ProjectorState;
  archive?: Array<Chunk<Goal>>;
  live?: Array<Goal>;
}

interface ProjectorContext {
  states: Array<ProjectorState>;
  processed: Array<Goal>;
  run: () => Promise<void>;
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

const given_a_projector = (ctx: ProjectorContextParams) => {
  const states: Array<ProjectorState> = [];
  if (ctx.initialState) states.push(ctx.initialState);
  const archive = ctx.archive || [];
  const live = ctx.live || [];
  const processed: Array<Goal> = [];
  return {
    states,
    processed,
    run: async () => {
      await new ProjectorSource<Goal>(
        _ => gen(archive),
        gen(live),
        spyProjector(processed),
        spyStateHandler(states)
      ).run();
    },
  };
};

const chunk1 = 'CHUNK-1';
const chunk2 = 'CHUNK-2';

const catchup = (chunk = '', lastEvent = '') => ({
  type: 'CATCHUP' as const,
  payload: {
    chunk,
    lastEvent,
  },
});

const live = (lastEvent = '') => ({
  type: 'LIVE' as const,
  payload: {lastEvent},
});

const chunk = (chunkId: string, ...events: Array<Goal>) => ({
  id: chunkId,
  events,
});

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

    let ctx: ProjectorContext;
    const event = goal(1);

    beforeAll(async () => {
      ctx = given_a_projector({
        live: [event],
      });
      await ctx.run();
    });

    it('should record a live state', () => {
      expect(ctx.states).toHaveLength(1);
      expect(ctx.states[0]).toEqual(live('1'));
    });

    it('should process the event', () => {
      expect(ctx.processed).toContain(event);
    });
  });

  describe('When there is no overlap between the live events and the archive', () => {
    /*
     * In this scenario, we process a chunk of archived events and then process the
     * live events. Fortunately - almost inconceivably - there are no events in common
     * between the two sources
     */

    const goal1 = goal(1);
    const goal2 = goal(2);

    let ctx: ProjectorContext;
    beforeAll(async () => {
      ctx = given_a_projector({
        archive: [chunk(chunk1, goal1)],
        live: [goal2],
      });
      await ctx.run();
    });

    it('should have recorded two states', () => {
      expect(ctx.states).toHaveLength(2);
    });

    it('should start in catchup', () => {
      expect(ctx.states[0]).toEqual(catchup(chunk1, '1'));
    });

    it('should record a live state', () => {
      expect(ctx.states[1]).toEqual(live('2'));
    });

    it('should process both events', () => {
      expect(ctx.processed).toHaveLength(2);
    });

    it('should process the archived events first', () => {
      expect(ctx.processed[0].sequence).toEqual(1);
      expect(ctx.processed[1].sequence).toEqual(2);
    });
  });

  describe('When events appear in both the archive and the live feed', () => {
    /*
     * In this scenario, we process a chunk of archived events and then process the
     * a live event. The live event is already in the archive so we should not process
     * it a second time.
     */

    let ctx: ProjectorContext;
    beforeAll(async () => {
      ctx = given_a_projector({
        archive: [chunk(chunk1, goal(1), goal(2))],
      });
      await ctx.run();
    });

    it('should not process the duplicate event', () => {
      expect(ctx.processed).toHaveLength(2);
    });

    it('should process the archived events first', () => {
      expect(ctx.processed).toEqual([goal(1), goal(2)]);
    });
  });
});

describe('For a projector in the catchup state', () => {
  /*
   * So long as a projector is in catchup state, it should read from the archive, updating
   * its state to point to the current chunk and event. Once it reaches the end of the archive
   * it should move to the live state.
   */

  describe('When the current chunk is part read', () => {
    /*
     * In this scenario, our projector has run previously and was processing chunk-1.
     * It may have timed out or otherwise terminated before completing the catchup phase so there are still events
     * to read in chunk-1.
     * We should skip the previously handled events in chunk-1, process the remainder, and then move on to chunk-2
     * before handling the live events.
     * */

    let ctx: ProjectorContext;

    beforeAll(async () => {
      ctx = given_a_projector({
        initialState: catchup(chunk1, '2'),
        archive: [
          chunk(
            chunk1,
            goal(1, {player: 'Jimmy Backfoot'}),
            goal(2, {player: 'Sidney Carmichael'}),
            goal(3, {player: 'Albert Bagenhot'})
          ),
          chunk(chunk2, goal(4, {player: 'Jimmy Backfoot'})),
        ],
      });
      await ctx.run();
    });

    it('should process the new event in chunk-1', () => {
      expect(ctx.processed[0].sequence).toEqual(3);
    });

    it('should process the new event in chunk-2', () => {
      expect(ctx.processed[1].sequence).toEqual(4);
    });

    it('should have processed two events', () => {
      expect(ctx.processed).toHaveLength(2);
    });

    it('should update its state to point at chunk-2', () => {
      expect(ctx.states.pop()).toEqual(catchup(chunk2, '4'));
    });
  });

  describe('When the current chunk is completely read', () => {
    /*
     * In this scenario, we have previously read chunk-1 and exited.
     * When we start up again, the first archived event is in chunk2.
     */

    let ctx: ProjectorContext;
    const newEvent = goal(3, {player: 'Jimmy Backfoot'});

    beforeAll(async () => {
      ctx = given_a_projector({
        initialState: catchup(chunk1, '2'),
        archive: [
          chunk(
            chunk1,
            goal(1, {player: 'Jimmy Backfoot'}),
            goal(2, {player: 'Sidney Carmichael'})
          ),
          chunk(chunk2, newEvent),
        ],
      });
      await ctx.run();
    });

    it('should process the new event in chunk-2', () => {
      expect(ctx.processed).toEqual([newEvent]);
    });

    it('should update its state to point at chunk-2', () => {
      expect(ctx.states.pop()).toEqual(catchup(chunk2, newEvent.id));
    });
  });
});

describe('For a projector in the live state', () => {
  /*
   * When a projector is in the live state, it should only read the events in the live queue
   * and should not read from the archive.
   */

  describe('When processing live events', () => {
    let ctx: ProjectorContext;

    beforeAll(async () => {
      ctx = given_a_projector({
        archive: [chunk(chunk1, goal(1))],
        initialState: live(),
        live: [goal(2)],
      });
      await ctx.run();
    });

    it('should process the live event and disregard the archived', () => {
      expect(ctx.processed).toEqual([goal(2)]);
    });
  });

  describe('When a live event is replayed', () => {
    let ctx: ProjectorContext;
    const event = goal(2);

    beforeAll(async () => {
      ctx = given_a_projector({
        archive: [chunk(chunk1, goal(1))],
        initialState: live(event.id),
        live: [event],
      });
      await ctx.run();
    });

    it('should not process the event a second time', () => {
      expect(ctx.processed).toEqual([]);
    });
  });
});
