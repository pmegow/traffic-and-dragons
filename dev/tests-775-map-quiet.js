// dev/tests-775-map-quiet.js — #775 (owner 2026-11-18, a screenshot of Turn 0: "Let's get rid of this text. These should be
// markers on the map, not text that repeats every turn"; again 2026-11-20: "Let's drop this part of the narrative. Let's let
// the map fill in those details unless the player asks").
// A map disclosure adds NO line to the story: not the engine's, and not one the reply wrote itself. The map shows the
// feature; the Console says what the map gained; the GM's standing rule says so. The scanner's edge cases are #768's
// (dev/tests-768-receipt-written.js); the reroll and the admission rules are #733's (dev/tests-733-map-protocol.js).
//   node dev/tests-775-map-quiet.js [--only "<test name>"]
'use strict';
const assert = require('assert/strict'), engine = require('./load-engine.js'); engine.loadEngine();
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
let count = 0, failed = 0; const said = [];
function test(name, fn) {
  if (only && name !== only) return;
  try { fn(); count++; console.log('PASS #775 ' + name); } catch (e) { failed++; console.error('FAIL #775 ' + name + ': ' + e.message); }
}
const HERE = 'The Crossroads of Ashenveil';
function setup() {
  engine.makeTestWorld(); worldState.world.location = HERE; worldState.world.sublocation = null; worldState.turn = 0;
  worldState.atlas = { v: ATLAS_VER, seed: 'k775', knowledge: 1 }; memory.map.nodes[HERE] = newMapNode(0, null); memory.map.nodes[HERE].visits = 1; memory.map.geography = MapKnowledge.create();
  said.length = 0; global.showToast = function (m) { said.push(String(m)); };
  for (const k of ['syncUI', 'updateAbPanel', 'updateSpPanel', 'showArchetypeModal', 'showStatBumpModal', 'saveAll', 'saveLocal', 'saveCore', 'saveMem', 'generateActions', 'processPendingCompanionSheets', 'speakNarration', 'audioScenePublish', 'atlasFollow']) global[k] = function () {};
  global.addMsg = function () { return { style: {}, appendChild() {}, remove() {} }; };
}
function reveal(text) { const r = atlasKnowledgeCommitResult(text, null, { commit: 'gm:' + worldState.turn + ':' + Math.random() }); assert.equal(r.refusal, null, r.refusal && r.refusal.reason); return r.text; }
const labels = () => atlasKnowledgeProjection(HERE).features.map(f => f.label + ':' + f.bearing + ':' + f.mode);
const GATE = '[MAP_REVEAL:new|Crossroads Keep Gate|N|observed]', MARSH = '[MAP_REVEAL:new|Blighted Reach Marshland|E|observed]';

test('a real turn: the owner\'s two lines leave the story, the stored turn and the GM\'s history; the map holds both', () => {
  setup();
  const raw = GATE + '\nYou see Crossroads Keep Gate to the north.\n' + MARSH + '\nYou see Blighted Reach Marshland to the east.\n\nDawn bleeds through the smog like an open wound.';
  commitGmTurn(raw, { userMsg: 'Begin.', playerTxt: 'Begin.' });
  const shown = worldState.transcript[worldState.transcript.length - 1].x, kept = sessionLog[sessionLog.length - 1].content;
  assert.equal(shown.trim(), 'Dawn bleeds through the smog like an open wound.', 'what the player reads');
  assert.ok(!/You see /.test(kept), 'the GM\'s own history still shows the line it would copy next turn: ' + kept);
  assert.ok(kept.indexOf(GATE) >= 0 && kept.indexOf(MARSH) >= 0, 'the GM\'s history keeps its own directives');
  assert.deepEqual(labels(), ['Crossroads Keep Gate:N:observed', 'Blighted Reach Marshland:E:observed'], 'the map holds both');
  assert.deepEqual(said, ['Map: Crossroads Keep Gate lies to the north; Blighted Reach Marshland lies to the east.'], 'and the Console says so, once');
});

test('a reply that wrote no such line is stored byte for byte, and the engine adds none', () => {
  setup();
  const raw = 'Dawn bleeds through the smog. ' + GATE + '\n\nThe cold wind howls. ' + MARSH;
  assert.equal(reveal(raw), raw); assert.equal(labels().length, 2);
});

