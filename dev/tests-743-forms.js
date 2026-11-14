// dev/tests-743-forms.js — #743: two forms (a true form and an alternate) for creatures and NPCs. Design record:
// DOC/DESIGN_743_forms.md (rulings R1–R13). Runs the real helpers, the real enemy card and the real blueprint doors.
//   node dev/tests-743-forms.js [--only "<test name>"]
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const engine = require('./load-engine.js'); engine.loadEngine('game.js');
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
let count = 0, failed = 0;
function test(name, fn) {
  if (only && name !== only) return;
  try { fn(); count++; console.log('PASS #743 ' + name); } catch (e) { failed++; console.error('FAIL #743 ' + name + ': ' + e.message); }
}
const TRUE_PIC = 'data:image/jpeg;base64,/9j/TRUETRUETRUETRUE', ALT_PIC = 'data:image/jpeg;base64,/9j/ALTALTALTALTALT';
function hag(extra) { return Object.assign({ name: 'Marsh Hag', kind: 'fey crone', threat: 'deadly', notes: 'GM_NOTES', desc: 'TRUE_DESC', displayName: 'Woman', altDesc: 'ALT_DESC', altWhen: 'ALT_WHEN', portrait: TRUE_PIC, altPortrait: ALT_PIC }, extra || {}); }
function blueprint(creature, npc) {
  return normalizeBlueprint({ format: 'tnd-blueprint-v1', name: 'Fen', premise: 'A marsh patrol.', acts: [],
    npcs: [Object.assign({ name: 'Mara', notes: 'A guide.' }, npc || {})], creatures: [creature || hag()] }, { preserveProse: true });
}
function card(foe) {
  let html = ''; global.modalShell = function (id, body) { html = body; };
  showEnemyDetails(foe); return html;
}
function fresh(bp) { engine.makeTestWorld(); (0, eval)(fs.readFileSync(path.join(__dirname, '../ui-mobile.js'), 'utf8')); if (bp) applyBlueprint(bp); }

test('the starting form is the author\'s choice, and a public name alone still starts alternate', () => {
  assert.equal(formStart({ name: 'Wolf' }), 'true');
  assert.equal(formStart({ name: 'Raider', displayName: 'Reed Rider' }), 'alternate', 'today\'s disguise behaviour is kept');
  assert.equal(formStart({ name: 'Raider', displayName: '  ' }), 'true');
  ['true', 'alternate', 'story'].forEach(s => assert.equal(formStart({ name: 'X', displayName: 'Y', startsAs: s }), s));
  assert.equal(formStart({ name: 'X', startsAs: 'sideways' }), 'true', 'an unknown choice is not a form');
  assert.equal(formStart(null), 'true');
});

test('the individual\'s own form wins, and as-serves-the-story is undeclared until stated', () => {
  const rec = hag({ startsAs: 'story' });
  assert.equal(formOf({ name: 'Marsh Hag' }, rec), '');
  assert.equal(formOf({ name: 'Marsh Hag', form: 'alternate' }, rec), 'alternate');
  assert.equal(formOf({ name: 'Marsh Hag', form: 'true' }, hag({ startsAs: 'alternate' })), 'true');
  assert.equal(formOf({ name: 'Marsh Hag', form: 'sideways' }, hag({ startsAs: 'alternate' })), 'alternate', 'a stored value that is not a form is ignored');
  assert.equal(formOf(null, hag({ startsAs: 'true' })), 'true');
});

test('each form shows its own portrait and description', () => {
  const t = formView(hag(), 'true'), a = formView(hag(), 'alternate');
  assert.deepEqual([t.portrait, t.desc, t.standIn, t.undeclared], [TRUE_PIC, 'TRUE_DESC', false, false]);
  assert.deepEqual([a.portrait, a.desc, a.standIn, a.undeclared], [ALT_PIC, 'ALT_DESC', false, false]);
});

test('a called-for alternate with no image is the true image marked as a stand-in', () => {
  const rec = hag(); delete rec.altPortrait;
  const a = formView(rec, 'alternate');
  assert.deepEqual([a.portrait, a.standIn], [TRUE_PIC, true]);
  assert.equal(rec.portrait, TRUE_PIC, 'the first slot is never altered');
  assert.equal(formView({ name: 'Bare' }, 'alternate').standIn, false, 'no image at all is no stand-in');
});

test('the true description never stands in for a missing alternate description', () => {
  const rec = { name: 'Old King', desc: 'TRUE_DESC', portrait: TRUE_PIC };
  assert.equal(formView(rec, 'alternate').desc, '');
  assert.equal(formView(rec, 'true').desc, 'TRUE_DESC');
});

