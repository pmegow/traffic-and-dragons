// dev/sabotage-375-money.js — proves money at stake is guarded: the coda gate, the combat gate, the coin gate,
// the cooldown, and the never-a-tax clause.
//   node dev/sabotage-375-money.js
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({
  file: "api.js",
  command: ["node", ["dev/run-tests.js", "class bible"]],
  cases: [
    { label: "the coda gate is dropped (a quiet epilogue gets shaken down with nobody hostile in the scene)",
      find: 'var foes=sceneAntagonists();if(typeof codaState==="function"&&codaState()&&!foes.length)return"";', replace: 'var foes=sceneAntagonists();' },
    { label: "the note fires in combat",
      find: 'function buildMoneyNote(){\n  if(!worldState||worldState.combat||', replace: 'function buildMoneyNote(){\n  if(!worldState||' },
    { label: "the note fires with no coin to lose",
      find: 'var c=worldState.character;if(!c||!(c.coin>0))return"";', replace: 'var c=worldState.character;if(!c)return"";' },
    { label: "the cooldown is dropped (a price every turn — the tax the ruling forbids)",
      find: 'if(ma&&typeof ma.turn==="number"&&worldState.turn-ma.turn<every)return"";', replace: '' },
    { label: "the first ask no longer waits for a record (turn one of a new campaign gets a highwayman)",
      find: "if((worldState.turn||0)<every||!((memory.keyDecisions||[]).length))return\"\";", replace: "" },
    { label: "the never-a-tax clause is dropped",
      find: 'NEVER a tax, upkeep, rent, ledger or bookkeeping \\u2014 a price with a face and a reason, once.', replace: 'A standing fee is fine.' }
  ]
}));
