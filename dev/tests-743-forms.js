// dev/tests-743-forms.js — #743: two forms (a true form and an alternate) for creatures and NPCs. Design record:
// DOC/DESIGN_743_forms.md (rulings R1–R13). Runs the real helpers, the real enemy card and the real blueprint doors.
//   node dev/tests-743-forms.js [--only "<test name>"]
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const engine = require('./load-engine.js'); engine.loadEngine('game.js');
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
let count = 0, failed = 0;
global.syncUI = function () {}; global.saveAll = global.saveAll || function () {};
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

// ── step 2: the [FORM:] tag and what the GM is told ─────────────────────────────────────────────────────────────────────
function muts(text) { return applyMuts(text).muts; }
function start(tag) { return muts(tag); }
const NPC_ALT = { desc: 'NPC_TRUE', altDesc: 'NPC_ALT', altWhen: 'NPC_WHEN', portrait: TRUE_PIC, altPortrait: ALT_PIC };

test('[FORM:] switches a foe either way, and the label and the engine\'s own words follow', () => {
  fresh(blueprint(hag({ startsAs: 'story' })));
  start('[COMBAT_START:Marsh Hag|30|13|4|1d8|bold]');
  const foe = worldState.combat.foes[0];
  assert.equal(formOf(foe, bestiaryRecord(foe.name)), '', 'as serves the story: unstated at the start');
  let said = muts('Her skin runs like wax. [FORM:Marsh Hag|alternate]');
  assert.equal(foe.form, 'alternate'); assert.equal(foeLabel(foe), 'Woman');
  assert.ok(said.some(m => /^Form: Woman/.test(m) && /alternate/.test(m)), 'the switch is said: ' + JSON.stringify(said));
  assert.equal(JSON.stringify(said).indexOf('Marsh Hag'), -1, 'the true name stays out of the words while alternate');
  said = muts('[FORM:Marsh Hag|true]');
  assert.equal(foe.form, 'true'); assert.equal(foeLabel(foe), 'Marsh Hag'); assert.equal(foe.name, 'Marsh Hag', 'the tag identity never changes');
  assert.ok(said.some(m => /^Form: Marsh Hag/.test(m) && /true/.test(m)));
  assert.equal(muts('[FORM:Marsh Hag|true]').filter(m => /^Form:/.test(m)).length, 0, 'a form already held says nothing');
  said = muts('[ENEMY_SLAIN:Marsh Hag]');
  assert.ok(said.some(m => /Marsh Hag slain/.test(m)), 'slain in its true form: ' + JSON.stringify(said));
});

test('a foe started under the public name is in its alternate form, and a group splits into rows', () => {
  fresh(blueprint(hag({ startsAs: 'true' })));
  start('[COMBAT_START:Marsh Hag|60|13|4|1d8|bold][COMBAT_GROUP:2][COMBAT_START:Woman|30|13|4|1d8|bold]');
  const f = worldState.combat.foes;
  assert.deepEqual(f.map(x => foeLabel(x)), ['Marsh Hag (2)', 'Woman']);
  assert.deepEqual(f.map(x => x.form), [undefined, 'alternate']);
  applyMuts('[FORM:Woman|true]');
  assert.deepEqual([f[1].form, foeLabel(f[1]), f[1].name], ['true', 'Marsh Hag', 'Woman']);
  assert.equal(f[0].form, undefined, 'the other row is untouched');
});

test('[FORM:] is refused loudly: an unknown form, an unknown target, a look-alike, a target with no alternate', () => {
  const bp = blueprint(hag({ startsAs: 'true' }), NPC_ALT); bp.creatures.push({ name: 'Wolf', notes: 'n', portrait: TRUE_PIC }); bp.npcs.push({ name: 'Plain Pell', notes: 'A cook.' });
  fresh(bp);
  start('[COMBAT_START:Marsh Hag|30|13|4|1d8|bold][COMBAT_START:Wolf|9|12|3|1d6|wary]');
  const before = JSON.stringify([worldState.combat.foes, worldState.npcs]);
  ['[FORM:Marsh Hag|sideways]', '[FORM:Marsh Hag]', '[FORM:Nobody|alternate]', '[FORM:Marsh Hagg|alternate]', '[FORM:Hag|alternate]', '[FORM:Wolf|alternate]', '[FORM:Plain Pell|alternate]'].forEach(tag => {
    const said = muts(tag);
    assert.ok(said.some(m => /^\u26a0 FORM refused/.test(m)), tag + ' is refused loudly: ' + JSON.stringify(said));
    assert.equal(JSON.stringify([worldState.combat.foes, worldState.npcs]), before, tag + ' moves nothing');
  });
});

test('[FORM:] switches an NPC, by its own name only', () => {
  fresh(blueprint(hag(), NPC_ALT));
  const n = wsNpcByName('Mara');
  assert.equal(npcFormView(n).form, 'true');
  let said = muts('Mara pulls the grey hood low. [FORM:Mara|alternate]');
  assert.equal(n.form, 'alternate'); assert.deepEqual([npcFormView(n).portrait, npcFormView(n).desc], [ALT_PIC, 'NPC_ALT']);
  assert.ok(said.some(m => /^Form: Mara/.test(m)));
  applyMuts('[FORM:Mara|true]'); assert.equal(n.form, 'true');
  assert.ok(muts('[FORM:Marax|alternate]').some(m => /^\u26a0 FORM refused/.test(m)), 'a look-alike name is refused');
  assert.equal(n.form, 'true');
});

