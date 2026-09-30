// tests-481-g6-ci-topology.js — #481 G6 (audit 2026-09-29, Fable-approved; built after G2): the CI-topology guard left the newer
// CI steps unpinned — the Chrome check, the weekly job, the git-identity tripwire — and the three blueprint browser suites never
// gated anything (they ran only when a sabotage battery happened to call them). Now:
//   • workflowProblems pins the Chrome check and the three browser suites after it (and G2's range steps);
//   • weeklyProblems pins sabotage-weekly.yml (full history, Node 22, the Chrome check, every battery under bash pipefail);
//   • the identity tripwire is dev/check-identity.js: the hook calls it for the committer, CI calls it with --ci over the push's
//     range for every commit's AUTHOR (cloud sessions commit with no hook at all).
//   node dev/tests-481-g6-ci-topology.js
const cp = require('child_process'), fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert/strict');
const root = path.join(__dirname, '..');
const enf = require('./check-enforcement.js');
const wf = fs.readFileSync(path.join(root, '.github/workflows/engine-tests.yml'), 'utf8');
const weekly = fs.readFileSync(path.join(root, '.github/workflows/sabotage-weekly.yml'), 'utf8');
const hook = fs.readFileSync(path.join(root, 'dev/pre-commit'), 'utf8');
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS #481 G6 ' + name); } catch (e) { failed++; console.error('FAIL #481 G6 ' + name + ' — ' + (e && e.message || e)); } }

