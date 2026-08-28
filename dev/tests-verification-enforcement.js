// tests-verification-enforcement.js — #18 synthetic fixtures for stop-hook version drift,
// installed pre-commit parity, and the CI/pre-commit step topology. No live memory or hook
// state is read; every fixture lives in a disposable temp repo.
var fs = require("fs");
var os = require("os");
var path = require("path");
var cp = require("child_process");

var ROOT = path.join(__dirname, "..");
var STOP = path.join(ROOT, ".claude", "hooks", "stop-check.js");
var ES5 = path.join(ROOT, ".claude", "hooks", "es5-check.js");
var PARITY = path.join(__dirname, "check-hook-parity.js");
var ENFORCE = path.join(__dirname, "check-enforcement.js");
var pass = 0, fail = 0;

function run(cmd, args, opts) { return cp.spawnSync(cmd, args, Object.assign({ encoding: "utf8" }, opts || {})); }
function text(runResult) { return String(runResult.stdout || "") + String(runResult.stderr || ""); }
function test(name, fn) {
  try {
    var why = fn();
    if (why) { fail++; console.error("FAIL " + name + " — " + why); }
    else { pass++; console.log("PASS " + name); }
  } catch (e) { fail++; console.error("FAIL " + name + " — " + (e && e.stack || e)); }
}
function stopRun(root, mem, tmp, sid) {
  return run(process.execPath, [STOP], {
    input: JSON.stringify({ session_id: sid }),
    env: Object.assign({}, process.env, { TND_STOP_ROOT: root, TND_STOP_MEM: mem, TND_STOP_TMP: tmp })
  });
}
function es5Run(file, tmp, sid) {
  return run(process.execPath, [ES5], {
    input: JSON.stringify({ session_id: sid, tool_input: { file_path: file } }),
    env: Object.assign({}, process.env, { TND_HOOK_TMP: tmp })
  });
}
function git(root, args) {
  var env = Object.assign({}, process.env, { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "NUL" });
  var result = run("git", ["-C", root].concat(args), { env: env });
  if (result.status !== 0) throw new Error("git " + args.join(" ") + " failed: " + text(result));
  return result;
}

