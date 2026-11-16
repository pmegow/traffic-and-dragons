// dev/tests-771-sites.js — #771 P2 (owner 2026-11-15: "the hierarchy should be Petrified Mire: Shattered Ridge: Wyrm lair"):
// a place that is not open country is drawn as what it IS. A cave is the library's rock with nameless chambers — its mouth
// the way back to the place around it, the story's things on the chambers toward their bearing — and a site named on the
// sheet the party stands in is filed INSIDE that place, with [SUBLOCATION_LEAVE] stepping out one.
//   node dev/tests-771-sites.js [--only "<test name>"]
'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), engine = require('./load-engine.js'); engine.loadEngine('game.js');
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
let count = 0, failed = 0, matched = 0; const toasts = [], queue = [];
global.showToast = function (m) { toasts.push(String(m)); }; global.syncUI = function () {}; global.saveAll = function () {};
function test(name, fn) { if (only && name !== only) return; matched++; queue.push([name, fn]); }
const MIRE = 'Petrified Mire', CROSS = 'The Crossroads of Ashenveil', RIDGE = 'Shattered Ridge', LAIR = 'Wyrm Lair', SEP = ' — ', LAIR_SUB = RIDGE + SEP + LAIR;
function setup(at) {
  engine.makeTestWorld(); toasts.length = 0; atlasForget(); worldState.world.location = at || MIRE; worldState.world.sublocation = null; worldState.turn = 1;
  worldState.atlas = { v: ATLAS_VER, seed: 'k771s', knowledge: 1 }; memory.map.nodes[worldState.world.location] = newMapNode(0, null); memory.map.nodes[worldState.world.location].visits = 1;
  memory.map.edges = []; memory.map.geography = MapKnowledge.create(); atlasFollow();
}
function go(world, sub) {
  const from = worldState.world.location; worldState.turn++; worldState.world.location = world; worldState.world.sublocation = sub || null;
  const key = sub ? world + '|' + sub : world; if (!memory.map.nodes[key]) memory.map.nodes[key] = newMapNode(worldState.turn, sub ? world : null); memory.map.nodes[key].visits++;
  if (from !== world) memory.map.edges.push({ from: from, to: world, turn: worldState.turn });
  atlasFollow(); return worldState.atlas.at;
}
function turn(text) { worldState.turn++; const muts = applyMuts(text, { deferSave: true }), r = atlasKnowledgeCommitResult(text, muts && muts.mapReveals); assert.equal(r.refusal, null, r.refusal && r.refusal.reason); atlasFollow(); return worldState.atlas.at; }
const rev = (label, bearing, mode) => '[MAP_REVEAL:new|' + label + '|' + (bearing || 'N') + '|' + (mode || 'observed') + ']';
const rock = d => JSON.stringify([d.rooms.map(r => [r.id, r.poly]), d.passages, d.extent]);
// the owner's hierarchy: the mire, the ridge inside it (the lair seen to the `bearing`), the lair inside the ridge
function lair(bearing) {
  setup(MIRE); const ridge = go(MIRE, RIDGE);
  if (bearing !== null) turn(rev(LAIR, bearing || 'N'));
  const id = go(MIRE, LAIR_SUB);
  return { ridge: ridge, lair: id };
}

test('a name says a site as it says a ground: a lair, a den, caverns are a cave; a mire is open ground; a keep is neither', () => {
  const kind = n => atlasSheetNameKind({ id: 's', name: n, container: n });
  for (const n of ['Wyrm Lair', 'The Crystal Caverns', "The Smugglers' Den", 'Old Copper Mine', 'The Cave of Echoes', 'Rat Warren']) assert.deepEqual(kind(n), { draws: 'cave' }, n);
  assert.deepEqual(kind('Petrified Mire'), { draws: 'wild', terrain: 'marsh' }); assert.equal(kind('Reedglass Keep'), null); assert.equal(kind('The Ironwood Heart'), null);
  assert.deepEqual(atlasSheetNameKind({ id: 's', name: LAIR, container: MIRE + '|' + LAIR_SUB }), { draws: 'cave' }, 'a place inside others is named by its own step');
  const grounds = [].concat.apply([], ATLAS_SHEET_GROUNDS.map(g => g.nouns));
  for (const s of ATLAS_SHEET_SITES) { assert.ok(ATLAS_SHEET_DRAWS[s.draws] && ATLAS_SHEET_DRAWS[s.draws].site, 'a site row names a site drawing'); for (const n of s.nouns) assert.equal(grounds.indexOf(n), -1, n + ' is a site noun and never a ground noun'); }
  for (const k of Object.keys(ATLAS_SHEET_DRAWS)) assert.ok(TnDMaps.GENERATORS[ATLAS_SHEET_DRAWS[k].generator], k + ' is drawn by a generator the library has');
  assert.equal(atlasSheetGround({ id: 's', name: LAIR, container: LAIR }, []), null, 'a site is no open ground: the wild generator is never handed it');
});

