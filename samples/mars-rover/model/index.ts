import {Simulation} from './state';
import {RoverEvent} from './events';

export {Bearing, empty} from './state';
export {RoverEvent} from './events';
export {Success, Failure, Decision, decide} from './deciders';
export {reduce} from './reducers';

export {start, land, move} from './commands';

export interface Repository {
  get: (simulationId: string) => Promise<Simulation>;
  save: (simulationId: string, events: Array<RoverEvent>) => Promise<void>;
}
