interface Position {
  x: number;
  y: number;
}

interface Simulation {
  bounds: Position;
  count: number;
  rovers: {[key: number]: unknown};
}

type Start = {
  tag: 'Start';
  x: number;
  y: number;
};

function empty(): Simulation {
  return {
    bounds: {x: 0, y: 0},
    count: 0,
    rovers: {},
  };
}

function start(x: number, y: number): Start {
  return {
    tag: 'Start',
    x,
    y,
  };
}
type SimulationConfigured = {
  tag: 'SimulationConfigured';
  x: number;
  y: number;
};

function decide(cmd: Start, state: Simulation): Array<SimulationConfigured> {
  return [
    {
      tag: 'SimulationConfigured',
      x: cmd.x,
      y: cmd.y,
    },
  ];
}

function apply(events: Array<SimulationConfigured>, state: Simulation) {
  for (let i = 0; i < events.length; i++) {
    state = {
      ...state,
      bounds: {
        x: events[i].x,
        y: events[i].y,
      },
    };
  }
  return state;
}

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

  const events = decide(cmd, empty());
  const state = apply(events, empty());

  it('should raise SimulationConfigured', () => {
    expect(events).toHaveLength(1);

    const [event] = events;
    expect(event.tag).toBe('SimulationConfigured');
    expect(event.x).toBe(10);
    expect(event.y).toBe(20);
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
