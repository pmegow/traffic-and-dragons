// dev/tests-762-map-and-import.js — four owner findings of 2026-11-15 (the Petrified Mire turn and the wizard's import):
//   #762 an import in the wizard goes straight to the character (no Play-as chooser); a running game keeps the chooser;
//   #763 a map disclosure the reply states twice prints its receipt once;
//   #764 the public sheet's party marker bears the place's name;
//   #765 the ground is read from the place's head noun (Petrified Mire is a mire), a named feature elsewhere lends none.
//   node dev/tests-762-map-and-import.js [--only "<test name>"]
'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const engine = require('./load-engine.js'); engine.loadEngine('game.js');
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
let count = 0, failed = 0;
const said = []; global.showToast = function (m) { said.push(String(m)); }; global.syncUI = function () {}; global.saveAll = global.saveAll || function () {};
function test(name, fn) {
  if (only && name !== only) return;
  try { fn(); count++; console.log('PASS #762 ' + name); } catch (e) { failed++; console.error('FAIL #762 ' + name + ': ' + e.message); }
}
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const times = (s, a) => s.split(a).length - 1;
const HERE = 'Petrified Mire';
function setup() {
  engine.makeTestWorld(); worldState.world.location = HERE; worldState.world.sublocation = null; worldState.turn = 2;
  worldState.atlas = { v: ATLAS_VER, seed: 'k762', knowledge: 1 }; memory.map.nodes[HERE] = newMapNode(0, null); memory.map.nodes[HERE].visits = 1;
  memory.map.geography = MapKnowledge.create(); said.length = 0;
}
function commit(text) { const r = atlasKnowledgeCommitResult(text, null, { commit: 'gm:' + worldState.turn + ':' + Math.random() }); assert.equal(r.refusal, null, r.refusal && r.refusal.reason); return cleanTxt(r.text); }
const RIDGE = 'You see Shattered Ridge to the north.', TRACK = 'You see Crossroads Track to the south.';

/* #775: no receipt line is printed any more. #763's rule lives on in two places: the Console names a feature once however
   often the reply states it, and the evidence the core checks (atlasKnowledgePublish) holds each receipt once a place. */
test('a disclosure the reply states twice is filed once and said once; the story gains no line', () => {
  setup();
  const out = commit('A.[MAP_REVEAL:new|Shattered Ridge|N|observed][MAP_REVEAL:new|Shattered Ridge|N|observed] B.[MAP_REVEAL:new|Crossroads Track|S|observed] C.[MAP_REVEAL:new|Crossroads Track|S|observed] D.');
  assert.equal(times(out, 'You see'), 0, 'a receipt line in the story'); assert.ok(/A\..*B\..*C\..*D\./.test(out.replace(/\s+/g, ' ')), 'the reply\'s own words stand: ' + out);
  assert.deepEqual(said, ['Map: Shattered Ridge lies to the north; Crossroads Track lies to the south.'], 'each said once');
  assert.deepEqual(atlasKnowledgeProjection(HERE).features.map(f => f.label + ':' + f.bearing), ['Shattered Ridge:N', 'Crossroads Track:S'], 'the record holds each once');
});

test('two different disclosures are each filed; the evidence holds one receipt a place', () => {
  setup();
  const out = commit('A.[MAP_REVEAL:new|Shattered Ridge|N|observed] B.[MAP_REVEAL:new|Crossroads Track|S|observed]');
  assert.equal(times(out, 'You see'), 0); assert.equal(atlasKnowledgeProjection(HERE).features.length, 2);
  const a = { container: 'Petrified Mire', event: atlasKnowledgeFields(['new', 'Shattered Ridge', 'N', 'observed']), start: 0, end: 43, directive: '[MAP_REVEAL:new|Shattered Ridge|N|observed]' };
  const text = a.directive + a.directive, b = Object.assign({}, a, { container: 'Ashen Road', start: 43, end: 86 });
  assert.equal(times(atlasKnowledgePublish(text, [a, b]), RIDGE), 2, 'seen from two places: evidence at each');
  assert.equal(times(atlasKnowledgePublish(text, [a, Object.assign({}, a, { start: 43, end: 86 })]), RIDGE), 1, 'the same place: once');
});