test('the lair on the ridge is drawn as a cave: nameless rock, the mouth back to the ridge, no scale and no level', () => {
  const at = lair('N'), doc = atlasDoc(at.lair);
  assert.equal(doc.generator.name, 'dungeon'); assert.equal(doc.kind, 'cave'); assert.equal(doc.title.name, LAIR); assert.equal(doc.site.where, 'within ' + RIDGE);
  assert.equal(doc.frame.precision, 'schematic'); assert.ok(atlasSheetDrawn(doc));
  assert.ok(doc.rooms.length > 8); for (const r of doc.rooms) if (!r.portal) assert.equal(r.name, '', 'the generator names no chamber');
  assert.equal(doc.portals.length, 1); assert.equal(doc.portals[0].name, 'to ' + RIDGE); assert.equal(doc.portals[0].id, 'way-1');
  assert.deepEqual(doc.features, []); assert.deepEqual(doc.unplaced, []);
  const text = JSON.stringify(TnDMaps.scene.build(doc, 'ink')); assert.doesNotMatch(text, /level|on foot/); assert.match(text, /to Shattered Ridge/);
  assert.equal(atlasDoc(at.ridge).generator.name, 'wild', 'the ridge around it stays open ground');
  assert.equal(JSON.stringify(atlasDoc(at.lair)), JSON.stringify(doc), 'two draws of one record are one document');
  atlasForget(); assert.deepEqual(Object.keys(atlasDoc(at.lair).stats).sort(), ['lengthM', 'passages'], 'the document carries no timing: what a seed does not decide is not in it');
});

test('the mouth stands toward the place it leads back to; a direction nobody stated lays it to the south', () => {
  const edge = b => { const at = lair(b), p = atlasDoc(at.lair).portals[0]; return [p.x, p.y]; }, c = ATLAS_SHEET_CENTRE;
  let p = edge('N'); assert.ok(p[1] > c[1] + 200 && Math.abs(p[0] - c[0]) < 2, 'the lair lies north of the ridge: the way back is south');
  p = edge('E'); assert.ok(p[0] < c[0] - 200 && Math.abs(p[1] - c[1]) < 2, 'east of the ridge: the way back is west');
  p = edge('SW'); assert.ok(p[0] > c[0] + 150 && p[1] < c[1] - 150, 'south-west of it: the way back is north-east');
  p = edge(null); assert.ok(p[1] > c[1] + 200 && Math.abs(p[0] - c[0]) < 2, 'never stated: south, as a place inside another lays its way back');
  const at = lair('E'), d = atlasDoc(at.lair); assert.equal(d.site.heading, 'E', 'the rock runs away from the mouth');
});

test('the story names the chambers: each thing toward its bearing from the middle chamber, a report in its own face, what has no direction listed', () => {
  const at = lair('N'); turn(rev('the great nest', 'N') + rev('a heap of bones', 'E') + rev('the far tunnel', 'W', 'reported') + rev('a hidden hoard', 'unknown', 'reported') + rev('cave', 'S'));
  const doc = atlasDoc(at.lair), by = {}; doc.features.forEach(f => { by[f.name] = f; });
  assert.deepEqual(doc.features.map(f => f.name), ['the great nest', 'a heap of bones', 'the far tunnel'], 'in the order disclosed; "cave" in a cave names the rock, not a thing');
  assert.ok(by['the great nest'].y < doc.story.at[1]); assert.ok(by['a heap of bones'].x > doc.story.at[0]); assert.ok(by['the far tunnel'].x < doc.story.at[0]);
  assert.equal(by['the far tunnel'].reported, true); assert.equal(new Set(doc.features.map(f => f.room)).size, 3); assert.ok(doc.features.every(f => f.room !== doc.story.room));
  assert.deepEqual(doc.unplaced.map(u => u.name), ['a hidden hoard']);
  const text = JSON.stringify(TnDMaps.scene.build(doc, 'ink')); for (const n of ['the great nest', 'a heap of bones', 'the far tunnel']) assert.ok(text.indexOf(n) > 0, n + ' is on the plan');
  assert.deepEqual(atlasThings(doc).map(t => t.name).sort(), ['a heap of bones', 'a hidden hoard', 'the far tunnel', 'the great nest', 'to ' + RIDGE].sort(), 'the things of the sheet are the story\'s and the way out; a nameless chamber is no thing');
});

