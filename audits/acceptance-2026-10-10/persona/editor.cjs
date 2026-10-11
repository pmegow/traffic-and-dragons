// Shipping editor + shipping storage adapter, intercepted HTTP only; no real account or external network.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../../..'),{chromium}=require(path.join(root,'dev/cdp-browser.js'));
const captured=JSON.parse(fs.readFileSync(path.join(__dirname,'captured-sheet.json'),'utf8'));
(async()=>{const browser=await chromium.launch({headless:true});try{
 const ctx=await browser.newContext({viewport:{width:1200,height:950},serviceWorkers:'block'}),errors=[];let stored=null,posts=0,gets=0;
 await ctx.addInitScript(()=>{localStorage.setItem('tnd_server_url_v1','http://library.test');localStorage.setItem('tnd_server_tok_v1','synthetic-acceptance-token');});
 await ctx.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());
  if(u.hostname==='library.test'&&u.pathname==='/api/account')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({username:'Synthetic Acceptance'})});
  if(u.hostname==='library.test'&&u.pathname==='/api/characters'){
   if(req.method()==='POST'){stored=JSON.parse(JSON.stringify(req.postDataJSON().character));posts++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true})});}
   gets++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(stored?[{name:stored.name,cls:stored.cls,level:stored.level,ancestry:stored.ancestry,character:stored}]:[])});
  }
  if(u.hostname!=='editor.test')return route.abort();const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep))return route.abort();try{return route.fulfill({status:200,contentType:f.endsWith('.html')?'text/html':f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/plain',body:fs.readFileSync(f)});}catch(e){return route.fulfill({status:404,body:'Not found'});}
 });
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://editor.test/character_editor.html');await page.waitForFunction(()=>window.__ceTest);
 await page.evaluate(c=>{const t=window.__ceTest;t.load(Object.assign(t.blank(),c));},captured);
 assert.equal(await page.evaluate(()=>document.querySelector('[data-k="manner"]').value),captured.manner);
 assert.equal(await page.evaluate(()=>document.querySelectorAll('[data-list="voiceLines"][data-c="text"]').length),4);
 await page.evaluate(()=>{const m=document.querySelector('[data-k="manner"]');m.value='Dry wit; a deliberate pause before the last word.';m.dispatchEvent(new Event('change',{bubbles:true}));const v=document.querySelector('[data-list="voiceLines"][data-i="0"][data-c="text"]');v.value='I kept my promise when the road went dark.';v.dispatchEvent(new Event('change',{bubbles:true}));});
 const edited=await page.evaluate(()=>window.__ceTest.out().character);
 await page.evaluate(()=>document.querySelector('[data-k="manner"]').scrollIntoView({block:'center'}));await page.screenshot({path:path.join(__dirname,'editor-manner.png')});
 await page.evaluate(()=>document.querySelector('[data-list="voiceLines"]').scrollIntoView({block:'center'}));await page.screenshot({path:path.join(__dirname,'editor-lines.png')});
 await page.evaluate(()=>document.querySelector('#b-libsave').click());await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Saved'));
 assert.equal(posts,1,'one actual storageAdapter POST');assert.deepEqual(stored.voiceLines,edited.voiceLines);assert.equal(stored.manner,edited.manner);
 await page.evaluate(()=>{const t=window.__ceTest;t.load(t.blank());document.querySelector('#b-lib').click();});await page.waitForFunction(()=>document.querySelector('[data-pick="0"]'));await page.evaluate(()=>document.querySelector('[data-pick="0"]').click());
 const restored=await page.evaluate(()=>window.__ceTest.get());assert.deepEqual(restored.voiceLines,edited.voiceLines);assert.equal(restored.manner,edited.manner);assert.equal(gets,1,'one actual storageAdapter GET');assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(__dirname,'editor-roundtrip.json'),JSON.stringify({transport:'intercepted HTTP; actual editor and storageAdapter; no server persistence claimed',posts,gets,voiceLines:restored.voiceLines,manner:restored.manner,errors},null,2)+'\n','utf8');
 console.log('PASS editor: 4 captured lines rendered, actual field/list edits, storageAdapter POST, blank sheet, library GET and Load preserve voiceLines/manner byte-exact; 0 page errors. HTTP intercepted, not a real server.');
 }finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
