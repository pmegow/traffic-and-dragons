"use strict";

// Run source-contract mutations in a disposable local clone. This is the lane-safe
// counterpart to sabotage.js: no working-tree game or UI file is ever rewritten.
const fs = require("fs");
const os = require("os");
const path = require("path");
const cp = require("child_process");
const capture = require("./capture-run.js");

const ROOT = path.join(__dirname, "..");
function output(run) { return String(run.stdout || "") + String(run.stderr || ""); }

// #609 (2026-10-10): the clone used to carry HEAD plus run-tests.js plus the one file under mutation — a change that spans two
// files (helpers.js's invCategoryIds() and bible_editor.html in #607) ran every clause against an inconsistent clone and read
// MISATTRIBUTED until committed (the #475 class sabotage.js had already closed). The WHOLE working set rides in now, through
// sabotage.js's one mirror. `opts.root` and `opts.command` exist for the probe (dev/tests-609-contract-harness.js).
function prove(name, cases, opts) {
  const root = (opts && opts.root) || ROOT, command = (opts && opts.command) || ["dev/run-tests.js"];
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-contract-proof-"));
  let failed = 0;
  try {
    const clone = cp.spawnSync("git", ["-c", "safe.directory=" + root,
      "-c", "safe.directory=" + path.join(root, ".git"), "clone", "--quiet", "--no-hardlinks", root, scratch],
      { encoding: "utf8" });
    if (clone.status !== 0) throw new Error("scratch clone failed: " + output(clone));
    require("./sabotage.js").mirrorWorkingSet(scratch, root);   /* the working set, whole — tracked changes, deletions, untracked files */
    console.log("scratch-contract-sabotage: " + name + " — the working set mirrored into the clone (#609)");

    for (const c of cases) {
      const target = path.join(scratch, c.file);
      const original = fs.readFileSync(target, "utf8");
      const changed = c.mutate ? c.mutate(original) : original.replace(c.find, c.replace);
      if (changed === original) {
        failed++;
        console.error("FAIL NOT-APPLIED " + c.label);
        continue;
      }
      fs.writeFileSync(target, changed, "utf8");
      const run = capture.runCaptured(process.execPath, command, { cwd: scratch });   /* #473: the whole output */
      fs.writeFileSync(target, original, "utf8");
      const intact = fs.readFileSync(target, "utf8") === original;
      if (run.unobserved) { failed++; console.error("FAIL UNOBSERVED " + c.label + " — the guarded command " + run.unobserved + "; restored=" + intact); continue; }
      const out = output(run);
      if (run.status === 0 || out.indexOf(c.mustFail) < 0 || !intact) {
        failed++;
        console.error("FAIL " + (run.status === 0 ? "MISSED" : "MISATTRIBUTED") + " " + c.label +
          " — expected " + JSON.stringify(c.mustFail) + "; restored=" + intact);
      } else {
        console.log("PASS caught " + c.label + " — " + c.mustFail + "; restored byte-identical");
      }
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  if (failed) {
    console.error(name + ": " + failed + " failure(s), " + (cases.length - failed) + "/" + cases.length + " proven");
    return 1;
  }
  console.log("ALL GREEN — " + cases.length + "/" + cases.length + " " + name + " clauses mutation-proven");
  return 0;
}

module.exports = { prove: prove };
