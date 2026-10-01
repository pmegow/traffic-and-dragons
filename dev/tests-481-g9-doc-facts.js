// tests-481-g9-doc-facts.js — #481 G9 (audit 2026-09-29, Fable-approved): CLAUDE.md's hand-copied facts had drifted — the load
// order had lost blueprint-edition.js, the index.html row claimed 42 script tags and no inline JS (44 and an inline SW
// registration then), applyMuts was "a thin veneer" (it is the W2 canon-transaction boundary plus the #264 whitelist), async
// was "only in three functions" (51). dev/check-doc-facts.js derives the load order from index.html; the prose facts are
// corrected and their counts dropped.
//   node dev/tests-481-g9-doc-facts.js
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const root = path.join(__dirname, '..');
const df = require('./check-doc-facts.js');
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS #481 G9 ' + name); } catch (e) { failed++; console.error('FAIL #481 G9 ' + name + ' — ' + (e && e.message || e)); } }
const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), md = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');

test('the live CLAUDE.md: its load order IS index.html\'s, and no stale script count', () => {
  assert.deepEqual(df.allProblems(root), []);
  assert.equal(df.documentedOrder(md).length, df.indexScripts(idx).length);
});
test('a drifted load order is named: a missing file, an extra file, an out-of-order pair', () => {
  const order = df.documentedOrder(md), block = order.join(' → ');
  const at = (o) => ({ index: idx, claude: md.replace(block, o.join(' → ')) });
  const dropped = order.filter(f => f !== 'blueprint-edition.js');
  assert.match(df.loadOrderProblems(null, at(dropped))[0] || '', /missing: blueprint-edition\.js/, 'the audit\'s own case');
  assert.match(df.loadOrderProblems(null, at(order.concat(['ghost.js'])))[0] || '', /not in index\.html: ghost\.js/);
  const swapped = order.slice(); const t = swapped[3]; swapped[3] = swapped[4]; swapped[4] = t;
  assert.match(df.loadOrderProblems(null, at(swapped))[0] || '', /out of order from entry 4/);
  assert.match(df.loadOrderProblems(null, { index: idx, claude: md.replace('### Script load order', '### Load sequence') })[0] || '', /lost its "### Script load order"/);
});
test('a script-tag count in the index.html row must be true (the audit\'s "42")', () => {
  const row = md.split('\n').filter(l => /^\|\s*`index\.html`\s*\|/.test(l))[0];
  const lying = md.replace(row, '| `index.html` | **Active host** | CSS, HTML scaffolding, 42 `<script src>` tags, no inline JS |');
  assert.match(df.scriptCountProblems(null, { index: idx, claude: lying })[0] || '', /says 42 <script src> tags; index\.html has \d+/);
  const honest = md.replace(row, '| `index.html` | **Active host** | ' + df.indexScripts(idx).length + ' `<script src>` tags |');
  assert.deepEqual(df.scriptCountProblems(null, { index: idx, claude: honest }), []);
});
test('the corrected prose: applyMuts is the canon boundary, async is not "three functions", the CI comments carry no stale counts', () => {
  const api = md.split('\n').filter(l => /^\|\s*`api\.js`/.test(l))[0] || '';
  assert.ok(/THE tag-application boundary/.test(api) && /#264 review-call whitelist/.test(api) && /canon-claim transactions/.test(api) && !/thin veneer/.test(api), 'the api.js row: ' + api.slice(0, 160));
  assert.ok(!/only in the three API-facing functions/.test(md) && /async\/await` where a function awaits I\/O/.test(md), 'the async convention');
  const wf = fs.readFileSync(path.join(root, '.github/workflows/engine-tests.yml'), 'utf8'), wk = fs.readFileSync(path.join(root, '.github/workflows/sabotage-weekly.yml'), 'utf8');
  assert.ok(!/951-assertion|proves all 63|63 batteries/.test(wf + wk), 'a stale count survives in a workflow comment');
});
test('run-tests runs the check', () => {
  const rt = fs.readFileSync(path.join(root, 'dev/run-tests.js'), 'utf8');
  assert.ok(/require\("\.\/check-doc-facts\.js"\)\.allProblems\(/.test(rt) && rt.indexOf('DOC FACTS CONTRACT FAILED') > 0);
});
test('#334: the prompt contract and the design doc state the Gemini cache\'s live state and name the server\'s pin (their "off … pending" sentence turned the cache off for twenty days)', () => {
  const pc = fs.readFileSync(path.join(root, 'DOC/contracts/prompt.md'), 'utf8'), d = fs.readFileSync(path.join(root, 'DOC/DESIGN_334_gemini_explicit_cache.md'), 'utf8');
  assert.deepEqual(df.cacheSwitchProblems(null, { promptContract: pc, design334: d }), [], 'the live docs');
  const stale = pc.replace('**The switch is ON in production, by owner ruling.**', '**the flag is off and live enablement is pending**.');
  assert.notEqual(stale, pc, 'the fixture must change the contract');
  assert.match(df.cacheSwitchProblems(null, { promptContract: stale, design334: d })[0] || '', /must state the live state/, 'the sentence the 2026-09-10 deployer read');
  assert.match(df.cacheSwitchProblems(null, { promptContract: pc.split('test-deploy-config.mjs').join('a server test'), design334: d })[0] || '', /source of truth/);
  assert.match(df.cacheSwitchProblems(null, { promptContract: pc.replace('### Account-mode Gemini explicit caching', '### Gemini'), design334: d })[0] || '', /lost its/);
  assert.match(df.cacheSwitchProblems(null, { promptContract: pc, design334: d.replace(/\*\*Live state[^\n]*\n/, '') })[0] || '', /DESIGN_334/);
  assert.ok(df.allProblems(root).length === 0 && /cacheSwitchProblems\(root, opts\)/.test(fs.readFileSync(path.join(root, 'dev/check-doc-facts.js'), 'utf8').split('function allProblems')[1] || ''), 'allProblems runs the check');
});
console.log('#481 G9 DOC FACTS: ' + failed + ' failed, ' + passed + ' passed');
process.exit(failed ? 1 : 0);
