// dev/tests-767-no-narration-before-roll.js — #767 (owner 2026-11-15: "The narrative happens before the die roll. Once the
// player sends the attack command, nothing else should happen until those dice are rolled, then narrate the outcome").
// The rule the GM is given, and the hold behind it: prose beside a roll request waits for the dice.
//   node dev/tests-767-no-narration-before-roll.js [--only "<test name>"]
'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const engine = require('./load-engine.js'); engine.loadEngine();/* the whole engine: commitGmTurn reads the audio commit hold */
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
let count = 0, failed = 0;
const shown = [], spoken = [];
global.showToast = function () {}; global.syncUI = function () {}; global.saveAll = function () { return true; }; global.saveLocal = function () { return true; };
global.addMsg = function (kind, html) { shown.push({ kind: kind, html: html }); return { _sp: null }; };
global.generateActions = function () {}; global.processPendingCompanionSheets = function () {}; global.audioScenePublish = function () {};
global.speakNarration = function (clean, sp) { spoken.push({ clean: clean, sp: sp }); };
function test(name, fn) {
  if (only && name !== only) return;
  try { fn(); count++; console.log('PASS #767 ' + name); } catch (e) { failed++; console.error('FAIL #767 ' + name + ': ' + e.message); }
}
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const times = (s, a) => s.split(a).length - 1;
function fresh() { engine.makeTestWorld(); playerRollsDice = true; delete worldState.pendingCheck; shown.length = 0; spoken.length = 0; global.carMode = false; }
function turn(resp) { shown.length = 0; spoken.length = 0; commitGmTurn(resp, { userMsg: 'I attack.', playerTxt: 'I attack.' }); return shown.filter(x => x.kind === 'narrator').pop(); }
const SWING = 'You heave the iron crescent skyward and bring it crashing down.';

test('the GM is told: a roll the player\'s own action needs is the tag and nothing else; a forced save keeps its cause', () => {
  fresh();
  const on = buildSysPrompt(), all = on.stable + (on.volatile || '');
  assert.equal(times(all, CHECK_NO_NARRATION), 1, 'said once while the player rolls');
  assert.ok(all.indexOf('the player\'s roll arrives in the next message.' + CHECK_NO_NARRATION) >= 0, 'in the MECHANICS line, right after the stop');
  for (const w of ['PLAYER\'S OWN action needs the roll', 'the [CHECK:] tag and nothing else', 'no narration, no dialogue, no scenery', 'shown nothing until the dice land', 'Narrate the attempt and its outcome together in your reply to the roll', 'Only a saving throw the world forces on the hero'])
    assert.ok(CHECK_NO_NARRATION.indexOf(w) >= 0, 'the rule says: ' + w);
  playerRollsDice = false; const off = buildSysPrompt();
  assert.equal((off.stable + (off.volatile || '')).indexOf('PLAYER\'S OWN action'), -1, 'while the GM rolls there is no such rule');
  playerRollsDice = true;
});

test('the roll\'s answer asks for the attempt and its outcome as one moment', () => {
  const hit = resolveCheck({ label: 'Greataxe attack', mod: 6, dc: 13 }, 12, null), miss = resolveCheck({ label: 'Pick the lock', mod: 4, dc: 15, stake: 'a snapped pick' }, 2, null);
  for (const r of [hit, miss]) { assert.ok(r.note.indexOf('Narrate the attempt and its outcome now, as one moment') >= 0, r.note); assert.ok(r.note.indexOf('nothing of it has been told yet') >= 0); assert.equal(r.note.indexOf('Narrate the outcome of that check now'), -1); }
});

test('which rolls hold their prose: the hero\'s own attempts, never a save the world forces', () => {
  for (const l of ['Greataxe attack', 'Strength check', 'Pick the lock', 'Draconic Breath', 'Saving the child from the fire?'.replace('Saving', 'Rescue'), 'Persuade the savage'])
    assert.equal(checkHoldsProse({ label: l }), true, l);
  for (const l of ['Dexterity saving throw', 'Wisdom save', 'Constitution Save', 'Saves against poison'])
    assert.equal(checkHoldsProse({ label: l }), false, l);
  assert.equal(checkHoldsProse(null), false); assert.equal(checkHoldsProse({}), false);
  assert.equal(preRollProseHtml('A <b>b</b>.', false), '<p>' + escProse('A <b>b</b>.') + '</p>', 'shown: the paragraph as it always was');
  assert.equal(preRollProseHtml('A <b>b</b>.', true), '<div class="pre-roll pre-roll-held"><p>' + escProse('A <b>b</b>.') + '</p></div>', 'held: the same paragraph, wrapped, escaped');
});

