// dev/sabotage-481-e9-entry-warmup.js — proves the #481 E9 guard is guarded: opening Car Mode while the narrator speaks skips
// the mic warm-up (it would switch the audio route mid-read), says so in the console, and a paused read does not count as
// speaking. Each mutation runs in a disposable clone. The real-game check is dev/car-driver.js e9-open-mid-read.
//   node dev/sabotage-481-e9-entry-warmup.js
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({ file: "ui-carmode.js", command: ["node", ["dev/tests-19b-carmode-transport.js"]], cases: [
  { label: "the warm-up runs mid-read",
    find: "  var warm = (!reading && typeof STT", replace: "  var warm = (typeof STT",
    mustFail: "an entry mid-read skips the mic warm-up" },
  { label: "the skip is silent",
    find: "  if (reading) console.info(\"[car] mic warm-up skipped", replace: "  if (false) console.info(\"[car] mic warm-up skipped",
    mustFail: "an entry mid-read skips the mic warm-up" },
  { label: "a paused read counts as speaking (the warm-up is skipped for it too)",
    find: "  var reading = typeof TTS !== \"undefined\" && TTS.isPlaying();", replace: "  var reading = typeof TTS !== \"undefined\" && (TTS.isPlaying() || TTS.isPaused());",
    mustFail: "an entry mid-read skips the mic warm-up" }
]}));
