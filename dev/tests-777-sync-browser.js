// dev/tests-777-sync-browser.js — audit 2026-11-19 S3 (#777) in a real browser: a campaign saved on the device that cannot
// be read boots to the refusal screen, never to the character wizard; the stored bytes stay as they were and a second
// copy is kept; the screen's three buttons do what they say. Desktop and a 375 px phone, with screenshots.
// Separate headless context; no owner profile, remote services or model requests.
//   node dev/tests-777-sync-browser.js
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert/strict');
const { chromium } = require('./cdp-browser.js');
const root = path.resolve(__dirname, '..'), shots = process.env.TND_SHOT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'tnd-777-sync-'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf' };
function stored() {
  const engine = require('./load-engine.js'); engine.loadEngine(); engine.makeTestWorld();
  worldState.campId = 'c777'; worldState.campName = 'Unreadable test'; worldState.turn = 12; memory.campId = 'c777';
  const whole = serializeWorldState(worldState);
  return { whole: whole, cut: whole.slice(0, Math.floor(whole.length / 2)), mem: JSON.stringify(memory), keys: { ws: WSK, sl: SLK, mem: MEM_KEY, active: ACTIVE_CAMP_K, meta: CAMP_META_K, rescue: STORE_RESCUE_K + 'core_c777' } };
}
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS #777 sync browser ' + name); } catch (e) { failed++; console.error('FAIL #777 sync browser ' + name + ' — ' + e.stack); } }

