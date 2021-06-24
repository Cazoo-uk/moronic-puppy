import {Bearing, decide, empty, start, land, move, Repository} from './model';
import {Ulid} from 'id128';

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
  roverId: number,
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
  roverId: number,
  instructions: string
) => {
  const state = await repo.get(simulationId);
  const result = decide(move(roverId, instructions), state);
  if (result.isOk) {
    await repo.save(simulationId, result.events);
  }
};

export {get, create, addRover, moveRover};
