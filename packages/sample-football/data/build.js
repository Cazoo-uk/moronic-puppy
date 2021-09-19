const fs = require("fs");
const papa = require("papaparse");

const game_started = fs.createReadStream("./ginf.csv");
const game_events = fs.createReadStream("events.csv");
const out = fs.createWriteStream("./game_events.tsv", { flags: "w" });

const games = {};

papa.parse(game_started, {
  header: true,
  step: function (row) {
    games[row.data.id_odsp] = row;
  },
});
const shot_outcome = (o) => {
  switch (o) {
    case "1":
      return "ON_TARGET";
    case "2":
      return "OFF_TARGET";
    case "3":
      return "BLOCKED";
    case "4":
      return "HIT_THE_BAR";
  }
};

console.log(games);

const side = (x) => (x === "1" ? "HOME" : "AWAY");
const write = (type, e, payload) => {
  if (e.id_odsp in games) {
    const game = games[e.id_odsp];
    out.write(
      `${game.data.id_odsp}\t0\tGAME_STARTED\t${JSON.stringify({
        id: game.data.id_odsp,
        date: game.data.date,
        league: game.data.league,
        home: game.data.ht,
        away: game.data.at,
      })}\n`
    );
    delete games[e.id_odsp];
  }
  payload = payload || {};
  payload.text = e.text;
  payload.side = side(e.side);
  payload.time = e.time;
  if (e.location !== "NA") payload.location = parseInt(e.location);
  if (e.situation !== "NA") payload.situation = parseInt(e.situation);
  if (e.player !== "NA") payload.player = e.player;
  out.write(
    `${e.id_odsp}\t${e.sort_order}\t${type}\t${JSON.stringify(payload)}\n`
  );
};

function write_attempt(e) {
  if (e.is_goal === "1") {
    write("GOAL_SCORED", e, { is_own_goal: e.event_type2 === "15" });
  } else {
    write("GOAL_ATTEMPT", e, { result: shot_outcome(e) });
  }
}

function handleEvent(e) {
  switch (e.event_type) {
    case "1":
      write_attempt(e);
      break;
    case "2":
      write("CORNER", e);
      break;
    case "3":
      write("FOUL", e);
      break;
    case "4":
      write("FIRST_YELLOW_CARD", e);
      break;
    case "5":
      write("SECOND_YELLOW_CARD", e);
      break;
    case "6":
      write("RED_CARD", e);
      break;
    case "7":
      write("SUBSTITUTION", e, {
        player_in: e.player_in,
        player_out: e.player_out,
      });
      break;
    case "8":
      write("FREE_KICK_WON", e);
      break;
    case "9":
      write("OFFSIDE", e);
      break;
    case "10":
      write("HAND_BALL", e);
      break;
    case "11":
      write("PENALTY_CONCEDED", e);
      break;
  }
}

papa.parse(game_events, {
  header: true,
  step: function (row) {
    try {
      handleEvent(row.data);
    } catch (e) {
      console.log(e);
    }
  },
});
