// dev/sabotage-481-e4-campaign-switch.js — proves the #481 E4 guards are guarded: the campaign-activation boundary stops the
// narration (only on a real id change), and the replay is keyed by campaign. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-e4-campaign-switch.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/tests-481-e4-campaign-switch.js"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("state.js", [
  { label: "a campaign switch leaves the old narration playing",
    find: "if(typeof TTS!==\"undefined\"&&TTS&&typeof TTS.stop===\"function\"&&((TTS.isPlaying&&TTS.isPlaying())||(TTS.isPaused&&TTS.isPaused())))TTS.stop();}/* #481 E4:", replace: "}/* #481 E4:",
    mustFail: "FAIL #481 E4 a new campaign stops the read" },
  { label: "the voice stops on every activation, even the same campaign's",
    find: "  if((id||null)!==prev){if(typeof checkpointClear===\"function\")checkpointClear();if(typeof TTS", replace: "  if(typeof TTS!==\"undefined\"&&TTS)TTS.stop();if((id||null)!==prev){if(typeof checkpointClear===\"function\")checkpointClear();if(typeof TTS",
    mustFail: "FAIL #481 E4 a new campaign stops the read" }
]);
prove("tts.js", [
  { label: "the replay ignores the campaign (repeat reads the old story)",
    find: "    if (_lastNarration && _lastNarrationCamp === _cur) return _lastNarration;", replace: "    if (_lastNarration) return _lastNarration;",
    mustFail: "FAIL #481 E4 the repro" }
]);
process.exit(code);
