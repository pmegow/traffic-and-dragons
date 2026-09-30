// dev/sabotage-481-e10-catalog-checks.js — proves the #481 E10 guards are guarded: the audio catalog builder refuses an asset
// whose place types, time window or fallback role would make it silently unmatchable, and the dead Emotion branches (#454)
// stay gone. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-e10-catalog-checks.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, command, cases) { if (!code) code = sabotage.prove({ file: file, command: command, cases: cases }); }
prove("dev/build-audio-catalog.js", ["node", ["dev/tests-accent-layer.js"]], [
  { label: "the builder skips the placement check",
    find: "    validatePlacement(asset, fields);   /* #481 E10 */\n", replace: "",
    mustFail: "builder accepted a broken placement" },
  { label: "an empty time window is accepted",
    find: " || a.from === a.to) bad('from/to", replace: ") bad('from/to",
    mustFail: "builder accepted a broken placement" },
  { label: "a fractional minute is accepted",
    find: "const minute = x => Number.isInteger(x) && x >= 0", replace: "const minute = x => x >= 0",
    mustFail: "builder accepted a broken placement" },
  { label: "an unknown fallback role is accepted",
    find: "if (a.defaultFor !== undefined && !DEFAULT_FOR.includes(a.defaultFor)) bad(", replace: "if (false) bad(",
    mustFail: "builder accepted a broken placement" },
  { label: "an empty place-type list is accepted",
    find: "if (!Array.isArray(a[key]) || !a[key].length || a[key].some(", replace: "if (!Array.isArray(a[key]) || a[key].some(",
    mustFail: "builder accepted a broken placement" }
]);
prove("tts.js", ["node", ["dev/run-tests.js", "Voice settings drafts"]], [
  { label: "the dead emotion default comes back",
    find: "      defaults: function() { return { narrator: \"\", language: \"en-US\" }; },/* #481 E10", replace: "      defaults: function() { return { narrator: \"\", language: \"en-US\", emotion: \"\" }; },/* #481 E10",
    mustFail: "the dead Emotion branches are gone" }
]);
process.exit(code);