test('the public sheet\'s party marker bears the place\'s name', () => {
  setup(); atlasFollow();
  const A = worldState.atlas, m = atlasMarkers(A.at);
  assert.equal(m.length, 1); assert.equal(m[0].kind, 'party'); assert.equal(m[0].label, 'Petrified Mire');
  assert.equal(atlasPublicParty(A.at).label, 'Petrified Mire');
  const src = read('atlas.js');
  assert.ok(src.indexOf('label:p.label?p.label:(p.last?"Last mapped place":(p.exact?"The party":"The party (somewhere here)"))') >= 0, 'a position with no name of its own keeps the old words');
});

test('the ground is read from the head noun; a named feature elsewhere lends none', () => {
  const f = (id, label, b, m) => ({ id: id, label: label, bearing: b || 'unknown', mode: m || 'observed' });
  assert.deepEqual(atlasPublicLandscape('Petrified Mire', [f('a', 'Shattered Ridge', 'N'), f('b', 'Crossroads Track', 'S'), f('c', 'frozen trail'), f('d', 'sunken pool')]),
    { terrain: ['marsh'], routes: [{ id: 'b', kind: 'path', bearing: 'S', feature: 'b' }] }, 'the owner\'s sheet: reeds, and the track sampled at its pin');
  for (const [title, ground] of [['Petrified Mire', 'marsh'], ['The Shattered Ridge', 'hills'], ['Blackwater Fen', 'marsh'], ['The Whispering Thicket', 'forest'], ['Ashen Steppe', 'grass'], ['Mirror Tarn', 'water'], ['Sun Glade', 'clearing']])
    assert.deepEqual(atlasPublicLandscape(title, []).terrain, [ground], title);
  for (const title of ['Ridge Gate Tavern', 'Mire Warden Tower', 'The Fen House', 'Trail\'s End Inn', 'Ridge of Skulls'])
    assert.deepEqual(atlasPublicLandscape(title, []), { terrain: [], routes: [] }, title + ': the head noun is not ground');
  assert.deepEqual(atlasPublicLandscape('Boundary Post', [f('a', 'a low ridge', 'N'), f('b', 'stinking mire')]).terrain, ['hills', 'marsh'], 'a plain phrase is the ground the party stands in');
  assert.deepEqual(atlasPublicLandscape('Boundary Post', [f('a', 'Shattered Ridge', 'N'), f('b', 'The Black Fen')]).terrain, [], 'a named place is elsewhere');
  assert.deepEqual(atlasPublicLandscape('Boundary Post', [f('a', 'frozen trail')]).routes, [], 'a route with no direction is still not drawn');
  assert.equal(atlasPublicLandscapeNamed('Deep timber'), false, 'a capital that only opens the phrase is not a name');
  assert.equal(atlasPublicLandscapeNamed('the Sunken Pool'), true);
});

test('in the wizard an import skips the Play-as chooser; the sheet is admitted first either way', () => {
  const src = read('ui-browsers.js'), a = src.indexOf('function showCharImportPreview('), z = src.indexOf('\n}', a), fn = src.slice(a, z);
  const admit = fn.indexOf('sheetAdmit(char'), refuse = fn.indexOf('if(!_ad.ok){if(onCancel)onCancel();return;}'), direct = fn.indexOf('if(charImportDirect()){onAccept();return;}'), modal = fn.indexOf('modalShell(');
  assert.ok(admit >= 0 && refuse > admit && direct > refuse && modal > direct, 'admit, refuse, then the direct road, then the chooser');
  const m = src.match(/function charImportDirect\(\)\{[^\n]*\}/); assert.ok(m, 'charImportDirect is one line');
  const make = new Function('document', m[0] + ';return charImportDirect();');
  const doc = d => ({ getElementById: id => id === 'char-screen' ? d : null });
  assert.equal(make(doc({ style: { display: 'block' } })), true, 'the wizard is showing');
  assert.equal(make(doc({ style: { display: '' } })), true, 'shown by its stylesheet');
  assert.equal(make(doc({ style: { display: 'none' } })), false, 'a running game keeps the chooser');
  assert.equal(make(doc(null)), false, 'no wizard on the page');
});

console.log(count + ' passed, ' + failed + ' failed' + (only && !count && !failed ? ' — matched 0 tests' : ''));
process.exit(failed || (only && !count) ? 1 : 0);
