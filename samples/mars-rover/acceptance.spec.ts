import {Ulid} from 'id128';
import {local} from '../../test/helpers';
import {EventRepository} from './infra';
import {create, addRover, moveRover, get} from './handlers';

test('create an move a rover', async () => {
  const db = local();
  const table = process.env.TABLE_NAME;
  const repo = new EventRepository(db, table!);

  const id = Ulid.generate().toCanonical();

  await create(repo, id, 10, 10);
  await addRover(repo, id, 1, 5, 5, 'N');
  await moveRover(repo, id, 1, 'FFRF');

  console.log(JSON.stringify(await get(repo, id)));
});