test('a legacy disguised creature\'s one description is read as the alternate\'s', () => {
  const legacy = { name: 'Raider', displayName: 'Reed Rider', desc: 'MASK_DESC', portrait: TRUE_PIC };
  assert.equal(formView(legacy, 'alternate').desc, 'MASK_DESC');
  assert.equal(formView(legacy, 'true').desc, '', 'the mask\'s look is not the true form\'s');
  assert.equal(formView(Object.assign({ altDesc: 'ALT_DESC' }, legacy), 'true').desc, 'MASK_DESC', 'once an alternate description exists, desc is the true form\'s');
});

test('an undeclared form shows nothing', () => {
  const v = formView(hag(), '');
  assert.deepEqual([v.portrait, v.desc, v.standIn, v.undeclared], ['', '', false, true]);
});

test('the on-screen label follows the form', () => {
  fresh(blueprint(hag({ startsAs: 'true' })));
  assert.equal(foeLabel({ name: 'Marsh Hag', count: 2 }), 'Marsh Hag (2)', 'true form: the canonical name');
  assert.equal(foeLabel({ name: 'Marsh Hag', form: 'alternate' }), 'Woman', 'alternate form: the public name');
  assert.equal(foeLabel({ name: 'Woman', form: 'true' }), 'Marsh Hag', 'a row started under the public name, now in its true form');
  assert.equal(foeLabel({ name: 'Marsh Hag', form: 'alternate' }, true), 'Marsh Hag', 'the canonical label is the row\'s own tag identity');
  worldState.bestiary[0].startsAs = 'story';
  assert.equal(foeLabel({ name: 'Marsh Hag' }), 'Woman', 'undeclared: the public name, never the true one');
  worldState.bestiary = [{ name: 'Raider', displayName: 'Reed Rider', notes: 'n' }];
  assert.equal(foeLabel({ name: 'Raider' }), 'Reed Rider', 'a legacy disguise keeps its public label');
  assert.equal(foeLabel({ name: 'Stranger' }), 'Stranger', 'a foe with no entry is its own name');
});

test('the card shows the alternate form: its image, its description, the public name, no private classification', () => {
  fresh(blueprint(hag({ startsAs: 'alternate' })));
  const html = card({ name: 'Marsh Hag', hp: 9, maxHp: 12 });
  assert.ok(html.indexOf("<img src='" + ALT_PIC + "' alt='Woman'></div>") >= 0, 'the alternate image, unmarked');
  assert.ok(html.indexOf('ALT_DESC') >= 0);
  ['TRUE_DESC', TRUE_PIC, 'fey crone', 'deadly', 'Marsh Hag', 'GM_NOTES', 'ALT_WHEN', 'ALTERNATE'].forEach(s => assert.equal(html.indexOf(s), -1, s + ' stays off an alternate card'));
});

test('the card shows the true form: its image, its description, the canonical name and classification', () => {
  fresh(blueprint(hag({ startsAs: 'alternate' })));
  const html = card({ name: 'Marsh Hag', hp: 9, maxHp: 12, form: 'true' });
  assert.ok(html.indexOf("<img src='" + TRUE_PIC + "' alt='Marsh Hag'></div>") >= 0);
  ['TRUE_DESC', 'fey crone', 'deadly'].forEach(s => assert.ok(html.indexOf(s) >= 0, s + ' shows on a true card'));
  ['ALT_DESC', ALT_PIC, 'GM_NOTES', 'ALT_WHEN', 'ALTERNATE'].forEach(s => assert.equal(html.indexOf(s), -1, s + ' stays off a true card'));
});

test('an as-serves-the-story individual shows no portrait and no description until its form is stated', () => {
  fresh(blueprint(hag({ startsAs: 'story' })));
  const warned = []; const warn = console.warn; console.warn = function (m) { warned.push(String(m)); };
  let html; try { html = card({ name: 'Marsh Hag', hp: 9, maxHp: 12 }); } finally { console.warn = warn; }
  assert.equal(html.indexOf('<img'), -1, 'no portrait');
  ['TRUE_DESC', 'ALT_DESC', 'fey crone', 'deadly', 'Marsh Hag', 'Description'].forEach(s => assert.equal(html.indexOf(s), -1, s + ' stays off an undeclared card'));
  assert.ok(html.indexOf('Woman') >= 0, 'the public name labels it');
  assert.ok(warned.some(m => /\[forms\]/.test(m) && /Marsh Hag/.test(m)), 'the engine says so on the console');
  assert.ok(card({ name: 'Marsh Hag', hp: 9, maxHp: 12, form: 'alternate' }).indexOf(ALT_PIC) >= 0, 'stated: the card shows that form');
});

