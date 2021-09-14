import {Bearing, decide, empty, start, land, move, Repository} from './model';

/*
 * Handlers are the use-cases for our system and are directly invoked by Lambda functions
 * They are responsible for orchestrating the flow of a request.
 * Handlers usually GET some state, DECIDE some command, and SAVE some state.
 */

const get = async (repo: Repository, simulationId: string) => {
  return await repo.get(simulationId);
};

const create = async (
  repo: Repository,
  simulationId: string,
  x: number,
  y: number
) => {
  const result = decide(start(x, y), empty());

  if (result.isOk) await repo.save(simulationId, result.events);
};

const addRover = async (
  repo: Repository,
  simulationId: string,
  roverId: string,
  x: number,
  y: number,
  bearing: Bearing
) => {
  const state = await repo.get(simulationId);
  const result = decide(land(roverId, x, y, bearing), state);
  if (result.isOk) await repo.save(simulationId, result.events);
};

const moveRover = async (
  repo: Repository,
  simulationId: string,
  roverId: string,
  instructions: string
) => {
  const state = await repo.get(simulationId);
  const result = decide(move(roverId, instructions), state);
  if (result.isOk) {
    await repo.save(simulationId, result.events);
  }
};

export {get, create, addRover, moveRover};
