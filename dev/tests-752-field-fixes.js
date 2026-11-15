// dev/tests-752-field-fixes.js — two field findings from the owner's Kaelon fight (2026-11-14):
//   #752 a foe started under the PLURAL of its bestiary entry's name is that entry (the card's portrait);
//   #753 the engine's fallback suggestion knows a fight is open (never "Count your coin and think." beside two lancers).
//   node dev/tests-752-field-fixes.js [--only "<test name>"]
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const engine = require('./load-engine.js'); engine.loadEngine('game.js');
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
let count = 0, failed = 0;
global.syncUI = function () {}; global.saveAll = global.saveAll || function () {};
function test(name, fn) {
  if (only && name !== only) return;
  try { fn(); count++; console.log('PASS #752 ' + name); } catch (e) { failed++; console.error('FAIL #752 ' + name + ': ' + e.message); }
}
const PIC = 'data:image/jpeg;base64,/9j/LANCERLANCERLANCER';
function fresh() {
  engine.makeTestWorld(); worldState.combat = null; worldState.character.coin = 1900;
  worldState.bestiary = [{ name: 'Dragonfly-Winged Fen Lancer', portrait: PIC, desc: 'LANCER_DESC' }, { name: 'Marsh Hag', displayName: 'Old Woman' },
    { name: 'Wolf' }, { name: 'Harpy' }, { name: 'Marsh Witch' }, { name: 'Reed Spearman' }, { name: 'Glass' }];
}
const rec = n => { const r = bestiaryRecord(n); return r ? r.name : null; };

test('a foe named by the plural of an entry is that entry, and an exact name still wins', () => {
  fresh();
  assert.equal(rec('Dragonfly-Winged Fen Lancers'), 'Dragonfly-Winged Fen Lancer');
  assert.equal(rec('dragonfly-winged fen lancer'), 'Dragonfly-Winged Fen Lancer', 'the exact pass is untouched');
  assert.equal(rec('Wolves'), 'Wolf'); assert.equal(rec('Harpies'), 'Harpy'); assert.equal(rec('Marsh Witches'), 'Marsh Witch'); assert.equal(rec('Reed Spearmen'), 'Reed Spearman');
  assert.equal(rec('Old Womans'), 'Marsh Hag', 'the plural of a public name finds its entry');
  assert.equal(rec('Lancers'), null, 'a part of a name is not the name');
  assert.equal(rec('Glas'), null, 'the singular of nothing'); assert.equal(rec('Glass'), 'Glass');
  assert.deepEqual(bestiarySingulars('glass'), [], '"ss" is not a plural');
  worldState.bestiary.push({ name: 'Wolves' }); assert.equal(rec('Wolves'), 'Wolves', 'an entry that IS the plural is itself');
});

test('two entries one plural could stand for is none, said on the console', () => {
  fresh(); worldState.bestiary.push({ name: 'Fen Guard' }, { name: 'Bog Sentry', displayName: 'Fen Guard' });
  const was = console.warn; let said = ''; console.warn = m => { said += m; };
  try { assert.equal(rec('Fen Guards'), null); } finally { console.warn = was; }
  assert.ok(/ambiguous plural name: Fen Guards/.test(said), said);
});

test('the enemy card of a group shows its entry\'s portrait', () => {
  fresh(); (0, eval)(fs.readFileSync(path.join(__dirname, '../ui-mobile.js'), 'utf8'));
  let html = ''; global.modalShell = function (id, body) { html = body; };
  showEnemyDetails({ name: 'Dragonfly-Winged Fen Lancers', hp: 22, maxHp: 22, ac: 13, atk: 4, dmg: '1d8+2', morale: 'normal', count: 2 });
  assert.ok(html.indexOf(PIC) >= 0, 'the portrait is on the card');
});

test('in a fight the fallback suggestion is the fight\'s own, never a quiet-scene line', () => {
  fresh();
  worldState.combat = { round: 1, foes: [{ name: 'Dragonfly-Winged Fen Lancers', hp: 22, maxHp: 22 }, { name: 'Fallen One', hp: 0, maxHp: 5, down: true }] };
  const man = buildSceneManifest(), a = suggestionFallback(man, []);
  assert.equal(a, 'Press the attack on Dragonfly-Winged Fen Lancers.');
  const b = suggestionFallback(man, [a]), c = suggestionFallback(man, [a, b]), d = suggestionFallback(man, [a, b, c]);
  assert.deepEqual([b, c, d], ['Fall back and guard yourself.', 'Watch for an opening.', 'Take a moment to consider your next move.']);
  const out = applySuggestionGate(['', '', '']);
  assert.ok(!out.some(t => /coin|Rest and take stock|Study your surroundings|Fallen One/.test(t)), out.join(' | '));
  worldState.combat.foes[0].form = 'alternate'; worldState.bestiary.push({ name: 'Dragonfly-Winged Fen Lancers', displayName: 'Reed Riders', altDesc: 'x' });
  assert.equal(suggestionFallback(buildSceneManifest(), []), 'Press the attack on Reed Riders.', 'a disguised foe is named as the player is shown it');
});

test('outside a fight, and once every foe is down, the quiet list still serves', () => {
  fresh();
  assert.equal(suggestionFallback(buildSceneManifest(), []), 'Count your coin and think.');
  worldState.combat = { round: 3, foes: [{ name: 'Fallen One', hp: 0, maxHp: 5, down: true }] };
  assert.deepEqual(suggestionCombatCands(), []);
  assert.equal(suggestionFallback(buildSceneManifest(), []), 'Count your coin and think.');
});

console.log('#752/#753 field fixes: ' + count + ' passed, ' + failed + ' failed');
if (only && !count && !failed) { console.error('matched 0 tests'); process.exit(2); }
process.exitCode = failed ? 1 : 0;
