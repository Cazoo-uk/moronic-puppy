import {Ulid} from 'id128';
import {local} from '../../test/helpers';
import {EventRepository} from './infra';
import {create, addRover, moveRover, get} from './handlers';

test('create an move a rover', async () => {
  const db = local();
  const table = process.env.TABLE_NAME;
  const repo = new EventRepository(db, table!);

  const planetId = Ulid.generate().toCanonical();
  const roverId = Ulid.generate().toCanonical();

  await create(repo, planetId, 10, 10);
  await addRover(repo, planetId, roverId, 5, 5, 'N');
  await moveRover(repo, planetId, roverId, 'FFRF');

  const data = await get(repo, planetId);

  console.log(JSON.stringify(data));
});
