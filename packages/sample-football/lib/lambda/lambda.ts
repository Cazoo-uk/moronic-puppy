import { Loaded } from "@moronic-puppy/core";
import { SQSEvent } from "aws-lambda";
import { ProjectorSource, ProjectorState } from "@moronic-puppy/core/projector";
import { readS3, DynamoStateStore } from "@moronic-puppy/core/projector.cloud";
import { FootballEvent, processEvent } from ".";
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