test('the Chrome check and the three blueprint browser suites are CI steps, pinned in order', () => {
  assert.deepEqual(enf.workflowProblems(wf), [], 'the live workflow must satisfy every pin');
  ['run: node dev/cdp-browser.js --check', 'run: node dev/tests-blueprint-catalog-browser.js', 'run: node dev/tests-blueprint-editions-browser.js', 'run: node dev/tests-blueprint-publish-browser.js'].forEach(step => {
    assert.ok(wf.indexOf(step) > 0, 'missing step: ' + step);
    const cut = wf.replace(step, 'run: echo gone');
    assert.ok(enf.workflowProblems(cut).length > 0, 'removing "' + step + '" must trip a pin');
  });
  assert.ok(wf.indexOf('run: node dev/tests-blueprint-catalog-browser.js') > wf.indexOf('run: node dev/cdp-browser.js --check'), 'the browser suites run after the Chrome check');
});
test('weeklyProblems pins the weekly job: full history, Node 22, the Chrome check, every battery under bash', () => {
  assert.equal(typeof enf.weeklyProblems, 'function', 'weeklyProblems is missing');
  assert.deepEqual(enf.weeklyProblems(weekly), [], 'the live weekly workflow must satisfy every pin');
  [['fetch-depth: 0', 'fetch-depth: 2'], ['run: node dev/cdp-browser.js --check', 'run: echo gone'], ['shell: bash', 'shell: sh'], ['run: node dev/run-sabotage-all.js', 'run: echo gone'], ['node-version: 22', 'node-version: 20']].forEach(([from, to]) => {
    assert.ok(weekly.indexOf(from) >= 0, 'fixture: ' + from);
    assert.ok(enf.weeklyProblems(weekly.replace(from, to)).length > 0, 'weakening "' + from + '" must trip a pin');
  });
  assert.ok(enf.realProblems(root).length === 0, 'realProblems must pass on the live repo: ' + JSON.stringify(enf.realProblems(root)));
  const fake = fs.mkdtempSync(path.join(os.tmpdir(), 'tnd-g6-root-'));
  fs.mkdirSync(path.join(fake, '.github', 'workflows'), { recursive: true }); fs.mkdirSync(path.join(fake, 'dev'));
  fs.writeFileSync(path.join(fake, '.github/workflows/engine-tests.yml'), wf); fs.writeFileSync(path.join(fake, 'dev/pre-commit'), hook);
  fs.writeFileSync(path.join(fake, '.github/workflows/sabotage-weekly.yml'), weekly.replace('shell: bash', 'shell: sh'));
  assert.ok(enf.realProblems(fake).some(p => /sabotage-weekly/.test(p)), 'realProblems must fold the weekly pins in: ' + JSON.stringify(enf.realProblems(fake)));
});
function fixtureRepo(name, email) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tnd-g6-'));
  const g = args => cp.execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  g(['init', '-q']); g(['config', 'user.name', name]); g(['config', 'user.email', email]); g(['config', 'commit.gpgsign', 'false']);
  return { dir, g };
}
function identity(dir, args) { const r = cp.spawnSync(process.execPath, [path.join(root, 'dev/check-identity.js')].concat(args || []), { cwd: dir, encoding: 'utf8' }); return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }; }
test('check-identity.js: a fixture-looking committer is blocked, a real one passes', () => {
  assert.ok(fs.existsSync(path.join(root, 'dev/check-identity.js')), 'dev/check-identity.js is missing');
  const bad = fixtureRepo('Forensics Fixture', 'forensics@example.invalid');
  const r1 = identity(bad.dir); assert.notEqual(r1.code, 0, 'a fixture identity must block'); assert.match(r1.out, /TEST FIXTURE/);
  const ok = fixtureRepo('pmegow', 'pmegow@gmail.com');
  assert.equal(identity(ok.dir).code, 0, 'a real identity passes');
});
test('check-identity.js --ci RANGE fails a push that carries a fixture-authored commit, naming it', () => {
  const r = fixtureRepo('pmegow', 'pmegow@gmail.com');
  fs.writeFileSync(path.join(r.dir, 'a.txt'), '1'); r.g(['add', '-A']); r.g(['commit', '-q', '-m', 'real']); const c1 = r.g(['rev-parse', 'HEAD']);
  fs.writeFileSync(path.join(r.dir, 'a.txt'), '2'); r.g(['add', '-A']); r.g(['-c', 'user.name=Forensics Fixture', '-c', 'user.email=forensics@example.invalid', 'commit', '-q', '-m', 'leaked']); const c2 = r.g(['rev-parse', 'HEAD']);
  const o = identity(r.dir, ['--ci', c1 + '..HEAD']);
  assert.notEqual(o.code, 0, 'a fixture-authored commit passed CI: ' + o.out);
  assert.ok(o.out.indexOf(c2.slice(0, 7)) >= 0, 'the commit must be named: ' + o.out);
  assert.equal(identity(r.dir, ['--ci', '']).code, 0, 'no range = nothing to check (said, exit 0)');
});
test('the hook and CI both call dev/check-identity.js; the inline case block is gone; the coverage pin holds', () => {
  assert.ok(/^node [^\n]*dev\/check-identity\.js"?\s*\|\|/m.test(hook), 'the hook must CALL dev/check-identity.js (its comment naming the file is not a call)');
  assert.ok(!/case "\$ci_name\|\$ci_email"/.test(hook), 'the inline identity case block must be gone from the hook');
  assert.ok(wf.indexOf('run: node dev/check-identity.js --ci "$CI_RANGE"') > wf.indexOf('run: node dev/ci-range.js --github-env'), 'CI must check every pushed commit\'s author over the range');
  assert.deepEqual(enf.coverageProblems(wf, hook), [], 'every hook gate must also run in CI');
  assert.deepEqual(enf.preCommitProblems(hook), [], 'the hook pins must hold');
});
// The G6 class, second instance: the F4, F10 and G3 browser halves landed after G6 and ran only inside their batteries — the very
// gap G6 closed for the blueprint suites. Enumerate the class instead of pinning a fourth, fifth and sixth name by hand: every
// dev/tests-*.js that really requires the CDP driver must be a CI step after the Chrome check.
const DRIVER_REQUIRE = "require('./cdp-" + "browser.js')";   /* built, so this file's own text is never a real require */
test('every real-browser suite is a CI step after the Chrome check, derived from the source (the G6 class)', () => {
  assert.equal(typeof enf.browserSuiteNames, 'function', 'browserSuiteNames is missing');
  assert.equal(typeof enf.browserSuiteProblems, 'function', 'browserSuiteProblems is missing');
  const names = enf.browserSuiteNames(root);
  ['tests-blueprint-catalog-browser.js', 'tests-blueprint-editions-browser.js', 'tests-blueprint-publish-browser.js', 'tests-481-f4-home-return.js', 'tests-481-f10-editor-browser.js', 'tests-481-g3-todo-viewer-browser.js']
    .forEach(n => assert.ok(names.indexOf(n) >= 0, 'the derivation missed the browser suite ' + n + ': ' + JSON.stringify(names)));
  ['tests-252-retained-proof-wiring.js', 'tests-verification-enforcement.js', 'tests-481-g6-ci-topology.js']
    .forEach(n => assert.ok(names.indexOf(n) < 0, 'a file that only mentions the driver is not a browser suite: ' + n));
  assert.deepEqual(enf.browserSuiteProblems(wf, names), [], 'the live workflow must run every browser suite');
  names.forEach(n => {
    const p = enf.browserSuiteProblems(wf.replace('run: node dev/' + n, 'run: echo gone'), names);
    assert.ok(p.some(x => x.indexOf(n) >= 0), 'removing ' + n + ' from CI must be named: ' + JSON.stringify(p));
  });
  const early = wf.replace('\n      - name: Chrome launches', '\n      - run: node dev/tests-zz-early-browser.js\n      - name: Chrome launches');
  assert.ok(enf.browserSuiteProblems(early, ['tests-zz-early-browser.js']).some(x => /before the Chrome check/.test(x)), 'a browser suite before the Chrome check must be named');
  const fake = fs.mkdtempSync(path.join(os.tmpdir(), 'tnd-g6-browser-'));
  fs.mkdirSync(path.join(fake, '.github', 'workflows'), { recursive: true }); fs.mkdirSync(path.join(fake, 'dev'));
  fs.writeFileSync(path.join(fake, '.github/workflows/engine-tests.yml'), wf); fs.writeFileSync(path.join(fake, 'dev/pre-commit'), hook);
  fs.writeFileSync(path.join(fake, '.github/workflows/sabotage-weekly.yml'), weekly);
  fs.writeFileSync(path.join(fake, 'dev/tests-zz-new-browser.js'), 'const { chromium } = ' + DRIVER_REQUIRE + ';\n');
  fs.writeFileSync(path.join(fake, 'dev/tests-zz-mention.js'), '// drives nothing; names dev/cdp-browser.js in prose only\n');
  const real = enf.realProblems(fake);
  assert.ok(real.some(p => /tests-zz-new-browser\.js/.test(p)), 'realProblems must fold the browser-suite check in: ' + JSON.stringify(real));
  assert.ok(!real.some(p => /tests-zz-mention\.js/.test(p)), 'a prose mention is not a suite: ' + JSON.stringify(real));
});
console.log('#481 G6 CI TOPOLOGY: ' + failed + ' failed, ' + passed + ' passed');
process.exit(failed ? 1 : 0);
