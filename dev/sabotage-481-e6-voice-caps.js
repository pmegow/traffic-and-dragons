// dev/sabotage-481-e6-voice-caps.js — proves the #481 E6 guards are guarded: a cloud reader's grouper splits on and stamps
// only the per-character fields its model declares (so a character's delivery direction never becomes Gemini's whole prompt,
// and a mood never splits a Speechify request), and the sheet shows a voice row only where the primary honours it, a hidden
// row leaving a one-line hint that keeps the saved value. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-e6-voice-caps.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/tests-481-e6-voice-caps.js"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("tts.js", [
  { label: "the reader passes no declaration (every field splits and rides)",
    find: "}, _unitCaps(id)); };/* #481 E6: the reader's own declaration", replace: "}); };/* #481 E6: the reader's own declaration",
    mustFail: "the repro" },
  { label: "the grouper ignores the direction declaration (the sheet text becomes Gemini's prompt)",
    find: "var dir = (useDir && voices", replace: "var dir = (voices",
    mustFail: "the repro" },
  { label: "the grouper ignores the speed declaration",
    find: "var rt = (useRate && voices", replace: "var rt = (voices",
    mustFail: "the readers split only" },
  { label: "the grouper ignores the mood declaration (a mood splits Speechify)",
    find: "var md = (useMood && voices", replace: "var md = (voices",
    mustFail: "the readers split only" },
  { label: "Speechify loses its speed declaration",
    find: "rate: true, unitRate: true,/* #481 E6 */ languages: [\"en-US\"]", replace: "rate: true, languages: [\"en-US\"]",
    mustFail: "the readers split only" }
]);
prove("ui-sheets.js", [
  { label: "the direction row shows for every reader",
    find: "  return (caps.direction?\"<div class='cs-voice-row'", replace: "  return (true?\"<div class='cs-voice-row'",
    mustFail: "the sheet shows a row only" },
  { label: "the speed row shows for every reader",
    find: "    +(caps.rate?\"<div class='cs-voice-row'", replace: "    +(true?\"<div class='cs-voice-row'",
    mustFail: "the sheet shows a row only" },
  { label: "a hidden row leaves no hint",
    find: "    :csVoiceCapHint(\"Delivery direction\",caps.label,caps.directionBy,!!char.voiceDirection))", replace: "    :\"\")",
    mustFail: "the sheet shows a row only" },
  { label: "the hint does not say the saved value is kept",
    find: "(kept?\" Yours is kept.\":\"\")", replace: "\"\"",
    mustFail: "the sheet shows a row only" },
  { label: "the hint says \"kept\" when nothing is saved",
    find: "!!Number(char.voiceRate)));", replace: "true));",
    mustFail: "the sheet shows a row only" }
]);
process.exit(code);
