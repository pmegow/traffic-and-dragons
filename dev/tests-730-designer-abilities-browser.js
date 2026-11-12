// Actual Designer controls and IndexedDB draft round-trip via dev/cdp-browser.js; no paid calls.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..'),out=process.env.ABILITY_SCREENSHOTS||path.join(root,'testRuns/abilities-730/screenshots');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true});try{
const ctx=await browser.newContext({viewport:{width:1100,height:940},serviceWorkers:'block'});
await ctx.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='abilities.test')return route.abort();let file=path.resolve(root,'.'+u.pathname);if(!file.startsWith(root+path.sep))return route.abort();try{return route.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/javascript',body:fs.readFileSync(file)});}catch{return route.fulfill({status:404,body:'Missing fixture'});}});
const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://abilities.test/blueprint-designer.html');await page.waitForFunction(()=>window.__bpdTest);
await page.evaluate(()=>{__bpdTest.load({format:'tnd-blueprint-v1',name:'Marsh patrol',premise:'The courts patrol the border.',acts:[{title:'The patrol',goal:'Protect the crossing.',arcs:[{title:'Watch',objective:'Follow the road.'}]}],creatures:[{name:'Marsh Guard',kind:'fey soldier',desc:'A humanlike fey in a reed cloak.',notes:'Watches the crossing.'}],npcs:[{name:'Mara',notes:'A silver-haired guide in a green coat.'}],locations:[],rules:[]});secOpen.creatures=true;secOpen.npcs=true;bp.creatures[0]._c=false;bp.npcs[0]._c=false;__bpdTest.rerender();});
await page.evaluate(()=>{document.querySelector('[data-sec="creature"]').scrollIntoView({block:'start'});window.scrollBy(0,-document.getElementById('topbar').getBoundingClientRect().height-25);});
await page.screenshot({path:path.join(out,process.env.ABILITY_BEFORE==='1'?'before.png':'creature-desktop.png')});
assert(await page.evaluate(()=>['npc','creature'].every(sec=>document.querySelector('textarea[data-sec="'+sec+'"][data-k="abilities"]'))),'#730 both entity cards expose an Abilities textarea');
const creature='Reed snare: binds one nearby target; fire breaks it.\nResistance: cold.',npc='Frost ward: twice daily.\nSpecial attack: a freezing touch.';
await page.locator('textarea[data-sec="creature"][data-k="abilities"]').fill(creature);
await page.locator('[data-bsec="npc"][data-bk="abilities"]').click();await page.locator('#bo-ta').fill(npc);await page.locator('#bo-done').click();
assert.deepEqual(await page.evaluate(()=>[bp.creatures[0].abilities,bp.npcs[0].abilities]),[creature,npc],'#730 inline and expanded editors write the actual ability fields');
const exported=await page.evaluate(()=>__bpdTest.out());assert.equal(exported.creatures[0].abilities,creature);assert.equal(exported.npcs[0].abilities,npc);
await page.evaluate(async()=>{await designerDrafts.flush();});await page.reload();await page.waitForFunction(()=>window.__bpdTest);
assert.deepEqual(await page.evaluate(()=>[bp.creatures[0].abilities,bp.npcs[0].abilities]),[creature,npc],'#730 autosave and reload retain both abilities');
await page.evaluate(data=>{__bpdTest.load(data);secOpen.npcs=true;secOpen.creatures=true;bp.npcs[0]._c=false;bp.creatures[0]._c=false;__bpdTest.rerender();},exported);
assert.deepEqual(await page.evaluate(()=>[bp.creatures[0].abilities,bp.npcs[0].abilities]),[creature,npc],'#730 portable file reload retains both abilities');
for(const sec of ['npc','creature']){await page.evaluate(sec=>{document.querySelector('textarea[data-sec="'+sec+'"][data-k="abilities"]').scrollIntoView({block:'center'});},sec);await page.screenshot({path:path.join(out,sec+'-desktop-filled.png')});}
await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.querySelector('textarea[data-sec="creature"][data-k="abilities"]').scrollIntoView({block:'center'}));await page.screenshot({path:path.join(out,'creature-mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'#730 abilities controls fit phone width');
const long='A detailed ward description, with its targets, frequency, and limitations. '.repeat(15)+'FINAL_BOUNDARY';
await page.locator('textarea[data-sec="creature"][data-k="abilities"]').fill(long);await page.evaluate(async()=>{await designerDrafts.flush();});await page.reload();await page.waitForFunction(()=>window.__bpdTest);
assert.equal(await page.evaluate(()=>bp.creatures[0].abilities),long,'#730 overlong manual draft remains complete');assert.match(await page.evaluate(()=>__bpdTest.validate()),/text limits/,'#730 overlong abilities request explicit shortening');assert.deepEqual(errors,[],'#730 no page errors');
console.log('PASS #730 entity controls, breakout, autosave, portable reload, phone layout and full overlong draft');
}finally{await browser.close();}})().catch(e=>{console.error('FAIL #730 Designer ability controls: '+e.stack);process.exitCode=1;});
