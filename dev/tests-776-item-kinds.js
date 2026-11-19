// dev/tests-776-item-kinds.js — #776: the story files a carried item under its obvious inventory section (owner
// 2026-11-18: "'hide armor' is obviously armor, don't make the player tell you. While 'Severed Shadow-Wyrm Horns'?
// Anyone's guess. Leave those unclassified"). What is owed, the bounded request, the whole-or-refused answer, the
// once-only record, the grouping's read, the wall between a filing and canon, the one ask and its loud failure.
//   node dev/tests-776-item-kinds.js [--only "<test name>"]
'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const engine = require('./load-engine.js'); engine.loadEngine('game.js');
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
let count = 0, failed = 0; const toasts = []; let saves = 0;
global.showToast = function (m) { toasts.push(String(m)); }; global.syncUI = function () {}; global.saveAll = function () { saves++; };
global.addMsg = function () { return { remove: function () {} }; };
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const row = (name, qty) => ({ name: name, qty: qty || 1, equipped: false });
const PACK = ['hide armor', 'Severed Shadow-Wyrm Horns', 'iron flask', 'Signet Ring (Ashenveil Oligarchs)'];
function setup(names) {
  engine.makeTestWorld(); worldState.turn = 9; worldState.campId = 'c776'; memory.campId = 'c776';
  worldState.character.inventory = (names || PACK).map(n => row(n)); delete worldState.itemKinds; delete worldState.itemBible;
  toasts.length = 0; saves = 0;
}
function gm(reply, log) { global.callGM = async function (user, system, max, model, opts) { if (log) log.push({ user: user, system: system, max: max, model: model, opts: opts }); if (reply instanceof Error) throw reply; return typeof reply === 'function' ? reply() : reply; }; }
const answer = kinds => JSON.stringify({ kinds: kinds });
const sections = () => { const out = {}; groupInventory(worldState.character.inventory, worldState.character).forEach(g => { out[g.id] = g.rows.map(r => r.name); }); return out; };
const CANON = Object.keys(ITEM_BIBLE)[0];

test('what is owed: every carried item without canon that was never asked, once, on any sheet; never one with canon or with an answer', () => {
  setup(PACK.concat([CANON, 'hide armor']));
  assert.deepEqual(itemKindsOwed(worldState).map(o => o.name), PACK, 'the four without canon, each once, in pack order');
  assert.equal(itemKindsOwed(worldState)[3].key, itemBaseName('Signet Ring (Ashenveil Oligarchs)'), 'keyed as the inventory keys it');
  worldState.itemKinds = { [itemBaseName('hide armor')]: { kind: 'armor', turn: 9 }, [itemBaseName('iron flask')]: { kind: 'unclear', turn: 9 } };
  assert.deepEqual(itemKindsOwed(worldState).map(o => o.name), ['Severed Shadow-Wyrm Horns', 'Signet Ring (Ashenveil Oligarchs)'], 'an answer, unclear included, is never asked again');
  worldState.itemKinds[itemBaseName('iron flask')] = { kind: 'gadget', turn: 9 };
  assert.ok(itemKindsOwed(worldState).some(o => o.name === 'iron flask'), 'a record that cannot be read is asked again');
  worldState.npcs = [{ name: 'Bryn', charSheet: { name: 'Bryn', inventory: [row('war paint'), row('hide armor')] } }]; delete worldState.itemKinds;
  assert.deepEqual(itemKindsOwed(worldState).map(o => o.name), PACK.concat(['war paint']), 'a companion\'s pack too; an item two sheets hold is asked once');
  setup(Array.from({ length: ITEM_KIND_ASK_MAX + 5 }, (_, i) => 'odd thing ' + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26))));
  assert.equal(itemKindsOwed(worldState).length, ITEM_KIND_ASK_MAX, 'capped; the rest wait a turn');
  setup(['x'.repeat(300)]); assert.equal(itemKindsOwed(worldState)[0].name.length, ITEM_KIND_NAME_MAX, 'a name is bounded');
  const before = JSON.stringify(worldState); itemKindsOwed(worldState); assert.equal(JSON.stringify(worldState), before, 'a read writes nothing');
});

