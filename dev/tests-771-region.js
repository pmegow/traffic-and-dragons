// dev/tests-771-region.js — #771 P3: THE REGION. The campaign's region is drawn from its seed with nothing named on it;
// every visited world place is set on it once, in the direction travelled, on fitting ground, under the fog of war.
//   node dev/tests-771-region.js [--only "<test name>"]
'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const engine = require('./load-engine.js'); engine.loadEngine('game.js');
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
let count = 0, failed = 0; const toasts = []; let saves = 0;
global.showToast = function (m) { toasts.push(String(m)); }; global.syncUI = function () {}; global.saveAll = function () { saves++; };
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const MIRE = 'Petrified Mire', RIDGE = 'Shattered Ridge', HEART = 'The Ironwood Heart', LAIR = 'Wyrm Lair', INN = 'The Gilded Inn';
let A;
function arrive(place, turn, sub) {
  const from = worldState.world.location;
  worldState.world.location = place; worldState.world.sublocation = sub || null; worldState.turn = turn;
  const key = sub ? place + '|' + sub : place;
  if (!memory.map.nodes[place]) memory.map.nodes[place] = newMapNode(turn, null);
  if (sub && !memory.map.nodes[key]) memory.map.nodes[key] = newMapNode(turn, place);
  memory.map.nodes[key].visits = (memory.map.nodes[key].visits || 0) + 1;
  if (from && from !== place && !memory.map.edges.some(e => (e.from === from && e.to === place) || (e.from === place && e.to === from))) memory.map.edges.push({ from: from, to: place, turn: turn });
  atlasPublicFollow();
}
function setup(first) {
  engine.makeTestWorld(); worldState.world.location = null; worldState.world.sublocation = null; memory.map.edges = []; worldState.campId = 'c771r'; memory.campId = 'c771r';
  worldState.atlas = A = { v: ATLAS_VER, seed: 'k771r', knowledge: 1 }; memory.map.geography = MapKnowledge.create(); toasts.length = 0; saves = 0; atlasForget();
  arrive(first || MIRE, 1);
}
function reveal(text) { const r = atlasKnowledgeCommitResult(text, null, { commit: 'gm:' + worldState.turn + ':' + Math.random() }); assert.equal(r.refusal, null, r.refusal && r.refusal.reason); }
const RID = () => atlasRegionId(A);
const eighth = (a, b) => TnDMaps.geom.bearing(a, b).name;
const plain = o => JSON.parse(JSON.stringify(o));

test('the region is the sheet above the places wherever place sheets are drawn; there is none where they are not', () => {
  setup();
  assert.deepEqual(atlasPublicOverview(A), { id: RID(), title: ATLAS_REGION_TITLE }); assert.equal(RID(), 'k771r/region');
  assert.equal(atlasZoneKnown(A, RID()), true); assert.equal(atlasPublicTitle(RID()), 'The region');
  assert.deepEqual(atlasTrailItems(A.at).map(t => [t.text, t.key, t.current]), [['The region', RID(), false], [MIRE, A.at, true]]);
  assert.deepEqual(atlasTrailItems(RID()).map(t => t.current), [true, false], 'shown, the region is the current tier');
  assert.ok(!atlasZones().some(z => z.id === RID()), 'the list of places is the places');
  assert.equal(atlasRegionDocIs(atlasDoc(RID())), true, 'its id draws the region');
  A.drawn = false;
  assert.equal(atlasPublicOverview(A), null, 'the pin-sheet switch: no sheet above the places');
  assert.equal(atlasZoneKnown(A, RID()), false, 'and the region is no sheet there'); assert.deepEqual(atlasTrailItems(A.at).map(t => t.text), [MIRE], 'the plaque starts at the place');
  assert.throws(() => atlasDoc(RID()), /not available/);
});

test('the region names nothing of its own: the first place stands on the ground its name says, and it is the only name', () => {
  setup();
  const doc = atlasDoc(RID());
  assert.equal(doc.generator.name, 'region'); assert.equal(doc.frame.precision, 'schematic', 'it states no distance'); assert.equal(doc.title.name, 'The region');
  assert.ok(doc.features.length > 0 && doc.features.every(f => f.name === null), 'no range, wood, lake or sea is named'); assert.ok(doc.rivers.every(r => r.name === null));
  assert.equal(doc.caves.length, 0); assert.equal(doc.roads.length, 0); assert.equal(doc.portals.length, 0);
  assert.deepEqual(doc.places.map(p => [p.id, p.name, p.kind, p.ground, p.matched, p.site.biome]), [[A.at, MIRE, 'site', 'marsh', true, 'marsh']], 'the mire, on marsh');
  const texts = []; TnDMaps.scene.build(doc, 'ink').layers.forEach(L => { if (L.name === 'labels' || L.name === 'featureLabels') L.items.forEach(c => texts.push(c.text)); });
  assert.deepEqual(texts, [MIRE], 'the one name drawn is the story\'s');
  assert.equal(doc.stats.total, undefined, 'no timing rides the document: two draws of one record are one document');
  assert.equal(atlasDoc(RID()), doc, 'the same record is the same document');
});

