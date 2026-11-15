// dev/tests-754-damage-only.js — #754: the damage-only roll. An effect the TARGETS save against (a breath weapon, a
// save-for-half spell) has no d20 of the hero's; [CHECK:Draconic Breath|2d6] is the damage alone, rolled by the player.
//   node dev/tests-754-damage-only.js [--only "<test name>"]
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const engine = require('./load-engine.js'); engine.loadEngine('game.js');
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
let count = 0, failed = 0;
global.syncUI = function () {}; global.saveAll = global.saveAll || function () {};
function test(name, fn) {
  if (only && name !== only) return;
  try { fn(); count++; console.log('PASS #754 ' + name); } catch (e) { failed++; console.error('FAIL #754 ' + name + ': ' + e.message); }
}
function fresh() { engine.makeTestWorld(); worldState.turn = 9; worldState.combat = null; delete worldState.pendingCheck; worldState.diceLog = []; }
const src = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('dice where the modifier sits and no DC is a damage-only roll; every older shape is still a d20', () => {
  let c = parseCheckTag('Draconic Breath|2d6');
  assert.ok(c && c.dmgOnly === true && c.dmg.text === '2d6' && c.dc === null && c.mod === 0, JSON.stringify(c));
  c = parseCheckTag('Draconic Breath|2d6|the lancers scatter before the line reaches them');
  assert.ok(c.dmgOnly && c.stake === 'the lancers scatter before the line reaches them', 'the stake still rides');
  assert.equal(parseCheckTag('Longsword attack|+5|DC 14|1d8+3').dmgOnly, false, 'an attack');
  assert.equal(parseCheckTag('Dagger attack|1d4+2|DC 11').dmgOnly, false, 'dice in the modifier\'s seat WITH a DC is an attack');
  assert.equal(parseCheckTag('Thrown knife|+1|1d4').dmgOnly, false, 'a modifier then dice is a d20 with damage');
  assert.equal(parseCheckTag('Stealth check|+5|DC 14').dmgOnly, false);
  assert.equal(parseCheckTag('Luck|1d20').dmgOnly, false, 'a d20 is never damage');
});