test('a feature that names the place the mouth leads to IS the mouth: one thing, under the feature\'s own id', () => {
  const at = lair('N'); turn(rev(RIDGE, 'S') + rev('the great nest', 'N'));
  const doc = atlasDoc(at.lair), ridge = atlasKnowledgeProjection(MIRE + '|' + LAIR_SUB).features.filter(f => f.label === RIDGE)[0];
  assert.deepEqual(doc.features.map(f => f.name), ['the great nest'], 'the ridge is not also a chamber'); assert.equal(doc.portals[0].id, ridge.id);
  const card = atlasCard(at.lair, { id: ridge.id }); assert.equal(card.title, RIDGE); assert.equal(card.opens, at.ridge, 'its card opens the ridge');
});

test('a later thing never moves an earlier one, and the rock never changes', () => {
  const at = lair('N'); turn(rev('the great nest', 'N') + rev('a heap of bones', 'E'));
  const a = atlasDoc(at.lair), before = JSON.stringify(a.features), r0 = rock(a);
  turn(rev('a second nest', 'N') + rev('a cold spring', 'E') + rev('a rope ladder', 'unknown'));
  const b = atlasDoc(at.lair);
  assert.equal(JSON.stringify(b.features.slice(0, 2)), before); assert.equal(b.features.length, 4); assert.equal(rock(b), r0);
  assert.equal(new Set(b.features.map(f => f.room)).size, 4, 'no two things on one chamber');
});

test('the party is drawn in the middle chamber, and every card answers: a thing, the way out, the pin that opens the site', () => {
  const at = lair('N'); turn(rev('the great nest', 'N') + rev('a hidden hoard', 'unknown', 'reported'));
  const doc = atlasDoc(at.lair), party = atlasPartyIn(at.lair), nest = doc.features[0];
  assert.deepEqual([party.x, party.y], doc.story.at); assert.equal(party.label, LAIR); assert.equal(atlasPartyIn(at.ridge), null, 'the party is in the lair, not on the ridge');
  assert.deepEqual(atlasSheetStand(doc), doc.story.at); assert.deepEqual(atlasSheetStand(atlasDoc(at.ridge)), ATLAS_SHEET_CENTRE);
  let card = atlasCard(at.lair, { id: nest.id }); assert.equal(card.title, 'the great nest'); assert.deepEqual([card.x, card.y], [nest.x, nest.y]); assert.match(card.word, /Observed/);
  card = atlasCard(at.lair, { id: 'way-1' }); assert.equal(card.title, 'The way to ' + RIDGE); assert.equal(card.opens, at.ridge, 'the mouth opens the ridge'); assert.deepEqual([card.x, card.y], [doc.portals[0].x, doc.portals[0].y]);
  card = atlasCard(at.lair, { id: doc.unplaced[0].id }); assert.equal(card.title, 'a hidden hoard'); assert.deepEqual([card.x, card.y], doc.story.at, 'a listed thing has no spot: its card stands where the party is drawn');
  const ridge = atlasDoc(at.ridge), pin = ridge.features.filter(f => f.name === LAIR)[0]; assert.ok(pin, 'the lair is a thing on the ridge');
  assert.equal(atlasCard(at.ridge, { id: pin.id }).opens, at.lair, 'the ridge\'s pin for the lair opens the lair');
  assert.deepEqual(atlasTrailItems(at.lair).map(t => [t.text, t.current]), [[ATLAS_JOURNEY_TITLE, false], [MIRE, false], [RIDGE, false], [LAIR, true]], 'the plaque: the mire, the ridge in it, the lair in the ridge');
  assert.deepEqual(atlasTrailItems(at.ridge).map(t => [t.key, t.current]).slice(2), [[at.ridge, true], [at.lair, false]], 'a tier opens its own sheet; browsing up leaves the trail as it is');
});

test('a cave nobody travelled into keeps its pin sheet; the first way in is its mouth, a later way is listed and moves no rock', () => {
  const CAVES = 'The Crystal Caverns'; setup(CAVES);
  assert.equal(atlasDoc(worldState.atlas.at).generator.name, 'schematic', 'a cave has a mouth, and the engine does not invent where');
  setup(MIRE); const id = go(CAVES), one = atlasDoc(id);
  assert.equal(one.generator.name, 'dungeon'); assert.equal(one.portals[0].name, 'to ' + MIRE); assert.equal(one.site.where, null); assert.deepEqual(one.unplaced, []);
  go(CROSS); go(CAVES); const two = atlasDoc(id);
  assert.equal(rock(two), rock(one), 'a second way redraws nothing'); assert.equal(two.portals.length, 1);
  assert.deepEqual(two.unplaced.map(u => u.name), ['The way to ' + CROSS]);
  const card = atlasCard(id, { id: two.unplaced[0].id }); assert.equal(card.title, 'The way to ' + CROSS); assert.ok(card.opens, 'the listed way still opens the place it leads to');
});

