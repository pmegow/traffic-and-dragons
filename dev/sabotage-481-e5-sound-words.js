// dev/sabotage-481-e5-sound-words.js — proves the #481 E5 guards are guarded: an invented content word is left out of a
// [SOUNDSCAPE:] classification (allows and forbid alike) instead of throwing the place away, an allows list of only unknown words
// and the six enum mistakes stay refused (each for its own reason), the left-out words reach the turn's summary line once, and
// the refusal toast is throttled per reason. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-e5-sound-words.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 E5"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("audio-profile.js", [
  { label: "one unknown word refuses the place again (the filter is gone)",
    find: "    input[key]=known;});", replace: "    input[key]=words;});",
    mustFail: "the repro" },
  { label: "an allows list of only unknown words files empty (silencing the place)",
    find: "  if(v.ok&&noAllows)v={ok:false,reason:\"unknown content in allows\"};", replace: "",
    mustFail: "the rules that stay" },
  { label: "the only-unknown check runs before the enums (an enum mistake reports the wrong reason)",
    find: "  if(v.ok&&noAllows)v=", replace: "  if(noAllows)v=",
    mustFail: "the rules that stay" },
  { label: "forbid keeps its unknown words (and refuses the place)",
    find: "    if(key!==\"allows\"&&key!==\"forbid\"){input[key]=kv[1];return;}", replace: "    if(key!==\"allows\"){input[key]=kv[1]===\"none\"?[]:kv[1].split(\",\");return;}",
    mustFail: "the rules that stay" },
  { label: "a space after a comma counts as an unknown word",
    find: ".map(function(x){return x.trim();})", replace: "",
    mustFail: "the rules that stay" },
  { label: "the left-out words are not named",
    find: "if(dropped.length)v.dropped=dropped;", replace: "",
    mustFail: "the repro" }
]);
prove("tag_table.js", [
  { label: "the summary line never names the left-out word",
    find: "  if(R.audioDropped&&R.audioDropped.length){var _adw=", replace: "  if(false){var _adw=",
    mustFail: "reaches the turn's summary line" },
  { label: "the left-out line rides without the warning glyph",
    find: "R.muts.push(\"⚠ Ambience: left out \"", replace: "R.muts.push(\"Ambience: left out \"",
    mustFail: "reaches the turn's summary line" },
  { label: "the console never hears the left-out word",
    find: "if(typeof console!==\"undefined\")console.info(\"[audio] soundscape words left out", replace: "if(false)console.info(\"[audio] soundscape words left out",
    mustFail: "reaches the turn's summary line" }
]);
prove("memory.js", [
  { label: "every refusal toasts (the throttle is bypassed)",
    find: "if(typeof showToast===\"function\"&&audioRefusalToastDue(why,Date.now()))showToast(", replace: "if(typeof showToast===\"function\")showToast(",
    mustFail: "a refusal toasts once per reason" },
  { label: "the throttle never re-arms",
    find: "if(typeof last===\"number\"&&now-last<AUDIO_REFUSAL_TOAST_MS)return false;", replace: "if(typeof last===\"number\")return false;",
    mustFail: "a refusal toasts once per reason" },
  { label: "the throttle keys on the whole reason (a GM-named field grows the map)",
    find: "var k=String(why).split(\":\")[0]", replace: "var k=String(why)",
    mustFail: "a refusal toasts once per reason" }
]);
process.exit(code);
