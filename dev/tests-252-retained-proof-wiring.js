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

test("applicability scan rejects an ambiguous target (a find that matches twice) in a disposable fixture", function () {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-applicability-ambiguous-"));
  try {
    fs.mkdirSync(path.join(tmp, "dev"));
    fs.writeFileSync(path.join(tmp, "target.js"), "if(!node)return fail;\nfunction other(){ if(!node)return fail; }\n", "utf8");
    fs.writeFileSync(path.join(tmp, "dev", "sabotage-fixture.js"),
      'if(process.env.TND_SABOTAGE_APPLICABILITY_ONLY==="1")module.exports=[{file:"target.js",label:"ambiguous fixture",find:"if(!node)return fail;",replace:"if(!node)return ok;"}];\n', "utf8");
    var run = cp.spawnSync(process.execPath, ["dev/check-sabotage-applicability.js", "--root", tmp], {
      cwd: ROOT, encoding: "utf8"
    });
    var out = output(run);
    if (run.status === 0) return "ambiguous fixture passed (the harness would mutate the first match and the clause could guard the wrong site): " + out;
    return out.indexOf("ambiguous fixture find target is ambiguous (2 matches)") >= 0 ? "" : "named ambiguous-target failure missing: " + out;
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

// ── #472: the SKIP verdict and the diff runner's target detection ─────────────────────────────────────────────
// A battery that cannot run its guards here (no Chrome for dev/cdp-browser.js) announces SABOTAGE SKIPPED and exits
// 78; both runners must print that as a skip — never fold it into "green" — and anything else about the run must
// still fail it. The diff runner must also schedule a battery that declares its target with a quoted key.
var verdict = require("./battery-verdict.js");
test("verdict: exit 0 is ok, an announced 78 is a SKIP, an unannounced 78 or a misfire under 78 fails", function () {
  var said = "SABOTAGE SKIPPED (sabotage-x.js): 3 clause(s) NOT proven on this machine — no Chrome";
  var cases = [
    ["a clean run", 0, "   ✓ caught      a clause", "ok"],
    ["an announced skip", verdict.SKIP_EXIT, "   ✓ caught      the node clause\n" + said, "skip"],
    ["an unannounced 78", verdict.SKIP_EXIT, "", "fail"],
    ["a wrong-test red under an announced skip", verdict.SKIP_EXIT, said + "\n   ✗ MISATTRIBUTED the node clause", "fail"],
    ["an announcement on exit 1", 1, said, "fail"],
    ["a wrong-test red under exit 0", 0, "   ✗ MISATTRIBUTED something exited 0", "fail"],
    ["a killed run (no status)", null, "", "fail"]
  ];
  for (var i = 0; i < cases.length; i++) {
    var got = verdict.classify(cases[i][1], cases[i][2]).verdict;
    if (got !== cases[i][3]) return "verdict for " + cases[i][0] + " is " + got + ", want " + cases[i][3];
  }
  var s = verdict.classify(verdict.SKIP_EXIT, "noise\n" + said + "\n::warning title=x::" + said);
  return s.skipLines.length === 2 && s.skipLines[0] === said ? "" : "skip announcement not carried for the runner to echo: " + JSON.stringify(s.skipLines);
});

test("diff runner schedules a quoted \"file\" key, ignores a profile: key, prints a SKIP and fails an unannounced 78", function () {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-sabotage-diff-"));
  var env = {};
  Object.keys(process.env).forEach(function (k) { if (k.indexOf("GIT_") !== 0) env[k] = process.env[k]; });   // a hook's GIT_DIR must never steer the fixture into the real repo
  env.GITHUB_ACTIONS = "";
  function git(args) { var r = cp.spawnSync("git", ["-c", "user.email=fixture@test", "-c", "user.name=fixture", "-c", "commit.gpgsign=false"].concat(args), { cwd: tmp, env: env, encoding: "utf8" }); if (r.status !== 0) throw new Error("git " + args.join(" ") + ": " + output(r)); }
  function battery(name, body) { fs.writeFileSync(path.join(tmp, "dev", name), body, "utf8"); }
  try {
    fs.mkdirSync(path.join(tmp, "dev"));
    ["run-sabotage-diff.js", "battery-verdict.js", "battery-pool.js", "battery-targets.js"].forEach(function (f) { fs.copyFileSync(path.join(ROOT, "dev", f), path.join(tmp, "dev", f)); });/* #599 (d2): the runner reads targets through battery-targets.js */
    battery("sabotage-quoted.js", '// {"file": "target.js"}\nconsole.log("QUOTED RAN");\n');
    battery("sabotage-profile.js", '// {profile: "target.js"}\nconsole.log("PROFILE RAN");\n');
    battery("sabotage-skip.js", '// {file: "target.js"}\nconsole.log("SABOTAGE SKIPPED (sabotage-skip.js): 2 clause(s) NOT proven on this machine — fixture");process.exit(78);\n');
    fs.writeFileSync(path.join(tmp, "target.js"), "var a = 1;\n", "utf8");
    git(["init", "-q"]); git(["add", "-A"]); git(["commit", "-q", "-m", "base"]);
    fs.writeFileSync(path.join(tmp, "target.js"), "var a = 2;\n", "utf8");
    git(["commit", "-q", "-am", "touch the target"]);
    var run = cp.spawnSync(process.execPath, ["dev/run-sabotage-diff.js"], { cwd: tmp, env: env, encoding: "utf8" }), out = output(run);
    if (run.status !== 0) return "an announced skip failed the gate: " + out;
    if (!/ok   sabotage-quoted\.js/.test(out)) return "the quoted-key battery was not scheduled: " + out;
    if (/sabotage-profile\.js/.test(out)) return "a profile: key was read as a target: " + out;
    if (!/SKIP sabotage-skip\.js/.test(out) || out.indexOf("SABOTAGE SKIPPED (sabotage-skip.js)") < 0) return "the skip was not printed with its announcement: " + out;
    if (!/except 1 SKIPPED, whose clauses were NOT proven here: sabotage-skip\.js/.test(out)) return "the summary folded the skip into green: " + out;
    fs.copyFileSync(path.join(ROOT, "dev", "run-sabotage-all.js"), path.join(tmp, "dev", "run-sabotage-all.js"));
    run = cp.spawnSync(process.execPath, ["dev/run-sabotage-all.js", "skip", "quoted"], { cwd: tmp, env: env, encoding: "utf8" }); out = output(run);
    if (run.status !== 0) return "the weekly runner failed an announced skip: " + out;
    if (!/SKIP sabotage-skip\.js/.test(out) || !/SABOTAGE ALL: 1 batteries green; 1 SKIPPED, clauses NOT proven here — sabotage-skip\.js/.test(out)) return "the weekly summary folded the skip into green: " + out;
    battery("sabotage-skip.js", '// {file: "target.js"}\nprocess.exit(78);\n');
    git(["commit", "-q", "-am", "an unannounced 78"]);
    run = cp.spawnSync(process.execPath, ["dev/run-sabotage-diff.js"], { cwd: tmp, env: env, encoding: "utf8" }); out = output(run);
    if (run.status === 0) return "an unannounced exit 78 passed the gate: " + out;
    return /FAIL sabotage-skip\.js/.test(out) ? "" : "the unannounced 78 was not named as the failure: " + out;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

// The battery pool (dev/battery-pool.js, 2026-10-02): both runners run batteries several at a time. Proven on fixture
// batteries in a disposable repo: two that can only pass if they run AT ONCE (each waits for the other's marker), each
// with its own temp dir that is gone afterwards; a battery that fails only on its first run (re-run alone, passes, and is
// NAMED as flaky under load); a battery that always fails (re-run alone, still fails the gate); and one job at a time,
// where the first verdict is final and nothing is re-run.
test("battery pool: batteries run at once, each in its own temp dir; a failure beside others is re-run alone, a real failure still fails the gate, a load flake is named; one job keeps the first verdict; the battery with the most clauses starts first", function () {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-battery-pool-"));
  var marks = path.join(tmp, "marks");
  var env = {};
  Object.keys(process.env).forEach(function (k) { if (k.indexOf("GIT_") !== 0 && k !== "SABOTAGE_JOBS") env[k] = process.env[k]; });
  env.GITHUB_ACTIONS = ""; env.POOL_FIXTURE_DIR = marks;
  function git(args) { var r = cp.spawnSync("git", ["-c", "user.email=fixture@test", "-c", "user.name=fixture", "-c", "commit.gpgsign=false"].concat(args), { cwd: tmp, env: env, encoding: "utf8" }); if (r.status !== 0) throw new Error("git " + args.join(" ") + ": " + output(r)); }
  function battery(name, body) { fs.writeFileSync(path.join(tmp, "dev", name), body, "utf8"); }
  function runs(name) { var f = path.join(marks, name + ".runs"); return fs.existsSync(f) ? Number(fs.readFileSync(f, "utf8")) : 0; }
  function run(script, args, jobs) { var e = Object.assign({}, env); if (jobs) e.SABOTAGE_JOBS = jobs; var r = cp.spawnSync(process.execPath, ["dev/" + script].concat(args), { cwd: tmp, env: e, encoding: "utf8" }); return { status: r.status, out: output(r) }; }
  function rendezvous(me, other) {
    return '// {file: "t1.js"}\nvar fs=require("fs"),path=require("path"),os=require("os"),d=process.env.POOL_FIXTURE_DIR;\n' +
      'fs.writeFileSync(path.join(d,"' + me + '.tmp"),os.tmpdir());\nvar until=Date.now()+20000,nap=new Int32Array(new SharedArrayBuffer(4));\n' +
      'while(!fs.existsSync(path.join(d,"' + other + '.tmp"))){if(Date.now()>until){console.log("RENDEZVOUS TIMEOUT ' + me + '");process.exit(1);}Atomics.wait(nap,0,0,50);}\nconsole.log("RENDEZVOUS ' + me + '");\n';
  }
  function counted(name, failWhen) {
    return '// {file: "t2.js"}\nvar fs=require("fs"),path=require("path"),f=path.join(process.env.POOL_FIXTURE_DIR,"' + name + '.runs");\n' +
      'var n=fs.existsSync(f)?Number(fs.readFileSync(f,"utf8")):0;fs.writeFileSync(f,String(n+1));\nif(' + failWhen + '){console.log("' + name + ' run "+(n+1)+" fails");process.exit(1);}\nconsole.log("' + name + ' run "+(n+1)+" passes");\n';
  }
  try {
    fs.mkdirSync(path.join(tmp, "dev")); fs.mkdirSync(marks);
    ["run-sabotage-diff.js", "run-sabotage-all.js", "battery-verdict.js", "battery-pool.js", "battery-targets.js"].forEach(function (f) { fs.copyFileSync(path.join(ROOT, "dev", f), path.join(tmp, "dev", f)); });
    battery("sabotage-aa-rendezvous.js", rendezvous("aa", "ab"));
    battery("sabotage-ab-rendezvous.js", rendezvous("ab", "aa"));
    battery("sabotage-flaky.js", counted("flaky", "n===0"));
    battery("sabotage-broken.js", counted("broken", "true"));
    fs.writeFileSync(path.join(tmp, "t1.js"), "var a = 1;\n", "utf8"); fs.writeFileSync(path.join(tmp, "t2.js"), "var b = 1;\n", "utf8");
    git(["init", "-q"]); git(["add", "-A"]); git(["commit", "-q", "-m", "base"]);

    // ① two batteries at once (the --jobs flag, the range left to its default), each with its own temp dir, both gone after
    fs.writeFileSync(path.join(tmp, "t1.js"), "var a = 2;\n", "utf8"); git(["commit", "-q", "-am", "touch t1"]);
    var r = run("run-sabotage-diff.js", ["--jobs=2"]);
    if (r.status !== 0 || !/ok   sabotage-aa-rendezvous\.js/.test(r.out) || !/ok   sabotage-ab-rendezvous\.js/.test(r.out)) return "the pool did not run two batteries at once (each waits for the other): " + r.out;
    var ta = fs.readFileSync(path.join(marks, "aa.tmp"), "utf8"), tb = fs.readFileSync(path.join(marks, "ab.tmp"), "utf8");
    if (ta === tb || ta === os.tmpdir() || tb === os.tmpdir()) return "two batteries shared a temp dir: " + JSON.stringify([ta, tb, os.tmpdir()]);
    if (fs.existsSync(ta) || fs.existsSync(tb)) return "a battery's temp dir was left on disk: " + JSON.stringify([ta, tb]);
    if (/flaky under load/.test(r.out)) return "a clean run named a flake: " + r.out;
    fs.unlinkSync(path.join(marks, "aa.tmp")); fs.unlinkSync(path.join(marks, "ab.tmp"));
    var w = run("run-sabotage-all.js", ["--jobs=2", "rendezvous"]);
    if (w.status !== 0 || !/SABOTAGE ALL: 2 batteries green/.test(w.out)) return "the weekly runner did not run two batteries at once: " + w.out;

    // ② beside each other: the flaky one fails once, is re-run alone and passes, NAMED; the broken one is re-run alone and fails the gate
    fs.writeFileSync(path.join(tmp, "t2.js"), "var b = 2;\n", "utf8"); git(["commit", "-q", "-am", "touch t2"]);
    r = run("run-sabotage-diff.js", [], "2");
    if (r.status === 0) return "a real failure passed the gate: " + r.out;
    if (runs("broken") !== 2 || !/FAIL sabotage-broken\.js/.test(r.out)) return "the always-failing battery was not re-run alone and named (runs " + runs("broken") + "): " + r.out;
    if (runs("flaky") !== 2 || /FAIL sabotage-flaky\.js/.test(r.out)) return "a load flake failed the gate instead of being re-run alone (runs " + runs("flaky") + "): " + r.out;
    if (!/flaky under load[^\n]*sabotage-flaky\.js/.test(r.out)) return "the flake was not named in the summary: " + r.out;
    if (!/run-sabotage-diff: FAILED — sabotage-broken\.js(\n|$)/.test(r.out)) return "the failure summary must name only the real failure: " + r.out;

    // ③ one job at a time: the first verdict is final, nothing is re-run
    fs.writeFileSync(path.join(marks, "flaky.runs"), "0"); fs.writeFileSync(path.join(marks, "broken.runs"), "0");
    r = run("run-sabotage-diff.js", [], "1");
    if (runs("flaky") !== 1 || runs("broken") !== 1 || !/FAIL sabotage-flaky\.js/.test(r.out)) return "one job at a time re-ran a failure, or did not keep its first verdict (flaky runs " + runs("flaky") + ", broken runs " + runs("broken") + "): " + r.out;

    // ④ a malformed job count is refused out loud, never read as a commit range
    r = run("run-sabotage-diff.js", ["--jobs=many"]);
    if (r.status === 0 || !/jobs/.test(r.out)) return "a malformed --jobs passed: " + r.out;

    // ⑤ slowest first: the battery with the most clauses (find: anchors) starts first, whatever its name. A run ends when
    // its slowest battery does, and alphabetical order had started the 96-clause sabotage-w2.js last (13.5 min, not 8).
    function ordered(name, finds) { return "// " + new Array(finds + 1).join("find: \"x\", ") + "\nrequire(\"fs\").appendFileSync(require(\"path\").join(process.env.POOL_FIXTURE_DIR,\"order\"),\"" + name + "\\n\");\n"; }
    battery("sabotage-aa-small.js", ordered("small", 1)); battery("sabotage-mm-mid.js", ordered("mid", 2)); battery("sabotage-zz-big.js", ordered("big", 3));
    git(["add", "-A"]); git(["commit", "-q", "-m", "three batteries of different sizes"]);
    w = run("run-sabotage-all.js", ["--jobs=1", "small", "mid", "big"]);
    var order = fs.existsSync(path.join(marks, "order")) ? fs.readFileSync(path.join(marks, "order"), "utf8").trim().split(/\r?\n/).join(",") : "";
    if (w.status !== 0 || order !== "big,mid,small") return "the slowest battery did not start first (ran " + order + ", want big,mid,small): " + w.out;
    return "";
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

// The class, not the instance: no battery may prove its clauses through a command that needs the playwright module
// (neither CI nor the owner's machine has it — every clause misattributes), and a battery whose command drives Chrome
// through dev/cdp-browser.js must wire the loud skip, or a machine without Chrome would pass it silently.
test("no battery command needs playwright, and every Chrome-driven battery skips out loud", function () {
  var dev = path.join(ROOT, "dev"), bad = [], browserBatteries = 0;
  fs.readdirSync(dev).filter(function (f) { return /^sabotage-.*\.js$/.test(f); }).forEach(function (f) {
    // Only what a battery RUNS: command:['node',['dev/x.js']], "command": [ "node", [ "dev/x.js" ] ], or var command=[...].
    // A file it merely mutates (file:/also:) is not a command — sabotage-472 targets the browser tests without running them.
    var src = fs.readFileSync(path.join(dev, f), "utf8"), cmds = [], m, re = /command["']?\s*[:=]\s*\[\s*["']node["']\s*,\s*\[\s*["'](dev\/[\w.\/-]+\.js)["']/g, usesChrome = false;
    while ((m = re.exec(src))) cmds.push(m[1]);
    cmds.forEach(function (c) {
      if (!fs.existsSync(path.join(ROOT, c))) return;
      var cmdSrc = fs.readFileSync(path.join(ROOT, c), "utf8");
      if (/require\([^)]*playwright/.test(cmdSrc)) bad.push(f + " proves through " + c + ", which requires playwright");
      if (/require\(\s*["']\.\/cdp-browser\.js["']\s*\)/.test(cmdSrc)) usesChrome = true;   // a real require, so this probe's own text never counts
    });
    if (!usesChrome) return;
    browserBatteries++;
    ["locateChrome()", "!chrome.path", "reportSkip(", "SKIP_EXIT", "dev/cdp-browser.js"].forEach(function (needle) {
      if (src.indexOf(needle) < 0) bad.push(f + " drives Chrome but lacks " + JSON.stringify(needle) + " — without the loud skip a machine with no Chrome passes it silently");
    });
  });
  if (browserBatteries < 2) bad.push("expected the two blueprint browser batteries to be recognized as Chrome-driven, found " + browserBatteries);
  return bad.join("\n");
});

// #473: both runners read a battery's WHOLE output for misfire phrases, labels included — so a label that SAYS
// "misattributed" makes a fully caught battery read as failed (it happened in #472 and again in #473). Words in a
// label describe a mutation; they must never collide with the words that report one.
test("no clause label contains a phrase the runners read as a misfire", function () {
  var dev = path.join(ROOT, "dev"), bad = [], seen = 0, re = /["']?label["']?\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, m;
  fs.readdirSync(dev).filter(function (f) { return /^sabotage-.*\.js$/.test(f); }).forEach(function (f) {
    var src = fs.readFileSync(path.join(dev, f), "utf8");
    while ((m = re.exec(src))) { seen++; if (verdict.MISFIRE.test(m[1])) bad.push(f + ": " + m[1]); }
  });
  if (seen < 100) return "the label scan found only " + seen + " labels — the pattern no longer reads the batteries";
  return bad.length ? "a clause label contains a phrase the runners read as a misfire (a passing battery would read as failed):\n  " + bad.join("\n  ") : "";
});

if (fail) { console.error("RETAINED PROOF WIRING: " + fail + " failed, " + pass + " passed"); process.exit(1); }
console.log("ALL GREEN — " + pass + " retained-proof wiring probes");
