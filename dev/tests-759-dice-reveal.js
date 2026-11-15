// dev/tests-759-dice-reveal.js — #759: the dice reveal the roll. The numbers are rolled and the turn is sent at the
// click; what the player is shown waits on the dice coming to rest, and so does the GM's reply.
//   node dev/tests-759-dice-reveal.js [--only "<test name>"]
'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), engine = require('./load-engine.js'); engine.loadEngine('game.js');
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
const cases = [];
function test(name, fn) { if (!only || name === only) cases.push({ name: name, fn: fn }); }
global.syncUI = function () {}; global.saveAll = function () {}; global.showToast = function () {};
const src = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const TAG = '[DICE:Greataxe attack|d20 = 16 + 6 = 22|success|1d12+4 = 2 + 4 = 6]';
let sent, d20, dmg, live;
function arm(tag) {
  engine.makeTestWorld(); worldState.turn = 4; worldState.diceLog = []; diceRevealFinish();
  sent = []; d20 = []; dmg = []; live = true;
  global.sendAction = function (note, opts) { sent.push({ note: note, opts: opts }); };
  global.diceRevealLive = function () { return live; };
  global.showDiceRoll = function (face, opts) { d20.push({ face: face, opts: opts }); return true; };
  global.showDamageRoll = function (sides, faces, opts) { dmg.push({ sides: sides, faces: faces, opts: opts }); return true; };
  playerRollsDice = true; applyMuts('You swing. ' + tag);
}
const settled = p => { let done = false; p.then(() => { done = true; }); return new Promise(r => setTimeout(() => r(done), 5)); };

test('the card shows no number while the dice are in the air, the d20 alone once it lands, everything at the end', () => {
  const cast = diceRevealCardHtml(TAG, 'cast'), mid = diceRevealCardHtml(TAG, 'd20'), all = diceRevealCardHtml(TAG, 'all');
  assert.ok(cast.indexOf('Greataxe attack') >= 0 && cast.indexOf('the dice are cast') >= 0 && !/\d/.test(cast.replace(/<[^>]*>/g, '')), 'cast: ' + cast);
  assert.ok(mid.indexOf('<strong>16</strong>') >= 0 && mid.indexOf('success') >= 0 && mid.indexOf('damage dice to come') >= 0, 'd20: ' + mid);
  assert.ok(mid.indexOf('1d12') < 0 && mid.indexOf('= 6') < 0, 'the damage is not on the card before its dice land: ' + mid);
  assert.equal(all, diceTxt(TAG)); assert.ok(all.indexOf('1d12+4 = 2 + 4 = 6') >= 0);
  const plain = '[DICE:Stealth check|d20 = 7|success]';
  assert.equal(diceRevealCardHtml(plain, 'd20'), diceTxt(plain), 'a roll with no damage has nothing to come');
  assert.ok(diceRevealCardHtml('[DICE:<img src=x>|d20 = 7|success]', 'cast').indexOf('<img') < 0, 'the label is model text and is escaped');
  assert.equal(diceRevealCardHtml('not a tag', 'cast'), diceTxt('not a tag'));
});

test('one reveal at a time: a stale one is refused, the reply waits, and "all" lets it through', async () => {
  diceRevealFinish();
  assert.equal(diceRevealStage(), 'all'); assert.equal(await settled(diceRevealWait()), true, 'nothing in force: nothing waits');
  const a = diceRevealBegin({}, true); assert.equal(diceRevealStage(), 'cast');
  const w = diceRevealWait(); assert.equal(await settled(w), false, 'the reply is held');
  assert.equal(diceRevealAdvance(a, 'd20'), true); assert.equal(diceRevealStage(), 'd20'); assert.equal(await settled(w), false, 'the d20 landing is not the end');
  const b = diceRevealBegin({}, true); assert.equal(await settled(w), true, 'a new roll finishes the old one: its reply is let through');
  assert.equal(diceRevealAdvance(a, 'all'), false, 'the stale reveal moves nothing'); assert.equal(diceRevealStage(), 'cast');
  const w2 = diceRevealWait(); diceRevealAdvance(b, 'all'); assert.equal(await settled(w2), true); assert.equal(diceRevealStage(), 'all');
  const none = diceRevealBegin({}, false); assert.equal(none.stage, 'all'); assert.equal(diceRevealStage(), 'all'); assert.equal(await settled(diceRevealWait()), true, 'a page with no dice holds nothing');
});

test('a hit: the turn is sent at the click, the d20 lands, leaves by itself, the damage dice land, and only then is all shown', async () => {
  arm('[CHECK:Greataxe attack|+6|DC 13|1d12+4]');
  const _r = Math.random; Math.random = () => 0.99; try { rollPendingCheck(); } finally { Math.random = _r; }
  assert.equal(sent.length, 1, 'the turn is sent at the click'); assert.equal(diceRevealStage(), 'cast');
  const w = diceRevealWait();
  assert.equal(d20.length, 1); assert.equal(dmg.length, 0, 'no damage dice before the d20 has landed');
  assert.equal(d20[0].opts.autoClose, DICE_DAMAGE_AFTER_MS, 'the d20 leaves by itself');
  d20[0].opts.onSettle(); assert.equal(diceRevealStage(), 'd20'); assert.equal(await settled(w), false);
  d20[0].opts.onClose(); assert.equal(dmg.length, 1, 'the damage dice come in as the d20 goes'); assert.equal(dmg[0].sides, 12);
  dmg[0].opts.onSettle(); assert.equal(diceRevealStage(), 'all'); assert.equal(await settled(w), true, 'the reply is let through when the last die rests');
});

