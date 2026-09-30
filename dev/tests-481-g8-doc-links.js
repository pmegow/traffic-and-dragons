// tests-481-g8-doc-links.js — #481 G8 (audit 2026-09-29, Fable-approved): 47 links in the live contract docs were dead — 34
// in DOC/contracts/ still resolved from the repo root (the #310 split moved the files, not their links) and 13 CLAUDE.md
// anchors spelled a heading's "_" as "-". dev/check-doc-links.js checks every relative link and its #fragment; run-tests
// fails on the first dead one.
//   node dev/tests-481-g8-doc-links.js
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert/strict');
const root = path.join(__dirname, '..');
const cdl = require('./check-doc-links.js');
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS #481 G8 ' + name); } catch (e) { failed++; console.error('FAIL #481 G8 ' + name + ' — ' + (e && e.message || e)); } }

test('the live contract docs: every relative link and anchor lands', () => {
  assert.deepEqual(cdl.brokenLinks(root).map(b => b.file + ':' + b.line + ' ' + b.target + ' (' + b.why + ')'), []);
});
test('GitHub slugs: "_" survives, dots and ticks drop, a repeat gets -1', () => {
  assert.equal(cdl.slugText('`capability_bible.js`'), 'capability_biblejs');
  assert.equal(cdl.slugText('8. Tail retention — the t160 pin grab (#28, v1.165)'), '8-tail-retention--the-t160-pin-grab-28-v1165');
  assert.equal(cdl.slugText('**Bold** [link](x.md) <b>tag</b>'), 'bold-link-tag');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tnd-g8-')), f = path.join(dir, 'h.md');
  fs.writeFileSync(f, '# Same\n\n# Same\n\n```\n# not a heading\n```\n<a id="custom"></a>\n');
  const a = cdl.anchorsOf(f);
  assert.ok(a.same && a['same-1'] && a.custom && !a['not-a-heading'], JSON.stringify(a));
});
test('a dead link is named — a missing file (with the rebase hint when it resolves from the root) and a missing anchor; code, URLs and good links pass', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tnd-g8-root-'));
  fs.mkdirSync(path.join(dir, 'DOC', 'contracts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'DOC', 'HIST.md'), '# History\n\n## the_one arc\n');
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), [
    '[ok](DOC/HIST.md#the_one-arc) [bad anchor](DOC/HIST.md#the-one-arc) [gone](DOC/NOPE.md)',
    '`[in code](DOC/NOPE.md)` [web](https://example.com/x#y) [self](#nowhere)',
    '```', '[fenced](DOC/NOPE.md)', '```'].join('\n'));
  fs.writeFileSync(path.join(dir, 'DOC', 'contracts', 'c.md'), '[root-form](DOC/HIST.md#history) [rebased](../HIST.md#history)\n');
  const bad = cdl.brokenLinks(dir).map(b => b.file + ' ' + b.target + ' | ' + b.why);
  assert.equal(bad.length, 4, JSON.stringify(bad, null, 1));
  assert.ok(bad.some(b => /^CLAUDE\.md DOC\/HIST\.md#the-one-arc \| no heading or id/.test(b)), 'the "-" for "_" anchor');
  assert.ok(bad.some(b => /^CLAUDE\.md DOC\/NOPE\.md \| no such file$/.test(b)), 'a missing file');
  assert.ok(bad.some(b => /^CLAUDE\.md #nowhere \| no heading or id/.test(b)), 'a same-file anchor');
  assert.ok(bad.some(b => /^DOC\/contracts\/c\.md DOC\/HIST\.md#history \| no such file here \(it resolves from the repo root/.test(b)), 'the #310 root-form link, with the hint');
});
test('run-tests runs the check before the suite', () => {
  const rt = fs.readFileSync(path.join(root, 'dev/run-tests.js'), 'utf8');
  assert.ok(/require\("\.\/check-doc-links\.js"\)\.brokenLinks\(/.test(rt), 'run-tests must call check-doc-links');
  assert.ok(rt.indexOf('DOC LINKS CONTRACT FAILED') > 0 && rt.indexOf('check-doc-links') < rt.indexOf('SHARED READERS FOR THE SOURCE-CONTRACT SECTION'), 'at the top, beside the enforcement contract');
});
console.log('#481 G8 DOC LINKS: ' + failed + ' failed, ' + passed + ' passed');
process.exit(failed ? 1 : 0);
