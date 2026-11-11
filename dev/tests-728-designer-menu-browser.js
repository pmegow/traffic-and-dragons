// Designer toolbar and actual outgoing portrait bodies; synthetic providers, no paid calls.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=process.cwd(),shots=process.env.MENU_SCREENSHOTS||path.join(root,'testRuns/portrait-727');fs.mkdirSync(shots,{recursive:true});
const sun='openai/gpt-image-2.6/sunburst/text-to-image',flare='openai/gpt-image-2.5/flare/text-to-image';
const appearance='A lean humanoid fey with a mischievous humanlike face, pointed chin, arched brows, and a small human nose; no fox muzzle. Russet fur edges their temples beneath large fox ears, and one brush tail curls behind them. A patched moss-green cloak, curled leather seams, and seedpod fastenings conceal a short sword and a weathered signal whistle.';
(async()=>{const browser=await chromium.launch({headless:true});try{
 const context=await browser.newContext({viewport:{width:1050,height:900},serviceWorkers:'block'}),requests=[],errors=[];let png='';
 await context.addInitScript(()=>{localStorage.setItem('tnd_server_url_v1','http://menu.test');localStorage.setItem('tnd_server_tok_v1','fixture-session');});
 await context.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  if(u.hostname==='queue.fal.run'&&u.pathname.startsWith('/fixture/'))return json(u.pathname.endsWith('/status')?{status:'COMPLETED'}:{images:[{url:'https://menu.test/portrait.png'}]});
  if(u.hostname==='queue.fal.run'||u.pathname.startsWith('/api/render-queue/submit/')){requests.push({url:req.url(),body:req.postDataJSON()});return json({status_url:'https://queue.fal.run/fixture/status',response_url:'https://queue.fal.run/fixture/result'});}
  if(u.pathname==='/api/render-queue/poll')return json(req.postDataJSON().url.endsWith('/status')?{status:'COMPLETED'}:{images:[{url:'https://menu.test/portrait.png'}]});
  if(u.pathname==='/portrait.png')return route.fulfill({status:200,contentType:'image/png',body:Buffer.from(png.split(',')[1],'base64')});
  if(!u.hostname.endsWith('menu.test'))return route.abort();
  if(u.pathname==='/api/account')return json({isAdmin:false,entitled:true});
  const f=path.resolve(root,'.'+u.pathname);if(!f.startsWith(root+path.sep))return route.abort();
  try{let body=fs.readFileSync(f);if(u.hostname==='restore.menu.test'&&f.endsWith('blueprint-designer-drafts.js'))body=body.toString()+`;var originalDraftCreate=DesignerDrafts.create;DesignerDrafts.create=function(){var s=originalDraftCreate(),load=s.load;s.load=function(){return new Promise(function(resolve){window.releaseDraftRestore=resolve;}).then(function(){return load();});};return s;};`;await route.fulfill({status:200,contentType:f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':'application/javascript',body});}catch{await route.fulfill({status:404,body:'Missing fixture'});}
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://menu.test/blueprint-designer.html');await page.waitForFunction(()=>window.__bpdTest);
 async function test(name,fn){try{await fn();console.log('PASS #728 '+name);}catch(e){console.error('FAIL #728 '+name);console.error(await page.evaluate(()=>({status:document.getElementById('statusline').textContent,creatures:bp.creatures.map(c=>({name:c.name,folded:c._c,portrait:!!c.portrait})),npcs:bp.npcs.map(c=>({name:c.name,folded:c._c})),buttons:Array.from(document.querySelectorAll('[data-portrait-action]')).map(b=>b.getAttribute('data-op'))})));await page.screenshot({path:path.join(shots,'menu-failure.png')});throw e;}}
 async function file(id){if(!await page.evaluate(()=>document.getElementById('designer-file').open))await page.locator('#designer-file-toggle').click();await page.locator('#'+id).click();}
 async function key(key,code){await page._send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:code,...(key==='Enter'?{text:'\r'}:{})});await page._send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:code});}
 await test('file actions live in a compact accessible disclosure',async()=>{
  assert(await page.evaluate(()=>!!document.querySelector('details#designer-file > summary')),'File disclosure missing');
  assert(await page.evaluate(()=>['btn-new','btn-load','btn-save','btn-library','btn-publish','btn-publish-catalog','btn-fit-text','btn-original-text','llm-sel','btn-render-options'].every(id=>document.getElementById('designer-file').contains(document.getElementById(id)))));
  assert(await page.evaluate(()=>['btn-generate','btn-ask','btn-review'].every(id=>!document.getElementById('designer-file').contains(document.getElementById(id)))));
  assert(await page.evaluate(()=>document.getElementById('btn-publish-catalog').hidden),'non-admin catalog control hidden');
  await page.screenshot({path:path.join(shots,'menu-after-desktop.png')});await page.locator('#designer-file-toggle').click();await page.screenshot({path:path.join(shots,'menu-open-desktop.png')});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(shots,'menu-open-phone.png')});
  assert(await page.evaluate(()=>{var r=document.getElementById('designer-file-panel').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth;}),'all menu controls fit phone');
 });
 await test('Escape outside click and keyboard keep File usable',async()=>{
  await key('Escape',27);assert(await page.evaluate(()=>!document.getElementById('designer-file').open&&document.activeElement.id==='designer-file-toggle'));
  await key('Enter',13);assert(await page.evaluate(()=>document.getElementById('designer-file').open));await key('Tab',9);assert.equal(await page.evaluate(()=>document.activeElement.id),'btn-new');
  await page.locator('#topbar h1').click();assert(await page.evaluate(()=>!document.getElementById('designer-file').open));await page.screenshot({path:path.join(shots,'menu-after-phone.png')});
 });
 await test('file actions retain their handlers and dialogs return visible focus',async()=>{
  await page.evaluate(()=>{window.loadClicked=0;document.getElementById('file-inp').addEventListener('click',function(e){e.preventDefault();loadClicked++;});storageAdapter.listBlueprintLibrary=cb=>cb(null,[]);});
  await file('btn-load');assert.equal(await page.evaluate(()=>loadClicked),1);assert(await page.evaluate(()=>!document.getElementById('designer-file').open));
  await file('btn-library');await page.waitForSelector('#lib-modal');await page.locator('#lib-x').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'designer-file-toggle');
  await page.evaluate(()=>{bp.name='Temporary draft';dirty=false;});await file('btn-new');assert.equal(await page.evaluate(()=>bp.name),'');
 });
 await test('render choice persists and every new model uses the actual queued portrait body',async()=>{
  await page.setViewportSize({width:1050,height:900});
  for(const model of [sun,flare]){await file('btn-render-options');await page.locator('#designer-render-model').selectOption(model);assert.equal(await page.evaluate(()=>renderModel),model);assert.equal(await page.evaluate(()=>store.get(RENDER_MDL_K)),model);await page.screenshot({path:path.join(shots,'render-options.png')});await page.locator('#designer-render-close').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'designer-file-toggle');}
  await page.reload();await page.waitForFunction(()=>window.__bpdTest);assert.equal(await page.evaluate(()=>renderModel),flare);
  png=await page.evaluate(()=>{var c=document.createElement('canvas');c.width=600;c.height=800;c.getContext('2d').fillRect(0,0,600,800);return c.toDataURL();});
  await page.evaluate(desc=>{__bpdTest.load({format:'tnd-blueprint-v1',name:'Portrait route',premise:'A border patrol meets the hero.',acts:[{title:'First act',goal:'Meet the patrol',arcs:[{title:'The patrol',objective:'Speak'}]}],creatures:[{name:'Fox-Eared Trailblade',displayName:'Disguised Scout',kind:'forest fey soldier',notes:'GM_SECRET',desc}],npcs:[{name:'Captain Mira',role:'Guard',notes:'A human in a grey cloak.'}],locations:[],rules:[]});secOpen.creatures=true;secOpen.npcs=true;bp.creatures[0]._c=false;bp.npcs[0]._c=false;render();QUEUE_POLL_MS=1;},appearance);
  for(const model of [sun,flare]){await file('btn-render-options');await page.locator('#designer-render-model').selectOption(model);await page.locator('#designer-render-close').click();await page.locator('[data-op="creatureportrait"]').nth(0).click();await page.waitForFunction(()=>!!bp.creatures[0].portrait&&!creaturePortraitJobs.length);const req=requests.at(-1);assert(req.url.endsWith('/'+model));assert.equal(req.body.image_size,'portrait_4_3');assert(req.body.prompt.includes(appearance));assert(!/Fox-Eared Trailblade|Disguised Scout|GM_SECRET/.test(req.body.prompt));}
 });
 await test('own-key queued portraits retain character names',async()=>{
  await page.evaluate(model=>{falKey='fixture-fal-key';renderModel=model;},sun);await page.locator('[data-op="npcportrait"]').nth(0).click();await page.waitForFunction(()=>!!bp.npcs[0].portrait&&!creaturePortraitJobs.length);const req=requests.at(-1);assert.equal(req.url,'https://queue.fal.run/'+sun);assert(req.body.prompt.includes('Captain Mira'));assert.equal(req.body.image_size,'portrait_4_3');await page.evaluate(()=>falKey='');
 });
 await test('browser storage denial never claims the image choice is saved',async()=>{
  await file('btn-render-options');await page.locator('#designer-render-model').selectOption(flare);
  await page.evaluate(()=>{window.nativeStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===RENDER_MDL_K)throw new DOMException('Fixture storage denied','SecurityError');return nativeStorageSet.call(this,k,v);};});
  await page.locator('#designer-render-model').selectOption(sun);assert.equal(await page.evaluate(()=>renderModel),sun);assert.equal(await page.evaluate(()=>localStorage.getItem(RENDER_MDL_K)),flare);assert.match(await page.locator('#designer-render-status').innerText(),/could not be saved/);
  await page.evaluate(()=>Storage.prototype.setItem=nativeStorageSet);await page.locator('#designer-render-close').click();
 });
 await test('storage errors are visible and draft restore still gates the File menu',async()=>{
  await file('btn-render-options');await page.evaluate(()=>{window.oldStoreSet=store.set;store.set=function(){throw Error('Fixture storage full');};});await page.locator('#designer-render-model').selectOption(sun);assert.match(await page.locator('#designer-render-status').innerText(),/Fixture storage full/);await page.evaluate(()=>store.set=oldStoreSet);await page.locator('#designer-render-close').click();
  const held=await context.newPage();await held.goto('http://restore.menu.test/blueprint-designer.html');await held.waitForFunction(()=>window.releaseDraftRestore);assert(await held.evaluate(()=>document.getElementById('designer-controls').inert&&!window.__bpdTest));const rect=await held.evaluate(()=>{var r=document.getElementById('designer-file-toggle').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});await held._send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...rect});await held._send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...rect});assert(await held.evaluate(()=>!document.getElementById('designer-file').open));await held.evaluate(()=>releaseDraftRestore());await held.waitForFunction(()=>window.__bpdTest);
 });
 assert.deepEqual(errors,[]);console.log('DESIGNER FILE MENU: 7 groups passed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
