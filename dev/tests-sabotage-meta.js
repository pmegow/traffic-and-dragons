// tests-sabotage-meta.js — N01 proves the prover against synthetic files only: byte-no-op,
// wrong-red attribution, crash restoration, and interrupt restoration.
var fs = require("fs");
var os = require("os");
var path = require("path");
var cp = require("child_process");

var SABOTAGE = path.join(__dirname, "sabotage.js");
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-sabotage-meta-"));
var target = path.join(tmp, "target.txt");
var pass = 0, fail = 0;

function runChild(name, body) {
  var file = path.join(tmp, name + ".js");
  fs.writeFileSync(file, body, "utf8");
  return cp.spawnSync(process.execPath, [file], { cwd: tmp, encoding: "utf8" });
}
function out(result) { return String(result.stdout || "") + String(result.stderr || ""); }
function test(name, fn) {
  try {
    var why = fn();
    if (why) { fail++; console.error("FAIL " + name + " — " + why); }
    else { pass++; console.log("PASS " + name); }
  } catch (e) { fail++; console.error("FAIL " + name + " — " + (e && e.stack || e)); }
}
function reset() { fs.writeFileSync(target, "ORIGINAL\n", "utf8"); }
function intact() { return fs.readFileSync(target, "utf8") === "ORIGINAL\n"; }
function prelude() {
  return 'var fs=require("fs");var sabotage=require(' + JSON.stringify(SABOTAGE) + ');var target=' + JSON.stringify(target) + ';';
}