test('the story may answer "cave": the place is drawn as one, said so only when it is drawn, and an old "other" is asked once more', async () => {
  const BELOW = 'The Hollow Below'; setup(MIRE); const id = go(MIRE, BELOW), A = worldState.atlas, key = MIRE + '|' + BELOW;
  assert.equal(atlasDoc(id).generator.name, 'schematic'); assert.equal(atlasGroundOwed().place, BELOW);
  A.grounds = keyedDict(); A.grounds[key] = { ground: 'other', turn: 2, by: 'story' };
  assert.equal(atlasGroundStale(A, key), true); assert.equal(atlasGroundOwed().place, BELOW, 'asked once more'); assert.equal(atlasDoc(id).generator.name, 'schematic', 'and nothing is drawn meanwhile');
  global.callGM = async function () { return '{"ground":"cave"}'; };
  assert.equal(await atlasGroundSettle('Dripping dark.', ''), 'cave');
  assert.deepEqual(JSON.parse(JSON.stringify(A.grounds[key])), { ground: 'cave', turn: worldState.turn, by: 'story', set: ATLAS_GROUND_SET }); assert.equal(Object.keys(A.grounds).length, 1, 'the stale answer is replaced, not kept beside');
  assert.deepEqual(toasts, ['Map: The Hollow Below is drawn as a cave.']); assert.equal(atlasGroundOwed(), null); assert.equal(atlasGroundStale(A, key), false);
  assert.equal(atlasDoc(id).kind, 'cave'); assert.equal(atlasGroundFile(A, key, 'forest').ok, false, 'a site answered is never replaced');
  A.grounds[key] = { ground: 'other', turn: 2, by: 'story', set: ATLAS_GROUND_SET }; assert.equal(atlasGroundOwed(), null, 'an "other" of this edition is an answer');
  setup('The Deep Dark'); toasts.length = 0; assert.equal(await atlasGroundSettle('Stone all round.', ''), 'cave'); assert.deepEqual(toasts, [], 'a cave with no way on record is not drawn, so nothing is announced');
});

test('a site named on the sheet the party stands in is filed INSIDE that place; leaving steps out one; a known place is found as before', () => {
  setup(MIRE); turn('[SUBLOCATION:' + RIDGE + ']'); assert.equal(worldState.world.sublocation, RIDGE);
  turn('[SUBLOCATION:Old Mill]'); assert.equal(worldState.world.sublocation, 'Old Mill', 'a name the ridge\'s sheet does not show is a place of the mire, as always');
  turn('[SUBLOCATION:' + RIDGE + ']' + rev(LAIR, 'N'));
  const inLair = turn('[SUBLOCATION:' + LAIR + ']'); assert.equal(worldState.world.sublocation, LAIR_SUB, 'the lair pinned on the ridge is in the ridge');
  assert.ok(memory.map.nodes[MIRE + '|' + LAIR_SUB], 'filed under the ridge'); assert.equal(memory.map.nodes[MIRE + '|' + LAIR], undefined, 'never beside it');
  assert.equal(atlasDoc(inLair).kind, 'cave'); assert.equal(atlasDoc(inLair).portals[0].name, 'to ' + RIDGE);
  turn(rev('brood-nest', 'E')); turn('[SUBLOCATION:Brood Nest]'); assert.equal(worldState.world.sublocation, LAIR_SUB + SEP + 'Brood Nest', 'three deep: the nest in the lair in the ridge');
  turn(rev(LAIR, 'S', 'reported')); turn('[SUBLOCATION:' + LAIR + ']'); assert.equal(worldState.world.sublocation, LAIR_SUB, 'a place around it, named from inside (and pinned there as the way back), is that very place: never a new one');
  assert.equal(memory.map.nodes[MIRE + '|' + LAIR], undefined); turn('[SUBLOCATION:Brood Nest]'); assert.equal(worldState.world.sublocation, LAIR_SUB + SEP + 'Brood Nest', 'and back in');
  turn('[SUBLOCATION_LEAVE]'); assert.equal(worldState.world.sublocation, LAIR_SUB, 'leaving steps out ONE');
  turn('[SUBLOCATION_LEAVE]'); assert.equal(worldState.world.sublocation, RIDGE); assert.equal(worldState.atlas.at !== inLair, true);
  assert.equal(turn('[SUBLOCATION:' + LAIR + ']'), inLair, 'back in: the place already known inside the ridge'); assert.equal(worldState.world.sublocation, LAIR_SUB);
  turn('[SUBLOCATION:' + RIDGE + ']'); assert.equal(worldState.world.sublocation, RIDGE, 'the place around it, named again, is that place');
  turn(rev('Old Mill', 'W', 'reported')); turn('[SUBLOCATION:Old Mill]'); assert.equal(worldState.world.sublocation, 'Old Mill', 'a place known at the mire\'s level is found there, though the ridge\'s sheet pins it');
  turn('[SUBLOCATION_LEAVE]'); assert.equal(worldState.world.sublocation, null, 'out of a place of the mire: the mire');
  turn('[SUBLOCATION:' + RIDGE + SEP + 'Goat Track]'); assert.equal(worldState.world.sublocation, RIDGE + SEP + 'Goat Track', 'a written path is authoritative, as before');
  turn('[SUBLOCATION_LEAVE]'); turn('[SUBLOCATION:Goat Track]'); assert.equal(worldState.world.sublocation, RIDGE + SEP + 'Goat Track', 'a place already known inside the ridge is found there by its bare name, pinned or not');
  assert.equal(atlasPublicCanon(LAIR, MIRE, null), null, 'no place in force: nothing is read from a sheet');
});

