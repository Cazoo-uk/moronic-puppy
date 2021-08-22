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

export interface CatchupState {
  type: 'CATCHUP';
  payload: {
    chunk: string;
    lastEvent: string;
  };
}

type ActiveState = CatchupState | LiveState;
export type ProjectorState = EmptyState | ActiveState;

export interface StateStore {
  get(): Promise<ProjectorState>;
  put(s: ProjectorState): Promise<void>;
}

export interface Chunk<TEvent extends EventMetadata> {
  id: string;
  events: Array<TEvent>;
}

export type Archive<TEvent extends EventMetadata> = (
  currentChunk: string
) => AsyncGenerator<Chunk<TEvent>>;

export class ProjectorSource<TEvent extends EventMetadata> {
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
