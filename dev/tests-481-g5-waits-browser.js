// tests-481-g5-waits-browser.js — #481 G5, the real-browser half: every fixed model wait COUNTS SECONDS while it waits, and its
// result is not overwritten by a stray tick after it lands (the ticker's stop-before-terminal-text discipline). Real
// blueprint-designer.html and index.html in Chrome (dev/cdp-browser.js); the model is a promise the test settles (callGM,
// generateBlueprintDraft and reviewChunk are stubbed) — no network, no spend.
//   node dev/tests-481-g5-waits-browser.js
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { chromium } = require('./cdp-browser.js');
const root = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.blueprint': 'application/json', '.char': 'application/json' };
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS #481 G5 ' + name); } catch (e) { failed++; console.error('FAIL #481 G5 ' + name + ' — ' + (e && e.message || e)); } }
// A controllable model: every call parks a promise; the test settles the oldest (or all).
const STUB = `window.__calls=[];window.__model=function(){var c={};c.p=new Promise(function(res,rej){c.res=res;c.rej=rej;});window.__calls.push(c);return c.p;};
  window.__settle=function(ok,val){var c=window.__calls.shift();if(!c)return false;ok?c.res(val):c.rej(new Error(val));return true;};
  window.__settleAll=function(ok,val){var n=0;while(window.__settle(ok,val))n++;return n;};`;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined), headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: 'block' }), errors = [];
    await ctx.route('**/*', async route => {
      const u = new URL(route.request().url()); if (u.hostname !== 'waits.test') return route.abort();
      const f = path.resolve(root, '.' + decodeURIComponent(u.pathname)); if (!f.startsWith(root + path.sep)) return route.abort();
      try { return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); } catch (e) { return route.fulfill({ status: 404, body: 'Not found' }); }
    });
    const bpd = await ctx.newPage(); bpd.on('pageerror', e => errors.push('designer: ' + e.message)); bpd.on('dialog', d => d.accept());
    await bpd.goto('http://waits.test/blueprint-designer.html'); await bpd.waitForFunction(() => window.__bpdTest);
    const sample = JSON.parse(fs.readFileSync(path.join(root, 'samples/the_iron_meridian.blueprint'), 'utf8'));
    await bpd.evaluate(b => { __bpdTest.load(b); }, sample);
    await bpd.evaluate(STUB + 'llmReady=function(){return true;};callGM=function(){return window.__model();};generateBlueprintDraft=function(){return window.__model();};reviewChunk=function(){return window.__model();};');
    const line = () => bpd.evaluate(() => { const s = document.getElementById('statusline'); return { text: s.textContent, cls: s.className }; });
    const tick = ms => bpd.waitForTimeout(ms);

    await test('the creature wait counts seconds on the statusline; the result stays once it lands', async () => {
      await bpd.evaluate(() => { genCreature(document.querySelector("[data-op='gencreature']") || document.createElement('button')); });
      await tick(1250);
      assert.match((await line()).text, /^Generating a creature in service to the story… [1-3]s$/, 'while waiting');
      await bpd.evaluate(() => __settle(true, '{"name":"Lamp Rat","kind":"beast","threat":"low","notes":"It eats wicks."}'));
      await tick(1300);
      const l = await line(); assert.match(l.text, /^Added “Lamp Rat”/, 'the result, a tick later: ' + l.text); assert.equal(l.cls, 'ok');
    });
    await test('a failed creature wait says why, and no tick overwrites it', async () => {
      await bpd.evaluate(() => { genCreature(document.createElement('button')); });
      await tick(1100);
      assert.match((await line()).text, /^Generating a creature in service to the story… [1-3]s$/);
      await bpd.evaluate(() => __settle(false, 'fixture outage'));
      await tick(1300);
      assert.deepEqual(await line(), { text: 'Creature generation failed: fixture outage', cls: 'err' });
    });
    await test('the Generate modal: its button counts seconds (the modal covers the statusline); a failure restores the label for good', async () => {
      await bpd.evaluate(() => { openGenerate(); document.getElementById('gen-go').click(); });
      await tick(1250);
      assert.match(await bpd.evaluate(() => document.getElementById('gen-go').textContent), /^Generating… \(can take a minute\) [1-3]s$/);
      await bpd.evaluate(() => __settle(false, 'fixture outage'));
      await tick(1300);
      assert.equal(await bpd.evaluate(() => document.getElementById('gen-go').textContent), '✨ Generate');
      assert.deepEqual(await line(), { text: 'Generation failed: fixture outage', cls: 'err' });
      await bpd.evaluate(() => closeGenerate());
    });
    await test('the review counts seconds and carries its progress; the verdict stays', async () => {
      await bpd.evaluate(() => { __bpdTest.getBp().review = null; document.getElementById('btn-review').click(); });
      await tick(1250);
      const n = await bpd.evaluate(() => window.__calls.length);
      assert.ok(n > 1, 'the review asks each section in parallel (' + n + ')');
      assert.match((await line()).text, new RegExp('^Reviewing ' + n + ' sections in parallel… [1-3]s$'));
      await bpd.evaluate(() => __settle(true, []));
      await tick(1100);
      assert.match((await line()).text, new RegExp('^Reviewed 1/' + n + ' sections… [1-4]s$'), 'progress rides the same clock');
      await bpd.evaluate(() => __settleAll(true, []));
      await tick(1300);
      assert.match((await line()).text, /^Review: /, 'the verdict, a tick later');
    });
    await test('a lone apply counts seconds; inside Apply-all the batch owns the one ticker', async () => {
      await bpd.evaluate(() => { const b = __bpdTest.getBp(); b.review = { findings: [
        { section: 'premise', issue: 'Lone fixture issue', fixes: ['Sharpen it'], sev: 'LOW' },
        { section: 'npcs', issue: 'Batch issue one', fixes: ['One'], sev: 'LOW', _sel: 0 },
        { section: 'locations', issue: 'Batch issue two', fixes: ['Two'], sev: 'LOW', _sel: 0 }], sections: 1, failedSections: 0 }; __bpdTest.rerender(); applyFinding(0); });
      await tick(1250);
      assert.match((await line()).text, /^Applying fix: Lone fixture issue… [1-3]s$/);
      await bpd.evaluate(() => __settle(false, 'fixture outage'));
      await tick(1300);
      assert.match((await line()).text, /^Apply failed: fixture outage/, 'the lone failure stays');
      await bpd.evaluate(() => { applyAllFindings(); });
      await tick(1250);
      assert.match((await line()).text, /^Applying 2 selected fixes — 0\/2 done… [1-3]s$/, 'the batch line, never two tickers fighting');
      await bpd.evaluate(() => __settleAll(false, 'fixture outage'));
      await tick(1400);
      const l = await line(); assert.match(l.text, /^Applied 0 selected fixes; 2 failed/, 'the batch summary stays: ' + l.text); assert.equal(l.cls, 'err');
    });

    const game = await ctx.newPage(); game.on('pageerror', e => errors.push('game: ' + e.message));
    await game.goto('http://waits.test/index.html'); await game.waitForFunction(() => typeof aiRandomHero === 'function' && typeof showLoadingModal === 'function');
    await game.evaluate(STUB + 'callGM=function(){return window.__model();};');
    await test('the random hero writes under the ticking loading modal, which leaves when the hero lands', async () => {
      await game.evaluate(() => { showChar(); aiRandomHero(document.getElementById('random-hero')); });
      await game.waitForTimeout(1250);
      const m = await game.evaluate(() => { const lm = document.getElementById('loading-modal'); return lm ? lm.textContent.replace(/\s+/g, ' ').trim() : null; });
      assert.match(String(m), /^Writing your hero… [1-3]s$/, 'the modal counts: ' + m);
      assert.equal(await game.evaluate(() => document.getElementById('random-hero').disabled), true, 'step 1\'s button stays off while the hero is written');
      await game.evaluate(() => __settle(true, '{"name":"Wren Hollowell","appear":"Tall.","backstory":"Born late.","trait":"calm","flaw":"proud","motivation":"home"}'));
      await game.waitForTimeout(400);
      assert.equal(await game.evaluate(() => !!document.getElementById('loading-modal')), false, 'the modal leaves');
      assert.equal(await game.evaluate(() => document.getElementById('char-name').value), 'Wren Hollowell');
      assert.equal(await game.evaluate(() => document.getElementById('random-hero').disabled), false);
    });
    await test('no page error', async () => { assert.deepEqual(errors, []); });
  } finally { await browser.close(); }
  console.log('#481 G5 WAITS (browser): ' + failed + ' failed, ' + passed + ' passed');
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
