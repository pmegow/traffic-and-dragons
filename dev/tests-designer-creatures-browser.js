// Actual Designer page, synthetic model and image responses; no credentials or live writes.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),cp=require('child_process');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..'),out=path.join(process.env.TEMP||require('os').tmpdir(),'tnd-creature-designer');fs.mkdirSync(out,{recursive:true});
const before=process.env.CREATURE_BEFORE==='1';
(async()=>{const browser=await chromium.launch({headless:true});try{
const context=await browser.newContext({viewport:{width:1050,height:900},serviceWorkers:'block'});
await context.addInitScript(()=>{localStorage.setItem('tnd_server_url_v1','http://creature.test');localStorage.setItem('tnd_server_tok_v1','fixture');});
let calls=[],images=0,fail=false,hold=false,release,png='';const errors=[];
await context.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());if(url.hostname!=='creature.test')return route.abort();
 const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(url.pathname==='/api/account')return json({isAdmin:false,entitled:true});
 if(url.pathname.startsWith('/api/llm/')){
  calls.push(req.postDataJSON());if(hold)await new Promise(r=>release=r);
  if(fail)return json({error:'Fixture provider refusal'},400);
  return json({content:[{type:'text',text:JSON.stringify({name:'Lantern moth '+calls.length,notes:'A luminous moth feeds on guttering candles. It hides beneath leaves at dawn.',kind:'wrong',threat:'wrong'})}],usage:{input_tokens:1,output_tokens:1}});
 }
 if(url.pathname.startsWith('/api/render/')){images++;assert(/Lantern moth|Fen Keeper/.test(req.postDataJSON().prompt));assert(!req.postDataJSON().prompt.includes('SECRET_SENTINEL'));return json({images:[{url:'https://creature.test/portrait.png'}]});}
 if(url.pathname==='/portrait.png')return route.fulfill({status:200,contentType:'image/png',body:Buffer.from(png.split(',')[1],'base64')});
 let file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep))return route.abort();
 try{const data=before&&url.pathname==='/blueprint-designer.html'?cp.execFileSync('git',['show','HEAD:blueprint-designer.html'],{cwd:root}):fs.readFileSync(file);return route.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/javascript',body:data});}catch{return route.fulfill({status:404,body:'Missing fixture'});}
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://creature.test/blueprint-designer.html');await page.waitForFunction(()=>window.__bpdTest);
// A loaded (imported) note over the 800-character field cap: an AI write elsewhere must leave it whole and spend nothing on it
// (#547's own contract — "imported/manual text stays whole with an explicit shortening control"; the G5 waits suite found the
// automatic pass shortening the whole blueprint after one creature landed).
const importedLong='The warden walks the causeway every dusk with a shuttered lamp and a ledger of lights. '.repeat(11);
await page.evaluate(long=>{__bpdTest.load({format:'tnd-blueprint-v1',name:'The Lantern Fen',premise:'A marsh village loses its lights each night.',acts:[],npcs:[{name:'Marsh Warden',role:'keeper of the causeway lights',notes:long}],locations:[],creatures:[],rules:[]});secOpen.creatures=true;__bpdTest.rerender();},importedLong);
assert(importedLong.length>800&&await page.evaluate(()=>bp.npcs[0].notes.length>800),'loaded NPC notes preserve the exact reported tail beyond 800 — the fixture note must still overflow after load');
await page.evaluate(()=>document.querySelector('[data-op="gencreature"]').scrollIntoView({block:'center'}));
if(before){await page.screenshot({path:path.join(out,'before.png')});console.log('PASS before: original immediate-generation button captured');return;}
await page.locator('[data-op="gencreature"]').click();assert.equal(calls.length,0,'opening the modal must not spend a model request');
await page.waitForSelector('#creature-gen-modal');
await page.locator('#creature-count').fill('3');await page.locator('#creature-kind').selectOption('Beast');await page.locator('#creature-threat').selectOption('Safe');await page.locator('#creature-frequency').selectOption('rare');await page.locator('#creature-treasure').selectOption('Crafting materials');
await page.screenshot({path:path.join(out,'modal-desktop.png')});
await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'modal-mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'modal has no horizontal overflow');
await page.locator('#creature-count').fill('1.5');await page.locator('#creature-gen-go').click();assert.equal(calls.length,0,'fractional counts blocked before network');
await page.locator('#creature-count').fill('3');await page.locator('#creature-gen-go').click();await page.waitForFunction(()=>__bpdTest.getBp().creatures.length===3);
assert.equal(calls.length,3,'three creatures cost three calls — the imported note was not sent for shortening');assert.equal(await page.evaluate(()=>bp.npcs[0].notes),importedLong,'an AI write never shortens text it did not write');assert(await page.evaluate(()=>document.activeElement.getAttribute('data-op')==='gencreature'),'focus returns to the rebuilt opener');assert.equal(images,0,'text generation never auto-generates portraits');
assert(await page.evaluate(()=>__bpdTest.getBp().creatures.every(c=>c.kind==='Beast'&&c.threat==='Safe'&&c.notes.indexOf('Frequency: rare.')===0)));
await page.setViewportSize({width:1050,height:900});
png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1024;const ctx=canvas.getContext('2d');ctx.fillStyle='#133942';ctx.fillRect(0,0,768,1024);ctx.fillStyle='#eadf9d';ctx.beginPath();ctx.ellipse(384,512,260,115,0,0,Math.PI*2);ctx.fill();return canvas.toDataURL('image/png');});
await page.locator('[data-op="creatureportrait"]').nth(0).click();await page.waitForFunction(()=>!!__bpdTest.getBp().creatures[0].portrait);assert.equal(images,1);
const portrait=await page.evaluate(()=>__bpdTest.out().creatures[0].portrait);assert(portrait.startsWith('data:image/jpeg;base64,'),'portrait is embedded and compressed');
assert(await page.evaluate(()=>{const old=bp.creatures[0].portrait;applyPatches(bp,[{section:'creatures',name:bp.creatures[0].name,item:{name:bp.creatures[0].name,kind:'Beast',threat:'Safe',notes:'Frequency: rare. Revised.'}}]);return bp.creatures[0].portrait===old&&!JSON.stringify(DesignerCreatures.textBlueprint(bp)).includes(old);}),'Apply preserves portrait while text payload excludes it');
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
await page.evaluate(()=>{bp.acts=[1,2].map(n=>({title:'Fen chapter '+n,goal:'Explore the marsh.',arcs:[{title:'Meet the guide',objective:'Learn about the marsh.'}]}));bp.npcs=[{name:'Fen Keeper',role:'ferryman',pronouns:'they/them',notes:'A silver-haired guide in a green coat.',secret:'SECRET_SENTINEL: secretly a dragon',revealAct:2}];secOpen.npcs=true;__bpdTest.rerender();document.querySelector('[data-sec="npc"]').closest('.card').scrollIntoView({block:'center'});});
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
  window.proseRevision="Consul Y. Marrow, a Two Thrones magistrate, hires the Red Ledger and joins them through the first ambush. She claims the ancestral reliquary came from Kalgra's Rest and names the lower reliquary-vault beneath the eastern mesa as its reburial destination. Introductions and documents use only Consul Y. Marrow. Called 'Ysbet' by the cracked reliquary, she flinches and demands how it knows her. Pressed about its contents, she abandons her cover story and admits the truth (see secret), while honoring payment and safe passage.";
  __bpdTest.load({format:'tnd-blueprint-v1',name:'Full prose',premise:'A caravan journey.',acts:[{title:'The road',goal:'Reach the mesa.',arcs:[{title:'Journey',objective:'Travel safely.'}]}],npcs:[{name:'Consul Y. Marrow',notes:proseOriginal}],creatures:[],rules:[]});secOpen.npcs=true;bp.npcs[0]._c=false;__bpdTest.rerender();
});
assert.equal(await page.evaluate(()=>bp.npcs[0].notes.length),836,'loaded NPC notes preserve the exact reported tail beyond 800');
assert(await page.evaluate(()=>designerValidate().includes('text limits')),'overlong drafts cannot be published as ready');
await page.locator('[data-op="breakout"][data-bsec="npc"][data-bk="notes"]').click();
assert(await page.evaluate(()=>document.querySelector('#bo-ta').value.endsWith('safe-passage promise.')),'breakout retains the complete final sentence');
await page.screenshot({path:path.join(out,'full-npc-before-shortening.png')});await page.locator('#bo-done').click();
await page.evaluate(()=>{window.proseCalls=0;callGM=async(msg,sys,tokens,model,opts)=>{proseCalls++;if(!msg.includes(proseOriginal)||!opts.noHistory)throw Error('Missing full original or utility isolation');return JSON.stringify({text:proseRevision});};});
await page.locator('#btn-fit-text').click();await page.waitForFunction(()=>!proseFitJob&&bp.npcs[0].notes===proseRevision);
assert.equal(await page.evaluate(()=>proseCalls),1);assert(await page.evaluate(()=>bp._textOriginal[0].text===proseOriginal&&!JSON.stringify(__bpdTest.out()).includes('_textOriginal')),'full originals retained locally and excluded from playable files');
await page.locator('[data-op="breakout"][data-bsec="npc"][data-bk="notes"]').click();await page.screenshot({path:path.join(out,'complete-npc-after-shortening.png')});await page.locator('#bo-done').click();
await page.evaluate(()=>{bp.npcs[0].notes=proseOriginal;callGM=async()=>JSON.stringify({text:'This revision ends in p'});markDirty();});await page.locator('#btn-fit-text').click();await page.waitForFunction(()=>!proseFitJob&&document.querySelector('#statusline').textContent.includes('kept in full'));
assert(await page.evaluate(()=>bp.npcs[0].notes===proseOriginal),'failed revision never clips the draft');
await page.evaluate(()=>{callGM=()=>new Promise(r=>window.releaseProse=r);});await page.locator('#btn-fit-text').click();await page.waitForFunction(()=>!!window.releaseProse);
await page.evaluate(()=>{bp.npcs[0].notes='An intentional manual edit.';markDirty();releaseProse(JSON.stringify({text:proseRevision}));});await page.waitForFunction(()=>!proseFitJob);
assert.equal(await page.evaluate(()=>bp.npcs[0].notes),'An intentional manual edit.','late revision never replaces a newer manual edit');
await page.evaluate(()=>{bp.npcs[0].notes=proseOriginal;markDirty();});await page.waitForFunction(()=>JSON.parse(localStorage.getItem('bpd_draft_v1')).bp.npcs[0].notes===proseOriginal);
await page.goto('http://creature.test/blueprint-designer.html');await page.waitForFunction(()=>window.__bpdTest);
assert(await page.evaluate(()=>bp.npcs[0].notes.endsWith('safe-passage promise.')&&bp.npcs[0].notes.length===836),'reopening the auto-saved draft never clips it');


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
assert.deepEqual(errors,[]);console.log('PASS CREATURE BROWSER: controls, mobile, count rejection, batch, portrait layout and enlargement, focus, reload, Apply preservation, failure, cancel, and NPC generation/view/reload/removal. Screenshots: '+out);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