var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-enforcement-"));
try {
  var fakeRoot = path.join(tmp, "project");
  var fakeTmp = path.join(tmp, "markers");
  var fakeMem = path.join(tmp, "session_state.md");
  fs.mkdirSync(fakeRoot); fs.mkdirSync(fakeTmp);
  fs.writeFileSync(path.join(fakeRoot, "globals.js"), 'var APP_VERSION="v9.321";\n', "utf8");
  fs.writeFileSync(fakeMem, "**Current version:** v9.320\n", "utf8");

  test("stop hook reads globals.js rather than retired ui.js", function () {
    var source = fs.readFileSync(STOP, "utf8");
    if (source.indexOf('path.join(ROOT, "ui.js")') >= 0) return "retired ui.js branch still present";
    return source.indexOf('path.join(ROOT, "globals.js")') >= 0 ? "" : "globals.js APP_VERSION source missing";
  });
  test("stop hook reports a synthetic APP_VERSION mismatch and exits zero", function () {
    var result = stopRun(fakeRoot, fakeMem, fakeTmp, "version-mismatch");
    var out = text(result);
    if (result.status !== 0) return "blocked with exit " + result.status + ": " + out;
    if (out.indexOf("Version drift") < 0 || out.indexOf("v9.321") < 0 || out.indexOf("v9.320") < 0) return "mismatch not reported: " + out;
    if (out.indexOf("ask Claude to refresh memory/session_state.md.") < 0) return "actionable refresh guidance missing: " + out;
    if (out.indexOf("/memory") >= 0) return "nonexistent /memory command recommended: " + out;
    return "";
  });
  test("stop hook reports an unavailable version source instead of swallowing it", function () {
    var missingRoot = path.join(tmp, "missing-root"); fs.mkdirSync(missingRoot);
    var result = stopRun(missingRoot, fakeMem, fakeTmp, "missing-source");
    var out = text(result);
    if (result.status !== 0) return "blocked with exit " + result.status + ": " + out;
    return /unavailable|could not verify/i.test(out) ? "" : "missing source was silent: " + out;
  });
  test("ES5 hook rejects game const but permits modern dev tooling", function () {
    var game = path.join(fakeRoot, "client.js");
    var devDir = path.join(fakeRoot, "dev"); fs.mkdirSync(devDir);
    var tool = path.join(devDir, "tool.js");
    fs.writeFileSync(game, "const forbidden = 1;\n", "utf8");
    fs.writeFileSync(tool, "const allowed = 1;\n", "utf8");
    var bad = es5Run(game, fakeTmp, "es5-game"), good = es5Run(tool, fakeTmp, "es5-dev");
    if (bad.status !== 2 || text(bad).indexOf("ES5 VIOLATION") < 0) return "game const was not blocked: " + text(bad);
    return good.status === 0 ? "" : "dev tooling was incorrectly blocked: " + text(good);
  });
  test("ES5 touched log drives the stop warning and CLAUDE.md suppresses it", function () {
    fs.writeFileSync(fakeMem, "**Current version:** v9.321\n", "utf8");
    var game = path.join(fakeRoot, "client-ok.js"); fs.writeFileSync(game, "var ok = 1;\n", "utf8");
    var first = es5Run(game, fakeTmp, "touched-warn");
    if (first.status !== 0) return "valid game file blocked: " + text(first);
    var warned = stopRun(fakeRoot, fakeMem, fakeTmp, "touched-warn");
    if (warned.status !== 0 || text(warned).indexOf("Game .js was edited") < 0) return "touched warning missing: " + text(warned);
    es5Run(game, fakeTmp, "touched-spec");
    es5Run(path.join(fakeRoot, "CLAUDE.md"), fakeTmp, "touched-spec");
    var suppressed = stopRun(fakeRoot, fakeMem, fakeTmp, "touched-spec");
    return text(suppressed).indexOf("Game .js was edited") < 0 ? "" : "CLAUDE.md did not suppress the warning: " + text(suppressed);
  });

  var repo = path.join(tmp, "repo"); fs.mkdirSync(repo); fs.mkdirSync(path.join(repo, "dev"));
  git(repo, ["init", "-q"]);
  var tracked = "#!/bin/sh\necho gate\n";
  fs.writeFileSync(path.join(repo, "dev", "pre-commit"), tracked, "utf8");
  var hookDir = path.join(repo, ".git", "hooks");
  fs.writeFileSync(path.join(hookDir, "pre-commit"), tracked, "utf8");
  test("installed pre-commit byte parity passes", function () {
    var result = run(process.execPath, [PARITY, "--root", repo]);
    return result.status === 0 ? "" : text(result);
  });
  test("installed pre-commit byte drift blocks and names both copies", function () {
    fs.appendFileSync(path.join(hookDir, "pre-commit"), "echo stale\n", "utf8");
    var result = run(process.execPath, [PARITY, "--root", repo]);
    var out = text(result);
    fs.writeFileSync(path.join(hookDir, "pre-commit"), tracked, "utf8");
    if (result.status === 0) return "mismatched hook passed";
    return out.indexOf("dev/pre-commit") >= 0 && out.indexOf(".git") >= 0 ? "" : "targets not named: " + out;
  });

  test("CI/pre-commit topology rejects removal of every required enforcement step", function () {
    if (!fs.existsSync(ENFORCE)) return "check-enforcement.js is missing";
    var guard = require(ENFORCE);
    var workflow = "- uses: actions/checkout@v4\n- uses: actions/setup-node@v4\n  with:\n    node-version: 22\n- run: node dev/run-tests.js\n- run: node dev/check-sabotage-applicability.js\n- run: node dev/diff-replay.js dev/corpus_playtest_v1238.json --check\n- run: node dev/diff-replay.js dev/corpus_playtest_v1258.json --check\n- run: node dev/diff-replay.js dev/corpus_playtest_v1271.json --check\n- run: node dev/diff-replay.js dev/corpus_playtest_v1276.json --check\n- run: node dev/sabotage-w2.js --focused\n";
    var hook = "node dev/check-hook-parity.js\nnode dev/lint-todo.js --git-aware --staged\nnode dev/tests-todo-hygiene.js\nnode dev/check-shell-markers.js\nnode dev/run-tests.js\n";
    if (guard.workflowProblems(workflow).length) return "good workflow rejected: " + guard.workflowProblems(workflow).join("; ");
    if (guard.preCommitProblems(hook).length) return "good hook rejected: " + guard.preCommitProblems(hook).join("; ");
    var workflowNeedles = ["actions/checkout@v4", "actions/setup-node@v4", "node-version: 22", "node dev/run-tests.js", "node dev/check-sabotage-applicability.js", "node dev/diff-replay.js dev/corpus_playtest_v1238.json --check", "node dev/diff-replay.js dev/corpus_playtest_v1258.json --check", "node dev/diff-replay.js dev/corpus_playtest_v1271.json --check", "node dev/diff-replay.js dev/corpus_playtest_v1276.json --check", "node dev/sabotage-w2.js --focused"];
    for (var i = 0; i < workflowNeedles.length; i++) if (!guard.workflowProblems(workflow.replace(workflowNeedles[i], "REMOVED")).length) return "workflow removal passed: " + workflowNeedles[i];
    var hookNeedles = ["node dev/check-hook-parity.js", "--git-aware --staged", "node dev/tests-todo-hygiene.js", "node dev/check-shell-markers.js", "node dev/run-tests.js"];
    for (var j = 0; j < hookNeedles.length; j++) if (!guard.preCommitProblems(hook.replace(hookNeedles[j], "REMOVED")).length) return "hook removal passed: " + hookNeedles[j];
    return "";
  });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (fail) { console.error("VERIFICATION ENFORCEMENT: " + fail + " failed, " + pass + " passed"); process.exit(1); }
console.log("ALL GREEN — " + pass + " verification-enforcement fixtures");
