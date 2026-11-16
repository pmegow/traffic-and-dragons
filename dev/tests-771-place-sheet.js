// dev/tests-771-place-sheet.js — #771 P1 (owner 2026-11-15: "an illustration of the area I'm in… including exits from the
// current location. The next location should have an exit back to the previous one"): a visited place is DRAWN on its own
// ground by TnD Maps' story sheet, from public facts alone. The story decides what exists; the generator draws the ground.
//   node dev/tests-771-place-sheet.js [--only "<test name>"]
'use strict';
const assert = require('assert/strict'), engine = require('./load-engine.js'); engine.loadEngine('game.js');
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
let count = 0, failed = 0; const toasts = [];
global.showToast = function (m) { toasts.push(String(m)); }; global.syncUI = function () {}; global.saveAll = global.saveAll || function () {};
function test(name, fn) {
  if (only && name !== only) return;
  try { fn(); count++; console.log('PASS #771 ' + name); } catch (e) { failed++; console.error('FAIL #771 ' + name + ': ' + e.message); }
}
const MIRE = 'Petrified Mire', CROSS = 'The Crossroads of Ashenveil', RIDGE = MIRE + '|Shattered Ridge';
function setup(at) {
  engine.makeTestWorld(); toasts.length = 0; atlasForget(); worldState.world.location = at || CROSS; worldState.world.sublocation = null; worldState.turn = 1;
  worldState.atlas = { v: ATLAS_VER, seed: 'k771', knowledge: 1 }; memory.map.nodes[worldState.world.location] = newMapNode(0, null); memory.map.nodes[worldState.world.location].visits = 1;
  memory.map.edges = []; memory.map.geography = MapKnowledge.create(); atlasFollow();
}
function go(world, sub) {
  const from = worldState.world.location; worldState.turn++; worldState.world.location = world; worldState.world.sublocation = sub || null;
  const key = sub ? world + '|' + sub : world; if (!memory.map.nodes[key]) memory.map.nodes[key] = newMapNode(worldState.turn, sub ? world : null); memory.map.nodes[key].visits++;
  if (from !== world) memory.map.edges.push({ from: from, to: world, turn: worldState.turn });
  atlasFollow(); return worldState.atlas.at;
}
function turn(text) { worldState.turn++; const muts = applyMuts(text, { deferSave: true }), r = atlasKnowledgeCommitResult(text, muts && muts.mapReveals); assert.equal(r.refusal, null, r.refusal && r.refusal.reason); atlasFollow(); }
const place = (name, container) => ({ id: 's1', name: name, container: container || name });
const feat = (id, label, bearing, mode, t) => ({ id: id, label: label, bearing: bearing || 'N', mode: mode || 'observed', source: { turn: t || 1 } });
const ground = (name, features) => atlasSheetGround(place(name), features || []);
const drawn = d => JSON.stringify([d.relief, d.features.map(f => [f.id, f.x, f.y])]);

test('the tables name only what the library draws, and no noun stands in two rows', () => {
  const terrains = TnDMaps.wild.terrains(), kinds = TnDMaps.wild.kinds();
  for (const table of [ATLAS_SHEET_GROUNDS, ATLAS_SHEET_KINDS]) { const seen = {}; for (const row of table) for (const n of row.nouns) { assert(!seen[n], 'twice: ' + n); seen[n] = 1; } }
  ATLAS_SHEET_GROUNDS.forEach(r => assert(terrains.indexOf(r.terrain) >= 0, r.terrain));
  ATLAS_SHEET_KINDS.forEach(r => assert(kinds.indexOf(r.kind) >= 0, r.kind));
});

test('the ground is what the place\'s own name says: its head noun, a way wearing the ground it runs through', () => {
  assert.equal(ground(MIRE), 'marsh'); assert.equal(ground('Shattered Ridge'), 'mountain'); assert.equal(ground(CROSS), 'heath', 'an "of …" tail is set aside');
  assert.equal(ground('The Boundary Clearing'), 'forest'); assert.equal(ground('The Forest Road'), 'forest'); assert.equal(ground('Dunes of Ash'), 'desert'); assert.equal(ground('The Low Downs'), 'hills');
  assert.equal(ground('Forest Gate Tavern'), null, 'the LAST word decides: a tavern is not a forest');
  assert.equal(ground('Ashenveil'), null); assert.equal(ground('The Wyrm\'s Lair'), null, 'a den is not open ground');
  assert.equal(ground('The King\'s Road'), null, 'a way through no named ground says nothing');
});

