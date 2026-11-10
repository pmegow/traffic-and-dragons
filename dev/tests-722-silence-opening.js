// The shipped blueprint, not a synthetic creature fixture: no network or model calls.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const engine=require('./load-engine.js');engine.loadEngine();
const authored=JSON.parse(fs.readFileSync(path.join(__dirname,'../samples/the_silence_between_leaves.blueprint'),'utf8'));
let failures=0,passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS #722 '+name);}catch(e){failures++;console.error('FAIL #722 '+name+': '+e.message);}}
function start(){
 engine.makeTestWorld({turn:0});global.saveRules=function(){};global.showToast=function(){};customRules=[];
 const bp=normalizeBlueprint(JSON.parse(JSON.stringify(authored)));
 assert.equal(validateBlueprint(bp),null);applyBlueprint(bp);startNodeStamp();return buildSysPrompt();
}
function openAct(n){worldState.skeleton.acts.forEach((a,i)=>{a.status=i<n-1?'completed':i===n-1?'active':'pending';});}
function all(p){return p.stable+'\n'+p.volatile;}
test('turn zero with all nineteen rules withholds the Raider',()=>{
 const p=start();assert.equal(customRules.length,19);for(const rule of customRules)assert(p.stable.includes(rule));
 assert(!all(p).includes('Borrowed-Banner Raider'),'Raider leaked into opening prompt');
 assert(!all(p).includes('Reed-cloaked Raider'),'disguised Raider substituted at opening');
 assert(p.stable.includes('Mire-Gilded Stalker'),'Act I causeway creature disappeared');
});
test('Act II admits the Raider and Act III admits the Sentry',()=>{
 const p=start();assert(!p.stable.includes('Iron-Ward Sentry'),'Act III guard leaked into opening');
 openAct(2);const second=buildSysPrompt();assert(second.stable.includes('Borrowed-Banner Raider'),'Raider missing in Act II');
 assert(second.stable.includes('Public name: Reed-cloaked Raider'));assert(!second.stable.includes('Iron-Ward Sentry'));
 assert(second.stable.includes('Appearance: '));assert(second.stable.includes('GM-only: '));
 openAct(3);const third=buildSysPrompt();assert(third.stable.includes('Iron-Ward Sentry'));assert(third.stable.includes('Borrowed-Banner Raider'),'completed Act II creature disappeared');
});
test('ordinary turns and act completion preserve stable bytes',()=>{
 start();openAct(2);const first=buildSysPrompt().stable;
 worldState.turn=400;worldState.transcript.push({r:'gm',x:'A guide names The Down Below.',t:400});assert.equal(buildSysPrompt().stable,first);
 worldState.skeleton.acts[1].status='completed';assert.equal(buildSysPrompt().stable,first);
});
test('opening has genuine combatants for either patrol',()=>{
 const p=start();for(const name of ['Glimmerveil Scout','Fen Otter-Rider']){
  const c=authored.creatures.find(c=>c.name===name);assert(c,'missing '+name);assert(c.desc&&c.notes);assert(p.stable.includes(name),'patrol missing from bestiary');
  assert(authored.acts[0].arcs[0].dnaHint.includes(name),'opening does not select '+name);
 }
 assert(authored.acts[0].arcs[0].dnaHint.includes('genuine court fae'));
});
test('Stalker appearance stays separate from its private origin',()=>{
 start();const c=worldState.bestiary.find(c=>c.name==='Mire-Gilded Stalker');assert(c.desc,'missing public appearance');
 assert(/lantern-eyed/.test(c.desc)&&/iron/.test(c.desc),'visible clues lost');assert(!/Grist|goblin|stolen|frame/i.test(c.desc));assert(/Grist.*goblins/.test(c.notes),'GM truth lost');assert(creatureAvailable(c));
});
test('actual enemy cards reveal no notes or disguised identity',()=>{
 start();(0,eval)(fs.readFileSync(path.join(__dirname,'../ui-mobile.js'),'utf8'));let html='';global.modalShell=function(id,body){html=body;};
 for(const name of ['Borrowed-Banner Raider','Mire-Gilded Stalker']){
  const c=worldState.bestiary.find(c=>c.name===name);showEnemyDetails({name,hp:9,maxHp:12,ac:13});
  assert(c.desc&&html.includes(c.desc),'public appearance missing for '+name);
  assert(!/Grist|goblin|stolen court|Fen alchemy|Creature notes/.test(html),'GM truth displayed for '+name);
  if(c.displayName){assert(html.includes(c.displayName));assert(!html.includes(c.name));}
 }
});
test('turn zero knows only its visited starting place',()=>{
 start();const toc=memoryTOC();assert(!toc.includes('KNOWN OF (not yet visited):'),toc);
 assert(toc.includes('VISITED: The Boundary Clearing'));for(const place of ['The Down Below','The Iron Cells','The Counterfeit Workshop'])assert(!toc.includes(place),'secret place listed: '+place);
 worldState.transcript.push({r:'gm',x:'The scout names the Ironwood Heart.'});assert(/KNOWN OF[^\n]*Ironwood Heart/.test(memoryTOC()));
});
test('authored fields meet designer publication limits',()=>{
 const long=blueprintTextFields(authored).filter(f=>typeof f.owner[f.key]==='string'&&f.owner[f.key].length>f.limit);assert.deepEqual(long.map(f=>f.path),[]);
});
test('edition advances without changing catalog identity or status',()=>{
 assert.equal(authored.version,'1.01');assert.equal(authored.releaseStatus,'release-candidate');assert.equal(authored.catalogId,'the_silence_between_leaves');
 const rows=JSON.parse(fs.readFileSync(path.join(__dirname,'../samples/catalog.json'),'utf8'));const row=rows.find(r=>r.file==='the_silence_between_leaves.blueprint');assert(row);assert.equal(row.name,authored.name);assert.equal(row.author,authored.author||'');
});
console.log('#722 '+passed+' passed, '+failures+' failed');process.exitCode=failures?1:0;