test('the Console names what changed, once: new, heard of, a direction settled — never a repeat, scenery or the place itself', () => {
  setup();
  reveal('[MAP_REVEAL:new|old well|unknown|observed][MAP_REVEAL:new|Hollow Road|S|reported][MAP_REVEAL:new|the Weir|unknown|reported]');
  assert.deepEqual(said, ['Map: old well (position not established); Hollow Road is said to lie to the south; the Weir is spoken of (position not established).']);
  said.length = 0; reveal('[MAP_REVEAL:new|Hollow Road|S|reported]');
  assert.deepEqual(said, [], 'an unchanged repeat is not said again');
  const well = atlasKnowledgeProjection(HERE).features.filter(f => f.label === 'old well')[0].id;
  worldState.turn = 1; reveal('[MAP_REVEAL:' + well + '|old well|W|observed]');
  assert.deepEqual(said, ['Map: old well lies to the west.'], 'a direction settled later is said');
  said.length = 0; worldState.turn = 2; reveal('[MAP_REVEAL:new|stone floor|S|observed][MAP_REVEAL:new|' + HERE + '|N|observed][MAP_REVEAL:new|bone cairn|E|observed]');
  assert.deepEqual(said, ['Map: bone cairn lies to the east.'], 'scenery and the place\'s own name are not announced: ' + JSON.stringify(said));
  /* scenery is kept out at the door (#770), but an older store can hold some: what the sheet does not show is not announced */
  const empty = MapKnowledge.create(), floor = { op: 'disclose', id: 'new', label: 'stone floor', proposalKind: '', bearing: 'S', mode: 'observed', quote: 'You see stone floor to the south.' };
  const old = MapKnowledge.prepare(empty, [floor], { channel: 'gm', commit: 'old:0', turn: 0, container: HERE, text: floor.quote }); assert.ok(old.ok, old.reason);
  said.length = 0; assert.deepEqual(atlasKnowledgeNews(empty, old.state), [], 'scenery on file was announced'); assert.deepEqual(said, []);
});

/* The independent review, finding 1: with the lines gone, a reply of map tags alone showed NOTHING — no narration, no
   buttons, and the exchange left the GM's history (the bookkeeping rule). Such a reply keeps the receipts as its narration. */
test('a reply of map tags alone is never a turn with nothing to show: the receipts are its narration', () => {
  for (const raw of [GATE + '\n' + MARSH, GATE + '\nYou see Crossroads Keep Gate to the north.\n' + MARSH + '\nYou see Blighted Reach Marshland to the east.']) {
    setup(); commitGmTurn(raw, { userMsg: 'I look around.', playerTxt: 'I look around.' });
    const last = worldState.transcript[worldState.transcript.length - 1];
    assert.equal(last.x.replace(/\s+/g, ' ').trim(), 'You see Crossroads Keep Gate to the north. You see Blighted Reach Marshland to the east.', 'what the player reads: ' + JSON.stringify(last.x));
    assert.ok(!last.bk && !sessionLog[sessionLog.length - 1].bk, 'the turn was filed as bookkeeping: it would leave the GM\'s history');
    assert.equal(labels().length, 2);
  }
});

test('the Console line is bounded, and judges the place\'s own name against the resolved place', () => {
  setup();
  reveal('Stones everywhere. ' + ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'].map(n => '[MAP_REVEAL:new|stone ' + n + '|N|observed]').join(''));
  assert.deepEqual(said, ['Map: stone one lies to the north; stone two lies to the north; stone three lies to the north; stone four lies to the north; stone five lies to the north; stone six lies to the north; and 2 more.']);
  const empty = MapKnowledge.create(), ev = { op: 'disclose', id: 'new', label: HERE, proposalKind: '', bearing: 'N', mode: 'observed', quote: 'You see ' + HERE + ' to the north.' };
  const filed = MapKnowledge.prepare(empty, [ev], { channel: 'gm', commit: 'm:0', turn: 0, container: 'Old Mill', text: ev.quote }); assert.ok(filed.ok, filed.reason);
  const real = global.locResolve; global.locResolve = k => (k === 'Old Mill' ? HERE : real(k));   /* 'Old Mill' was merged into this place */
  try { said.length = 0; assert.deepEqual(atlasKnowledgeNews(empty, filed.state), [], 'the place\'s own name, filed under a name since merged into it, was announced'); } finally { global.locResolve = real; }
});

test('a refused group says its refusal and announces no marker', () => {
  setup();
  const r = atlasKnowledgeCommitResult(GATE + '[MAP_REVEAL:new|a spring|impossible|observed]', null, { commit: 'gm:0:bad' });
  assert.ok(r.refusal, 'the group should have been refused'); assert.equal(labels().length, 0);
  assert.ok(said.length >= 1 && !said.some(m => / lies to the | is said to lie | \(position not established\)/.test(m)), JSON.stringify(said));
});

test('the standing rule: nothing is added to the narration, no formulaic line, no reciting unless the player asks', () => {
  setup();
  const p = atlasKnowledgePrompt();
  assert.ok(/puts the feature on the player's map; nothing is added to your narration/.test(p), 'the GM is told nothing is added');
  assert.ok(/never write a formulaic "You see\/hear of \[label\] to the \[direction\]" line/.test(p), 'and never to write the line itself');
  assert.ok(/do not recite a place's features or their directions unless the player asks or the scene calls for it/.test(p), 'and not to recite the map');
  assert.ok(!/inserts and speaks/.test(p), 'the retired promise that the engine speaks a discovery sentence');
  assert.ok(/never use a disclosure for secrets, negation, hypotheticals, or private preparation/.test(p), 'a directive is still a public statement');
  reveal(GATE);
  assert.ok(/do not restate them as lines of their own/.test(atlasKnowledgeRerollNote()), 'the reroll note says the same');
});

console.log(count + ' passed, ' + failed + ' failed' + (only && !count && !failed ? ' — matched 0 tests' : ''));
process.exit(failed || (only && !count) ? 1 : 0);