test('a plain observed feature may say the ground; a NAME elsewhere, or a report, never does', () => {
  assert.equal(ground('Ashenveil Gate', [feat('f1', 'deep timber', 'unknown')]), 'forest');
  assert.equal(ground('Ashenveil Gate', [feat('f1', 'Shattered Ridge', 'N')]), null, 'a ridge seen to the north does not make this place a mountain');
  assert.equal(ground('Ashenveil Gate', [feat('f1', 'a black marsh', 'N', 'reported')]), null, 'hearsay draws no ground');
});

test('no ground known: the pin sheet stays — the engine never guesses a ground', () => {
  setup('Ashenveil'); turn('[MAP_REVEAL:new|the Iron Gate|N|observed]');
  const d = atlasDoc(worldState.atlas.at);
  assert.equal(d.generator.name, 'schematic'); assert.deepEqual(d.features.map(f => f.name), ['the Iron Gate']); assert.equal(toasts.length, 0, 'and nothing is said: it is not a failure');
});

test('the recipe: features in the order disclosed, each toward its bearing; a plain observed noun picks its mark', () => {
  const r = atlasSheetRecipe(place(MIRE), [feat('f3', 'bone cairn', 'E', 'observed', 1), feat('f1', 'sunken pool', 'W', 'observed', 2), feat('f2', 'beast\'s den', 'SW', 'observed', 2), feat('f4', 'frozen trail', 'S', 'observed', 6)], [], []);
  assert.equal(r.params.terrain, 'marsh'); assert.equal(r.params.title, MIRE); assert.equal(r.params.seed, 's1/sheet');
  assert.deepEqual(r.params.edits.map(e => [e.id, e.kind, e.bearing, e.mode]), [['f3', 'cairn', 'E', 'observed'], ['f1', 'pond', 'W', 'observed'], ['f2', 'den', 'SW', 'observed'], ['f4', 'custom', 'S', 'observed']], 'the turn disclosed, then the id');
  assert.deepEqual(r.params.site, { exits: [], unplaced: [] });
});

test('a NAME, a report and a long label: the plain mark, a ring, a cut — never a type from a name\'s last word', () => {
  const long = 'massive nest woven from petrified timber, crushed bone, and dried gore';
  const r = atlasSheetRecipe(place(MIRE), [feat('f1', 'The Waystone Arch', 'S'), feat('f2', 'a ruined well', 'N', 'reported'), feat('f3', long, 'E')], [], []), e = r.params.edits;
  assert.deepEqual(e.map(x => [x.kind, x.mode]), [['custom', 'observed'], ['custom', 'reported'], ['custom', 'observed']], 'a NAME; a report; a phrase whose LAST word (gore) is no mark');
  assert.equal(e[0].name, 'The Waystone Arch'); assert.equal(e[0].word, 'a place');
  assert.equal(e[2].name.length, 40); assert.equal(e[2].name.slice(-1), '…'); assert.equal(e[2].name.slice(0, 12), long.slice(0, 12));
});

test('what has no direction is listed, never drawn; the ground itself and an exit\'s own place are not pins', () => {
  const ways = [{ id: 'way-1', key: CROSS, name: CROSS, bearing: 'S', lean: 'N', to: 'k771' }];
  const r = atlasSheetRecipe(place(MIRE), [feat('f1', 'a secret aqueduct', 'unknown', 'reported'), feat('f2', 'mire', 'S'), feat('f3', 'fen', 'N'), feat('f4', 'the crossroads of Ashenveil', 'S'), feat('f5', 'ridge', 'N'), feat('f6', 'Black Fen', 'E'), feat('f7', 'The Fen', 'W')], ways, [{ id: 'in-1', name: 'Shattered Ridge', to: 'k771/public/2' }]);
  assert.deepEqual(r.params.edits.map(e => e.name), ['ridge', 'Black Fen', 'The Fen'], 'mire and fen are this marsh\'s own ground; a ridge is a thing seen from it; a NAMED fen is a place');
  assert.deepEqual(r.params.site.unplaced, [{ id: 'f1', name: 'a secret aqueduct', mode: 'reported' }, { id: 'in-1', name: 'Shattered Ridge', mode: 'observed' }]);
  assert.deepEqual(r.params.site.exits, [{ id: 'f4', name: CROSS, sure: true, bearing: 'S' }], 'the feature that names the place IS the exit, under its own id');
});

