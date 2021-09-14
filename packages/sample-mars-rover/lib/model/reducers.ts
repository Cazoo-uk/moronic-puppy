import {Simulation} from './state';
import {
  RoverEvent,
  SimulationConfigured,
  RoverMoved,
  RoverLanded,
} from './events';
/*
 * Reducers take an event and a state and apply the event to return a new state
 * They do not fail.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Reducer<TEvent extends RoverEvent> = (
  e: TEvent,
  state: Simulation
) => Simulation;

/*
 * We use a dispatch table to map events to reducers
 */

export function reduce(events: Array<RoverEvent>, state: Simulation) {
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    switch (e.tag) {
      case 'RoverLanded':
        state = onLanded(e, state);
        break;
      case 'SimulationConfigured':
        state = onConfigured(e, state);
        break;
      case 'RoverMoved':
        state = onMove(e, state);
        break;
    }
  }
  return state;
}

function onConfigured(e: SimulationConfigured, state: Simulation) {
  return {
    ...state,
    bounds: {x: e.x, y: e.y},
    sequence: 1 + state.sequence,
  };
}

const onLanded = (e: RoverLanded, state: Simulation) => {
  const result = {
    ...state,
    rovers: state.rovers.set(e.id, {
      bearing: e.bearing,
      position: {x: e.x, y: e.y},
    }),
    count: state.count + 1,
    sequence: state.sequence + 1,
  };
  return result;
};

function onMove(event: RoverMoved, state: Simulation) {
  const rovers = state.rovers.set(event.id, {
    position: {
      x: event.x,
      y: event.y,
    },
    bearing: event.bearing,
  });
  return {...state, rovers, sequence: state.sequence + 1};
}
