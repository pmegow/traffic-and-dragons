// dev/sabotage-b47-check-answered.js — proves B47's guards (a check answered by a typed action is told to the GM the same
// turn, and an automatic ability covers one strike): the floor's one-strike clause, the lapse step arming the latch,
// sendAction routing the lapse through it, the note's license-ends line and the one-shot consumption must each turn the B47
// section red.
//   node dev/sabotage-b47-check-answered.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "B47"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("api.js", [
  { label: "the floor loses the one-strike clause — an automatic ability's silence is the next shot's precedent again",
    find: " An ability whose canon makes a strike automatic covers only the ONE strike the player names it for; every other attack, the next one included, is at risk.", replace: "",
    mustFail: "the one-strike clause is missing from the floor" },
  { label: "the note no longer ends the license with the one strike",
    find: " \\u2014 the license ends with that strike: the next attack, in this response or any later one, is at risk again and stops at [CHECK:].", replace: ".",
    mustFail: "the one-strike license and its end are missing" },
  { label: "the latch is never consumed — the note nags every turn",
    find: "  delete worldState.checkAnsweredPing;\n", replace: "",
    mustFail: "the latch must be consumed on delivery" }
]);
prove("helpers.js", [
  { label: "the lapse step clears the check but arms nothing (the silent #329 lapse again)",
    find: "  worldState.checkAnsweredPing={turn:worldState.turn,label:chk.label,mod:chk.mod||0,dc:(chk.dc!=null?chk.dc:null)};\n", replace: "",
    mustFail: "the latch:" }
]);
prove("capability_bible.js", [
  { label: "First Blow is an automatic critical hit again — canon the GM follows to the letter on an unsuspecting guard",
    find: "if it lands, is a critical hit — the die still rolls.", replace: "is an automatic critical hit.",
    mustFail: "First Blow:" },
  { label: "Master Poisoner's 'simply succumb' no longer waits for the bolt to land",
    find: " — the blade or the bolt still has to land.", replace: ".",
    mustFail: "Master Poisoner:" }
]);
prove("game.js", [
  { label: "sendAction goes back to deleting the pending check inline — the step is bypassed",
    find: "if(worldState.pendingCheck&&!(opts&&opts.silent))checkLapseToAction(txt);", replace: "if(worldState.pendingCheck&&!(opts&&opts.silent)){delete worldState.pendingCheck;}",
    mustFail: "sendAction must lapse the check through checkLapseToAction" }
]);
process.exit(code);
