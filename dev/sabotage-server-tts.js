// sabotage-server-tts.js — N05 retained proof for SERVER TTS source clauses 1–6.
// Every mutation lands in a disposable local clone; the voice/game sources in this lane's
// working tree are read-only.
var fs = require("fs");
var os = require("os");
var path = require("path");
var cp = require("child_process");

var ROOT = path.join(__dirname, "..");
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-server-tts-proof-"));
var cases = [
  { file: "tts.js", label: "zero-wasm server tier", mustFail: "touches the local wasm engine",
    find: "async function _speakServer(text, voiceId, voices) {\n    var myEpoch",
    replace: "async function _speakServer(text, voiceId, voices) {\n    _piperInit();\n    var myEpoch" },
  { file: "tts.js", label: "server tier bypasses local governor", mustFail: "consults the governor",
    find: "async function _speakServer(text, voiceId, voices) {\n    var myEpoch",
    replace: "async function _speakServer(text, voiceId, voices) {\n    _piperGovern();\n    var myEpoch" },
  { file: "tts.js", label: "mid-read remainder handoff", mustFail: "mid-read remainder handoff",
    find: "_queue.unshift({ text: _remText, piper: true",
    replace: "_queue.push({ text: _remText, piper: true" },
  { file: "tts.js", label: "native falls off the ladder's end (the only unconditional rung)", mustFail: "no longer the LAST rung",/* #218 stale-target repair: the ladder gained gemini (#41) and the contract error was reworded — the old server/piper swap would not even red today */
    find: 'var TTS_LADDER = ["gemini", "server", "piper", "native"]',
    replace: 'var TTS_LADDER = ["gemini", "server", "native", "piper"]' },
  { file: "tts.js", label: "voice audition stays on server tier", mustFail: "testVoice no longer auditions",
    find: "_queue.push({ text: TTS_TEST_LINE, server: true, voiceId: v });",
    replace: "_queue.push({ text: TTS_TEST_LINE, piper: true, voiceId: v });" },
  { file: "game.js", label: "send gesture prewarms server", mustFail: "sendAction no longer prewarms",
    find: 'if(typeof TTS!=="undefined"&&typeof TTS.prewarmServer==="function")TTS.prewarmServer();',
    replace: 'if(typeof TTS!=="undefined"&&false)TTS.prewarmServer();' }
];

function output(run) { return String(run.stdout || "") + String(run.stderr || ""); }
var failed = 0;
try {
  var clone = cp.spawnSync("git", ["-c", "safe.directory=" + ROOT, "-c", "safe.directory=" + path.join(ROOT, ".git"),
    "clone", "--quiet", "--no-hardlinks", ROOT, tmp], { encoding: "utf8" });
  if (clone.status !== 0) throw new Error("scratch clone failed: " + output(clone));
  // Exercise the working contract, not merely the last committed copy in the scratch clone.
  fs.copyFileSync(path.join(__dirname, "run-tests.js"), path.join(tmp, "dev", "run-tests.js"));
  for (var i = 0; i < cases.length; i++) {
    var c = cases[i], target = path.join(tmp, c.file);
    var original = fs.readFileSync(target, "utf8");
    var changed = original.replace(c.find, c.replace);
    if (changed === original) { failed++; console.error("✗ NOT APPLIED " + c.label); continue; }
    fs.writeFileSync(target, changed, "utf8");
    var run = cp.spawnSync(process.execPath, ["dev/run-tests.js"], { cwd: tmp, encoding: "utf8" });
    fs.writeFileSync(target, original, "utf8");
    var restored = fs.readFileSync(target, "utf8") === original;
    var out = output(run);
    if (run.status === 0 || out.indexOf(c.mustFail) < 0 || !restored) {
      failed++;
      console.error("✗ " + (run.status === 0 ? "MISSED" : "MISATTRIBUTED") + " " + c.label +
        " — expected named failure " + JSON.stringify(c.mustFail) + "; restored=" + restored + "\n" + out);
    } else console.log("✓ caught " + c.label + " — " + c.mustFail + "; restored byte-identical");
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (failed) { console.error("SERVER TTS SABOTAGE: " + failed + " failure(s)"); process.exit(1); }
console.log("ALL GREEN — 6/6 SERVER TTS clauses mutation-proven");
