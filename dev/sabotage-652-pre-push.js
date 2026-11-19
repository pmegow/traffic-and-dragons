// dev/sabotage-652-pre-push.js — proves the #652 guards guard: the pre-push runs the browser suites, the runner turns red
// on one failing suite, runs only the Chrome-driven ones, says loudly when there is no Chrome, and hook parity requires the
// installed pre-push. Each clause plants the regression; dev/tests-652-pre-push.js must then FAIL. A mutation that changes
// no bytes is a hard failure.
//   node dev/sabotage-652-pre-push.js
var sabotage = require("./sabotage.js");
var SUITE = ["node", ["dev/tests-652-pre-push.js"]];
var rc = 0;

rc |= sabotage.prove({ file: "dev/run-browser-suites.js", command: SUITE, cases: [
  { label: "a failing suite no longer turns the run red (every suite counts as green)",
    find: "    var ok = r.status === 0;",
    replace: "    var ok = true;",
    mustFail: "a failing suite turns the run red" },
  { label: "every dev/tests-*.js runs, not only the Chrome-driven ones (the derivation dropped)",
    find: "  return enforcement.browserSuiteNames(root).filter(function (n) { return !only || n.indexOf(only) >= 0; });",
    replace: "  return fs.readdirSync(path.join(root, \"dev\")).filter(function (n) { return /^tests-.*\\.js$/.test(n); }).sort().filter(function (n) { return !only || n.indexOf(only) >= 0; });",
    mustFail: "only the Chrome-driven suites run" },
  { label: "no Chrome passes in silence (the loud line removed)",
    find: "    console.error(\"BROWSER SUITES NOT RUN — no Chrome on this machine (\" + chrome.why + \"); the \" + names.length + \" suites were not verified here. CI runs them on every push.\");\n",
    replace: "",
    mustFail: "no Chrome is said on one loud line" },
  { label: "the width is ignored: one suite at a time whatever was asked",
    find: "    while (running < jobs && next < names.length) { running++; start(names[next++]); }",
    replace: "    while (running < 1 && next < names.length) { running++; start(names[next++]); }",
    mustFail: "several at a time" },
  { label: "a red suite starts no other (the run stops at the first failure and the rest go unverified)",
    find: "    while (running < jobs && next < names.length) { running++; start(names[next++]); }",
    replace: "    while (running < jobs && next < names.length && !failed.length) { running++; start(names[next++]); }",
    mustFail: "several at a time" },
  { label: "a width that is not a number is read as the default (the typo passes in silence)",
    find: "    if (env.BROWSER_SUITE_JOBS && !/^\\d+$/.test(env.BROWSER_SUITE_JOBS)) throw new Error(\"BROWSER_SUITE_JOBS is not a number: \" + env.BROWSER_SUITE_JOBS);\n",
    replace: "    if (env.BROWSER_SUITE_JOBS && !/^\\d+$/.test(env.BROWSER_SUITE_JOBS)) env = {};\n",
    mustFail: "the width" }
] });

rc |= sabotage.prove({ file: "dev/pre-push", command: SUITE, cases: [
  { label: "the pre-push no longer runs the browser suites (the gate is an echo)",
    find: "node \"$TOP/dev/run-browser-suites.js\" || {",
    replace: "echo \"browser suites skipped\" || {",
    mustFail: "the tracked pre-push runs the browser suites" },
  { label: "a checkout without the runner fails as \"a red suite\" over a missing module (the guard removed)",
    find: "if [ ! -f \"$TOP/dev/run-browser-suites.js\" ]; then",
    replace: "if false; then",
    mustFail: "a checkout without the runner" }
] });

rc |= sabotage.prove({ file: "dev/check-hook-parity.js", command: SUITE, cases: [
  { label: "hook parity forgets the pre-push (a tracked pre-push that is not installed passes)",
    find: "var HOOKS = [{ name: \"pre-commit\", required: true }, { name: \"pre-push\", required: false }];",
    replace: "var HOOKS = [{ name: \"pre-commit\", required: true }];",
    mustFail: "a missing installed pre-push fails parity by name" }
] });

process.exit(rc);
