// dev/tests-768-receipt-written.js — #768 (owner 2026-11-15, v1.1435: "You see subterranean rift to the southwest."
// twice, after #763). The GM writes the receipt sentence itself beside its [MAP_REVEAL:] (its own history shows the
// engine's line after every tag); the engine adds no second one. A quotation inside other prose suppresses nothing.
//   node dev/tests-768-receipt-written.js [--only "<test name>"]
'use strict';
const assert = require('assert/strict'), engine = require('./load-engine.js'); engine.loadEngine('game.js');
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
let count = 0, failed = 0;
global.showToast = function () {}; global.syncUI = function () {}; global.saveAll = global.saveAll || function () {};
function test(name, fn) {
  if (only && name !== only) return;
  try { fn(); count++; console.log('PASS #768 ' + name); } catch (e) { failed++; console.error('FAIL #768 ' + name + ': ' + e.message); }
}
const HERE = 'Shattered Ridge', times = (s, a) => s.split(a).length - 1;
function commit(text) {
  engine.makeTestWorld(); worldState.world.location = HERE; worldState.world.sublocation = null; worldState.turn = 12;
  worldState.atlas = { v: ATLAS_VER, seed: 'k768', knowledge: 1 }; memory.map.nodes[HERE] = newMapNode(0, null); memory.map.nodes[HERE].visits = 1; memory.map.geography = MapKnowledge.create();
  const muts = applyMuts(text, { deferSave: true }), r = atlasKnowledgeCommitResult(text, muts && muts.mapReveals);
  assert.equal(r.refusal, null, r.refusal && r.refusal.reason);
  return { text: cleanTxt(r.text), features: atlasKnowledgeProjection(HERE).features.map(f => f.label + ':' + f.bearing) };
}
const RIFT = 'You see subterranean rift to the southwest.', TAG = '[MAP_REVEAL:new|subterranean rift|SW|observed]';
const SPUR = 'You see ridge spur to the north.', TRACK = 'You hear of Crossroads Track; its precise position is not established.';

test('a receipt the reply wrote itself, directly after its tag, is the receipt: the engine adds no second line', () => {
  const r = commit(TAG + '\n' + RIFT + '\nYou kick into the drift of splintered bone.');
  assert.equal(times(r.text, RIFT), 1, r.text); assert.deepEqual(r.features, ['subterranean rift:SW'], 'and the feature is filed as ever');
  assert.ok(r.text.indexOf(RIFT) < r.text.indexOf('You kick'), 'where the reply put it');
  assert.equal(times(commit(TAG + ' ' + RIFT + ' You kick into the drift.').text, RIFT), 1, 'on the tag\'s own line, with prose after it');
  assert.equal(times(commit(TAG + '\n\n  ' + RIFT + '\n').text, RIFT), 1, 'blank space between');
});

test('a block of tags followed by a block of their lines prints each once', () => {
  const r = commit('[MAP_REVEAL:new|ridge spur|N|observed]\n' + TAG + '\n[MAP_REVEAL:new|Crossroads Track|unknown|reported]\n[TIME_ADVANCE:20]\n' + SPUR + '\n' + RIFT + '\n' + TRACK + '\nYou uncork your flask.');
  for (const q of [SPUR, RIFT, TRACK]) assert.equal(times(r.text, q), 1, q + ' in: ' + r.text);
  assert.equal(r.features.length, 3);
  const half = commit('[MAP_REVEAL:new|ridge spur|N|observed]\n' + TAG + '\n' + RIFT + '\nYou uncork your flask.');
  assert.equal(times(half.text, RIFT), 1); assert.equal(times(half.text, SPUR), 1, 'a feature the reply wrote no line for still gets the engine\'s');
});

test('a receipt written directly before its tag counts too', () => {
  assert.equal(times(commit(RIFT + '\n' + TAG + '\nYou kick.').text, RIFT), 1);
  assert.equal(times(commit('You kick.\n' + RIFT + '   \n\n' + TAG).text, RIFT), 1);
});

test('a quotation inside other prose, or a line past a change of place, is not the receipt: the engine still says it', () => {
  assert.equal(times(commit('No one says "' + RIFT + '" ' + TAG).text, RIFT), 2, 'quoted in dialogue before the tag (the #733 rule)');
  assert.equal(times(commit(TAG + ' The guide mutters, "' + RIFT + '"').text, RIFT), 2, 'quoted in dialogue after the tag');
  assert.equal(times(commit(TAG + '\nYou wade on for an hour.\n' + RIFT).text, RIFT), 2, 'prose stands between the tag and the line');
  assert.equal(times(commit('He warned: ' + RIFT + '\n' + TAG).text, RIFT), 2, 'the end of another sentence before the tag');
  const moved = commit(TAG + '\n[LOCATION:Ashen Road]\n' + RIFT);
  assert.equal(times(moved.text, RIFT), 2, 'after an arrival the line belongs to another place');
  assert.ok(moved.text.indexOf(RIFT) < moved.text.lastIndexOf(RIFT));
});

console.log(count + ' passed, ' + failed + ' failed' + (only && !count && !failed ? ' — matched 0 tests' : ''));
process.exit(failed || (only && !count) ? 1 : 0);
