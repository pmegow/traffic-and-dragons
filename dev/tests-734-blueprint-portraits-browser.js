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
 async function picture(file){
   await page.evaluate(async()=>{await document.fonts.ready;document.querySelectorAll('.tnd-toast').forEach(t=>t.remove());await Promise.all(Array.from(document.querySelectorAll('#npc-portrait-img,#car-portrait-img')).map(i=>i.decode().catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
   const paint=await page.evaluate(()=>{function box(el){var r=el.getBoundingClientRect(),s=getComputedStyle(el);return {id:el.id,x:r.x,y:r.y,width:r.width,height:r.height,display:s.display,visibility:s.visibility,opacity:s.opacity,scrollTop:el.scrollTop};}var avatar=document.getElementById('npc-avatar-btn'),r=avatar&&avatar.getBoundingClientRect();return {active:document.activeElement&&document.activeElement.id,dialogs:Array.from(document.querySelectorAll('[role=dialog]')).map(box),avatars:Array.from(document.querySelectorAll('#npc-avatar-btn,#npc-portrait-img,#car-portrait-img')).map(box),top:r?document.elementsFromPoint(r.x+r.width/2,r.y+r.height/2).slice(0,5).map(box):[]};});
   fs.writeFileSync(path.join(shots,file+'.json'),JSON.stringify(paint,null,2));
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(shots,file)});
 }
 async function decoded(){await page.waitForFunction(()=>{var i=document.getElementById('npc-portrait-img');return i&&i.complete&&i.naturalWidth>0;});return page.evaluate(()=>document.getElementById('npc-portrait-img').getAttribute('src'));}
 if(original){const r=await openSave(original);assert.equal(r.portrait,null,'original playthrough reproduces missing portrait');await picture('willow-before.png');}
 const seeded=await page.evaluate(p=>{worldState=p.empty.worldState;memory=p.empty.memory;sessionLog=[];applyBlueprint(p.bp);var n=wsNpcByName('Princess Willow');showGame();syncUI();showNpcSheet(n.name);return {portrait:npcPortrait(n),introduced:!!n.introduced};},{empty,bp});
 assert(seeded.portrait===wanted,'#734 blueprint portrait reaches the real NPC sheet');assert.equal(seeded.introduced,false,'portrait seeding does not discover the NPC');
 assert((await decoded())===wanted);await picture('willow-seeded.png');
 const saved=await page.evaluate(()=>{var n=wsNpcByName('Princess Willow');n.partyMember=true;attachCompanionSheet(n.name,buildCompanionSheetStub(n.name));showNpcSheet(n.name);return JSON.parse(JSON.stringify({worldState,memory,sessionLog}));});
 const n=saved.worldState.npcs.find(n=>n.name==='Princess Willow');assert(n.charSheet.portrait===wanted,'#734 companion portrait travels inside the saved sheet');assert(!n.portrait);
 await openSave(saved);assert((await decoded())===wanted,'#734 imported companion still decodes its authored image');await picture('willow-companion-reloaded.png');
 if(process.env.TND_NPC_REPAIRED_COPY){await page.evaluate(()=>localStorage.clear());await page.goto('http://portraits734.test/index.html');await page.waitForFunction(()=>typeof showNpcSheet==='function'&&typeof importSaveData==='function');await page.evaluate(()=>{generateActions=function(){};speakNarration=function(){};processPendingCompanionSheets=function(){};document.getElementById('api-screen').style.display='none';});const repaired=JSON.parse(fs.readFileSync(process.env.TND_NPC_REPAIRED_COPY));const r=await openSave(repaired);assert.equal(r.turn,50);assert.equal(await decoded(),wanted);await picture('willow-playthrough-repaired.png');}
 const chosen738=await page.evaluate(()=>{var c=document.createElement('canvas');c.width=80;c.height=100;var g=c.getContext('2d');g.fillStyle='#215ab7';g.fillRect(0,0,80,100);return c.toDataURL();});assert.notEqual(chosen738,wanted,'chosen-image fixture differs from authored source');
 const failures738=[];let passed738=0;
 async function check738(name,fn){try{await fn();passed738++;console.log('PASS #738 '+name);}catch(e){failures738.push(name);console.error('FAIL #738 '+name+' — '+e.message);await picture('738-failed-'+name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'.png');}}
 const oneBlueprint={name:bp.name,npcs:[bp.npcs.find(n=>n.name==='Princess Willow')]};
 async function fresh738(mode){await page.evaluate(p=>{
   if(carMode)carSessionStop();busy=false;document.getElementById('sidebar').classList.remove('open');
   document.querySelectorAll('#npc-modal,#portrait-modal,#char-export-opts,#char-overwrite-modal,#party-upload-confirm').forEach(el=>el.remove());
   worldState=p.empty.worldState;memory=p.empty.memory;sessionLog=[];worldState.ver=SAVE_VER;worldState.campId='portrait738-browser';memory.campId=worldState.campId;
   window.__portrait738=p.wanted;window.__portraitMode738=p.mode;
   if(p.mode==='exact'||p.mode==='chosen'){
     var s=buildCompanionSheetStub('Princess Willow');s.portrait=p.mode==='chosen'?p.other:null;
     worldState.npcs=[{name:'Princess Willow',partyMember:true,charSheet:s,portrait:null}];
     window.__existing738=worldState.npcs[0];
   }
   if(p.mode==='approximate'){
     worldState.npcs=[{name:'Willow',aliases:['Princess Willow'],partyMember:true,charSheet:buildCompanionSheetStub('Willow')},{name:'Princess Willow II',partyMember:true,charSheet:buildCompanionSheetStub('Princess Willow II')},{name:'Unlisted Guide',partyMember:true,charSheet:buildCompanionSheetStub('Unlisted Guide')}];
     window.__existing738=worldState.npcs.slice();window.__beforeExisting738=JSON.stringify(worldState.npcs);
   }
   if(p.mode==='row-merge'||p.mode==='sheet-merge'){
     var main={name:'Willow',partyMember:true,isPC:true,portrait:null,charSheet:buildCompanionSheetStub('Willow')};
     var duplicate={name:'Princess Willow',partyMember:false,portrait:p.wanted};
     if(p.mode==='sheet-merge'){duplicate.charSheet=buildCompanionSheetStub(duplicate.name);duplicate.charSheet.portrait=p.wanted;duplicate.portrait=null;}
     worldState.npcs=[main,duplicate];memory.npcs.Willow={attitude:'',knowledge:[],events:[],aliases:[]};memory.npcs['Princess Willow']={attitude:'',knowledge:[],events:[],aliases:[]};
     applyMuts('[MERGE:npc|Willow|Princess Willow]',{deferSave:true});
   }else applyBlueprint(p.bp);
   document.getElementById('api-screen').style.display='none';showGame();syncUI();
 },{empty,bp:oneBlueprint,wanted,other:chosen738,mode});}
 async function openWorldNpc738(name){
   await page.evaluate(()=>{var m=document.getElementById('npc-modal');if(m)m.remove();});
   await page.locator('#state-btn').click();
   await page.locator('.sb-npc-row[data-npc="'+name+'"]').click();
 }
 async function decoded738(id){await page.waitForFunction(id=>{var i=document.getElementById(id);return i&&i.complete&&i.naturalWidth>0;},id);return page.evaluate(id=>{var i=document.getElementById(id),avatar=i&&i.parentElement,r=avatar&&avatar.getBoundingClientRect(),hit=r&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!i&&i.getAttribute('src')===window.__portrait738&&getComputedStyle(i).display!=='none'&&getComputedStyle(i).visibility==='visible'&&r.width>0&&r.height>0&&hit===i;},id);}
 async function manual738(refuse){
   await fresh738('seed');await openWorldNpc738('Princess Willow');
   await page.evaluate(refuse=>{
     window.__oldCall738=callGM;window.__oldGenerate738=generateNpcSheet;window.__generationDone738=false;window.__gmCount738=0;
     callGM=function(){window.__gmCount738++;var s=buildCompanionSheetStub('Princess Willow');s.portrait=null;if(refuse)s.sheetVer=99999;return Promise.resolve(JSON.stringify(s));};
     generateNpcSheet=function(){return window.__oldGenerate738.apply(this,arguments).finally(function(){window.__generationDone738=true;});};
   },refuse);
   try{await page.locator('#npc-gen-sheet').click();await page.waitForFunction(()=>window.__generationDone738);
     return await page.evaluate(()=>{var n=wsNpcByName('Princess Willow');showNpcSheet(n.name);return {calls:window.__gmCount738,hasSheet:!!n.charSheet,rowHasImage:n.portrait===window.__portrait738,sheetHasImage:!!n.charSheet&&n.charSheet.portrait===window.__portrait738,busy:busy,reasonShown:/newer version|Sheet refused|newer build/i.test(document.body.textContent)};});
   }finally{await page.evaluate(()=>{callGM=window.__oldCall738;generateNpcSheet=window.__oldGenerate738;});}
 }
 await check738('World State opens the authored NPC image without a character sheet',async()=>{
   await fresh738('seed');await openWorldNpc738('Princess Willow');assert(await decoded738('npc-portrait-img'),'World State NPC avatar decodes the source image');
   assert.equal(await page.evaluate(()=>!!wsNpcByName('Princess Willow').charSheet),false);await picture('738-world-state-authored.png');
 });
 await check738('manual sheet generation keeps the authored image and releases busy',async()=>{
   const r=await manual738(false);assert.deepEqual(r,{calls:1,hasSheet:true,rowHasImage:false,sheetHasImage:true,busy:false,reasonShown:false});assert(await decoded738('npc-portrait-img'));await picture('738-manual-sheet.png');
 });
 await check738('refused manual sheet retains the roster image and releases busy',async()=>{
   const r=await manual738(true);assert.deepEqual(r,{calls:1,hasSheet:false,rowHasImage:true,sheetHasImage:false,busy:false,reasonShown:true});assert(await decoded738('npc-portrait-img'));await picture('738-manual-refused.png');
 });
 await check738('an exact existing companion receives the authored image once',async()=>{
   await fresh738('exact');const r=await page.evaluate(()=>{var n=wsNpcByName('Princess Willow');showNpcSheet(n.name);return {same:n===window.__existing738,count:worldState.npcs.filter(x=>x.name==='Princess Willow').length,image:npcPortrait(n)===window.__portrait738,sheetImage:n.charSheet.portrait===window.__portrait738,rowEmpty:!n.portrait};});
   assert.deepEqual(r,{same:true,count:1,image:true,sheetImage:true,rowEmpty:true});assert(await decoded738('npc-portrait-img'));await picture('738-existing-companion.png');
 });
 await check738('an existing chosen image wins and approximate or absent sources are skipped',async()=>{
   await fresh738('chosen');assert(await page.evaluate(p=>npcPortrait(wsNpcByName('Princess Willow'))===p,chosen738),'existing chosen image is preserved');
   await fresh738('approximate');const r=await page.evaluate(()=>({untouched:JSON.stringify(window.__existing738)===window.__beforeExisting738,unmatched:window.__existing738.every(n=>!npcPortrait(n)),names:window.__existing738.map(n=>n.name)}));
   assert.deepEqual(r,{untouched:true,unmatched:true,names:['Willow','Princess Willow II','Unlisted Guide']});
 });
 await check738('accepted row merge supplies conversation Car artwork and scene references',async()=>{
   await fresh738('row-merge');
   const portraitState=await page.evaluate(()=>{var n=wsNpcByName('Willow');return {rowCount:worldState.npcs.length,canonical:npcPortrait(n)===window.__portrait738,sheet:n.charSheet.portrait===window.__portrait738,scene:collectRenderSeeds({img2img:{partyRefs:true,multiSeed:true,maxSeeds:4}},worldState.character,[n]).urls.indexOf(window.__portrait738)>=0};});
   await page.evaluate(()=>{
     window.__oldVoice738=TTS;window.__oldMic738=STT;var noop=function(){};
     TTS=Object.assign({},TTS,{isPlaying:function(){return false;},isPaused:function(){return false;},isOn:function(){return false;},speak:noop,stop:noop,pause:noop,skip:noop,setOnDone:noop,primeAudioSession:noop,stopAudioSessionPrimer:noop,earcon:noop});STT=null;
     showTalk('Willow');
   });
   let talk,car;
   try{
     talk=await page.evaluate(()=>({name:document.getElementById('car-name').textContent,image:document.getElementById('car-portrait-img').getAttribute('src')===window.__portrait738&&getComputedStyle(document.getElementById('car-portrait-img')).display!=='none',artwork:navigator.mediaSession.metadata.artwork.some(a=>a.src===window.__portrait738)}));
     await picture('738-conversation-artwork.png');
     await page.evaluate(()=>{carSessionStop();worldState.activePC='Willow';showCarMode();});
     car=await page.evaluate(()=>({name:document.getElementById('car-name').textContent,image:document.getElementById('car-portrait-img').getAttribute('src')===window.__portrait738&&getComputedStyle(document.getElementById('car-portrait-img')).display!=='none',artwork:navigator.mediaSession.metadata.artwork.some(a=>a.src===window.__portrait738)}));
     await picture('738-car-artwork.png');
   }finally{await page.evaluate(()=>{if(carMode)carSessionStop();TTS=window.__oldVoice738;STT=window.__oldMic738;});}
   assert.deepEqual({portraitState,talk,car},{portraitState:{rowCount:1,canonical:true,sheet:true,scene:true},talk:{name:'Willow',image:true,artwork:true},car:{name:'Willow',image:true,artwork:true}});
 });
 await check738('accepted sheet merge keeps the authored image in character and party exports',async()=>{
   await fresh738('sheet-merge');await page.evaluate(()=>{
     window.__oldExport738=exportToFolder;window.__oldConnected738=storageAdapter.isServerMode;window.__oldList738=storageAdapter.listCharacterLibrary;window.__oldSaveChar738=storageAdapter.saveCharacterToLibrary;window.__charExport738=null;window.__libraryExports738=[];
     exportToFolder=function(type,blob){return blob.text().then(function(s){window.__charExport738={type:type,data:JSON.parse(s)};return true;});};
     storageAdapter.isServerMode=function(){return true;};storageAdapter.listCharacterLibrary=function(cb){cb(null,[]);};storageAdapter.saveCharacterToLibrary=function(sheet,cb){window.__libraryExports738.push(JSON.parse(JSON.stringify(sheet)));cb(null);};showNpcSheet('Willow');
   });
   try{
     await page.locator('#npc-export-btn').click();await page.locator('#ceo-file').click();await page.waitForFunction(()=>!!window.__charExport738);
     const file=await page.evaluate(()=>({type:window.__charExport738.type,name:window.__charExport738.data.character.name,image:window.__charExport738.data.character.portrait===window.__portrait738}));
     await page.locator('#npc-export-btn').click();await page.locator('#ceo-character-library').click();await page.waitForFunction(()=>window.__libraryExports738.length===1);
     const single=await page.evaluate(()=>window.__libraryExports738[0].portrait===window.__portrait738);
     const party=await page.evaluate(()=>{window.__libraryExports738=[];uploadPartyToLibrary();var p=window.__libraryExports738.filter(n=>n.name==='Willow');return p.length===1&&p[0].portrait===window.__portrait738;});
     assert.deepEqual({file,single,party},{file:{type:'character',name:'Willow',image:true},single:true,party:true});assert(await decoded738('npc-portrait-img'));await picture('738-merged-export.png');
   }finally{await page.evaluate(()=>{exportToFolder=window.__oldExport738;storageAdapter.isServerMode=window.__oldConnected738;storageAdapter.listCharacterLibrary=window.__oldList738;storageAdapter.saveCharacterToLibrary=window.__oldSaveChar738;});}
 });
 await check738('removing an authored image survives a real browser reload',async()=>{
   for(const sheet of [false,true]){
     await fresh738('seed');await page.evaluate(sheet=>{var n=wsNpcByName('Princess Willow');if(sheet){n.partyMember=true;attachCompanionSheet(n.name,buildCompanionSheetStub(n.name));}showNpcSheet(n.name);},sheet);
     await page.locator('#npc-avatar-btn').click();await page.locator('#pm-remove-portrait').click();
     assert(await page.evaluate(()=>!npcPortrait(wsNpcByName('Princess Willow'))),'explicit removal clears the canonical owner');
     await page.goto('http://portraits734.test/index.html');await page.waitForFunction(()=>typeof loadState==='function'&&typeof showNpcSheet==='function');
     const r=await page.evaluate(()=>{loadState();generateActions=function(){};speakNarration=function(){};processPendingCompanionSheets=function(){};document.getElementById('api-screen').style.display='none';showGame();syncUI();showNpcSheet('Princess Willow');var n=wsNpcByName('Princess Willow');return {exists:!!n,image:!!npcPortrait(n),visible:!!document.getElementById('npc-portrait-img'),hasSheet:!!n.charSheet};});
     assert.deepEqual(r,{exists:true,image:false,visible:false,hasSheet:sheet});await picture('738-removed-reloaded-'+(sheet?'sheet':'row')+'.png');
   }
 });
 console.log((failures738.length?'FAILED':'ALL GREEN')+' — '+passed738+'/8 #738 portrait browser groups; '+shots);
 if(failures738.length)throw new Error('#738 portrait browser failures: '+failures738.join('; '));
 assert.deepEqual(errors,[]);console.log('PASS #734 blueprint, companion and imported portraits decode in the real sheet; '+shots);
}finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
