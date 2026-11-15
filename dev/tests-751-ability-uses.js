// dev/tests-751-ability-uses.js — #751: limited ability uses. A use is recorded on the ability, brought back by the event
// its recharge names, shown beside the name (Passive / Ready / Not Ready) and said to the GM. Runs the real helpers, the
// real tag table, the real prompt builders and the real panel markup.
//   node dev/tests-751-ability-uses.js [--only "<test name>"]
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const engine = require('./load-engine.js'); engine.loadEngine('game.js');
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
let count = 0, failed = 0;
global.syncUI = function () {}; global.saveAll = global.saveAll || function () {};
function test(name, fn) {
  if (only && name !== only) return;
  try { fn(); count++; console.log('PASS #751 ' + name); } catch (e) { failed++; console.error('FAIL #751 ' + name + ': ' + e.message); }
}
const BREATH = 'Draconic Breath (1/day)';
function kit() {
  return [{ nm: 'One parent trait', ds: 'Lightning resistance.' }, { nm: 'Elemental Resistance', ds: 'Half damage.' }, { nm: BREATH, ds: 'A line of lightning.' },
    { nm: 'Rage', ds: '+2 STR.' }, { nm: 'Reckless Attack', ds: 'Advantage.' }, { nm: 'Taunt', ds: 'Draw a foe.' }, { nm: 'Rewrite the Odds', ds: 'Once.' }, { nm: 'Arrest', ds: 'Hold.' }];
}
function fresh() { engine.makeTestWorld(); worldState.character.abilities = kit(); worldState.turn = 20; delete worldState.pendingCheck; worldState.combat = null; return worldState.character; }
function ab(c, nm) { return abilityFind(c, nm); }
function companion() {
  const sheet = { name: 'Brakka', cls: 'Warrior', level: 2, hp: 10, maxHp: 10, stats: { STR: 14, DEX: 10, CON: 12, INT: 10, WIS: 10, CHA: 10 }, abilities: [{ nm: 'Rage', ds: '' }, { nm: 'Taunt', ds: '' }], spells: [], inventory: [] };
  worldState.npcs.push({ name: 'Brakka', status: 'steady', relation: 'ally', partyMember: true, charSheet: sheet });
  return sheet;
}
function ui() { (0, eval)(fs.readFileSync(path.join(__dirname, '../ui-panels.js'), 'utf8')); }

test('the recharge table reads the name\'s own limit first, then the bible cost, and knows nothing of an ability with neither', () => {
  const c = fresh();
  assert.equal(abilityRecharge(ab(c, 'Draconic Breath')).key, 'day', 'the "(1/day)" on the name outranks the bible\'s per-rest');
  assert.equal(abilityRecharge(ab(c, 'Elemental Resistance')).key, 'passive');
  assert.equal(abilityRecharge(ab(c, 'Rage')).key, 'rest');
  assert.equal(abilityRecharge(ab(c, 'Taunt')).key, 'fight');
  assert.equal(abilityRecharge(ab(c, 'Rewrite the Odds')).key, 'campaign');
  assert.equal(abilityRecharge(ab(c, 'Reckless Attack')).key, 'open', 'at-will is never spent');
  assert.equal(abilityRecharge(ab(c, 'Arrest')).key, 'open', 'a cost no row tracks (per-scene) is never spent');
  assert.equal(abilityRecharge(ab(c, 'One parent trait')), null, 'no limit on the name and no bible entry: nothing is known');
  assert.equal(abilityRecharge({ nm: 'Lay on Hands', ds: '' }).key, 'open', 'a pool is not a single use');
  assert.equal(abilityKey('[racial] Draconic Breath (1/day)'), 'draconic breath');
});

