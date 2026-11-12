// dev/sabotage-672-player-rolls-bound.js — proves #672 tooth (b): a note that asks for combat tags is followed, under
// player rolls, by ONE bound note (a hero's attack that needs a roll stops at [CHECK:]), delivered once by
// buildEngineNotes for the rows flagged rollsBound, never while the GM rolls. Each clause plants one regression in
// api.js; the #672 section must turn red.
//   node dev/sabotage-672-player-rolls-bound.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#672"]];
var code = sabotage.prove({ file: "api.js", command: CMD, cases: [
  { label: "the bound speaks while the GM rolls (the OFF prompt changes)",
    find: "  if(typeof playerRollsDice===\"undefined\"||!playerRollsDice)return\"\";\n  return \"[ENGINE NOTE — THE PLAYER ROLLS",
    replace: "  return \"[ENGINE NOTE — THE PLAYER ROLLS",
    mustFail: "OFF must be empty" },
  { label: "the bound no longer stops the hero's attack at [CHECK:]",
    find: "A hero's attack that needs a roll still stops at [CHECK:] and its damage",
    replace: "A hero's attack that needs a roll is yours to tag and its damage",
    mustFail: "an attack that needs a roll must stop at [CHECK:]" },
  { label: "the bound no longer forbids an invented number (the 48 of t136)",
    find: " — never invent a number for it. A blow the player",
    replace: ". A blow the player",
    mustFail: "the invented number (48 at t136) must be named" },
  { label: "the bound takes back the automatic strike (it contradicts CHECK ANSWERED on the same turn)",
    find: ", a strike an ability makes automatic is yours to resolve,",
    replace: ",",
    mustFail: "an automatic strike stays the GM's" },
  { label: "the combat bookkeeping note (the t136 note) loses its flag",
    find: "ack:[\"ENEMY_SLAIN\",\"ENEMY_HP\",\"COMBAT_END\"],rollsBound:true},",
    replace: "ack:[\"ENEMY_SLAIN\",\"ENEMY_HP\",\"COMBAT_END\"]},",
    mustFail: "buildCombatStaleNudge asks for combat tags and its row carries no rollsBound" },
  { label: "the orphan-tags note loses its flag",
    find: "ack:[\"COMBAT_START\"],rollsBound:true},",
    replace: "ack:[\"COMBAT_START\"]},",
    mustFail: "buildOrphanCombatNudge asks for combat tags and its row carries no rollsBound" },
  { label: "a peaceful WRAP UP carries the bound (the flag ignores whether a fight is open)",
    find: "ack:[\"none\"],rollsBound:\"combat\"},",
    replace: "ack:[\"none\"],rollsBound:true},",
    mustFail: "WRAP UP is bound only while a fight is open" },
  { label: "buildEngineNotes never delivers the bound",
    find: "  var bound=names.some(noteWantsRollsBound)?playerRollsBound():\"\";if(bound)out.push(bound);",
    replace: "  var bound=\"\";",
    mustFail: "the bound must be delivered once" },
  { label: "the bound is delivered after every turn's notes, flagged or not",
    find: "  var bound=names.some(noteWantsRollsBound)?playerRollsBound():\"\";if(bound)out.push(bound);",
    replace: "  var bound=playerRollsBound();if(bound)out.push(bound);",
    mustFail: "a peaceful WRAP UP carries the bound" }
] });
process.exit(code);
