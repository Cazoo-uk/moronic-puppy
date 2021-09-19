const { DynamoDB } = require("@aws-sdk/client-dynamodb");
const es = require("@moronic-puppy/core");
const readline = require("readline");
const table = process.env.TABLE_NAME || "__no_table__";

async function writeEvent(store, gameId, seq, type, data) {
  return await store.write(gameId, {
    sequence: seq,
    type,
    data,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const store = new es.EventStore(new DynamoDB(), table);
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const [game, seq, type, data] = line.split("\t");
    const result = await writeEvent(
      store,
      game,
      parseInt(seq),
      type,
      JSON.parse(data)
    );
    console.log(game, seq, result);
    await sleep(500);
  }
}

if (require.main === module) {
  main();
}
