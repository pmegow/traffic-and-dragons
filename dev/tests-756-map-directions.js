// dev/tests-756-map-directions.js — #756: the public map's unplaced features. A place is never listed as a feature of
// itself, and the GM is asked for the direction of each feature the map can only list.
//   node dev/tests-756-map-directions.js [--only "<test name>"]
'use strict';
const assert = require('assert/strict'), engine = require('./load-engine.js'); engine.loadEngine('game.js');
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
let count = 0, failed = 0;
const said = []; global.showToast = function (m) { said.push(String(m)); }; global.syncUI = function () {}; global.saveAll = global.saveAll || function () {};
function test(name, fn) {
  if (only && name !== only) return;
  try { fn(); count++; console.log('PASS #756 ' + name); } catch (e) { failed++; console.error('FAIL #756 ' + name + ': ' + e.message); }
}
const HERE = 'The Ironwood Heart';
function setup() {
  engine.makeTestWorld(); worldState.world.location = HERE; worldState.world.sublocation = null; worldState.turn = 5;
  worldState.atlas = { v: ATLAS_VER, seed: 'k756', knowledge: 1 }; memory.map.nodes[HERE] = newMapNode(0, null); memory.map.nodes[HERE].visits = 1;
  memory.map.geography = MapKnowledge.create();
}
function reveal(text) { const r = atlasKnowledgeCommitResult(text, null, { commit: 'gm:' + worldState.turn + ':' + Math.random() }); assert.equal(r.refusal, null, r.refusal && r.refusal.reason); return r; }
const feats = () => atlasKnowledgeProjection(HERE).features;
const byLabel = l => feats().filter(f => f.label === l)[0];

test('the place\'s own name is recognised, whatever its article, case or punctuation; anything else is not', () => {
  setup();
  ['The Ironwood Heart', 'Ironwood Heart', 'the ironwood heart', 'Ironwood-Heart', ' Ironwood  Heart. '].forEach(l => assert.equal(atlasKnowledgeSelfLabel(HERE, l), true, l));
  ['hollow green hall', 'Ironwood', 'Heart', 'Ironwood Heart gate', ''].forEach(l => assert.equal(atlasKnowledgeSelfLabel(HERE, l), false, l));
  assert.equal(atlasKnowledgeSelfLabel('Ashfen|The Old Ram', 'Old Ram'), true, 'a sub-location is known by its own leaf');
  assert.equal(atlasKnowledgeSelfLabel('Ashfen|The Old Ram', 'Ashfen'), false, 'the town it stands in is not itself');
  assert.equal(atlasKnowledgeSelfLabel('', 'anything'), false);
});

test('the extractor skips the place itself and files the rest of its batch', () => {
  setup();
  const quote = 'Soon the winding path yields to the Ironwood Heart, where a mossed standing stone leans to the north.';
  const s = atlasExtractionSource(quote); assert(s.ok, s.reason);
  const rec = (label, bearing, bq) => ({ source: 's1', label: label, quote: quote, mode: 'observed', bearing: bearing, bearingQuote: bq });
  const r = atlasExtractionRecords([rec('Ironwood Heart', 'unknown', ''), rec('mossed standing stone', 'N', 'leans to the north')], s);
  assert(r.ok, r.reason);
  assert.deepEqual(r.events.map(e => e.label), ['mossed standing stone'], 'the place itself is skipped, never a refusal of the batch');
  const all = atlasExtractionRecords([rec('Ironwood Heart', 'unknown', '')], s);
  assert(all.ok && all.events.length === 0, 'a batch of only the place itself is an empty batch');
});

test('the player\'s sheet does not show a place as a feature of itself, and the record is left as it was', () => {
  setup();
  reveal('[MAP_REVEAL:new|Ironwood Heart|unknown|observed] [MAP_REVEAL:new|Thicket trail|N|observed] [MAP_REVEAL:new|hollow green hall|unknown|observed]');
  assert.equal(feats().length, 3, 'three on file');
  const before = JSON.stringify(memory.map.geography);
  const doc = atlasPublicDoc(worldState.atlas.seed);
  assert.deepEqual(doc.features.map(f => f.name).sort(), ['Thicket trail', 'hollow green hall']);
  assert.equal(atlasPublicCard(worldState.atlas.seed, { id: byLabel('Ironwood Heart').id }), null, 'no card for it');
  assert.ok(atlasPublicCard(worldState.atlas.seed, { id: byLabel('Thicket trail').id }), 'the others keep their cards');
  assert.equal(JSON.stringify(memory.map.geography), before, 'a read rewrites nothing');
});

