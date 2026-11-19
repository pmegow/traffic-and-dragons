// dev/sabotage-standalone-runner.js — proves the guards on the runner of the standalone suites (run-standalone-suites.js,
// several at a time since 2026-11-18): a failing suite fails the run, a failure starts no further suite, a suite that
// ran is printed, the width is honoured, the count of suites not run is true. Each clause plants the regression;
// dev/tests-standalone-runner.js must then FAIL. A mutation that changes no bytes is a hard failure.
//   node dev/sabotage-standalone-runner.js
var sabotage = require("./sabotage.js");
var SUITE = ["node", ["dev/tests-standalone-runner.js"]];
var rc = 0;

rc |= sabotage.prove({ file: "dev/run-standalone-suites.js", command: SUITE, cases: [
  { label: "a failing suite no longer fails the run (its exit code is read and dropped)",
    find: "    if (r.status !== 0) failed.push(suites[i]);",
    replace: "    if (r.status !== 0 && false) failed.push(suites[i]);",
    mustFail: "a failing suite fails the run" },
  { label: "the width is ignored: one suite at a time whatever was asked",
    find: "    while (running < jobs && next < order.length && !failed.length) { running++; start(order[next++]); }",
    replace: "    while (running < 1 && next < order.length && !failed.length) { running++; start(order[next++]); }",
    mustFail: "two at a time" },
  { label: "suites keep starting after a failure",
    find: "    while (running < jobs && next < order.length && !failed.length) { running++; start(order[next++]); }",
    replace: "    while (running < jobs && next < order.length) { running++; start(order[next++]); }",
    mustFail: "after a failure no further suite starts" },
  { label: "a suite that ran after one that never started is not printed (the last flush stops at the gap)",
    find: "    flush(true);\n",
    replace: "    flush();\n",
    mustFail: "a suite that ran beside the failure is still printed" },
  { label: "output is printed as it arrives, two suites' lines mixed (no holding until the suite before has ended)",
    find: "    child.stdout.on(\"data\", function (d) { out.push(d); });\n    child.stderr.on(\"data\", function (d) { err.push(d); });\n    child.on(\"error\", function (e) { err.push(\"could not start \"",
    replace: "    child.stdout.on(\"data\", function (d) { process.stdout.write(d); });\n    child.stderr.on(\"data\", function (d) { err.push(d); });\n    child.on(\"error\", function (e) { err.push(\"could not start \"",
    mustFail: "a suite's output is printed whole and in list order" },
  { label: "the suites not run are counted with filter(), which steps over a slot never filled (always none)",
    find: "      for (var i = 0; i < suites.length; i++) if (!results[i]) notRun++;",
    replace: "      notRun = results.filter(function (r) { return !r; }).length;",
    mustFail: "after a failure no further suite starts" },
  { label: "a suite named to start first but missing from the list is skipped in silence",
    find: "if (i < 0) throw new Error(\"START_FIRST names a suite that is not in the list: \" + n); return i; });",
    replace: "return i; }).filter(function (i) { return i >= 0; });",
    mustFail: "the start order puts the named suites first" },
  { label: "a bad width runs the suites anyway at the default",
    find: "  catch (e) { console.error(\"run-standalone-suites: \" + e.message); process.exit(2); }",
    replace: "  catch (e) { jobs = 4; }",
    mustFail: "the width" }
] });

process.exit(rc);
