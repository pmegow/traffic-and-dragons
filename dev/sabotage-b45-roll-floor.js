// dev/sabotage-b45-roll-floor.js — proves the B45 roll floor is guarded: the permanent bound under the #371
//   stake clause (an attack on a foe, a contested act against someone who could notice, failure that costs
//   blood — always rolled, the fight opened before the first blow, the roll decision never narrated).
//   node dev/sabotage-b45-roll-floor.js
var sabotage = require("./sabotage.js");
var rc = sabotage.prove({
  file: "api.js",
  command: ["node", ["dev/run-tests.js", "B45"]],
  cases: [
    { label: "the floor rides the stake switch — turning the taste clause off removes the floor too",
      find: 'function diceFloorText(playerRolls){return " ALWAYS AT RISK',
      replace: 'function diceFloorText(playerRolls){return (typeof diceStakeClause!=="undefined"&&!diceStakeClause)?"":" ALWAYS AT RISK' },
    { label: "the GM-rolls contract is told to stop at a CHECK — the verb no longer follows the dice contract",
      find: '+diceStakeText()+diceFloorText(false)+"', replace: '+diceStakeText()+diceFloorText(true)+"' },
    { label: "the player-rolls contract loses the floor",
      find: '+diceStakeText()+diceFloorText(true)+"', replace: '+diceStakeText()+"' },
    { label: "the floor reads before the license — the bound comes first, the clause second",
      find: '+diceStakeText()+diceFloorText(false)+"', replace: '+diceFloorText(false)+diceStakeText()+"' },
    { label: "a silent kill no longer opens the fight",
      find: 'before the first blow lands, a silent one included.', replace: 'before the first blow lands.' },
    { label: "the roll decision may be narrated again",
      find: ' Whether a roll was needed is bookkeeping: never say it in the story.', replace: '' }
  ]
});
process.exit(rc);