test('the GM is asked for each direction the map owes, by handle, and never for the place itself or a placed feature', () => {
  setup();
  assert.ok(atlasKnowledgePlayerBlock().indexOf('DIRECTION OWED') < 0, 'nothing owed, nothing asked');
  reveal('[MAP_REVEAL:new|Ironwood Heart|unknown|observed] [MAP_REVEAL:new|Thicket trail|N|observed] [MAP_REVEAL:new|hollow green hall|unknown|observed] [MAP_REVEAL:new|a distant cairn|unknown|reported]');
  const b = atlasKnowledgePlayerBlock(), hall = byLabel('hollow green hall'), cairn = byLabel('a distant cairn');
  assert.ok(b.indexOf('DIRECTION OWED: 2 features here are known without a direction') >= 0, b);
  assert.ok(b.indexOf('[MAP_REVEAL:' + hall.id + '|hollow green hall|<bearing>|observed]') >= 0, 'the handle and the label, ready to complete');
  assert.ok(b.indexOf('[MAP_REVEAL:' + cairn.id + '|a distant cairn|<bearing>|reported]') >= 0, 'a report stays a report');
  assert.ok(b.indexOf('|Ironwood Heart|<bearing>') < 0 && b.indexOf('|Thicket trail|<bearing>') < 0, 'never the place itself, never a placed feature');
  assert.ok(/You are the author of this world/.test(b) && /settle it THIS turn/.test(b) && /a reported one waits/.test(b), 'the ask makes the GM the author (#766 replaced "never invent a direction": owner 2026-11-15)');
  assert.ok(b.indexOf(byLabel('Ironwood Heart').id + ': Ironwood Heart (observed, position unknown).') >= 0, 'the GM still sees the record, so it is not disclosed again');
  const p = atlasKnowledgePrompt();
  assert.ok(p.indexOf('or to settle a direction listed under DIRECTION OWED') >= 0 && p.indexOf('Exclude the place the party stands in and any phrase that only describes it') >= 0, 'the standing rules name both');
  assert.ok(ATLAS_DISCOVERY_PROMPT.indexOf('Exclude the place the passage itself is set in and any phrase that only describes it') >= 0, 'the extractor is told too');
});

test('the ask is capped, and says how many more', () => {
  setup(); let tags = ''; for (let i = 1; i <= 8; i++) tags += '[MAP_REVEAL:new|landmark ' + i + '|unknown|observed] ';
  reveal(tags);
  const line = atlasKnowledgeOwedLine(HERE, feats());
  assert.equal((line.match(/\[MAP_REVEAL:/g) || []).length, ATLAS_KNOWLEDGE_OWED_CAP);
  assert.ok(line.indexOf('DIRECTION OWED: 8 features') >= 0 && line.indexOf('(and 2 more)') >= 0, line);
});

test('the GM\'s answer places the feature: it is drawn, the ask is gone, and a settled direction cannot be moved', () => {
  setup(); reveal('[MAP_REVEAL:new|hollow green hall|unknown|observed]');
  const id = byLabel('hollow green hall').id;
  assert.equal(atlasPublicDoc(worldState.atlas.seed).features[0].unplaced, true, 'listed, not drawn');
  worldState.turn = 6; said.length = 0; const r = reveal('The hall opens ahead. [MAP_REVEAL:' + id + '|hollow green hall|E|observed]');
  assert.deepEqual(said, ['Map: hollow green hall lies to the east.'], 'the player is told, in the Console (#775)'); assert.ok(r.text.indexOf('You see') < 0, 'and the story gains no line');
  const f = atlasPublicDoc(worldState.atlas.seed).features[0];
  assert.equal(f.unplaced, false); assert.equal(f.bearing, 'E'); assert.equal(feats().length, 1, 'the same feature, not a second one');
  assert.ok(atlasKnowledgePlayerBlock().indexOf('DIRECTION OWED') < 0, 'nothing is owed any more');
  worldState.turn = 7; const again = atlasKnowledgeCommitResult('[MAP_REVEAL:' + id + '|hollow green hall|W|observed]', null, { commit: 'gm:7:x' });
  assert.ok(again.refusal && /established bearing/.test(again.refusal.reason), 'a settled direction is not replaced');
});

console.log('#756 map directions: ' + count + ' passed, ' + failed + ' failed');
if (only && !count && !failed) { console.error('matched 0 tests'); process.exit(2); }
process.exitCode = failed ? 1 : 0;