test('a blueprint that states an unknown starting form or non-text alternate fields is refused', () => {
  ['creatures', 'npcs'].forEach(section => {
    const mk = extra => { const bp = blueprint(); Object.assign(bp[section][0], extra); return validateBlueprint(bp); };
    assert.match(String(mk({ startsAs: 'sideways' })), /startsAs/, section + ' startsAs');
    ['altDesc', 'altWhen', 'altPortrait'].forEach(k => assert.match(String(mk({ [k]: 7 })), new RegExp(k), section + ' ' + k));
    ['true', 'alternate', 'story'].forEach(s => assert.ok(!mk({ startsAs: s }), section + ' accepts ' + s));
  });
});

test('the alternate prose is capped like the other authored fields', () => {
  const bp = blueprint(hag(), { altDesc: 'NPC_ALT', altWhen: 'NPC_WHEN' });
  const paths = blueprintTextFields(bp).map(f => f.path);
  ['creatures.0.altDesc', 'creatures.0.altWhen', 'npcs.0.altDesc', 'npcs.0.altWhen'].forEach(p => assert.ok(paths.indexOf(p) >= 0, p));
  const plain = blueprint({ name: 'Wolf', notes: 'n' });
  assert.equal(blueprintTextFields(plain).filter(f => /alt/.test(f.path)).length, 0, 'an entry without the fields gains none');
});

test('a blueprint NPC carries its alternate form onto the roster through the image gate', () => {
  fresh(blueprint(hag(), { desc: 'NPC_TRUE', altDesc: 'NPC_ALT', altWhen: 'NPC_WHEN', startsAs: 'alternate', portrait: TRUE_PIC, altPortrait: ALT_PIC }));
  const n = wsNpcByName('Mara');
  assert.deepEqual([n.altPortrait, n.altDesc, n.desc, n.startsAs], [ALT_PIC, 'NPC_ALT', 'NPC_TRUE', 'alternate']);
  const v = npcFormView(n);
  assert.deepEqual([v.form, v.portrait, v.desc, v.standIn], ['alternate', ALT_PIC, 'NPC_ALT', false]);
  npcFormSeed(n, { altDesc: 'OTHER', altWhen: 'LATE' });
  assert.deepEqual([n.altDesc, n.altWhen], ['NPC_ALT', 'NPC_WHEN'], 'a field the row already holds is never overwritten');
  n.form = 'true';
  assert.deepEqual([npcFormView(n).portrait, npcFormView(n).desc], [TRUE_PIC, 'NPC_TRUE']);
  fresh(blueprint(hag(), { altPortrait: 'javascript:alert(1)', startsAs: 'alternate', portrait: TRUE_PIC }));
  const m = wsNpcByName('Mara');
  assert.equal(m.altPortrait, undefined, 'a source that is not an image is dropped');
  assert.deepEqual([npcFormView(m).portrait, npcFormView(m).standIn], [TRUE_PIC, true]);
});

test('an NPC without alternate fields is unchanged', () => {
  fresh(blueprint(hag(), { portrait: TRUE_PIC }));
  const n = wsNpcByName('Mara');
  ['altPortrait', 'altDesc', 'desc', 'startsAs', 'form'].forEach(k => assert.equal(n[k], undefined, k));
  const v = npcFormView(n);
  assert.deepEqual([v.form, v.portrait, v.desc, v.standIn, v.undeclared], ['true', TRUE_PIC, '', false, false]);
});

test('a campaign exported back to a blueprint keeps both forms', () => {
  fresh(blueprint(hag({ startsAs: 'story' }), { desc: 'NPC_TRUE', altDesc: 'NPC_ALT', startsAs: 'alternate', portrait: TRUE_PIC, altPortrait: ALT_PIC }));
  const out = buildBlueprintFromGame();
  const c = out.creatures[0], n = out.npcs.filter(x => x.name === 'Mara')[0];
  assert.deepEqual([c.altPortrait, c.altDesc, c.altWhen, c.startsAs], [ALT_PIC, 'ALT_DESC', 'ALT_WHEN', 'story']);
  assert.deepEqual([n.altPortrait, n.altDesc, n.desc, n.startsAs, n.portrait], [ALT_PIC, 'NPC_ALT', 'NPC_TRUE', 'alternate', TRUE_PIC]);
});

test('no portrait bytes reach the GM prompt', () => {
  fresh(blueprint(hag({ startsAs: 'story' }), { desc: 'NPC_TRUE', altDesc: 'NPC_ALT', altWhen: 'NPC_WHEN', startsAs: 'alternate', portrait: TRUE_PIC, altPortrait: ALT_PIC }));
  const prompt = buildSysPrompt();
  const text = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
  [TRUE_PIC, ALT_PIC, '/9j/'].forEach(s => assert.equal(text.indexOf(s), -1, s));
});

console.log('#743 forms: ' + count + ' passed, ' + failed + ' failed');
if (only && !count && !failed) { console.error('matched 0 tests'); process.exit(2); }
process.exitCode = failed ? 1 : 0;
