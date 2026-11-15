// dev/tests-769-site-sheets.js — two owner rulings of 2026-11-15 (the nest at Shattered Ridge, "6 map labels overlap"):
//   #769 a site the party goes inside is a place of its own: its finds are on its sheet, and the parent's pin opens it;
//   #770 plain scenery (a floor, the ground, rubble, mist) is not a map feature.
//   node dev/tests-769-site-sheets.js [--only "<test name>"]
'use strict';
const assert = require('assert/strict'), engine = require('./load-engine.js'); engine.loadEngine('game.js');
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
let count = 0, failed = 0;
global.showToast = function () {}; global.syncUI = function () {}; global.saveAll = global.saveAll || function () {};
function test(name, fn) {
  if (only && name !== only) return;
  try { fn(); count++; console.log('PASS #769 ' + name); } catch (e) { failed++; console.error('FAIL #769 ' + name + ': ' + e.message); }
}
const HERE = 'Shattered Ridge', times = (s, a) => s.split(a).length - 1;
function setup() {
  engine.makeTestWorld(); worldState.world.location = HERE; worldState.world.sublocation = null; worldState.turn = 12;
  worldState.atlas = { v: ATLAS_VER, seed: 'k769', knowledge: 1 }; memory.map.nodes[HERE] = newMapNode(0, null); memory.map.nodes[HERE].visits = 1; memory.map.geography = MapKnowledge.create();
  atlasFollow();
}
function turn(text) { worldState.turn++; const muts = applyMuts(text, { deferSave: true }), r = atlasKnowledgeCommitResult(text, muts && muts.mapReveals); assert.equal(r.refusal, null, r.refusal && r.refusal.reason); atlasFollow(); return cleanTxt(r.text); }
const labels = k => atlasKnowledgeProjection(k).features.map(f => f.label);

test('what is scenery: a plain phrase whose head noun is a surface or loose matter, never a name', () => {
  for (const l of ['stone floor', 'the muddy ground', 'a low ceiling', 'Rubble', 'drifting mist', 'splintered debris', 'The cold air', 'cave floors'])
    assert.equal(atlasKnowledgeScenery(l), true, l);
  for (const l of ['The Black Floor', 'Floor of Bones', 'sunken pool', 'frozen trail', 'subterranean rift', 'flooring shop', 'city wall', 'Mist Gate', 'the Weeping Ground', '', null])
    assert.equal(atlasKnowledgeScenery(l), false, String(l));
});

test('scenery is kept out at the GM\'s door and the reader\'s, and the rest of the turn stands', () => {
  setup();
  const out = turn('You drop into the den.[MAP_REVEAL:new|stone floor|S|observed][MAP_REVEAL:new|shadowed fissure|SW|observed]');
  assert.deepEqual(labels(HERE), ['shadowed fissure'], 'the floor is not filed; the fissure is');
  assert.equal(times(out, 'You see stone floor'), 0, 'and no line is printed for it'); assert.equal(times(out, 'You see shadowed fissure to the southwest.'), 1);
  const quote = 'A stone floor spreads below, and a bone cairn stands to the east.', s = atlasExtractionSource(quote); assert(s.ok, s.reason);
  const rec = (label, b, bq) => ({ source: 's1', label: label, quote: quote, mode: 'observed', bearing: b, bearingQuote: bq });
  const r = atlasExtractionRecords([rec('stone floor', 'unknown', ''), rec('bone cairn', 'E', 'stands to the east')], s);
  assert(r.ok, r.reason); assert.deepEqual(r.events.map(e => e.label), ['bone cairn'], 'skipped, never a refusal of the batch');
});

test('scenery already on file is not shown, not asked about, and not rewritten', () => {
  setup();
  const e = { op: 'disclose', id: 'new', label: 'stone floor', proposalKind: '', bearing: 'unknown', mode: 'observed', quote: 'You see stone floor; its precise position is not established.' };
  const p = MapKnowledge.prepare(memory.map.geography, [e], { channel: 'gm', commit: 'old:1', turn: 3, container: HERE, text: e.quote }); assert(p.ok, p.reason); memory.map.geography = p.state;
  turn('[MAP_REVEAL:new|shadowed fissure|SW|observed]');
  const before = JSON.stringify(memory.map.geography);
  assert.deepEqual(labels(HERE), ['stone floor', 'shadowed fissure'], 'the record keeps it');
  assert.deepEqual(atlasKnowledgeShown(HERE, atlasKnowledgeProjection(HERE).features).map(f => f.label), ['shadowed fissure']);
  assert.deepEqual(atlasPublicDoc(worldState.atlas.at).features.map(f => f.name), ['shadowed fissure'], 'the sheet does not draw or list it');
  assert.deepEqual(atlasDirectionsOwed().owed, [], 'the map does not ask where the floor is');
  assert.equal(atlasKnowledgePlayerBlock().indexOf('DIRECTION OWED'), -1);
  assert.equal(JSON.stringify(memory.map.geography), before, 'a read rewrites nothing');
});

