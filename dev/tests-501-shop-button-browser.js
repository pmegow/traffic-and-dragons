// tests-501-shop-button-browser.js — #501, the real-browser half: the narration's own Shop button. It sits on the newest
// scene's Render row at the panel's right edge, only while there is a counter to open; a new scene takes it from the one
// before; walking out, or the keeper leaving, turns it off. Real index.html in Chrome (dev/cdp-browser.js) over the village
// fixture of the engine tests — no model, no network, no spend.
//   node dev/tests-501-shop-button-browser.js          (SHOP_SHOTS=<dir> also writes screenshots there)
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { chromium } = require('./cdp-browser.js');
const root = path.resolve(__dirname, '..'), SHOTS = process.env.SHOP_SHOTS || '';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS #501 ' + name); } catch (e) { failed++; console.error('FAIL #501 ' + name + ' — ' + (e && e.message || e)); } }

// The engine tests' village (villageEF): two residents with houses, a tavern with Frizwick behind the counter, the hero inside.
function fixture() {
  const quiet = console.info; console.info = function () {};
  try {
    const engine = require('./load-engine.js'); engine.loadEngine(); engine.makeTestWorld();
    worldState.kind = 'village'; worldState.world.location = 'The Village'; worldState.world.sublocation = null;
    worldState.character.name = 'Silas'; worldState.character.gold = 25; worldState.turn = 240;
    if (!memory.map) memory.map = { nodes: {}, edges: [], lastArrivalFrom: null };
    memory.map.nodes['The Village'] = { firstVisit: 1, visits: 3, description: null, parent: null, npcs: [], items: [], size: 'small', travelMins: null };
    importVillageResidents([{ name: 'Frizwick', gender: 'F', cls: 'Rogue' }, { name: 'Daeris', gender: 'F', cls: 'Cleric' }]);
    const now = clockNow();
    memory.map.nodes['The Village|the tavern'] = { firstVisit: 1, visits: 2, description: null, parent: 'The Village', npcs: [], items: [], size: 'small', travelMins: null,
      wares: [{ item: 'Smoked fish', price: '1 gp', note: 'sold by Frizwick', t: 240, min: now, at: 'the tavern' }] };
    memory.npcs['Frizwick'].lastSeenAt = 'The Village|the tavern'; memory.npcs['Daeris'].lastSeenAt = "The Village|Daeris's house";
    worldState.world.sublocation = 'the tavern';
    worldState.character.inventory = ['Longsword', 'Rope x3'];
    worldState.transcript = [
      { r: 'player', x: 'I cross the square.', t: 239 },
      { r: 'gm', x: 'The square is quiet. Woodsmoke hangs over the tavern door.', t: 239 },
      { r: 'player', x: 'I push open the tavern door.', t: 240 },
      { r: 'gm', x: 'The taproom is warm and loud. Frizwick looks up from behind the counter and nods you toward the shelf of smoked fish.', t: 240 }
    ];
    worldState.lastActions = ['Ask Frizwick what is fresh today.', 'Take a seat by the hearth.', 'Look over the shelf.', 'Call on Daeris.'];
    return JSON.parse(JSON.stringify({ world: worldState, memory: memory }));
  } finally { console.info = quiet; }
}

