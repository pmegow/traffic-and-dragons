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