test('a place is set in the direction the party travelled and its way is a track; with no direction it is set beside and its way is dotted', () => {
  setup(); reveal('[MAP_REVEAL:new|' + RIDGE + '|N|observed]');
  arrive(RIDGE, 2); arrive(HEART, 3); A.grounds = keyedDict(); A.grounds[HEART] = { ground: 'forest', turn: 3, by: 'story', set: ATLAS_GROUND_SET };
  const j = atlasRegionRead(A), s = j.spots;
  assert.deepEqual(j.places.map(p => p.name), [MIRE, RIDGE, HEART]);
  assert.equal(eighth(s[MIRE], s[RIDGE]), 'N', 'the ridge lies north of the mire, as the story said');
  assert.deepEqual(j.legs.map(l => [l.a, l.b, l.sure]), [[MIRE, RIDGE, true], [RIDGE, HEART, false]]);
  const d = TnDMaps.geom.dist(s[RIDGE], s[HEART]); assert.ok(d >= 60 && d <= 700, 'beside the place it came from: ' + d);
  const doc = atlasDoc(RID()), road = TnDMaps.scene.build(doc, 'ink').layers.filter(L => L.name === 'roads')[0].items;
  assert.deepEqual(doc.places.map(p => [p.name, p.ground]), [[MIRE, 'marsh'], [RIDGE, 'mountain'], [HEART, 'forest']], 'each asks for its own ground');
  const dx = doc.frame.width / (doc.frame.cols - 1);
  doc.places.forEach(p => assert.ok(p.matched ? TnDMaps.region.STORY_GROUNDS.indexOf(p.ground) >= 0 && p.site.biome === p.ground : doc.glyphs.filter(g => TnDMaps.geom.dist([g.x, g.y], [p.x, p.y]) < 1.7 * dx).length >= 3, p.name + ' stands on its ground, or the ground is drawn around it (the direction came first)'));
  assert.equal(doc.places[0].matched, true, 'the first place is free to stand on its own ground');
  assert.deepEqual(road.map(c => c.s), ['way', 'wayUnsure'], 'a stated way is a track, the other dotted');
  assert.deepEqual(doc.ways.map(w => [w.from, w.to, w.sure]), [[j.places[0].zone, j.places[1].zone, true], [j.places[1].zone, j.places[2].zone, false]]);
  /* a bearing written from the far end is turned round */
  setup(RIDGE); arrive(MIRE, 2); reveal('[MAP_REVEAL:new|' + RIDGE + '|NE|observed]');
  const k = atlasRegionRead(A); assert.equal(eighth(k.spots[MIRE], k.spots[RIDGE]), 'NE'); assert.equal(k.legs[0].sure, true);
});

test('a place whose ground is still being asked waits; answered, it is set on that ground; left unasked, it is set on any land', () => {
  setup(); arrive(HEART, 2);
  let r = atlasRegionSpots(A);
  assert.deepEqual(r.waiting, [HEART], 'its name says no ground, nothing is on record, the party stands in it'); assert.equal(r.spots[HEART], undefined);
  assert.deepEqual(atlasRegionGround(A, r.places[1]), { ground: null, owed: true });
  assert.equal(atlasPartyIn(RID()), null, 'no spot yet: the region shows no party'); assert.deepEqual(atlasDoc(RID()).places.map(p => p.name), [MIRE]);
  assert.equal(atlasRegionSettle().length, 1, 'the mire is kept'); assert.equal(A.spots[HEART], undefined, 'the waiting place is not');
  assert.equal(atlasGroundFile(A, HEART, 'forest').ok, true);
  r = atlasRegionSpots(A); assert.deepEqual(r.waiting, []); assert.deepEqual(r.fresh.map(f => f.key), [HEART]);
  assert.deepEqual(atlasDoc(RID()).places.map(p => [p.name, p.site.biome]), [[MIRE, 'marsh'], [HEART, 'forest']]);
  /* the party moved on before the story was asked: the place is set on any land rather than wait for ever */
  setup(); arrive(HEART, 2); arrive(RIDGE, 3);
  r = atlasRegionSpots(A); assert.deepEqual(r.waiting, []); assert.ok(r.spots[HEART]); assert.deepEqual(atlasRegionGround(A, r.places[1]), { ground: null, owed: false });
  /* an "other" answered before the vocabulary knew the sites is owed again */
  setup(); arrive(HEART, 2); A.grounds = keyedDict(); A.grounds[HEART] = { ground: 'other', turn: 2, by: 'story' };
  assert.deepEqual(atlasRegionSpots(A).waiting, [HEART]); A.grounds[HEART].set = ATLAS_GROUND_SET; assert.deepEqual(atlasRegionSpots(A).waiting, [], 'an "other" of this edition is an answer: any land');
});