(async () => {
  const fx = fixture();
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined), headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 760 }, serviceWorkers: 'block' }), errors = [];
    await ctx.route('**/*', async route => {
      const u = new URL(route.request().url()); if (u.hostname !== 'shop.test') return route.abort();
      const f = path.resolve(root, '.' + decodeURIComponent(u.pathname)); if (!f.startsWith(root + path.sep)) return route.abort();
      try { return route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) }); } catch (e) { return route.fulfill({ status: 404, body: 'Not found' }); }
    });
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://shop.test/index.html');
    await page.waitForFunction(() => typeof showShopModal === 'function' && typeof rebuildNarrativeFromTranscript === 'function' && typeof syncUI === 'function');
    // a reload: the saved state goes in, the story is rebuilt from the transcript, the stored buttons are repainted
    await page.evaluate(f => {
      worldState = f.world; memory = f.memory; sessionLog = [];
      document.getElementById('api-screen').style.display = 'none'; showGame(); syncUI(); rebuildNarrativeFromTranscript(20, true);
      window.__sent = []; sendAction = function (t) { window.__sent.push(String(t)); };
      window.__toasts = []; var st = showToast; showToast = function (m) { window.__toasts.push(String(m)); return st.apply(this, arguments); };
    }, fx);
    const shot = async name => { if (SHOTS) { await page.evaluate(() => { var s = document.getElementById('story-narrative'); s.scrollTop = s.scrollHeight; }); await page.waitForTimeout(150); await page.screenshot({ path: path.join(SHOTS, name) }); } };
    // every fact about the button the eye would check, measured from the render
    const facts = () => page.evaluate(() => {
      var frames = document.querySelectorAll('#story-narrative .msg.narrator[data-turn]'), all = document.querySelectorAll('#story-narrative .frame-shop'), newest = frames[frames.length - 1];
      var b = all.length ? all[all.length - 1] : null, o = { count: all.length, frames: frames.length };
      if (!b) return o;
      var host = b.closest('.msg'), r = b.getBoundingClientRect(), hr = host.getBoundingClientRect(), cs = getComputedStyle(host);
      var rb = host.querySelector('.frame-render'), rr = rb ? rb.getBoundingClientRect() : null, q = host.querySelector('button.qa'), sr = q ? q.parentNode.getBoundingClientRect() : null;
      var inner = hr.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
      o.onNewest = host === newest; o.hostTurn = host.getAttribute('data-turn'); o.text = b.textContent; o.title = b.title; o.visible = r.width > 0 && r.height > 0;
      o.gapRight = Math.round(hr.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth) - r.right);
      o.rowOffset = rr ? Math.round(Math.abs((r.top + r.height / 2) - (rr.top + rr.height / 2))) : null;
      o.rightOfRender = rr ? r.left >= rr.right : null;
      o.belowGap = sr ? Math.round(sr.top - r.bottom) : null; o.suggestWidth = sr ? Math.round(sr.width) : null; o.innerWidth = Math.round(inner);
      return o;
    });
    const placed = (f, where) => {
      assert.equal(f.count, 1, where + ': exactly one Shop button in the story: ' + JSON.stringify(f));
      assert.equal(f.onNewest, true, where + ': it sits on the newest scene: ' + JSON.stringify(f));
      assert.equal(f.text, 'Shop'); assert.equal(f.visible, true, where + ': it is visible');
      assert.ok(f.gapRight >= 0 && f.gapRight <= 2, where + ': it meets the right edge of the panel (gap ' + f.gapRight + 'px)');
      assert.equal(f.rightOfRender, true, where + ': it is to the right of Render');
      assert.ok(f.rowOffset !== null && f.rowOffset <= 3, where + ': it is on the Render row (centres ' + f.rowOffset + 'px apart)');
    };

    await test('after a reload in a shop with its keeper, the newest scene carries ONE Shop button on its Render row, at the panel\'s right edge', async () => {
      const f = await facts(); placed(f, 'reload');
      assert.equal(f.frames, 2, 'the fixture has two scenes'); assert.equal(f.hostTurn, '240');
      assert.match(f.title, /Frizwick/, 'the tooltip names the keeper: ' + f.title); assert.match(f.title, /the tavern/, 'and the shop: ' + f.title);
      assert.ok(f.belowGap >= 0, 'the suggestions start below it, not beside it (gap ' + f.belowGap + 'px)');
      assert.ok(Math.abs(f.suggestWidth - f.innerWidth) <= 1, 'the suggestion row keeps the panel\'s full width (' + f.suggestWidth + ' of ' + f.innerWidth + ')');
      await shot('501_reload.png');
    });
    await test('the stored fourth suggestion is left as the turn wrote it (the button is not a suggestion)', async () => {
      const q = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#story-narrative .msg.narrator[data-turn="240"] button.qa'), b => b.textContent));
      assert.deepEqual(q, ['Ask Frizwick what is fresh today.', 'Take a seat by the hearth.', 'Look over the shelf.', 'Call on Daeris.']);
    });
    const present = async () => assert.equal(await page.evaluate(() => document.querySelectorAll('#story-narrative .frame-shop').length), 1, 'the Shop button is there to click');
    await test('a real click opens the counter: no turn is sent and nothing is typed', async () => {
      await present(); await page.locator('#story-narrative .frame-shop').click(); await page.waitForTimeout(300);
      const r = await page.evaluate(() => ({ modal: !!document.querySelector('#shop-modal .shop-grid'), who: Array.prototype.map.call(document.querySelectorAll('.shop-who'), e => e.textContent), sent: window.__sent, typed: document.getElementById('action-input').value }));
      assert.equal(r.modal, true, 'the counter is open'); assert.deepEqual(r.who, ['Silas', 'Frizwick']); assert.deepEqual(r.sent, []); assert.equal(r.typed, '');
      await shot('501_counter.png');
      await page.evaluate(() => { var x = document.getElementById('ledger-x'); if (x) x.click(); });
    });
    await test('while a turn is in flight the click waits: a toast, no counter', async () => {
      await present(); await page.evaluate(() => { busy = true; window.__toasts.length = 0; });
      await page.locator('#story-narrative .frame-shop').click(); await page.waitForTimeout(200);
      const r = await page.evaluate(() => { var o = { modal: !!document.querySelector('#shop-modal'), toasts: window.__toasts.slice() }; busy = false; return o; });
      assert.equal(r.modal, false, 'no counter opens under a turn'); assert.match(r.toasts.join(' | '), /Wait for the turn to finish/);
    });
    await test('the keeper leaving turns it off; the keeper back turns it on — on the Render row again, above the suggestions', async () => {
      await page.evaluate(() => { memory.npcs['Frizwick'].lastSeenAt = villageHouseKey('Frizwick'); syncUI(); });
      assert.equal((await facts()).count, 0, 'nobody behind the counter: no button');
      await page.evaluate(() => { memory.npcs['Frizwick'].lastSeenAt = 'The Village|the tavern'; syncUI(); });
      const f = await facts(); placed(f, 'keeper back');   // this scene already has its suggestion row: a re-made button must not land under it
      assert.ok(f.belowGap >= 0, 'the suggestions are still below it (gap ' + f.belowGap + 'px)');
      assert.ok(Math.abs(f.suggestWidth - f.innerWidth) <= 1, 'and keep the full width (' + f.suggestWidth + ' of ' + f.innerWidth + ')');
    });
    await test('a new scene written in the shop takes the button; the scene before it loses it', async () => {
      await page.evaluate(() => { worldState.turn = 241; addMsg('player', 'I ask about the fish.'); addMsg('narrator', '<p>Frizwick wipes her hands and names a price.</p>', { replayText: 'Frizwick wipes her hands and names a price.', turn: 241, ck: clockNow() }); });
      const f = await facts(); placed(f, 'new scene'); assert.equal(f.hostTurn, '241', 'the new scene holds it');
      assert.equal(await page.evaluate(() => document.querySelectorAll('#story-narrative .msg.narrator[data-turn="240"] .frame-shop, #story-narrative .msg.narrator[data-turn="240"] .frame-shop-wrap').length), 0, 'the old scene\'s button is off');
      await shot('501_new_scene.png');
    });
    await test('a narrator line that is not a scene (a level-up note) does not take the button', async () => {
      await page.evaluate(() => { addMsg('narrator', '<p><em>You gain Second Wind.</em></p>'); });
      const f = await facts(); assert.equal(f.count, 1); assert.equal(f.hostTurn, '241', 'it stays on the newest SCENE');
    });
    await test('walking out turns it off; walking back in turns it on (the real tag path)', async () => {
      await page.evaluate(() => { applyMuts('You step out into the square. [SUBLOCATION_LEAVE]'); });
      assert.equal((await facts()).count, 0, 'outside the shop there is no button');
      await page.evaluate(() => { applyMuts('[SUBLOCATION:the tavern]'); });
      placed(await facts(), 'back inside');
    });
    await test('a scene written outside a shop carries no button, and the last shop scene keeps none', async () => {
      await page.evaluate(() => { applyMuts('[SUBLOCATION_LEAVE]'); worldState.turn = 242; addMsg('narrator', '<p>The square is bright after the taproom.</p>', { replayText: 'The square is bright after the taproom.', turn: 242, ck: clockNow() }); });
      assert.equal((await facts()).count, 0);
      await page.evaluate(() => { applyMuts('[SUBLOCATION:the tavern]'); });
      const f = await facts(); placed(f, 'in again without a new scene'); assert.equal(f.hostTurn, '242', 'the newest scene is the only home');
    });
    await test('a kind with no counter never draws it (the adventure)', async () => {
      await page.evaluate(() => { worldState.kind = 'adventure'; syncUI(); });
      assert.equal((await facts()).count, 0);
      await page.evaluate(() => { worldState.kind = 'village'; syncUI(); });
      placed(await facts(), 'the village again');
    });
    await test('on a phone it is still on the Render row at the right edge, and the suggestions keep their width', async () => {
      await page.setViewportSize({ width: 375, height: 740 }); await page.waitForTimeout(250);
      await page.evaluate(() => { rebuildNarrativeFromTranscript(20, true); });
      const f = await facts(); placed(f, 'phone');
      assert.ok(f.belowGap >= 0, 'the suggestions start below it (gap ' + f.belowGap + 'px)');
      assert.ok(Math.abs(f.suggestWidth - f.innerWidth) <= 1, 'the suggestion row keeps the full width (' + f.suggestWidth + ' of ' + f.innerWidth + ')');
      await shot('501_phone.png');
      await page.setViewportSize({ width: 1000, height: 760 });
    });
    // #527(24): exact live-combat fixture, plus a counter opened while peaceful and committed after combat starts.
    const combatFixture = JSON.parse(JSON.stringify(fx));
    combatFixture.world.character.coin = 6000;
    combatFixture.world.combat = { round: 1, engaged: null, foes: [{ name: 'Tavern bandit', hp: 12, maxHp: 12 }] };
    combatFixture.memory.map.nodes['The Village|the tavern'].wares[0].cp = 100;
    combatFixture.memory.map.nodes['The Village|the tavern'].wares[0].per = 1;
    combatFixture.world.transcript[3].x = 'A bandit draws a blade in the taproom. Combat is underway; Frizwick is still behind the counter.';
    const resetCombatFixture = async fighting => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.evaluate(f => {
        worldState = f.world; memory = f.memory; sessionLog = []; busy = false;
        saveAll = function () {}; saveCore = function () {}; saveMem = function () {};
        var modal = document.getElementById('shop-modal'); if (modal) modal.remove();
        window.__toasts.length = 0; document.querySelectorAll(".tnd-toast").forEach(e => e.remove()); showGame(); syncUI(); rebuildNarrativeFromTranscript(20, true);
      }, Object.assign({}, combatFixture, { world: Object.assign({}, combatFixture.world, { combat: fighting ? combatFixture.world.combat : null }) }));
    };
    await test('#527 combat hides both shopping doors and a stale opener gives the reason', async () => {
      await resetCombatFixture(true);
      await shot('527_combat_shop.png');
      const doors = await page.evaluate(() => ({ shop: document.querySelectorAll('#story-narrative .frame-shop').length, trade: document.querySelectorAll('.inv-ledger[data-open="showShopModal"]').length, hp: worldState.combat.foes[0].hp }));
      assert.equal(doors.hp, 12); assert.equal(doors.shop, 0, 'live combat still draws Shop'); assert.equal(doors.trade, 0, 'live combat still draws inventory Trade');
      await page.evaluate(() => invLedgerOpen('showShopModal'));
      assert.equal(await page.evaluate(() => !!document.getElementById('shop-modal')), false, 'a stale opener created a counter');
      assert.match(await page.evaluate(() => window.__toasts.join(' | ')), /combat/i);
    });
    await test('#527 an already open marked counter refuses completion after combat begins, then peace allows trade', async () => {
      await resetCombatFixture(false);
      await page.locator('#story-narrative .frame-shop').click();
      await page.locator('#shop-modal .shop-row[data-side="right"][data-key="smoked fish"]').click();
      await page.evaluate(c => { worldState.combat = c; window.__toasts.length = 0; syncUI(); window.__combatBefore = JSON.stringify([worldState, memory]); }, combatFixture.world.combat);
      await page.locator('#ledger-go').click();
      await shot('527_stale_shop_refused.png');
      const r = await page.evaluate(() => ({ same: JSON.stringify([worldState, memory]) === window.__combatBefore, modal: !!document.getElementById('shop-modal'), toasts: window.__toasts.slice(), coin: worldState.character.coin, hp: worldState.combat.foes[0].hp }));
      assert.equal(r.same, true, 'combat changed transaction state'); assert.equal(r.modal, true, 'refused transaction closed as if completed'); assert.equal(r.coin, 6000); assert.equal(r.hp, 12); assert.match(r.toasts.join(' | '), /Trade refused.*combat/i);
      await page.evaluate(() => { document.getElementById('ledger-x').click(); worldState.combat = null; syncUI(); });
      await page.locator('#story-narrative .frame-shop').click();
      await page.locator('#shop-modal .shop-row[data-side="right"][data-key="smoked fish"]').click();
      await page.locator('#ledger-go').click();
      assert.deepEqual(await page.evaluate(() => ({ coin: worldState.character.coin, bought: worldState.character.inventory.indexOf('Smoked fish') >= 0, modal: !!document.getElementById('shop-modal') })), { coin: 5900, bought: true, modal: false });
    });
    await test('no page error', async () => { assert.deepEqual(errors, []); });
  } finally { await browser.close(); }
  console.log('#501 SHOP BUTTON (browser): ' + failed + ' failed, ' + passed + ' passed');
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
