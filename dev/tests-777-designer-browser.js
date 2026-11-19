// dev/tests-777-designer-browser.js — audit 2026-11-19 X6 and X7 (#777) in the real Blueprint Designer: a model call that
// answers after the author has moved on writes nothing. Generate (a minute long) must not replace the working copy once
// its window is closed or another blueprint is open; a Review's findings and a fix's patches must not land on a blueprint
// they were not written for. The model is a held promise in the page; no remote service is called.
//   node dev/tests-777-designer-browser.js
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { chromium } = require('./cdp-browser.js');
const root = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
const base = JSON.parse(fs.readFileSync(path.join(root, 'samples', 'modeltestcampaign.blueprint'), 'utf8'));
const one = Object.assign({}, base, { name: 'First Blueprint', premise: 'The first premise.' });
const two = Object.assign({}, base, { name: 'Second Blueprint', premise: 'The second premise.' });
const FINDING = { sev: 'HIGH', section: 'premise', issue: 'The premise is thin.', fixes: ['Thicken it.'] };
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS #777 designer browser ' + name); } catch (e) { failed++; console.error('FAIL #777 designer browser ' + name + ' — ' + e.stack); } }

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    await ctx.route('**/*', r => {
      const u = new URL(r.request().url());
      if (u.hostname !== 'designer777.test') return r.abort();
      const file = path.resolve(root, '.' + decodeURIComponent(u.pathname));
      if (!file.startsWith(root + path.sep)) return r.abort();
      try { return r.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) }); } catch (e) { return r.fulfill({ status: 404, body: '' }); }
    });
    const page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://designer777.test/blueprint-designer.html');
    await page.waitForFunction(() => window.__bpdTest && typeof openGenerate === 'function');
    // the model: every call is a promise the test resolves by hand
    await page.evaluate(() => {
      providerKeys[activeProvider] = 'test-key-777'; window.confirm = () => true; fitDesignerText = async () => {};
      window._held = [];
      const hold = () => new Promise((res, rej) => { window._held.push({ res: res, rej: rej }); });
      generateBlueprintDraft = hold; reviewChunk = hold; callGM = hold;
      window._answer = v => { const h = window._held; window._held = []; h.forEach(x => x.res(v)); return h.length; };
    });
    const state = () => page.evaluate(() => ({ name: __bpdTest.getBp().name, premise: __bpdTest.getBp().premise, doc: __bpdTest.doc(), review: __bpdTest.getBp().review || null, status: document.getElementById('statusline').textContent }));
    const settle = () => page.evaluate(() => new Promise(r => setTimeout(r, 60)));
    const draft = { name: 'GENERATED DRAFT', premise: 'A generated premise.', acts: base.acts, npcs: base.npcs, locations: base.locations, tone: base.tone, startingLocation: base.startingLocation };

    await test('X6: a draft that arrives after its window was closed replaces nothing', async () => {
      await page.evaluate(b => __bpdTest.load(b), one);
      const before = await state();
      await page.evaluate(() => { openGenerate(); document.getElementById('gen-go').click(); });
      await settle();
      assert.equal(await page.evaluate(() => window._held.length), 1, 'the generate call was not made');
      await page.evaluate(() => { document.getElementById('gen-x').click(); __bpdTest.fieldSet('name', null, null, null, 'First Blueprint, edited'); });
      await page.evaluate(d => window._answer(d), draft); await settle();
      const s = await state();
      assert.equal(s.doc, before.doc, 'the working copy was replaced');
      assert.notEqual(s.name, 'GENERATED DRAFT', 'the generated draft replaced the blueprint the author was editing');
      assert.equal(s.premise, 'The first premise.');
      assert.match(s.status, /nothing was replaced/);
    });
    await test('X6: a draft that arrives after ANOTHER blueprint was opened replaces nothing', async () => {
      await page.evaluate(b => __bpdTest.load(b), one);
      await page.evaluate(() => { openGenerate(); document.getElementById('gen-go').click(); });
      await settle();
      await page.evaluate(b => __bpdTest.load(b), two);          // the window is still open; the document under it changed
      const before = await state();
      await page.evaluate(d => window._answer(d), draft); await settle();
      const s = await state();
      assert.equal(s.name, 'Second Blueprint'); assert.equal(s.doc, before.doc);
      await page.evaluate(() => { const m = document.getElementById('gen-modal'); if (m) m.remove(); });
    });
    await test('X6: with its window still open over the same blueprint, the draft fills the editor as before', async () => {
      await page.evaluate(b => __bpdTest.load(b), one);
      const before = await state();
      await page.evaluate(() => { openGenerate(); document.getElementById('gen-go').click(); });
      await settle();
      await page.evaluate(d => window._answer(d), draft); await settle();
      const s = await state();
      assert.equal(s.name, 'GENERATED DRAFT'); assert.equal(s.doc, before.doc + 1);
      assert.equal(await page.evaluate(() => !!document.getElementById('gen-modal')), false, 'the window stayed open');
    });
    await test('X7: a review of one blueprint is not attached to the blueprint opened while it ran', async () => {
      await page.evaluate(b => __bpdTest.load(b), one);
      await page.evaluate(() => document.getElementById('btn-review').click());
      await settle();
      assert.ok(await page.evaluate(() => window._held.length) > 0, 'no review call was made');
      await page.evaluate(b => __bpdTest.load(b), two);
      await page.evaluate(f => window._answer([f]), FINDING); await settle();
      const s = await state();
      assert.equal(s.name, 'Second Blueprint');
      assert.equal(s.review, null, 'the first blueprint\'s findings were attached to the second: ' + JSON.stringify(s.review));
      assert.match(s.status, /findings were not attached/);
    });
    await test('X7: with the same blueprint still open, the review is attached as before', async () => {
      await page.evaluate(b => __bpdTest.load(b), one);
      await page.evaluate(() => document.getElementById('btn-review').click());
      await settle();
      await page.evaluate(f => window._answer([f]), FINDING); await settle();
      const s = await state();
      assert.ok(s.review && s.review.findings.length >= 1, 'no findings were attached');
    });
    await test('X7: a fix written for one blueprint is not applied to the blueprint opened while it was written, and stamps no error on it', async () => {
      await page.evaluate(b => __bpdTest.load(b), one);
      await page.evaluate(f => { __bpdTest.getBp().review = { findings: [JSON.parse(JSON.stringify(f))], sections: 1, failedSections: 0 }; __bpdTest.getBp().review.findings[0]._sel = 0; __bpdTest.rerender(); }, FINDING);
      await page.evaluate(() => { window._applied = __bpdTest.applyFinding(0); });
      await settle();
      assert.equal(await page.evaluate(() => window._held.length), 1, 'the fix call was not made');
      await page.evaluate((b, f) => { __bpdTest.load(b); }, two);
      await page.evaluate(f => { __bpdTest.getBp().review = { findings: [JSON.parse(JSON.stringify(f))], sections: 1, failedSections: 0 }; __bpdTest.rerender(); }, FINDING);
      await page.evaluate(() => window._answer(JSON.stringify({ patches: [{ section: 'premise', value: 'PATCHED BY THE MODEL' }], note: 'thickened' })));
      await page.evaluate(() => window._applied); await settle();
      const s = await state();
      assert.equal(s.premise, 'The second premise.', 'the fix was applied to the wrong blueprint');
      assert.ok(!s.review.findings[0].status && !s.review.findings[0]._err, 'the second blueprint\'s finding was stamped: ' + JSON.stringify(s.review.findings[0]));
      assert.match(s.status, /nothing was applied/);
    });
    assert.deepEqual(errors, [], 'page errors: ' + errors.join(' | '));
  } finally { await browser.close(); }
  console.log((failed ? 'FAILED' : 'ALL GREEN') + ' — ' + passed + ' passed, ' + failed + ' failed (#777 designer browser)');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e.stack || e); process.exit(1); });
