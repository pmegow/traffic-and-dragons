// dev/sabotage-prove-before-push.js — proves the guards on the local proof before a push (dev/prove-before-push.js, owner
// ruling 2026-11-18): a red scan, replay or own battery blocks; an unreadable range is never green; the harness is not
// run as a battery; git's hook environment is dropped; the hook runs it; CI's sweep cannot be hidden by an earlier red
// step. Each clause plants the regression; dev/tests-prove-before-push.js must then FAIL by name. A mutation that
// changes no bytes is a hard failure.
//   node dev/sabotage-prove-before-push.js
var sabotage = require("./sabotage.js");
var SUITE = ["node", ["dev/tests-prove-before-push.js"]];
var rc = 0;

rc |= sabotage.prove({ file: "dev/prove-before-push.js", command: SUITE, cases: [
  { label: "the harness dev/sabotage.js is run as a battery of the range's own",
    find: "function isBattery(file) { return /^dev\\/sabotage-[^\\/]*\\.js$/.test(file) && file !== \"dev/sabotage.js\"; }",
    replace: "function isBattery(file) { return /^dev\\/sabotage[^\\/]*\\.js$/.test(file); }",
    mustFail: "the pure parts" },
  { label: "a red applicability scan is passed over",
    find: "[\"dev/check-sabotage-applicability.js\"])) red.push(\"the applicability scan\");",
    replace: "[\"dev/check-sabotage-applicability.js\"])) red.length = 0;",
    mustFail: "a red applicability scan is red" },
  { label: "a drifted replay baseline is passed over",
    find: "if (!step(root, \"replay \" + c[1], c)) red.push(\"replay \" + c[1]); });",
    replace: "step(root, \"replay \" + c[1], c); });",
    mustFail: "a drifted replay baseline is red" },
  { label: "a red battery of the range's own is printed and passed over",
    find: "    if (v.verdict === \"fail\") { red.push(v.file); console.log(",
    replace: "    if (v.verdict === \"fail\") { console.log(",
    mustFail: "a red battery of the range's own is red" },
  { label: "a range that cannot be read is green",
    find: "Nothing was proven here; pass a range that exists.\");\n    process.exit(2);",
    replace: "Nothing was proven here; pass a range that exists.\");\n    process.exit(0);",
    mustFail: "a range that cannot be read proves nothing" },
  { label: "a workflow naming no replay passes with zero replays",
    find: " red.push(\"no replay baselines found\"); }",
    replace: " }",
    mustFail: "a workflow that names no replay is red" },
  { label: "git's hook environment reaches the steps",
    find: "  GIT_LOCATION.forEach(function (k) { delete process.env[k]; });\n",
    replace: "",
    mustFail: "git's hook environment does not reach the steps" },
  { label: "the range's own batteries are never run (the scan and the replays alone)",
    find: "  if (!own.length) return verdict([]);\n",
    replace: "  return verdict([]);\n",
    mustFail: "green: the scan" },
  { label: "every battery that targets a changed file is run here again (the 40-minute sweep is back at the desk)",
    find: "    own = ownBatteries(gitNames(root, [\"--diff-filter=AM\", opts.range])).filter(",
    replace: "    own = ownBatteries(gitNames(root, [\"--diff-filter=AM\", opts.range]).concat([\"dev/sabotage-b.js\"])).filter(",
    mustFail: "green: the scan" }
] });

rc |= sabotage.prove({ file: "dev/pre-push", command: SUITE, cases: [
  { label: "the pre-push no longer runs the local proof",
    find: "  node \"$TOP/dev/prove-before-push.js\" || {",
    replace: "  true || {",
    mustFail: "the tracked pre-push runs it" }
] });

rc |= sabotage.prove({ file: ".github/workflows/engine-tests.yml", command: SUITE, cases: [
  { label: "CI's sweep is skipped again when an earlier step is red",
    find: "        if: ${{ !cancelled() }}\n        run: node dev/run-sabotage-diff.js \"$CI_RANGE\"",
    replace: "        run: node dev/run-sabotage-diff.js \"$CI_RANGE\"",
    mustFail: "CI's sweep runs even when an earlier step is red" }
] });

rc |= sabotage.prove({ file: "dev/check-enforcement.js", command: SUITE, cases: [
  { label: "the pin on the sweep's `if` is gone (the workflow could drop it unseen)",
    find: "pattern: /if:\\s*\\$\\{\\{\\s*!cancelled\\(\\)\\s*\\}\\}[ \\t]*\\r?\\n\\s*(?=run:\\s*node dev\\/run-sabotage-diff\\.js)/ },",
    replace: "pattern: /run:\\s*node dev\\/run-sabotage-diff\\.js/ },",
    mustFail: "CI's sweep runs even when an earlier step is red" }
] });

process.exit(rc);
