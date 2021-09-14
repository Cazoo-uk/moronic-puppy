import {Ulid} from 'id128';
import {EventRepository} from '../lib/infra';
import {create, addRover, moveRover, get} from '../lib/handlers';
import {DynamoDB} from '@aws-sdk/client-dynamodb';

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

test('create an move a rover', async () => {
  const db = local();
  const table = process.env.TABLE_NAME || 'events';
  const repo = new EventRepository(db, table!);

  const planetId = Ulid.generate().toCanonical();
  const firstRover = Ulid.generate().toCanonical();
  const secondRover = Ulid.generate().toCanonical();

  await create(repo, planetId, 10, 10);

  await addRover(repo, planetId, firstRover, 5, 5, 'N');
  await moveRover(repo, planetId, firstRover, 'FFRF');

  await addRover(repo, planetId, secondRover, 4, 4, 'S');
  await moveRover(repo, planetId, secondRover, 'FFLF');
  await moveRover(repo, planetId, secondRover, 'FFRFF');

  const data = await get(repo, planetId);

  console.log(JSON.stringify(data));
});
