// dev/tests-757-journey.js — #757: the journey sheet. The visited world places joined by the ways the party travelled,
// made of public facts only; a way's direction is drawn solid only where the story stated it.
//   node dev/tests-757-journey.js [--only "<test name>"]
'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), engine = require('./load-engine.js'); engine.loadEngine('game.js');
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
let count = 0, failed = 0;
global.showToast = function () {}; global.syncUI = function () {}; global.saveAll = global.saveAll || function () {};
function test(name, fn) {
  if (only && name !== only) return;
  try { fn(); count++; console.log('PASS #757 ' + name); } catch (e) { failed++; console.error('FAIL #757 ' + name + ': ' + e.message); }
}
const CLEARING = 'The Boundary Clearing', HEART = 'The Ironwood Heart', FORD = 'Reedwater Ford';
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
function setup() {
  engine.makeTestWorld(); worldState.world.location = null; worldState.world.sublocation = null; memory.map.edges = [];
  worldState.atlas = A = { v: ATLAS_VER, seed: 'j757', knowledge: 1 }; memory.map.geography = MapKnowledge.create();
  arrive(CLEARING, 1);
}
function reveal(text) { const r = atlasKnowledgeCommitResult(text, null, { commit: 'gm:' + worldState.turn + ':' + Math.random() }); assert.equal(r.refusal, null, r.refusal && r.refusal.reason); }
const J = () => atlasJourneyId(A);
const P = (...names) => names.map((n, i) => ({ key: n, name: n, zone: 'z' + i, turn: i }));

test('the layout: a known direction is laid along it and sure; an unknown one is laid beside and unsure', () => {
  let l = atlasJourneyLayout(P('a', 'b'), [{ a: 'a', b: 'b', bearing: 'N' }]);
  assert.deepEqual(l.cells.a, [0, 0]); assert.deepEqual(l.cells.b, [0, -1]); assert.deepEqual(l.legs, [{ a: 'a', b: 'b', sure: true }]);
  l = atlasJourneyLayout(P('a', 'b'), [{ a: 'b', b: 'a', bearing: 'N' }]);
  assert.deepEqual(l.cells.b, [0, 1], 'a way written from the far end is turned round'); assert.equal(l.legs[0].sure, true);
  l = atlasJourneyLayout(P('a', 'b'), [{ a: 'a', b: 'b', bearing: null }]);
  assert.deepEqual(l.cells.b, [0, 1], 'unknown: the first free place beside, down the sheet first'); assert.equal(l.legs[0].sure, false);
  l = atlasJourneyLayout(P('a', 'b', 'c'), [{ a: 'a', b: 'b', bearing: 'E' }, { a: 'a', b: 'c', bearing: 'E' }]);
  assert.deepEqual(l.cells.c, [2, 0], 'an occupied place is stepped past, along the same bearing'); assert.equal(l.legs[1].sure, true);
  l = atlasJourneyLayout(P('a', 'b', 'c'), [{ a: 'a', b: 'b', bearing: null }, { a: 'a', b: 'c', bearing: null }]);
  assert.deepEqual(l.cells.c, [1, 1], 'a second unknown way takes the next free place');
  l = atlasJourneyLayout(P('a', 'b', 'c'), [{ a: 'a', b: 'b', bearing: 'E' }, { a: 'b', b: 'c', bearing: 'S' }, { a: 'c', b: 'a', bearing: 'N' }]);
  assert.deepEqual(l.cells.c, [1, 1]); assert.deepEqual(l.legs.map(x => x.sure), [true, true, false], 'a way that closes a loop off its bearing is not sure');
  l = atlasJourneyLayout(P('a', 'b', 'c'), [{ a: 'a', b: 'b', bearing: null }, { a: 'a', b: 'c', bearing: 'W' }]);
  assert.deepEqual(l.cells.c, [-1, 0], 'a known bearing wins over an earlier unknown way');
  l = atlasJourneyLayout(P('a', 'b', 'c'), [{ a: 'a', b: 'b', bearing: 'E' }, { a: 'a', b: 'c', bearing: null }, { a: 'b', b: 'c', bearing: 'N' }]);
  assert.deepEqual(l.cells.c, [1, -1], 'of two ways to a place, the one with a known bearing lays it, whichever comes first');
  l = atlasJourneyLayout(P('a', 'b'), []);
  assert.deepEqual(l.cells.b, [0, 1], 'a place no way reaches is laid beside the one before it'); assert.deepEqual(l.legs, [], 'and no way is drawn');
});