test('the status says Passive, Ready or Not Ready, and nothing for an ability whose cost is unknown', () => {
  const c = fresh();
  assert.equal(abilityStatus(ab(c, 'One parent trait')), null);
  assert.equal(abilityStatus(ab(c, 'Elemental Resistance')).label, 'Passive');
  assert.equal(abilityStatus(ab(c, 'Reckless Attack')).label, 'Ready');
  assert.equal(abilityStatus(ab(c, 'Draconic Breath')).label, 'Ready');
  assert.equal(abilityMarkUsed(c, 'draconic breath', 20).status, 'used', 'the name is matched without its dressing or its case');
  const st = abilityStatus(ab(c, 'Draconic Breath'));
  assert.equal(st.label, 'Not Ready'); assert.equal(st.key, 'spent'); assert.ok(/ready again at dawn/.test(st.tip), st.tip);
  assert.equal(ab(c, 'Draconic Breath').used, 20, 'the record is the turn it was spent');
  assert.equal(abilityMarkUsed(c, 'Draconic Breath', 21).status, 'already');
  assert.equal(abilityMarkUsed(c, 'Reckless Attack', 21).status, 'free'); assert.equal(ab(c, 'Reckless Attack').used, undefined, 'an at-will ability is never marked');
  assert.equal(abilityMarkUsed(c, 'Elemental Resistance', 21).status, 'free');
  assert.equal(abilityMarkUsed(c, 'Dragon Breath', 21).status, 'unknown', 'exact names only');
  abilityMarkUsed(c, 'Rewrite the Odds', 21); assert.ok(/does not come back/.test(abilityStatus(ab(c, 'Rewrite the Odds')).tip));
});

test('each event brings back only what its row names', () => {
  const c = fresh(); ['Draconic Breath', 'Rage', 'Taunt', 'Rewrite the Odds'].forEach(n => abilityMarkUsed(c, n, 20));
  worldState.combat = { round: 1, foes: [] };
  assert.deepEqual(abilitiesRestore(c, 'fight'), ['Taunt']);
  abilityMarkUsed(c, 'Taunt', 21);
  assert.deepEqual(abilitiesRestore(c, 'short'), ['Rage', 'Taunt'], 'a short rest: per-rest and per-fight, never per-day');
  assert.equal(abilitySpent(ab(c, 'Draconic Breath')), true);
  abilityMarkUsed(c, 'Rage', 22);
  assert.deepEqual(abilitiesRestore(c, 'long'), [BREATH, 'Rage'], 'a night\'s rest: per-day and per-rest');
  assert.equal(abilitySpent(ab(c, 'Rewrite the Odds')), true, 'once per campaign never returns');
  assert.deepEqual(abilitiesRestore(c, 'long'), [], 'nothing left to bring back');
});

test('a once-per-fight use reads spent only while a fight is open', () => {
  const c = fresh(); worldState.combat = { round: 1, foes: [] };
  abilityMarkUsed(c, 'Taunt', 20); assert.equal(abilityStatus(ab(c, 'Taunt')).label, 'Not Ready');
  worldState.combat = null; assert.equal(abilityStatus(ab(c, 'Taunt')).label, 'Ready', 'the fight is over: it is ready for the next');
  assert.equal(abilityMarkUsed(c, 'Taunt', 25).status, 'used', 'and it can be spent again');
});

test('the tags: [ABILITY_USED:] spends the hero\'s, the companion twin spends theirs, and every refusal is said', () => {
  const c = fresh(), b = companion();
  let r = applyMuts('Lightning. [ABILITY_USED:Draconic Breath]');
  assert.equal(abilitySpent(ab(c, 'Draconic Breath')), true);
  assert.ok(r.muts.join('|').indexOf('used: ' + BREATH + ' (ready again at dawn)') >= 0, r.muts.join('|'));
  r = applyMuts('Again. [ABILITY_USED:Draconic Breath]');
  assert.ok(/Draconic Breath \(1\/day\) was already spent until dawn/.test(r.muts.join('|')), 'a second use is said: ' + r.muts.join('|'));
  r = applyMuts('[ABILITY_USED:Dragon Roar]');
  assert.ok(/you have no ability named Dragon Roar/.test(r.muts.join('|')), r.muts.join('|'));
  r = applyMuts('[ABILITY_USED:Reckless Attack]');
  assert.equal(ab(c, 'Reckless Attack').used, undefined); assert.ok(!/Reckless/.test(r.muts.join('|')), 'an at-will use is accepted in silence');
  r = applyMuts('Brakka roars. [COMPANION_ABILITY_USED:Brakka|Rage]');
  assert.equal(abilitySpent(ab(b, 'Rage')), true); assert.equal(abilitySpent(ab(c, 'Rage')), false, 'the hero\'s own Rage is untouched');
  assert.ok(r.muts.join('|').indexOf('Brakka: used: Rage (ready again after a rest)') >= 0, r.muts.join('|'));
  r = applyMuts('[COMPANION_ABILITY_USED:Nobody|Rage]');
  assert.ok(/no party member with a sheet by that name/.test(r.muts.join('|')), r.muts.join('|'));
  assert.equal(cleanTxt('The air splits. [ABILITY_USED:Draconic Breath][COMPANION_ABILITY_USED:Brakka|Rage]').trim(), 'The air splits.', 'both tags are stripped from the prose');
});

