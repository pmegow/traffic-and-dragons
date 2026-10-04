// #221: the worksheet must preserve a complete rename map, including unchanged names.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..'), box = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'capability_bible.js'), 'utf8'), box);
const html = fs.readFileSync(path.join(root, 'capability-names.html'), 'utf8');
const core = html.match(/<script id="names-core">([\s\S]*?)<\/script>/);
assert.ok(core, 'worksheet exposes its pure naming rules');
vm.runInNewContext(core[1], box);
const api = box.CapabilityNames, bible = box.CAPABILITY_BIBLE;
let failures = 0;
function check(name, fn) { try { fn(); console.log('PASS #221 ' + name); } catch (e) { failures++; console.error('FAIL #221 ' + name + ': ' + e.message); } }
function blankRows() { return api.rows(bible); }
function rows() { return blankRows().map(r => ({from:r.from,to:r.from})); }
check('copied original names use title case with small words and possessives intact', () => {
  for(const [from,to] of [["a call to arms","A Call to Arms"],["aspect of the reaper","Aspect of the Reaper"],["hunter's mark","Hunter's Mark"],["will-o'-wisp","Will-o'-Wisp"],["death ward","Death Ward"],["  fire bolt  ","Fire Bolt"]])assert.equal(api.titleName(from),to);
  assert.equal(api.titleName(''),'');
});
check('blank defaults require an explicit decision on every capability', () => {
  const list = blankRows();
  assert.equal(list.length, Object.keys(bible).length);
  assert.ok(list.some(r => bible[r.from].kind === 'ability'));
  assert.ok(list.some(r => bible[r.from].kind === 'spell'));
  assert.ok(list.every(r => r.to === ""));
  assert.equal(JSON.parse(api.pack(list)).readyToApply, false);
  assert.throws(() => api.forImplementation(api.pack(list), bible), /name/i);
  const explicit = rows();
  assert.deepEqual(JSON.parse(api.pack(explicit)).names, JSON.parse(JSON.stringify(explicit)));
});
check('blank and delimiter names block implementation but can be saved', () => {
  for (const value of ['', '  ', '(only a suffix)', 'new|name']) {
    const list = rows(); list[0].to = value;
    assert.ok(api.issues(list)[0], 'accepted ' + value);
    assert.equal(JSON.parse(api.pack(list)).readyToApply, false);
    assert.throws(() => api.forImplementation(api.pack(list), bible), /name/i);
  }
});
check('engine-normalized collisions mark both rows', () => {
  const list = rows(); list[0].to = list[1].from.toUpperCase() + ' (Tier 2)';
  const errors = api.issues(list);
  assert.match(errors[0], /same/i); assert.match(errors[1], /same/i);
  assert.throws(() => api.forImplementation(api.pack(list), bible), /name/i);
});
check('draft round trip preserves unfinished and literal text', () => {
  const list = rows(); list[0].to = ''; list[1].to = '<img src=x onerror=alert(1)>';
  assert.equal(JSON.stringify(api.read(api.pack(list), bible)), JSON.stringify(list));
});
check('changed export retains every unchanged row', () => {
  const list = rows(); list[0].to = 'Quiet Ember';
  const out = JSON.parse(api.pack(list));
  assert.equal(out.names.length, Object.keys(bible).length);
  assert.equal(out.names[0].to, 'Quiet Ember');
  assert.equal(out.readyToApply, true);
  assert.equal(api.forImplementation(JSON.stringify(out), bible).length, list.length);
  assert.ok(out.names.slice(1).every(r => r.from === r.to));
  assert.equal(JSON.stringify(api.read(JSON.stringify(out), bible)), JSON.stringify(list));
});
check('readiness cannot be forged on an unfinished export', () => {
  const data = JSON.parse(api.pack(blankRows())); data.readyToApply = true;
  assert.throws(() => api.forImplementation(JSON.stringify(data), bible), /complete/i);
});
check('bad imports and changed bible cannot discard choices', () => {
  const original = rows(), snapshot = JSON.stringify(original);
  const valid = JSON.parse(api.pack(original));
  const bad = ['{', JSON.stringify({names: original}), JSON.stringify({...valid, names: original.slice(1)}),
    JSON.stringify({...valid, names: original.concat(original[0])}),
    JSON.stringify({...valid, names: original.map((r,i) => i ? r : {from:'missing spell',to:'Choice'})}),
    JSON.stringify({...valid, names: original.map((r,i) => i ? r : {from:r.from,to:42})})];
  for (const text of bad) assert.throws(() => api.read(text, bible));
  const newer = Object.assign({}, bible, {'future spell':{kind:'spell'}});
  assert.throws(() => api.read(JSON.stringify(valid), newer), /bible|missing/i);
  assert.equal(JSON.stringify(original), snapshot);
});

check('usage includes class levels archetypes and racial lineages without prose guesses', () => {
  const fixture={'creeping vines':{kind:'spell',tier:2},'secret root':{kind:'ability',tier:1},'unused':{kind:'spell'}};
  const classes={Druid:{nm:'Druid',abilities:[{nm:'Creeping Vines'}],levels:{2:{features:[{nm:'Secret Root'}]}},spells:{2:['Creeping Vines']},archetypes:[{id:'wild',nm:'Wild',levels:{3:{features:[{nm:'Secret Root'}]}}}]},Ranger:{nm:'Ranger',spells:{2:['Creeping Vines']}}};
  const races=[{nm:'Elf',subraces:[{nm:'Forest Elf',racial_caps:[{cap:'Creeping Vines',use:'1/day'}]}]},{nm:'Half-Blood',subraces:[{nm:'Half-Elven',lineages:[{nm:'Forest Elf',racial_caps:['Creeping Vines']}]}]}];
  const result=api.usage(fixture,classes,races,{},{});
  assert.deepEqual(JSON.parse(JSON.stringify(result['creeping vines'].users)),['Druid','Forest Elf','Half-Elven (Forest Elf)','Ranger']);
  assert.equal(result['creeping vines'].racial,true);
  assert.ok(api.usageLabel(fixture['creeping vines'],result['creeping vines']).startsWith('Spell / Racial Ability — Tier 2 — [ '));
  assert.deepEqual(JSON.parse(JSON.stringify(result['secret root'].users)),['Druid','Druid (Wild)']);
  assert.match(api.usageLabel(fixture.unused,result.unused),/No listed class or race/);
});
check('usage resolves real class spell pools and nested racial grants', () => {
  ['data.js','class_bible.js'].forEach(f=>vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),box));
  const result=api.usage(bible,box.CLASS_BIBLE,box.ANCS,box.SPELLS,box.ARCH_SPELLS);
  assert.ok(result['faerie fire'].users.includes('Druid'));
  assert.ok(result['faerie fire'].users.includes('Drow'));
  assert.ok(result['faerie fire'].users.includes('Half-Elven (Drow)'));
  assert.ok(result['totem spirit'].users.includes('Primal (Totemborn)'));
  assert.ok(result['booming blade'].users.includes('Warrior (Eldritch Knight)'));
  assert.ok(result['action surge'].users.includes('Warrior'));
});
process.exitCode = failures ? 1 : 0;
