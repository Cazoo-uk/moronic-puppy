import {EventStore} from '../src';
import {
  random_stream,
  copy,
  jump,
  PonyJumped,
  given_an_empty_event_store,
} from './helpers';

describe('When writing to a new stream', () => {
  const streamName = random_stream();
  const event = jump(0, 'SparkleHooves', 5);
  let result: Array<PonyJumped>;

  beforeAll(async () => {
    const store = await given_an_empty_event_store();
    await store.write(streamName, event);

    result = await copy(store.read(streamName));
  });

  it('should contain a single event', () => {
    expect(result).toHaveLength(1);
  });

  it('should contain the event', async () => {
    const [e] = result;
    expect(e.data).toMatchObject(event.data);
    expect(e.type).toBe('PonyJumped');
  });
});

describe('When writing to an existing stream', () => {
  const streamName = random_stream();
  let store: EventStore<PonyJumped>;

  beforeAll(async () => {
    store = await given_an_empty_event_store();
    await store.write(streamName, jump(1, 'InitialHooves'));
    await store.write(streamName, jump(2));
  });

  it('should prevent writes for an existing sequence number', async () => {
    const result = await store.write(streamName, jump(1, 'UpdatedHooves'));
    expect(result.tag).toBe('Conflict');
  });

  it('should accept writes for a future version', async () => {
    const result = await store.write(streamName, jump(3));
    expect(result.tag).toBe('Success');
  });
});
