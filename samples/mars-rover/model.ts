export interface Position {
  x: number;
  y: number;
}

export type Bearing = 'N' | 'E' | 'S' | 'W';
const bearings: Array<Bearing> = ['N', 'E', 'S', 'W'];

export type Success = {
  tag: 'Success';
  isOk: true;
  events: Array<RoverEvent>;
};

export type Failure = {
  tag: 'Failure';
  isOk: false;
  msg?: string;
};

export type Decision = Success | Failure;

const ok = (events: Array<RoverEvent>): Success => ({
  tag: 'Success',
  events,
  isOk: true,
});
const fail = (msg?: string): Failure => ({tag: 'Failure', msg, isOk: false});

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

function configure(cmd: Start, state: Simulation): Decision {
  return ok([
    {
      tag: 'SimulationConfigured',
      x: cmd.x,
      y: cmd.y,
      sequence: 1,
    },
  ]);
}

function onConfigured(e: SimulationConfigured, state: Simulation) {
  return {
    ...state,
    bounds: {x: e.x, y: e.y},
    sequence: 1 + state.sequence,
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

export function addRover(cmd: Land, state: Simulation): Decision {
  if (cmd.x > state.bounds.x || cmd.y > state.bounds.y)
    return fail('Landing coordinates out of range');

  if (cmd.x < 0 || cmd.y < 0)
    return fail('Landing coordinates must be positive');

  return ok([
    {
      tag: 'RoverLanded',
      x: cmd.x,
      y: cmd.y,
      bearing: cmd.bearing,
      id: cmd.id,
      sequence: state.sequence + 1,
    },
  ]);
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

export type Move = {
  tag: 'Move';
  id: number;
  instructions: string;
};

export function move(id: number, instructions: string): Move {
  return {
    tag: 'Move',
    id,
    instructions,
  };
}

export type RoverMoved = {
  tag: 'Moved';
  id: number;
  x: number;
  y: number;
  bearing: Bearing;
  sequence: number;
};

function forward(rover: RoverState) {
  const pos = rover.position;
  switch (rover.bearing) {
    case 'N':
      return {...rover, position: {x: pos.x, y: 1 + pos.y}};
    case 'W':
      return {...rover, position: {x: pos.x + 1, y: pos.y}};
    case 'S':
      return {...rover, position: {x: pos.x, y: pos.y - 1}};
    case 'E':
      return {...rover, position: {x: pos.x - 1, y: pos.y}};
  }
}

function right(rover: RoverState) {
  const i = bearings.indexOf(rover.bearing);
  const newBearing = bearings[(i + 1) % 4];
  return {...rover, bearing: newBearing};
}

function left(rover: RoverState) {
  const i = bearings.indexOf(rover.bearing);
  const newBearing = bearings[(i + 3) % 4];
  return {...rover, bearing: newBearing};
}

function processMoves(cmd: Move, state: Simulation) {
  let rover = state.rovers[cmd.id];

  for (let i = 0; i < cmd.instructions.length; i++) {
    const instruction = cmd.instructions[i];

    switch (instruction) {
      case 'F':
        rover = forward(rover);
        break;
      case 'R':
        rover = right(rover);
        break;
      case 'L':
        rover = left(rover);
        break;
    }
  }

  return ok([
    {
      tag: 'Moved',
      x: rover.position.x,
      y: rover.position.y,
      id: cmd.id,
      bearing: rover.bearing,
      sequence: state.sequence + 1,
    },
  ]);
}

function onMove(event: RoverMoved, state: Simulation) {
  state.rovers[event.id] = {
    position: {
      x: event.x,
      y: event.y,
    },
    bearing: event.bearing,
  };
  return state;
}

export type RoverCommand = Start | Land | Move;
export type RoverEvent = SimulationConfigured | RoverLanded | RoverMoved;

export function decide(cmd: RoverCommand, state: Simulation): Decision {
  switch (cmd.tag) {
    case 'Start':
      return configure(cmd, state);
    case 'Land':
      return addRover(cmd, state);
    case 'Move':
      return processMoves(cmd, state);
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
      case 'Moved':
        state = onMove(e, state);
    }
  }
  return state;
}

export interface Repository {
  get: (simulationId: string) => Promise<Simulation>;
  save: (simulationId: string, events: Array<RoverEvent>) => Promise<void>;
}
