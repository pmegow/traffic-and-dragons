// Real browser persistence: no accounts, model calls, or production storage.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..'),shots=process.env.DRAFT_SCREENSHOTS||path.join(process.env.TEMP||require('os').tmpdir(),'tnd-designer-drafts');
fs.mkdirSync(shots,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true});try{
 const context=await browser.newContext({viewport:{width:1100,height:850},serviceWorkers:'block'});
 await context.route('**/*',async route=>{const url=new URL(route.request().url());if(!/(^|\.)draft\.test$/.test(url.hostname))return route.abort();const f=path.resolve(root,'.'+url.pathname);if(!f.startsWith(root+path.sep))return route.abort();try{let body=fs.readFileSync(f);if(f.endsWith('blueprint-designer-drafts.js')&&url.hostname==='retry-life.draft.test')body=body.toString()+`;var realCreate=DesignerDrafts.create,attempts=0;DesignerDrafts.create=function(){var s=realCreate();if(++attempts===1){s.load=function(){return Promise.reject(new Error('Fixture opening failed'));};s.recovery=function(){return new Promise(function(resolve){window.releaseRecovery=resolve;});};}return s;};`;if(f.endsWith('blueprint-designer-drafts.js')&&url.hostname==='slow-start.draft.test')body=body.toString()+`;var realCreate=DesignerDrafts.create;DesignerDrafts.create=function(){var s=realCreate(),load=s.load;s.load=function(){return new Promise(function(resolve){window.releaseRestore=resolve;}).then(function(){return load();});};return s;};`;await route.fulfill({status:200,contentType:f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':'application/javascript',body});}catch{await route.fulfill({status:404,body:'missing fixture'});}});
 const page=await context.newPage();await page.goto('http://draft.test/blueprint-designer.html');await page.waitForFunction(()=>window.__bpdTest);
 try{
 const expected=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1200;c.height=1200;const ctx=c.getContext('2d'),pixels=ctx.createImageData(c.width,c.height);let r=725;for(let i=0;i<pixels.data.length;i++){r=(1664525*r+1013904223)>>>0;pixels.data[i]=i%4===3?255:r>>>24;}ctx.putImageData(pixels,0,0);const portrait=c.toDataURL('image/png');bp.name='Portrait-heavy recovery';bp.creatures=[{name:'Marsh patrol',kind:'Fey',threat:'Dangerous',notes:'Private truth',portrait:portrait}];bp._textOriginal={fields:[{text:'Preserve full original prose'}]};bp.review={findings:[]};editionBaseline=BlueprintEdition.baseline(fileOut());render();markDirty();return JSON.stringify({bp:bp,dirty:dirty,editionBaseline:editionBaseline});});
 assert(expected.length>10*1024*1024,'fixture exceeds localStorage quota with real PNG and edition baseline');
 await new Promise(r=>setTimeout(r,1200));
 if(await page.evaluate(()=>!!window.designerDrafts))await page.evaluate(()=>designerDrafts.flush());
 await page.screenshot({path:path.join(shots,process.env.DRAFT_BEFORE?'quota-before.png':'large-draft-after.png')});
 await page.reload();await page.waitForFunction(()=>window.__bpdTest);
 const actual=await page.evaluate(()=>JSON.stringify({bp:bp,dirty:dirty,editionBaseline:editionBaseline}));
 assert(actual===expected,'large portrait draft survives reload byte-for-byte');
 console.log('PASS large portrait draft survives reload byte-for-byte');
 }catch(e){console.error('FAIL large portrait draft survives reload byte-for-byte');throw e;}
 async function test(name,fn){try{await fn();console.log('PASS '+name);}catch(e){console.error('FAIL '+name);throw e;}}
 async function fresh(host,raw,init){const p=await context.newPage();if(raw!==undefined)await p.addInitScript(v=>localStorage.setItem('bpd_draft_v1',v),raw);if(init)await p.addInitScript(init);await p.goto('http://'+host+'.draft.test/blueprint-designer.html');return p;}
 const legacy=await page.evaluate(()=>{const p=JSON.parse(JSON.stringify(bp));p.name='Legacy working copy';p.creatures[0].portrait='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6zgAAAABJRU5ErkJggg==';return JSON.stringify({bp:p,dirty:true,editionBaseline:BlueprintEdition.baseline(p),at:725});});
 let migrated;
 await test('migration preserves the legacy draft, portraits, originals and exact edition baseline',async()=>{
  migrated=await fresh('legacy',legacy);await migrated.waitForFunction(()=>window.__bpdTest);await migrated.evaluate(()=>designerDrafts.flush());
  assert(await migrated.evaluate(raw=>{const p=JSON.parse(raw);return localStorage.getItem('bpd_draft_v1')===raw&&JSON.stringify(bp)===JSON.stringify(p.bp)&&JSON.stringify(editionBaseline)===JSON.stringify(p.editionBaseline)&&dirty;},legacy));
 });
 await test('aborted writes keep the previously durable draft intact',async()=>{
  assert(await page.evaluate(async()=>{const s=DesignerDrafts.create({name:'abort-test',readLegacy:()=>null});await s.load();const p={bp:{format:'test',name:'Durable'},dirty:true};await s.write(p);const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){const req=put.apply(this,arguments);this.transaction.abort();return req;};let rejected=false;try{await s.write({bp:{format:'test',name:'Lost'}});}catch(e){rejected=true;}finally{IDBObjectStore.prototype.put=put;}const check=DesignerDrafts.create({name:'abort-test',readLegacy:()=>null});const result=await check.load();s.close();check.close();return rejected&&result.bp.name==='Durable';}));
 });
 await test('two tabs cannot overwrite a newer revision',async()=>{
  const other=await context.newPage();await other.goto('http://draft.test/blueprint-designer.html');await other.waitForFunction(()=>window.__bpdTest);await other.evaluate(()=>designerDrafts.flush());
  const result=await page.evaluate(async()=>{bp.name='Stale tab';markDirty();try{await designerDrafts.flush();return false;}catch(e){return e.code==='conflict';}});assert(result);
  await page.evaluate(()=>{render();editionSaved(fileOut(),bp,bp.releaseStatus);});
  assert(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return !dirty&&e.defaultPrevented&&designerDrafts.unsettled()&&document.querySelector('#draft-message').textContent.includes('newer draft');}),'failed autosave warns after file export and render cannot erase its reason');
  assert.equal(await other.evaluate(()=>bp.name),'Portrait-heavy recovery');
 });
 await test('simultaneous writers compare revisions inside the same transaction',async()=>{
  assert(await migrated.evaluate(async()=>{const a=DesignerDrafts.create({name:'race-test',readLegacy:()=>null}),b=DesignerDrafts.create({name:'race-test',readLegacy:()=>null});await Promise.all([a.load(),b.load()]);const r=await Promise.allSettled([a.write({bp:{format:'test',name:'A'}}),b.write({bp:{format:'test',name:'B'}})]);a.close();b.close();return r.filter(v=>v.status==='fulfilled').length===1&&r.filter(v=>v.status==='rejected'&&v.reason.code==='conflict').length===1;}));
 });
 await test('migration failure retains the legacy copy and blocks blank autosaves',async()=>{
  const p=await fresh('migration-failure',legacy,()=>{window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw Error('Fixture migration quota');};});
  await p.waitForFunction(()=>document.querySelector('#draft-message').textContent.includes('Fixture migration quota'));
  assert(await p.evaluate(raw=>!window.__bpdTest&&document.querySelector('#designer-controls').inert&&localStorage.getItem('bpd_draft_v1')===raw,legacy));
  assert(await p.evaluate(async()=>!(await designerDraftStore.recovery()).saved));
  await p.evaluate(()=>{IDBObjectStore.prototype.put=originalPut;});await p.locator('#draft-actions button').first().click();await p.waitForFunction(()=>window.__bpdTest);assert.equal(await p.evaluate(()=>bp.name),'Legacy working copy');
 });
 await test('corrupt legacy data stays downloadable and cannot become an empty draft',async()=>{
  const p=await fresh('corrupt','{broken JSON');await p.waitForFunction(()=>document.querySelector('#draft-actions').textContent.includes('Download legacy copy'));
  assert(await p.evaluate(()=>!window.__bpdTest&&document.querySelector('#app').inert&&localStorage.getItem('bpd_draft_v1')==='{broken JSON'));assert(await p.evaluate(async()=>!(await designerDraftStore.recovery()).saved));
 });
 await test('unavailable storage fails closed before editor access',async()=>{
  const p=await fresh('denied',legacy,()=>{IDBFactory.prototype.open=function(){throw Error('Fixture storage denied');};});await p.waitForFunction(()=>document.querySelector('#draft-message').textContent.includes('Fixture storage denied'));
  assert(await p.evaluate(raw=>!window.__bpdTest&&bp===null&&document.querySelector('#designer-controls').inert&&localStorage.getItem('bpd_draft_v1')===raw,legacy));
 });
 await test('changed legacy copies require an explicit recovery choice and remain preserved',async()=>{
  // A page without an init script, so reloading cannot reset the simulated old tab's write.
  const p=await context.newPage();await p.goto('http://legacy.draft.test/blueprint-designer.html');await p.waitForFunction(()=>window.__bpdTest);await p.evaluate(()=>designerDrafts.flush());
  const raw=await p.evaluate(()=>{const v=JSON.parse(localStorage.getItem('bpd_draft_v1'));v.bp.name='Old tab edited this';const raw=JSON.stringify(v);localStorage.setItem('bpd_draft_v1',raw);return raw;});
  assert(await p.evaluate(async()=>{saveDraft();try{await designerDrafts.flush();return false;}catch(e){return e.code==='legacy';}}));
  await p.reload();await p.waitForFunction(()=>document.querySelector('#draft-actions').textContent.includes('Continue saved copy'));assert(await p.evaluate(()=>!window.__bpdTest));
  await p.evaluate(()=>Array.from(document.querySelectorAll('#draft-actions button')).find(b=>b.textContent==='Continue saved copy').click());await p.waitForFunction(()=>window.__bpdTest);await p.evaluate(()=>designerDrafts.flush());assert.equal(await p.evaluate(()=>bp.name),'Legacy working copy');assert.equal(await p.evaluate(()=>localStorage.getItem('bpd_draft_v1')),raw);
  await p.evaluate(()=>{const v=JSON.parse(localStorage.getItem('bpd_draft_v1'));v.bp.name='Choose legacy this time';localStorage.setItem('bpd_draft_v1',JSON.stringify(v));});await p.reload();await p.waitForFunction(()=>document.querySelector('#draft-actions').textContent.includes('Continue legacy copy'));await p.evaluate(()=>Array.from(document.querySelectorAll('#draft-actions button')).find(b=>b.textContent==='Continue legacy copy').click());await p.waitForFunction(()=>window.__bpdTest);assert.equal(await p.evaluate(()=>bp.name),'Choose legacy this time');
 });
 await test('New and import replace atomically without deleting an existing draft first',async()=>{
  const p=await fresh('replacement');await p.waitForFunction(()=>window.__bpdTest);await p.evaluate(()=>{bp.name='Keep me';markDirty();});await p.evaluate(()=>designerDrafts.flush());
  await p.evaluate(()=>{dirty=false;IDBObjectStore.prototype.put=function(){throw Error('Fixture disk full');};});await p.locator('#btn-new').click();await p.waitForFunction(()=>document.querySelector('#draft-message').textContent.includes('Fixture disk full'));assert.equal(await p.evaluate(async()=>(await designerDraftStore.recovery()).saved.payload.bp.name),'Keep me');
  await p.evaluate(()=>__bpdTest.load({format:bp.format,name:'Imported',acts:[]}));assert.equal(await p.evaluate(async()=>(await designerDraftStore.recovery()).saved.payload.bp.name),'Keep me');
  await p.setViewportSize({width:390,height:844});await p.screenshot({path:path.join(shots,'failed-autosave-mobile.png')});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'failure recovery fits mobile width');
 });
 await test('choosing legacy retains the displaced saved copy atomically',async()=>{
  assert(await page.evaluate(async()=>{let raw=null;const s=DesignerDrafts.create({name:'retain-test',readLegacy:()=>raw});await s.load();await s.write({bp:{format:'test',name:'Unique saved work'}});raw=JSON.stringify({bp:{format:'test',name:'Old tab work'}});const p=await s.load('legacy'),r=await s.recovery();s.close();return p.bp.name==='Old tab work'&&r.retained.payload.bp.name==='Unique saved work';}));
 });
 await test('damaged current data can recover valid legacy without erasing evidence',async()=>{
  assert(await page.evaluate(async()=>{const raw=JSON.stringify({bp:{format:'test',name:'Recover me'}}),s=DesignerDrafts.create({name:'damaged-test',readLegacy:()=>raw});await s.load();await new Promise((resolve,reject)=>{const q=indexedDB.open('damaged-test',1);q.onsuccess=()=>{const db=q.result,tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put({schema:99,revision:7,payload:{future:'Unknown data'}},'current');tx.oncomplete=()=>{db.close();resolve();};tx.onabort=reject;};});const p=await s.load('legacy'),r=await s.recovery();s.close();return p.bp.name==='Recover me'&&r.retained.schema===99&&r.retained.payload.future==='Unknown data';}));
 });
 await test('unavailable IndexedDB still permits a legacy recovery download',async()=>{
  const p=await fresh('denied-export',legacy,()=>{IDBFactory.prototype.open=function(){throw Error('Fixture denied export');};});await p.waitForFunction(()=>document.querySelector('#draft-message').textContent.includes('Fixture denied export'));await new Promise(r=>setTimeout(r,100));assert((await p.locator('#draft-actions').innerText()).includes('Download legacy copy'));
 });
 await test('malformed Home handoff cannot block a healthy saved draft',async()=>{
  const p=await fresh('bad-incoming',legacy,()=>localStorage.setItem('bpd_incoming_v1','{broken handoff'));
  await new Promise(r=>setTimeout(r,500));assert(await p.evaluate(()=>!!window.__bpdTest&&bp.name==='Legacy working copy'&&localStorage.getItem('bpd_incoming_v1')==='{broken handoff'));
 });
 await test('an occupied recovery backup is preserved until explicit removal',async()=>{
  assert(await page.evaluate(async()=>{let raw=null;const s=DesignerDrafts.create({name:'bounded-test',readLegacy:()=>raw});await s.load();await s.write({bp:{format:'test',name:'First saved'}});raw=JSON.stringify({bp:{format:'test',name:'Legacy one'}});await s.load('legacy');raw=JSON.stringify({bp:{format:'test',name:'Legacy two'}});let blocked=false;try{await s.load('legacy');}catch(e){blocked=e.code==='recovery';}const r=await s.recovery();if(!blocked||r.retained.payload.bp.name!=='First saved'||r.saved.payload.bp.name!=='Legacy one')return false;await s.removeRecovery(r.retained);await s.load('legacy');const end=await s.recovery();s.close();return end.saved.payload.bp.name==='Legacy two'&&end.retained.payload.bp.name==='Legacy one';}));
 });
 await test('legacy backup remains recoverable after the old storage key is removed',async()=>{
  assert(await page.evaluate(async()=>{let raw=JSON.stringify({bp:{format:'test',name:'Original legacy'}});const s=DesignerDrafts.create({name:'legacy-backup-test',readLegacy:()=>raw});await s.load();raw=null;await s.load();await s.write({bp:{format:'test',name:'Later saved'}});const r=await s.recovery();const restored=await s.load('legacy');s.close();return JSON.parse(r.legacy).bp.name==='Original legacy'&&restored.bp.name==='Original legacy';}));
 });
 await test('Home incoming is retained until its replacement is durable',async()=>{
  const p=await fresh('incoming-failure',undefined,()=>{localStorage.setItem('bpd_incoming_v1',JSON.stringify({bp:{format:'tnd-blueprint',name:'From Home',acts:[]}}));IDBObjectStore.prototype.put=function(){throw Error('Fixture incoming disk full');};});await p.waitForFunction(()=>document.querySelector('#draft-message').textContent.includes('Fixture incoming disk full'));assert(await p.evaluate(()=>!!localStorage.getItem('bpd_incoming_v1')&&bp.name==='From Home'));
 });
 await test('recovery copies remain accessible after a successful restore',async()=>{
  const p=await context.newPage();await p.goto('http://legacy.draft.test/blueprint-designer.html');await p.waitForFunction(()=>window.__bpdTest);assert(await p.evaluate(()=>!!document.querySelector('#draft-backups')&&!document.querySelector('#draft-backups').hidden));await p.locator('#draft-backups').click();await p.waitForFunction(()=>document.querySelector('#draft-recovery').textContent.includes('Download recovery backup'));assert.equal(await p.evaluate(()=>bp.name),'Choose legacy this time');
 });
 await test('a corrupt-only draft can start fresh while keeping recovery data',async()=>{
  const p=await fresh('corrupt-only-new','{unreadable');await p.waitForFunction(()=>document.querySelector('#draft-actions').textContent.includes('Download legacy copy'));assert((await p.locator('#draft-actions').innerText()).includes('Start new'));await p.evaluate(()=>{window.confirm=()=>true;Array.from(document.querySelectorAll('#draft-actions button')).find(b=>b.textContent.startsWith('Start new')).click();});await p.waitForFunction(()=>window.__bpdTest);await p.evaluate(()=>designerDrafts.flush());assert.equal(await p.evaluate(()=>localStorage.getItem('bpd_draft_v1')),'{unreadable');assert.equal(await p.evaluate(()=>bp.name),'');
 });
 await test('editor access waits for draft restore and stale recovery callbacks are ignored',async()=>{
  const slow=await fresh('slow-start');await slow.waitForFunction(()=>window.releaseRestore);assert(await slow.evaluate(()=>!window.__bpdTest&&bp===null&&document.querySelector('#designer-controls').inert&&document.querySelector('#app').inert));await slow.evaluate(()=>releaseRestore());await slow.waitForFunction(()=>window.__bpdTest);
  const p=await fresh('retry-life');await p.waitForFunction(()=>window.releaseRecovery);await p.locator('#draft-actions button').first().click();await p.waitForFunction(()=>window.__bpdTest);await p.evaluate(()=>designerDrafts.flush());await p.evaluate(()=>releaseRecovery({legacy:'{old recovery'}));await new Promise(r=>setTimeout(r,50));assert.equal(await p.locator('#draft-actions').innerText(),'');assert(await p.evaluate(()=>!document.querySelector('#designer-controls').inert));
 });
 await test('fresh start retains an unreadable current envelope',async()=>{
  assert(await page.evaluate(async()=>{const s=DesignerDrafts.create({name:'corrupt-current-new',readLegacy:()=>null});await s.load();await new Promise(resolve=>{const q=indexedDB.open('corrupt-current-new',1);q.onsuccess=()=>{const db=q.result,tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put({schema:99,revision:1,opaque:'do not lose'},'current');tx.oncomplete=()=>{db.close();resolve();};};});await s.load('new',{bp:{format:'test',name:'Blank'}});const r=await s.recovery();s.close();return r.saved.payload.bp.name==='Blank'&&r.retained.opaque==='do not lose';}));
 });
 console.log('DESIGNER DRAFT BROWSER: all persistence cases passed');

}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
