import {Map} from 'immutable';
/*
 * Basic domain model for the Mars Rover kata
 */

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
  rovers: Map<string, RoverState>;
}

export function empty(): Simulation {
  return {
    bounds: {x: 0, y: 0},
    count: 0,
    rovers: Map({}),
    sequence: 0,
  };
}

const bearings: Array<Bearing> = ['N', 'E', 'S', 'W'];

export function move(rover: RoverState, cmd: 'F' | 'B') {
  const pos = rover.position;
  let dy = 0,
    dx = 0;
  switch (rover.bearing) {
    case 'N':
      dy = 1;
      break;
    case 'W':
      dx = -1;
      break;
    case 'S':
      dy = -1;
      break;
    case 'E':
      dx = 1;
      break;
  }

  if (cmd === 'B') {
    dy *= -1;
    dx *= -1;
  }

  return {...rover, position: {x: pos.x + dx, y: pos.y + dy}};
}

export function right(rover: RoverState) {
  const i = bearings.indexOf(rover.bearing);
  const newBearing = bearings[(i + 1) % 4];
  return {...rover, bearing: newBearing};
}

export function left(rover: RoverState) {
  const i = bearings.indexOf(rover.bearing);
  const newBearing = bearings[(i + 3) % 4];
  return {...rover, bearing: newBearing};
}
