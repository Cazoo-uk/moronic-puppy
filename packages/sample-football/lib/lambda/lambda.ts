import { Loaded } from '../../../../src';
import {SQSEvent} from 'aws-lambda';
import {ProjectorSource, ProjectorState} from '../../../../src/projector'
import {readS3} from '../../../../src/projector.cloud'
import {FootballEvent, processEvent} from '.'

const BUCKET_NAME = process.env.ARCHIVE_BUCKET_NAME || "bob-eventstore-archive";

  function eventFromData(data: string) : Loaded<FootballEvent> {
      const json = JSON.parse(data)
      const item = json.dynamodb.NewImage;

    return {
      id: item.ID.S,
      stream: item.PK.S,
      sequence: item.SK.N,
      type: item.TYPE.S || '',
      data: JSON.parse(item.DATA.S || ''),
    };
  }

class StubStateStore {

      state:  ProjectorState = {type: 'EMPTY'}

      async get() { return this.state  }
      async put(state: ProjectorState) { this.state = state }
  }

async function *readSQS (event: SQSEvent) {
    for (const record of event.Records) {
        const payload = Buffer.from(record.body, 'base64').toString();
        yield eventFromData(payload)
    }
}

export async function handler (event:SQSEvent) {
    const projector = new ProjectorSource(
        readS3({bucket: BUCKET_NAME}),
        readSQS(event),
        processEvent,
        new StubStateStore()
    )

    await projector.run()
}
