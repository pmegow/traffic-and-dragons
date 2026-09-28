// battery-verdict.js — THE one reading of a finished battery run, shared by run-sabotage-diff.js (the commit
// gate) and run-sabotage-all.js (the weekly job). DEV TOOL, node-only. (#472, 2026-09-27: the two runners each
// carried their own copy of the "bad" test; a third verdict — SKIP — would otherwise have been a second pair.)
//
//   classify(status, output) → { verdict: "ok" | "fail" | "skip", skipLines: [the announcement to echo] }
//
// fail — a non-zero exit, or a clause that proved nothing while the battery exited 0 (a red caught by the wrong
//        test, a mutation that changed no bytes). This outranks everything, a skip included. The phrase set is
//        the runners' own, unchanged: a MISSED or NOT APPLIED clause already makes sabotage.js exit non-zero.
// skip — the battery could not run its guards on this machine: exit SKIP_EXIT (dev/cdp-browser.js) AND its
//        "SABOTAGE SKIPPED" line (e.g. no Chrome). Printed and counted by the runners, never reported as a pass.
// ok   — exit 0 and neither of the above.
//
//   reportSkip(battery, clauses, why) — the battery side: print the ONE announcement classify() looks for (and a
//   GitHub Actions warning annotation under CI), then the battery exits SKIP_EXIT.
"use strict";
var SKIP_EXIT = 78;   // EX_CONFIG (sysexits.h): this machine cannot run the guard
var MISFIRE = /NOT on mustFail|no bytes changed|MISATTRIBUT/i;

function reportSkip(battery, clauses, why) {
  var line = "SABOTAGE SKIPPED (" + battery + "): " + clauses + " clause(s) NOT proven on this machine — " + why;
  console.log(line);
  if (process.env.GITHUB_ACTIONS === "true") console.log("::warning title=Sabotage clauses skipped::" + line);
}

function classify(status, output) {
  var out = String(output || "");
  if (MISFIRE.test(out)) return { verdict: "fail", skipLines: [] };
  if (status === SKIP_EXIT) {
    var said = out.split(/\r?\n/).filter(function (l) { return /SABOTAGE SKIPPED|^::warning/.test(l); });
    // An exit 78 with no announcement is not a skip anyone reported — it is a failure like any other exit.
    if (said.some(function (l) { return /SABOTAGE SKIPPED/.test(l); })) return { verdict: "skip", skipLines: said };
    return { verdict: "fail", skipLines: [] };
  }
  return { verdict: status === 0 ? "ok" : "fail", skipLines: [] };
}

module.exports = { classify: classify, reportSkip: reportSkip, SKIP_EXIT: SKIP_EXIT, MISFIRE: MISFIRE };