test('off the public map a leave is the world place, as always', () => {
  engine.makeTestWorld(); delete worldState.atlas; worldState.world.location = 'Town'; worldState.world.sublocation = 'The Old Ram' + SEP + 'Kitchen';
  const tl = placeTimeline('[SUBLOCATION_LEAVE]'); assert.equal(tl.states[tl.states.length - 1].sub, null);
  assert.equal(atlasPlaceLeave('The Old Ram' + SEP + 'Kitchen'), null); assert.equal(atlasPlaceLeave(null), null);
  setup(MIRE); assert.equal(atlasPlaceLeave(LAIR_SUB), RIDGE); assert.equal(atlasPlaceLeave(RIDGE), null); assert.equal(atlasPlaceLeave(null), null);
});

test('the GM is told: a leave steps out one place, and a site inside a sub-location is written as a path', () => {
  setup(MIRE); const p = atlasKnowledgePrompt();
  for (const w of ['[SUBLOCATION_LEAVE] when the party comes back out: it steps out ONE place, to the place the site lies in.', 'A site inside a sub-location the party already stands in is written as a path, [SUBLOCATION:that sub-location — the site].']) assert.ok(p.indexOf(w) > 0, w);
});

test('a drawn sheet is a place on its ground or a site in its rock; a pin sheet and a legacy dungeon are neither', () => {
  const at = lair('N'), legacy = TnDMaps.generate('dungeon', { seed: 'x', site: { kind: 'cave', portals: [{ id: 'm', kind: 'cave', x: 800, y: 900 }] } });
  assert.equal(atlasSheetDrawn(atlasDoc(at.lair)), true); assert.equal(atlasSheetDrawn(atlasDoc(at.ridge)), true); assert.equal(atlasSheetDrawn(legacy), false);
  assert.equal(atlasSheetDrawn(TnDMaps.schematic({ scale: 'wild', title: 'x', features: [] })), false); assert.equal(atlasSheetDrawn(null), false);
  assert.ok(atlasThings(legacy).length > 3, 'a legacy cave\'s named chambers are still its things');
  worldState.atlas.drawn = false; atlasForget(); assert.equal(atlasDoc(at.lair).generator.name, 'schematic', 'the campaign switch keeps pin sheets for sites too');
  const ui = fs.readFileSync(path.join(__dirname, '..', 'ui-atlas.js'), 'utf8'); assert.match(ui, /function atlasPaneDrawn\(doc\)\{return atlasSheetDrawn\(doc\);\}/, 'the pane frames a site as it frames a drawn place');
  assert.match(ui, /atlasSheetStand\(d\)\[0\]/, 'and opens a sheet the party is not on at the middle chamber, never the empty frame\'s middle');
});

(async function () {
  for (const [name, fn] of queue) { try { await fn(); count++; console.log('PASS #771 sites ' + name); } catch (e) { failed++; console.error('FAIL #771 sites ' + name + ': ' + (e && e.message)); } }
  if (only && !matched) { console.error('matched 0 tests'); process.exit(1); }
  console.log(failed ? count + ' passed, ' + failed + ' failed' : 'ALL GREEN — ' + count + ' passed, 0 failed (#771 sites)');
  process.exit(failed ? 1 : 0);
})();
