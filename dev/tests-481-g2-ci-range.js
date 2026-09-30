// tests-481-g2-ci-range.js — #481 G2 (audit 2026-09-29, Fable-approved with changes): CI checked only the LAST commit of each
// push. Every range gate diffed HEAD~1..HEAD, so a code commit pushed under a docs commit (the archive ritual makes that
// routine) skipped the version-bump check, the tracker check and the mutation proofs — 29d92c5 carried the #454 fix under an
// archive commit and CI ran 0 of the 12 batteries it needed. Now dev/ci-range.js computes ONE base per run (a PR's base.sha;
// a push's event.before when non-zero and reachable, via merge-base; else the merge-base with origin/master; else HEAD~1),
// dev/ci-per-commit.js runs check-shell-markers and lint-todo once PER COMMIT of that range, and run-sabotage-diff gets the
// range once. Fixture git repos in the OS temp dir; the real scripts.
//   node dev/tests-481-g2-ci-range.js
const cp = require('child_process'), fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert/strict');
const root = path.join(__dirname, '..');
const TOOL = f => path.join(root, 'dev', f);
function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tnd-g2-'));
  const g = args => cp.execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const write = (f, s) => fs.writeFileSync(path.join(dir, f), s);
  const commit = msg => { g(['add', '-A']); g(['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', msg]); return g(['rev-parse', 'HEAD']); };
  g(['init', '-q']);
  write('sw.js', 'var CACHE = "c1";\nvar APP_SHELL = ["/a.js"];\n'); write('globals.js', 'var APP_VERSION="v1";\n'); write('a.js', '1\n'); write('README.md', 'x\n');
  const c1 = commit('base');
  return { dir, g, write, commit, c1 };
}
function run(dir, file, args, env) {
  const r = cp.spawnSync(process.execPath, [TOOL(file)].concat(args || []), { cwd: dir, encoding: 'utf8', env: Object.assign({}, process.env, env || {}) });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS #481 G2 ' + name); } catch (e) { failed++; console.error('FAIL #481 G2 ' + name + ' — ' + (e && e.message || e)); } }

test('the repro: a shell change with no bump pushed under a docs-only commit — HEAD~1..HEAD passes, every commit of the push fails at the code commit', () => {
  const r = repo();
  r.write('a.js', '2\n'); const c2 = r.commit('code without a bump');
  r.write('README.md', 'y\n'); r.commit('docs only');
  assert.equal(run(r.dir, 'check-shell-markers.js', ['--ci']).code, 0, 'fixture: the old HEAD~1..HEAD mode is blind to the code commit');
  assert.ok(fs.existsSync(TOOL('ci-per-commit.js')), 'dev/ci-per-commit.js is missing');
  const per = run(r.dir, 'ci-per-commit.js', [r.c1 + '..HEAD', '--', process.execPath, TOOL('check-shell-markers.js'), '--ci', '--range', '{parent}..{commit}']);
  assert.notEqual(per.code, 0, 'the per-commit run passed a push that hides an unbumped shell change: ' + per.out);
  assert.ok(per.out.indexOf(c2.slice(0, 7)) >= 0, 'the failure must name the commit: ' + per.out);
});
test('ci-range picks ONE base: a PR\'s base.sha; a push\'s event.before via merge-base; else origin/master\'s merge-base; else HEAD~1 — never an empty range', () => {
  assert.ok(fs.existsSync(TOOL('ci-range.js')), 'dev/ci-range.js is missing');
  const r = repo();
  r.write('a.js', '2\n'); const c2 = r.commit('two'); r.write('a.js', '3\n'); const c3 = r.commit('three');
  const ev = (name, payload) => { const p = path.join(r.dir, '..', path.basename(r.dir) + '-event.json'); fs.writeFileSync(p, JSON.stringify(payload)); return { GITHUB_EVENT_NAME: name, GITHUB_EVENT_PATH: p, GITHUB_ENV: '' }; };
  const base = env => { const o = run(r.dir, 'ci-range.js', ['--print-base'], env); assert.equal(o.code, 0, o.out); return o.out.trim().split(/\s+/)[0]; };
  assert.equal(base(ev('pull_request', { pull_request: { base: { sha: r.c1 } } })), r.c1, 'a PR checks from its base');
  assert.equal(base(ev('push', { before: r.c1 })), r.c1, 'a push checks from event.before');
  assert.equal(base(ev('push', { before: '0000000000000000000000000000000000000000' })), c2, 'a new branch with no origin/master falls to HEAD~1');
  r.g(['update-ref', 'refs/remotes/origin/master', r.c1]);
  assert.equal(base(ev('push', { before: '0000000000000000000000000000000000000000' })), r.c1, 'a new branch checks from its merge-base with origin/master');
  assert.equal(base(ev('push', { before: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' })), r.c1, 'an unreachable before (a force push) falls to origin/master\'s merge-base');
  r.g(['update-ref', 'refs/remotes/origin/master', c3]);
  assert.equal(base(ev('workflow_dispatch', {})), c2, 'origin/master at HEAD would be an empty range — HEAD~1 instead');
});
test('ci-per-commit materializes {file:X} / {parentFile:X} from each commit and its parent, skips a commit where either is absent (and says so), and checks every commit', () => {
  const r = repo();
  r.write('TODO.md', 'one\n'); const c2 = r.commit('add todo');
  r.write('TODO.md', 'two\n'); const c3 = r.commit('edit todo');
  const probe = path.join(r.dir, '..', path.basename(r.dir) + '-probe.js');
  fs.writeFileSync(probe, 'const fs=require("fs");console.log("PAIR "+fs.readFileSync(process.argv[2],"utf8").trim()+"<"+fs.readFileSync(process.argv[3],"utf8").trim());');
  const o = run(r.dir, 'ci-per-commit.js', [r.c1 + '..HEAD', '--', process.execPath, probe, '{file:TODO.md}', '{parentFile:TODO.md}']);
  assert.equal(o.code, 0, o.out);
  assert.ok(/PAIR two<one/.test(o.out), 'the edit commit sees its own file and its parent\'s: ' + o.out);
  assert.ok(o.out.indexOf(c2.slice(0, 7)) >= 0 && /skip/i.test(o.out), 'the commit whose parent has no TODO.md is skipped out loud: ' + o.out);
  assert.ok(/1 commit\(s\) checked, 1 skipped/.test(o.out), 'both commits of the range are visited — one checked, one skipped: ' + o.out);
});
test('the workflow feeds ONE range: the range step precedes the gates, both per-commit gates run over $CI_RANGE, run-sabotage-diff gets it, and the enforcement pins catch a removal', () => {
  const wf = fs.readFileSync(path.join(root, '.github/workflows/engine-tests.yml'), 'utf8');
  const at = s => wf.indexOf(s);
  assert.ok(at('run: node dev/ci-range.js --github-env') > 0, 'the range step is missing');
  assert.ok(at('node dev/ci-per-commit.js "$CI_RANGE" -- node dev/lint-todo.js') > at('run: node dev/ci-range.js --github-env'), 'lint-todo must run per commit, after the range step');
  assert.ok(at('node dev/ci-per-commit.js "$CI_RANGE" -- node dev/check-shell-markers.js --ci --range {parent}..{commit}') > 0, 'check-shell-markers must run per commit');
  assert.ok(at('run: node dev/run-sabotage-diff.js "$CI_RANGE"') > 0, 'run-sabotage-diff must get the range');
  const enf = require(TOOL('check-enforcement.js'));
  assert.deepEqual(enf.workflowProblems(wf), [], 'the live workflow must satisfy the pins');
  const cut = wf.replace('run: node dev/ci-range.js --github-env', 'run: echo no range');
  assert.ok(enf.workflowProblems(cut).some(p => /ci-range/.test(p)), 'removing the range step must trip a pin');
  const oneOnly = wf.replace('run: node dev/run-sabotage-diff.js "$CI_RANGE"', 'run: node dev/run-sabotage-diff.js');
  assert.ok(enf.workflowProblems(oneOnly).some(p => /run-sabotage-diff/.test(p)), 'dropping the range from run-sabotage-diff must trip a pin');
});
console.log('#481 G2 CI RANGE: ' + failed + ' failed, ' + passed + ' passed');
process.exit(failed ? 1 : 0);
