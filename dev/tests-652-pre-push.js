// dev/tests-652-pre-push.js — #652: a red browser suite never reaches master. The tracked pre-push runs
// dev/run-browser-suites.js; the runner derives its list the way check-enforcement does (every dev/tests-*.js that
// requires ./cdp-browser.js — nothing else runs), turns red on one failing suite with its name and tail, says loudly
// when there is no Chrome and lets the push through; check-hook-parity requires the installed pre-push wherever the
// tracked one exists and asks nothing where it does not (the hygiene fixtures).
//   node dev/tests-652-pre-push.js
var assert = require("assert/strict"), fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
var ROOT = path.join(__dirname, "..");
var RUNNER = path.join(__dirname, "run-browser-suites.js");
var PARITY = path.join(__dirname, "check-hook-parity.js");
var runner = require("./run-browser-suites.js");
var enforcement = require("./check-enforcement.js");
var parity = require("./check-hook-parity.js");
var passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS #652 " + name); } catch (e) { process.exitCode = 1; console.error("FAIL #652 " + name + " — " + e.stack); } }
function text(r) { return String(r.stdout || "") + String(r.stderr || ""); }
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-652-"));

// a fixture tree: two Chrome-driven suites (one green, one red) and a plain test that must never run
function fixture(name, redB) {
  var root = path.join(tmp, name); fs.mkdirSync(path.join(root, "dev"), { recursive: true });
  var marker = JSON.stringify(path.join(root, "ran.txt"));
  /* the driver require is assembled in two halves: written whole, the textual derivation would count THIS file as a browser suite */
  var head = "/* a real-looking driver require, so the derivation counts this file: " + "require('./cdp-" + "browser.js') */\nrequire('fs').appendFileSync(" + marker + ", __filename + '\\n');\n";
  fs.writeFileSync(path.join(root, "dev", "tests-a-browser.js"), head + "console.log('a green');\n");
  fs.writeFileSync(path.join(root, "dev", "tests-b-browser.js"), head + (redB ? "console.error('b is red: the ledger did not open');\nprocess.exit(1);\n" : "console.log('b green');\n"));
  fs.writeFileSync(path.join(root, "dev", "tests-c-plain.js"), "require('fs').appendFileSync(" + marker + ", __filename + '\\n');\nprocess.exit(1);\n");
  return root;
}
function ran(root) { try { return fs.readFileSync(path.join(root, "ran.txt"), "utf8").split(/\r?\n/).filter(Boolean).map(function (f) { return path.basename(f); }); } catch (e) { return []; } }

