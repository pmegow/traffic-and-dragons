"use strict";

// Run source-contract mutations in a disposable local clone. This is the lane-safe
// counterpart to sabotage.js: no working-tree game or UI file is ever rewritten.
const fs = require("fs");
const os = require("os");
const path = require("path");
const cp = require("child_process");

const ROOT = path.join(__dirname, "..");
function output(run) { return String(run.stdout || "") + String(run.stderr || ""); }

function prove(name, cases) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-contract-proof-"));
  let failed = 0;
  try {
    const clone = cp.spawnSync("git", ["-c", "safe.directory=" + ROOT,
      "-c", "safe.directory=" + path.join(ROOT, ".git"), "clone", "--quiet", "--no-hardlinks", ROOT, scratch],
      { encoding: "utf8" });
    if (clone.status !== 0) throw new Error("scratch clone failed: " + output(clone));
    fs.copyFileSync(path.join(__dirname, "run-tests.js"), path.join(scratch, "dev", "run-tests.js"));

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
      const run = cp.spawnSync(process.execPath, ["dev/run-tests.js"], { cwd: scratch, encoding: "utf8" });
      fs.writeFileSync(target, original, "utf8");
      const intact = fs.readFileSync(target, "utf8") === original;
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
