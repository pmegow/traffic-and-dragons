// dev/tests-760-creature-names.js — two owner asks of 2026-11-15:
//   #760 the GM is told to start a listed creature under its bestiary name (the name is the engine's lookup);
//   #761 the wizard has an Import character button left of File, the same door as the menu row.
//   node dev/tests-760-creature-names.js [--only "<test name>"]
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const engine = require('./load-engine.js'); engine.loadEngine('game.js');
const only = process.argv.indexOf('--only') >= 0 ? process.argv[process.argv.indexOf('--only') + 1] : null;
let count = 0, failed = 0;
function test(name, fn) {
  if (only && name !== only) return;
  try { fn(); count++; console.log('PASS #760 ' + name); } catch (e) { failed++; console.error('FAIL #760 ' + name + ': ' + e.message); }
}
const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const times = (s, a) => s.split(a).length - 1;
function gated(act) {
  engine.makeTestWorld(); worldState.turn = 0;
  applyBlueprint(normalizeBlueprint({ format: 'tnd-blueprint-v1', name: 'Veiled court', premise: 'A border clash.', acts: [
    { title: 'Border', goal: 'Help', arcs: [{ title: 'Clash', objective: 'Survive' }] },
    { title: 'Truth', goal: 'Investigate', arcs: [{ title: 'Trail', objective: 'Follow' }] }],
    creatures: [{ name: 'Fen Otter-Rider', kind: 'marsh fae', desc: 'A rider in reed silk.', revealAct: act }] }));
}

test('a campaign with a bestiary tells the GM to start a listed creature under its own name', () => {
  engine.makeTestWorld(); worldState.bestiary = [{ name: 'Wolf', kind: 'beast' }, { name: 'Fen Otter-Rider', kind: 'marsh fae' }];
  const p = buildSysPrompt(), s = p.stable, a = s.indexOf('BESTIARY'), rule = s.indexOf(BESTIARY_NAME_RULE), first = s.indexOf('\n• Wolf');
  assert.ok(a >= 0 && rule > a && first > rule, 'the rule sits in the bestiary header, before the first entry');
  assert.equal(times(s, BESTIARY_NAME_RULE), 1, 'said once');
  assert.equal(times(p.volatile || '', BESTIARY_NAME_RULE), 0, 'authored canon: the stable half only');
  for (const w of ['EXACTLY as written', 'singular', '[COMBAT_START:]', '[COMBAT_GROUP:N]', 'one tag per kind', 'invented collective', 'record and portrait'])
    assert.ok(BESTIARY_NAME_RULE.indexOf(w) >= 0, 'the rule says: ' + w);
  assert.ok(/:$/.test(BESTIARY_NAME_RULE), 'the header still ends in the colon that opens the list');
});

test('no bestiary, or none the story has opened, carries no naming rule', () => {
  engine.makeTestWorld(); worldState.bestiary = [];
  assert.equal(buildSysPrompt().stable.indexOf('Start a listed creature'), -1, 'an empty bestiary');
  delete worldState.bestiary;
  assert.equal(buildSysPrompt().stable.indexOf('Start a listed creature'), -1, 'no bestiary at all');
  gated(2);
  assert.equal(buildSysPrompt().stable.indexOf('Start a listed creature'), -1, 'every creature still withheld: no header, no rule');
  gated(1);
  assert.equal(times(buildSysPrompt().stable, BESTIARY_NAME_RULE), 1, 'the act that opens the creature opens the rule');
});

test('the wizard has an Import character button left of File, wired to the character browser', () => {
  const html = read('index.html'), boot = read('ui-boot.js');
  const scr = html.indexOf('<div id="char-screen">'), b = html.indexOf('id="cs-import-char-top"'), f = html.indexOf('id="cs-file-btn"');
  assert.equal(times(html, 'id="cs-import-char-top"'), 1, 'one button');
  assert.ok(scr >= 0 && b > scr && f > b, 'inside the wizard, before the File button (left of it in the row)');
  assert.ok(html.slice(b, f).indexOf('</div>') < 0, 'in the File button\'s own row');
  assert.ok(/<button class="ib" id="cs-import-char-top"[^>]*>Import character<\/button>/.test(html), 'a real button, labelled');
  assert.ok(boot.indexOf('document.getElementById("cs-import-char-top");if(_ict)_ict.addEventListener("click",showCharacterBrowser);') >= 0, 'the click opens the character browser');
  assert.ok(boot.indexOf('document.getElementById(m.imp+"import-char-btn");if(ic)ic.addEventListener("click",showCharacterBrowser);') >= 0, 'the menu row opens the same function');
});

console.log(count + ' passed, ' + failed + ' failed' + (only && !count && !failed ? ' — matched 0 tests' : ''));
process.exit(failed || (only && !count) ? 1 : 0);