test("the tracked pre-push runs the browser suites and blocks the push when they are red", function () {
  var hook = fs.readFileSync(path.join(ROOT, "dev", "pre-push"), "utf8");
  assert.match(hook, /^#!\/bin\/sh/);
  assert.match(hook, /TOP="\$\(git rev-parse --show-toplevel\)"/);
  assert.match(hook, /node "\$TOP\/dev\/run-browser-suites\.js" \|\| \{/);
  assert.match(hook, /exit 1/);
  assert.match(hook, /cp dev\/pre-push \.git\/hooks\/pre-push/, "the install line is in the header");
});

test("only the Chrome-driven suites run — the list is check-enforcement's derivation, and it holds the real ones", function () {
  var mine = runner.suites(ROOT), theirs = enforcement.browserSuiteNames(ROOT);
  assert.deepEqual(mine, theirs);
  ["tests-615-signup-browser.js", "tests-501-shop-button-browser.js", "tests-blueprint-editions-browser.js"].forEach(function (n) { assert.ok(mine.indexOf(n) >= 0, n + " is in the list"); });
  assert.equal(mine.indexOf("tests-646-ci-status.js"), -1, "a node-only suite is not in the list");
  var listed = cp.spawnSync(process.execPath, [RUNNER, "--list"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(listed.status, 0);
  assert.deepEqual(listed.stdout.trim().split(/\r?\n/), mine);
  assert.deepEqual(runner.suites(ROOT, "501"), ["tests-501-shop-button-browser.js"], "--only narrows by file name");
});

test("a failing suite turns the run red: exit 1, its name and its tail in the output, the green one still reported", function () {
  var root = fixture("red", true);
  var r = cp.spawnSync(process.execPath, [RUNNER, "--root", root], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 1, text(r));
  assert.match(r.stdout, /^PASS tests-a-browser\.js  [\d.]+s$/m);
  assert.match(r.stdout, /^FAIL tests-b-browser\.js  [\d.]+s$/m);
  assert.match(r.stdout, /b is red: the ledger did not open/, "the red suite's tail is printed");
  assert.match(r.stdout, /BROWSER SUITES RED — 1 of 2 failed in \d+s: tests-b-browser\.js/);
  assert.doesNotMatch(r.stdout, /tests-c-plain/, "the plain test is neither run nor mentioned");
  assert.deepEqual(ran(root).sort(), ["tests-a-browser.js", "tests-b-browser.js"]);
});

test("all green: exit 0 and one summary line", function () {
  var root = fixture("green", false);
  var r = cp.spawnSync(process.execPath, [RUNNER, "--root", root], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, text(r));
  assert.match(r.stdout, /BROWSER SUITES GREEN — 2 suites in \d+s/);
  assert.doesNotMatch(r.stdout, /FAIL /);
});

test("no Chrome is said on one loud line, nothing runs, and the push is let through (exit 0)", function () {
  var root = fixture("nochrome", true);
  var env = Object.assign({}, process.env, { CHROME_PATH: path.join(tmp, "no-such-chrome.exe") });
  var r = cp.spawnSync(process.execPath, [RUNNER, "--root", root], { cwd: ROOT, encoding: "utf8", env: env });
  assert.equal(r.status, 0, text(r));
  assert.match(r.stderr, /BROWSER SUITES NOT RUN — no Chrome on this machine \(CHROME_PATH=.*no-such-chrome\.exe does not exist\); the 2 suites were not verified here\. CI runs them on every push\./);
  assert.doesNotMatch(r.stdout, /PASS |FAIL |GREEN|RED/);
  assert.deepEqual(ran(root), [], "no suite ran");
});

test("a missing installed pre-push fails parity by name; both installed pass; no tracked pre-push asks nothing", function () {
  var repo = path.join(tmp, "repo"); fs.mkdirSync(path.join(repo, "dev"), { recursive: true });
  assert.equal(cp.spawnSync("git", ["-C", repo, "init", "-q"], { encoding: "utf8" }).status, 0);
  var hookDir = path.join(repo, ".git", "hooks");
  fs.writeFileSync(path.join(repo, "dev", "pre-commit"), "#!/bin/sh\necho gate\n");
  fs.writeFileSync(path.join(hookDir, "pre-commit"), "#!/bin/sh\necho gate\n");
  var none = parity.inspect(repo);
  assert.equal(none.ok, true, none.message);
  assert.equal(none.hooks[1].absent, true, "no tracked pre-push: nothing to compare");
  fs.writeFileSync(path.join(repo, "dev", "pre-push"), "#!/bin/sh\necho push-gate\n");
  var missing = parity.inspect(repo);
  assert.equal(missing.ok, false);
  assert.match(missing.message, /installed pre-push is missing: .*hooks\/pre-push \(copy dev\/pre-push into it\)/);
  var cli = cp.spawnSync(process.execPath, [PARITY, "--root", repo], { encoding: "utf8" });
  assert.equal(cli.status, 1);
  assert.match(text(cli), /HOOK PARITY FAILED — installed pre-push is missing/);
  fs.writeFileSync(path.join(hookDir, "pre-push"), "#!/bin/sh\necho push-gate\n");
  var both = parity.inspect(repo);
  assert.equal(both.ok, true, both.message);
  assert.match(both.message, /installed pre-commit matches dev\/pre-commit byte-for-byte/);
  assert.match(both.message, /installed pre-push matches dev\/pre-push byte-for-byte/);
  fs.appendFileSync(path.join(hookDir, "pre-push"), "echo stale\n");
  var drift = parity.inspect(repo);
  assert.equal(drift.ok, false);
  assert.match(drift.message, /installed pre-push differs from dev\/pre-push/);
});

test("a checkout without the runner (a worktree based before #652) is told so and the push goes through", function () {
  var sh = cp.spawnSync("sh", ["-c", "echo ok"], { encoding: "utf8" });
  if (sh.status !== 0) { console.log("  (no sh on this machine — the hook's shell path is not exercised here)"); return; }
  var repo = path.join(tmp, "old-checkout"); fs.mkdirSync(path.join(repo, "dev"), { recursive: true });
  assert.equal(cp.spawnSync("git", ["-C", repo, "init", "-q"], { encoding: "utf8" }).status, 0);
  var hook = path.join(repo, "pre-push.sh"); fs.copyFileSync(path.join(ROOT, "dev", "pre-push"), hook);
  var r = cp.spawnSync("sh", [hook], { cwd: repo, encoding: "utf8" });
  assert.equal(r.status, 0, text(r));
  assert.match(r.stderr, /has no dev\/run-browser-suites\.js \(a checkout from before #652\) — the browser suites were NOT run here; CI runs them on every push\./);
  assert.doesNotMatch(text(r), /Push blocked|Cannot find module/);
});

test("this repo's own pre-push is tracked and registered: the standalone list runs this suite", function () {
  assert.ok(fs.existsSync(path.join(ROOT, "dev", "pre-push")));
  assert.ok(fs.readFileSync(path.join(ROOT, "dev", "run-standalone-suites.js"), "utf8").indexOf("dev/tests-652-pre-push.js") >= 0, "tests-652 is in run-standalone-suites.js");
});

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* a Chrome profile may still hold a handle; the OS temp sweep gets it */ }
if (!process.exitCode) console.log("ALL GREEN — " + passed + " #652 pre-push assertions");
