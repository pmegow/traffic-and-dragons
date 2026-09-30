// tests-481-g7-archive-moves.js — #481 G7 (audit 2026-09-29, Fable-approved with changes): "byte-identical" archive moves were
// never checked, and some weren't — 5 of 486 moves since 2026-09-01 changed on the way (0826478 "archive #44 (byte-identical
// move…)" grew the row from 5,965 to 6,182 bytes and left an unbalanced **). And a row whose id isn't numeric (L7, 7,201 bytes)
// escaped the row-size cap. Now: in git-aware mode a row that leaves TODO.md while its id enters the archive must arrive
// byte-identical (the hook compares HEAD's archive with the index's; CI gets the parent's archive via --head-archive); the id
// pattern is [A-Za-z]*\d+ for the cap. Per Fable, archive entries themselves carry no size cap.
//   node dev/tests-481-g7-archive-moves.js
const cp = require('child_process'), fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert/strict');
const root = path.join(__dirname, '..'), LINT = path.join(root, 'dev', 'lint-todo.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tnd-g7-'));
const HEAD_ROW = '| 44 | **The row.** TLDR: the text | S | Fable | ✅ complete |';
function doc(rows) { return '## Open\n\n| # | Task | Size | Tier | Status |\n|---|---|---|---|---|\n' + rows.join('\n') + '\n'; }
function arch(rows) { return '# Archive\n\n| # | Task | Size | Tier | Status |\n|---|---|---|---|---|\n' + rows.join('\n') + '\n'; }
function lint(files, extra) {
  const p = {}; Object.keys(files).forEach(k => { p[k] = path.join(dir, k + '-' + Math.random().toString(36).slice(2) + '.md'); fs.writeFileSync(p[k], files[k]); });
  const args = [LINT, '--git-aware', '--cap', '--file', p.todo, '--head-file', p.headTodo, '--archive-file', p.archive];
  if (p.headArchive) args.push('--head-archive', p.headArchive);
  const r = cp.spawnSync(process.execPath, args.concat(extra || []), { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS #481 G7 ' + name); } catch (e) { failed++; console.error('FAIL #481 G7 ' + name + ' — ' + (e && e.message || e)); } }

test('the repro: a row that changes on its way to the archive fails, naming the row', () => {
  const r = lint({ headTodo: doc([HEAD_ROW, '| 45 | stays | S | x | ○ |']), todo: doc(['| 45 | stays | S | x | ○ |']),
    headArchive: arch(['| 43 | old | S | x | ✅ |']), archive: arch(['| 43 | old | S | x | ✅ |', HEAD_ROW.replace('the text', 'the text, grown on the way **')]) });
  assert.notEqual(r.code, 0, 'a changed archive move passed: ' + r.out);
  assert.match(r.out, /#44/);
});
test('a byte-identical move passes; a row archived without leaving TODO.md in this commit is not a move', () => {
  const same = lint({ headTodo: doc([HEAD_ROW]), todo: doc([]), headArchive: arch([]), archive: arch([HEAD_ROW]) });
  assert.equal(same.code, 0, 'an identical move failed: ' + same.out);
  const fresh = lint({ headTodo: doc([]), todo: doc([]), headArchive: arch([]), archive: arch(['| 900 | written straight into the archive | S | x | ✅ |']) });
  assert.equal(fresh.code, 0, 'a new archive row with no TODO origin is not a move: ' + fresh.out);
});
test('a letter id (L7) is a row id: over the cap it fails, as a numeric row would', () => {
  const big = '| L9 | **Big.** ' + 'x'.repeat(6300) + ' | L | Fable | ◐ |';
  const r = lint({ headTodo: doc([big]), todo: doc([big]), headArchive: arch([]), archive: arch([]) });
  assert.notEqual(r.code, 0, 'a 6.3 KB L-row passed the cap: ' + r.out.slice(0, 200));
  assert.match(r.out, /L9/);
});
test('the live files pass (L7 fits the cap); CI hands the lint each commit\'s parent archive', () => {
  const r = cp.spawnSync(process.execPath, [LINT, '--git-aware', '--cap'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, 'the live TODO.md fails: ' + (r.stdout + r.stderr).slice(0, 300));
  const wf = fs.readFileSync(path.join(root, '.github/workflows/engine-tests.yml'), 'utf8');
  assert.ok(/node dev\/lint-todo\.js[^\n]*--head-archive \{parentFile:DOC\/TODO_ARCHIVE\.md\}/.test(wf), 'CI must pass --head-archive {parentFile:DOC/TODO_ARCHIVE.md}');
});
test('the hook\'s path: --staged compares HEAD\'s archive with the index\'s', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'tnd-g7-repo-'));
  const g = args => cp.execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  g(['init', '-q']); fs.mkdirSync(path.join(repo, 'dev')); fs.mkdirSync(path.join(repo, 'DOC'));
  fs.copyFileSync(LINT, path.join(repo, 'dev', 'lint-todo.js'));
  fs.writeFileSync(path.join(repo, 'TODO.md'), doc([HEAD_ROW])); fs.writeFileSync(path.join(repo, 'DOC', 'TODO_ARCHIVE.md'), arch([]));
  g(['add', '-A']); g(['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'base']);
  fs.writeFileSync(path.join(repo, 'TODO.md'), doc([])); fs.writeFileSync(path.join(repo, 'DOC', 'TODO_ARCHIVE.md'), arch([HEAD_ROW.replace('the text', 'edited while moving')]));
  g(['add', '-A']);
  const r = cp.spawnSync(process.execPath, [path.join(repo, 'dev', 'lint-todo.js'), '--git-aware', '--staged', '--cap'], { cwd: repo, encoding: 'utf8' });
  assert.notEqual(r.status, 0, 'a staged changed move passed: ' + r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /#44/);
});
test('CI caps only the rows a commit adds or edits (--cap-changed): an old branch\'s untouched oversize row is not its commit\'s doing, an edit to it is', () => {
  const big = '| L9 | **Big.** ' + 'x'.repeat(6300) + ' | L | Fable | ◐ |';
  const untouched = lint({ headTodo: doc([big]), todo: doc([big, '| 901 | a small new row | S | x | ○ |']), headArchive: arch([]), archive: arch([]) }, ['--cap-changed']);
  assert.equal(untouched.code, 0, 'an untouched oversize row failed a commit that did not change it: ' + untouched.out.slice(0, 200));
  const edited = lint({ headTodo: doc([big]), todo: doc([big.replace('Big.', 'Bigger.')]), headArchive: arch([]), archive: arch([]) }, ['--cap-changed']);
  assert.notEqual(edited.code, 0, 'an EDITED oversize row passed');
  const wf = fs.readFileSync(path.join(root, '.github/workflows/engine-tests.yml'), 'utf8');
  assert.ok(/node dev\/lint-todo\.js --git-aware --cap-changed /.test(wf), 'CI must cap changed rows per commit');
  assert.ok(/node "\$\(git rev-parse --show-toplevel\)\/dev\/lint-todo\.js" --git-aware --staged --cap /.test(fs.readFileSync(path.join(root, 'dev/pre-commit'), 'utf8')), 'the hook keeps the full cap');
});
console.log('#481 G7 ARCHIVE MOVES: ' + failed + ' failed, ' + passed + ' passed');
process.exit(failed ? 1 : 0);
