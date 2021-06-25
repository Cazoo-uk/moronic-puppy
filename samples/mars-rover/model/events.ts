/*
 * Events record the decisions that the domain has made in response to commands
 */
import {Bearing} from './state'
export type RoverEvent = SimulationConfigured | RoverLanded | RoverMoved;

export type SimulationConfigured = {
  tag: 'SimulationConfigured';
  sequence: number;
  x: number;
  y: number;
};

export type RoverLanded = {
  tag: 'RoverLanded';
  x: number;
  y: number;
  sequence: number;
  id: string;
  bearing: Bearing;
};

export type RoverMoved = {
  tag: 'Moved';
  id: string;
  x: number;
  y: number;
  bearing: Bearing;
  sequence: number;
};
