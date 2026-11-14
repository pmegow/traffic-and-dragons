// Real Designer and image request path with fixture responses; no paid requests.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js'),{designerFileClick,designerFileOpen}=require('./designer-browser-actions.js');
const root=path.resolve(__dirname,'..'),shots=process.env.MISSING_PORTRAIT_SCREENSHOTS||path.join(root,'testRuns/portrait-732');
fs.mkdirSync(shots,{recursive:true});
const filter=process.argv.includes('--only')?process.argv[process.argv.indexOf('--only')+1]:null;
(async()=>{const browser=await chromium.launch({headless:true});try{
 const ctx=await browser.newContext({viewport:{width:1050,height:900},serviceWorkers:'block'}),page=await ctx.newPage(),errors=[],requests=[];
 let png='',holdNext=false,release=null,refuse=false,active=0,peak=0,ran=0;
 await ctx.addInitScript(()=>{localStorage.setItem('tnd_server_url_v1','http://portraits.test');localStorage.setItem('tnd_server_tok_v1','fixture');});
 await ctx.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());
  if(u.hostname!=='portraits.test')return route.abort();
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(u.pathname==='/api/account')return json({isAdmin:false,entitled:true});
  if(u.pathname.startsWith('/api/render/')){requests.push({url:req.url(),body:req.postDataJSON()});active++;peak=Math.max(peak,active);
   if(holdNext){holdNext=false;await new Promise(r=>release=r);release=null;}
   active--;if(refuse){refuse=false;return json({error:'Fixture portrait refusal'},400);}
   return json({images:[{url:'https://portraits.test/portrait.png'}]});
  }
  if(u.pathname==='/portrait.png')return route.fulfill({status:200,contentType:'image/png',body:Buffer.from(png.split(',')[1],'base64')});
  const f=path.resolve(root,'.'+u.pathname);if(!f.startsWith(root+path.sep))return route.abort();
  try{return route.fulfill({status:200,contentType:f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(f)});}catch{return route.fulfill({status:404,body:'Missing fixture'});}
 });
 page.on('pageerror',e=>errors.push(e.message));await page.goto('http://portraits.test/blueprint-designer.html');await page.waitForFunction(()=>window.__bpdTest);
 png=await page.evaluate(()=>{var c=document.createElement('canvas');c.width=600;c.height=800;c.getContext('2d').fillRect(0,0,600,800);return c.toDataURL();});
 const creature=(name,extra={})=>({name,notes:'A marsh guard.',desc:'APPEARANCE_'+name,...extra}),npc=(name,extra={})=>({name,notes:'A willow-shaped guide.',...extra});
 async function load(creatures=[],npcs=[]){requests.length=0;peak=0;refuse=false;holdNext=false;release=null;await page.evaluate(({creatures,npcs})=>{__bpdTest.load({format:'tnd-blueprint-v1',name:'Portrait batch',premise:'A marsh journey.',acts:[{title:'The marsh',goal:'Explore',arcs:[{title:'The path',objective:'Travel'}]}],creatures,npcs,locations:[],rules:[]});renderModel=RENDER_MODELS.filter(m=>!m.slow)[0].id;secOpen.creatures=false;secOpen.npcs=false;render();}, {creatures,npcs});await page.evaluate(()=>designerDrafts.flush());}
 async function start(){await designerFileClick(page,'btn-render-missing');}
 async function settled(){await page.waitForFunction(()=>!designerPortraitBatch&&!creaturePortraitJobs.length);}
 async function held(){for(let i=0;i<200&&!release;i++)await new Promise(r=>setTimeout(r,10));assert(release,'image request must reach the fixture provider');}
 async function test(name,fn){if(filter&&filter!==name)return;ran++;try{await fn();console.log('PASS #732 '+name);}catch(e){console.error('FAIL #732 '+name);await page.screenshot({path:path.join(shots,'failure.png')});throw e;}}
 await test('File menu exposes missing portraits on desktop and phone',async()=>{
  await load();await designerFileOpen(page);await page.screenshot({path:path.join(shots,'menu-desktop.png')});
  assert.equal(await page.locator('#btn-render-missing').count(),1,'Render all missing portraits action missing');
  assert.equal(await page.locator('#btn-render-missing').innerText(),'Render all missing portraits');
  assert(await page.evaluate(()=>document.getElementById('designer-file-panel').contains(document.getElementById('btn-render-missing'))));
  await page.setViewportSize({width:390,height:667});await page.screenshot({path:path.join(shots,'menu-phone.png')});
  assert(await page.evaluate(()=>{var r=document.getElementById('btn-render-missing').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth;}),'action visible on a phone');
  await page.setViewportSize({width:1050,height:900});
 });
 await test('only missing NPC and creature portraits render and survive autosave',async()=>{
  await load([creature('SavedCreature',{portrait:png}),creature('NewCreature')],[npc('Saved NPC',{portrait:png}),npc('New NPC')]);
  holdNext=true;await start();await held();assert.match(await page.locator('#statusline').innerText(),/1\/2/,'progress counts only missing portraits');release();await settled();assert.equal(requests.length,2,'exactly the two missing portraits');assert.equal(peak,1,'requests stay serial');
  assert(requests.some(r=>r.body.prompt.includes('APPEARANCE_NewCreature'))&&requests.some(r=>r.body.prompt.includes('Character portrait of New NPC.')));
  const model=await page.evaluate(()=>renderModel);assert(requests.every(r=>r.url.endsWith('/'+model)),'selected image model is used');
  assert(requests.every(r=>r.body.prompt.includes('55mm lens at f/1.8')),'batch preserves existing prompt builders');
  assert(await page.evaluate(saved=>bp.creatures[0].portrait===saved&&bp.npcs[0].portrait===saved,png),'existing portrait bytes unchanged');
  assert(await page.evaluate(()=>bp.creatures[1].portrait.startsWith('data:image/jpeg;base64,')&&bp.npcs[1].portrait.startsWith('data:image/jpeg;base64,')));
  assert.match(await page.locator('#statusline').innerText(),/2 rendered.*0 failed/);
  await page.evaluate(()=>designerDrafts.flush());await page.reload();await page.waitForFunction(()=>window.__bpdTest);
  assert(await page.evaluate(saved=>bp.creatures[0].portrait===saved&&bp.npcs[0].portrait===saved&&bp.creatures[1].portrait&&bp.npcs[1].portrait,png),'batch and old portraits survive reopening the draft');
  assert(await page.evaluate(()=>dirty),'portrait changes remain marked unsaved after draft reopening');
  await start();await settled();assert.equal(requests.length,2,'rerunning a complete blueprint spends nothing');assert.match(await page.locator('#statusline').innerText(),/No missing portraits/);
 });
 await test('progress ticks and Stop keeps the current result without launching more',async()=>{
  await load([creature('First'),creature('Second')],[npc('Third')]);holdNext=true;await start();await held();
  const early=await page.locator('#statusline').innerText();await new Promise(r=>setTimeout(r,1150));const later=await page.locator('#statusline').innerText();assert.notEqual(early,later,'elapsed time advances');assert.match(later,/1\/3.*First/);
  await designerFileOpen(page);await page.screenshot({path:path.join(shots,'running.png')});assert.match(await page.locator('#btn-render-missing').innerText(),/^Stop/);await start();assert.match(await page.locator('#statusline').innerText(),/Stopping after the current portrait/);
  release();await settled();assert.equal(requests.length,1,'Stop prevents subsequent requests');assert(await page.evaluate(()=>bp.creatures[0].portrait&&!bp.creatures[1].portrait&&!bp.npcs[0].portrait),'current result retained');assert.match(await page.locator('#statusline').innerText(),/stopped.*1 rendered/i);
  await start();await settled();assert.equal(requests.length,3,'retry renders only the two still missing');
 });
 await test('failure identifies the entry and later entries still render',async()=>{
  await load([creature('Failed'),creature('Later')]);refuse=true;await start();await settled();assert.equal(requests.length,2);assert(await page.evaluate(()=>!bp.creatures[0].portrait&&!!bp.creatures[1].portrait));
  assert.match(await page.locator('#statusline').innerText(),/1 rendered.*1 failed.*Failed.*Fixture portrait refusal/);
  await start();await settled();assert.equal(requests.length,3,'retry attempts only the failed portrait');assert(await page.evaluate(()=>!!bp.creatures[0].portrait));
 });
 await test('queued entries gained portraits or removed are skipped before spending',async()=>{
  await load([creature('First'),creature('NewlyFilled'),creature('Removed')],[npc('Last')]);holdNext=true;await start();await held();
  await page.evaluate(saved=>{bp.creatures[1].portrait=saved;bp.creatures.splice(2,1);},png);release();await settled();assert.equal(requests.length,2,'skip changed queue entries before their requests');assert(await page.evaluate(saved=>bp.creatures[1].portrait===saved&&!!bp.npcs[0].portrait,png));
 });
 await test('an image added during rendering is never overwritten',async()=>{
  await load([creature('First')]);holdNext=true;await start();await held();await page.evaluate(saved=>bp.creatures[0].portrait=saved,png);release();await settled();assert(await page.evaluate(saved=>bp.creatures[0].portrait===saved,png),'late render must preserve the newly present image');
 });
 await test('switching blueprints stops the queue and discards its late image',async()=>{
  await load([creature('OldFirst'),creature('OldSecond')]);holdNext=true;await start();await held();await page.evaluate(()=>{window.oldPortraitTarget=bp;__bpdTest.load({format:'tnd-blueprint-v1',name:'Other blueprint',creatures:[{name:'Other',notes:'A fox.'}],npcs:[],acts:[],rules:[]});});release();await settled();assert.equal(requests.length,1,'no paid requests after blueprint replacement');assert(await page.evaluate(()=>bp.name==='Other blueprint'&&!bp.creatures[0].portrait&&!oldPortraitTarget.creatures[0].portrait));assert.match(await page.locator('#statusline').innerText(),/blueprint changed/i);
 });
 await test('empty invalid and busy entries never create duplicate requests',async()=>{
  await load();await start();await settled();assert.equal(requests.length,0);assert.match(await page.locator('#statusline').innerText(),/No missing portraits/);
  await load([creature('Busy'),creature('NoNotes',{notes:''})],[npc('Valid')]);await page.evaluate(()=>creaturePortraitJobs.push(bp.creatures[0]));await start();await page.waitForFunction(()=>!designerPortraitBatch);assert.equal(requests.length,1);assert.match(await page.locator('#statusline').innerText(),/NoNotes.*name and notes/);await page.evaluate(()=>creaturePortraitJobs.length=0);
 });
 await test('#743 the batch fills a missing alternate only where an alternate appearance is written',async()=>{
  await load([creature('Formed',{portrait:png,altDesc:'ALT_APPEARANCE_Formed'}),creature('Plain',{portrait:png}),creature('Done',{portrait:png,altPortrait:png,altDesc:'ALT_APPEARANCE_Done'})],[npc('Sage',{altDesc:'ALT_APPEARANCE_Sage'})]);
  await start();await settled();assert.equal(requests.length,3,'the creature\'s alternate, the NPC\'s true form and its alternate: '+requests.map(r=>r.body.prompt.slice(0,60)).join(' | '));
  const alts=requests.filter(r=>/ALT_APPEARANCE_/.test(r.body.prompt));assert.equal(alts.length,2);assert(alts.every(r=>!/marsh guard|willow-shaped|APPEARANCE_Formed A|Formed|Sage\./.test(r.body.prompt.replace(/ALT_APPEARANCE_\w+/,''))),'an alternate prompt carries the alternate appearance alone');
  assert(await page.evaluate(saved=>bp.creatures[0].portrait===saved&&bp.creatures[0].altPortrait.startsWith('data:image/jpeg;base64,')&&!bp.creatures[1].altPortrait&&bp.creatures[2].altPortrait===saved&&!!bp.npcs[0].portrait&&!!bp.npcs[0].altPortrait,png),'each image lands in its own slot; existing bytes are untouched');
  assert.match(await page.locator('#statusline').innerText(),/3 rendered.*0 failed/);await start();await settled();assert.equal(requests.length,3,'a complete blueprint spends nothing');
 });
 await test('#743 the card authors the alternate form: fields, the starting form, both slots, the legacy move',async()=>{
  await load([creature('Hag',{displayName:'Woman',desc:'A fair woman in grey.',portrait:png})],[npc('Sage')]);await page.evaluate(()=>{bp.creatures[0]._c=false;bp.npcs[0]._c=false;secOpen.creatures=true;secOpen.npcs=true;render();});
  assert.equal(await page.locator('details.form-block').count(),2,'every creature and NPC card has the block');assert(await page.evaluate(()=>document.querySelector("details[data-form='creature']").open&&!document.querySelector("details[data-form='npc']").open),'open only where an alternate exists');
  assert.equal(await page.evaluate(()=>document.querySelector("input[name='starts-creature-0']:checked").value),'alternate','a legacy disguise shows the engine\'s default');assert.equal(await page.evaluate(()=>'startsAs' in bp.creatures[0]),false,'showing a default writes nothing');
  await page.locator("[data-op='formmove']").click();assert(await page.evaluate(saved=>{var c=bp.creatures[0];return c.altDesc==='A fair woman in grey.'&&c.altPortrait===saved&&!('desc' in c)&&!('portrait' in c)&&dirty;},png),'the move carries the description and its portrait');assert.equal(await page.locator("[data-op='formmove']").count(),0);assert.match(await page.locator('#statusline').innerText(),/Moved the description and its portrait/);
  await page.locator("input[name='starts-creature-0'][value='story']").check();assert.equal(await page.evaluate(()=>bp.creatures[0].startsAs),'story');
  await page.locator("details[data-form='npc'] summary").click();await page.locator("textarea[data-sec='npc'][data-k='altDesc']").fill('A young knight in mail.');await page.locator("textarea[data-sec='npc'][data-k='altWhen']").fill('At moonrise.');await page.locator("input[name='starts-npc-0'][value='alternate']").check();
  assert.deepEqual(await page.evaluate(()=>[bp.npcs[0].altDesc,bp.npcs[0].altWhen,bp.npcs[0].startsAs]),['A young knight in mail.','At moonrise.','alternate']);assert(!await page.evaluate(()=>designerValidate()),'the authored forms pass the engine\'s validation');
  requests.length=0;await page.locator("[data-op='npcaltportrait']").click();await settled();assert.equal(requests.length,1);assert(requests[0].body.prompt.includes('A young knight in mail.')&&!requests[0].body.prompt.includes('willow-shaped')&&!requests[0].body.prompt.includes('Sage'),'the alternate is drawn from its appearance alone');
  assert(await page.evaluate(()=>bp.npcs[0].altPortrait.startsWith('data:image/jpeg;base64,')&&!bp.npcs[0].portrait),'the image lands in the alternate slot only');assert.equal(await page.locator("[data-op='npcaltportraitview']").count(),1);
  await page.locator("[data-op='npcaltportraitview']").click();await page.waitForFunction(()=>/pixels/.test((document.querySelector('#creature-image-size')||{}).textContent||''));await page.locator('#creature-image-close').click();
  const out=await page.evaluate(()=>__bpdTest.out());assert.equal(out.creatures[0].startsAs,'story');assert(out.creatures[0].altPortrait&&out.npcs[0].altPortrait&&out.npcs[0].altWhen==='At moonrise.','the saved file carries both forms');
  await page.screenshot({path:path.join(shots,'forms-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:760});await page.evaluate(()=>document.querySelector("details[data-form='creature']").scrollIntoView());await page.screenshot({path:path.join(shots,'forms-phone.png')});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll on a phone');await page.setViewportSize({width:1050,height:900});
  await page.locator("[data-op='npcaltportraitremove']").click();assert.equal(await page.evaluate(()=>'altPortrait' in bp.npcs[0]),false);assert(await page.evaluate(()=>bp.creatures[0].altPortrait.length>0),'removing one alternate leaves the others');
 });
 await test('missing image access is reported before any request',async()=>{
  await load([creature('First')]);await page.evaluate(()=>{window.oldFalAvailable=falAvailable;falAvailable=()=>false;});await start();await settled();assert.equal(requests.length,0);assert.match(await page.locator('#statusline').innerText(),/Sign in.*image key/);await page.evaluate(()=>falAvailable=oldFalAvailable);
 });
 if(!ran)throw Error('matched 0 tests');assert.deepEqual(errors,[]);console.log('MISSING PORTRAITS GREEN: '+ran+' groups');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