test('a miss and a plain check end when the d20 lands; a damage-only roll ends when its dice land', async () => {
  arm('[CHECK:Stealth check|+1|DC 12]'); rollPendingCheck();
  assert.equal(diceRevealStage(), 'cast'); assert.equal(d20[0].opts.autoClose, undefined, 'nothing follows: the d20 stays until dismissed');
  d20[0].opts.onSettle(); assert.equal(diceRevealStage(), 'all'); assert.equal(dmg.length, 0);
  arm('[CHECK:Greataxe attack|+6|DC 30|1d12+4]'); rollPendingCheck();
  d20[0].opts.onSettle(); assert.equal(diceRevealStage(), 'all', 'a miss has no damage to wait for'); assert.equal(dmg.length, 0);
  arm('[CHECK:Draconic Breath|2d6]'); rollPendingCheck();
  assert.equal(d20.length, 0); assert.equal(dmg.length, 1); assert.equal(diceRevealStage(), 'cast');
  dmg[0].opts.onSettle(); assert.equal(diceRevealStage(), 'all');
});

test('nothing is ever held for good: no dice, dice that refuse, a d20 dismissed early, and dice that never rest', async () => {
  arm('[CHECK:Greataxe attack|+6|DC 13|1d12+4]'); live = false; rollPendingCheck();
  assert.equal(diceRevealStage(), 'all', 'a page with no dice shows everything at once'); assert.equal(d20.length + dmg.length, 0); assert.equal(sent.length, 1);
  arm('[CHECK:Stealth check|+1|DC 12]'); global.showDiceRoll = function () { return false; }; rollPendingCheck();
  assert.equal(diceRevealStage(), 'all', 'dice that refuse to roll hold nothing');
  arm('[CHECK:Greataxe attack|+6|DC 13|1d12+4]'); const _r = Math.random; Math.random = () => 0.99; try { rollPendingCheck(); } finally { Math.random = _r; }
  d20[0].opts.onClose(); assert.equal(dmg.length, 1, 'a d20 dismissed before it lands still brings the damage dice');
  global.showDamageRoll = function () { return false; }; arm('[CHECK:Draconic Breath|2d6]'); global.showDamageRoll = function () { return false; }; rollPendingCheck();
  assert.equal(diceRevealStage(), 'all', 'damage dice that refuse hold nothing');
  const was = DICE_REVEAL_MAX_MS; DICE_REVEAL_MAX_MS = 15; const warn = console.warn; let said = ''; console.warn = m => { said += m; };
  try { arm('[CHECK:Stealth check|+1|DC 12]'); rollPendingCheck(); assert.equal(diceRevealStage(), 'cast'); await new Promise(r => setTimeout(r, 40)); }
  finally { DICE_REVEAL_MAX_MS = was; console.warn = warn; }
  assert.equal(diceRevealStage(), 'all', 'dice that never rest are given up on'); assert.ok(/did not come to rest/.test(said), 'and it is said: ' + said);
});

test('the wiring: the reply to a roll waits on the reveal before it is committed, and the dice report when they rest', () => {
  const g = src('game.js'), wait = g.indexOf('if(opts&&opts.silent&&opts.rollTag&&typeof diceRevealWait==="function")await diceRevealWait();'), commit = g.indexOf('commitGmTurn(resp,{mapExtraction:_mapDiscoveries,');
  assert.ok(wait >= 0 && commit > wait && commit - wait < 400, 'the wait sits directly before the commit of a roll\'s reply');
  assert.ok(g.indexOf('sendAction(r.note,{silent:true,rollTag:r.diceTag});\n  if(!live)return;') >= 0, 'the turn is sent before anything waits on dice');
  const u = src('ui-dice.js');
  assert.ok(u.indexOf('if(r&&token===_diceLive.token){if(opts&&typeof opts.onSettle==="function")opts.onSettle();if(opts&&opts.autoClose>0)setTimeout(function(){diceLiveClose(token,opts);},opts.autoClose);}') >= 0, 'settle and the unprompted leave, only for the roll still on the layer');
  assert.ok(u.indexOf('diceLiveFail("the roll did not play ("+(e&&e.message||e)+")",{roll:label});if(opts&&typeof opts.onSettle==="function")opts.onSettle();') >= 0, 'a roll that failed to play settles');
  assert.ok(u.indexOf('diceLiveStartFailed(e,{roll:label},true);if(opts&&typeof opts.onSettle==="function")opts.onSettle();') >= 0, 'dice that never started settle');
  assert.ok(u.indexOf('function diceRevealLive(){return diceRollEnv()&&_diceLive.state!=="failed"&&!diceLivePageRefusal();}') >= 0);
});

(async () => {
  let count = 0, failed = 0;
  for (const c of cases) { try { await c.fn(); count++; console.log('PASS #759 ' + c.name); } catch (e) { failed++; console.error('FAIL #759 ' + c.name + ': ' + e.message); } }
  console.log('#759 dice reveal: ' + count + ' passed, ' + failed + ' failed');
  if (only && !count && !failed) { console.error('matched 0 tests'); process.exit(2); }
  process.exit(failed ? 1 : 0);
})();
