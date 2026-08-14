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
  test("MISATTRIBUTED rejects an unrelated red and restores bytes", function () {
    reset();
    var result = runChild("misattributed", prelude() +
      'process.exit(sabotage.prove({file:target,command:[process.execPath,["-e","console.error(\\"WRONG RED\\");process.exit(1)"]],cases:[{label:"wrong-red fixture",find:"ORIGINAL",replace:"BROKEN",mustFail:"RIGHT RED"}]}));');
    if (result.status === 0 || out(result).indexOf("MISATTRIBUTED") < 0 || out(result).indexOf("RIGHT RED") < 0) return "verdict/status wrong: " + out(result);
    return intact() ? "" : "target bytes changed";
  });
  test("repo-relative mutations stay inside a disposable clone", function () {
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