test('a site the party goes inside has a sheet of its own; its finds are filed there, not on the place around it', () => {
  setup();
  turn('A dark hollow gapes under the roots.[MAP_REVEAL:new|beast\'s den|SW|observed]');
  const ridge = worldState.atlas.at, den = atlasKnowledgeProjection(HERE).features[0];
  assert.equal(atlasPublicCard(ridge, { id: den.id }).opens, null, 'not entered yet: the pin opens nothing');
  turn('You crawl inside.[SUBLOCATION:Beast\'s Den][MAP_REVEAL:new|bone cairn|E|observed][MAP_REVEAL:new|subterranean rift|S|observed]');
  const inside = worldState.atlas.at;
  assert.notEqual(inside, ridge, 'the party stands on another sheet'); assert.equal(atlasPublicTitle(inside), 'Beast\'s Den');
  assert.deepEqual(labels(HERE), ['beast\'s den'], 'the ridge keeps only what was seen from the ridge');
  assert.deepEqual(atlasPublicDoc(inside).features.map(f => f.name).sort(), ['bone cairn', 'subterranean rift']);
  assert.equal(atlasPublicCard(ridge, { id: den.id }).opens, inside, 'the ridge\'s pin for the den opens the den\'s sheet (a leading article and case folded)');
  turn('You climb back out.[SUBLOCATION_LEAVE][MAP_REVEAL:new|ash pine|N|observed]');
  assert.equal(worldState.atlas.at, ridge); assert.deepEqual(labels(HERE), ['beast\'s den', 'ash pine']);
  const pine = atlasKnowledgeProjection(HERE).features[1];
  turn('You take the road east.[LOCATION:Ashen Road][SUBLOCATION:Ash Pine]');
  assert.equal(atlasPublicTitle(worldState.atlas.at), 'Ash Pine', 'another place has a site of the same name');
  assert.equal(atlasPublicCard(ridge, { id: pine.id }).opens, null, 'the ridge\'s pin opens only a site of the ridge');
});

test('the GM is told: going inside a site is a sub-location, and a crowded sheet is asked whether it hides one', () => {
  setup();
  const p = atlasKnowledgePrompt();
  for (const w of ['ENCLOSED SITES: when the party goes INSIDE a site within this place', 'declare it that turn with [SUBLOCATION:its name]', 'using the name the map already knows it by', 'BEFORE anything disclosed inside it', 'belongs to that site\'s own sheet', '[SUBLOCATION_LEAVE] when the party comes back out', 'are scenery, never map features'])
    assert.ok(p.indexOf(w) >= 0, 'the standing rules say: ' + w);
  let tags = ''; for (let i = 1; i < ATLAS_KNOWLEDGE_CROWDED; i++) tags += '[MAP_REVEAL:new|standing stone ' + i + '|N|observed]';
  turn(tags + '[MAP_REVEAL:new|Shattered Ridge|unknown|observed]');/* the place itself is on file from an older build: not counted */
  assert.equal(atlasKnowledgePlayerBlock().indexOf('SHEET CROWDED'), -1, (ATLAS_KNOWLEDGE_CROWDED - 1) + ' shown features: not crowded');
  turn('[MAP_REVEAL:new|standing stone ' + ATLAS_KNOWLEDGE_CROWDED + '|S|observed]');
  const b = atlasKnowledgePlayerBlock();
  assert.ok(b.indexOf('SHEET CROWDED: ' + ATLAS_KNOWLEDGE_CROWDED + ' features are filed on this one place') >= 0, b.slice(-400));
  assert.ok(b.indexOf('declare it now with [SUBLOCATION:its name] and file what is inside it there') >= 0);
  turn('[SUBLOCATION:Beast\'s Den]');
  assert.equal(atlasKnowledgePlayerBlock().indexOf('SHEET CROWDED'), -1, 'inside the site its own sheet is not crowded');
});

console.log(count + ' passed, ' + failed + ' failed' + (only && !count && !failed ? ' — matched 0 tests' : ''));
process.exit(failed || (only && !count) ? 1 : 0);
