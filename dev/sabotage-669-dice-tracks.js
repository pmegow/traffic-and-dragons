// dev/sabotage-669-dice-tracks.js — the live dice suite runs its checks on three pages at once (2026-11-18): a track
// that stops early, or never opens its page, must not read as green. Each clause plants the regression in the suite
// itself; the suite must then FAIL by name. Needs Chrome (skipped, said, without it).
//   node dev/sabotage-669-dice-tracks.js      (browser driver: dev/cdp-browser.js)
var sabotage = require("./sabotage.js"), verdict = require("./battery-verdict.js"), chrome = require("./cdp-browser.js").locateChrome();
var CMD = ["node", ["dev/tests-669-live-dice-browser.js"]];
var tracks = [
  { label: "a track that cannot open its page is skipped in silence (its checks never run, the run is green)",
    find: "      try{t=await open(port);}catch(e){failed++;console.error('FAIL track '+name+' could not open its page — '+e.message);return;}",
    replace: "      try{t=await open(port===8102?'x/'+port:port);}catch(e){return;}",
    mustFail: "checks ran" },
  { label: "the tracks are not waited for: the browser closes under them and the verdict is read early",
    find: "    await Promise.all(Array.from({length:AT_ONCE},worker));\n",
    replace: "",
    mustFail: "checks ran" }
];
var failed = sabotage.prove({ file: "dev/tests-669-live-dice-browser.js", skip: !chrome.path, command: CMD, cases: tracks });
if (!chrome.path && !failed) { verdict.reportSkip("sabotage-669-dice-tracks.js", tracks.length, chrome.why); process.exit(verdict.SKIP_EXIT); }
process.exit(failed ? 1 : 0);
