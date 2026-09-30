// tests-481-g4-row-ids.js — #481 G4 (audit 2026-09-29, Fable-approved with changes): nothing checked that a TODO row number is
// used once. Two different archived rows are both #264 today, and last week's double #463 was caught by a person a day later —
// a fixture with two | 463 | rows passed lint-todo --git-aware --cap with exit 0. Now an id pass in lint-todo (the hook and CI):
// a row id must be unique across TODO.md and DOC/TODO_ARCHIVE.md, except the EXPLICIT grandfather list — the legacy #1–#30
// numbering (pinned at today's counts, so a new copy still fails). The double #264 was resolved by owner ruling 2026-09-30: the
// quest-journal row (cited by no code) became #486; the review-call whitelist, which api.js and the engine tests cite, keeps #264.
//   node dev/tests-481-g4-row-ids.js
const cp = require('child_process'), fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert/strict');
const root = path.join(__dirname, '..'), LINT = path.join(root, 'dev', 'lint-todo.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tnd-g4-'));
function table(rows) { return '## Open\n\n| # | Task | Size | Tier | Status |\n|---|---|---|---|---|\n' + rows.map(r => '| ' + r[0] + ' | ' + r[1] + ' | S | Fable | ○ not started |').join('\n') + '\n'; }
function lint(todo, archive, extra) {
  const t = path.join(dir, 'todo-' + Math.random().toString(36).slice(2) + '.md'); fs.writeFileSync(t, todo);
  const args = [LINT, '--git-aware', '--cap', '--file', t, '--head-file', t];
  if (archive !== null) { const a = path.join(dir, 'arch-' + Math.random().toString(36).slice(2) + '.md'); fs.writeFileSync(a, archive); args.push('--archive-file', a); }
  const r = cp.spawnSync(process.execPath, args.concat(extra || []), { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS #481 G4 ' + name); } catch (e) { failed++; console.error('FAIL #481 G4 ' + name + ' — ' + (e && e.message || e)); } }

test('the repro: two | 463 | rows fail the lint, naming the id', () => {
  const r = lint(table([[463, 'one'], [463, 'two']]), '');
  assert.notEqual(r.code, 0, 'a doubled #463 passed: ' + r.out);
  assert.match(r.out, /#463/);
});
test('an open row that reuses an ARCHIVED id fails too — the numbers are global across both files', () => {
  const r = lint(table([[500, 'new work']]), '# Archive\n\n' + table([[500, 'old work']]));
  assert.notEqual(r.code, 0, 'an id already in the archive was reused: ' + r.out);
  assert.match(r.out, /#500/);
});
test('the grandfather list is explicit: a new copy of a legacy id fails, and #264 is no longer grandfathered (owner ruling 2026-09-30: the quest-journal row became #486)', () => {
  assert.notEqual(lint(table([[264, 'a'], [264, 'b']]), '').code, 0, 'a doubled #264 must fail now');
  assert.equal(lint(table([[1, 'a'], [1, 'b']]), '').code, 0, 'the legacy #1 pair must pass');
  assert.notEqual(lint(table([[1, 'a'], [1, 'b'], [1, 'c']]), '').code, 0, 'a new copy of a legacy id must fail');
  const src = fs.readFileSync(LINT, 'utf8');
  assert.ok(!/\b264:\s*\{/.test(src), 'the #264 grandfather entry must be gone');
  const arch = fs.readFileSync(path.join(root, 'DOC/TODO_ARCHIVE.md'), 'utf8');
  assert.equal((arch.match(/^\|\s*264\s*\|/gm) || []).length, 1, 'exactly one #264 row remains: the review-call whitelist, which the code cites');
  assert.ok(/^\|\s*486\s*\|\s*\*\*QUEST JOURNAL ACTIONS WAIT FOR THE GM TURN/m.test(arch), 'the quest-journal row is #486');
});
test('the real TODO.md and archive pass; the CI per-commit line hands the lint each commit\'s archive', () => {
  const r = cp.spawnSync(process.execPath, [LINT, '--git-aware', '--cap', '--file', path.join(root, 'TODO.md'), '--head-file', path.join(root, 'TODO.md'), '--archive-file', path.join(root, 'DOC/TODO_ARCHIVE.md')], { encoding: 'utf8' });
  assert.equal(r.status, 0, 'the live files fail the id pass: ' + r.stdout + r.stderr);
  const wf = fs.readFileSync(path.join(root, '.github/workflows/engine-tests.yml'), 'utf8');
  assert.ok(/node dev\/lint-todo\.js[^\n]*--archive-file \{file:DOC\/TODO_ARCHIVE\.md\}/.test(wf), 'CI must pass --archive-file {file:DOC/TODO_ARCHIVE.md}');
});
test('the hook\'s path: --staged reads the ARCHIVE from the index, so a staged row reusing an archived id is blocked', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'tnd-g4-repo-'));
  const g = args => cp.execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  g(['init', '-q']); fs.mkdirSync(path.join(repo, 'dev')); fs.mkdirSync(path.join(repo, 'DOC'));
  fs.copyFileSync(LINT, path.join(repo, 'dev', 'lint-todo.js'));   /* its ROOT is its own parent — the fixture repo */
  fs.writeFileSync(path.join(repo, 'TODO.md'), table([[600, 'open']]));
  fs.writeFileSync(path.join(repo, 'DOC', 'TODO_ARCHIVE.md'), '# Archive\n\n' + table([[598, 'done']]));
  g(['add', '-A']); g(['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'base']);
  /* the commit being made: it archives a #599 AND claims #599 for an open row — the duplicate lives in the INDEX; the working
     archive is then edited back without it (unstaged), so only a lint that reads the index's archive sees the clash */
  fs.writeFileSync(path.join(repo, 'DOC', 'TODO_ARCHIVE.md'), '# Archive\n\n' + table([[598, 'done'], [599, 'archived today']]));
  fs.writeFileSync(path.join(repo, 'TODO.md'), table([[600, 'open'], [599, 'claimed again']])); g(['add', 'TODO.md', 'DOC/TODO_ARCHIVE.md']);
  fs.writeFileSync(path.join(repo, 'DOC', 'TODO_ARCHIVE.md'), '# Archive\n\n' + table([[598, 'done']]));
  const r = cp.spawnSync(process.execPath, [path.join(repo, 'dev', 'lint-todo.js'), '--git-aware', '--staged', '--cap'], { cwd: repo, encoding: 'utf8' });
  assert.notEqual(r.status, 0, 'the staged reuse of an archived id passed: ' + r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /#599/);
});
console.log('#481 G4 ROW IDS: ' + failed + ' failed, ' + passed + ' passed');
process.exit(failed ? 1 : 0);
