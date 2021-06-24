import {DynamoDB, AttributeValue} from '@aws-sdk/client-dynamodb';
import {Ulid} from 'id128';

export interface Event<TType = string, TPayload = unknown> {
  sequence: number;
  type: TType;
  data: TPayload;
}

export type Success = {tag: 'Success'; isOk: true; isError: false};
export type Conflict = {tag: 'Conflict'; isOk: false; isError: true};

function isArray<T = unknown>(a: unknown): a is T[] {
  return Array.isArray(a);
}

export class EventStore<TEvent extends Event = Event> {
  #client: DynamoDB;
  #table: string;

  constructor(client: DynamoDB, table: string) {
    this.#table = table;
    this.#client = client;
  }

  public async write(
    stream: string,
    events: Array<TEvent>
  ): Promise<Success | Conflict>;
  public async write(
    stream: string,
    event: TEvent
  ): Promise<Success | Conflict>;
  public async write(
    stream: string,
    events: Array<TEvent> | TEvent
  ): Promise<Success | Conflict> {
    if (!isArray<TEvent>(events)) events = [events];
    try {
      const request = events.map(e => ({
        Put: eventInsert(this.#table, stream, e),
      }));
      await this.#client.transactWriteItems({TransactItems: request});
      return {tag: 'Success', isOk: true, isError: false};
    } catch (e) {
      if (e.name === 'TransactionCanceledException') {
        return {
          tag: 'Conflict',
          isOk: false,
          isError: true,
        };
      }
      throw e;
    }
  }

  public async *read(stream: string): AsyncGenerator<TEvent> {
    const result = await this.#client.query({
      TableName: this.#table,
      ExpressionAttributeValues: {
        ':stream': {S: stream},
      },
      KeyConditionExpression: 'PK = :stream',
    });

    for (const item of result.Items || []) {
      yield this.eventFromData(item);
    }
  }

  private eventFromData(item: {[key: string]: AttributeValue}) {
    return {
      sequence: parseInt(item.SK.N!),
      type: item.TYPE.S || '',
      data: JSON.parse(item.DATA.S || ''),
    } as TEvent;
  }

  public async createTable() {
    await this.#client.createTable({
      AttributeDefinitions: [
        {AttributeName: 'PK', AttributeType: 'S'},
        {AttributeName: 'SK', AttributeType: 'S'},
      ],
      KeySchema: [
        {AttributeName: 'PK', KeyType: 'HASH'},
        {AttributeName: 'SK', KeyType: 'RANGE'},
      ],
      TableName: this.#table,
      BillingMode: 'PAY_PER_REQUEST',
    });
  }
}

function eventInsert<TEvent extends Event = Event>(
  table: string,
  stream: string,
  event: TEvent
) {
  const id = Ulid.generate().toCanonical();
  return {
    TableName: table,
    ConditionExpression: 'attribute_not_exists(PK)',
    ReturnValues: 'ALL_OLD',
    Item: {
      PK: {S: stream},
      SK: {S: `@${event.sequence}`},
      ID: {S: id},
      TYPE: {S: event.type},
      DATA: {S: JSON.stringify(event.data)},
    },
  };
}
