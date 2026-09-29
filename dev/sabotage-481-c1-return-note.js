// dev/sabotage-481-c1-return-note.js — proves the #481 C1/C2 guards are guarded. The welcome-back fact must come from
// THIS campaign's own record (the campaign filter), never carry a register word, never echo an earlier adventure's
// moment and never repeat a flagged gist. The RETURN note must stage the greeting at the door, and must never again
// ask for the change to be FILED (the old ask turned "it is night now" into permanent place history) nor list
// LOCATION_STATE as its ack. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-c1-return-note.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 C1 C2"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("game.js", [
  { label: "the fact picker takes any campaign's moment again (the campaign filter is gone)",
    find: 'if(!m||!m.text||!campIsCurrent(m)||m.kind==="party"||m.kind==="bond")continue;cands.push(String(m.text));',
    replace: 'if(!m||!m.text||m.kind==="party"||m.kind==="bond")continue;cands.push(String(m.text));',
    mustFail: "the fact comes from this village's own record" },
  { label: "a register word no longer disqualifies the fact",
    find: '    if(typeof registerScan==="function"&&registerScan(f).length)continue;\n', replace: '',
    mustFail: "the fact comes from this village's own record" },
  { label: "an echo of an earlier adventure's moment no longer disqualifies the fact",
    find: '    if(prior.length&&typeof momentEchoWords==="function"&&momentEchoWords(f,prior,names))continue;\n', replace: '',
    mustFail: "ECHOES an earlier adventure's moment" },
  { label: "a flagged motif gist no longer disqualifies the fact",
    find: '    if(Object.prototype.hasOwnProperty.call(nudged,f.slice(0,gistLen)))continue;\n', replace: '',
    mustFail: "the fact comes from this village's own record" }
]);
prove("api.js", [
  { label: "the note asks for the change to be filed again",
    find: 'show it in the scene; it is not a lasting change to any place, so file nothing for it.',
    replace: 'and FILE it with the matching tag ([LOCATION_STATE:], [WARES:], [NPC:]) so it persists.',
    mustFail: "files nothing (ack SAY only)" },
  { label: "the registry acks LOCATION_STATE again",
    find: 'village:"fires",ack:["SAY"]},/* #6 C2; #481 C2', replace: 'village:"fires",ack:["LOCATION_STATE","SAY"]},/* #6 C2; #481 C2',
    mustFail: "files nothing (ack SAY only)" },
  { label: "the greeting may come through a window again",
    find: ' \\u2014 never through a window or shutters"+(q.fact?', replace: '"+(q.fact?',
    mustFail: "stages the greeting at the door" }
]);
process.exit(code);
