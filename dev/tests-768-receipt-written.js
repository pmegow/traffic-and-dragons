// dev/tests-768-receipt-written.js — #768 (owner 2026-11-15, v1.1435: "You see subterranean rift to the southwest."
// twice, after #763). The GM writes the receipt sentence itself beside its [MAP_REVEAL:] (its own history shows the
// engine's line after every tag); the engine adds no second one. A quotation inside other prose suppresses nothing.
// #775 (owner 2026-11-18/20): the engine writes NO receipt line any more, and the line the reply wrote itself is TAKEN OUT
// by the same scanner. The cases below are #768's, read the new way: the reply's own receipt line → gone (0); a quotation
// or a line that is not that receipt → the reply's prose, kept once (1), nothing added.
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
  return { raw: r.text, text: cleanTxt(r.text), features: atlasKnowledgeProjection(HERE).features.map(f => f.label + ':' + f.bearing) };
}
const RIFT = 'You see subterranean rift to the southwest.', TAG = '[MAP_REVEAL:new|subterranean rift|SW|observed]';
const SPUR = 'You see ridge spur to the north.', TRACK = 'You hear of Crossroads Track; its precise position is not established.';

test('a receipt the reply wrote itself, directly after its tag, is taken out of the story', () => {
  const r = commit(TAG + '\n' + RIFT + '\nYou kick into the drift of splintered bone.');
  assert.equal(times(r.text, RIFT), 0, r.text); assert.deepEqual(r.features, ['subterranean rift:SW'], 'and the feature is filed as ever');
  assert.equal(r.text.trim(), 'You kick into the drift of splintered bone.', 'the rest of the reply stands');
  assert.equal(commit('A.\n' + TAG + ' ' + RIFT + '\nB.').raw, 'A.\n' + TAG + '\nB.', 'on the tag\'s own line, nothing after it');
  assert.equal(commit('A.\n' + TAG + ' ' + RIFT + ' [TIME_ADVANCE:5]\nB.').raw, 'A.\n' + TAG + ' [TIME_ADVANCE:5]\nB.', 'tags beside it stay');
  assert.equal(times(commit(TAG + '\n\n  ' + RIFT + '\nYou kick.').text, RIFT), 0, 'blank space between');
});

test('a block of tags followed by a block of their lines loses each line', () => {
  const r = commit('[MAP_REVEAL:new|ridge spur|N|observed]\n' + TAG + '\n[MAP_REVEAL:new|Crossroads Track|unknown|reported]\n[TIME_ADVANCE:20]\n' + SPUR + '\n' + RIFT + '\n' + TRACK + '\nYou uncork your flask.');
  for (const q of [SPUR, RIFT, TRACK]) assert.equal(times(r.text, q), 0, q + ' in: ' + r.text);
  assert.equal(r.features.length, 3); assert.equal(r.text.trim(), 'You uncork your flask.');
  const half = commit('[MAP_REVEAL:new|ridge spur|N|observed]\n' + TAG + '\n' + RIFT + '\nYou uncork your flask.');
  assert.equal(times(half.text, RIFT), 0); assert.equal(times(half.text, SPUR), 0, 'and the engine writes none for the feature the reply wrote no line for');
  assert.equal(half.features.length, 2);
});

test('a receipt written directly before its tag is taken out too', () => {
  assert.equal(times(commit(RIFT + '\n' + TAG + '\nYou kick.').text, RIFT), 0);
  const r = commit('You kick.\n' + RIFT + '   \n\n' + TAG);
  assert.equal(times(r.text, RIFT), 0); assert.equal(r.text.trim(), 'You kick.');
});

