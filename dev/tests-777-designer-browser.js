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
    // The independent review of the X batch (commit ad48e8d6), findings 1 and 2.
    const withFindings = n => page.evaluate(a => { const fs_ = []; for (let i = 0; i < a.n; i++) { const c = JSON.parse(JSON.stringify(a.f)); c._sel = 0; fs_.push(c); } __bpdTest.getBp().review = { findings: fs_, sections: 1, failedSections: 0 }; __bpdTest.rerender(); }, { f: FINDING, n: n });
    await test('X7: a fix request that FAILS after another blueprint was opened stamps no error on that blueprint', async () => {
      await page.evaluate(b => __bpdTest.load(b), one); await withFindings(1);
      await page.evaluate(() => { window._applied = __bpdTest.applyFinding(0); });
      await settle();
      assert.equal(await page.evaluate(() => window._held.length), 1, 'the fix call was not made');
      await page.evaluate(b => __bpdTest.load(b), two); await withFindings(1);
      await page.evaluate(() => { const h = window._held; window._held = []; h.forEach(x => x.rej(new Error('provider down'))); });
      await page.evaluate(() => window._applied); await settle();
      const s = await state();
      assert.ok(!s.review.findings[0]._err && !s.review.findings[0].status, 'the second blueprint\'s finding carries the first one\'s failure: ' + JSON.stringify(s.review.findings[0]));
      assert.match(s.status, /nothing was applied/);
    });
    await test('X7: Apply selected stops when another blueprint is opened — the queued fixes are not run against it', async () => {
      await page.evaluate(b => __bpdTest.load(b), one); await withFindings(2);
      await page.evaluate(() => { __bpdTest.getBp().review.findings[1].section = 'consistency'; });   // its own group, started LAST — after the first has come back
      await page.evaluate(() => { window._all = applyAllFindings(); });
      await settle();
      assert.equal(await page.evaluate(() => window._held.length), 1, 'the first fix call was not made');
      await page.evaluate(b => __bpdTest.load(b), two); await withFindings(2);
      await page.evaluate(() => window._answer(JSON.stringify({ patches: [{ section: 'premise', value: 'PATCHED BY THE MODEL' }], note: 'thickened' })));
      await settle(); await settle();
      assert.equal(await page.evaluate(() => window._held.length), 0, 'the second queued fix was asked for against the blueprint opened mid-run');
      await page.evaluate(() => window._all); await settle();
      const s = await state();
      assert.equal(s.premise, 'The second premise.', 'a queued fix was applied to the wrong blueprint');
      assert.ok(s.review.findings.every(f => !f.status && !f._err), 'the second blueprint\'s findings were stamped: ' + JSON.stringify(s.review.findings));
      assert.match(s.status, /Another blueprint was opened while the selected fixes/);
      await page.evaluate(() => { const h = window._held; window._held = []; h.forEach(x => x.res('{}')); });
    });
    await test('X7: Apply selected ends cleanly when the blueprint opened mid-run has no review, and its last group is never started', async () => {
      await page.evaluate(b => __bpdTest.load(b), one); await withFindings(2);
      await page.evaluate(() => { __bpdTest.getBp().review.findings[1].section = 'consistency'; });   // its own group, run LAST on the settled blueprint
      await page.evaluate(() => { window._allErr = null; window._all = applyAllFindings().catch(e => { window._allErr = String(e && e.message || e); }); });
      await settle();
      assert.equal(await page.evaluate(() => window._held.length), 1, 'the first fix call was not made');
      await page.evaluate(b => __bpdTest.load(b), two);            // no review on this one
      await page.evaluate(() => window._answer(JSON.stringify({ patches: [{ section: 'premise', value: 'PATCHED BY THE MODEL' }], note: 'thickened' })));
      await settle(); await settle();
      await page.evaluate(() => window._all); await settle();
      assert.equal(await page.evaluate(() => window._allErr), null, 'the batch threw on the blueprint opened mid-run');
      assert.equal(await page.evaluate(() => window._held.length), 0, 'the last group was started against the blueprint opened mid-run');
      const s = await state();
      assert.equal(s.premise, 'The second premise.'); assert.equal(s.review, null, 'a review appeared on a blueprint that had none');
      await page.evaluate(() => { const h = window._held; window._held = []; h.forEach(x => x.res('{}')); });
    });
    assert.deepEqual(errors, [], 'page errors: ' + errors.join(' | '));
  } finally { await browser.close(); }
  console.log((failed ? 'FAILED' : 'ALL GREEN') + ' — ' + passed + ' passed, ' + failed + ' failed (#777 designer browser)');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e.stack || e); process.exit(1); });
