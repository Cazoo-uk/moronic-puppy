import { Event, Loaded } from "@moronic-puppy/core";

type Side = "HOME" | "AWAY";

export interface KickOffPayload {
  home: string;
  away: string;
  date: string;
}

export interface GoalPayload {
  side: Side;
}

type GoalScored = Event<"GOAL_SCORED", GoalPayload>;
type KickOff = Event<"GAME_STARTED", KickOffPayload>;
export type FootballEvent = Loaded<GoalScored | KickOff> | Event;

interface Game {
  home: string;
  away: string;
  score: {
    home: number;
    away: number;
  };
}

function isGoal(event: FootballEvent): event is Loaded<GoalScored> {
  return event.type === "GOAL_SCORED";
}

function isKickoff(event: FootballEvent): event is Loaded<KickOff> {
  return event.type === "GAME_STARTED";
}

const games: Record<string, Game> = {};

async function createGame(event: Loaded<KickOff>) {
  games[event.stream] = {
    home: event.data.home,
    away: event.data.away,
    score: { home: 0, away: 0 },
  };
}

async function updateScore(event: Loaded<GoalScored>) {
  const game = games[event.stream];
  if (undefined === game) {
    console.log(`Unrecognised game id ${event.stream}`);
    return;
  }

  if (event.data.side === "HOME") {
    game.score.home++;
  } else {
    game.score.away++;
  }
}

export async function processEvent(event: FootballEvent) {
  if (isKickoff(event)) {
    console.log(
      `New game ${event.stream}: ${event.data.home} vs ${event.data.away}`
    );
    await createGame(event);
  } else if (isGoal(event)) {
    console.log(`${event.data.side} goal`);
    await updateScore(event);
  } else {
    console.log(`Disregarding ${event.type} event`);
    return;
  }

  console.log(JSON.stringify(games));
}