test('rests and a new fight bring uses back through the real handlers, party-wide', () => {
  const c = fresh(), b = companion(); ['Draconic Breath', 'Rage', 'Taunt'].forEach(n => abilityMarkUsed(c, n, 20)); abilityMarkUsed(b, 'Rage', 20); abilityMarkUsed(b, 'Taunt', 20);
  let r = applyMuts('A blade is drawn. [COMBAT_START:Bandit|9|12|+3|1d6|steady]');
  assert.ok(r.muts.join('|').indexOf('Ready again: Taunt, Taunt (Brakka)') >= 0, r.muts.join('|'));
  abilityMarkUsed(c, 'Taunt', 21);
  r = applyMuts('Another joins. [COMBAT_START:Second Bandit|9|12|+3|1d6|steady]');
  assert.equal(abilitySpent(ab(c, 'Taunt')), true, 'a foe joining an open fight is not a new fight');
  worldState.combat = null;
  r = applyMuts('You catch your breath. [REST:short]');
  assert.ok(r.muts.join('|').indexOf('Ready again: Rage, Taunt, Rage (Brakka)') >= 0, r.muts.join('|'));
  assert.equal(abilitySpent(ab(c, 'Draconic Breath')), true, 'a short rest does not bring back a 1/day');
  restSpells(false);
  assert.equal(abilitySpent(ab(c, 'Draconic Breath')), false, 'a night\'s rest does');
});

test('a use that waits on the player\'s roll is spent at the die, never at the ask, and Hold back spends nothing', () => {
  const c = fresh(), was = playerRollsDice; let sent = 0;
  const _send = global.sendAction; global.sendAction = function () { sent++; };
  try {
    playerRollsDice = true;
    let r = applyMuts('You draw breath. [ABILITY_USED:Draconic Breath][CHECK:Draconic Breath|+3|DC 14]');
    assert.ok(worldState.pendingCheck, 'the check is armed');
    assert.equal(abilitySpent(ab(c, 'Draconic Breath')), false, 'the ask spends nothing');
    assert.ok(r.muts.join('|').indexOf(BREATH + ' — spent when you roll') >= 0, r.muts.join('|'));
    reconsiderPendingCheck();
    assert.equal(abilitySpent(ab(c, 'Draconic Breath')), false, 'Hold back spends nothing');
    applyMuts('You draw breath. [CHECK:Draconic Breath save|+3|DC 14]');
    rollPendingCheck();
    assert.equal(sent, 1); assert.equal(abilitySpent(ab(c, 'Draconic Breath')), true, 'the roll spends it');
    assert.equal(abilityNamedByCheck(c, 'Courage check'), null, '"Rage" is not in "Courage"');
    assert.equal(abilityNamedByCheck(c, 'Reckless Attack'), null, 'an ability that is never spent is not named');
    assert.equal(abilityNamedByCheck(c, 'Rage and Taunt together'), null, 'two that fit is none');
    worldState.turn = 30; applyMuts('[CHECK:Stealth check|+1|DC 12]'); worldState.turn = 31;
    applyMuts('[ABILITY_USED:Rage]'); assert.equal(abilitySpent(ab(c, 'Rage')), true, 'a check for something else defers nothing');
  } finally { playerRollsDice = was; global.sendAction = _send; delete worldState.pendingCheck; }
});