test('a way whose direction nobody stated is dotted, and its two ends agree: onward lies south, the way back north', () => {
  setup(CROSS); const cross = worldState.atlas.at, mire = go(MIRE);
  const there = atlasDoc(mire).portals, back = atlasDoc(cross).portals;
  assert.deepEqual(back.map(p => [p.kind, p.name, p.bearing, p.sure]), [['exit', MIRE, 'S', false]]);
  assert.deepEqual(there.map(p => [p.kind, p.name, p.bearing, p.sure]), [['exit', CROSS, 'N', false]], 'the next place has its exit back to the previous one');
  assert.equal(atlasDoc(mire).paths.filter(p => p.sure === false).length, 1, 'drawn dotted');
  const r = atlasSheetRecipe(place(MIRE), [], [{ id: 'way-1', name: 'B', bearing: null, lean: 'S' }, { id: 'way-2', name: 'A', bearing: 'S', lean: 'N' }, { id: 'way-3', name: 'C', bearing: null, lean: 'S' }], []);
  assert.deepEqual(r.params.site.exits.map(e => [e.bearing, e.sure]), [['SE', false], ['S', true], ['SW', false]], 'a stated direction keeps its edge whatever the order; the unstated take the next free ones');
});

test('the story states a way\'s direction: the exit lies along it, solid, and the far end is its opposite', () => {
  setup(CROSS); const cross = worldState.atlas.at; turn('[MAP_REVEAL:new|Petrified Mire|NE|observed]'); const mire = go(MIRE);
  assert.deepEqual(atlasDoc(cross).portals.map(p => [p.name, p.bearing, p.sure]), [[MIRE, 'NE', true]]);
  assert.deepEqual(atlasDoc(mire).portals.map(p => [p.name, p.bearing, p.sure]), [[CROSS, 'SW', true]]);
  assert.deepEqual(atlasDoc(cross).features.map(f => f.name), [], 'the exit says it: no second pin for the place it leads to');
  assert.equal(atlasDoc(cross).paths.filter(p => p.sure === false).length, 0);
  const way = atlasDoc(cross).portals[0], fid = atlasKnowledgeProjection(CROSS).features[0].id; assert.equal(way.id, fid, 'one thing, under the id of the feature');
  assert.equal(atlasNoteSet(cross, fid, 'The mire road.').ok, true); const c = atlasCard(cross, { id: fid });
  assert.equal(c.title, 'Petrified Mire'); assert.equal(c.opens, mire, 'its card opens where the way leads'); assert.equal(c.note, 'The mire road.', 'and keeps the note the player wrote'); assert.equal(c.x, way.x); assert.equal(c.y, way.y);
  assert.equal(atlasThings(atlasDoc(cross)).filter(t => t.id === fid).length, 1);
});

