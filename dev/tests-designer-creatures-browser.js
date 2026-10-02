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
 if(url.pathname.startsWith('/api/render/')){images++;assert(req.postDataJSON().prompt.includes('Lantern moth'));return json({images:[{url:'https://creature.test/portrait.png'}]});}
 if(url.pathname==='/portrait.png')return route.fulfill({status:200,contentType:'image/png',body:Buffer.from(png.split(',')[1],'base64')});
 let file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep))return route.abort();
 try{const data=before&&url.pathname==='/blueprint-designer.html'?cp.execFileSync('git',['show','HEAD:blueprint-designer.html'],{cwd:root}):fs.readFileSync(file);return route.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/javascript',body:data});}catch{return route.fulfill({status:404,body:'Missing fixture'});}
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://creature.test/blueprint-designer.html');await page.waitForFunction(()=>window.__bpdTest);
await page.evaluate(()=>{__bpdTest.load({format:'tnd-blueprint-v1',name:'The Lantern Fen',premise:'A marsh village loses its lights each night.',acts:[],npcs:[],locations:[],creatures:[],rules:[]});secOpen.creatures=true;__bpdTest.rerender();});
await page.evaluate(()=>document.querySelector('[data-op="gencreature"]').scrollIntoView({block:'center'}));
if(before){await page.screenshot({path:path.join(out,'before.png')});console.log('PASS before: original immediate-generation button captured');return;}
await page.locator('[data-op="gencreature"]').click();assert.equal(calls.length,0,'opening the modal must not spend a model request');
await page.waitForSelector('#creature-gen-modal');
await page.locator('#creature-count').fill('3');await page.locator('#creature-kind').selectOption('Beast');await page.locator('#creature-threat').selectOption('Safe');await page.locator('#creature-frequency').selectOption('rare');await page.locator('#creature-treasure').selectOption('Crafting materials');
await page.screenshot({path:path.join(out,'modal-desktop.png')});
await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'modal-mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'modal has no horizontal overflow');
await page.locator('#creature-count').fill('1.5');await page.locator('#creature-gen-go').click();assert.equal(calls.length,0,'fractional counts blocked before network');
await page.locator('#creature-count').fill('3');await page.locator('#creature-gen-go').click();await page.waitForFunction(()=>__bpdTest.getBp().creatures.length===3);
assert.equal(calls.length,3);assert(await page.evaluate(()=>document.activeElement.getAttribute('data-op')==='gencreature'),'focus returns to the rebuilt opener');assert.equal(images,0,'text generation never auto-generates portraits');
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
assert.deepEqual(errors,[]);console.log('PASS CREATURE BROWSER: controls, mobile, count rejection, batch, portrait layout and enlargement, focus, reload, Apply preservation, failure and cancel. Screenshots: '+out);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