test('what a place is drawn as says the ground it stands on: open country its terrain, a cave rising ground, a building any land', () => {
  setup();
  const g = (name, stored) => { if (stored) { A.grounds = keyedDict(); A.grounds[name] = { ground: stored, turn: 1, by: 'story', set: ATLAS_GROUND_SET }; } else delete A.grounds; return atlasRegionGround(A, { key: name, name: name, zone: 'z' }).ground; };
  assert.equal(g(MIRE), 'marsh'); assert.equal(g(RIDGE), 'mountain'); assert.equal(g(LAIR), 'hills'); assert.equal(g(INN), null);
  assert.equal(g('Ashenveil', 'heath'), 'heath'); assert.equal(g('Ashenveil', 'cave'), 'hills'); assert.equal(g('Ashenveil', 'building'), null); assert.equal(g('Ashenveil', 'other'), null);
  assert.deepEqual(Object.keys(ATLAS_REGION_GROUNDS).sort(), Object.keys(ATLAS_SHEET_DRAWS).sort(), 'one row per drawing');
  ATLAS_SHEET_GROUNDS.forEach(row => assert.ok(TnDMaps.region.STORY_GROUNDS.indexOf(row.terrain) >= 0, 'the library knows ' + row.terrain));
  assert.ok(TnDMaps.region.STORY_GROUNDS.indexOf('hills') >= 0);
});

test('the writer keeps each spot once, and a kept spot never moves: not for a direction stated later, not for a newer answer', () => {
  setup(); arrive(RIDGE, 2);
  assert.equal(Object.prototype.hasOwnProperty.call(A, 'spots'), false, 'a read keeps nothing');
  const before = plain(atlasRegionSpots(A).spots), kept = atlasRegionSettle();
  assert.deepEqual(kept.map(f => f.key), [MIRE, RIDGE]); assert.equal(saves, 1, 'saved');
  assert.deepEqual(plain(A.spots), { [MIRE]: { at: before[MIRE], turn: 2 }, [RIDGE]: { at: before[RIDGE], turn: 2 } });
  assert.equal(Object.getPrototypeOf(A.spots), null, 'a keyed store: a place called "constructor" is a place');
  assert.ok(KEYED_STORE_PATHS.world.indexOf('atlas.spots') >= 0, 'registered, so a load keeps it keyed');
  assert.equal(atlasRegionSettle(), null, 'nothing new: nothing written'); assert.equal(saves, 1);
  assert.equal(atlasRegionRead(A).legs[0].sure, false, 'no direction was stated: dotted');
  /* the story now says the ridge lies EAST; the ridge was set down elsewhere and stays */
  const was = eighth(before[MIRE], before[RIDGE]), other = was === 'E' ? 'W' : 'E';
  arrive(MIRE, 3); reveal('[MAP_REVEAL:new|' + RIDGE + '|' + other + '|observed]');
  assert.deepEqual(plain(atlasRegionSpots(A).spots), before, 'where a place was set is kept'); assert.equal(atlasRegionRead(A).legs[0].sure, false, 'a way that does not lie along the stated direction stays dotted');
  /* a third place: the first two do not move, and only it is kept */
  arrive(HEART, 4); arrive(LAIR, 5);
  const more = atlasRegionSettle(); assert.deepEqual(more.map(f => f.key), [HEART, LAIR]); assert.deepEqual([plain(A.spots[MIRE].at), plain(A.spots[RIDGE].at)], [before[MIRE], before[RIDGE]]);
  /* a record that cannot be read is set down afresh, never trusted */
  A.spots[HEART] = { at: [NaN, 5] }; assert.ok(atlasRegionSpots(A).fresh.some(f => f.key === HEART)); A.spots[HEART] = { at: [5000, 5] }; assert.ok(atlasRegionSpots(A).fresh.some(f => f.key === HEART), 'a point off the sheet is no spot');
});

