// Owner-approved prose and metadata are a single publication snapshot.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const {loadEngine,makeTestWorld}=require('./load-engine.js');loadEngine();
assert.equal(CAPABILITY_BIBLE['summon item'].range,'30ft','description wins over stale Summon Item range');
assert.equal(CAPABILITY_BIBLE['catastrophic wound'].dice,'14d6 necrotic','description wins over stale damage dice');
assert.equal(CAPABILITY_BIBLE['dancing lights'].targets,'up to six lights or one glowing form');
assert.equal(CAPABILITY_BIBLE['wall of thorns'].dice,'2d6','retain the reviewed thorn wall instead of the removed duplicate');
assert.equal(CAPABILITY_BIBLE['wall of  thorns'],undefined,'duplicate spaced key removed');
assert.equal(Object.keys(CAPABILITY_BIBLE).length,506);
const receipt=JSON.parse(fs.readFileSync(path.join(root,'audits/capability_descriptions_applied.json'),'utf8'));
assert.equal(receipt.rows.length,506);
for(const r of receipt.rows){const entry=CAPABILITY_BIBLE[r.key];assert.ok(entry,'applied capability missing: '+r.key);assert.equal(entry.effect,r.description,'approved description not applied: '+r.key);assert.equal(crypto.createHash('sha256').update(JSON.stringify(entry)).digest('hex'),r.afterSha256,'published attributes drifted: '+r.key);}
const world=makeTestWorld();world.character.spells=[{nm:'Wall of  Thorns (1/day)',used:true}];world.character.abilities=[{nm:'The Turning TIde'}];world.npcs=[{name:'Companion',charSheet:{spells:[{nm:'Wall of  Thorns'}],abilities:[{nm:'the turning move'}]}}];migrateWorldState();
assert.equal(world.character.spells[0].nm,'Wall of Thorns (1/day)');assert.equal(world.character.spells[0].used,true);assert.equal(world.character.abilities[0].nm,'The Turning Tide');assert.equal(world.npcs[0].charSheet.spells[0].nm,'Wall of Thorns');assert.equal(world.npcs[0].charSheet.abilities[0].nm,'The Turning Tide');assert.equal(migrateCapabilityRenames(world.character),false);
assert.match(bibleCardHTML('Summon Item',capabilityLookup('Summon Item')),/30ft/,'player card sees reconciled range');
console.log('PASS #603 published descriptions, reconciled attributes, single thorn wall and save migrations');

world.turn=1;world.character.spells=[{nm:'Inflict Wounds'},{nm:'Wall of Thorns'}];world.character.abilities=[{nm:'Summon Item',ds:'old summary'}];
assert.match(buildSpellBibleBlock(),/until a successful attack or the resolution of combat/,'GM receives reviewed duration');
assert.match(buildSpellBibleBlock(),/STR to pass through or escape restraint/,'GM receives retained wall mechanics');
assert.match(buildAbilityBibleBlock(),/range: 30ft/,'GM receives corrected ability range');
for(const c of receipt.classChanges){const found=[];function visit(x){if(!x||typeof x!=='object')return;if(x.nm===c.name&&typeof x.ds==='string')found.push(x.ds);Object.values(x).forEach(visit);}visit(CLASS_BIBLE);assert.ok(found.includes(c.to),'class summary not applied: '+c.name);}