try {
  test("NOT-APPLIED is a hard failure and leaves bytes intact", function () {
    reset();
    var result = runChild("not-applied", prelude() +
      'process.exit(sabotage.prove({file:target,command:[process.execPath,["-e","process.exit(0)"]],cases:[{label:"no-op fixture",find:"ABSENT",replace:"BROKEN"}]}));');
    if (result.status === 0 || out(result).indexOf("NOT APPLIED") < 0) return "verdict/status wrong: " + out(result);
    return intact() ? "" : "target bytes changed";
  });
  test("an LF-authored multi-line find matches a CRLF target (the 2026-08-22 newline rot)", function () {
    // The rot: source files are CRLF on disk, clauses are authored with LF escapes in their find
    // strings, and exact indexOf can never match. 39 clauses across 14 files were candidates and
    // 5 confirmed NOT APPLIED, two of them drift-surface guards proving nothing. The harness must
    // normalize the CLAUSE to the file, never the file (restoration is byte-identity).
    fs.writeFileSync(target, "LINE-A\r\nLINE-B\r\nLINE-C\r\n", "utf8");
    var result = runChild("crlf-find", prelude() +
      'process.exit(sabotage.prove({file:target,command:[process.execPath,["-e","process.exit(0)"]],cases:[{label:"crlf fixture",find:"LINE-A\\nLINE-B",replace:"LINE-A"}]}));');
    // The command always greens, so a matched find must reach the applied path and verdict MISSED
    // (mutation applied, nothing went red) — never the NOT-APPLIED path.
    if (out(result).indexOf("NOT APPLIED") >= 0) return "the LF find never matched the CRLF file: " + out(result);
    if (out(result).indexOf("MISSED") < 0) return "expected the applied-but-green MISSED verdict: " + out(result);
    if (fs.readFileSync(target, "utf8") !== "LINE-A\r\nLINE-B\r\nLINE-C\r\n") return "target not restored byte-identically";
    return "";
  });
  test("the normalized replacement lands in the target's own convention — no bare-LF islands in a CRLF file", function () {
    fs.writeFileSync(target, "KEEP\r\nCUT-1\r\nCUT-2\r\nTAIL\r\n", "utf8");
    // The probe command greens only if the mutated file contains a bare-LF line; mustFail pins it,
    // so a caught verdict proves the multi-line REPLACEMENT was written CRLF, then restored.
    var probeSrc = "var fs=require(" + JSON.stringify("fs") + ");var s=fs.readFileSync(" + JSON.stringify(target) + "," + JSON.stringify("utf8") + ");" +
      "if(!/PATCHED/.test(s)){console.error(" + JSON.stringify("MUTATION ABSENT") + ");process.exit(1)}" +
      "if(/[^\\r]\\n|^\\n/.test(s)){console.error(" + JSON.stringify("LF ISLAND") + ");process.exit(1)}" +
      "console.error(" + JSON.stringify("CLEAN CRLF MUTATION") + ");process.exit(1);";
    var result = runChild("crlf-replace", prelude() +
      'process.exit(sabotage.prove({file:target,command:[process.execPath,["-e",' + JSON.stringify(probeSrc) + ']],cases:[{label:"replace convention",find:"CUT-1\\nCUT-2",replace:"CUT-1\\nPATCHED",mustFail:"CLEAN CRLF MUTATION"}]}));');
    if (out(result).indexOf("NOT APPLIED") >= 0) return "find failed to match the CRLF file: " + out(result);
    if (out(result).indexOf("MUTATION ABSENT") >= 0) return "the replacement never landed: " + out(result);
    if (out(result).indexOf("LF ISLAND") >= 0) return "the replacement minted bare-LF lines into a CRLF file: " + out(result);
    if (out(result).indexOf("caught") < 0) return "expected a caught verdict via the probe: " + out(result);
    return fs.readFileSync(target, "utf8") === "KEEP\r\nCUT-1\r\nCUT-2\r\nTAIL\r\n" ? "" : "target not restored";
  });
  test("MISATTRIBUTED rejects an unrelated red and restores bytes", function () {
    reset();
    var result = runChild("misattributed", prelude() +
      'process.exit(sabotage.prove({file:target,command:[process.execPath,["-e","console.error(\\"WRONG RED\\");process.exit(1)"]],cases:[{label:"wrong-red fixture",find:"ORIGINAL",replace:"BROKEN",mustFail:"RIGHT RED"}]}));');
    if (result.status === 0 || out(result).indexOf("MISATTRIBUTED") < 0 || out(result).indexOf("RIGHT RED") < 0) return "verdict/status wrong: " + out(result);
    return intact() ? "" : "target bytes changed";
  });
  // #473: Node's spawnSync kills a child that prints past its 1 MiB default and keeps only the head. A mutation in a core
  // helper reds hundreds of tests, so the named catcher can sit past the cut: sabotage-274's corruption clause printed
  // 1,156,401 bytes with its catcher at byte 1,136,515 and read MISATTRIBUTED every week while its guard caught it.
  test("a guarded run that prints past Node's 1 MiB default is judged on its WHOLE output", function () {
    reset();
    var loud = 'process.stdout.write("x".repeat(1300000)+"\\n");console.log("RIGHT RED");process.exitCode=1;';
    var result = runChild("overflow", prelude() +
      'process.exit(sabotage.prove({file:target,command:[process.execPath,["-e",' + JSON.stringify(loud) + ']],cases:[{label:"late catcher",find:"ORIGINAL",replace:"BROKEN",mustFail:"RIGHT RED"}]}));');
    if (result.status !== 0 || out(result).indexOf("caught") < 0) return "a catcher after the first MiB was lost — the verdict read a fragment: " + out(result).slice(0, 400);
    return intact() ? "" : "target bytes changed";
  });
  test("a guarded command that cannot be observed is UNOBSERVED — never judged caught or misattributed", function () {
    reset();
    var result = runChild("unobserved", prelude() +
      'process.exit(sabotage.prove({file:target,command:["tnd-no-such-command-473",[]],cases:[{label:"unrunnable fixture",find:"ORIGINAL",replace:"BROKEN",mustFail:"RIGHT RED"}]}));');
    var o = out(result);
    if (result.status === 0 || o.indexOf("UNOBSERVED") < 0) return "an unrunnable command was not reported UNOBSERVED: " + o;
    if (o.indexOf("MISATTRIBUTED") >= 0) return "a run nobody observed was judged anyway: " + o;
    var cut = require(path.join(path.dirname(SABOTAGE), "capture-run.js")).runCaptured(process.execPath, ["-e", 'process.stdout.write("x".repeat(5000))'], { maxBuffer: 1024 });
    if (!cut.unobserved || !/cut off/.test(cut.unobserved)) return "runCaptured did not name a cut-off run: " + JSON.stringify(cut.unobserved);
    return intact() ? "" : "target bytes changed";
  });
  // #475: proveScratch clones HEAD, and the clone must then BE the working tree but for the mutation — a curated copy list
  // missed five co-changed files before this (the last: an uncommitted audio-catalog.js regeneration whose source stayed at
  // HEAD, which failed a suite's baseline in every clone and stopped the runner before later catchers ran). The fixture is
  // its own git repo holding a copy of this harness, so ROOT is the fixture and nothing here touches the real repository.
  test("the scratch clone mirrors the working set — modified, deleted and untracked files ride in; testRuns/ logs are skipped out loud", function () {
    var repo = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-sabotage-mirror-")), skewFile = repo + "-skew.txt";
    var env = {};   // a hook's GIT_DIR / GIT_INDEX_FILE must never steer the fixture's git into the real repository
    Object.keys(process.env).forEach(function (k) { if (k.indexOf("GIT_") !== 0) env[k] = process.env[k]; });
    function git(args) { var r = cp.spawnSync("git", ["-c", "user.email=fixture@test", "-c", "user.name=fixture", "-c", "commit.gpgsign=false"].concat(args), { cwd: repo, env: env, encoding: "utf8" }); if (r.status !== 0) throw new Error("git " + args.join(" ") + ": " + out(r)); }
    function put(rel, text) { fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true }); fs.writeFileSync(path.join(repo, rel), text, "utf8"); }
    try {
      ["sabotage.js", "capture-run.js"].forEach(function (f) { put("dev/" + f, fs.readFileSync(path.join(path.dirname(SABOTAGE), f), "utf8")); });
      put("target.txt", "ORIGINAL\n"); put("data/extra.txt", "HEAD\n"); put("data/gone.txt", "HEAD\n");
      // The guarded command records every way the clone differs from the working tree, then reds on the mutation by NAME.
      put("check.js", [
        'var fs=require("fs"),skew=[];',
        'if(fs.readFileSync("data/extra.txt","utf8").trim()!=="WORKING")skew.push("a modified tracked file");',
        'if(fs.existsSync("data/gone.txt"))skew.push("a deleted tracked file");',
        'if(!fs.existsSync("data/new.txt"))skew.push("an untracked file");',
        'if(fs.existsSync("testRuns/run.log"))skew.push("a testRuns/ log");',
        'if(skew.length){fs.writeFileSync(' + JSON.stringify(skewFile) + ',skew.join(", "));console.error("CLONE SKEW");process.exit(1);}',
        'if(fs.readFileSync("target.txt","utf8").indexOf("BROKEN")>=0){console.error("NAMED CATCH");process.exit(1);}'
      ].join("\n"));
      git(["init", "-q"]); git(["add", "-A"]); git(["commit", "-q", "-m", "fixture base"]);
      put("data/extra.txt", "WORKING\n"); fs.unlinkSync(path.join(repo, "data", "gone.txt"));
      put("data/new.txt", "UNTRACKED\n"); put("testRuns/run.log", "a personal run log\n");
      var battery = path.join(tmp, "mirror-battery.js");
      fs.writeFileSync(battery, 'var sabotage=require(' + JSON.stringify(path.join(repo, "dev", "sabotage.js")) + ');' +
        'process.exit(sabotage.prove({file:"target.txt",command:[process.execPath,["check.js"]],cases:[{label:"mirror fixture",find:"ORIGINAL",replace:"BROKEN",mustFail:"NAMED CATCH"}]}));', "utf8");
      var result = cp.spawnSync(process.execPath, [battery], { cwd: tmp, env: env, encoding: "utf8" }), o = out(result);
      if (fs.existsSync(skewFile)) return "the scratch clone did not mirror the working set: " + fs.readFileSync(skewFile, "utf8");
      if (result.status !== 0 || o.indexOf("caught") < 0) return "the mirrored clause was not caught: " + o.slice(0, 400);
      if (!/mirrors the working set except 1 untracked personal run log/.test(o)) return "the testRuns/ skip was silent: " + o.slice(0, 400);
      return fs.readFileSync(path.join(repo, "target.txt"), "utf8") === "ORIGINAL\n" ? "" : "the fixture's working target was touched";
    } finally {
      fs.rmSync(repo, { recursive: true, force: true }); fs.rmSync(skewFile, { force: true });
    }
  });
  // #551: a battery proves in ONE scratch clone, reused by every prove() group. A fresh clone per group cost ~10 s on
  // Windows (the first read of every freshly written file is scanned) — 32 clones were ~5 of sabotage-w2's 7 minutes. A
  // reused clone must still start each group as a fresh one would: reset to HEAD (a file a run left behind is gone, a
  // tracked file a run changed is back), then the working set mirrored AS IT IS NOW; a moved HEAD gets a new clone; the
  // clone is removed when the battery exits.
  test("one scratch clone serves every prove group: reused, reset to HEAD and re-mirrored per group, re-cloned when HEAD moves, removed at exit", function () {
    var repo = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-sabotage-reuse-")), log = repo + "-groups.txt";
    var env = {};
    Object.keys(process.env).forEach(function (k) { if (k.indexOf("GIT_") !== 0) env[k] = process.env[k]; });
    function git(args) { var r = cp.spawnSync("git", ["-c", "user.email=fixture@test", "-c", "user.name=fixture", "-c", "commit.gpgsign=false"].concat(args), { cwd: repo, env: env, encoding: "utf8" }); if (r.status !== 0) throw new Error("git " + args.join(" ") + ": " + out(r)); }
    function put(rel, text) { fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true }); fs.writeFileSync(path.join(repo, rel), text, "utf8"); }
    try {
      ["sabotage.js", "capture-run.js"].forEach(function (f) { put("dev/" + f, fs.readFileSync(path.join(path.dirname(SABOTAGE), f), "utf8")); });
      put("target.txt", "ORIGINAL\n"); put("data/kept.txt", "HEAD\n");
      // Each group's run logs where it ran and what it saw, then dirties the clone the way a test might, then reds by NAME.
      put("check.js", [
        'var fs=require("fs"),seen=[process.cwd(),fs.existsSync("stray.txt")?"stray":"-",fs.readFileSync("data/kept.txt","utf8").trim(),fs.existsSync("data/late.txt")?"late":"-"];',
        'fs.appendFileSync(' + JSON.stringify(log) + ',seen.join("|")+"\\n");',
        'fs.writeFileSync("stray.txt","left by a run");fs.writeFileSync("data/kept.txt","CHANGED BY A RUN\\n");',
        'if(fs.readFileSync("target.txt","utf8").indexOf("BROKEN")>=0){console.error("NAMED CATCH");process.exit(1);}'
      ].join("\n"));
      git(["init", "-q"]); git(["add", "-A"]); git(["commit", "-q", "-m", "fixture base"]);
      var battery = path.join(tmp, "reuse-battery.js"), group = 'sabotage.prove({file:"target.txt",command:[process.execPath,["check.js"]],cases:[{label:"reuse fixture",find:"ORIGINAL",replace:"BROKEN",mustFail:"NAMED CATCH"}]})';
      fs.writeFileSync(battery, 'var fs=require("fs"),path=require("path"),cp=require("child_process"),repo=' + JSON.stringify(repo) + ';' +
        'var sabotage=require(path.join(repo,"dev","sabotage.js")),rc=0;' +
        'rc|=' + group + ';' +
        'fs.writeFileSync(path.join(repo,"data","late.txt"),"untracked, written between groups\\n");' +
        'rc|=' + group + ';' +
        'fs.writeFileSync(path.join(repo,"data","kept.txt"),"COMMITTED LATER\\n");' +
        'cp.spawnSync("git",["-c","user.email=fixture@test","-c","user.name=fixture","-c","commit.gpgsign=false","commit","-q","-am","move HEAD"],{cwd:repo});' +
        'rc|=' + group + ';process.exit(rc);', "utf8");
      var result = cp.spawnSync(process.execPath, [battery], { cwd: tmp, env: env, encoding: "utf8" }), o = out(result);
      if (result.status !== 0 || (o.match(/caught/g) || []).length !== 3) return "the three groups were not all caught: " + o.slice(0, 600);
      var rows = fs.readFileSync(log, "utf8").trim().split(/\r?\n/).map(function (l) { return l.split("|"); });
      if (rows.length !== 3) return "expected three group runs, got " + rows.length;
      if (rows[0][0] !== rows[1][0]) return "the second group cloned again instead of reusing the battery's clone: " + rows[0][0] + " vs " + rows[1][0];
      if (rows[1][1] !== "-" || rows[1][2] !== "HEAD") return "a reused clone was not reset to HEAD before the next group (stray file / changed tracked file survived): " + rows[1].join("|");
      if (rows[1][3] !== "late") return "a reused clone was not re-mirrored at the group's start (an untracked file written between groups is missing)";
      if (rows[2][2] !== "COMMITTED LATER") return "a moved HEAD did not give the next group a clone of the new commit: " + rows[2].join("|");
      var leftover = rows.map(function (r) { return r[0]; }).filter(function (d) { return fs.existsSync(d); });
      return leftover.length ? "a scratch clone was left on disk after the battery exited: " + leftover.join(", ") : "";
    } finally {
      fs.rmSync(repo, { recursive: true, force: true }); fs.rmSync(log, { force: true });
    }
  });
  test("repo-relative mutations stay inside a disposable clone", function () {
    // proveScratch clones the repo, so this case needs one. The standalone-sabotage battery
    // re-runs this whole suite inside a SYNTHETIC tree (no .git) to prove the newline
    // normalizer; there the scratch case skips LOUDLY — CI's normal pass still runs it
    // from the real repo, so the coverage never actually lapses.
    if (!fs.existsSync(path.join(path.dirname(SABOTAGE), "..", ".git"))) { console.log("SKIP scratch-isolation — not a git repo (synthetic-tree run); covered by the real-repo pass"); return ""; }
    var real = path.join(path.dirname(SABOTAGE), "tests-sabotage-meta.js");
    var before = fs.readFileSync(real);
    var result = runChild("scratch-isolation", prelude() +
      'process.exit(sabotage.prove({file:"dev/tests-sabotage-meta.js",command:[process.execPath,["-e",' +
      JSON.stringify('var fs=require("fs");var s=fs.readFileSync("dev/tests-sabotage-meta.js","utf8");if(s.indexOf("SYNTHETIC CLONE MUTATION")>=0){console.error("SCRATCH MUTATION CAUGHT");process.exit(1)}process.exit(0)') +
      ']],cases:[{label:"scratch isolation",find:"synthetic files only",replace:"SYNTHETIC CLONE MUTATION",mustFail:"SCRATCH MUTATION CAUGHT"}]}));');
    var after = fs.readFileSync(real);
    if (result.status !== 0 || out(result).indexOf("caught") < 0) return "scratch proof failed: " + out(result);
    return before.equals(after) ? "" : "working-tree bytes were exposed to the mutation";
  });
  test("uncaught crash after mutation restores the original bytes", function () {
    reset();
    var marker = path.join(tmp, "crash-marker.txt");
    var result = runChild("crash", prelude() + 'var marker=' + JSON.stringify(marker) + ';' +
      'var cmd=[];Object.defineProperty(cmd,"0",{get:function(){fs.writeFileSync(marker,fs.readFileSync(target));throw new Error("synthetic crash");}});cmd[1]=[];' +
      'sabotage.prove({file:target,command:cmd,cases:[{label:"crash fixture",find:"ORIGINAL",replace:"BROKEN"}]});');
    if (result.status === 0 || !fs.existsSync(marker) || fs.readFileSync(marker, "utf8").indexOf("BROKEN") < 0) return "crash did not occur after mutation: " + out(result);
    return intact() ? "" : "crash left target sabotaged";
  });
  test("SIGINT handler after mutation restores bytes and exits 130", function () {
    reset();
    var marker = path.join(tmp, "interrupt-marker.txt");
    var result = runChild("interrupt", prelude() + 'var marker=' + JSON.stringify(marker) + ';' +
      'var cmd=[];Object.defineProperty(cmd,"0",{get:function(){fs.writeFileSync(marker,fs.readFileSync(target));process.emit("SIGINT");return process.execPath;}});cmd[1]=[];' +
      'sabotage.prove({file:target,command:cmd,cases:[{label:"interrupt fixture",find:"ORIGINAL",replace:"BROKEN"}]});');
    var output = out(result);
    if (result.status !== 130 || output.indexOf("after interrupt") < 0) return "interrupt verdict/status wrong: status=" + result.status + " " + output;
    if (!fs.existsSync(marker) || fs.readFileSync(marker, "utf8").indexOf("BROKEN") < 0) return "interrupt did not occur after mutation";
    return intact() ? "" : "interrupt left target sabotaged";
  });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (fail) { console.error("SABOTAGE META-SUITE: " + fail + " failed, " + pass + " passed"); process.exit(1); }
console.log("ALL GREEN — " + pass + " sabotage self-trust cases");
