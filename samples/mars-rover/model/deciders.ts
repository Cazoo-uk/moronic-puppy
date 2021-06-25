import {Simulation, move, left, right} from './state';
import {RoverEvent} from './events';
import {Start, Move, Land, RoverCommand} from './commands';

export type Decision = Success | Failure;

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

const ok = (events: Array<RoverEvent>): Success => ({
  tag: 'Success',
  events,
  isOk: true,
});
const fail = (msg?: string): Failure => ({tag: 'Failure', msg, isOk: false});

/*
 * Deciders take a command plus a state and return either
 * * Success with a list of events for the decisions we took
 * * Failure with a message
 * */

export type Decider<T extends RoverCommand> = (
  cmd: RoverCommand,
  state: Simulation
) => Decision;

/*
 * We use a simple dispatch table to match commands with deciders
 */
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

function configure(cmd: Start, state: Simulation): Decision {
  if (state.count > 0) {
    return fail("Can't re-configure a simulation with landed rovers");
  }
  return ok([
    {
      tag: 'SimulationConfigured',
      x: cmd.x,
      y: cmd.y,
      sequence: 1,
    },
  ]);
}

function addRover(cmd: Land, state: Simulation): Decision {
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

function processMoves(cmd: Move, state: Simulation) {
  let rover = state.rovers.get(cmd.id);
  if (undefined === rover) return fail(`Rover ${cmd.id} not found`);

  for (let i = 0; i < cmd.instructions.length; i++) {
    const instruction = cmd.instructions[i];

    switch (instruction) {
      case 'F':
      case 'B':
        rover = move(rover, instruction);
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
      tag: 'RoverMoved',
      x: rover.position.x,
      y: rover.position.y,
      id: cmd.id,
      bearing: rover.bearing,
      sequence: state.sequence + 1,
    },
  ]);
}