test('a read writes nothing', () => {
  setup(); reveal('[MAP_REVEAL:new|' + RIDGE + '|N|observed]'); arrive(RIDGE, 2); atlasRegionSettle(); arrive(HEART, 3);
  const w = JSON.stringify(worldState), m = JSON.stringify(memory);
  atlasDoc(RID()); atlasPartyIn(RID()); atlasMarkers(RID()); atlasReveal(RID()); atlasRevealNone(RID()); atlasCard(RID(), { id: A.at }); atlasTrailItems(RID()); atlasRegionStand(A); atlasRegionSpots(A);
  assert.equal(JSON.stringify(worldState), w); assert.equal(JSON.stringify(memory), m);
});

test('the fog: the ground around the placed places and along the travelled ways; off, the sheet is whole; a place sheet has none', () => {
  setup();
  assert.deepEqual(atlasReveal(RID()), { points: [atlasRegionSpots(A).spots[MIRE]], paths: [], radius: ATLAS_REGION_REVEAL });
  arrive(RIDGE, 2);
  const j = atlasRegionRead(A), doc = atlasDoc(RID()), rv = atlasReveal(RID());
  assert.deepEqual(rv, { points: [j.spots[MIRE], j.spots[RIDGE]], paths: [doc.ways[0].pts], radius: 70 });
  const sc = TnDMaps.scene.build(doc, 'ink', { reveal: rv }); assert.equal(sc.reveal.radiusUnits, 70, 'in the sheet\'s own units: it states no distance');
  assert.ok(sc.layers.some(L => L.name === 'fog'), 'the rest is fog'); assert.equal(sc.layers.filter(L => L.name === 'hits')[0].items.filter(h => h.kind === 'place').length, 2, 'both places show');
  assert.deepEqual(atlasRevealNone(RID()), { points: [], paths: [], radius: 70 }, 'a pane that could not hand over the real fog shows none of the ground');
  assert.equal(atlasReveal(A.at), null, 'a place sheet is whole'); assert.equal(atlasRevealNone(A.at), null);
  A.fog = false; assert.equal(atlasReveal(RID()), null, 'the campaign\'s fog switch'); assert.equal(atlasRevealNone(RID()), null);
});

test('the party stands at the world place it is in, from a place inside it too; a tap on a place opens its sheet', () => {
  setup(); const mire = A.at; arrive(RIDGE, 2); const ridge = A.at; arrive(RIDGE, 3, LAIR);
  const s = atlasRegionSpots(A).spots, p = atlasPartyIn(RID());
  assert.deepEqual(p, { x: s[RIDGE][0], y: s[RIDGE][1], exact: true, last: false, key: null, label: '' }, 'the dagger alone: the place bears its own name');
  assert.deepEqual(atlasMarkers(RID()), [{ id: 'party', kind: 'party', x: s[RIDGE][0], y: s[RIDGE][1], label: '' }]);
  assert.deepEqual(atlasRegionStand(A), s[RIDGE]);
  const card = atlasCard(RID(), { id: mire });
  assert.equal(card.title, MIRE); assert.equal(card.opens, mire); assert.equal(card.id, null, 'no note is kept on a region place'); assert.equal(card.partyHere, false);
  assert.deepEqual([card.x, card.y], s[MIRE]); assert.ok(/First visited on turn 1\./.test(card.word) && /dotted way shows the order of travel only/.test(card.word), card.word);
  assert.equal(atlasCard(RID(), { id: ridge }).partyHere, true); assert.equal(atlasCard(RID(), { id: 'nothing' }), null); assert.equal(atlasCard(RID(), null), null);
  assert.deepEqual(atlasDoc(RID()).places.map(x => x.name), [MIRE, RIDGE], 'a place inside another is no place of the region');
  assert.equal(atlasThingShown(RID(), { id: mire }), true);
});

test('a failure to set a place down is said, writes nothing, and is tried again', () => {
  setup(); const real = TnDMaps.region.place;
  try {
    TnDMaps.region.place = function () { throw new Error('injected placement failure'); };
    assert.equal(atlasRegionSettle(), null); assert.equal(Object.prototype.hasOwnProperty.call(A, 'spots'), false); assert.equal(saves, 0);
    assert.ok(toasts.some(t => /region map could not set this place down: injected placement failure\. It is tried again next turn\./.test(t)), toasts.join(' | '));
  } finally { TnDMaps.region.place = real; }
  A.drawn = false; assert.equal(atlasRegionSettle(), null, 'pin sheets: nothing is set down'); assert.equal(Object.prototype.hasOwnProperty.call(A, 'spots'), false); delete A.drawn;
  assert.equal(atlasRegionSettle().length, 1, 'the next turn sets it down');
});

