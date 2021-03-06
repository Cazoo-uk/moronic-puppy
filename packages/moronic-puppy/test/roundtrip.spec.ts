import {EventStore, Success, Conflict, EventMetadata} from '../lib';
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
  let result: Array<PonyJumped & EventMetadata>;

  beforeAll(async () => {
    const store = await given_an_empty_event_store();
    await store.write(streamName, event);

    result = await copy(store.read(streamName));
  });

  it('should contain a single event', () => {
    expect(result).toHaveLength(1);
  });

  it('should contain the event', () => {
    const [e] = result;
    expect(e.data).toMatchObject(event.data);
    expect(e.type).toBe('PonyJumped');
  });

  it('should contain the stream', () => {
    const [e] = result;
    expect(e.stream).toEqual(streamName);
  });

  it('should have an id', () => {
    const [e] = result;
    expect(e.id).toBeTruthy();
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

describe('When writing multiple events', () => {
  const streamName = random_stream();
  let store: EventStore<PonyJumped>;
  let result: Array<PonyJumped & EventMetadata>;

  beforeAll(async () => {
    store = await given_an_empty_event_store();
    await store.write(streamName, [
      jump(1, 'InitialHooves'),
      jump(2, 'SecondHooves'),
      jump(3, 'TertiaryHooves'),
    ]);
    result = await copy(store.read(streamName));
  });

  it('should write 3 items', () => {
    expect(result).toHaveLength(3);
  });

  it('should order the events correctly', () => {
    expect(result[0].data.name).toBe('InitialHooves');
    expect(result[1].data.name).toBe('SecondHooves');
    expect(result[2].data.name).toBe('TertiaryHooves');
  });

  it('should assign incrementing ids', () => {
    expect(result[0].id < result[1].id).toBeTruthy();
    expect(result[1].id < result[2].id).toBeTruthy();
  });
});

describe('When writing multiple events with the same sequence number', () => {
  const streamName = random_stream();
  let store: EventStore<PonyJumped>;
  let stored: Array<PonyJumped>;
  let result: Success | Conflict;

  beforeAll(async () => {
    store = await given_an_empty_event_store();
    result = await store.write(streamName, [
      jump(1, 'InitialHooves'),
      jump(2, 'SecondHooves'),
      jump(2, 'TertiaryHooves'),
    ]);
    stored = await copy(store.read(streamName));
  });

  it('should write 0 items', async () => {
    expect(stored).toHaveLength(0);
  });

  it('should return conflict', () => {
    expect(result.isOk).toBe(false);
  });
});
