const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict'),cp=require('child_process');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..'),scratch=fs.mkdtempSync(path.join(os.tmpdir(),'tnd-review-browser-'));
const files=['audits/capability_vulnerabilities.html','audits/capability_vulnerabilities.json','satellite.css','dev/bible-server.js','dev/bible-editor-version.js','dev/bible-helper-version.js','dev/capability-review-store.js','dev/capability-redraft.js','dev/launch-bible-editor.js'];
let browser,server,failed=0;
async function check(name,fn){try{await fn();console.log('PASS #603 '+name);}catch(e){failed++;console.error('FAIL #603 '+name+' — '+e.stack);}}
(async()=>{try{
for(const file of files){fs.mkdirSync(path.dirname(path.join(scratch,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(scratch,file));}
const manifest=JSON.parse(fs.readFileSync(path.join(scratch,'audits/capability_vulnerabilities.html'),'utf8').match(/<script id="audit-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
fs.writeFileSync(path.join(scratch,'audits/capability_vulnerabilities.json'),JSON.stringify({format:'traffic-and-dragons/capability-review/v1',audit:manifest.id,reviews:manifest.rows.map(r=>({key:r.key,decision:'pending',replacement:r.effect,notes:''}))}));
server=cp.spawn(process.execPath,[path.join(scratch,'dev/bible-server.js')],{env:{...process.env,BIBLE_PORT:'0'},stdio:['ignore','pipe','pipe'],windowsHide:true});
const port=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error('server startup timed out')),10000);server.stdout.on('data',c=>{out+=c;const m=out.match(/listening on http:\/\/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(timer);resolve(+m[1]);}});server.once('exit',()=>{clearTimeout(timer);reject(Error('server exited'));});});
const origin='http://127.0.0.1:'+port,version=require('./bible-helper-version.js'),file=path.join(scratch,'audits/capability_vulnerabilities.json');
await check('review endpoint refuses foreign origins, stale protocols and oversized payloads',async()=>{
 const before=fs.readFileSync(file,'utf8');
 for(const [from,v,status] of [['https://example.com',version,403],['null',version,403],[origin,'old',409]]){
 const res=await fetch(origin+'/capability-review',{method:'POST',headers:{Origin:from,'X-Bible-Helper-Version':v},body:'{}'});assert.equal(res.status,status);
 }
 const res=await fetch(origin+'/capability-review',{method:'POST',headers:{Origin:origin,'X-Bible-Helper-Version':version},body:' '.repeat(1000001)});assert.equal(res.status,413);assert.equal(fs.readFileSync(file,'utf8'),before);
 const run=cp.spawnSync(process.execPath,[path.join(scratch,'dev/launch-bible-editor.js'),'--review'],{env:{...process.env,BIBLE_PORT:String(port),BIBLE_LAUNCH_NO_OPEN:'1'},encoding:'utf8',windowsHide:true});assert.equal(run.status,0,run.stderr);assert.ok(run.stdout.includes('/audits/capability_vulnerabilities.html'));
});
browser=await chromium.launch({headless:true});const ctx=await browser.newContext({viewport:{width:1280,height:1000},serviceWorkers:'block'}),page=await ctx.newPage(),errors=[];let downloads=0;
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.on('download',()=>downloads++);
await page.goto(origin+'/audits/capability_vulnerabilities.html');await page.waitForFunction(()=>!document.getElementById('save').disabled);
const first='#cap-0-text';
await check('redraft endpoint rejects bad requests without launching Astra',async()=>{
 for(const [from,v,status] of [['https://example.com',version,403],[origin,'old',409],[origin,version,422]]){
  const res=await fetch(origin+'/capability-redraft',{method:'POST',headers:{Origin:from,'X-Bible-Helper-Version':v},body:'{}'});assert.equal(res.status,status);
 }
 assert.equal((await fetch(origin+'/capability-redraft')).status,405);
});
async function save(){await page.locator('#save').click();await page.waitForFunction(()=>document.getElementById('file-state').textContent.startsWith('Saved audits/'));}
await check('all 507 rows are available and priority findings are the default',async()=>{
 assert.equal(await page.locator('.row').count(),507);assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.row')].filter(r=>!r.hidden).length),17);
 await page.evaluate(()=>{document.getElementById('scope').value='all';document.getElementById('scope').dispatchEvent(new Event('change'));});await page.locator('#search').fill('guardian of nature');assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.row')].filter(r=>!r.hidden).length),1);assert.match(await page.locator('#count').textContent(),/1 shown/);
 await page.locator('#search').fill('');await page.evaluate(()=>{document.getElementById('scope').value='wording';document.getElementById('scope').dispatchEvent(new Event('change'));});
 if(process.env.REVIEW_SCREENSHOT_DIR){fs.mkdirSync(process.env.REVIEW_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.REVIEW_SCREENSHOT_DIR,'review-desktop.png')});}
});
await check('duration findings leave flagged filters but remain available for optional editing',async()=>{
 const shield=manifest.rows.findIndex(r=>r.key==='shield');
 await page.evaluate(()=>{document.getElementById('scope').value='flagged';document.getElementById('scope').dispatchEvent(new Event('change'));});assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.row')].filter(r=>!r.hidden).length),59);assert.equal(await page.evaluate(i=>document.getElementById('cap-'+i).hidden,shield),true);
 assert.match(await page.locator('#scope').textContent(),/All flagged descriptions \(59\)/);
 await page.evaluate(()=>{document.getElementById('scope').value='unflagged';document.getElementById('scope').dispatchEvent(new Event('change'));});assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.row')].filter(r=>!r.hidden).length),448);assert.equal(await page.evaluate(i=>document.getElementById('cap-'+i).hidden,shield),false);
 assert.match(await page.locator('#cap-'+shield+' .reason').textContent(),/excluded/);
 await page.evaluate(()=>{document.getElementById('scope').value='wording';document.getElementById('scope').dispatchEvent(new Event('change'));});
});
await check('decision backgrounds cover unchanged rewrites and kept wording with the requested hue',async()=>{
 const colors=()=>page.evaluate(()=>{function rgb(color){const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);}return {pending:rgb(getComputedStyle(document.getElementById('cap-2')).backgroundColor),rewrite:rgb(getComputedStyle(document.getElementById('cap-0')).backgroundColor),keep:rgb(getComputedStyle(document.getElementById('cap-1')).backgroundColor),reference:rgb(getComputedStyle(document.documentElement).getPropertyValue('--acc-bg').trim())};});
 function hsv(rgb){const max=Math.max(...rgb),min=Math.min(...rgb),d=max-min;let h=d===0?0:max===rgb[0]?60*((rgb[1]-rgb[2])/d%6):max===rgb[1]?60*((rgb[2]-rgb[0])/d+2):60*((rgb[0]-rgb[1])/d+4);return {h:(h+360)%360,s:max?d/max:0,v:max};}
 async function decide(i,value){await page.evaluate(({i,value})=>{const el=document.getElementById('cap-'+i+'-decision');el.value=value;el.dispatchEvent(new Event('change'));},{i,value});}
 try{
  await decide(0,'rewrite');await page.locator('#cap-1 .keep').click();
  if(process.env.REVIEW_SCREENSHOT_DIR){await page.setViewportSize({width:1280,height:1700});await page.evaluate(()=>document.getElementById('cap-0').scrollIntoView());await page.screenshot({path:path.join(process.env.REVIEW_SCREENSHOT_DIR,'review-decisions.png')});await page.setViewportSize({width:1280,height:1000});}
  const c=await colors(),base=hsv(c.reference),keep=hsv(c.keep);assert.deepEqual(c.rewrite,c.reference,'unchanged text with rewrite decision must be tinted');assert.notDeepEqual(c.keep,c.pending,'keep decision must be tinted');assert.equal(keep.v,base.v,'kept wording must retain the same color value');assert.ok(Math.abs(keep.s-base.s)<0.01,'kept wording must retain saturation');assert.ok(Math.abs(keep.h-base.h*0.9)<=2,'keep hue must be 10% closer to zero: '+JSON.stringify({base,keep}));
  await decide(0,'pending');await decide(1,'pending');const reset=await colors();assert.deepEqual(reset.rewrite,reset.pending);assert.deepEqual(reset.keep,reset.pending);
  await page.locator('#cap-0-text').fill('A changed draft returned to awaiting decision');await decide(0,'pending');assert.deepEqual((await colors()).rewrite,reset.pending,'pending decision must clear tint even if the text differs');
 }finally{await decide(0,'pending');await decide(1,'pending');await page.evaluate(()=>window.scrollTo(0,0));}
});
await check('editing an awaiting-decision row does not hide the active field',async()=>{
 await page.evaluate(()=>{document.getElementById('status').value='pending';document.getElementById('status').dispatchEvent(new Event('change'));});
 try{await page.locator(first).fill('Still typing');assert.equal(await page.evaluate(()=>document.getElementById('cap-0').hidden),false);}
 finally{await page.evaluate(()=>{document.getElementById('status').value='all';document.getElementById('status').dispatchEvent(new Event('change'));});}
});
await check('Astra redraft inserts a recoverable draft, supports undo, and preserves late edits',async()=>{
 let release,response={ok:true,model:'gpt-6-astra',key:'augury',replacement:'Astra fixture: a fresh omen for the next 30 minutes.'},calls=0,fail=false;
 await ctx.route('**/capability-redraft',async route=>{calls++;await new Promise(resolve=>release=resolve);return route.fulfill({status:fail?503:200,contentType:'application/json',body:JSON.stringify(fail?{ok:false,output:'Astra unavailable'}:response)});});
 const before=await page.locator(first).inputValue();await page.locator('#cap-0 .redraft').click();await page.waitForFunction(()=>document.querySelector('#cap-0 .redraft').disabled);assert.equal(calls,1);release();await page.waitForFunction(()=>document.getElementById('cap-0-text').value.startsWith('Astra fixture:'));assert.equal(await page.locator('#cap-0-decision').inputValue(),'rewrite');await page.locator('#cap-0 .undo-redraft').click();assert.equal(await page.locator(first).inputValue(),before);
 await page.locator('#cap-0 .redraft').click();await page.waitForFunction(()=>document.querySelector('#cap-0 .redraft').disabled);await page.locator(first).fill('Manual edit while Astra works');release();await page.waitForFunction(()=>document.querySelector('#cap-0 .redraft-status').textContent.includes('Your draft changed'));assert.equal(await page.locator(first).inputValue(),'Manual edit while Astra works');
 fail=true;await page.locator('#cap-0 .redraft').click();await page.waitForFunction(()=>document.querySelector('#cap-0 .redraft').disabled);release();await page.waitForFunction(()=>document.querySelector('#cap-0 .redraft-status').textContent.includes('Redraft failed'));assert.equal(await page.locator(first).inputValue(),'Manual edit while Astra works');
 fail=false;await page.locator('#cap-0 .redraft').click();await page.waitForFunction(()=>document.querySelector('#cap-0 .redraft').disabled);release();await page.waitForFunction(()=>document.getElementById('cap-0-text').value.startsWith('Astra fixture:'));await page.reload();await page.waitForFunction(()=>!document.getElementById('save').disabled);assert.equal(await page.locator(first).inputValue(),response.replacement);await save();assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).reviews[0].replacement,response.replacement);
});
await check('edits survive reload and Save writes the project without a download',async()=>{
 await page.locator(first).fill('Review draft — exact numbers stay 30 minutes.');await page.reload();await page.waitForFunction(()=>!document.getElementById('save').disabled);assert.equal(await page.locator(first).inputValue(),'Review draft — exact numbers stay 30 minutes.');await save();assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).reviews[0].replacement,'Review draft — exact numbers stay 30 minutes.');assert.equal(downloads,0);
});
await check('invalid import preserves edits, valid import and keep decisions round trip',async()=>{
 fs.writeFileSync(path.join(scratch,'bad.json'),'{"reviews":[]}');await page.locator('#import-file').setInputFiles(path.join(scratch,'bad.json'));await page.waitForFunction(()=>document.getElementById('notice').textContent.startsWith('Import stopped'));assert.equal(await page.locator(first).inputValue(),'Review draft — exact numbers stay 30 minutes.');
 const doc=JSON.parse(fs.readFileSync(file,'utf8'));doc.reviews[0].replacement='Imported revision';fs.writeFileSync(path.join(scratch,'import.json'),JSON.stringify(doc));await page.locator('#import-file').setInputFiles(path.join(scratch,'import.json'));await page.waitForFunction(()=>document.getElementById('cap-0-text').value==='Imported revision');await page.locator('#cap-0 .keep').click();await save();const saved=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(saved.reviews[0].decision,'keep');assert.notEqual(saved.reviews[0].replacement,'Imported revision');
});
await check('stale project saves refuse overwrite and keep the browser draft recoverable',async()=>{
 const doc=JSON.parse(fs.readFileSync(file,'utf8'));doc.reviews[1].notes='External decision';fs.writeFileSync(file,JSON.stringify(doc,null,2));const disk=fs.readFileSync(file,'utf8');
 await page.locator(first).fill('My unsaved conflict draft');await page.locator('#save').click();await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('changed on disk'));assert.equal(fs.readFileSync(file,'utf8'),disk);assert.equal(await page.locator(first).inputValue(),'My unsaved conflict draft');await page.reload();await page.waitForFunction(()=>!document.getElementById('save').disabled);assert.equal(await page.locator(first).inputValue(),'My unsaved conflict draft');assert.match(await page.locator('#notice').textContent(),/changed since this draft/);
 await page.locator('#export').click();await page.waitForFunction(()=>document.getElementById('cap-0-text').value==='My unsaved conflict draft');
 await page.locator('#load').click();await page.waitForFunction(()=>document.getElementById('cap-1-notes').value==='External decision');assert.notEqual(await page.locator(first).inputValue(),'My unsaved conflict draft');
});
await check('edits made during Save stay unsaved and recoverable',async()=>{
 await page.locator(first).fill('Submitted wording');await page.evaluate(()=>{const original=window.fetch;window.fetch=function(url,options){if(options&&options.method==='POST'){window.fetch=original;return new Promise(resolve=>{window.releaseReviewSave=()=>resolve(original(url,options));});}return original(url,options);};});await page.locator('#save').click();await page.locator(first).fill('Typed while saving');await page.evaluate(()=>window.releaseReviewSave());await page.waitForFunction(()=>document.getElementById('file-state').textContent.includes('newer edits'));assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).reviews[0].replacement,'Submitted wording');await page.reload();await page.waitForFunction(()=>!document.getElementById('save').disabled);assert.equal(await page.locator(first).inputValue(),'Typed while saving');
});
await check('long literal edits fit a narrow viewport and remain text',async()=>{
 await page.setViewportSize({width:320,height:900});await page.locator(first).fill('<img src=x onerror=alert(1)> '+('longword'.repeat(100)));assert.equal(await page.locator('.row img').count(),0);const size=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width,JSON.stringify(size));await page.evaluate(()=>document.getElementById('cap-0-text').scrollIntoView({block:'center'}));if(process.env.REVIEW_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.REVIEW_SCREENSHOT_DIR,'review-mobile-edit.png')});
});
await check('vulnerability progress ignores optional rows and survives save/reload',async()=>{
 const review={format:'traffic-and-dragons/capability-review/v1',audit:manifest.id,reviews:manifest.rows.map((r,i)=>({key:r.key,decision:i<6?'rewrite':'pending',replacement:i<6?'Reviewed wording: '+r.effect:r.effect,notes:''}))};
 const imported=path.join(scratch,'completion.json');fs.writeFileSync(imported,JSON.stringify(review));await page.locator('#import-file').setInputFiles(imported);await page.waitForFunction(()=>document.getElementById('completion').textContent==='6/59 vulnerabilities addressed.');
 assert.match(await page.locator('#count').textContent(),/6 of 507 decisions/);
 await page.evaluate(()=>{document.getElementById('scope').value='flagged';document.getElementById('scope').dispatchEvent(new Event('change'));window.scrollTo(0,0);});
 for(const width of [1280,320]){await page.setViewportSize({width,height:900});const size=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,saveBottom:document.getElementById('file-state').getBoundingClientRect().bottom,progressTop:document.getElementById('completion').getBoundingClientRect().top}));assert.ok(size.scroll<=size.width);assert.ok(size.progressTop>=size.saveBottom,JSON.stringify(size));if(process.env.REVIEW_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.REVIEW_SCREENSHOT_DIR,'review-completion-'+width+'.png')});}
 await page.setViewportSize({width:1280,height:1000});review.reviews.forEach((r,i)=>{if(manifest.rows[i].level!=='unflagged'){r.decision='keep';r.replacement=manifest.rows[i].effect;}});fs.writeFileSync(imported,JSON.stringify(review));await page.locator('#import-file').setInputFiles(imported);await page.waitForFunction(()=>document.getElementById('completion').textContent==='59/59 vulnerabilities addressed.');await save();
 assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).reviews.filter(r=>r.decision==='pending').length,448);await page.reload();await page.waitForFunction(()=>!document.getElementById('save').disabled);assert.equal(await page.locator('#completion').textContent(),'59/59 vulnerabilities addressed.');
});
await check('browser-storage refusal is visible and project Save still works',async()=>{
 await page.evaluate(()=>{Storage.prototype.setItem=function(){throw Error('storage disabled');};});await page.locator(first).fill('Project save despite storage refusal');assert.match(await page.locator('#draft-state').textContent(),/recovery unavailable/);await save();assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).reviews[0].replacement,'Project save despite storage refusal');
});
await check('no unexpected browser exceptions',()=>assert.deepEqual(errors,[]));
}finally{if(browser)await browser.close();if(server){server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));}fs.rmSync(scratch,{recursive:true,force:true});}process.exitCode=failed?1:0;})().catch(e=>{console.error(e.stack);process.exitCode=1;});
