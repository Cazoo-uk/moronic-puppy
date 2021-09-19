import { Loaded } from "@moronic-puppy/core";
import { SQSEvent } from "aws-lambda";
import { ProjectorSource, ProjectorState } from "@moronic-puppy/core/projector";
import { readS3 } from "@moronic-puppy/core/projector.cloud";
import { FootballEvent, processEvent } from ".";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  AttributeValue,
} from "@aws-sdk/client-dynamodb";

const BUCKET_NAME = process.env.ARCHIVE_BUCKET_NAME || "bob-eventstore-archive";
const TABLE_NAME = process.env.PROJECTION_TABLE;

function eventFromData(data: string): Loaded<FootballEvent> {
  const json = JSON.parse(data);
  const item = json.dynamodb.NewImage;

  return {
    id: item.ID.S,
    stream: item.PK.S,
    sequence: item.SK.N,
    type: item.TYPE.S || "",
    data: JSON.parse(item.DATA.S || ""),
  };
}

const __EMPTY = { type: "EMPTY" as const };

class DynamoStateStore {
  state: ProjectorState = { type: "EMPTY" };
  #table: string;
  #projector: string;
  #client: DynamoDBClient;

  constructor(table: string, projector: string, client?: DynamoDBClient) {
    this.#table = table;
    this.#projector = projector;
    this.#client = client || new DynamoDBClient({});
  }

  private parseStateRecord(item: {
    [key: string]: AttributeValue;
  }): ProjectorState {
    if (item === undefined) return __EMPTY;
    if (false === "TYPE" in item) return __EMPTY;

    switch (item.TYPE.S) {
      case "LIVE":
        return {
          type: "LIVE",
          payload: {
            lastEvent: item.LAST_EVENT.S,
          },
        };
      case "CATCHUP":
        return {
          type: "CATCHUP",
          payload: {
            chunk: item.CHUNK.S,
            lastEvent: item.LAST_EVENT.S,
          },
        };
    }

    return __EMPTY;
  }

  async get() {
    const data = await this.#client.send(
      new GetItemCommand({
        TableName: this.#table,
        Key: {
          PK: { S: "__STATE" },
          SK: { S: this.#projector },
        },
      })
    );

    return this.parseStateRecord(data.Item);
  }

  async put(state: ProjectorState) {
    const Item: { [key: string]: AttributeValue } = {
      PK: { S: "__STATE" },
      SK: { S: this.#projector },
      TYPE: { S: state.type },
    };
    if (state.type !== "EMPTY") {
      Item.LAST_EVENT = { S: state.payload.lastEvent };
    }
    if (state.type === "CATCHUP") {
      Item.CHUNK = { S: state.payload.chunk };
    }

    await this.#client.send(
      new PutItemCommand({
        TableName: this.#table,
        Item,
      })
    );
  }
}

class StubStateStore {
  state: ProjectorState = { type: "EMPTY" };

  async get() {
    return this.state;
  }
  async put(state: ProjectorState) {
    this.state = state;
  }
}

async function* readSQS(event: SQSEvent) {
  for (const record of event.Records) {
    const payload = Buffer.from(record.body, "base64").toString();
    yield eventFromData(payload);
  }
}

export async function handler(event: SQSEvent) {
  const projector = new ProjectorSource<Loaded<FootballEvent>>(
    readS3({ bucket: BUCKET_NAME }),
    readSQS(event),
    processEvent,
    new DynamoStateStore(TABLE_NAME!, "goals")
  );

  await projector.run();
}
