// dev/tests-757-journey.js — #757: THE JOURNEY, the travel record the region and the place sheets share: the visited
// world places and the ways the party travelled, made of public facts only; a way's direction is known only where the
// story stated it. The journey SHEET that drew them retired into the region (#771 P3) and was removed (#771 P4).
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
const legs = () => atlasJourneyLegs(atlasJourneyPlaces(A));

test('the places: world places, first visit first, each once; a room folds into its world place, which opens its own sheet once the party stood in it', () => {
  setup(); arrive(HEART, 5, 'Hollow Green Hall');
  let places = atlasJourneyPlaces(A);
  assert.deepEqual(places.map(p => [p.name, p.key, p.turn]), [[CLEARING, CLEARING, 1], [HEART, HEART, 5]], 'the hall is the Heart on the journey');
  const room = places[1].zone; assert.equal(atlasPublicPlace(A, room).container, HEART + '|Hollow Green Hall', 'only the room was stood in: its sheet opens');
  arrive(HEART, 6); arrive(CLEARING, 9); arrive(FORD, 12);
  places = atlasJourneyPlaces(A);
  assert.deepEqual(places.map(p => p.name), [CLEARING, HEART, FORD], 'a return adds nothing');
  assert.notEqual(places[1].zone, room); assert.equal(atlasPublicPlace(A, places[1].zone).container, HEART, 'the place opens its own sheet once the party has stood in it, not the room\'s');
  assert.equal(atlasJourneyWorld(HEART + '|Hollow Green Hall'), HEART); assert.equal(atlasJourneyWorld(null), '');
});

test('the ways: the party\'s own travel between two visited places, once each pair, in the order travelled; an untravelled pair and an unvisited place have none', () => {
  setup(); arrive(HEART, 5, 'Hollow Green Hall'); arrive(HEART, 6); arrive(CLEARING, 9); arrive(FORD, 12);
  memory.map.edges.push({ from: HEART, to: CLEARING, turn: 9 }, { from: HEART + '|Hollow Green Hall', to: HEART, turn: 6 });
  memory.map.nodes['Hidden Vault'] = newMapNode(null, null); memory.map.edges.push({ from: CLEARING, to: 'Hidden Vault', turn: 2 });
  assert.deepEqual(legs().map(l => [l.a, l.b]), [[CLEARING, HEART], [CLEARING, FORD]], 'Clearing–Heart and Clearing–Ford; never Heart–Ford, never the way back again, never a room, never the vault');
  assert.deepEqual(atlasJourneyPlaces(A).map(p => p.name).indexOf('Hidden Vault'), -1);
});

test('a stated direction is read from either end; nothing else states one', () => {
  setup(); reveal('[MAP_REVEAL:new|The Ironwood Heart|N|observed] [MAP_REVEAL:new|a toppled waystone|E|observed]'); arrive(HEART, 5);
  assert.deepEqual(legs(), [{ a: CLEARING, b: HEART, bearing: 'N' }]);
  setup(); arrive(HEART, 5); reveal('[MAP_REVEAL:new|Boundary Clearing|S|reported]');
  assert.equal(legs()[0].bearing, 'N', 'the far end naming the near one, turned round');
  setup(); reveal('[MAP_REVEAL:new|Ironwood gate|N|observed] [MAP_REVEAL:new|The Ironwood Heart|unknown|reported]'); arrive(HEART, 5);
  assert.equal(legs()[0].bearing, null, 'a look-alike name or a feature without a bearing states no direction');
  memory.map.nodes[CLEARING].description = 'The Ironwood Heart lies due west.';
  assert.equal(legs()[0].bearing, null, 'a description is not a public statement');
  assert.equal(ATLAS_JOURNEY_OPPOSITE.NE, 'SW'); assert.deepEqual(Object.keys(ATLAS_JOURNEY_OPPOSITE).sort(), ATLAS_JOURNEY_UNSURE_ORDER.slice().sort());
});

test('the journey sheet is gone: the region is the sheet above the places, and where place sheets are not drawn there is none', () => {
  setup(); arrive(HEART, 5);
  const old = A.seed + '/journey';
  assert.equal(atlasZoneKnown(A, old), false, 'its id is no sheet'); assert.throws(() => atlasDoc(old), /not available/);
  assert.equal(typeof atlasJourneyDoc, 'undefined'); assert.equal(typeof atlasJourneyId, 'undefined'); assert.equal(typeof ATLAS_JOURNEY_TITLE, 'undefined');
  assert.deepEqual(atlasTrailItems(A.at).map(t => t.text), [ATLAS_REGION_TITLE, HEART]);
  A.drawn = false;
  assert.equal(atlasPublicOverview(A), null); assert.deepEqual(atlasTrailItems(A.at).map(t => [t.text, t.current]), [[HEART, true]], 'pin sheets: the plaque starts at the place');
  assert.equal(atlasZoneKnown(A, old), false); assert.equal(atlasZoneKnown(A, atlasRegionId(A)), false);
  const ui = fs.readFileSync(path.join(__dirname, '../ui-atlas.js'), 'utf8');
  assert.ok(ui.indexOf('var _ov=atlasPublicOverview(A),_jo;if(_ov){_jo=new Option(_ov.title,_ov.id);') >= 0, 'the full pane\'s list offers a sheet above the places only where there is one');
});

test('a read writes nothing, and nothing private reaches the journey', () => {
  setup(); memory.map.nodes[CLEARING].description = 'SECRET_DESC'; memory.map.nodes['Hidden Vault'] = newMapNode(null, null); memory.map.nodes['Hidden Vault'].description = 'unvisited';
  memory.map.edges.push({ from: CLEARING, to: 'Hidden Vault', turn: 2 }); arrive(HEART, 5);
  const before = JSON.stringify([worldState.atlas, memory.map]);
  const text = JSON.stringify([atlasJourneyPlaces(A), legs()]);
  assert.equal(JSON.stringify([worldState.atlas, memory.map]), before, 'reads never write the campaign');
  assert.ok(text.indexOf('SECRET_DESC') < 0 && text.indexOf('Hidden Vault') < 0, 'an unvisited place and a description never reach it');
});

console.log('#757 journey: ' + count + ' passed, ' + failed + ' failed');
if (only && !count && !failed) { console.error('matched 0 tests'); process.exit(2); }
process.exitCode = failed ? 1 : 0;
