// tests-252-retained-proof-wiring.js — failing-condition probes for the retained-proof CI gate.
var fs = require("fs");
var os = require("os");
var path = require("path");
var cp = require("child_process");

var ROOT = path.join(__dirname, "..");
var FILTER = process.argv[2] || "";
var pass = 0, fail = 0;
function output(run) { return String(run.stdout || "") + String(run.stderr || ""); }
function test(name, fn) {
  if (FILTER && name.indexOf(FILTER) < 0) return;
  try {
    var why = fn();
    if (why) { fail++; console.error("FAIL " + name + " — " + why); }
    else { pass++; console.log("PASS " + name); }
  } catch (e) { fail++; console.error("FAIL " + name + " — " + (e && e.stack || e)); }
}

test("every retained sabotage find target is still applicable without running mutations", function () {
  var run = cp.spawnSync(process.execPath, ["dev/check-sabotage-applicability.js"], {
    cwd: ROOT, encoding: "utf8"
  });
  var out = output(run);
  if (run.status !== 0) return out || "applicability command exited " + run.status;
  return /ALL GREEN — \d+\/\d+ retained sabotage clauses applicable/.test(out) ? "" : "success receipt missing: " + out;
});

test("applicability scan rejects a stale target in a disposable fixture", function () {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-applicability-stale-"));
  try {
    fs.mkdirSync(path.join(tmp, "dev"));
    fs.writeFileSync(path.join(tmp, "target.js"), "var live = true;\n", "utf8");
    fs.writeFileSync(path.join(tmp, "dev", "sabotage-fixture.js"),
      'if(process.env.TND_SABOTAGE_APPLICABILITY_ONLY==="1")module.exports=[{file:"target.js",label:"stale fixture",find:"var missing = true;",replace:""}];\n', "utf8");
    var run = cp.spawnSync(process.execPath, ["dev/check-sabotage-applicability.js", "--root", tmp], {
      cwd: ROOT, encoding: "utf8"
    });
    var out = output(run);
    if (run.status === 0) return "stale fixture passed: " + out;
    return out.indexOf("stale fixture find target is stale") >= 0 ? "" : "named stale-target failure missing: " + out;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test("applicability scan shares sabotage.js LF-to-CRLF target normalization", function () {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-applicability-crlf-"));
  try {
    fs.mkdirSync(path.join(tmp, "dev"));
    fs.writeFileSync(path.join(tmp, "target.js"), "first\r\nsecond\r\n", "utf8");
    fs.writeFileSync(path.join(tmp, "dev", "sabotage-fixture.js"),
      'if(process.env.TND_SABOTAGE_APPLICABILITY_ONLY==="1")module.exports=[{file:"target.js",label:"CRLF fixture",find:"first\\nsecond",replace:"changed\\nsecond"}];\n', "utf8");
    var run = cp.spawnSync(process.execPath, ["dev/check-sabotage-applicability.js", "--root", tmp], {
      cwd: ROOT, encoding: "utf8"
    });
    var out = output(run);
    return run.status === 0 && /1\/1 retained sabotage clauses applicable/.test(out) ? "" : out;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test("applicability scan refuses an empty battery inventory", function () {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-applicability-empty-"));
  try {
    fs.mkdirSync(path.join(tmp, "dev"));
    var run = cp.spawnSync(process.execPath, ["dev/check-sabotage-applicability.js", "--root", tmp], {
      cwd: ROOT, encoding: "utf8"
    });
    var out = output(run);
    if (run.status === 0) return "empty inventory passed: " + out;
    return out.indexOf("no retained sabotage clauses were discovered") >= 0 ? "" : "named empty-inventory failure missing: " + out;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test("diff replay check accepts the committed v1238 baseline without rewriting it", function () {
  var baseline = path.join(ROOT, "dev", "corpus_playtest_v1238.json.endstate.json");
  if (!fs.existsSync(baseline)) return "committed baseline is missing";
  var before = fs.readFileSync(baseline);
  var run = cp.spawnSync(process.execPath, ["dev/diff-replay.js", "dev/corpus_playtest_v1238.json", "--check"], {
    cwd: ROOT, encoding: "utf8"
  });
  var out = output(run), after = fs.readFileSync(baseline);
  if (run.status !== 0) return out || "check exited " + run.status;
  if (!before.equals(after)) return "--check rewrote its committed oracle";
  return out.indexOf("end state matches committed baseline") >= 0 ? "" : "comparison receipt missing: " + out;
});

test("diff replay check rejects a mismatched baseline and leaves it byte-identical", function () {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-diff-replay-check-"));
  try {
    var corpus = path.join(tmp, "corpus.json"), baseline = corpus + ".endstate.json";
    fs.writeFileSync(corpus, '{"raw":[]}', "utf8");
    fs.writeFileSync(baseline, '{"deliberately":"wrong"}', "utf8");
    var before = fs.readFileSync(baseline);
    var run = cp.spawnSync(process.execPath, ["dev/diff-replay.js", corpus, "--check"], {
      cwd: ROOT, encoding: "utf8"
    });
    var out = output(run), after = fs.readFileSync(baseline);
    if (run.status === 0) return "mismatched oracle passed: " + out;
    if (!before.equals(after)) return "failed --check rewrote its oracle";
    return out.indexOf("ENDSTATE DRIFT") >= 0 ? "" : "named drift failure missing: " + out;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

if (fail) { console.error("RETAINED PROOF WIRING: " + fail + " failed, " + pass + " passed"); process.exit(1); }
console.log("ALL GREEN — " + pass + " retained-proof wiring probes");
