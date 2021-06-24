export interface Position {
  x: number;
  y: number;
}

export type Bearing = 'N' | 'E' | 'S' | 'W';

export interface RoverState {
  position: Position;
  bearing: Bearing;
}

export interface Simulation {
  bounds: Position;
  count: number;
  sequence: number;
  rovers: {[key: number]: RoverState};
}

export function empty(): Simulation {
  return {
    bounds: {x: 0, y: 0},
    count: 0,
    rovers: {},
    sequence: 0,
  };
}

export type Start = {
  tag: 'Start';
  x: number;
  y: number;
};

export function start(x: number, y: number): Start {
  return {
    tag: 'Start',
    x,
    y,
  };
}

export type SimulationConfigured = {
  tag: 'SimulationConfigured';
  sequence: number;
  x: number;
  y: number;
};

function configure(cmd: Start, state: Simulation): Array<RoverEvent> {
  return [
    {
      tag: 'SimulationConfigured',
      x: cmd.x,
      y: cmd.y,
      sequence: 1,
    },
  ];
}

function onConfigured(e: SimulationConfigured, state: Simulation) {
  return {
    ...state,
    bounds: {x: e.x, y: e.y},
  };
}

export type Land = {
  tag: 'Land';
  id: number;
  bearing: Bearing;
  x: number;
  y: number;
};

export function land(id: number, x: number, y: number, bearing: Bearing): Land {
  return {tag: 'Land', x, y, id, bearing};
}

export function addRover(cmd: Land, state: Simulation): Array<RoverEvent> {
  return [
    {
      tag: 'RoverLanded',
      x: cmd.x,
      y: cmd.y,
      bearing: cmd.bearing,
      id: cmd.id,
      sequence: state.sequence + 1,
    },
  ];
}

export type RoverLanded = {
  tag: 'RoverLanded';
  x: number;
  y: number;
  sequence: number;
  id: number;
  bearing: Bearing;
};

const onLanded = (e: RoverLanded, state: Simulation) => {
  const result = {...state};
  result.rovers[e.id] = {
    bearing: e.bearing,
    position: {x: e.x, y: e.y},
  };
  result.count++;
  return result;
};

export type RoverCommand = Start | Land;
export type RoverEvent = SimulationConfigured | RoverLanded;

export function decide(
  cmd: RoverCommand,
  state: Simulation
): Array<RoverEvent> {
  switch (cmd.tag) {
    case 'Start':
      return configure(cmd, state);
    case 'Land':
      return addRover(cmd, state);
  }
}

export function apply(events: Array<RoverEvent>, state: Simulation) {
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    switch (e.tag) {
      case 'RoverLanded':
        state = onLanded(e, state);
        break;
      case 'SimulationConfigured':
        state = onConfigured(e, state);
        break;
    }
  }
  return state;
}