test('a quotation inside other prose, or a line past a change of place, is the reply\'s own prose: it stays, and nothing is added', () => {
  assert.equal(times(commit('No one says "' + RIFT + '" ' + TAG).text, RIFT), 1, 'quoted in dialogue before the tag (the #733 rule)');
  assert.equal(times(commit(TAG + ' The guide mutters, "' + RIFT + '"').text, RIFT), 1, 'quoted in dialogue after the tag');
  assert.equal(times(commit(TAG + '\nYou wade on for an hour.\n' + RIFT + '\nYour boots fill.').text, RIFT), 1, 'prose stands between the tag and the line');
  assert.equal(times(commit('He warned: ' + RIFT + '\n' + TAG).text, RIFT), 1, 'the end of another sentence before the tag');
  const moved = commit(TAG + '\n[LOCATION:Ashen Road]\n' + RIFT + '\nThe road is empty.');
  assert.equal(times(moved.text, RIFT), 1, 'after an arrival the line belongs to another place');
  assert.deepEqual(commit('No one says "' + RIFT + '" ' + TAG).features, ['subterranean rift:SW'], 'and the disclosure is filed all the same');
});

/* The independent review of #775: once the line is CUT, "begins with the sentence" is not enough. */
test('the sentence with anything after it on its line is the reply\'s prose: nothing is cut', () => {
  const keeps = t => { const r = commit(t); assert.equal(r.raw, t, 'cut: ' + JSON.stringify(r.raw)); assert.deepEqual(r.features, ['subterranean rift:SW']); };
  keeps(TAG + ' ' + RIFT + ' You kick into the drift.');
  keeps(TAG + '\n' + RIFT + '.. and beyond it, the grey line of the sea.');
  keeps(TAG + '\n' + RIFT + '" she says.');
  keeps(TAG + '\n' + RIFT + ' Its mouth breathes cold.');
  keeps(TAG + '\n[SAY:Old Tam]' + RIFT + '\nThe old man points.');
  keeps(TAG + '\n[SAY:Old Tam]' + RIFT + ' That is where they took her.');
  keeps(TAG + '\nYou see smoke rising beyond the ridge.\n' + RIFT + '\nAsh drifts down.');
  keeps(TAG + '\n' + RIFT + ' ' + RIFT);
});

test('one directive stated twice with one line of its own: the line is cut once, and the prose after it is whole', () => {
  const r = commit('A.\n' + TAG + '\n' + TAG + '\n' + RIFT + '\nThe wind howls across the moor tonight, and the rain comes.');
  assert.equal(r.raw, 'A.\n' + TAG + '\n' + TAG + '\nThe wind howls across the moor tonight, and the rain comes.');
  assert.equal(commit('A.\r\n' + TAG + '\r\n' + RIFT).raw, 'A.\r\n' + TAG, 'CRLF: no lone carriage return is left at the end');
});

test('a reply of map tags alone, or of tags and their own lines, keeps receipts as its narration: never a turn with nothing to show', () => {
  assert.equal(commit(TAG).text.trim(), RIFT, 'tags alone');
  assert.equal(commit(TAG + '\n' + RIFT).text.trim(), RIFT, 'a tag and its own line: said once');
  assert.equal(commit(TAG + '\n[TIME_ADVANCE:5]').text.trim(), RIFT);
});

test('a line taken out leaves no gap: the paragraphs it stood between keep one blank line', () => {
  assert.equal(commit('A.\n\n' + TAG + '\n\n' + RIFT + '\n\nB.').raw, 'A.\n\n' + TAG + '\n\nB.');
  assert.equal(commit('A.\n' + TAG + '\n' + RIFT).raw, 'A.\n' + TAG, 'the last line of the reply');
  assert.equal(commit(RIFT + '\n' + TAG + '\nB.').raw, TAG + '\nB.', 'the first line of the reply');
  assert.equal(commit('A.\n' + TAG + '\nB.').raw, 'A.\n' + TAG + '\nB.', 'a reply with no such line is stored byte for byte');
});

console.log(count + ' passed, ' + failed + ' failed' + (only && !count && !failed ? ' — matched 0 tests' : ''));
process.exit(failed || (only && !count) ? 1 : 0);
