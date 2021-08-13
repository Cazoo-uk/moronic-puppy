import {Event} from '../src';

type Side = 'HOME' | 'AWAY';

type Outcome = 'ON_TARGET' | 'OFF_TARGET' | 'BLOCKED' | 'HIT_THE_BAR';

interface EventPayload {
  text: string;
  side: Side;
  time: number;
}

export interface GoalPayload extends EventPayload {
  player: string;
  location: number;
  situation: number;
}

export interface AttemptPayload extends EventPayload {
  player: string;
  location: number;
  situation: number;
  result: Outcome;
}

type EventName =
  | 'CORNER'
  | 'FOUL'
  | 'FIRST_YELLOW_CARD'
  | 'SECOND_YELLOW_CARD'
  | 'RED_CARD'
  | 'SUBSTITUTION'
  | 'FREE_KICK_WON'
  | 'OFFSIDE'
  | 'HAND_BALL'
  | 'PENALTY_CONCEDED'
  | 'GOAL_ATTEMPT'
  | 'GOAL_SCORED';

type FootballEvent<
  TName extends EventName,
  TPayload extends EventPayload
> = Event<TName, TPayload>;

type GoalScored = FootballEvent<'GOAL_SCORED', GoalPayload>;
type GoalAttempt = FootballEvent<'GOAL_ATTEMPT', AttemptPayload>;

export type GoalEvent = GoalScored | GoalAttempt;
