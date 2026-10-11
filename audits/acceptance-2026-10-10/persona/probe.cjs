// Disposable acceptance evidence. Uses shipping engine functions and synthetic canon only.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../../..'),engine=require(path.join(root,'dev/load-engine.js'));
engine.loadEngine();
let count=0;function check(name,fn){fn();count++;console.log('PASS '+name);}
function entry(t,name,line){const x='A voice answers. "'+line+'" Another replies. "Only the other speaker said this."';const us=TTS._textPrep.splitSentences(x,null,true),s={};us.forEach((u,i)=>{if(u.spk===0)s[i]=name;if(u.spk===1)s[i]='Other Speaker';});return {r:'gm',t,x,sp:{n:us.length,s}};}
const lines=['Keep your boots off my table, stranger.','The road owes nobody a gentle welcome.','Ask me plainly and I will answer plainly.','I count debts twice and promises once!'];
const sheet={name:'Acceptance Resident',gender:'F',cls:'Rogue',inventory:[],trait:'Speaks with exact blunt words.',flaw:'Distrusts promises.',appear:'Copper braid.',motivation:'Keep the road open.',manner:'Clipped sentences; no greeting.',voiceLines:[{text:'The old road still remembers us.',turn:7,camp:'Old Home'}]};
engine.makeTestWorld({campName:'Source Acceptance',transcript:lines.map((l,i)=>entry(i+1,sheet.name,l)),npcs:[{name:sheet.name,charSheet:sheet}]});
const original=JSON.stringify(sheet),captured=portableSheet(sheet);
check('export captures 4 OWN lines and source camp, detached from live sheet',()=>{assert.equal(captured.voiceLines.length,4);captured.voiceLines.forEach((l,i)=>{assert.equal(l.text,lines[i]);assert.equal(l.camp,'Source Acceptance');assert.equal(l.turn,i+1);});assert.equal(JSON.stringify(sheet),original);});
check('hero with 4 real lines is not captured',()=>{worldState.character=JSON.parse(JSON.stringify(sheet));assert.deepEqual(portableSheet(worldState.character).voiceLines,sheet.voiceLines);worldState.character.name='Hero';});
check('exactly 2 usable lines preserve carried evidence byte for byte',()=>{worldState.transcript=worldState.transcript.slice(0,2);assert.deepEqual(portableSheet(sheet).voiceLines,sheet.voiceLines);});
check('exactly 3 usable lines replace carried evidence',()=>{worldState.transcript=lines.slice(0,3).map((l,i)=>entry(i+1,sheet.name,l));assert.equal(portableSheet(sheet).voiceLines.length,3);});
fs.writeFileSync(path.join(__dirname,'captured-sheet.json'),JSON.stringify(captured,null,2)+'\n','utf8');
function fresh(kind){engine.makeTestWorld({kind,campName:'Destination Acceptance',world:{location:'The Village',sublocation:'the tavern',region:'The Reach',time:'day',weather:'clear',threat:'low'}});memory.map={nodes:{'The Village':{size:'small',npcs:[],items:[]},'The Village|the tavern':{size:'small',parent:'The Village',npcs:[],items:[]}},edges:[],lastArrivalFrom:null};lastAction='Warm my hands by the fire.';const lib=JSON.parse(JSON.stringify({character:captured,updatedAt:100}));assert.equal(importVillageResidents([lib]).added,1);const r=wsNpcByName(sheet.name);memory.npcs[sheet.name].lastSeenAt=currentNodeKey();memory.npcs[sheet.name].lastSeenTurn=worldState.turn;memory.npcs[sheet.name].lastMentioned=worldState.turn;return r;}
function roster(p){const m=p.volatile.match(/\nNPCs: ([^\n]*)/);assert.ok(m,'roster exists');return m[1];}
for(const kind of Object.keys(CAMPAIGN_KINDS)){
 const row=fresh(kind);
 check(kind+': real resident admission preserves voice/manner exactly and does not seed attitude',()=>{assert.deepEqual(row.charSheet.voiceLines,captured.voiceLines);assert.equal(row.charSheet.manner,captured.manner);assert.equal(memory.npcs[sheet.name].attitude,'');});
 const p=buildSysPrompt();
 check(kind+': present roster serves authored personality and last three voice lines only, resident stable clean',()=>{const r=roster(p);assert.ok(r.includes('plays as: '+sheet.trait));assert.ok(r.includes('flaw: '+sheet.flaw));assert.ok(r.includes('look: '+sheet.appear));assert.ok(r.includes('motivation: '+sheet.motivation));assert.ok(r.includes(lines[3]));assert.ok(!r.includes(lines[0]));assert.ok(r.includes('manner: '+sheet.manner));assert.ok(!p.stable.includes(lines[3]));});
 memory.npcs[sheet.name].lastSeenAt='The Village|another house';delete worldState.sceneRefs;
 const absent=buildSysPrompt();
 check(kind+': mentioned but absent roster stays bare and stable bytes unchanged',()=>{assert.ok(roster(absent).includes(sheet.name));assert.ok(!roster(absent).includes('says:'));assert.ok(!roster(absent).includes('plays as:'));assert.equal(absent.stable,p.stable);});
 row.partyMember=true;row.rel='companion';memory.npcs[sheet.name].partyMember=true;
 const companion=buildSysPrompt();
 check(kind+': companion intentionally serves voice in stable block and never doubles roster',()=>{assert.ok(companion.stable.includes(lines[3]));assert.ok(!roster(companion).includes('says:'));});
 worldState.turn++;worldState.world.weather='rain';lastAction='Count the raindrops.';
 check(kind+': companion stable bytes identical across turn/action/weather',()=>assert.equal(buildSysPrompt().stable,companion.stable));
 fresh(kind);worldState.npcs=[];memory.npcs={};worldState.pendingLegacy=JSON.parse(JSON.stringify(captured));const legacy=buildSysPrompt();
 check(kind+': legacy serves carried evidence in volatile only',()=>{assert.ok(legacy.volatile.includes('LEGACY CHARACTER'));assert.ok(legacy.volatile.includes(lines[3]));assert.ok(legacy.volatile.includes('manner: '+sheet.manner));assert.ok(!legacy.stable.includes(lines[3]));});
}
console.log('ACCEPTANCE GREEN: '+count+' checks');
