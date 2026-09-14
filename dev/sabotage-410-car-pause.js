// sabotage-410-car-pause.js — mutation proof for the #410 spoken pause / resume in Car Mode.
//
// The guard: "pause" / "GM pause" and "resume" / "unpause" / "GM resume" / "GM continue" are whole-utterance
// commands (owner vocabulary 2026-09-14 — "stop" is too common a word; bare "continue" is a plausible
// action and is NOT a command). What the word does is the pure carHoldDispatch table: pause while the
// narrator plays = the TTS pause toggle; pause while the mic is open = HOLD (auto-mic stays closed);
// resume releases whichever is in effect; resume with nothing held says so.
// Each clause must make dev/run-tests.js FAIL; a mutation changing no bytes is a hard failure.
// Usage: node dev/sabotage-410-car-pause.js
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "helpers.js",
  command: ["node", ["dev/run-tests.js", "helpers"]],
  cases: [
    { label: "the pause regex loses its anchor — 'I pause at the door' is eaten as a command (the eat-the-turn class)",
      mustFail: "action",
      find: 'if (/^(?:gm )?pause$/.test(t)) return { kind: "pause" };',
      replace: 'if (/pause/.test(t)) return { kind: "pause" };' },
    { label: "bare 'continue' becomes a resume command (a plausible action is swallowed)",
      mustFail: "action",
      find: 'if (/^(?:gm )?(?:resume|unpause)$|^gm continue$/.test(t)) return { kind: "resume" };',
      replace: 'if (/^(?:gm )?(?:resume|unpause|continue)$/.test(t)) return { kind: "resume" };' },
    { label: "pause while the narrator plays no longer pauses the narrator (holds instead)",
      mustFail: "ttsPause",
      find: 'if (s.ttsPlaying) return { op: "ttsPause", held: true, status: "paused" };',
      replace: '' },
    { label: "resume with nothing held silently starts the mic instead of saying nothing is paused",
      mustFail: "nothingPaused",
      find: 'return { op: "noop", held: false, status: "nothingPaused" };',
      replace: 'return { op: "release", held: false, status: "listening" };' }
  ]
});

process.exit(rc);
