// Approved names must resolve without changing their definitions or orphaning saved sheets.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),receipt=JSON.parse(fs.readFileSync(path.join(root,'audits/capability_renames_applied.json'),'utf8'));
const {loadEngine,makeTestWorld}=require('./load-engine.js');loadEngine();
const publication=JSON.parse(fs.readFileSync(path.join(root,'audits/capability_descriptions_applied.json'),'utf8'));
const published=new Map(publication.rows.map(r=>[r.from,r]));
const retired=new Map(publication.retired.map(r=>[r.from,r]));
function currentName(r){return published.get(capBaseName(r.to)).name;}
const changed=receipt.names.filter(r=>capBaseName(r.from)!==capBaseName(r.to));
assert.equal(receipt.names.length,507);assert.equal(changed.length,53);
for(const r of receipt.names){const key=capBaseName(r.to),next=published.get(key)||retired.get(key);assert.ok(next,'historical definition missing: '+r.to);assert.equal(next.beforeSha256,r.definitionSha256,'historical definition changed: '+r.to);if(!published.has(key))continue;const entry=CAPABILITY_BIBLE[next.key];assert.ok(entry,'approved capability missing: '+r.to);assert.equal(crypto.createHash('sha256').update(JSON.stringify(entry)).digest('hex'),next.afterSha256,'definition changed: '+r.to);}
for(const r of changed){assert.ok(!CAPABILITY_BIBLE[r.from],'old capability key remains: '+r.from);assert.ok(CAPABILITY_RENAMES.some(n=>capBaseName(n.from)===r.from&&n.to===currentName(r)),'migration missing: '+r.from);}
const world=makeTestWorld();
function sheet(){return {name:'Rename fixture',spells:changed.map(r=>({nm:r.from+' (1/day)',used:true,lvl:2})),abilities:changed.map(r=>({nm:r.from,ds:'unchanged'}))};}
world.character=Object.assign(world.character,sheet());world.npcs=[{name:'Companion',charSheet:sheet()}];
migrateWorldState();
for(const c of [world.character,world.npcs[0].charSheet]){changed.forEach((r,i)=>{assert.equal(c.spells[i].nm,currentName(r)+' (1/day)');assert.equal(c.spells[i].used,true);assert.equal(c.abilities[i].nm,currentName(r));assert.equal(c.abilities[i].ds,'unchanged');assert.ok(capabilityLookup(c.spells[i].nm));});assert.equal(migrateCapabilityRenames(c),false,'migration must be idempotent');}
const html=fs.readFileSync(path.join(root,'capability-names.html'),'utf8'),vm=require('vm'),box={CAPABILITY_BIBLE,CAPABILITY_RENAMES,capBaseName};vm.runInNewContext(html.match(/<script id="names-core">([\s\S]*?)<\/script>/)[1],box);
const old=JSON.stringify({format:'traffic-and-dragons/capability-names/v1',names:receipt.names.map(({from,to})=>({from,to}))});
const restored=box.CapabilityNames.read(old,CAPABILITY_BIBLE);assert.equal(restored.length,506);for(const r of restored)assert.equal(capBaseName(r.to),r.from,'approved old browser draft should rebase to current key');
assert.equal(box.CapabilityNames.forImplementation(fs.readFileSync(path.join(root,'capability-names.json'),'utf8'),CAPABILITY_BIBLE).length,506);
console.log('PASS #603 approved 53 renames: historical hashes chained to approved publication, migration/player/companion/idempotence, draft restoration');

const legacy=JSON.parse(old);legacy.names.find(r=>r.from==='wall of  thorns').to='Bramble Rampart';legacy.names.find(r=>r.from==='wall of thorns').to='Retired Choice';
assert.equal(box.CapabilityNames.read(JSON.stringify(legacy),CAPABILITY_BIBLE).find(r=>r.from==='wall of thorns').to,'Bramble Rampart','consolidation preserves surviving row choice');
legacy.names.push({...legacy.names[0]});assert.throws(()=>box.CapabilityNames.read(JSON.stringify(legacy),CAPABILITY_BIBLE),/unknown, repeated, or malformed original name/,'consolidation must not hide duplicate originals');
const current=JSON.parse(fs.readFileSync(path.join(root,'capability-names.json'),'utf8'));current.names.push({from:'unknown ability',to:'Unknown Ability'});assert.throws(()=>box.CapabilityNames.read(JSON.stringify(current),CAPABILITY_BIBLE),/does not match/,'unknown extra rows remain invalid');