test('the points stay inside the frame at any size, and one place sits in the middle', () => {
  const F = ATLAS_JOURNEY_FRAME, one = atlasJourneyPoints({ a: [0, 0] });
  assert.deepEqual(one.a, [F.cx, F.cy]); assert.equal(atlasJourneyEighth(one.a), 'N', 'the middle still names an eighth: the library asks every placed feature for one');
  const two = atlasJourneyPoints({ a: [0, 0], b: [1, 0] }); assert.equal(two.b[0] - two.a[0], F.step, 'two places are one step apart');
  const cells = {}; for (let i = 0; i < 40; i++) cells['p' + i] = [i, (i * 7) % 11];
  const pts = atlasJourneyPoints(cells);
  Object.keys(pts).forEach(k => assert.ok(pts[k][0] >= F.cx - F.width / 2 && pts[k][0] <= F.cx + F.width / 2 && pts[k][1] >= F.cy - F.height / 2 && pts[k][1] <= F.cy + F.height / 2, k + ' ' + pts[k]));
  assert.equal(atlasJourneyEighth([F.cx + 50, F.cy]), 'E'); assert.equal(atlasJourneyEighth([F.cx, F.cy - 50]), 'N'); assert.equal(atlasJourneyEighth([F.cx - 40, F.cy + 40]), 'SW');
});

test('the owner\'s case: two places, one way of unknown direction, drawn dotted, the party at the second', () => {
  setup(); arrive(HEART, 5);
  const j = atlasJourneyRead(A);
  assert.deepEqual(j.places.map(p => p.name), [CLEARING, HEART]);
  assert.deepEqual(j.spec.links, [{ id: 'way-1', from: j.places[0].zone, to: j.places[1].zone, sure: false }]);
  const doc = atlasDoc(J()), scene = TnDMaps.scene.build(doc, 'ink'), ways = scene.layers.filter(l => l.name === 'links')[0];
  assert.equal(doc.title.name, ATLAS_JOURNEY_TITLE); assert.equal(doc.features.length, 2); assert.ok(doc.features.every(f => !f.unplaced), 'every visited place is drawn');
  assert.ok(ways && ways.items.length === 1 && ways.items[0].s === 'schematicLinkUnsure', 'the way is drawn, dotted');
  const here = doc.features.filter(f => f.name === HEART)[0], party = atlasPartyIn(J());
  assert.ok(party && party.x === here.x && party.y === here.y && party.exact === true, 'the party stands at the place it is in');
  assert.equal(atlasDoc(J()), doc, 'the same facts draw the same document');
});

test('a stated direction places the way and draws it solid, from either end; nothing else does', () => {
  setup(); reveal('[MAP_REVEAL:new|The Ironwood Heart|N|observed] [MAP_REVEAL:new|a toppled waystone|E|observed]'); arrive(HEART, 5);
  let j = atlasJourneyRead(A);
  assert.equal(j.spec.links[0].sure, true);
  assert.ok(j.points[HEART][1] < j.points[CLEARING][1] && j.points[HEART][0] === j.points[CLEARING][0], 'north is up the sheet');
  setup(); arrive(HEART, 5); reveal('[MAP_REVEAL:new|Boundary Clearing|S|reported]');
  j = atlasJourneyRead(A);
  assert.equal(j.spec.links[0].sure, true, 'the far end naming the near one, turned round');
  assert.ok(j.points[HEART][1] < j.points[CLEARING][1]);
  setup(); reveal('[MAP_REVEAL:new|Ironwood gate|N|observed] [MAP_REVEAL:new|The Ironwood Heart|unknown|reported]'); arrive(HEART, 5);
  assert.equal(atlasJourneyRead(A).spec.links[0].sure, false, 'a look-alike name or a feature without a bearing states no direction');
  memory.map.nodes[CLEARING].description = 'The Ironwood Heart lies due west.';
  assert.equal(atlasJourneyRead(A).spec.links[0].sure, false, 'a description is not a public statement');
});