test('the tag never reaches the story, and the standing tag list is unchanged', () => {
  assert.equal(cleanTxt('She turns. [FORM:Marsh Hag|true] The room cools.'), 'She turns.  The room cools.');
  assert.ok(TAG_STRIP_NAMES.indexOf('FORM') >= 0, 'strip registry');
  assert.equal(buildStateTagsDoc().indexOf('[FORM:'), -1, 'taught where an alternate exists, never in the standing list');
  assert.ok(TAG_DOC_ENGINE_ONLY.indexOf('FORM') >= 0);
});

test('the GM is told a creature\'s forms, its cue and the tag — only where an alternate exists', () => {
  fresh(blueprint(hag({ startsAs: 'story' })));
  const st = buildSysPrompt().stable;
  ['ALT_DESC', 'ALT_WHEN', 'TRUE_DESC', '[FORM:Marsh Hag|true]', '[FORM:Marsh Hag|alternate]', 'as serves the story', 'Public name: Woman'].forEach(x => assert.ok(st.indexOf(x) >= 0, x + ' is told'));
  assert.equal(st.indexOf('Keep the public label throughout the encounter'), -1, 'the label is no longer pinned for the whole encounter');
  fresh(blueprint({ name: 'Wolf', kind: 'beast', threat: 'minor', notes: 'Hunts in packs.', desc: 'A grey wolf.' }));
  const plain = buildSysPrompt(); const both = plain.stable + plain.volatile;
  assert.equal(both.indexOf('[FORM:'), -1, 'a campaign without an alternate never hears of the tag');
  assert.equal(both.indexOf('FORMS'), -1);
});

test('the combat line states each foe\'s form and asks for an unstated one every turn', () => {
  fresh(blueprint(hag({ startsAs: 'story' })));
  start('[COMBAT_START:Marsh Hag|30|13|4|1d8|bold]');
  let v = buildSysPrompt().volatile;
  assert.ok(v.indexOf('Form: unstated \u2014 emit [FORM:Marsh Hag|true] or [FORM:Marsh Hag|alternate]') >= 0, 'the ask: ' + v.slice(v.indexOf('COMBAT ACTIVE'), v.indexOf('COMBAT ACTIVE') + 400));
  applyMuts('[FORM:Marsh Hag|alternate]'); v = buildSysPrompt().volatile;
  assert.ok(v.indexOf('Form: alternate') >= 0); assert.equal(v.indexOf('Form: unstated'), -1);
  fresh(blueprint({ name: 'Wolf', notes: 'n' })); start('[COMBAT_START:Wolf|9|12|3|1d6|wary]');
  assert.equal(buildSysPrompt().volatile.indexOf('Form:'), -1, 'a foe with no alternate has no form line');
});

test('the GM is told an NPC\'s forms in the volatile half', () => {
  fresh(blueprint(hag(), NPC_ALT));
  let p = buildSysPrompt();
  ['NPC_ALT', 'NPC_WHEN', '[FORM:Mara|alternate]', 'Mara \u2014 now in the true form'].forEach(x => assert.ok(p.volatile.indexOf(x) >= 0, x + ' is told'));
  assert.equal(p.stable.indexOf('NPC_WHEN'), -1, 'an NPC\'s form is live state, never in the stable half');
  applyMuts('[FORM:Mara|alternate]');
  assert.ok(buildSysPrompt().volatile.indexOf('Mara \u2014 now in the alternate form') >= 0);
  assert.equal(buildSysPrompt().stable, p.stable, 'a form change never touches the stable half');
});

test('a foe\'s form change never touches the stable half', () => {
  fresh(blueprint(hag({ startsAs: 'story' })));
  start('[COMBAT_START:Marsh Hag|30|13|4|1d8|bold]');
  const a = buildSysPrompt().stable; applyMuts('[FORM:Marsh Hag|alternate]'); const b = buildSysPrompt().stable; applyMuts('[FORM:Marsh Hag|true]');
  assert.equal(a, b); assert.equal(buildSysPrompt().stable, a);
});

test('the cue and the forms never reach Table Talk or a companion talk', () => {
  fresh(blueprint(hag({ startsAs: 'story' }), NPC_ALT));
  (0, eval)(fs.readFileSync(path.join(__dirname, '../companion-talk.js'), 'utf8'));
  start('[COMBAT_START:Marsh Hag|30|13|4|1d8|bold]');
  const tt = buildTableTalkPrompt('What is the marsh hag? What does Mara look like?');
  const ttText = typeof tt === 'string' ? tt : JSON.stringify(tt);
  const persona = talkPersona({ name: 'Mara' }, talkContext({ name: 'Mara', isHero: false, sheet: { name: 'Mara' } }));
  ['ALT_WHEN', 'NPC_WHEN', 'ALT_DESC', 'NPC_ALT', 'TRUE_DESC', '[FORM:'].forEach(x => { assert.equal(ttText.indexOf(x), -1, x + ' in Table Talk'); assert.equal(String(persona).indexOf(x), -1, x + ' in the talk persona'); });
});

console.log('#743 forms: ' + count + ' passed, ' + failed + ' failed');
if (only && !count && !failed) { console.error('matched 0 tests'); process.exit(2); }
process.exitCode = failed ? 1 : 0;
