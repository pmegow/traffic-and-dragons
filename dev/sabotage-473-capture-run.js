// sabotage-473-capture-run.js — retained proof for #473: a mutation harness judges a guarded command on its WHOLE output
// (dev/capture-run.js), and a run it could not observe is UNOBSERVED rather than judged on a fragment. Every clause must
// redden a NAMED case in dev/tests-sabotage-meta.js (the harness self-trust suite), which drives sabotage.js directly.
var sabotage = require("./sabotage.js");
var command = ["node", ["dev/tests-sabotage-meta.js"]];
var also = ["dev/capture-run.js", "dev/sabotage.js"];   // pre-commit the helper is new and sabotage.js requires it
var failed = 0;
failed += sabotage.prove({ file: "dev/capture-run.js", also: also, command: command, cases: [
  { label: "the capture falls back to Node's 1 MiB default (the #274 clause loses its catcher again)",
    find: "  if (o.maxBuffer == null) o.maxBuffer = MAX_OUTPUT;\n", replace: "",
    mustFail: "a catcher after the first MiB was lost" },
  { label: "a cut-off run is no longer named",
    find: "  if (r.error) r.unobserved = r.error.code === \"ENOBUFS\"", replace: "  if (false) r.unobserved = r.error.code === \"ENOBUFS\"",
    mustFail: "was not reported UNOBSERVED" }
] });
failed += sabotage.prove({ file: "dev/sabotage.js", also: also, command: command, cases: [
  { label: "the core harness captures with spawnSync's default again",
    find: "      var run = capture.runCaptured(cmd[0], cmd[1], { cwd: opts.cwd || ROOT });",
    replace: "      var run = cp.spawnSync(cmd[0], cmd[1], { cwd: opts.cwd || ROOT, encoding: \"utf8\" });",
    mustFail: "a catcher after the first MiB was lost" },
  { label: "the core harness judges a run it never observed",
    find: "      if (run.unobserved) {   /* #473", replace: "      if (false) {   /* #473",
    mustFail: "an unrunnable command was not reported UNOBSERVED" }
] });
// The class behind this battery's own first red: a label that borrows a verdict word reads as a failure to both runners.
failed += sabotage.prove({ file: "dev/sabotage-395-cloud-backup.js", command: ["node", ["dev/tests-252-retained-proof-wiring.js"]], also: ["dev/battery-verdict.js"], cases: [
  { label: "a clause label borrows a verdict word (a passing battery would read as failed)",
    find: "label: \"a conflict no longer refuses (another device is ahead and this copy would vanish)\"",
    replace: "label: \"a conflict no longer refuses (MISATTRIBUTED)\"",
    mustFail: "a clause label contains a phrase the runners read as a misfire" }
] });
process.exit(failed ? 1 : 0);
