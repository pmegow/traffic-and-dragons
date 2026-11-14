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
await test('#729 creature portraits request 55mm f/1.8 and a softly blurred habitat',()=>{
 const entries=[{name:'Fox scout',desc:'A human face with fox ears.',notes:'PRIVATE'}, {name:'Legacy moth',kind:'Fey',notes:'A winged figure in a moss cloak.'}];
 for(const entry of entries){const prompt=C.portraitPrompt(entry);assert.match(prompt,/55mm lens at f\/1\.8/);assert.match(prompt,/shallow depth of field/);assert.match(prompt,/eyes and face in sharp focus/);assert.match(prompt,/background.*softly blurred.*bokeh/);assert.match(prompt,/fine detail.*creature only/);}
});
await test('#726 creature portrait prompts omit both name fields and preserve authored appearance',()=>{
 const appearance='A compact humanoid fey with a youthful humanlike face, a small human nose; no frog head or amphibian muzzle.';
 const entries=[{name:'Frog-Eyed Reedjumper',displayName:'Bog Herald',desc:appearance,notes:'PRIVATE_SENTINEL'}, {name:'Squirrel-Tailed Branchrunner',desc:appearance,notes:'PRIVATE_SENTINEL'}, {name:'Legacy creature name',kind:'Fey',threat:'low',notes:'A humanoid scout with human facial anatomy.'}];
 for(const c of entries){const before=JSON.stringify(c),prompt=C.portraitPrompt(c);assert(!prompt.includes(c.name),'canonical name omitted');assert(!c.displayName||!prompt.includes(c.displayName),'public name omitted');assert(prompt.includes(c.desc||c.notes),'authored description retained exactly');if(c.desc)assert(!prompt.includes('PRIVATE_SENTINEL'));assert.equal(JSON.stringify(c),before,'blueprint names remain intact');assert.equal(C.portraitPrompt({...c,name:'Different canonical name',...(c.desc?{displayName:'Different public name'}:{})}),prompt,'name changes cannot influence the image request');}
});
await test('#719 generated public fields survive without copying private notes',()=>{
 const choice={kind:'Beast',threat:'Minor',frequency:'rare'};
 const entry=C.entry({name:'Secret',notes:'PRIVATE',desc:'A reed cloak.',displayName:'Rider',revealAct:2},choice,[]);
 assert.equal(entry.desc,'A reed cloak.');assert.equal(entry.displayName,'Rider');assert.equal(entry.revealAct,2);
 const prompt=C.prompt('Border',choice,[]);for(const field of ['desc','displayName','revealAct'])assert(prompt.includes(field),field);
 assert(!C.portraitPrompt(entry).includes('Rider'));assert(C.portraitPrompt(entry).includes('A reed cloak.'));
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
await test('#731 NPC portraits add 55mm f/1.8 while preserving public identity',async()=>{const c=fixture(),npc={name:'The Willow Mother',role:'ally',pronouns:'she/her',notes:'An ancient willow-shaped being rooted in the marsh.',secret:'SECRET_FOCUS_SENTINEL',abilities:'ABILITY_FOCUS_SENTINEL'};c.bp.npcs=[npc];c.falAvailable=()=>true;c.elapsedTicker=()=>({stop(){}});c.setStatus=()=>{};let prompt='';c.generatePortraitImage=async text=>{prompt=text;return 'image';};c.creaturePortraitData=async()=> 'portrait';await c.generateDesignerPortrait('npc',npc,{});for(const text of [npc.name,npc.role,npc.pronouns,npc.notes])assert(prompt.includes(text),text);assert.equal(prompt.split('55mm lens at f/1.8').length-1,1,'one lens instruction');assert.match(prompt,/shallow depth of field/);assert.match(prompt,/character's eyes and face in sharp focus/);assert.match(prompt,/background.*softly blurred.*bokeh/);assert.match(prompt,/fine detail.*character only/);assert(!prompt.includes(npc.secret)&&!prompt.includes(npc.abilities));});
await test('NPC portrait rejects late edits removal replacement and provider failures',async()=>{for(const mode of ['edit','remove','replace','failure']){const c=fixture(),npc={name:'Keeper',role:'guide',pronouns:'they/them',notes:'A green coat.',portrait:'previous'};c.bp.npcs=[npc];c.falAvailable=()=>true;c.elapsedTicker=()=>({stop(){}});let status='';c.setStatus=t=>status=t;c.generatePortraitImage=async()=>{if(mode==='edit')npc.notes='A red coat.';if(mode==='remove')c.bp.npcs=[];if(mode==='replace')c.bp={npcs:[npc]};if(mode==='failure')throw Error('provider refusal');return 'image';};c.creaturePortraitData=async()=> 'replacement';await c.generateDesignerPortrait('npc',npc,{});assert.equal(npc.portrait,'previous',mode);assert(status.includes(mode==='failure'?'provider refusal':'changed'),mode);assert.equal(c.creaturePortraitJobs.length,0);}});
await test('#743 images of both forms stay out of text payloads and survive text fixes',()=>{
 const b={name:'T',creatures:[{name:'Hag',notes:'N',portrait:'TRUE_BYTES',altPortrait:'ALT_BYTES',altDesc:'A fair woman.'}],npcs:[{name:'Sage',notes:'N',altPortrait:'NPC_ALT_BYTES'}]},t=JSON.stringify(C.textBlueprint(b));
 assert(!/TRUE_BYTES|ALT_BYTES/.test(t),'no image bytes in a text payload');assert(t.includes('A fair woman.'),'the alternate appearance is text and stays');
 const next=C.preservePortrait({portrait:'saved',altPortrait:'saved-alt'},{name:'Hag',portrait:'model URL',altPortrait:'model alt URL'});assert.equal(next.portrait,'saved');assert.equal(next.altPortrait,'saved-alt');
 assert.equal(C.preservePortrait({},{name:'Hag',altPortrait:'model alt URL'}).altPortrait,undefined,'a text fix cannot invent an alternate image');
 const old={altDesc:'A fair woman.',altWhen:'Unmasks when struck.',startsAs:'story',desc:'A crone.',abilities:'Curse'};
 for(const fn of [C.preserveCreature,C.preserveEntity]){const kept=fn(old,{name:'Hag',notes:'Changed'});for(const k of ['altDesc','altWhen','startsAs','desc','abilities'])assert.equal(kept[k],old[k],k);}
 assert.equal(C.preserveEntity(old,{name:'Hag',altDesc:'A grey widow.'}).altDesc,'A grey widow.','an edited field wins');
});
await test('#743 the alternate portrait is drawn from the alternate appearance alone',()=>{
 const c={name:'NAME_SENTINEL',displayName:'PUBLIC_SENTINEL',kind:'KIND_SENTINEL',threat:'THREAT_SENTINEL',notes:'NOTES_SENTINEL',desc:'TRUE_SENTINEL',altDesc:'A fair woman in a grey cloak.',altWhen:'CUE_SENTINEL',secret:'SECRET_SENTINEL'};
 for(const subject of ['creature','character']){const p=C.altPortraitPrompt(c,subject);assert(p.includes('A fair woman in a grey cloak.'));assert(!/SENTINEL/.test(p),'only the alternate appearance: '+p);assert.equal(p.split('55mm lens at f/1.8').length-1,1);assert(p.includes(subject+"'s eyes and face"));}
 assert(C.altPortraitPrompt(c,'creature').startsWith('Bestiary illustration.'));assert(C.altPortraitPrompt(c,'character').startsWith('Character portrait.'));
 for(const bad of [null,{},{altDesc:'   '},{altDesc:7}])assert.throws(()=>C.altPortraitPrompt(bad,'creature'),/alternate appearance/);
});
await test('#743 slot one is the true form: an authored alternate frees it from the mask description',()=>{
 const formed={name:'Hag',displayName:'Woman',kind:'Giant',threat:'Lethal',notes:'A hunched crone.',altDesc:'ALT_SENTINEL'},p=C.portraitPrompt(formed);
 assert(p.includes('A hunched crone.')&&!p.includes('ALT_SENTINEL'),'the true portrait never shows the alternate');
 assert.throws(()=>C.portraitPrompt({name:'Hag',displayName:'Woman',notes:'PRIVATE'}),/appearance/i,'a legacy mask still needs its one description');
 const withTrue=C.portraitPrompt({name:'Hag',displayName:'Woman',notes:'PRIVATE',desc:'A crone in rags.',altDesc:'ALT_SENTINEL'});assert(withTrue.includes('A crone in rags.')&&!/PRIVATE|ALT_SENTINEL/.test(withTrue));
});
await test('#743 a legacy mask moves its description and its portrait to the alternate, once',()=>{
 const c={name:'Hag',displayName:'Woman',desc:'A fair woman.',portrait:'MASK_IMAGE',notes:'N'};assert.equal(C.legacyMask(c),true);
 assert.equal(C.moveToAlternate(c),true);assert.equal(c.altDesc,'A fair woman.');assert.equal(c.altPortrait,'MASK_IMAGE');assert(!('desc' in c)&&!('portrait' in c),'the true form is left empty, never a copy');
 assert.equal(C.legacyMask(c),false);assert.equal(C.moveToAlternate(c),false,'a second click moves nothing');assert.equal(c.altDesc,'A fair woman.');
 const kept={name:'Hag',displayName:'Woman',desc:'A fair woman.',portrait:'P',altPortrait:'EXISTING'};C.moveToAlternate(kept);assert.equal(kept.altPortrait,'EXISTING');assert.equal(kept.portrait,'P','an existing alternate image is never overwritten');
 for(const not of [{name:'Wolf',desc:'Grey.'},{name:'Hag',displayName:'Woman',desc:'A crone.',altDesc:'A woman.'},{name:'Hag',displayName:'Woman'}]){const was=JSON.stringify(not);assert.equal(C.moveToAlternate(not),false);assert.equal(JSON.stringify(not),was);}
});
await test('#743 each slot generates into its own field from its own prompt',async()=>{
 for(const type of ['creature','npc']){const c=fixture(),e={name:'Hag',kind:'Giant',threat:'Lethal',role:'enemy',pronouns:'she/her',notes:'NOTES_SENTINEL',altDesc:'A fair woman in grey.',portrait:'true-image'};c.bp.creatures=[e];c.bp.npcs=[e];c.falAvailable=()=>true;c.elapsedTicker=()=>({stop(){}});let status='',prompts=[];c.setStatus=t=>status=t;c.generatePortraitImage=async t=>{prompts.push(t);return 'image';};c.creaturePortraitData=async()=> 'replacement';
  const r=await c.generateDesignerPortrait(type,e,{}, {slot:'alternate'});assert.equal(r.status,'saved',type+': '+r.reason);assert.equal(e.altPortrait,'replacement');assert.equal(e.portrait,'true-image','the true slot is untouched');
  assert(prompts[0].includes('A fair woman in grey.')&&!prompts[0].includes('NOTES_SENTINEL')&&!prompts[0].includes('Hag'),'alternate prompt: '+prompts[0]);assert(status.startsWith('Alternate portrait added'));
  await c.generateDesignerPortrait(type,e,{});assert.equal(e.portrait,'replacement');assert(prompts[1].includes('NOTES_SENTINEL'),'the true slot keeps its own prompt');assert.equal(e.altPortrait,'replacement');
  const skipped=await c.generateDesignerPortrait(type,e,null,{slot:'alternate',missingOnly:true,quiet:true});assert.equal(skipped.status,'skipped');assert.equal(prompts.length,2,'an existing alternate is never re-rendered by the batch');
  delete e.altPortrait;e.altDesc='  ';const refused=await c.generateDesignerPortrait(type,e,{}, {slot:'alternate'});assert.equal(refused.status,'failed');assert(/alternate appearance/.test(refused.reason));assert.equal(prompts.length,2,'no request without an alternate appearance');assert(!e.altPortrait);
  e.altDesc='A fair woman in grey.';c.generatePortraitImage=async()=>{e.altDesc='A grey widow.';return 'image';};await c.generateDesignerPortrait(type,e,{}, {slot:'alternate'});assert(!e.altPortrait,'an alternate appearance edited mid-drawing refuses the stale image');assert(status.includes('changed'));assert.equal(c.creaturePortraitJobs.length,0);
 }});
await test('#743 the card renders both slots, the alternate fields and the three starting forms',()=>{
 const engine=require('./load-engine.js');engine.loadEngine('game.js');const c=fixture();Object.assign(c,{esc:escHtml,safeImgSrc,formStart,formHasAlternate,fldB:(l,s,i,j,k,short,inner)=>'<fld '+k+'>'+l+inner,ta:(s,i,j,k,v)=>'<ta '+s+' '+k+'>'+v});
 const png='data:image/png;base64,AAAA',hag={name:'Hag',displayName:'Woman',desc:'A crone.',altDesc:'A fair woman.',altWhen:'When struck.',startsAs:'story',portrait:png,altPortrait:png};
 let h=c.formFields('creature',2,hag);assert(/<details class='form-block' data-form='creature' open>/.test(h),'open when an alternate exists');
 for(const v of ['true','alternate','story'])assert(h.includes("data-k='startsAs' value='"+v+"'"+(v==='story'?' checked':'')+'>'),'radio '+v);assert.equal(h.split(' checked').length-1,1,'exactly one starting form checked');
 assert(h.includes('<ta creature altDesc>A fair woman.')&&h.includes('<ta creature altWhen>When struck.'));assert(h.includes("data-op='creaturealtportrait' data-portrait-type='creature' data-portrait-action='generate' data-portrait-slot='alternate' data-i='2'"));assert(h.includes('Regenerate alternate portrait')&&h.includes('Remove alternate portrait'));
 assert(!h.includes('formmove'),'no move offered once an alternate appearance exists');assert(!h.includes('<ta creature desc>'),'the creature keeps its one description field on the card');
 h=c.formFields('npc',0,{name:'Sage',notes:'N'});assert(!/ open>/.test(h),'closed when there is no alternate');assert(h.includes("value='true' checked"),'an NPC with no alternate starts true');assert(h.includes('<ta npc desc>')&&h.includes('Generate alternate portrait'));
 h=c.formFields('creature',1,{name:'Hag',displayName:'Woman',desc:'A fair woman.',portrait:png});assert(h.includes("data-op='formmove' data-form-sec='creature' data-i='1'")&&h.includes('Move description and portrait to alternate'));assert(h.includes("value='alternate' checked"),'a legacy disguise starts alternate, as the engine reads it');
 const aside=c.designerPortraitAside('creature',hag,2);assert.equal(aside.split('<img').length-1,2,'both portraits shown');assert(aside.indexOf('True form')<aside.indexOf('Alternate form'),'slot 1 first');assert(aside.includes("data-op='creaturealtportraitview'")&&aside.includes("data-op='creatureportraitview'"));
 assert.equal(c.designerPortraitAside('creature',{name:'Wolf',portrait:png},0).split('Click to enlarge').length-1,1,'a plain entry is unchanged');assert(c.designerPortraitAside('creature',{name:'Wolf',portrait:png},0).indexOf('True form')<0);
 assert.equal(c.creatureDescLabel({name:'Wolf'}),'Public appearance');assert(/mask/.test(c.creatureDescLabel({displayName:'Woman',desc:'x'})));assert(/true form/.test(c.creatureDescLabel(hag)));
 assert.equal(c.designerHasPortrait({altPortrait:png}),true,'an alternate image alone still opens the side column');assert.equal(c.designerHasPortrait({}),false);
});
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
