import {Bearing} from './state';
/*
 * Commands are instructions for the system to do a thing.
 * In this case we use a tagged union for the command type
 * and expose a helper func for each command to make it easier
 * to construct commands in tests
 */
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

export type Land = {
  tag: 'Land';
  id: string;
  bearing: Bearing;
  x: number;
  y: number;
};

export function land(id: string, x: number, y: number, bearing: Bearing): Land {
  return {tag: 'Land', x, y, id, bearing};
}

export type Move = {
  tag: 'Move';
  id: string;
  instructions: string;
};

export function move(id: string, instructions: string): Move {
  return {
    tag: 'Move',
    id,
    instructions,
  };
}

export type RoverCommand = Start | Land | Move;
