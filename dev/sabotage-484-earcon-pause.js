// dev/sabotage-484-earcon-pause.js — proves the #484 guard is guarded: an earcon never resumes the narration context while
// the read is paused (Car Mode's spoken pause acks right after pausing). Each mutation runs in a disposable clone.
// The real-game check is dev/car-driver.js e8-paused-read (the tap after a spoken pause resumes the read).
//   node dev/sabotage-484-earcon-pause.js
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({ file: "tts.js", command: ["node", ["dev/tests-484-earcon-pause.js"]], cases: [
  { label: "the earcon resumes a paused read's context",
    find: "      if (_paused) { console.debug(\"[tts] earcon '\" + kind + \"' skipped — the read is paused\"); return; }\n", replace: "",
    mustFail: "the repro" },
  { label: "the earcon is silenced whenever a read exists (over-suppression)",
    find: "      if (_paused) { console.debug(\"[tts] earcon '\"", replace: "      if (_paused || _playing) { console.debug(\"[tts] earcon '\"",
    mustFail: "an earcon still sounds" }
]}));
