import {
  GetObjectCommandInput,
  ListObjectsV2CommandInput,
  S3,
} from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  AttributeValue,
} from "@aws-sdk/client-dynamodb";

import { Readable } from "stream";
import { chain } from "stream-chain";
import * as StreamValues from "stream-json/streamers/StreamValues";
import { createGunzip } from "zlib";

import { ProjectorState, EventMetadata } from ".";
import { Archive } from "./projector";

interface S3SourceParams {
  bucket: string;
  client?: S3;
}
const __EMPTY = { type: "EMPTY" as const };

export class DynamoStateStore {
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

export function readS3<TEvent extends EventMetadata>(
  params: S3SourceParams
): Archive<TEvent> {
  return async function* (currentChunk: string) {
    const client = params.client || new S3({});
    console.log(params.bucket);
    for await (const file of listFiles(params.bucket, client, currentChunk)) {
      if (file === undefined) continue;
      const events = await readEvents<TEvent>(file, params.bucket, client);

      yield {
        id: file,
        events,
      };
    }
  };
}

export const eventFrom = (e: any) => ({
  type: e.TYPE.S,
  stream: e.PK.S,
  sequence: e.SK.N,
  id: e.ID.S,
  data: JSON.parse(e.DATA.S),
});

async function readEvents<TEvent>(
  key: string,
  bucket: string,
  client: S3
): Promise<Array<TEvent>> {
  const params: GetObjectCommandInput = {
    Bucket: bucket,
    Key: key,
  };

  const result = [];
  const data = await client.getObject(params);
  if (undefined === data.Body)
    throw new Error("Missing archive object " + key + "in " + bucket);

  const pipeline = chain([
    data.Body as Readable,
    createGunzip(),
    StreamValues.withParser(),
    (e) => eventFrom(e.value.dynamodb.NewImage),
  ]);

  for await (const e of pipeline) {
    result.push(e);
  }

  return result;
}

async function* listFiles(bucket: string, client: S3, marker: string) {
  const opts: ListObjectsV2CommandInput = {
    Bucket: bucket,
    StartAfter: marker,
  };
  do {
    const data = await client.listObjectsV2(opts);
    opts.ContinuationToken = data.NextContinuationToken;
    if (data.Contents === undefined) break;
    for (const o of data.Contents) {
      console.log(`reading events from chunk ${o.Key}`);
      yield o.Key;
    }
  } while (opts.ContinuationToken);
}
