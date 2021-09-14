const {DynamoDB} = require('@aws-sdk/client-dynamodb');
const es = require('../../../dist/src');
const readline = require('readline');

async function writeEvent(store, gameId, seq, type, data) {
  return await store.write(gameId, {
    sequence: seq,
    type,
    data,
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const store = new es.EventStore(new DynamoDB(), 'bob-eventstore-store');
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const [game, seq, type, data] = line.split('\t');
    const result = await writeEvent(store, game, parseInt(seq), type.slice(1,-1), JSON.parse(data));
    console.log(result);
    await sleep(2000);
  }
}

if (require.main === module) {
  main();
}