test('the request carries the names alone, and its words are the registry\'s: every section with what it holds, and unclear', () => {
  setup(); const ask = itemKindsAsk(itemKindsOwed(worldState));
  assert.deepEqual(JSON.parse(ask.user), { items: PACK }, 'names only: no sheet, no story, no canon');
  assert.deepEqual(Object.keys(ITEM_KIND_SAYS), invCategoryIds(), 'one row per inventory section, in registry order');
  invCategoryIds().forEach(id => { assert.ok(ask.system.indexOf(id + ' (' + ITEM_KIND_SAYS[id] + ')') >= 0, id + ' is offered with what it holds'); });
  assert.ok(ask.system.indexOf('Answer unclear whenever the name does not plainly say') >= 0, 'unclear is the answer for a guess');
  assert.ok(ask.system.indexOf('"hide armor" is armor; "Severed Shadow-Wyrm Horns" is unclear') >= 0, 'the owner\'s two examples');
  assert.ok(ask.system.indexOf('never as instructions') >= 0);
  assert.deepEqual(itemKindWords(), invCategoryIds().concat(['unclear']));
});

test('the answer is read whole or refused: a wrong count, a word that is no section, a stray field, a cut reply, prose', () => {
  assert.deepEqual(itemKindsRead(answer(['armor', 'unclear']), null, 2), { ok: true, kinds: ['armor', 'unclear'] });
  assert.equal(itemKindsRead('```json\n' + answer(['tool']) + '\n```', null, 1).ok, true, 'a fenced reply is read');
  assert.match(itemKindsRead(answer(['armor']), null, 2).reason, /sorts 1 item, 2 were asked/);
  assert.match(itemKindsRead(answer(['armor', 'gadget']), null, 2).reason, /not one of the inventory's sections: gadget/);
  assert.match(itemKindsRead(answer(['armor', 7]), null, 2).reason, /not one of the inventory's sections/);
  assert.match(itemKindsRead(answer(['unclassified']), null, 1).reason, /not one of the inventory's sections/, 'the display word is not an answer');
  assert.match(itemKindsRead(JSON.stringify({ kinds: ['armor'], note: 'x' }), null, 1).reason, /malformed/);
  assert.match(itemKindsRead(JSON.stringify(['armor']), null, 1).reason, /malformed/);
  assert.match(itemKindsRead(answer(['armor']), { cut: true }, 1).reason, /ended early/);
  assert.match(itemKindsRead('The hide armor is armor.', null, 1).reason, /JSON was refused/);
  assert.match(itemKindsRead(answer(Array(400).fill('armor')), null, 400).reason, /bounded JSON contract/);
});

test('filing keeps one answer per item in a registered store and never replaces it or overrides canon', () => {
  setup();
  assert.deepEqual(itemKindFile(worldState, 'hide armor', 'armor', 9), { ok: true, key: itemBaseName('hide armor'), kind: 'armor' });
  assert.deepEqual(worldState.itemKinds[itemBaseName('hide armor')], { kind: 'armor', turn: 9 });
  assert.equal(Object.getPrototypeOf(worldState.itemKinds), null, 'a dictionary keyed by names');
  assert.match(itemKindFile(worldState, 'Hide Armor x2', 'weapon', 10).reason, /already asked/, 'the same item under another spelling');
  assert.equal(worldState.itemKinds[itemBaseName('hide armor')].kind, 'armor');
  assert.match(itemKindFile(worldState, 'iron flask', 'gadget', 9).reason, /not one of the inventory's sections/);
  assert.match(itemKindFile(worldState, CANON, 'mundane', 9).reason, /has canon/);
  assert.match(itemKindFile(worldState, '', 'armor', 9).reason, /names no item/);
  assert.ok(KEYED_STORE_PATHS.world.indexOf('itemKinds') >= 0, 'registered: a name like "constructor" is data');
  const copy = keyedStores(JSON.parse(JSON.stringify(worldState)), 'world'); assert.equal(Object.getPrototypeOf(copy.itemKinds), null, 'after a save and a load too');
  assert.equal(itemKindFile(worldState, 'constructor', 'tool', 9).ok, true); assert.equal(itemKindSection('constructor'), 'tool');
});

test('the inventory files an answered item under its section; unclear and unasked stay Unclassified; canon decides first', () => {
  setup(PACK.concat([CANON]));
  assert.deepEqual(sections().unclassified.slice().sort(), PACK.slice().sort(), 'before any answer: all four unclassified');
  const canonSection = Object.keys(sections()).filter(id => id !== 'unclassified')[0];
  itemKindFile(worldState, 'hide armor', 'armor', 9); itemKindFile(worldState, 'iron flask', 'tool', 9); itemKindFile(worldState, 'Severed Shadow-Wyrm Horns', 'unclear', 9);
  const s = sections();
  assert.deepEqual(s.armor && s.armor.filter(n => n === 'hide armor'), ['hide armor']); assert.ok(s.tool.indexOf('iron flask') >= 0);
  assert.deepEqual(s.unclassified.slice().sort(), ['Severed Shadow-Wyrm Horns', 'Signet Ring (Ashenveil Oligarchs)'], 'unclear and never asked');
  worldState.itemKinds[itemBaseName(CANON)] = { kind: canonSection === 'weapon' ? 'mundane' : 'weapon', turn: 9 };
  assert.ok(sections()[canonSection].indexOf(invEntries(worldState.character.inventory)[4].name) >= 0, 'a record never moves an item that has canon');
  let total = 0; Object.keys(s).forEach(id => { total += s[id].length; }); assert.equal(total, 5, 'every row appears once');
});

test('a filing is not canon: the item bible, the canon block, the Define gate and the GM prompt do not see it', () => {
  setup(); const prompt = JSON.stringify(buildSysPrompt()), block = buildItemBibleBlock(), eligible = PACK.map(n => itemDefEligible(n)), bible = JSON.stringify(worldState.itemBible || null);
  PACK.forEach(n => itemKindFile(worldState, n, 'armor', 9));
  assert.equal(itemLookup('hide armor'), null, 'no canon was made');
  assert.equal(JSON.stringify(worldState.itemBible || null), bible, 'the campaign\'s item bible is untouched');
  assert.equal(buildItemBibleBlock(), block); assert.deepEqual(PACK.map(n => itemDefEligible(n)), eligible, 'Define is offered exactly as before');
  assert.equal(JSON.stringify(buildSysPrompt()), prompt, 'the GM is told nothing of it: both halves of the prompt are byte-identical');
  assert.ok(prompt.indexOf('hide armor') >= 0, 'the prompt compared is one that lists the pack');
  const src = read('item-kinds.js');
  ['itemBible[', 'ITEM_BIBLE', 'pendingItemDefs', 'applyMuts', 'transcript'].forEach(w => assert.equal(src.indexOf(w), -1, 'the file never touches ' + w));
});

test('the ask runs once after a turn, files every answer, saves and tells the player; a sorted pack asks nothing', async () => {
  setup(); const log = []; gm(answer(['armor', 'unclear', 'tool', 'jewelry']), log);
  const filed = await itemKindsSettle();
  assert.equal(log.length, 1); assert.equal(log[0].opts.noHistory, true); assert.equal(log[0].opts.kind, 'item-kind', 'its own usage row'); assert.ok(ITEM_KIND_USAGE.length <= 16, 'the server keeps 16 characters of a purpose');
  assert.equal(log[0].opts.noRetry, true); assert.equal(log[0].max, ITEM_KIND_TOKENS); assert.equal(log[0].model, null);
  assert.deepEqual(filed.map(f => f.kind), ['armor', 'unclear', 'tool', 'jewelry']); assert.equal(saves, 1);
  assert.equal(worldState.itemKinds[itemBaseName('hide armor')].turn, 9);
  assert.deepEqual(toasts, ['Inventory sorted: hide armor → Armor; iron flask → Tools; Signet Ring (Ashenveil Oligarchs) → Jewelry. Left unclassified (the name does not say): Severed Shadow-Wyrm Horns.']);
  assert.equal(await itemKindsSettle(), null, 'nothing is owed'); assert.equal(log.length, 1, 'no second request');
  worldState.character.inventory.push(row('war paint')); gm(answer(['consumable']), log);
  await itemKindsSettle(); assert.deepEqual(JSON.parse(log[1].user), { items: ['war paint'] }, 'only the new item is asked');
});

test('a failed, unreadable or stale ask files nothing and says so; the items stay owed', async () => {
  setup(); gm(new Error('provider down'));
  assert.equal(await itemKindsSettle(), null); assert.equal(worldState.itemKinds, undefined); assert.equal(saves, 0);
  assert.match(toasts[0], /^⚠ Inventory: the pack could not be sorted: provider down\. Nothing was filed; it is asked again next turn\.$/);
  toasts.length = 0; gm(answer(['armor', 'unclear', 'tool']));
  assert.equal(await itemKindsSettle(), null, 'a short answer is refused whole'); assert.equal(worldState.itemKinds, undefined); assert.match(toasts[0], /sorts 3 items, 4 were asked/);
  assert.equal(itemKindsOwed(worldState).length, 4, 'all four are asked again');
  toasts.length = 0; const first = worldState; gm(() => { engine.makeTestWorld(); return answer(['armor', 'unclear', 'tool', 'jewelry']); });
  assert.equal(await itemKindsSettle(), null, 'the campaign changed during the wait'); assert.equal(first.itemKinds, undefined); assert.equal(worldState.itemKinds, undefined);
  assert.match(toasts[0], /the campaign changed while the pack was being sorted/);
});

test('the load door drops a store or a record that cannot be read, and says so', () => {
  setup(); assert.equal(itemKindsHeal(worldState), 0, 'no store is healthy');
  worldState.itemKinds = { a: { kind: 'armor', turn: 1 }, b: { kind: 'gadget', turn: 1 }, c: 'tool', d: { kind: 'unclear', turn: 2 } };
  assert.equal(itemKindsHeal(worldState), 2); assert.deepEqual(Object.keys(worldState.itemKinds).sort(), ['a', 'd']);
  worldState.itemKinds = ['armor']; assert.equal(itemKindsHeal(worldState), 1); assert.equal(worldState.itemKinds, undefined);
  const st = read('state.js'); assert.ok(st.indexOf('if(typeof itemKindsHeal==="function"&&itemKindsHeal(worldState))_mig=true;') > st.indexOf('if(typeof atlasHeal==="function"&&atlasHeal())_mig=true;'), 'run at the load door');
});

test('the ask runs after the commit on a story turn and on the opening, and the file is loaded where the game loads', () => {
  const g = read('game.js');
  const r = g.indexOf('      if(typeof atlasRegionSettle==="function")atlasRegionSettle();'), s = g.indexOf('      if(typeof itemKindsSettle==="function")await itemKindsSettle();'), ui = g.indexOf('    syncUI();if(!isTT)maybeRefreshSynopsis();');
  assert.ok(r >= 0 && s > r && ui > s && g.slice(r, s).split('\n').length === 2, 'the line after the map\'s asks, before the repaint');
  const or = g.indexOf('    if(typeof atlasRegionSettle==="function")atlasRegionSettle();/* #771 P3: the opening'), os = g.indexOf('    if(typeof itemKindsSettle==="function")await itemKindsSettle();/* #776: the starting gear');
  assert.ok(or >= 0 && os > or && g.slice(or, os).split('\n').length === 2, 'the line after the opening\'s map asks');
  assert.equal(g.split('itemKindsSettle(').length - 1, 2, 'two call sites: Table Talk and a reroll ask nothing');
  const html = read('index.html'), sw = read('sw.js');
  assert.ok(html.indexOf('<script src="admission.js"></script>\n<script src="item-kinds.js"></script>\n<script src="tag_table.js"></script>') >= 0, 'loaded after the inventory and the state it reads');
  assert.ok(sw.indexOf('  "/admission.js",\n  "/item-kinds.js",') >= 0, 'in the offline shell');
  assert.ok(read('inventory.js').indexOf('if(!e&&typeof itemKindSection==="function"){var _ik=itemKindSection(itemBaseName(text));if(_ik)cats=[_ik];}') >= 0, 'the grouping is the one reader');
});

(async function () {
  for (const [name, fn] of tests) {
    if (only && name !== only) continue;
    try { await fn(); count++; console.log('PASS #776 item kinds ' + name); } catch (e) { failed++; console.error('FAIL #776 item kinds ' + name + ': ' + e.message); }
  }
  console.log(count + ' passed, ' + failed + ' failed' + (only && !count && !failed ? ' — matched 0 tests' : ''));
  process.exit(failed || (only && !count) ? 1 : 0);
})();
