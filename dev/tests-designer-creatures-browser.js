const {designerFileClick}=require('./designer-browser-actions.js');
// Actual Designer page, synthetic model and image responses; no credentials or live writes.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),cp=require('child_process');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..'),out=process.env.CREATURE_SCREENSHOTS||path.join(process.env.TEMP||require('os').tmpdir(),'tnd-creature-designer');fs.mkdirSync(out,{recursive:true});
const before=process.env.CREATURE_BEFORE==='1';
(async()=>{const browser=await chromium.launch({headless:true});try{
const context=await browser.newContext({viewport:{width:1050,height:900},serviceWorkers:'block'});
await context.addInitScript(()=>{localStorage.setItem('tnd_server_url_v1','http://creature.test');localStorage.setItem('tnd_server_tok_v1','fixture');});
let calls=[],portraitBodies=[],images=0,fail=false,hold=false,release,png='';const errors=[];
await context.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());if(url.hostname!=='creature.test')return route.abort();
 const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(url.pathname==='/api/account')return json({isAdmin:false,entitled:true});
 if(url.pathname.startsWith('/api/llm/')){
  calls.push(req.postDataJSON());if(hold)await new Promise(r=>release=r);
  if(fail)return json({error:'Fixture provider refusal'},400);
  /* the reply in the shape of the provider the page picked (the gateway path names it): Gemini is the default GM since #661, Anthropic before */
  const reply=JSON.stringify({name:'Lantern moth '+calls.length,notes:'A luminous moth feeds on guttering candles. It hides beneath leaves at dawn.',kind:'wrong',threat:'wrong'});
  if(url.pathname.startsWith('/api/llm/gemini/'))return json({candidates:[{content:{parts:[{text:reply}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:1,candidatesTokenCount:1}});
  return json({content:[{type:'text',text:reply}],usage:{input_tokens:1,output_tokens:1}});
 }
 if(url.pathname.startsWith('/api/render/')){images++;portraitBodies.push(req.postDataJSON());assert(typeof req.postDataJSON().prompt==='string'&&req.postDataJSON().prompt.length>0);assert(!req.postDataJSON().prompt.includes('SECRET_SENTINEL'));return json({images:[{url:'https://creature.test/portrait.png'}]});}
 if(url.pathname==='/portrait.png')return route.fulfill({status:200,contentType:'image/png',body:Buffer.from(png.split(',')[1],'base64')});
 let file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep))return route.abort();
 try{const data=(before&&url.pathname==='/blueprint-designer.html'||process.env.CREATURE_FIELDS_BEFORE==='1'&&['/blueprint-designer.html','/designer-creatures.js'].includes(url.pathname))?cp.execFileSync('git',['show','HEAD:'+url.pathname.slice(1)],{cwd:root}):fs.readFileSync(file);return route.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/javascript',body:data});}catch{return route.fulfill({status:404,body:'Missing fixture'});}
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://creature.test/blueprint-designer.html');await page.waitForFunction(()=>window.__bpdTest);
// #748: the screenshot warning represented three ordinary fields at the requested new boundary.
await page.evaluate(()=>{const text='x'.repeat(4000);__bpdTest.load({format:'tnd-blueprint-v1',name:'Fivefold text limits',premise:'A forest at dusk.',acts:[{title:'Travel',goal:'Reach home.',arcs:[{title:'Road',objective:'Find the way.'}]}],npcs:[{name:'Hushmoth Prowler',notes:text,desc:text,abilities:text}],locations:[],creatures:[],rules:[]});secOpen.npcs=true;bp.npcs[0]._c=false;render();});
await page.screenshot({path:path.join(out,'748-limits-desktop.png')});
assert(await page.evaluate(()=>document.getElementById('text-limit-status').hidden),'#748 three 4000-character fields no longer show the old limit warning');
assert.equal(await page.evaluate(()=>designerValidate()),null,'#748 the full boundary is publish-ready');
assert(await page.evaluate(()=>{const original=JSON.stringify(DesignerCreatures.textBlueprint(bp));const gameCopy=normalizeBlueprint(__bpdTest.out());return gameCopy.npcs[0].notes===bp.npcs[0].notes&&JSON.stringify(DesignerCreatures.textBlueprint(bp))===original;}),'#748 runtime import retains accepted prose without changing the draft');
await page.evaluate(()=>{bp.npcs[0].notes+='x';updateTextLimits();});
assert(await page.evaluate(()=>!document.getElementById('text-limit-status').hidden&&designerValidate().includes('text limits')),'#748 one character beyond the new boundary is still refused');
await page.evaluate(()=>{bp.npcs[0].notes=bp.npcs[0].notes.slice(0,-1);updateTextLimits();});
await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'748-limits-phone.png')});
assert(await page.evaluate(()=>document.getElementById('text-limit-status').hidden&&document.documentElement.scrollWidth<=innerWidth),'#748 expanded prose fits the phone and clears the warning');
await page.setViewportSize({width:1050,height:900});
console.log('PASS #748 fivefold limits: warning cleared, boundary admitted, runtime preserved, excess refused');
if(process.env.BLUEPRINT_LIMITS_ONLY==='1')return;
// Existing authored threats must not be replaced by a select's first option during rendering.
await page.evaluate(()=>{__bpdTest.load({format:'tnd-blueprint-v1',name:'Threat choices',premise:'A forest at dusk.',acts:[],npcs:[],locations:[],creatures:[{name:"Will 'o the Wisp",threat:'Dangerous',notes:'A light in the marsh.'},{name:'Old Guardian',threat:'CR 7 (elite)',notes:'An older authored threat.'},{name:'New creature',notes:'No threat chosen.'}],rules:[]});secOpen.creatures=true;bp.creatures.forEach(c=>c._c=false);render();});
const threatSelector='[data-sec="creature"][data-i="0"][data-k="threat"]';
async function showThreatCard(){await page.evaluate(()=>{const card=document.querySelector('[data-sec="creature"][data-k="threat"]').closest('.card');window.scrollTo(0,Math.max(0,card.getBoundingClientRect().top+scrollY-document.getElementById('topbar').offsetHeight-12));});}
await showThreatCard();await page.screenshot({path:path.join(out,'746-threat-desktop.png')});
assert.equal(await page.evaluate(s=>document.querySelector(s).tagName,threatSelector),'SELECT','#746 Threat is a dropdown on the creature card');
const levels=['Safe','Minor','Dangerous','Lethal','Catastrophic'];
assert.deepEqual(await page.evaluate(s=>Array.from(document.querySelector(s).options).map(o=>o.value).filter(Boolean),threatSelector),levels,'#746 card offers the five shared threat levels');
assert.equal(await page.evaluate(s=>document.querySelector(s).value,threatSelector),'Dangerous','#746 existing standard threat stays selected');
assert.equal(await page.evaluate(()=>document.querySelector('[data-sec="creature"][data-i="1"][data-k="threat"]').value),'CR 7 (elite)','#746 legacy custom threat stays selected');
assert.equal(await page.evaluate(()=>document.querySelector('[data-sec="creature"][data-i="2"][data-k="threat"]').value),'','#746 a blank threat stays unspecified');
assert(await page.evaluate(()=>!Object.prototype.hasOwnProperty.call(__bpdTest.out().creatures[2],'threat')),'#746 rendering does not write a default threat');
await page.locator('[data-op="gencreature"]').click();
assert.deepEqual(await page.evaluate(()=>Array.from(document.querySelector('#creature-threat').options).map(o=>o.value).filter(v=>v!=='random')),levels,'#746 card and generator share the same levels');
await page.locator('#creature-gen-cancel').click();
for(const level of levels){await page.locator(threatSelector).selectOption(level);assert.equal(await page.evaluate(()=>__bpdTest.out().creatures[0].threat),level,'#746 selecting a threat writes the chosen level');}
await page.locator(threatSelector).selectOption('');assert.equal(await page.evaluate(()=>__bpdTest.out().creatures[0].threat),'','#746 threat may be cleared');
await page.locator(threatSelector).selectOption('Dangerous');
await page.setViewportSize({width:390,height:844});await showThreatCard();await page.screenshot({path:path.join(out,'746-threat-phone.png')});
assert(await page.evaluate(s=>{const r=document.querySelector(s).getBoundingClientRect();return r.width>100&&r.left>=0&&r.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth;},threatSelector),'#746 threat dropdown fits the phone');
await page.locator(threatSelector).selectOption('Lethal');
await page.evaluate(()=>{const saved=__bpdTest.out();__bpdTest.load(saved);secOpen.creatures=true;bp.creatures.forEach(c=>c._c=false);render();});
assert.equal(await page.evaluate(s=>document.querySelector(s).value,threatSelector),'Lethal','#746 chosen threat survives a blueprint file round trip');
await page.evaluate(()=>designerDrafts.flush());await page.reload();await page.waitForFunction(()=>window.__bpdTest);
assert.equal(await page.evaluate(()=>bp.creatures[0].threat),'Lethal','#746 chosen threat survives draft reload');
assert.equal(await page.evaluate(()=>bp.creatures[1].threat),'CR 7 (elite)','#746 custom threat survives draft reload untouched');
assert.equal(calls.length,0,'#746 editing threats makes no model calls');assert.equal(images,0,'#746 editing threats makes no image calls');
await page.setViewportSize({width:1050,height:900});
console.log('PASS #746 Threat dropdown: shared levels, legacy and blank values, editing, phone, file and draft reload');
// A loaded (imported) note over the 4,000-character field cap: an AI write elsewhere must leave it whole and spend nothing on it
// (#547's own contract — "imported/manual text stays whole with an explicit shortening control"; the G5 waits suite found the
// automatic pass shortening the whole blueprint after one creature landed).
const importedLong='The warden walks the causeway every dusk with a shuttered lamp and a ledger of lights. '.repeat(51);
await page.evaluate(long=>{__bpdTest.load({format:'tnd-blueprint-v1',name:'The Lantern Fen',premise:'A marsh village loses its lights each night.',acts:[1,2,3].map(n=>({title:'Chapter '+n,goal:'Explore the fen',arcs:[{title:'Journey '+n,objective:'Travel safely'}]})),npcs:[{name:'Marsh Warden',role:'keeper of the causeway lights',notes:long}],locations:[],creatures:[],rules:[]});secOpen.creatures=true;__bpdTest.rerender();},importedLong);
assert(importedLong.length>4000&&await page.evaluate(()=>bp.npcs[0].notes.length>4000),'loaded NPC notes preserve the exact reported tail beyond the field cap — the fixture note must still overflow after load');
await page.evaluate(()=>document.querySelector('[data-op="gencreature"]').scrollIntoView({block:'center'}));
if(before){await page.screenshot({path:path.join(out,'before.png')});console.log('PASS before: original immediate-generation button captured');return;}
await page.locator('[data-op="gencreature"]').click();
await page.screenshot({path:path.join(out,process.env.CREATURE_FIELDS_BEFORE==='1'?'723-generator-before.png':'723-generator-after.png')});
assert(await page.evaluate(()=>!!document.querySelector('#creature-environment')),'#723 Environment dropdown exists');
assert(await page.evaluate(()=>{const boxes=Array.from(document.querySelectorAll('#creature-gen-form [data-creature-act]'));return boxes.length===3&&boxes.every(b=>b.checked); }),'#723 all campaign acts are checked by default');
assert.equal(calls.length,0,'opening the modal must not spend a model request');
await page.waitForSelector('#creature-gen-modal');
await page.locator('#creature-count').fill('3');await page.locator('#creature-kind').selectOption('Beast');await page.locator('#creature-threat').selectOption('Safe');await page.locator('#creature-frequency').selectOption('rare');await page.locator('#creature-treasure').selectOption('Crafting materials');
await page.locator('#creature-environment').selectOption('Forest');await page.locator('#creature-gen-form .creature-acts summary').click();await page.locator('#creature-gen-form [data-creature-act="2"]').click();
await page.screenshot({path:path.join(out,'modal-desktop.png')});
await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'modal-mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'modal has no horizontal overflow');await page.evaluate(()=>document.querySelector('#creature-gen-form [data-creature-act="3"]').scrollIntoView({block:'center'}));await page.screenshot({path:path.join(out,'723-acts-mobile.png')});
await page.locator('#creature-count').fill('1.5');await page.locator('#creature-gen-go').click();assert.equal(calls.length,0,'fractional counts blocked before network');
await page.locator('#creature-count').fill('3');await page.locator('#creature-gen-go').click();await page.waitForFunction(()=>__bpdTest.getBp().creatures.length===3);
assert(await page.evaluate(()=>bp.creatures.every(c=>c.environment==='Forest'&&JSON.stringify(c.availableActs)==='[1,3]')),'#723 selected habitat and noncontiguous acts survive generation');
assert.equal(calls.length,3,'three creatures cost three calls — the imported note was not sent for shortening');assert.equal(await page.evaluate(()=>bp.npcs[0].notes),importedLong,'an AI write never shortens text it did not write');assert(await page.evaluate(()=>document.activeElement.getAttribute('data-op')==='gencreature'),'focus returns to the rebuilt opener');assert.equal(images,0,'text generation never auto-generates portraits');
assert(await page.evaluate(()=>__bpdTest.getBp().creatures.every(c=>c.kind==='Beast'&&c.threat==='Safe'&&c.notes.indexOf('Frequency: rare.')===0)));
await page.setViewportSize({width:1050,height:900});
png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1024;const ctx=canvas.getContext('2d');ctx.fillStyle='#133942';ctx.fillRect(0,0,768,1024);ctx.fillStyle='#eadf9d';ctx.beginPath();ctx.ellipse(384,512,260,115,0,0,Math.PI*2);ctx.fill();return canvas.toDataURL('image/png');});
await page.locator('[data-op="creatureportrait"]').nth(0).click();await page.waitForFunction(()=>!!__bpdTest.getBp().creatures[0].portrait);assert.equal(images,1);assert(/55mm lens at f\/1\.8/.test(portraitBodies[0].prompt)&&/background.*softly blurred.*bokeh/.test(portraitBodies[0].prompt),'#729 legacy creature request carries shallow focus through the image boundary');
const portrait=await page.evaluate(()=>__bpdTest.out().creatures[0].portrait);assert(portrait.startsWith('data:image/jpeg;base64,'),'portrait is embedded and compressed');
assert(await page.evaluate(()=>{const old=bp.creatures[0].portrait;applyPatches(bp,[{section:'creatures',name:bp.creatures[0].name,item:{name:bp.creatures[0].name,kind:'Beast',threat:'Safe',notes:'Frequency: rare. Revised.'}}]);return bp.creatures[0].environment==='Forest'&&JSON.stringify(bp.creatures[0].availableActs)==='[1,3]'&&bp.creatures[0].portrait===old&&!JSON.stringify(DesignerCreatures.textBlueprint(bp)).includes(old);}),'Apply preserves portrait while text payload excludes it');
await page.evaluate(()=>{const out=__bpdTest.out();__bpdTest.load(out);secOpen.creatures=true;__bpdTest.rerender();});assert.equal(await page.evaluate(()=>__bpdTest.out().creatures[0].portrait),portrait,'file reload retains image');
await page.evaluate(()=>{bp.creatures[0]._c=false;__bpdTest.rerender();document.querySelector('.creature-portrait').closest('.card').scrollIntoView({block:'center'});});await page.waitForFunction(()=>document.querySelector('.creature-portrait').naturalWidth>0);await page.screenshot({path:path.join(out,'cards-with-portrait.png')});
if(process.env.CREATURE_LAYOUT_BEFORE==='1'){console.log('Captured original creature card');return;}
assert(await page.evaluate(()=>{const image=document.querySelector('.creature-portrait').getBoundingClientRect(),fields=document.querySelector('.creature-editor').getBoundingClientRect();return image.left>=fields.right&&image.top<fields.top+60;}),'portrait sits beside the full editor on desktop');
await page.evaluate(()=>document.querySelector('[data-op="creatureportraitview"]').focus());await page.locator('[data-op="creatureportraitview"]').nth(0).click();await page.waitForFunction(()=>document.querySelector('#creature-image-size').textContent.includes('400 × 533'));
assert(await page.evaluate(()=>{const image=document.querySelector('#creature-image-modal img');return image.naturalWidth===400&&image.width===400;}),'enlargement uses actual saved pixels');
await page.screenshot({path:path.join(out,'portrait-enlarged.png')});
await page.evaluate(()=>document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
assert(await page.evaluate(()=>!document.querySelector('#creature-image-modal')&&document.activeElement.getAttribute('data-op')==='creatureportraitview'),'Escape closes portrait and restores focus');
await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.querySelector('.creature-editor').scrollIntoView({block:'start'});window.scrollBy(0,-document.getElementById('topbar').getBoundingClientRect().height-12);});await page.screenshot({path:path.join(out,'creature-card-mobile.png')});
assert(await page.evaluate(()=>{const image=document.querySelector('.creature-portrait').getBoundingClientRect(),fields=document.querySelector('.creature-editor').getBoundingClientRect();return image.top>=fields.bottom&&document.documentElement.scrollWidth<=innerWidth;}),'portrait stacks below the editor on phones');
await page.locator('[data-op="creatureportraitview"]').nth(0).click();await page.waitForFunction(()=>document.querySelector('#creature-image-size').textContent.includes('400 × 533'));assert(await page.evaluate(()=>{const r=document.querySelector('#creature-image-modal img').getBoundingClientRect();return r.width<=innerWidth&&r.height<=innerHeight;}),'enlarged image fits phone viewport');await page.locator('#creature-image-close').click();await page.setViewportSize({width:1050,height:900});
fail=true;await page.locator('[data-op="gencreature"]').click();await page.locator('#creature-gen-go').click();await page.waitForFunction(()=>document.querySelector('#creature-gen-status').textContent.includes('Fixture provider refusal'));assert.equal(await page.evaluate(()=>bp.creatures.length),3,'failed batch keeps existing creatures');await page.locator('#creature-gen-cancel').click();
fail=false;hold=true;await page.locator('[data-op="gencreature"]').click();await page.locator('#creature-gen-go').click();await page.waitForFunction(()=>!!creatureGeneration);assert(await page.evaluate(()=>Array.from(document.querySelectorAll('#creature-gen-form input,#creature-gen-form select')).every(el=>el.disabled)),'running selections are locked');while(!release)await new Promise(r=>setTimeout(r,20));await page.locator('#creature-gen-cancel').click();assert.match(await page.locator('#statusline').innerText(),/^Creature batch cancelled/,'cancellation is immediate and neutral');release();await page.waitForFunction(()=>!creatureGeneration);assert.equal(await page.evaluate(()=>bp.creatures.length),3,'closing modal discards late result');assert.match(await page.locator('#statusline').innerText(),/^Creature batch cancelled/,'late result cannot overwrite cancellation');
await page.evaluate(()=>{bp.creatures.forEach(c=>delete c.availableActs);bp.acts=[1,2].map(n=>({title:'Fen chapter '+n,goal:'Explore the marsh.',arcs:[{title:'Meet the guide',objective:'Learn about the marsh.'}]}));bp.npcs=[{name:'Fen Keeper',role:'ferryman',pronouns:'they/them',notes:'A silver-haired guide in a green coat.',secret:'SECRET_SENTINEL: secretly a dragon',revealAct:2}];secOpen.npcs=true;__bpdTest.rerender();document.querySelector('[data-sec="npc"]').closest('.card').scrollIntoView({block:'center'});});
await page.screenshot({path:path.join(out,'npc-card-before.png')});if(process.env.NPC_PORTRAIT_BEFORE==='1'){console.log('Captured NPC card before portraits');return;}
assert(await page.evaluate(()=>!!document.querySelector('[data-op="npcportrait"]')),'NPC cards offer individual portrait generation');
await page.locator('[data-op="npcportrait"]').click();await page.waitForFunction(()=>!!bp.npcs[0].portrait);
assert(await page.evaluate(()=>{const saved=bp.npcs[0].portrait;applyPatches(bp,[{section:'npcs',name:'Fen Keeper',item:{name:'Fen Keeper',role:'guide',pronouns:'they/them',notes:'A silver-haired guide.',secret:'SECRET_SENTINEL',revealAct:2,portrait:'https://fake.example/replacement.png'}}]);return bp.npcs[0].portrait===saved&&!JSON.stringify(DesignerCreatures.textBlueprint(bp)).includes(saved);}),'NPC text fixes preserve portraits and exclude image bytes');
await page.evaluate(()=>{const out=__bpdTest.out();__bpdTest.load(out);secOpen.npcs=true;bp.npcs[0]._c=false;__bpdTest.rerender();document.querySelector('[data-op="npcportraitview"]').closest('.card').scrollIntoView({block:'center'});});assert(await page.evaluate(()=>bp.npcs[0].portrait.startsWith('data:image/jpeg;base64,')),'NPC portrait survives file reload');
await page.screenshot({path:path.join(out,'npc-card-desktop.png')});await page.locator('[data-op="npcportraitview"]').click();await page.waitForFunction(()=>document.querySelector('#creature-image-size').textContent.includes('400 × 533'));await page.locator('#creature-image-close').click();
await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.querySelector('[data-op="npcportrait"]').closest('.card').scrollIntoView({block:'start'});window.scrollBy(0,-document.getElementById('topbar').getBoundingClientRect().height-12);});await page.evaluate(()=>document.querySelector('[data-op="npcportraitview"]').scrollIntoView({block:'center'}));await page.screenshot({path:path.join(out,'npc-card-mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'NPC card fits phone viewport');
await page.locator('[data-op="npcportraitremove"]').click();assert(await page.evaluate(()=>!bp.npcs[0].portrait&&!document.querySelector('[data-op="npcportraitview"]')),'NPC portrait removal updates card and saved data');

await page.setViewportSize({width:1050,height:900});
await page.evaluate(()=>{
  window.proseOriginal="The employer who hired the Red Ledger, a vault-city magistrate of Two Thrones. Her official story is that the reliquary is an ancestral relic she recovered at Kalgra's Rest and is returning for reburial in the lower reliquary-vault beneath the eastern mesa, which she names as the delivery destination from the outset. In public introductions and documents, use only Consul Y. Marrow. She accompanies the caravan through the first ambush. When the cracked reliquary addresses her as 'Ysbet,' she visibly flinches and demands to know how it knows her. She surfaces as untrustworthy the moment the company asks pointed questions about what's actually inside: under such questioning she drops the cover story and admits the truth (see secret), but she continues to honor the contract's payment and, in particular, its safe-passage promise.";
  proseOriginal=proseOriginal.repeat(5);
  window.proseRevision="Consul Y. Marrow, a Two Thrones magistrate, hires the Red Ledger and joins them through the first ambush. She claims the ancestral reliquary came from Kalgra's Rest and names the lower reliquary-vault beneath the eastern mesa as its reburial destination. Introductions and documents use only Consul Y. Marrow. Called 'Ysbet' by the cracked reliquary, she flinches and demands how it knows her. Pressed about its contents, she abandons her cover story and admits the truth (see secret), while honoring payment and safe passage.";
  __bpdTest.load({format:'tnd-blueprint-v1',name:'Full prose',premise:'A caravan journey.',acts:[{title:'The road',goal:'Reach the mesa.',arcs:[{title:'Journey',objective:'Travel safely.'}]}],npcs:[{name:'Consul Y. Marrow',notes:proseOriginal}],creatures:[],rules:[]});secOpen.npcs=true;bp.npcs[0]._c=false;__bpdTest.rerender();
});
assert.equal(await page.evaluate(()=>bp.npcs[0].notes.length),4180,'loaded NPC notes preserve the exact reported tail beyond the field cap');
assert(await page.evaluate(()=>designerValidate().includes('text limits')),'overlong drafts cannot be published as ready');
await page.locator('[data-op="breakout"][data-bsec="npc"][data-bk="notes"]').click();
assert(await page.evaluate(()=>document.querySelector('#bo-ta').value.endsWith('safe-passage promise.')),'breakout retains the complete final sentence');
await page.screenshot({path:path.join(out,'full-npc-before-shortening.png')});await page.locator('#bo-done').click();
await page.evaluate(()=>{window.proseCalls=0;callGM=async(msg,sys,tokens,model,opts)=>{proseCalls++;if(!msg.includes(proseOriginal)||!opts.noHistory)throw Error('Missing full original or utility isolation');return JSON.stringify({text:proseRevision});};});
await designerFileClick(page,'btn-fit-text');await page.waitForFunction(()=>!proseFitJob&&bp.npcs[0].notes===proseRevision);
assert.equal(await page.evaluate(()=>proseCalls),1);assert(await page.evaluate(()=>bp._textOriginal[0].text===proseOriginal&&!JSON.stringify(__bpdTest.out()).includes('_textOriginal')),'full originals retained locally and excluded from playable files');
await page.locator('[data-op="breakout"][data-bsec="npc"][data-bk="notes"]').click();await page.screenshot({path:path.join(out,'complete-npc-after-shortening.png')});await page.locator('#bo-done').click();
await page.evaluate(()=>{bp.npcs[0].notes=proseOriginal;callGM=async()=>JSON.stringify({text:'This revision ends in p'});markDirty();});await designerFileClick(page,'btn-fit-text');await page.waitForFunction(()=>!proseFitJob&&document.querySelector('#statusline').textContent.includes('kept in full'));
assert(await page.evaluate(()=>bp.npcs[0].notes===proseOriginal),'failed revision never clips the draft');
await page.evaluate(()=>{callGM=()=>new Promise(r=>window.releaseProse=r);});await designerFileClick(page,'btn-fit-text');await page.waitForFunction(()=>!!window.releaseProse);
await page.evaluate(()=>{bp.npcs[0].notes='An intentional manual edit.';markDirty();releaseProse(JSON.stringify({text:proseRevision}));});await page.waitForFunction(()=>!proseFitJob);
assert.equal(await page.evaluate(()=>bp.npcs[0].notes),'An intentional manual edit.','late revision never replaces a newer manual edit');
await page.evaluate(()=>{bp.npcs[0].notes=proseOriginal;markDirty();});await page.evaluate(()=>designerDrafts.flush());assert(await page.evaluate(async()=>(await designerDraftStore.recovery()).saved.payload.bp.npcs[0].notes===proseOriginal),'durable draft retains full original prose');
await page.goto('http://creature.test/blueprint-designer.html');await page.waitForFunction(()=>window.__bpdTest);
assert(await page.evaluate(()=>bp.npcs[0].notes.endsWith('safe-passage promise.')&&bp.npcs[0].notes.length===4180),'reopening the auto-saved draft never clips it');


await page.evaluate(async()=>{
  window.fullApplyText=bp.npcs[0].notes;bp.npcs[0].notes='An employer.';bp.review={findings:[{section:'npcs',issue:'Preserve the full magistrate description',fixes:['Write the full description.'],_sel:0}]};window.applyCalls=0;
  callGM=async(msg,sys)=>{applyCalls++;return JSON.stringify(sys.indexOf('You edit TTRPG')===0?{patches:[{section:'npcs',name:'Consul Y. Marrow',item:{name:'Consul Y. Marrow',notes:fullApplyText}}]}:{text:'Consul Y. Marrow pays the caravan and guarantees safe passage.'});};
  await applyFinding(0);
});
assert(await page.evaluate(()=>applyCalls===2&&bp.npcs[0].notes==='Consul Y. Marrow pays the caravan and guarantees safe passage.'&&bp._textOriginal[0].text===fullApplyText),'AI fixes draft in full then revise before finalizing');
await page.evaluate(()=>{window.catalogWrites=0;storageAdapter.listBlueprintCatalog=cb=>cb(null,[]);storageAdapter.publishBlueprintToCatalog=()=>catalogWrites++;openCatalogPublish();});
await page.waitForSelector('#catalog-publish-dialog');await page.locator('#catalog-blurb').fill('A caravan journey.');
await page.evaluate(()=>{bp.npcs[0].notes=fullApplyText;});await page.locator('#catalog-confirm').click();
assert(await page.evaluate(()=>catalogWrites===0&&document.querySelector('#catalog-publish-error').textContent.includes('text limits')),'catalog rechecks text limits at confirmation after a draft changes');
await page.locator('#catalog-cancel').click();
// The reported fresh portraits: actual outbound bodies, intercepted before any paid endpoint.
const portraitCases=[
 {name:'Frog-Eyed Reedjumper',displayName:'Bog Herald',desc:'A compact humanoid fey with a youthful humanlike face, a small human nose; no frog head or amphibian muzzle.'},
 {name:'Squirrel-Tailed Branchrunner',desc:'A small humanoid fey with a lively humanlike face, round cheeks, a tiny human nose; no rodent muzzle or projecting incisors.'}
];
for(const c of portraitCases){
 await page.evaluate(async entry=>{entry.notes='PRIVATE_PORTRAIT_SENTINEL';bp.creatures.push(entry);await generateDesignerPortrait('creature',entry,document.createElement('button'));},c);
 const body=portraitBodies.at(-1);assert(/55mm lens at f\/1\.8/.test(body.prompt)&&/background.*softly blurred.*bokeh/.test(body.prompt),'#729 public creature request carries shallow focus through the image boundary');assert(body.prompt.includes(c.desc)&&!body.prompt.includes(c.name)&&(!c.displayName||!body.prompt.includes(c.displayName))&&!body.prompt.includes('PRIVATE_PORTRAIT_SENTINEL'),'#726 outgoing creature request preserves appearance and omits names');assert(!body.image_url&&!body.image_urls,'#726 a fresh portrait has no previous-image reference');
 assert(await page.evaluate(name=>bp.creatures.some(c=>c.name===name&&c.portrait),c.name),'#726 portrait attaches without changing creature identity');
}
// #726's name guard reads FIRST: #731's filter below finds its bodies by the same name, so a dropped name tripped #731's message and the #726 battery's clause was MISATTRIBUTED (CI red since 5f9838d2).
assert(portraitBodies.some(b=>b.prompt.includes('Character portrait of Fen Keeper.')),'#726 NPC character portrait requests retain their names');
// #731 owner changed the NPC composition contract: the same lens/blur is required now.
const npcBodies=portraitBodies.filter(b=>b.prompt.includes('Character portrait of Fen Keeper.'));
assert(npcBodies.length>0&&npcBodies.every(b=>b.prompt.split('55mm lens at f/1.8').length-1===1&&/background.*softly blurred.*bokeh/.test(b.prompt)),'#731 NPC outgoing requests include one lens clause and a blurred background');
assert(portraitBodies.length>0&&portraitBodies.every(b=>!/ultra-detailed leather and cloth textures|realistic skin pores and fabric weave/.test(b.prompt)),'#731 all outgoing portraits omit forced material textures');
assert.deepEqual(errors,[]);console.log('PASS CREATURE BROWSER: controls, mobile, count rejection, batch, portrait layout and enlargement, focus, reload, Apply preservation, failure, cancel, and NPC generation/view/reload/removal. Screenshots: '+out);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
