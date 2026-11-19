// dev/tests-609-contract-harness.js — #609: the contract-sabotage harness (dev/scratch-contract-sabotage.js) proves a clause
// against the WHOLE working set, not HEAD plus the one mutated file. The probe builds a fixture repo whose guard depends on an
// UNTRACKED file and a MODIFIED tracked file, both uncommitted; the clause's mutation is caught only when both rode into the clone.
//   node dev/tests-609-contract-harness.js
"use strict";
var fs = require("fs"), os = require("os"), path = require("path"), cp = require("child_process");
var ROOT = path.join(__dirname, "..");
var harness = require("./scratch-contract-sabotage.js");
var failed = 0, passed = 0;
function test(name, fn) { try { var r = fn(); if (r === true || r === undefined) { passed++; console.log("PASS " + name); } else { failed++; console.error("FAIL " + name + " — " + r); } } catch (e) { failed++; console.error("FAIL " + name + " — threw: " + (e && e.stack || e)); } }

test("the working set rides in: a clause on a committed file is caught by a guard that needs an UNTRACKED file and a MODIFIED tracked file, neither committed", function () {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-609-"));
  var env = {}; Object.keys(process.env).forEach(function (k) { if (k.indexOf("GIT_") !== 0) env[k] = process.env[k]; });
  function git(args) { var r = cp.spawnSync("git", ["-c", "user.email=fixture@test", "-c", "user.name=fixture", "-c", "commit.gpgsign=false"].concat(args), { cwd: tmp, env: env, encoding: "utf8" }); if (r.status !== 0) throw new Error("git " + args.join(" ") + ": " + (r.stderr || r.stdout)); return r.stdout; }
  var lines = [], ol = console.log, oe = console.error;
  try {
    fs.mkdirSync(path.join(tmp, "dev"));
    fs.writeFileSync(path.join(tmp, "a.js"), "module.exports = function () { return 1; };\n");
    fs.writeFileSync(path.join(tmp, "c.js"), "module.exports = 1;\n");
    /* the COMMITTED guard knows only a.js and says something else when it changes — so a clone that is HEAD plus the mutated
       file fails on it but never prints the attribution text; only the uncommitted guard below can (the clause is then MISATTRIBUTED,
       which is exactly what #607's two-file change read before #609) */
    fs.writeFileSync(path.join(tmp, "dev", "guard.js"), "var a = require('../a.js');\nif (a() !== 1) { console.log('the committed guard saw a change'); process.exit(1); }\nconsole.log('guard ok');\n");
    git(["init", "-q"]); git(["add", "-A"]); git(["commit", "-q", "-m", "base"]);
    // the uncommitted working set: a NEW dependency and a MODIFIED one, and the guard now needs both
    fs.writeFileSync(path.join(tmp, "b.js"), "module.exports = 2;\n");
    fs.writeFileSync(path.join(tmp, "c.js"), "module.exports = 2;\n");
    fs.writeFileSync(path.join(tmp, "dev", "guard.js"), "var a = require('../a.js'), b = require('../b.js'), c = require('../c.js');\nif (b !== 2 || c !== 2) { console.log('the clone is HEAD, not the working set'); process.exit(1); }\nif (a() !== 1) { console.log('GUARD a changed'); process.exit(1); }\nconsole.log('guard ok');\n");
    console.log = function (m) { lines.push(String(m)); }; console.error = function (m) { lines.push(String(m)); };
    var rc = harness.prove("PROBE 609", [
      { file: "a.js", label: "a loses its one", find: "return 1;", replace: "return 9;", mustFail: "GUARD a changed" }
    ], { root: tmp, command: ["dev/guard.js"] });
    console.log = ol; console.error = oe;
    if (rc !== 0) return "the clause was not proven against the working set — rc " + rc + ": " + lines.join(" / ");
    if (!lines.some(function (l) { return /PASS caught a loses its one/.test(l); })) return "no PASS line: " + lines.join(" / ");
    if (!lines.some(function (l) { return /scratch-contract-sabotage: PROBE 609 — the working set mirrored/.test(l); })) return "the harness does not name itself (the sweep tags the verdict line by this): " + lines.join(" / ");
    // the clone must not have touched the fixture
    if (fs.readFileSync(path.join(tmp, "a.js"), "utf8").indexOf("return 1;") < 0) return "the fixture's a.js was mutated in place";
    return true;
  } finally {
    console.log = ol; console.error = oe;
    try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) {}
  }
});

/* Audit 2026-11-19, rows G1, G3 and G4 — the same three holes sabotage.js had, in this harness: a guard that is red before any
   mutation, a catcher named only on a PASS line, and a guarded command that is not told which file is under mutation. */