test('a place inside another has the way back out; the place around it opens it from its pin, or lists it', () => {
  setup(MIRE); const mire = worldState.atlas.at; turn('[MAP_REVEAL:new|Shattered Ridge|N|observed]'); const ridge = go(MIRE, 'Shattered Ridge');
  assert.equal(atlasPublicPlace(worldState.atlas, ridge).container, RIDGE);
  const out = atlasDoc(ridge); assert.equal(out.kind, 'mountain');
  assert.deepEqual(out.portals.map(p => [p.name, p.bearing, p.sure]), [[MIRE, 'S', true]], 'the ridge lies north of the mire, so the mire lies south of the ridge');
  const card = atlasCard(ridge, { id: 'way-1' }); assert.equal(card.title, 'The way to ' + MIRE); assert.equal(card.opens, mire); assert(/leads south/.test(card.word));
  const pin = atlasDoc(mire).features[0]; assert.equal(pin.name, 'Shattered Ridge'); assert.equal(atlasCard(mire, { id: pin.id }).opens, ridge);
  const hollow = go(MIRE, 'Sunken Hollow'); go(MIRE);
  const listed = atlasDoc(mire).site.unplaced; assert.deepEqual(listed.map(u => u.name), ['Sunken Hollow'], 'a place inside that no feature names is listed');
  const inCard = atlasCard(mire, { id: listed[0].id }); assert.equal(inCard.title, 'Sunken Hollow'); assert.equal(inCard.opens, hollow);
  assert.deepEqual(atlasSheetWays(worldState.atlas, atlasPublicPlace(worldState.atlas, hollow)).map(w => [w.name, w.bearing, w.lean]), [[MIRE, null, 'S']], 'no feature of the mire names the hollow: the way back is unstated');
  /* two steps down: the lair in the ridge in the mire (the owner's hierarchy) */
  go(MIRE, 'Shattered Ridge'); turn('[MAP_REVEAL:new|wyrm lair|W|observed]'); const lair = go(MIRE, 'Shattered Ridge \u2014 Wyrm Lair'), A = worldState.atlas;
  assert.equal(atlasPublicPlace(A, lair).container, RIDGE + ' \u2014 Wyrm Lair'); assert.equal(atlasSheetParent(RIDGE + ' \u2014 Wyrm Lair'), RIDGE); assert.equal(atlasSheetParent(RIDGE), MIRE); assert.equal(atlasSheetParent(MIRE), null);
  assert.deepEqual(atlasSheetWays(A, atlasPublicPlace(A, lair)).map(w => [w.name, w.bearing, w.to]), [['Shattered Ridge', 'E', ridge]], 'the lair\u2019s way out leads to the ridge, east: the ridge saw it to the west');
  assert.deepEqual(atlasDoc(mire).site.unplaced.map(u => u.name), ['Sunken Hollow'], 'the mire does not list what lies inside the ridge');
  const lairPin = atlasDoc(ridge).features.filter(f => f.name === 'wyrm lair')[0]; assert(lairPin, 'the ridge pins it'); assert.equal(atlasCard(ridge, { id: lairPin.id }).opens, lair, 'and its pin opens it');
  const fen = go(MIRE, 'Shattered Ridge — Black Fen'); assert.equal(atlasDoc(fen).kind, 'marsh', 'a nested place is drawn on the ground its OWN name says'); assert.equal(atlasDoc(fen).title.name, 'Black Fen', 'and titled by its own name, not its path');
  assert.equal(atlasDoc(ridge).title.name, 'Shattered Ridge'); assert.deepEqual(atlasSheetInside(A, atlasPublicPlace(A, ridge), []).map(x => x.name), ['Wyrm Lair', 'Black Fen'], 'unnamed by a feature, each is listed under its own name, not its path');
});

test('an exit or a feature added later moves nothing that was drawn, and two draws are one document', () => {
  setup(MIRE); const mire = worldState.atlas.at; turn('[MAP_REVEAL:new|sunken pool|W|observed][MAP_REVEAL:new|bone cairn|E|observed]');
  const before = atlasDoc(mire), b0 = drawn(before); atlasForget(); assert.equal(JSON.stringify(atlasDoc(mire)), JSON.stringify(before), 'deterministic');
  go(CROSS); go(MIRE); turn('[MAP_REVEAL:new|calcified grove|NE|observed]');
  const after = atlasDoc(mire); assert.equal(after.portals.length, 1); assert.equal(after.features.length, 3);
  assert.equal(JSON.stringify(after.relief), JSON.stringify(before.relief), 'the ground');
  assert.equal(drawn({ relief: after.relief, features: after.features.slice(0, 2) }), b0, 'the two things that stood');
  const pool = after.features[0], cairn = after.features[1]; assert(pool.x < 350 && cairn.x > 350, 'each toward its bearing'); assert.equal(after.frame.width, 700); assert.equal(after.frame.height, 700); assert.equal(after.frame.mPerUnit, undefined, 'no distance is stated'); assert.equal(pool.kind, 'pond'); assert(after.water.pools.some(p => p.id === pool.pool), 'a pool is water on the sheet');
});