test('the GM is told nothing of the region', () => {
  setup(); reveal('[MAP_REVEAL:new|' + RIDGE + '|N|observed]'); arrive(RIDGE, 2);
  const told = atlasMapBlock(); atlasRegionSettle(); assert.equal(atlasMapBlock(), told, 'a kept spot changes no word');
  A.fog = false; assert.equal(atlasMapBlock(), told); assert.ok(told.indexOf(ATLAS_REGION_TITLE) < 0 && !/\b\d+(\.\d+)?,\s*\d+/.test(told.replace(/turn \d+/g, '')), 'no sheet and no point');
});

test('the game sets a new place down after the ground ask at both doors; the file is loaded, cached and in the engine; the pane frames and fogs the region', () => {
  const game = read('game.js'), html = read('index.html'), sw = read('sw.js'), ui = read('ui-atlas.js'), atlas = read('atlas.js'), manifest = read('dev/engine-manifest.js');
  assert.equal(game.split('if(typeof atlasRegionSettle==="function")atlasRegionSettle();').length - 1, 2, 'the turn and the opening');
  assert.match(game, /await atlasGroundSettle\(resp,txt\);[^\n]*\n\s*if\(typeof atlasRegionSettle==="function"\)atlasRegionSettle\(\);/, 'after the turn\'s ground ask');
  assert.match(game, /await atlasGroundSettle\(resp,""\);[^\n]*\n\s*if\(typeof atlasRegionSettle==="function"\)atlasRegionSettle\(\);/, 'after the opening\'s');
  assert.ok(html.indexOf('<script src="atlas-ground.js"></script>\n<script src="atlas-public-region.js"></script>\n<script src="atlas-public.js"></script>') >= 0 || html.indexOf('<script src="atlas-ground.js"></script>\r\n<script src="atlas-public-region.js"></script>\r\n<script src="atlas-public.js"></script>') >= 0, 'loaded after the ground it reads, before the projection that dispatches to it');
  assert.ok(sw.indexOf('"/atlas-public-region.js"') >= 0, 'in the offline shell'); assert.ok(manifest.indexOf('{ file: "atlas-public-region.js", sym: "atlasRegionSettle" }') >= 0);
  assert.ok(atlas.indexOf('function atlasReveal(zoneId){if(typeof atlasKnowledgeActive==="function"&&atlasKnowledgeActive()){return atlasPublicReveal(zoneId);}') >= 0, 'the pane\'s fog is the region\'s');
  assert.ok(atlas.indexOf('function atlasRevealNone(zoneId){if(typeof atlasKnowledgeActive==="function"&&atlasKnowledgeActive()){return atlasPublicRevealNone(zoneId);}') >= 0, 'and it fails closed');
  assert.ok(ui.indexOf('if(!how&&fresh&&atlasKnowledgeActive()&&(atlasPaneDrawn(doc)||atlasRegionDocIs(doc)))how={};') >= 0, 'a region newly shown is framed');
  assert.ok(ui.indexOf('else if(atlasKnowledgeActive()&&atlasRegionDocIs(P.view.doc())){T=P.view.transform();d=atlasRegionStand(atlasLive());P.view.center(d[0],d[1],Math.max(T.k,ATLAS_SHEET_LABEL_PX/atlasPaneRegionLabelSize()));}') >= 0, 'on the party, at the zoom its names read at');
  assert.ok(ui.indexOf('var _ov=atlasPublicOverview(A),_jo;if(_ov){_jo=new Option(_ov.title,_ov.id);') >= 0, 'the full pane\'s list offers it');
  assert.ok(ui.indexOf('function atlasPaneRegionLabelSize(){var s=TnDMaps.style.get("ink").text;return Math.min(s.labelTown.size,s.labelMarker.size);}') >= 0, 'the smaller of its two faces'); assert.equal(typeof TnDMaps.style.get('ink').text.labelTown.size, 'number'); assert.equal(typeof TnDMaps.style.get('ink').text.labelMarker.size, 'number');
});

(async function () {
  for (const [name, fn] of tests) {
    if (only && name !== only) continue;
    try { await fn(); count++; console.log('PASS #771 region ' + name); } catch (e) { failed++; console.error('FAIL #771 region ' + name + ': ' + e.message); }
  }
  console.log(count + ' passed, ' + failed + ' failed' + (only && !count && !failed ? ' — matched 0 tests' : ''));
  process.exit(failed || (only && !count) ? 1 : 0);
})();