test('a reply that asks for the hero\'s roll shows the die and holds its prose off the page and out of the reader', () => {
  fresh();
  const m = turn(SWING + '\n[CHECK:Greataxe attack|+6|DC 13|1d12+6|the serpent lunging to tear open your throat]');
  assert.ok(worldState.pendingCheck && worldState.pendingCheck.label === 'Greataxe attack', 'the check is armed');
  assert.ok(m.html.indexOf('dice-pending') >= 0, 'the die is offered');
  assert.ok(m.html.indexOf('<div class="pre-roll pre-roll-held"><p>' + escProse(SWING)) >= 0, 'the swing is held: ' + m.html.slice(-200));
  assert.equal(m.html.indexOf('</div><p>' + escProse(SWING)), -1, 'and is nowhere else on the card');
  assert.deepEqual(spoken, [{ clean: '', sp: null }], 'not read out: the reader gets the roll\'s stake alone');
  assert.equal(worldState.transcript[worldState.transcript.length - 1].x.indexOf(SWING), 0, 'the transcript keeps every word');
});

test('a forced save, a reply with no roll, and a drive are not held', () => {
  fresh();
  let m = turn('The floor gives way beneath you.\n[CHECK:Dexterity saving throw|+2|DC 14|a fall onto the spikes]');
  assert.ok(worldState.pendingCheck, 'armed'); assert.equal(m.html.indexOf('pre-roll-held'), -1, 'the cause of a save is what the player rolls against');
  assert.equal(spoken[0].clean.indexOf('The floor gives way'), 0, 'and it is read');
  fresh(); m = turn('The serpent coils back, hissing.');
  assert.equal(m.html.indexOf('pre-roll-held'), -1); assert.equal(spoken[0].clean, 'The serpent coils back, hissing.');
  fresh(); global.carMode = true; m = turn(SWING + '\n[CHECK:Greataxe attack|+6|DC 13]');
  assert.ok(m.html.indexOf('pre-roll-held') >= 0, 'the page still holds it'); assert.equal(spoken[0].clean.indexOf(SWING), 0, 'a drive has no page: it hears the narration as before');
  global.carMode = false;
});

test('held prose is shown when the dice rest, on Hold back, and when the next turn lands', () => {
  const els = [{ className: 'pre-roll pre-roll-held' }, { className: 'pre-roll pre-roll-held' }], was = global.document;
  global.document = { querySelectorAll: s => s === '.pre-roll-held' ? els.filter(e => /pre-roll-held/.test(e.className)) : [], querySelector: () => null, getElementById: () => null };
  try {
    assert.equal(preRollReveal({ contains: e => e === els[1] }), 1, 'the message just added keeps its own prose held'); assert.equal(els[1].className, 'pre-roll pre-roll-held'); els[0].className = 'pre-roll pre-roll-held';
    assert.equal(preRollReveal(), 2); assert.deepEqual(els.map(e => e.className), ['pre-roll', 'pre-roll']); assert.equal(preRollReveal(), 0, 'nothing left to show');
    fresh(); worldState.pendingCheck = { label: 'Greataxe attack', mod: 6, dc: 13 }; els[0].className = 'pre-roll pre-roll-held'; busy = false;
    reconsiderPendingCheck(); assert.equal(els[0].className, 'pre-roll', 'Hold back shows it'); assert.equal(worldState.pendingCheck, undefined);
    els[1].className = 'pre-roll pre-roll-held'; turn('The serpent strikes first.'); assert.equal(els[1].className, 'pre-roll', 'a new turn shows what an earlier roll held');
  } finally { global.document = was; }
  const g = read('game.js'), a = g.indexOf('function rollPendingCheck(){'), z = g.indexOf('\n}', a), fn = g.slice(a, z);
  const send = fn.indexOf('  sendAction(r.note,{silent:true,rollTag:r.diceTag});'), wait = fn.indexOf('  diceRevealWait().then(function(){preRollReveal();});');
  const begin = fn.indexOf('rev=diceRevealBegin(r,live)');
  assert.ok(begin >= 0 && wait > begin && send > wait && fn.slice(wait, send).split('\n').length === 2, 'the click asks for it once the reveal has begun, and it is shown when the dice have come to rest');
  assert.equal(times(fn, 'preRollReveal'), 1, 'and only then');
});

test('a reload holds the prose of a waiting roll, and the page knows how to hide it', () => {
  const b = read('ui-boot.js'), html = read('index.html'), g = read('game.js');
  assert.ok(b.indexOf('addMsg("narrator",preRollProseHtml(e.x,i===tr.length-1&&checkHoldsProse(worldState.pendingCheck)),{replayText:e.x,') >= 0, 'the replay holds the last narration while its roll waits');
  assert.ok(/\.pre-roll-held\{display:none;\}/.test(html), 'the held state is hidden');
  const held = g.indexOf('  var _held=!_refusal&&/\\[CHECK:/.test(String(resp))&&checkHoldsProse(worldState.pendingCheck);'), add = g.indexOf('  var _audioSaved=saveLocal();\n  var narEl=addMsg("narrator",(dice||"")+preRollProseHtml(clean,_held),'), rev = g.indexOf('  preRollReveal(narEl);');
  assert.ok(held >= 0 && add > held && rev > add, 'the persist stays directly before the first display step; the new message is held, then the older ones are shown');
});

console.log(count + ' passed, ' + failed + ' failed' + (only && !count && !failed ? ' — matched 0 tests' : ''));
process.exit(failed || (only && !count) ? 1 : 0);
