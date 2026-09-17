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
var MARKERS = path.join(__dirname, "check-shell-markers.js");
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

  // #G1 (2026-09-18): the workflow fixture grew the three hook gates that had never crossed to CI.
  var GOOD_WORKFLOW = "- uses: actions/checkout@v4\n- uses: actions/setup-node@v4\n  with:\n    node-version: 22\n- run: node dev/lint-todo.js --git-aware --cap\n- run: node dev/tests-todo-hygiene.js\n- run: node dev/check-shell-markers.js --ci\n- run: node dev/run-tests.js\n- run: node dev/check-sabotage-applicability.js\n- run: node dev/diff-replay.js dev/corpus_playtest_v1238.json --check\n- run: node dev/diff-replay.js dev/corpus_playtest_v1258.json --check\n- run: node dev/diff-replay.js dev/corpus_playtest_v1271.json --check\n- run: node dev/diff-replay.js dev/corpus_playtest_v1276.json --check\n- run: node dev/sabotage-w2.js --focused\n";
  var GOOD_HOOK = "node dev/check-hook-parity.js\nnode dev/lint-todo.js --git-aware --staged\nnode dev/tests-todo-hygiene.js\nnode dev/check-shell-markers.js\nnode dev/run-tests.js\n";

  test("CI/pre-commit topology rejects removal of every required enforcement step", function () {
    if (!fs.existsSync(ENFORCE)) return "check-enforcement.js is missing";
    var guard = require(ENFORCE);
    if (guard.workflowProblems(GOOD_WORKFLOW).length) return "good workflow rejected: " + guard.workflowProblems(GOOD_WORKFLOW).join("; ");
    if (guard.preCommitProblems(GOOD_HOOK).length) return "good hook rejected: " + guard.preCommitProblems(GOOD_HOOK).join("; ");
    var workflowNeedles = ["actions/checkout@v4", "actions/setup-node@v4", "node-version: 22", "node dev/lint-todo.js --git-aware --cap", "node dev/tests-todo-hygiene.js", "node dev/check-shell-markers.js --ci", "node dev/run-tests.js", "node dev/check-sabotage-applicability.js", "node dev/diff-replay.js dev/corpus_playtest_v1238.json --check", "node dev/diff-replay.js dev/corpus_playtest_v1258.json --check", "node dev/diff-replay.js dev/corpus_playtest_v1271.json --check", "node dev/diff-replay.js dev/corpus_playtest_v1276.json --check", "node dev/sabotage-w2.js --focused"];
    for (var i = 0; i < workflowNeedles.length; i++) if (!guard.workflowProblems(GOOD_WORKFLOW.replace(workflowNeedles[i], "REMOVED")).length) return "workflow removal passed: " + workflowNeedles[i];
    var hookNeedles = ["node dev/check-hook-parity.js", "--git-aware --staged", "node dev/tests-todo-hygiene.js", "node dev/check-shell-markers.js", "node dev/run-tests.js"];
    for (var j = 0; j < hookNeedles.length; j++) if (!guard.preCommitProblems(GOOD_HOOK.replace(hookNeedles[j], "REMOVED")).length) return "hook removal passed: " + hookNeedles[j];
    return "";
  });

  // ── #G1: the derived hook→CI coverage rule ────────────────────────────────────────────────
  // The two ordered lists above are hand-written, and that is how CI came to run one of five
  // gates. coverageProblems reads the HOOK and requires each dev/<tool>.js it invokes to appear
  // in the workflow, so adding a gate to the hook alone is a build failure, not a silent gap.
  test("#G1 a gate added to the hook but not to CI fails the topology check", function () {
    var guard = require(ENFORCE);
    if (guard.coverageProblems(GOOD_WORKFLOW, GOOD_HOOK).length)
      return "the shipped-shape pair was rejected: " + guard.coverageProblems(GOOD_WORKFLOW, GOOD_HOOK).join("; ");
    var grown = GOOD_HOOK + "node dev/check-brand-new-gate.js\n";
    var problems = guard.coverageProblems(GOOD_WORKFLOW, grown);
    if (!problems.length) return "a hook-only gate passed — the coverage rule is vacuous";
    if (problems.join(" ").indexOf("check-brand-new-gate.js") < 0) return "the problem does not name the missing gate: " + problems.join("; ");
    if (guard.coverageProblems(GOOD_WORKFLOW + "- run: node dev/check-brand-new-gate.js\n", grown).length)
      return "adding the step to CI did not clear the problem";
    return "";
  });
  test("#G1 dropping a crossed gate from CI alone fails the topology check", function () {
    var guard = require(ENFORCE);
    var stripped = GOOD_WORKFLOW.replace("- run: node dev/check-shell-markers.js --ci\n", "");
    var problems = guard.coverageProblems(stripped, GOOD_HOOK);
    if (!problems.length) return "removing the shell-marker step from CI passed";
    return problems.join(" ").indexOf("check-shell-markers.js") >= 0 ? "" : "the problem does not name it: " + problems.join("; ");
  });
  test("#G1 check-hook-parity is exempt, and every exemption carries a reason", function () {
    var guard = require(ENFORCE);
    if (!guard.HOOK_ONLY["check-hook-parity.js"]) return "check-hook-parity.js lost its exemption — CI has no installed hook, so requiring it there breaks every run";
    var names = Object.keys(guard.HOOK_ONLY);
    for (var i = 0; i < names.length; i++)
      if (typeof guard.HOOK_ONLY[names[i]] !== "string" || guard.HOOK_ONLY[names[i]].length < 20)
        return "exemption '" + names[i] + "' has no usable reason";
    return "";
  });
  test("#G1 realProblems folds the coverage rule in, not just the two ordered lists", function () {
    var guard = require(ENFORCE);
    var fakeRoot = path.join(tmp, "topology");
    fs.mkdirSync(path.join(fakeRoot, ".github", "workflows"), { recursive: true });
    fs.mkdirSync(path.join(fakeRoot, "dev"), { recursive: true });
    var yml = path.join(fakeRoot, ".github", "workflows", "engine-tests.yml");
    var hookFile = path.join(fakeRoot, "dev", "pre-commit");
    fs.writeFileSync(yml, GOOD_WORKFLOW, "utf8");
    fs.writeFileSync(hookFile, GOOD_HOOK, "utf8");
    if (guard.realProblems(fakeRoot).length) return "the shipped-shape pair was rejected: " + guard.realProblems(fakeRoot).join("; ");
    fs.writeFileSync(hookFile, GOOD_HOOK + "node dev/check-brand-new-gate.js\n", "utf8");
    var problems = guard.realProblems(fakeRoot);
    if (!problems.length) return "realProblems ignored a hook-only gate — the coverage rule is not wired into the real check";
    return problems.join(" ").indexOf("check-brand-new-gate.js") >= 0 ? "" : "the problem does not name the missing gate: " + problems.join("; ");
  });
  test("#G1 hookGateNames reads the gates out of the REAL pre-commit, in order", function () {
    var guard = require(ENFORCE);
    var names = guard.hookGateNames(fs.readFileSync(path.join(ROOT, "dev", "pre-commit"), "utf8"));
    var want = ["check-hook-parity.js", "lint-todo.js", "tests-todo-hygiene.js", "check-shell-markers.js", "run-tests.js"];
    if (names.join(",") !== want.join(",")) return "got [" + names.join(",") + "], want [" + want.join(",") + "]";
    return "";
  });

  // ── #G1: check-shell-markers' commit-range mode (the APP_VERSION/CACHE hard rule in CI) ────
  // A synthetic repo, because the real history has no un-bumped shell change to point at — and a
  // gate is only proven by the input that must break it.
  var shellRepo = path.join(tmp, "shell"); fs.mkdirSync(shellRepo);
  var shellEnv = Object.assign({}, process.env);
  ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_PREFIX"].forEach(function (k) { delete shellEnv[k]; });
  function shellWrite(version, cache, body) {
    fs.writeFileSync(path.join(shellRepo, "globals.js"), 'var APP_VERSION="' + version + '";\n', "utf8");
    fs.writeFileSync(path.join(shellRepo, "sw.js"), 'var CACHE="' + cache + '";\nvar APP_SHELL = ["index.html","globals.js","sw.js"];\n', "utf8");
    fs.writeFileSync(path.join(shellRepo, "index.html"), body, "utf8");
  }
  function shellCommit(msg) {
    git(shellRepo, ["add", "globals.js", "sw.js", "index.html"]);
    git(shellRepo, ["-c", "user.name=T", "-c", "user.email=t@example.com", "commit", "-q", "-m", msg]);
    return String(git(shellRepo, ["rev-parse", "HEAD"]).stdout || "").trim();
  }
  function markersRun(args) { return run(process.execPath, [MARKERS].concat(args || []), { cwd: shellRepo, env: shellEnv }); }
  git(shellRepo, ["init", "-q"]);
  shellWrite("v1.900", "tnd-v1.900", "<html>base</html>");
  var shellA = shellCommit("base");
  shellWrite("v1.900", "tnd-v1.900", "<html>edited shell asset, no bump</html>");
  var shellB = shellCommit("shell asset edited, markers untouched");

  test("#G1 --ci blocks a pushed shell-asset change that bumped neither marker", function () {
    var result = markersRun(["--range", shellA + ".." + shellB]);
    var out = text(result);
    if (result.status === 0) return "an un-bumped shell change passed: " + out;
    if (out.indexOf("index.html") < 0) return "the changed asset is not named: " + out;
    if (out.indexOf("APP_VERSION") < 0 || out.indexOf("CACHE") < 0) return "both markers must be named: " + out;
    return "";
  });
  test("#G1 --ci passes once both markers move with the shell asset", function () {
    shellWrite("v1.901", "tnd-v1.901", "<html>edited again, bumped</html>");
    var shellC = shellCommit("shell asset edited WITH both markers bumped");
    var result = markersRun(["--range", shellB + ".." + shellC]);
    return result.status === 0 ? "" : "a correctly bumped change was blocked: " + text(result);
  });
  test("#G1 --ci says it could not run rather than inventing a verdict with no base revision", function () {
    var lone = path.join(tmp, "lone"); fs.mkdirSync(lone);
    var loneEnv = shellEnv;
    git(lone, ["init", "-q"]);
    fs.writeFileSync(path.join(lone, "globals.js"), 'var APP_VERSION="v1.900";\n', "utf8");
    fs.writeFileSync(path.join(lone, "sw.js"), 'var CACHE="c";\nvar APP_SHELL = ["globals.js"];\n', "utf8");
    git(lone, ["add", "globals.js", "sw.js"]);
    git(lone, ["-c", "user.name=T", "-c", "user.email=t@example.com", "commit", "-q", "-m", "only commit"]);
    var result = run(process.execPath, [MARKERS, "--ci"], { cwd: lone, env: loneEnv });
    var out = text(result);
    if (result.status !== 0) return "a checkout with no HEAD~1 was treated as a failure: " + out;
    return /nothing to compare/.test(out) ? "" : "the skip was silent: " + JSON.stringify(out);
  });
  test("#G1 the staging-area mode still blocks after the range-mode refactor", function () {
    fs.writeFileSync(path.join(shellRepo, "index.html"), "<html>staged, unbumped</html>", "utf8");
    git(shellRepo, ["add", "index.html"]);
    var result = markersRun([]);
    var out = text(result);
    git(shellRepo, ["reset", "-q", "HEAD"]);
    if (result.status === 0) return "an un-bumped staged shell change passed: " + out;
    return out.indexOf("index.html") >= 0 ? "" : "the changed asset is not named: " + out;
  });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (fail) { console.error("VERIFICATION ENFORCEMENT: " + fail + " failed, " + pass + " passed"); process.exit(1); }
console.log("ALL GREEN — " + pass + " verification-enforcement fixtures");