(async () => {
  fs.mkdirSync(shots, { recursive: true });
  const save = stored(), browsers = [];
  async function open(viewport, coreBytes) {
    /* one launch per scenario: the shim's context is the browser's default one, so storage is per launch */
    const browser = await chromium.launch({ headless: true }); browsers.push(browser);
    const ctx = await browser.newContext({ viewport: viewport, serviceWorkers: 'block' });
    await ctx.route('**/*', r => {
      const u = new URL(r.request().url());
      if (u.hostname !== 'sync777.test') return r.abort();
      const file = path.resolve(root, '.' + decodeURIComponent(u.pathname));
      if (!file.startsWith(root + path.sep)) return r.abort();
      try { return r.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) }); } catch (e) { return r.fulfill({ status: 404, body: '' }); }
    });
    await ctx.addInitScript(a => {
      if (localStorage.getItem('tnd_777_seeded')) return;   // once per profile: a reload must find what the first boot left
      localStorage.setItem('tnd_777_seeded', '1'); localStorage.setItem('tnd_ambient_enabled_v1', '0');
      localStorage.setItem('tnd_provider_keys_v1', JSON.stringify({ gemini: 'test-key-777' }));   // past the key screen: the boot runs
      localStorage.setItem(a.keys.ws, a.core); localStorage.setItem(a.keys.sl, '[]'); localStorage.setItem(a.keys.mem, a.mem);
      localStorage.setItem(a.keys.active, 'c777'); localStorage.setItem(a.keys.meta, JSON.stringify([{ id: 'c777', campName: 'Unreadable test' }]));
    }, { keys: save.keys, core: coreBytes, mem: save.mem });
    const page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://sync777.test/index.html');
    await page.waitForFunction(() => typeof showUnreadableSaveScreen === 'function' && typeof initState === 'function' && document.readyState === 'complete');
    return { ctx: ctx, page: page, errors: errors };
  }
  const shown = page => page.evaluate(() => {
    const vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    const m = document.getElementById('unreadable-save');
    return { modal: !!m, text: m ? m.textContent : '', wizard: vis('char-screen'), game: vis('game-screen'), buttons: ['us-download', 'us-campaigns', 'us-new'].filter(id => !!document.getElementById(id)) };
  });
  try {
    for (const view of [{ name: 'desktop', viewport: { width: 1280, height: 800 } }, { name: 'phone', viewport: { width: 375, height: 812 } }]) {
      const s = await open(view.viewport, save.cut);
      await test(view.name + ': a cut-off save boots to the refusal screen, not the wizard, and the bytes are kept twice', async () => {
        await s.page.waitForSelector('#unreadable-save');
        const v = await shown(s.page);
        assert.equal(v.modal, true); assert.equal(v.wizard, false, 'the wizard is showing behind the refusal'); assert.equal(v.game, false);
        assert.match(v.text, /could not be read/); assert.match(v.text, /Nothing was changed/); assert.match(v.text, /backup of the unreadable save was kept/);
        assert.deepEqual(v.buttons, ['us-download', 'us-campaigns', 'us-new']);
        const kept = await s.page.evaluate(k => ({ ws: localStorage.getItem(k.ws), rescue: localStorage.getItem(k.rescue) }), save.keys);
        assert.equal(kept.ws, save.cut, 'the stored save was changed'); assert.equal(kept.rescue, save.cut, 'no second copy was kept');
        const box = await s.page.evaluate(() => { const r = document.querySelector('#unreadable-save > div').getBoundingClientRect(); return { left: r.left, right: r.right, vw: innerWidth }; });
        assert.ok(box.left >= 0 && box.right <= box.vw + 1, 'the screen overflows the viewport: ' + JSON.stringify(box));
        // nothing lies over the buttons: the reason used to be toasted as well, and on a phone the toast covered them
        const covered = await s.page.evaluate(() => ['us-download', 'us-campaigns', 'us-new'].filter(id => { const b = document.getElementById(id), r = b.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return top !== b; }));
        assert.deepEqual(covered, [], 'something covers the button(s) ' + covered.join(', '));
        assert.equal(await s.page.evaluate(() => document.querySelectorAll('.tnd-toast').length), 0, 'the boot toasted what the screen already says');
        await s.page.screenshot({ path: path.join(shots, 'unreadable-' + view.name + '.png') });
      });
      await test(view.name + ': Escape does not dismiss it; Download hands over the kept bytes under the campaign id', async () => {
        await s.page.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
        assert.equal((await shown(s.page)).modal, true, 'Escape closed the refusal');
        const got = await s.page.evaluate(async () => {
          const seen = []; window._downloadBlob = function (blob, name) { seen.push({ name: name, blob: blob }); };
          document.getElementById('us-download').click();
          return seen.length ? { name: seen[0].name, text: await seen[0].blob.text() } : null;
        });
        assert.ok(got, 'the Download button did nothing'); assert.equal(got.name, 'unreadable-save-c777.txt'); assert.equal(got.text, save.cut);
      });
      await test(view.name + ': Start a new game closes it and shows the wizard; the unreadable bytes are still stored', async () => {
        await s.page.evaluate(() => document.getElementById('us-new').click());
        const v = await shown(s.page);
        assert.equal(v.modal, false); assert.equal(v.wizard, true, 'the wizard did not open');
        assert.equal(await s.page.evaluate(k => localStorage.getItem(k.rescue), save.keys), save.cut);
      });
      await test(view.name + ': after a reload the screen is back (nothing wrote over the save), and Campaign list opens the list', async () => {
        await s.page.goto('http://sync777.test/index.html');
        await s.page.waitForSelector('#unreadable-save');
        // the list must not run the wizard's home-page handoffs: a pending quick start would START a campaign under this button
        await s.page.evaluate(() => { window._handoffs = []; ['consumeHomeCampaignAction', 'consumeHomeQuickStart', 'consumeHomeBlueprint'].forEach(n => { window[n] = function () { window._handoffs.push(n); return false; }; }); });
        await s.page.evaluate(() => document.getElementById('us-campaigns').click());
        await s.page.waitForSelector('#camp-modal');
        assert.deepEqual(await s.page.evaluate(() => window._handoffs), [], 'the Campaign list button ran a home-page handoff');
        assert.equal((await shown(s.page)).wizard, true, 'the list is not over the wizard screen');
        assert.equal((await shown(s.page)).modal, false);
        assert.match(await s.page.evaluate(() => document.getElementById('camp-modal').textContent), /Unreadable test/);
        assert.deepEqual(s.errors, [], 'page errors: ' + s.errors.join(' | '));
      });
    }
    const ok = await open({ width: 1280, height: 800 }, save.whole);
    await test('a healthy save boots straight into the game with no refusal', async () => {
      await ok.page.waitForFunction(() => { const g = document.getElementById('game-screen'); return !!g && getComputedStyle(g).display !== 'none'; });
      const v = await shown(ok.page);
      assert.equal(v.modal, false); assert.equal(v.wizard, false);
      assert.equal(await ok.page.evaluate(k => localStorage.getItem(k.rescue), save.keys), null, 'a rescue copy was made of a healthy save');
    });
  } finally { for (const b of browsers) await b.close(); }
  console.log((failed ? 'FAILED' : 'ALL GREEN') + ' — ' + passed + ' passed, ' + failed + ' failed (#777 sync browser); screenshots in ' + shots);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e.stack || e); process.exit(1); });