function fixture(guardSrc, cases) {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-609-g-"));
  var env = {}; Object.keys(process.env).forEach(function (k) { if (k.indexOf("GIT_") !== 0) env[k] = process.env[k]; });
  function git(args) { var r = cp.spawnSync("git", ["-c", "user.email=fixture@test", "-c", "user.name=fixture", "-c", "commit.gpgsign=false"].concat(args), { cwd: tmp, env: env, encoding: "utf8" }); if (r.status !== 0) throw new Error("git " + args.join(" ") + ": " + String(r.stderr || r.stdout)); }
  var lines = [], ol = console.log, oe = console.error, rc;
  try {
    fs.mkdirSync(path.join(tmp, "dev"));
    fs.writeFileSync(path.join(tmp, "a.js"), "module.exports = function () { return 1; };\n");
    fs.writeFileSync(path.join(tmp, "dev", "guard.js"), guardSrc);
    git(["init", "-q"]); git(["add", "-A"]); git(["commit", "-q", "-m", "base"]);
    console.log = function (m) { lines.push(String(m)); }; console.error = function (m) { lines.push(String(m)); };
    rc = harness.prove("PROBE G", cases, { root: tmp, command: ["dev/guard.js"] });
  } finally {
    console.log = ol; console.error = oe;
    try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) {}
  }
  return { rc: rc, text: lines.join("\n") };
}
var ONE = [{ file: "a.js", label: "a loses its one", find: "return 1;", replace: "return 9;", mustFail: "the named guard" }];
test("G4: a guard that is red on the unmutated clone proves nothing — the clause is UNOBSERVED, never caught", function () {
  var r = fixture("console.log('FAIL the named guard');\nprocess.exit(1);\n", ONE);
  if (r.rc === 0 || /PASS caught/.test(r.text)) return "a clause was caught by a guard that was red before the mutation: " + r.text;
  return /FAIL UNOBSERVED a loses its one/.test(r.text) && /red on the unmutated/.test(r.text) ? true : "the clause was not reported UNOBSERVED with the reason: " + r.text;
});
test("G3: a catcher named only on a PASS line is MISATTRIBUTED; on a failure line it is caught", function () {
  var wrong = fixture("var a = require('../a.js');\nconsole.log('PASS the named guard');\nif (a() !== 1) { console.log('FAIL some other guard'); process.exit(1); }\n", ONE);
  if (wrong.rc === 0 || !/FAIL MISATTRIBUTED a loses its one/.test(wrong.text)) return "a catcher on a PASS line was not MISATTRIBUTED: " + wrong.text;
  var right = fixture("var a = require('../a.js');\nif (a() !== 1) { console.log('FAIL the named guard'); process.exit(1); }\nconsole.log('PASS the named guard');\n", ONE);
  return right.rc === 0 && /PASS caught a loses its one/.test(right.text) ? true : "a catcher on a failure line was not caught: " + right.text;
});
test("G1: the guarded command is told which file is under mutation", function () {
  var r = fixture("var a = require('../a.js');\nif (process.env.TND_SABOTAGE_PROVING_FILE !== 'a.js') { console.log('NOT TOLD: ' + process.env.TND_SABOTAGE_PROVING_FILE); process.exit(1); }\nif (a() !== 1) { console.log('FAIL the named guard'); process.exit(1); }\n", ONE);
  return r.rc === 0 && /PASS caught a loses its one/.test(r.text) ? true : "the guard was not handed TND_SABOTAGE_PROVING_FILE=a.js on the clean run and the mutated run: " + r.text;
});

test("the sweep's verdict line names the harness when a battery's output carries its header", function () {
  var src = fs.readFileSync(path.join(ROOT, "dev", "run-sabotage-diff.js"), "utf8");
  if (src.indexOf('indexOf("scratch-contract-sabotage:")>=0?" [contract harness]":""') < 0) return "run-sabotage-diff does not tag the verdict line";
  var h = fs.readFileSync(path.join(ROOT, "dev", "scratch-contract-sabotage.js"), "utf8");
  if (h.indexOf('require("./sabotage.js").mirrorWorkingSet(scratch, root)') < 0) return "the harness does not ride sabotage.js's one mirror";
  if (/fs\.copyFileSync\(src, dst\)/.test(h)) return "the per-file copy survives beside the mirror";
  return true;
});

if (failed) { console.error("#609 contract harness: " + failed + " FAILED, " + passed + " passed"); process.exit(1); }
console.log("ALL GREEN — " + passed + " #609 contract-harness probes");