test('the result is the damage alone: no face, outcome "damage", a note that leaves the saves to the GM', () => {
  const c = parseCheckTag('Draconic Breath|2d6'), r = resolveCheck(c, 17, [3, 5]);
  assert.equal(r.roll, null); assert.equal(r.total, 8); assert.equal(r.outcome, 'damage'); assert.equal(r.dmgOnly, true);
  assert.deepEqual(r.damage.faces, [3, 5]); assert.equal(r.damage.sides, 6);
  assert.equal(r.diceTag, '[DICE:Draconic Breath|2d6 = 3 + 5 = 8|damage]');
  assert.ok(r.note.indexOf('Draconic Breath: 8 damage (2d6 = 3 + 5 = 8)') >= 0, r.note);
  assert.ok(/BEFORE any saving throw: roll each target's save yourself/.test(r.note) && /never roll it again/.test(r.note), r.note);
  assert.ok(!/d20|SUCCESS|FAILED/.test(r.note), 'no d20 is spoken of: ' + r.note);
  const one = resolveCheck(parseCheckTag('Acid Splash|1d6'), 1, [4]);
  assert.equal(one.diceTag, '[DICE:Acid Splash|1d6 = 4|damage]');
  const self = resolveCheck(parseCheckTag('Draconic Breath|2d6'), 1);
  assert.equal(self.damage.faces.length, 2, 'without faces it rolls its own');
  const atk = resolveCheck(parseCheckTag('Longsword attack|+5|DC 14|1d8+3'), 12, [4]);
  assert.equal(atk.roll, 12); assert.equal(atk.outcome, 'success'); assert.ok(!atk.dmgOnly, 'an attack is untouched');
});

test('the turn: the tag arms it, the modal and the card show the dice and no d20, the click files the damage and plays the damage dice', () => {
  fresh(); const was = playerRollsDice; let sent = [], d20 = 0, dmg = [];
  const _s = global.sendAction, _d = global.showDiceRoll, _m = global.showDamageRoll;
  global.diceRevealLive = function () { return true; };/* #759: this page shows dice */
  global.sendAction = function (note, opts) { sent.push({ note: note, opts: opts }); }; global.showDiceRoll = function () { d20++; return true; }; global.showDamageRoll = function (sides, faces) { dmg.push([sides, faces.length]); return true; };
  try {
    playerRollsDice = true;
    const r = applyMuts('You exhale. [CHECK:Draconic Breath|2d6]'), pc = worldState.pendingCheck;
    assert.ok(pc && pc.dmgOnly, 'armed as damage only');
    assert.ok(r.muts.join('|').indexOf('Roll: Draconic Breath (2d6 damage)') >= 0, r.muts.join('|'));
    const h = rollModalHtml(pc);
    assert.ok(h.indexOf('2d6 damage') >= 0 && h.indexOf('d20') < 0 && h.indexOf('on a hit') < 0, h);
    const card = diceTxt('[CHECK:Draconic Breath|2d6]');
    assert.ok(card.indexOf('dice-pending') >= 0 && card.indexOf('2d6 damage') >= 0 && card.indexOf('d20') < 0, card);
    rollPendingCheck();
    assert.equal(worldState.pendingCheck, undefined);
    assert.equal(sent.length, 1); assert.ok(/damage \(2d6 = /.test(sent[0].note)); assert.ok(/^\[DICE:Draconic Breath\|2d6 = \d \+ \d = \d+\|damage\]$/.test(sent[0].opts.rollTag), sent[0].opts.rollTag);
    assert.equal(d20, 0, 'no d20 is thrown'); assert.deepEqual(dmg, [[6, 2]], 'the damage dice are the roll');
    const log = worldState.diceLog[worldState.diceLog.length - 1];
    assert.equal(log.face, null); assert.equal(log.outcome, 'damage'); assert.equal(log.total, log.dmg.total);
    const before = worldState.diceLog.length; applyMuts(sent[0].opts.rollTag);
    assert.equal(worldState.diceLog.length, before, 'the record riding the continuation is not filed twice');
    const done = diceTxt(sent[0].opts.rollTag);
    assert.ok(done.indexOf('d20:') < 0 && /<strong>\d+<\/strong> -- damage/.test(done), 'the rolled card prints the total, not a d20: ' + done);
    assert.ok(diceTxt('[DICE:Stealth check|d20 = 7|success]').indexOf('d20: <strong>7</strong>') >= 0, 'a d20 record prints as before');
    delete worldState.pendingCheck; const lapsed = diceTxt('[CHECK:Draconic Breath|2d6]');
    assert.ok(lapsed.indexOf('2d6 &middot; unrolled') >= 0, lapsed);
  } finally { playerRollsDice = was; global.sendAction = _s; global.showDiceRoll = _d; global.showDamageRoll = _m; delete global.diceRevealLive; diceRevealFinish(); delete worldState.pendingCheck; }
  const um = src('ui-modals.js');
  assert.ok(um.indexOf('if(typeof diceLivePresent==="function")diceLivePresent(rollReadyDice(chk),chk.label);') >= 0, 'the modal lays the dice the click will throw');
  assert.deepEqual(rollReadyDice(parseCheckTag('Draconic Breath|2d6')), [{ type: 'd6' }, { type: 'd6' }], '#758: a damage-only roll lays its own dice, never a d20');
  assert.deepEqual(rollReadyDice(parseCheckTag('Acid Splash|1d8+2')), [{ type: 'd8' }]);
  assert.deepEqual(rollReadyDice(parseCheckTag('Longsword attack|+5|DC 14|1d8+3')), [{ type: 'd20' }], 'an attack lays its d20; its damage is rolled after the hit');
  assert.deepEqual(rollReadyDice(parseCheckTag('Stealth check|+5|DC 14')), [{ type: 'd20' }]); assert.deepEqual(rollReadyDice(null), [{ type: 'd20' }]);
});

test('the GM is taught the form only while the player rolls, on the MECHANICS line and the tag\'s doc line', () => {
  fresh(); const was = playerRollsDice;
  try {
    playerRollsDice = true; const on = buildSysPrompt().stable;
    assert.ok(on.indexOf('emit the damage dice ALONE — [CHECK:Draconic Breath|2d6] — the player rolls the damage; you roll each target\'s saving throw') >= 0, 'MECHANICS');
    assert.ok(on.indexOf('emit the damage dice alone, no modifier and no DC -- [CHECK:Draconic Breath|2d6]') >= 0, 'the doc line');
    playerRollsDice = false; const off = buildSysPrompt().stable;
    assert.ok(off.indexOf('[CHECK:Draconic Breath|2d6]') < 0, 'the GM-rolls contract is not told of it');
  } finally { playerRollsDice = was; }
});

console.log('#754 damage only: ' + count + ' passed, ' + failed + ' failed');
if (only && !count && !failed) { console.error('matched 0 tests'); process.exit(2); }
process.exitCode = failed ? 1 : 0;
