// dev/sabotage-481-f4-home-return.js — proves the #481 F4 guards are guarded: on a tab return the home page reads the catalog
// ONCE, keeps the player's Quick Start pick by catalog id, and a failed re-read keeps the last good shelf and says so.
// Drives real pages through dev/cdp-browser.js; with no Chrome on this machine it is SKIPPED out loud (exit 78 + one
// SABOTAGE SKIPPED line the runners print) — never passed. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-f4-home-return.js
var sabotage = require("./sabotage.js"), verdict = require("./battery-verdict.js");
var chrome = require("./cdp-browser.js").locateChrome();
var failed = sabotage.prove({ file: "home.html", skip: !chrome.path, command: ["node", ["dev/tests-481-f4-home-return.js"]], cases: [
  { label: "a second visibilitychange listener (the catalog read twice per return)",
    find: "  var catalog=[],library=[];\n", replace: "  var catalog=[],library=[];\n  document.addEventListener(\"visibilitychange\",function(){if(document.visibilityState===\"visible\")loadCatalog();});\n",
    mustFail: "one return reads the catalog once" },
  { label: "the rebuild forgets the pick (back to the taster)",
    find: "    if(keep>=0){sel.value=String(keep);qsUpdate();return;}\n", replace: "",
    mustFail: "the repro" },
  { label: "a failed re-read wipes the shelf",
    find: "      if(err&&catalog.length){console.error(\"[home] catalog refresh failed", replace: "      if(false){console.error(\"[home] catalog refresh failed",
    mustFail: "a failed re-read keeps the last good shelf" },
  { label: "a failed re-read keeps the shelf silently",
    find: "status(\"Could not refresh the catalog (\"+err+\") — showing the last loaded shelf.\",true);", replace: "console.info(\"Could not refresh the catalog (\"+err+\") — showing the last loaded shelf.\");",
    mustFail: "a failed re-read keeps the last good shelf" }
]});
if (!chrome.path && !failed) { verdict.reportSkip("sabotage-481-f4-home-return.js", 4, chrome.why); process.exit(verdict.SKIP_EXIT); }
process.exit(failed ? 1 : 0);