test('the GM is told: a spent ability is EXPENDED on the sheet line and its canon line, a limited one carries its tag, and nothing moves while nothing is limited', () => {
  const c = fresh(); c.abilities = [{ nm: 'Reckless Attack', ds: '' }, { nm: 'Elemental Resistance', ds: '' }];
  const plain = buildSysPrompt(); const all = plain.stable + plain.volatile;
  assert.ok(all.indexOf('ABILITY_USED') < 0 && all.indexOf('EXPENDED — already used') < 0, 'a sheet with no limited ability is told nothing of the tag');
  c.abilities = kit(); const b = companion();
  let p = buildSysPrompt(), v = p.volatile;
  assert.equal(p.stable, plain.stable, 'the stable half never moves');
  assert.ok(v.indexOf('LIMITED USE: emit [ABILITY_USED:Draconic Breath] in the response where it is used') >= 0, 'the canon line teaches the tag');
  assert.ok(v.indexOf('[ABILITY_USED:Reckless Attack]') < 0, 'an at-will ability is taught no tag');
  assert.ok(v.indexOf('Rage (limited: emit [COMPANION_ABILITY_USED:Brakka|Rage] when used)') >= 0, 'the companion\'s list teaches the twin');
  abilityMarkUsed(c, 'Draconic Breath', 20); abilityMarkUsed(b, 'Rage', 20);
  v = buildSysPrompt().volatile;
  assert.ok(v.indexOf(BREATH + ' [EXPENDED — already used; CANNOT be used again until dawn]') >= 0, 'the sheet line marks it');
  assert.ok(v.indexOf('[EXPENDED — already used; CANNOT be used again until dawn] - Draconic Breath — cost:') >= 0, 'the canon line marks it');
  assert.ok(v.indexOf('emit [ABILITY_USED:Draconic Breath]') < 0, 'a spent ability is not asked for its tag');
  assert.ok(v.indexOf('Rage [EXPENDED — already used; CANNOT be used again until a rest]') >= 0, 'the companion\'s spent ability is marked');
});

test('the panel and the sheet show the status beside the name, and a spent ability is not offered to the input', () => {
  const c = fresh(); ui();
  let h = abPanelHTML(c, false);
  assert.ok(/Elemental Resistance<span class="ab-st" data-st="passive"[^>]*> \(Passive\)<\/span>/.test(h), 'passive');
  assert.ok(/Draconic Breath \(1\/day\)<span class="ab-st" data-st="ready"[^>]*> \(Ready\)<\/span>/.test(h), 'ready');
  assert.ok(/>One parent trait<\/span>/.test(h), 'an ability of unknown cost has no status');
  assert.ok(/data-quick="Use Draconic Breath \(1\/day\)\."/.test(h), 'a ready ability clicks into the input');
  abilityMarkUsed(c, 'Draconic Breath', 20); h = abPanelHTML(c, false);
  assert.ok(/Draconic Breath \(1\/day\)<span class="ab-st" data-st="spent"[^>]*color:var\(--warn\)[^>]*> \(Not Ready\)<\/span>/.test(h), 'spent: ' + h.slice(h.indexOf('Draconic'), h.indexOf('Draconic') + 260));
  assert.ok(!/data-quick="Use Draconic Breath/.test(h), 'a spent ability is not offered');
  assert.ok(/title="Used — ready again at dawn"/.test(h), 'the tip says when it returns');
  assert.equal(abilityStatusHtml(null), '');
  assert.ok(abilityStatusHtml({ key: 'ready', label: '<b>', tip: '"x"' }).indexOf('<b>') < 0, 'the label is escaped');
  const sheet = fs.readFileSync(path.join(__dirname, '../ui-sheets.js'), 'utf8');
  assert.ok(sheet.indexOf("'<div class=\"cs-abil\">'+_abNm+(typeof abilityStatusHtml===\"function\"?abilityStatusHtml(abilityStatus(_abRec)):\"\")") >= 0, 'the sheet paints the same status');
});

test('a use survives a save and a load', () => {
  const c = fresh(); abilityMarkUsed(c, 'Draconic Breath', 20);
  assert.equal(abilityFind(portableSheet(c), 'Draconic Breath').used, undefined, 'a portable copy carries no use');
  assert.equal(abilityFind(c, 'Draconic Breath').used, 20, 'and the live sheet keeps it');
  const tt = fs.readFileSync(path.join(__dirname, '../table-talk.js'), 'utf8');
  assert.equal(tt.split('abilityPromptName(').length - 1, 2, 'Table Talk reads the hero\'s and the companions\' abilities with their state');
  const back = parseWorldState(serializeWorldState(worldState));
  assert.equal(abilityFind(back.character, 'Draconic Breath').used, 20);
});

console.log('#751 ability uses: ' + count + ' passed, ' + failed + ' failed');
if (only && !count && !failed) { console.error('matched 0 tests'); process.exit(2); }
process.exitCode = failed ? 1 : 0;
