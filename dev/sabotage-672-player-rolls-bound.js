// dev/sabotage-672-player-rolls-bound.js — proves #672 tooth (b): every note that asks for combat tags carries the
// player-rolls bound (the hero's own blow stops at [CHECK:]), from ONE helper, and says nothing while the GM rolls. Each
// clause plants one regression in api.js; the #672 section must turn red.
//   node dev/sabotage-672-player-rolls-bound.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#672"]];
var code = sabotage.prove({ file: "api.js", command: CMD, cases: [
  { label: "the bound speaks while the GM rolls (the OFF notes change)",
    find: "  if(typeof playerRollsDice===\"undefined\"||!playerRollsDice)return\"\";\n  return \" THE PLAYER ROLLS in this campaign",
    replace: "  return \" THE PLAYER ROLLS in this campaign",
    mustFail: "OFF must be empty" },
  { label: "the bound no longer stops the hero's blow at [CHECK:]",
    find: "the hero's own blow still stops at [CHECK:] and its damage",
    replace: "the hero's own blow is yours to tag and its damage",
    mustFail: "the hero's blow must stop at [CHECK:]" },
  { label: "the bound no longer forbids an invented number (the 48 of t136)",
    find: " — never invent a number for it; a companion's",
    replace: "; a companion's",
    mustFail: "the invented number (48 at t136) must be named" },
  { label: "the combat bookkeeping note (the t136 note) loses the bound",
    find: "tag the blows with [ENEMY_HP:\"+first+\"|-X].\"+playerRollsBound()+\"]\";",
    replace: "tag the blows with [ENEMY_HP:\"+first+\"|-X].]\";",
    mustFail: "COMBAT BOOKKEEPING under player rolls must be the same note with the bound" },
  { label: "the orphan-tags note loses the bound",
    find: "narrate freely and emit no combat tags.\"+playerRollsBound()+\"]\";",
    replace: "narrate freely and emit no combat tags.]\";",
    mustFail: "COMBAT TAGS WITHOUT AN ENCOUNTER under player rolls must be the same note with the bound" },
  { label: "the wrap-up note (\"finish the fight\") loses the bound",
    find: "Do not start anything new that cannot be left.\"+playerRollsBound()+\"]\";",
    replace: "Do not start anything new that cannot be left.]\";",
    mustFail: "WRAP UP under player rolls must be the same note with the bound" }
] });
process.exit(code);
