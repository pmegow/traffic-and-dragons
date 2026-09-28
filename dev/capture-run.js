// capture-run.js — THE way a mutation harness runs a guarded command and reads what it printed. DEV TOOL, node-only.
//
// WHY (#473, 2026-09-27): spawnSync's default maxBuffer is 1 MiB, and a child that prints more is KILLED with its output
// cut at the limit. A mutation in a core helper reds hundreds of tests at once, so the named catcher can land past the
// cut: under sabotage-274-clock-rescue.js's corruption clause the gate printed 1,156,401 bytes with the catcher at
// byte 1,136,515, and the clause read MISATTRIBUTED every week while its guard caught it. The limit grew into the suite
// silently (the clause was proven when it landed), so it is a class, not a clause: every harness that attributes a
// guarded command's output captures through runCaptured() — sabotage.js, scratch-contract-sabotage.js,
// sabotage-server-tts.js, sabotage-standalone-suites.js and sabotage-bible-editor-launcher.js.
//
//   runCaptured(file, args, opts) → spawnSync's result, with a 256 MiB capture, plus `unobserved` (a reason) whenever
//   the run could not be fully observed (cut off, or never started). A harness must report that clause UNOBSERVED —
//   never judge it caught or misattributed on a fragment.
"use strict";
var cp = require("child_process");
var MAX_OUTPUT = 256 * 1024 * 1024;

function runCaptured(file, args, opts) {
  var o = Object.assign({ encoding: "utf8" }, opts || {});
  if (o.maxBuffer == null) o.maxBuffer = MAX_OUTPUT;
  var r = cp.spawnSync(file, args, o);
  if (r.error) r.unobserved = r.error.code === "ENOBUFS"
    ? "printed more than " + o.maxBuffer + " bytes — the output was cut off"
    : "could not run (" + (r.error.code || r.error.message) + ")";
  return r;
}

module.exports = { runCaptured: runCaptured, MAX_OUTPUT: MAX_OUTPUT };
