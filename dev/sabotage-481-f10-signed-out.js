// dev/sabotage-481-f10-signed-out.js — proves the #481 F10 guards are guarded: signed out, entering a village says ONCE per
// page load that the library refresh was skipped, and the character editor says why its library buttons are off. The editor
// clause drives a real page through dev/cdp-browser.js; with no Chrome it is SKIPPED out loud (exit 78 + one SABOTAGE SKIPPED
// line) — never passed. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-f10-signed-out.js
var sabotage = require("./sabotage.js"), verdict = require("./battery-verdict.js");
var chrome = require("./cdp-browser.js").locateChrome();
var failed = 0;
failed += sabotage.prove({ file: "ui-browsers.js", command: ["node", ["dev/tests-481-f10-signed-out.js"]], cases: [
  { label: "the signed-out skip is a console line only",
    find: "if(typeof showToast===\"function\")showToast(\"Signed out — the village was not refreshed", replace: "if(false)showToast(\"Signed out — the village was not refreshed",
    mustFail: "the repro" },
  { label: "the signed-out toast repeats on every entry",
    find: "if(!_villageSignedOutSaid){_villageSignedOutSaid=true;", replace: "if(true){",
    mustFail: "the repro" }
]});
failed += sabotage.prove({ file: "character_editor.html", skip: !chrome.path, command: ["node", ["dev/tests-481-f10-editor-browser.js"]], cases: [
  { label: "the editor's hint sits behind the condition that never holds",
    find: "  else{$(\"who\").textContent=\"Not signed in", replace: "  else if(typeof storageAdapter!==\"undefined\"&&storageAdapter.isServerMode()&&!storageAdapter.hasToken()){$(\"who\").textContent=\"Not signed in",
    mustFail: "the editor says why its library buttons are off" }
]});
if (!chrome.path && !failed) { verdict.reportSkip("sabotage-481-f10-signed-out.js", 1, chrome.why); process.exit(verdict.SKIP_EXIT); }
process.exit(failed ? 1 : 0);