test('rooms fold into their world place, a return adds nothing, and an untravelled pair has no way', () => {
  setup(); arrive(HEART, 5, 'Hollow Green Hall'); arrive(HEART, 6); arrive(CLEARING, 9); arrive(FORD, 12);
  const j = atlasJourneyRead(A);
  assert.deepEqual(j.places.map(p => p.name), [CLEARING, HEART, FORD], 'world places, first visit first, each once');
  assert.equal(j.spec.links.length, 2, 'Clearing–Heart and Clearing–Ford; never Heart–Ford');
  assert.ok(!j.spec.links.some(l => [l.from, l.to].indexOf(j.places[1].zone) >= 0 && [l.from, l.to].indexOf(j.places[2].zone) >= 0));
  const heart = j.places[1], row = atlasPublicPlace(A, heart.zone);
  assert.equal(row.container, HEART, 'the place opens its own sheet once the party has stood in it, not the room\'s');
  TnDMaps.validate(atlasDoc(J()));
});

test('the sheet is reached from the plaque and the list, a tap opens the place, and it is never a place itself', () => {
  setup(); arrive(HEART, 5);
  assert.equal(atlasZoneKnown(A, J()), true); assert.equal(atlasZoneKnown(A, A.seed + '/nowhere'), false);
  const trail = atlasTrailItems(A.at);
  assert.deepEqual(trail.map(t => t.text), [ATLAS_JOURNEY_TITLE, HEART]); assert.equal(trail[0].key, J()); assert.deepEqual(trail.map(t => t.current), [false, true]);
  assert.deepEqual(atlasTrailItems(J()).map(t => t.current), [true, false], 'shown, the journey is the current tier');
  assert.ok(!atlasZones().some(z => z.id === J()), 'the list of places is the places');
  const first = atlasJourneyRead(A).places[0], card = atlasCard(J(), { id: first.zone });
  assert.equal(card.title, CLEARING); assert.equal(card.opens, first.zone); assert.equal(card.id, null, 'no note is kept on a journey pin'); assert.equal(card.partyHere, false);
  assert.ok(/First visited on turn 1\./.test(card.word) && /dotted way shows the order of travel only/.test(card.word), card.word);
  assert.equal(atlasCard(J(), { id: atlasJourneyRead(A).places[1].zone }).partyHere, true);
  assert.equal(atlasCard(J(), { id: 'nothing' }), null);
  assert.equal(atlasPublicTitle(J()), ATLAS_JOURNEY_TITLE);
  const ui = fs.readFileSync(path.join(__dirname, '../ui-atlas.js'), 'utf8');
  assert.ok(ui.indexOf('var _jo=new Option(ATLAS_JOURNEY_TITLE,atlasJourneyId(A));') >= 0, 'the full pane\'s list offers it');
});

test('a read writes nothing, and the sheet holds nothing private', () => {
  setup(); memory.map.nodes[CLEARING].description = 'SECRET_DESC'; memory.map.nodes['Hidden Vault'] = newMapNode(null, null); memory.map.nodes['Hidden Vault'].description = 'unvisited';
  memory.map.edges.push({ from: CLEARING, to: 'Hidden Vault', turn: 2 }); arrive(HEART, 5);
  const before = JSON.stringify([worldState.atlas, memory.map]);
  const text = JSON.stringify([atlasDoc(J()), atlasJourneyRead(A), atlasCard(J(), { id: A.seed }), atlasPartyIn(J())]);
  assert.equal(JSON.stringify([worldState.atlas, memory.map]), before, 'reads never write the campaign');
  assert.ok(text.indexOf('SECRET_DESC') < 0 && text.indexOf('Hidden Vault') < 0, 'an unvisited place and a description never reach the sheet');
});

console.log('#757 journey: ' + count + ' passed, ' + failed + ' failed');
if (only && !count && !failed) { console.error('matched 0 tests'); process.exit(2); }
process.exitCode = failed ? 1 : 0;
