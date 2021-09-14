import {Simulation} from './state';
import {RoverEvent} from './events';

export type {Bearing } from './state';
export {empty} from './state'
export type {RoverEvent} from './events';
export {decide} from './deciders';
export type {Success, Failure, Decision, } from './deciders';
export {reduce} from './reducers';

export {start, land, move} from './commands';

export interface Repository {
  get: (simulationId: string) => Promise<Simulation>;
  save: (simulationId: string, events: Array<RoverEvent>) => Promise<void>;
}
