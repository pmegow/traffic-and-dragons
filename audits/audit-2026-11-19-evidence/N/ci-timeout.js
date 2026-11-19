// Probe: dev/ci-status.js summarize() counts only "success" and "failure" as verdicts. A run GitHub ends as
// "timed_out" (the engine job sets no timeout-minutes, so a hung browser suite runs to the 6-hour cap) or
// "startup_failure" is skipped, so the newest older green is reported as the gate's state.
var ci = require("C:/Projects/traffic-and-dragons/dev/ci-status.js");
var runs = [
  { conclusion: "timed_out", headSha: "cccccccc1", createdAt: "2026-11-19T10:00:00Z", databaseId: 3, displayTitle: "newest push" },
  { conclusion: "startup_failure", headSha: "bbbbbbbb1", createdAt: "2026-11-19T09:00:00Z", databaseId: 2, displayTitle: "broken workflow file" },
  { conclusion: "success", headSha: "aaaaaaaa1", createdAt: "2026-11-18T09:00:00Z", databaseId: 1, displayTitle: "last good" }
];
var s = ci.summarize(runs);
console.log(s.status, "—", ci.describe(Object.assign(s, { steps: [] })));
