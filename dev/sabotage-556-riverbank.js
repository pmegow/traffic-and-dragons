// dev/sabotage-556-riverbank.js — proves the #556 guards are guarded (owner 2026-10-02, the Village t271: the riverbank
// was narrated five times and never a place). The riverbank is a pre-minted commons, and entering the Village re-runs the
// seed before the sign-in gate so an older village gains it. Disposable clones.
//   node dev/sabotage-556-riverbank.js
var sabotage = require("./sabotage.js"), rc = 0;
var CMD = ["node", ["dev/run-tests.js", "#6 the village — phase C/D/G/H"]];
rc |= sabotage.prove({ file: "data.js", command: CMD, cases: [
  { label: "the riverbank leaves the commons list (open ground is the village again)",
    find: ",\"the square\",\"the riverbank\"],", replace: ",\"the square\"],",
    mustFail: "the riverbank is minted as open ground" }
]});
rc |= sabotage.prove({ file: "ui-browsers.js", command: CMD, cases: [
  { label: "entering the Village no longer runs the commons seed",
    find: "  if(typeof villageCommonsSeed===\"function\"){var _cs=villageCommonsSeed();", replace: "  if(false){var _cs=villageCommonsSeed();",
    mustFail: "must run the commons seed BEFORE the sign-in gate" },
  { label: "the seed runs only after the library answers (a signed-out entry gains nothing)",
    find: "  if(typeof villageCommonsSeed===\"function\"){var _cs=villageCommonsSeed();if(_cs&&_cs.minted){showToast(\"\\u2795 \"+_cs.minted+\" new place\"+(_cs.minted===1?\"\":\"s\")+\" added to the village map.\",5000);if(typeof saveAll===\"function\")saveAll();}}\n", replace: "",
    mustFail: "must run the commons seed BEFORE the sign-in gate" }
]});
process.exit(rc ? 1 : 0);
