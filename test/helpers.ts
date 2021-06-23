import {DynamoDB} from '@aws-sdk/client-dynamodb';
import {EventStore} from '../src';

export function local() {
  return new DynamoDB({
    endpoint: 'http://127.0.0.1:8000',
    region: 'eu-west-1',
    credentials: {
      accessKeyId: 'fake-id',
      secretAccessKey: 'fake-secret',
    },
  });
}

export interface PonyJumped {
  type: 'PonyJumped';
  data: {
    name: string;
    distance: number;
  };
  sequence: number;
}

export async function given_an_empty_event_store() {
  const name = new Date().getTime();
  const store = new EventStore<PonyJumped>(local(), name.toString());
  console.log(`creating table ${name}`);
  await store.createTable();
  return store;
}

export async function copy(g: AsyncGenerator<PonyJumped>) {
  const result: Array<PonyJumped> = [];
  for await (const e of g) {
    result.push(e);
  }
  return result;
}

export function random_stream() {
  return 'radom';
}

export function jump(sequence: number, name = 'SparkleHooves', distance = 1) {
  return {
    sequence,
    type: 'PonyJumped' as const,
    data: {
      name,
      distance,
    },
  };
}
