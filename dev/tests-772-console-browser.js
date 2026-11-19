// dev/tests-772-console-browser.js — #772 in a real browser: a notice is collected and turns the Console button's dot
// green, an inventory change still pops, opening the console reads it (grey again), Clear empties it, and a notice pops
// when the console cannot be opened (no game on screen, Car Mode). Desktop and a 375 px phone, with screenshots.
// Separate headless context; no owner profile, remote services or model requests.
//   node dev/tests-772-console-browser.js
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert/strict');
const { chromium } = require('./cdp-browser.js');
const root = path.resolve(__dirname, '..'), shots = process.env.TND_SHOT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'tnd-772-console-'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf' };
function world() {
  const engine = require('./load-engine.js'); engine.loadEngine(); engine.makeTestWorld();
  worldState.campId = 'c772'; worldState.campName = 'Console test'; worldState.turn = 5; memory.campId = 'c772';
  return JSON.parse(JSON.stringify({ worldState: worldState, memory: memory }));
}
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS #772 console browser ' + name); } catch (e) { failed++; console.error('FAIL #772 console browser ' + name + ' — ' + e.stack); } }

(async () => {
  fs.mkdirSync(shots, { recursive: true });
  const save = world(), browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    await ctx.route('**/*', r => {
      const u = new URL(r.request().url());
      if (u.hostname !== 'console772.test') return r.abort();
      const file = path.resolve(root, '.' + decodeURIComponent(u.pathname));
      if (!file.startsWith(root + path.sep)) return r.abort();
      try { return r.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) }); } catch (e) { return r.fulfill({ status: 404, body: '' }); }
    });
    await ctx.addInitScript(() => { localStorage.setItem('tnd_ambient_enabled_v1', '0'); });
    const page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://console772.test/index.html');
    await page.waitForFunction(() => typeof showConsoleModal === 'function' && typeof showGame === 'function');
    await page.evaluate(s => {
      generateActions = function () {}; speakNarration = function () {}; processPendingCompanionSheets = function () {};
      worldState = s.worldState; memory = s.memory; sessionLog = []; migrateWorldState(worldState);
      document.getElementById('api-screen').style.display = 'none'; showGame(); syncUI();
      [].forEach.call(document.querySelectorAll('.tnd-toast'), t => t.remove()); consoleClear(); consoleDotPaint();
    }, save);
    const toasts = () => page.evaluate(() => [].map.call(document.querySelectorAll('.tnd-toast'), t => t.firstChild.textContent));
    const dot = () => page.evaluate(() => { const d = document.getElementById('console-dot'), cs = getComputedStyle(d); return { isNew: d.classList.contains('new'), color: cs.backgroundColor, title: document.getElementById('console-btn').title }; });
    const green = await page.evaluate(() => { const p = document.createElement('i'); p.style.color = 'var(--grn)'; document.body.appendChild(p); const c = getComputedStyle(p).color; p.remove(); return c; });

    await test('the Console button is the last of the row, right of Table Talk, with a grey dot at rest', async () => {
      const r = await page.evaluate(() => { const tt = document.getElementById('tab-tabletalk').getBoundingClientRect(), c = document.getElementById('console-btn').getBoundingClientRect(); return { right: c.left >= tt.right, sameRow: Math.abs(c.top - tt.top) < 2, visible: c.width > 0 && c.right <= innerWidth, last: document.getElementById('chat-tabs').lastElementChild.id }; });
      assert.deepEqual(r, { right: true, sameRow: true, visible: true, last: 'console-btn' });
      const d = await dot(); assert.equal(d.isNew, false); assert.notEqual(d.color, green, 'grey at rest');
      await page.screenshot({ path: path.join(shots, 'console-rest-desktop.png') });
    });

    await test('a notice is collected: no popup, the dot turns green and the button says how many', async () => {
      await page.evaluate(() => { showToast('⚑ Quest opportunity: The Bell'); showToast('Map: the mire is drawn as a marsh.', 6000); });
      assert.deepEqual(await toasts(), [], 'nothing popped');
      const d = await dot(); assert.equal(d.isNew, true); assert.equal(d.color, green, 'the green the health dot wears'); assert.match(d.title, /^2 new lines/);
      await page.screenshot({ path: path.join(shots, 'console-new-desktop.png') });
    });

    await test('an inventory change still pops up, and is on record without counting as new', async () => {
      await page.evaluate(() => { showToast('🎒 Collected: rope', undefined, { kind: 'inventory' }); });
      assert.deepEqual(await toasts(), ['🎒 Collected: rope']);
      assert.deepEqual(await page.evaluate(() => [consoleEntries().length, consoleNewCount()]), [3, 2]);
      await page.evaluate(() => [].forEach.call(document.querySelectorAll('.tnd-toast'), t => t.remove()));
    });

    await test('opening the console lists every line oldest first and turns the dot grey; a line that lands while it is open is shown and stays read', async () => {
      await page.locator('#console-btn').click(); await page.waitForSelector('#console-modal');
      let rows = await page.evaluate(() => [].map.call(document.querySelectorAll('#console-rows .console-row'), r => r.textContent));
      assert.equal(rows.length, 3); assert.match(rows[0], /turn 5 ⚑ Quest opportunity: The Bell$/); assert.match(rows[2], /Collected: rope$/);
      assert.equal((await dot()).isNew, false, 'read');
      await page.screenshot({ path: path.join(shots, 'console-open-desktop.png') });
      await page.evaluate(() => showToast('Sheet synced.'));
      rows = await page.evaluate(() => [].map.call(document.querySelectorAll('#console-rows .console-row'), r => r.textContent));
      assert.equal(rows.length, 4); assert.match(rows[3], /Sheet synced\.$/); assert.deepEqual(await toasts(), []);
      assert.equal((await dot()).isNew, false, 'seen as it landed');
    });

    await test('Clear empties the console and says so; closing leaves the dot grey', async () => {
      await page.locator('#console-clear').click();
      assert.match(await page.evaluate(() => document.getElementById('console-rows').textContent), /Nothing yet/);
      assert.equal(await page.evaluate(() => consoleEntries().length), 0);
      await page.locator('#console-x').click(); assert.equal(await page.evaluate(() => !!document.getElementById('console-modal')), false);
      assert.equal((await dot()).isNew, false);
    });

    await test('a notice pops when the console cannot be opened: in Car Mode, and with no game on screen', async () => {
      await page.evaluate(() => { carMode = true; showToast('Heard in the car'); carMode = false; });
      assert.deepEqual(await toasts(), ['Heard in the car'], 'Car Mode covers the button');
      await page.evaluate(() => { [].forEach.call(document.querySelectorAll('.tnd-toast'), t => t.remove()); document.getElementById('game-screen').style.display = 'none'; showToast('Start a game first.'); });
      assert.deepEqual(await toasts(), ['Start a game first.'], 'no game screen, no console door');
      assert.equal(await page.evaluate(() => consoleNewCount()), 0, 'a popped line is not new');
      await page.evaluate(() => { [].forEach.call(document.querySelectorAll('.tnd-toast'), t => t.remove()); showGame(); syncUI(); });
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await test('on a 375 px phone the button fits the row and the console fits the screen', async () => {
      await page.evaluate(() => { consoleClear(); showToast('★ Defining moment: the bell rang twice'); });
      const r = await page.evaluate(() => { const c = document.getElementById('console-btn').getBoundingClientRect(), tt = document.getElementById('tab-tabletalk').getBoundingClientRect(); return { inView: c.left >= 0 && c.right <= innerWidth && c.width > 40, right: c.left >= tt.right, isNew: document.getElementById('console-dot').classList.contains('new') }; });
      assert.deepEqual(r, { inView: true, right: true, isNew: true });
      await page.screenshot({ path: path.join(shots, 'console-new-phone.png') });
      await page.locator('#console-btn').click(); await page.waitForSelector('#console-modal');
      const box = await page.evaluate(() => { const b = document.getElementById('console-modal').firstChild.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight; });
      assert.equal(box, true); await page.screenshot({ path: path.join(shots, 'console-open-phone.png') });
      await page.locator('#console-x').click();
    });

    await test('no page error was raised', async () => { assert.deepEqual(errors, []); });
    console.log('screenshots: ' + shots);
  } finally { await browser.close(); }
  console.log(passed + ' passed, ' + failed + ' failed'); process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
