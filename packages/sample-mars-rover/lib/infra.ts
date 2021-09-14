import {Repository, RoverEvent, empty, reduce} from './model';
import {EventStore, Event} from '@moronic-puppy/core';
import {DynamoDB} from '@aws-sdk/client-dynamodb';

export class EventRepository implements Repository {
  private store: EventStore<Event<string, RoverEvent>>;

  constructor(db: DynamoDB, table: string) {
    this.store = new EventStore<Event<string, RoverEvent>>(db, table);
  }

  public async get(simulationId: string) {
    let state = empty();
    for await (const e of this.store.read(simulationId)) {
      state = reduce([e.data], state);
    }
    return state;
  }

  public async save(simulationId: string, events: Array<RoverEvent>) {
    const wrapped: Array<Event<string, RoverEvent>> = events.map(e => ({
      type: e.tag,
      sequence: e.sequence,
      data: e,
    }));

    await this.store.write(simulationId, wrapped);
  }
}
