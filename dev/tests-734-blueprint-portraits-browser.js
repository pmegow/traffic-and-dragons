'use strict';
// Isolated save import and rendering; no model/account requests. Optional preview GETs verify static assets.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require('./cdp-browser.js'),engine=require('./load-engine.js');
const root=path.resolve(__dirname,'..'),shots=process.env.TND_NPC_PORTRAIT_SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'tnd-734-'));
engine.loadEngine();engine.makeTestWorld();
const empty=JSON.parse(JSON.stringify({worldState,memory,sessionLog}));
const source=process.env.TND_NPC_PORTRAIT_SOURCE?JSON.parse(fs.readFileSync(process.env.TND_NPC_PORTRAIT_SOURCE)):null;
const original=process.env.TND_NPC_PORTRAIT_SAVE?JSON.parse(fs.readFileSync(process.env.TND_NPC_PORTRAIT_SAVE)):null;
async function asset(file,requestPath){const expected=fs.readFileSync(file);if(!process.env.TND_NPC_PREVIEW)return expected;const url=new URL(requestPath==='/index.html'?'/':requestPath,process.env.TND_NPC_PREVIEW);const res=await fetch(url);assert(res.ok,'preview asset '+requestPath+' HTTP '+res.status);const bytes=Buffer.from(await res.arrayBuffer()),hash=b=>crypto.createHash('sha256').update(b).digest('hex');assert.equal(hash(bytes),hash(expected),'preview bytes match checkout: '+requestPath);return bytes;}
(async()=>{fs.mkdirSync(shots,{recursive:true});const browser=await chromium.launch({headless:true});try{
 const ctx=await browser.newContext({viewport:{width:1230,height:900},serviceWorkers:'block'}),errors=[];
 await ctx.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='portraits734.test')return r.abort();const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+path.sep))return r.abort();try{return r.fulfill({status:200,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.ttf':'font/ttf'})[path.extname(f)]||'application/octet-stream',body:await asset(f,u.pathname)});}catch(e){if(e.code!=='ENOENT'){errors.push('asset '+u.pathname+': '+e.message);console.error(errors[errors.length-1]);}return r.fulfill({status:404,body:''});}});
 await ctx.addInitScript(()=>{localStorage.setItem('tnd_ambient_enabled_v1','0');});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://portraits734.test/index.html');
 await page.waitForFunction(()=>typeof showNpcSheet==='function'&&typeof importSaveData==='function');
 await page.evaluate(()=>{generateActions=function(){};speakNarration=function(){};processPendingCompanionSheets=function(){};document.getElementById('api-screen').style.display='none';});
 const png=await page.evaluate(()=>{var c=document.createElement('canvas');c.width=80;c.height=100;var g=c.getContext('2d');g.fillStyle='#826449';g.fillRect(0,0,80,100);return c.toDataURL();});
 const bp=source||{name:'Portrait test',npcs:[{name:'Princess Willow',role:'ally',pronouns:'she/her',notes:'A marsh guide.',portrait:png}]};
 const wanted=bp.npcs.find(n=>n.name==='Princess Willow').portrait;assert(wanted,'authored source image exists');
 async function openSave(data){return page.evaluate(p=>{var m=document.getElementById('npc-modal');if(m)m.remove();worldState=null;memory=null;sessionLog=[];importSaveData(p);showGame();syncUI();showNpcSheet('Princess Willow');return {turn:worldState.turn,portrait:npcPortrait(wsNpcByName('Princess Willow'))};},data);}
 async function picture(file){await page.evaluate(async()=>{await document.fonts.ready;document.querySelectorAll('.tnd-toast').forEach(t=>t.remove());await new Promise(r=>setTimeout(r,200));});await page.screenshot({path:path.join(shots,file)});}
 async function decoded(){await page.waitForFunction(()=>{var i=document.getElementById('npc-portrait-img');return i&&i.complete&&i.naturalWidth>0;});return page.evaluate(()=>document.getElementById('npc-portrait-img').getAttribute('src'));}
 if(original){const r=await openSave(original);assert.equal(r.portrait,null,'original playthrough reproduces missing portrait');await picture('willow-before.png');}
 const seeded=await page.evaluate(p=>{worldState=p.empty.worldState;memory=p.empty.memory;sessionLog=[];applyBlueprint(p.bp);var n=wsNpcByName('Princess Willow');showGame();syncUI();showNpcSheet(n.name);return {portrait:npcPortrait(n),introduced:!!n.introduced};},{empty,bp});
 assert(seeded.portrait===wanted,'#734 blueprint portrait reaches the real NPC sheet');assert.equal(seeded.introduced,false,'portrait seeding does not discover the NPC');
 assert((await decoded())===wanted);await picture('willow-seeded.png');
 const saved=await page.evaluate(()=>{var n=wsNpcByName('Princess Willow');n.partyMember=true;attachCompanionSheet(n.name,buildCompanionSheetStub(n.name));showNpcSheet(n.name);return JSON.parse(JSON.stringify({worldState,memory,sessionLog}));});
 const n=saved.worldState.npcs.find(n=>n.name==='Princess Willow');assert(n.charSheet.portrait===wanted,'#734 companion portrait travels inside the saved sheet');assert(!n.portrait);
 await openSave(saved);assert((await decoded())===wanted,'#734 imported companion still decodes its authored image');await picture('willow-companion-reloaded.png');
 if(process.env.TND_NPC_REPAIRED_COPY){await page.evaluate(()=>localStorage.clear());await page.goto('http://portraits734.test/index.html');await page.waitForFunction(()=>typeof showNpcSheet==='function'&&typeof importSaveData==='function');await page.evaluate(()=>{generateActions=function(){};speakNarration=function(){};processPendingCompanionSheets=function(){};document.getElementById('api-screen').style.display='none';});const repaired=JSON.parse(fs.readFileSync(process.env.TND_NPC_REPAIRED_COPY));const r=await openSave(repaired);assert.equal(r.turn,50);assert.equal(await decoded(),wanted);await picture('willow-playthrough-repaired.png');}
 assert.deepEqual(errors,[]);console.log('PASS #734 blueprint, companion and imported portraits decode in the real sheet; '+shots);
}finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
