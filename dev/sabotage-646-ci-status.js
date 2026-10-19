// dev/sabotage-646-ci-status.js — proves the #646 guards guard: the CI verdict counts the whole streak,
// names the FIRST red run, turns an unreadable gh into UNKNOWN (never green), and session-check relays
// the line. Each clause plants the exact regression; dev/tests-646-ci-status.js must then FAIL. A mutation
// that changes no bytes is a hard failure.
//   node dev/sabotage-646-ci-status.js
var sabotage = require("./sabotage.js");
var SUITE = ["node", ["dev/tests-646-ci-status.js"]];
var rc = 0;

rc |= sabotage.prove({ file: "dev/ci-status.js", command: SUITE, cases: [
  { label: "the streak stops at one (six days of red read as a single failed run)",
    find: "  while (i < done.length && done[i].conclusion === \"failure\") i++;",
    replace: "  i = 1;",
    mustFail: "the real six-day red: a streak of 69" },
  { label: "the first red is the newest red (the warning names the wrong commit)",
    find: "firstRed: brief(done[i - 1]),",
    replace: "firstRed: brief(done[0]),",
    mustFail: "the real six-day red: a streak of 69" },
  { label: "a gh failure reads as green (the blind signal looks like a passing one)",
    find: "  } catch (e) { return { status: \"unknown\", reason: e.message, workflow: WORKFLOW, branch: BRANCH }; }",
    replace: "  } catch (e) { runs = [{ conclusion: \"success\", headSha: \"00000000\" }]; }",
    mustFail: "gh failure is UNKNOWN, never green" },
  { label: "the failing steps are never read (the red line says where, but not what)",
    find: "    try { steps = failingSteps(run([\"run\", \"view\", String(s.latest.id), \"--json\", \"jobs\"])); }",
    replace: "    try { steps = []; }",
    mustFail: "a red verdict reads the newest red run's jobs" }
] });

rc |= sabotage.prove({ file: "dev/session-check.js", command: SUITE, cases: [
  { label: "session-check drops the CI line from the advisory (#646 — the signal that cannot be missed, missed)",
    find: "  if (ci.status === \"red\" || ci.status === \"unknown\") console.warn(\"  \" + ciStatus.describe(ci));",
    replace: "",
    mustFail: "session-check relays a red CI as a finding" }
] });

process.exit(rc);
