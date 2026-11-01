// #678: usernames stay visible and inert in both unfiled and synced report cards.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');const root=path.resolve(__dirname,'..');
const shots=process.env.TND_SCREENSHOT_DIR||path.join(root,'testRuns','reporter-678');
const hostile='<img src=x onerror="window.reporterInjected=true">';
const detail=name=>'Reporter: '+JSON.stringify({username:name,state:name===null?'signed-out':'account'})+'\n\nFixture context';
const report=(id,name)=>({id,kind:'user-report',receivedAt:'2026-10-31T20:00:00Z',app:'fixture',camp:'Fixture',turn:0,message:'Fixture issue',detail:detail(name)});
const named=report('named','Mira Vale'),unsafe=report('unsafe',hostile),guest=report('guest',null),old={id:'old',kind:'crash',message:'Older report',detail:'No username was collected'};
const md='## Open\n\n## B900 — Filed fixture\n**Status:** new\n**Report ids:** named\n\n### Report (untrusted)\n\n```text\n'+JSON.stringify(named,null,2)+'\n```\n';
const duplicateMd=md+'\n### Reporters (untrusted account metadata)\n\n```json\n'+JSON.stringify([{reportId:'named',username:'Mira Vale',state:'account'},{reportId:'another',username:'Lin Park',state:'account'},{reportId:'repeat',username:'Mira Vale',state:'account'}],null,2)+'\n```\n';
(async()=>{const browser=await chromium.launch({headless:true});try{
 const ctx=await browser.newContext({viewport:{width:1100,height:900},serviceWorkers:'block'});
 await ctx.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='reporter.test')return r.abort();if(u.pathname==='/DOC/BUGS.md')return r.fulfill({body:md});if(u.pathname==='/DOC/QA_ACTIVITY.md')return r.fulfill({body:''});const f=path.resolve(root,'.'+u.pathname);if(!f.startsWith(root+path.sep))return r.abort();try{return r.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});}catch(e){return r.fulfill({status:404,body:''});}});
 const page=await ctx.newPage();await page.goto('http://reporter.test/bug_tracker.html');await page.waitForFunction(()=>!!window.__bugTrackerTest);
 await page.evaluate(({named,unsafe,guest,old,md,duplicateMd})=>{const api=__bugTrackerTest,root=document.getElementById('content');root.textContent='';[named,unsafe,guest,old].forEach(r=>root.appendChild(api.renderFeedReport(r)));root.appendChild(api.renderBug(api.parseBugs(md)[0]));root.appendChild(api.renderBug(api.parseBugs(duplicateMd)[0]));},{named,unsafe,guest,old,md,duplicateMd});
 await page.bringToFront();await page.waitForTimeout(600);await page.screenshot({path:path.join(shots,'reporter-desktop.png')});
 const rows=await page.evaluate(()=>Array.from(document.querySelectorAll('.reporter')).map(e=>e.textContent));
 assert.equal(rows[0],'Reported by: Mira Vale','#678 live feed visibly names the reporter');assert.equal(rows[1],'Reported by: '+hostile);assert.equal(rows[2],'Reported by: Not signed in');assert.equal(rows[3],'Reported by: Not recorded');assert.equal(rows[4],'Reported by: Mira Vale','#678 synced report visibly names the reporter');assert.equal(rows[5],'Reported by: Mira Vale, Lin Park','#678 duplicate sync keeps every reporter once');
 assert.equal(await page.evaluate(()=>!!window.reporterInjected||document.querySelectorAll('.reporter img').length>0),false,'#678 reporter names are inert text');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);await page.screenshot({path:path.join(shots,'reporter-phone.png')});
 assert(await page.evaluate(()=>Array.from(document.querySelectorAll('.reporter')).every(e=>e.getBoundingClientRect().right<=innerWidth)),'#678 reporter names fit a phone');
 console.log('PASS #678 live/filed attribution, guest/legacy labels, hostile username rendered inert, desktop and phone');
}finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
