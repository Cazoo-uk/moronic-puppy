import { AttributeValue, DynamoDB } from "@aws-sdk/client-dynamodb";
import { Ulid } from "id128";
export * from "./projector";

const isError = function (exception: any): exception is Error {
  return (
    typeof exception == "object" &&
    exception !== null &&
    "name" in exception &&
    typeof exception.name === "string" &&
    "message" in exception &&
    typeof exception.message === "string"
  );
};

export interface Event<TType extends string = string, TPayload = unknown> {
  sequence: number;
  type: TType;
  data: TPayload;
}

export interface EventMetadata {
  stream: string;
  id: string;
}

export type Loaded<T> = T & EventMetadata;

export type Success = { tag: "Success"; isOk: true; isError: false };
export type Conflict = { tag: "Conflict"; isOk: false; isError: true };

function isArray<T = unknown>(a: unknown): a is T[] {
  return Array.isArray(a);
}

export class EventStore<TData extends Event = Event> {
  #client: DynamoDB;
  #table: string;

  constructor(client: DynamoDB, table: string) {
    this.#table = table;
    this.#client = client;
  }

  public async write(
    stream: string,
    events: Array<TData>
  ): Promise<Success | Conflict>;
  public async write(stream: string, event: TData): Promise<Success | Conflict>;
  public async write(
    stream: string,
    events: Array<TData> | TData
  ): Promise<Success | Conflict> {
    if (!isArray(events)) events = [events];
    try {
      const request = events.map((e) => ({
        Put: eventInsert(this.#table, stream, e),
      }));
      await this.#client.transactWriteItems({ TransactItems: request });
      return { tag: "Success", isOk: true, isError: false };
    } catch (e) {
      if (isError(e) && e.name === "TransactionCanceledException") {
        return {
          tag: "Conflict",
          isOk: false,
          isError: true,
        };
      }
      throw e;
    }
  }

  public async *read(stream: string): AsyncGenerator<TData & EventMetadata> {
    const result = await this.#client.query({
      TableName: this.#table,
      ExpressionAttributeValues: {
        ":stream": { S: stream },
      },
      KeyConditionExpression: "PK = :stream",
    });

    for (const item of result.Items || []) {
      yield this.eventFromData(stream, item);
    }
  }

  private eventFromData(
    stream: string,
    item: { [key: string]: AttributeValue }
  ) {
    return {
      id: item.DATA.S,
      stream,
      sequence: item.SK,
      type: item.TYPE.S || "",
      data: JSON.parse(item.DATA.S || ""),
    } as unknown as TData & EventMetadata;
  }

  public async createTable() {
    await this.#client.createTable({
      AttributeDefinitions: [
        { AttributeName: "PK", AttributeType: "S" },
        { AttributeName: "SK", AttributeType: "N" },
      ],
      KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" },
        { AttributeName: "SK", KeyType: "RANGE" },
      ],
      TableName: this.#table,
      BillingMode: "PAY_PER_REQUEST",
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
    ConditionExpression: "attribute_not_exists(PK)",
    ReturnValues: "ALL_OLD",
    Item: {
      PK: { S: stream },
      SK: { N: event.sequence.toString() },
      ID: { S: id },
      TYPE: { S: event.type },
      DATA: { S: JSON.stringify(event.data) },
    },
  };
}