test('the card of a drawn thing: where and when it was disclosed; of a listed one, that its position is not established', () => {
  setup(MIRE); const mire = worldState.atlas.at; worldState.turn = 6; turn('[MAP_REVEAL:new|bone cairn|E|observed][MAP_REVEAL:new|a secret aqueduct|unknown|reported]');
  const d = atlasDoc(mire), f = d.features[0], c = atlasCard(mire, { id: f.id });
  assert.equal(c.title, 'bone cairn'); assert.equal(c.word, 'Observed · E. Disclosed on turn 7.'); assert.equal(c.x, f.x); assert.equal(c.y, f.y);
  const u = atlasCard(mire, { id: d.site.unplaced[0].id }); assert.equal(u.title, 'a secret aqueduct'); assert.equal(u.word, 'Reported · Position not established. Disclosed on turn 7.');
  assert.equal(atlasCard(mire, { id: 'way-9' }), null); const party = atlasPartyIn(mire); assert.equal(party.label, MIRE); assert.deepEqual([party.x, party.y], [350, 350], 'the party stands in the middle of the drawn sheet');
});

test('only public facts are read: a private description, kind or proposal changes no byte of the sheet', () => {
  setup(MIRE); const mire = worldState.atlas.at; turn('[MAP_REVEAL:new|High canopy stairs|arch|N|observed]');
  const before = JSON.stringify(atlasDoc(mire));
  memory.map.nodes[MIRE].description = 'PRIVATE: in truth a drowned forest with a ruin'; worldState.atlas.kinds = {}; worldState.atlas.kinds[MIRE] = { kind: 'settlement', size: 'city', by: 'model' }; atlasForget();
  assert.equal(JSON.stringify(atlasDoc(mire)), before); assert(!/PRIVATE|\barch\b|settlement/.test(before));
});

test('the campaign switch: atlas.drawn === false keeps every place a pin sheet, and survives a save', () => {
  setup(MIRE); const mire = worldState.atlas.at; turn('[MAP_REVEAL:new|bone cairn|E|observed]');
  assert.equal(atlasDoc(mire).generator.name, 'wild'); worldState.atlas.drawn = false; atlasForget();
  const d = atlasDoc(mire); assert.equal(d.generator.name, 'schematic'); assert.deepEqual(d.features.map(f => f.name), ['bone cairn']); assert.equal(atlasCard(mire, { id: d.features[0].id }).title, 'bone cairn');
  const back = parseWorldState(serializeWorldState(worldState)); assert.equal(back.atlas.drawn, false, 'the switch is the campaign’s'); assert.equal(toasts.length, 0);
  delete worldState.atlas.drawn; atlasForget(); assert.equal(atlasDoc(mire).generator.name, 'wild', 'absent = drawn');
});

test('a drawing the library refuses is said once, and the pin sheet stands', () => {
  setup(MIRE); const mire = worldState.atlas.at, real = TnDMaps.generate; turn('[MAP_REVEAL:new|bone cairn|E|observed]'); toasts.length = 0;
  TnDMaps.generate = function () { throw new Error('injected drawing failure'); };
  try {
    atlasForget(); const d = atlasDoc(mire); assert.equal(d.generator.name, 'schematic'); assert.deepEqual(d.features.map(f => f.name), ['bone cairn']);
    atlasForget(); atlasDoc(mire); assert.equal(toasts.filter(t => /injected drawing failure/.test(t)).length, 1, 'once, not at every draw: ' + toasts.join(' | ')); assert(/pin sheet/.test(toasts.join(' ')));
  } finally { TnDMaps.generate = real; atlasForget(); }
});

if (!count && !failed) { console.error('matched 0 tests'); process.exit(1); }
console.log((failed ? 'FAILED' : 'ALL GREEN') + ' — ' + count + ' passed, ' + failed + ' failed (#771 place sheet)'); process.exit(failed ? 1 : 0);
