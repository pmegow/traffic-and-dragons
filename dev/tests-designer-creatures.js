const assert=require('assert/strict'), fs=require('fs'), path=require('path'), vm=require('vm');
const root=path.resolve(__dirname,'..');
let passed=0,failed=0;
async function test(name,fn){try{await fn();passed++;console.log('PASS CREATURES '+name);}catch(e){failed++;console.error('FAIL CREATURES '+name+': '+e.message);}}
(async()=>{
let C;
await test('creature controls expose the requested choices',()=>{
 C=require('../designer-creatures.js');
 for(const [key,values] of Object.entries({kind:['Beast','Humanoid','Corrupted','Giant','Undead','Magical','Pack'],threat:['Safe','Minor','Dangerous','Lethal','Catastrophic'],frequency:['common','uncommon','scarce','rare','unique'],treasure:['None','Coins & valuables','Equipment','Crafting materials','Magic items','Relics','Mixed hoard']})) for(const v of values)assert(C.fields[key].values.includes(v),key+': '+v);
});
if(C){
await test('#723 environment dropdown choices drive prompt and stored entries',()=>{
 assert(C.fields.environment,'Environment control missing');for(const v of ['Forest','Swamp','Desert','Urban area'])assert(C.fields.environment.values.includes(v));
 const acts=[{}, {}, {}];const plans=C.plan({count:2,kind:'Humanoid',threat:'Minor',frequency:'common',environment:'Forest',availableActs:[1,3]},()=>0,acts);
 assert.deepEqual(plans[0].availableActs,[1,3]);assert(C.prompt('A border story',plans[0],[]).includes('Environment: Forest'));
 assert(C.prompt('A border story',plans[0],[]).includes('1, 3'));
 const c=C.entry({name:'Forest soldier',notes:'A genuine forest patrol.',desc:'An antlered guard.',environment:'Desert',revealAct:2},plans[0],[],acts);
 assert.equal(c.environment,'Forest');assert.deepEqual(c.availableActs,[1,3]);assert.equal(c.revealAct,undefined);
});
await test('#723 all-acts default is unrestricted and no-acts selection stays empty',()=>{
 const acts=[{}, {}, {}],input={count:1,kind:'Beast',threat:'Minor',frequency:'common'};
 let p=C.plan(input,()=>0,acts)[0];assert.deepEqual(p.availableActs,[1,2,3]);assert.equal(p.environment,'Any environment');
 let c=C.entry({name:'Hare',notes:'A hare.'},p,[],acts);assert.equal(c.availableActs,undefined);assert.equal(c.environment,undefined);
 p=C.plan({...input,availableActs:[]},()=>0,acts)[0];c=C.entry({name:'Hare',notes:'A hare.'},p,[],acts);assert.deepEqual(c.availableActs,[]);
 for(const availableActs of [null,[0],[4],[1,1],['1']])assert.throws(()=>C.plan({...input,availableActs},()=>0,acts),/act/i);
});

await test('#723 a draft without acts defaults to unrestricted rather than promising exclusion',()=>{
 const p=C.plan({count:1,kind:'Beast',threat:'Minor',frequency:'common'},()=>0,[])[0];assert.equal(p.availableActs,undefined);
 const c=C.entry({name:'Hare',notes:'A hare.'},p,[],[]);assert.equal(c.availableActs,undefined);
 const explicit=C.plan({count:1,kind:'Beast',threat:'Minor',frequency:'common',availableActs:[]},()=>0,[])[0];assert.deepEqual(C.entry({name:'Hare',notes:'A hare.'},explicit,[],[]).availableActs,[]);
});
await test('counts reject empty fractional zero negative and excessive batches',()=>{for(const count of ['',0,-1,1.5,21,'2cats',Infinity])assert.throws(()=>C.plan({count,kind:'Beast',threat:'Safe',frequency:'common'}),/whole number/);assert.equal(C.plan({count:'20',kind:'Beast',threat:'Safe',frequency:'common'}).length,20);assert.throws(()=>C.plan({count:1,kind:'wrong',threat:'Safe',frequency:'common'}),/Kind/);});
await test('random resolves independently per creature and fixed picks are authoritative',()=>{let n=0;const plans=C.plan({count:3,kind:'random',threat:'Dangerous',frequency:'random'},()=>((n++)%3)/3);assert.notEqual(plans[0].kind,plans[1].kind);assert(plans.every(p=>p.threat==='Dangerous'&&p.frequency!=='random'));const e=C.entry({name:'Moth',kind:'wrong',threat:'wrong',notes:'Feeds on candlelight.'},plans[0],[]);assert.equal(e.kind,plans[0].kind);assert.equal(e.threat,'Dangerous');assert(e.notes.startsWith('Frequency: '+plans[0].frequency+'. '));});
await test('treasure selection persists in notes and default None avoids unintended loot',()=>{const defaults=C.plan({count:1,kind:'Beast',threat:'Safe',frequency:'common'});assert.equal(defaults[0].treasure,'None');const p=C.plan({count:1,kind:'Construct',threat:'Minor',frequency:'rare',treasure:'Salvage'})[0];assert(C.prompt('Workshop',p,[]).includes('Treasure type: Salvage'));assert(C.entry({name:'Clockwork bat',notes:'Lives in the rafters.'},p,[]).notes.includes('Treasure: Salvage.'));});
await test('invalid and duplicate model results cannot enter the bestiary',()=>{const p={kind:'Beast',threat:'Safe',frequency:'common'};for(const r of [null,[],{name:'',notes:'x'},{name:'Moth',notes:''}])assert.throws(()=>C.entry(r,p,[]));assert.throws(()=>C.entry({name:' moth ',notes:'x'},p,[{name:'MOTH'}]),/already exists/);});
await test('portraits persist in files but never enter text review payloads',()=>{const b={name:'Test',creatures:[{name:'Moth',portrait:'data:image/png;base64,HUGE',notes:'Light.'}],_view:1};const out=C.textBlueprint(b);assert.equal(out.creatures[0].portrait,undefined);assert.equal(out._view,undefined);assert.equal(b.creatures[0].portrait,'data:image/png;base64,HUGE');});
await test('text fixes retain existing portraits and cannot invent image attachments',()=>{assert.equal(C.preservePortrait({portrait:'saved'},{name:'Moth',portrait:'model URL'}).portrait,'saved');assert.equal(C.preservePortrait(null,{name:'Moth',portrait:'model URL'}).portrait,undefined);});
await test('#719 generated public fields survive without copying private notes',()=>{
 const choice={kind:'Beast',threat:'Minor',frequency:'rare'};
 const entry=C.entry({name:'Secret',notes:'PRIVATE',desc:'A reed cloak.',displayName:'Rider',revealAct:2},choice,[]);
 assert.equal(entry.desc,'A reed cloak.');assert.equal(entry.displayName,'Rider');assert.equal(entry.revealAct,2);
 const prompt=C.prompt('Border',choice,[]);for(const field of ['desc','displayName','revealAct'])assert(prompt.includes(field),field);
 assert(C.portraitPrompt(entry).includes('Rider'));assert(C.portraitPrompt(entry).includes('A reed cloak.'));
 assert(!/Secret|PRIVATE|Beast/.test(C.portraitPrompt(entry)));
 assert.throws(()=>C.portraitPrompt({name:'Secret',displayName:'Rider',notes:'PRIVATE'}),/appearance/i);
});
const html=fs.readFileSync(path.join(root,'blueprint-designer.html'),'utf8');
await test('#719 designer exposes typed reveal gates and public appearance',()=>{
 for(const field of ['desc','displayName'])assert(html.includes('"creature",i,0,"'+field+'"'),field+' editor');
 assert(html.includes("creatureActsMenu(C,bp.acts,i)"),"act selection editor replaces the numeric reveal field");
 const engine=require('./load-engine.js');engine.loadEngine('game.js');
 const c={bp:{creatures:[{}]},FIELD_ROOTS:{creature:()=>c.bp.creatures[0]}};vm.createContext(c);
 const a=html.indexOf('function bpFieldSet('),b=html.indexOf('function ',a+10);vm.runInContext(html.slice(a,b),c);
 c.bpFieldSet('creature',0,0,'revealAct','2');assert.equal(c.bp.creatures[0].revealAct,2);
 c.bpFieldSet('creature',0,0,'revealAct','');assert(!Object.hasOwn(c.bp.creatures[0],'revealAct'));
});
function fixture(){const c={DesignerCreatures:C,bp:{creatures:[]},console,repairModelJson:x=>x,storyContext:()=> 'Village',designerModel:()=> 'gpt-6-astra',markDirty:()=>{},render:()=>{},fitDesignerText:async()=>true,document:{getElementById:()=>null},llmReady:()=>true};vm.createContext(c);const a=html.indexOf('var creatureGeneration='),b=html.indexOf('// ── Generate campaign from scratch',a);assert(a>=0&&b>a,'batch seam missing');vm.runInContext(html.slice(a,b),c);return c;}
await test('creature context includes hard rules and established setting details without images',()=>{const c=fixture();c.bp={name:'Fen',acts:[],rules:['Undead cannot exist.'],locations:[{name:'Pool',description:'Salt water.'}],npcs:[{name:'Keeper',notes:'Protects the moths.'}],creatures:[{name:'Moth',notes:'Feeds on light.',portrait:'IMAGE_BYTES'}]};const a=html.indexOf('function storyContext(){'),b=html.indexOf('var creatureGeneration=',a);vm.runInContext(html.slice(a,b),c);const msg=c.storyContext();for(const text of ['Undead cannot exist.','Salt water.','Protects the moths.','Feeds on light.'])assert(msg.includes(text),text);assert(!msg.includes('IMAGE_BYTES'));});
await test('portrait text edits during generation preserve the prior image',async()=>{const c=fixture(),creature={name:'Moth',kind:'Beast',threat:'Safe',notes:'Light.',portrait:'previous'};c.bp.creatures=[creature];c.falAvailable=()=>true;c.elapsedTicker=()=>({stop(){}});let status='';c.setStatus=text=>status=text;c.generatePortraitImage=async()=>{creature.notes='Changed during drawing.';return 'image';};c.creaturePortraitData=async()=> 'replacement';await c.generateCreaturePortrait(creature,{});assert.equal(creature.portrait,'previous');assert(status.includes('changed'));assert.equal(c.creaturePortraitJobs.length,0);});
await test('NPC portrait uses public details and ignores secret fields',async()=>{const c=fixture(),npc={name:'Fen Keeper',role:'ferryman',pronouns:'they/them',notes:'A silver-haired guide in a green coat.',secret:'SECRET_SENTINEL hidden dragon',agenda:'AGENDA_SENTINEL',portrait:'previous'};c.bp.npcs=[npc];c.falAvailable=()=>true;c.elapsedTicker=()=>({stop(){}});c.setStatus=()=>{};let prompt='';c.generatePortraitImage=async text=>{prompt=text;return 'image';};c.creaturePortraitData=async()=> 'replacement';await c.generateDesignerPortrait('npc',npc,{});assert(prompt.includes(npc.name)&&prompt.includes(npc.notes)&&prompt.includes(npc.pronouns));assert(!prompt.includes('SECRET_SENTINEL')&&!prompt.includes('AGENDA_SENTINEL'));assert.equal(npc.portrait,'replacement');});
await test('NPC portrait rejects late edits removal replacement and provider failures',async()=>{for(const mode of ['edit','remove','replace','failure']){const c=fixture(),npc={name:'Keeper',role:'guide',pronouns:'they/them',notes:'A green coat.',portrait:'previous'};c.bp.npcs=[npc];c.falAvailable=()=>true;c.elapsedTicker=()=>({stop(){}});let status='';c.setStatus=t=>status=t;c.generatePortraitImage=async()=>{if(mode==='edit')npc.notes='A red coat.';if(mode==='remove')c.bp.npcs=[];if(mode==='replace')c.bp={npcs:[npc]};if(mode==='failure')throw Error('provider refusal');return 'image';};c.creaturePortraitData=async()=> 'replacement';await c.generateDesignerPortrait('npc',npc,{});assert.equal(npc.portrait,'previous',mode);assert(status.includes(mode==='failure'?'provider refusal':'changed'),mode);assert.equal(c.creaturePortraitJobs.length,0);}});
await test('draft storage failure reports its reason and a file-save recovery',async()=>{const Drafts=require('../blueprint-designer-drafts.js');let reported;const writer=Drafts.writer({write:async()=>{throw Error('Quota exceeded');}},()=>({bp:{}}),s=>reported=s,100000);writer.schedule();await assert.rejects(writer.flush(),/Quota exceeded/);assert.equal(reported.kind,'error');assert(reported.error.message.includes('Quota exceeded'));const ui=fs.readFileSync(path.join(root,'blueprint-designer-autosave.js'),'utf8');assert(ui.includes('Save a .blueprint file to keep your changes.'));writer.close();});
await test('a batch makes the requested number of utility calls and appends once',async()=>{const c=fixture();let calls=0,dirty=0;c.markDirty=()=>dirty++;c.callGM=async(msg,sys,tokens,model,opts)=>{assert(msg.includes('Frequency: rare'));assert.equal(model,'gpt-6-astra');assert.equal(opts.noHistory,true);assert.equal(opts.kind,'other');return JSON.stringify({name:'Moth '+(++calls),notes:'Feeds on candlelight.'});};await c.genCreatureBatch({count:3,kind:'Beast',threat:'Minor',frequency:'rare'},()=>{});assert.equal(calls,3);assert.equal(c.bp.creatures.length,3);assert.equal(dirty,1);});
await test('a failed batch preserves the original bestiary',async()=>{const c=fixture();let calls=0;c.bp.creatures=[{name:'Existing'}];c.callGM=async()=>{if(++calls===2)throw Error('provider refused');return '{"name":"Moth","notes":"Light."}';};await assert.rejects(c.genCreatureBatch({count:2,kind:'Beast',threat:'Minor',frequency:'rare'},()=>{}),/provider refused/);assert.equal(c.bp.creatures.length,1);assert.equal(c.creatureGeneration,null);});
await test('#719 generated gate outside the actual acts refuses the whole batch',async()=>{
 const c=fixture();c.bp.acts=[{},{}];c.callGM=async()=>JSON.stringify({name:'Rider',notes:'Private.',revealAct:999});
 await assert.rejects(c.genCreatureBatch({count:1,kind:'Beast',threat:'Minor',frequency:'rare'},()=>{}),/revealAct/);assert.equal(c.bp.creatures.length,0);
});
await test('#723 act and context changes discard pending generations',async()=>{for(const field of ['acts','rules','premise']){const c=fixture();c.bp.acts=[{title:'First'}];c.callGM=async()=>{c.bp[field]=field==='acts'?[{title:'Other'}]:field==='rules'?['New rule']:'New premise';return '{"name":"Moth","notes":"Light."}';};await assert.rejects(c.genCreatureBatch({count:1,kind:'Beast',threat:'Minor',frequency:'rare'},()=>{}),/changed/);assert.equal(c.bp.creatures.length,0);}});
await test('#723 text patches preserve habitat act choices and public details',()=>{const old={portrait:'saved',environment:'Forest',availableActs:[1,3],desc:'A cloak',displayName:'Rider'};const c=C.preserveCreature(old,{name:'Guard',notes:'Revised'});for(const k of Object.keys(old))assert.deepEqual(c[k],old[k],k);assert.notEqual(c.availableActs,old.availableActs);assert.equal(C.preserveCreature(old,{name:'Guard',revealAct:2}).availableActs,undefined);assert.equal(C.preserveCreature({revealAct:2},{name:'Guard',availableActs:[1]}).revealAct,undefined);});
await test('cancelled or replaced drafts never receive late creatures',async()=>{for(const mode of ['cancel','replace']){const c=fixture();c.callGM=async()=>{if(mode==='cancel')c.creatureGeneration.cancelled=true;else c.bp={creatures:[]};return '{"name":"Moth","notes":"Light."}';};await assert.rejects(c.genCreatureBatch({count:1,kind:'Beast',threat:'Minor',frequency:'rare'},()=>{}),/cancelled|changed/);assert.equal(c.bp.creatures.length,0);}});
}
console.log('CREATURES: '+passed+' passed, '+failed+' failed');process.exitCode=failed?1:0;
})();
