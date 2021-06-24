import {
  empty,
  start,
  land,
  decide,
  apply,
  Decision,
  Success,
  Failure,
  RoverEvent,
} from './model';

const given_a_running_sim = (x: number, y: number) => {
  const decision = decide(start(x, y), empty());
  return apply(assert_ok(decision), empty());
};

const assert_ok = (decision: Decision): Array<RoverEvent> => {
  if (decision.isOk) return decision.events;
  throw new Error('Expected OK, but was not');
};

describe('When creating the simulation', () => {
  const state = empty();

  it('should not contain any rovers', () => {
    expect(state.count).toBe(0);
  });

  it('should have zero size', () => {
    expect(state.bounds).toMatchObject({
      x: 0,
      y: 0,
    });
  });
});

describe('When starting the simulation', () => {
  const cmd = start(10, 20);

  const events = assert_ok(decide(cmd, empty()));
  const state = apply(events, empty());

  it('should raise SimulationConfigured', () => {
    expect(events).toHaveLength(1);

    const [event] = events;
    expect(event.tag).toBe('SimulationConfigured');
    expect(event.x).toBe(10);
    expect(event.y).toBe(20);
  });

  it('should be sequence 0', () => {
    expect(events[0].sequence).toBe(1);
  });

  it('should not contain any rovers', () => {
    expect(state.count).toBe(0);
  });

  it('should have the correct size', () => {
    expect(state.bounds).toMatchObject({
      x: 10,
      y: 20,
    });
  });
});

describe('When a rover lands', () => {
  describe('And is in bounds', () => {
    const state = given_a_running_sim(10, 10);
    const events = assert_ok(decide(land(1, 5, 5, 'N'), state));

    const result = apply(events, state);

    it('should have one rover', () => {
      expect(result.count).toBe(1);
    });

    it('should have raised RoverLanded', () => {
      expect(events).toHaveLength(1);
      const [e] = events;

      expect(e.tag).toBe('RoverLanded');
    });

    it('should have landed in the correct position and bearing', () => {
      const rover = result.rovers[1];
      expect(rover.bearing).toBe('N');
      expect(rover.position).toMatchObject({
        x: 5,
        y: 5,
      });
    });
  });

  describe('and is out of bounds', () => {
    const state = given_a_running_sim(10, 10);
    const decision = decide(land(1, 20, 20, 'W'), state);

    it('should return Error', () => {
      expect(decision.isOk).toBe(false);
    });
  });
});
