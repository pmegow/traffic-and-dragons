const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js');
const root=path.resolve(__dirname,'..'),shots=process.env.SIGNUP_SHOTS;
(async()=>{const browser=await chromium.launch({headless:true});try{
 const ctx=await browser.newContext({viewport:{width:1200,height:900},serviceWorkers:'block'});
 let identityError=false,entitled=false;const t0=Date.now(),flyLog=[];
 await ctx.route('**/*',async r=>{const u=new URL(r.request().url());
  if(u.hostname==='traffic-and-dragons-server.fly.dev'){flyLog.push((Date.now()-t0)+'ms '+r.request().method()+' '+u.pathname);
   const body=u.pathname==='/auth/me'?{username:'Peter (test account)'}:u.pathname==='/api/account'?{username:'Peter (test account)',entitled:entitled}:u.pathname==='/api/prefs/speaker_stars'?{value:[],rev:1}:{};
   return r.fulfill({status:identityError&&u.pathname==='/api/account'?401:200,contentType:'application/json',body:JSON.stringify(body)});
  }
  const folder=u.hostname==='trafficanddragons.com'?'website':u.hostname==='traffic-and-dragons.pages.dev'?'':null;
  if(folder===null)return r.abort();const file=path.resolve(root,folder,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
  if(!file.startsWith(root+path.sep))return r.abort();
  try{return r.fulfill({status:200,contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.jpeg':'image/jpeg','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});}catch(e){return r.fulfill({status:404,body:'Not found'});}
 });
 await ctx.addInitScript(()=>{if(location.hostname==='traffic-and-dragons.pages.dev'){
  localStorage.setItem('tnd_server_url_v1','https://traffic-and-dragons-server.fly.dev');localStorage.setItem('tnd_server_tok_v1','TEST_ONLY');
  localStorage.setItem('tnd_ak_v1','TEST_ONLY');localStorage.setItem('tnd_ambient_enabled_v1','0');
 }});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const shot=async n=>{if(shots){fs.mkdirSync(shots,{recursive:true});await page.screenshot({path:path.join(shots,n+'.png')});}};
 await page.goto('https://trafficanddragons.com/');await page.locator('.module-return a').click();
 if(process.argv.includes('--before')){
  await page.waitForFunction(()=>typeof initState==='function'&&document.getElementById('api-screen').style.display==='none');
  await shot('before-signup-opens-wizard');console.log('REPRODUCED: homepage Sign up skips authentication with saved credentials');return;
 }
 await page.waitForFunction(()=>document.getElementById('invitation')&&!document.getElementById('invitation').hidden);
 assert.equal(await page.evaluate(()=>document.getElementById('heading').textContent),'Would you like to sign up?');
 assert.equal(await page.evaluate(()=>document.getElementById('providers').hidden&&document.getElementById('account').hidden),true);
 await shot('signup-invitation-desktop');
 for(const width of [390,320]){await page.setViewportSize({width,height:850});await shot('signup-invitation-'+width);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'invitation fits '+width);}
 await page.locator('#signup-decline').click();assert.equal(await page.evaluate(()=>location.hostname),'trafficanddragons.com');
 await page.locator('.module-return a').click();await page.waitForFunction(()=>!document.getElementById('invitation').hidden);
 await page.locator('#signup-confirm').click();
 await page.setViewportSize({width:1200,height:900});
 try{await page.waitForFunction(()=>document.getElementById('account')&&!document.getElementById('account').hidden);}
 catch(e){/* the flake of 2026-10-19: say what the page showed, not just that it timed out */
  const st=await page.evaluate(()=>({href:location.href,heading:document.getElementById('heading')&&document.getElementById('heading').textContent,status:document.getElementById('status')&&document.getElementById('status').textContent,visible:['invitation','providers','account','recovery','check-access'].filter(id=>{const el=document.getElementById(id);return el&&!el.hidden;}),serverMode:(typeof storageAdapter!=='undefined'&&storageAdapter.isServerMode)?storageAdapter.isServerMode():'n/a',tok:localStorage.getItem('tnd_server_tok_v1')})).catch(x=>'page state unreadable: '+x);
  console.error('[#615] the account screen did not show — page: '+JSON.stringify(st)+' — fly.dev requests: '+JSON.stringify(flyLog)+' — page errors: '+JSON.stringify(errors));throw e;}
 assert.equal(await page.evaluate(()=>location.pathname),'/signup.html','Sign up always lands on its own page');
 assert.equal(await page.evaluate(()=>typeof initState),'undefined','signup does not boot game');
 await shot('signup-existing-desktop');
 if(process.argv.includes('--before-access')){console.log('REPRODUCED: unentitled account is offered home/game links');return;}
 assert.equal(await page.evaluate(()=>document.getElementById('heading').textContent),'Account requested — awaiting access');
 assert.equal(await page.evaluate(()=>document.getElementById('account-home').hidden&&document.getElementById('continue-game').hidden),true);
 for(const width of [390,320]){await page.setViewportSize({width,height:850});await shot('signup-awaiting-'+width);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'awaiting screen fits '+width);}
 entitled=true;await page.locator('#check-access').click();await page.waitForFunction(()=>!document.getElementById('account-home').hidden);
 await shot('signup-approved-320');
 entitled=false;await page.evaluate(()=>window.__signupTest.refresh());await page.waitForFunction(()=>!document.getElementById('check-access').hidden);
 assert.equal(await page.evaluate(()=>document.getElementById('account-home').hidden),true);
 await page.setViewportSize({width:1200,height:900});
 await page.locator('#signout').click();await page.waitForFunction(()=>!document.getElementById('invitation').hidden);
 assert.equal(await page.evaluate(()=>document.getElementById('providers').hidden),true);
 await page.locator('#signup-confirm').click();await page.waitForFunction(()=>!document.getElementById('providers').hidden);
 await shot('signup-fresh-desktop');
 for(const width of [390,320]){await page.setViewportSize({width,height:850});await shot('signup-fresh-'+width);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow at '+width);}
 await page.evaluate(()=>{window.open=function(url){window.__opened=url;return null;};});
 await page.locator('#signup-google').click();assert.match(await page.evaluate(()=>document.getElementById('status').textContent),/Popup blocked/);
 await shot('signup-popup-blocked-320');
 assert.equal(await page.evaluate(()=>window.__opened),'https://traffic-and-dragons-server.fly.dev/auth/google');
 await page.evaluate(()=>{window.open=function(url){window.__opened=url;return {closed:false,close:function(){this.closed=true;},focus:function(){},location:{href:''}};};});
 await page.locator('#signup-github').click();assert.equal(await page.evaluate(()=>window.__opened),'https://traffic-and-dragons-server.fly.dev/auth/github');
 await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{origin:'https://traffic-and-dragons-server.fly.dev',data:{type:'tnd-auth',sessionId:'TEST_NEW',username:'Peter (test account)'}})));
 await page.waitForFunction(()=>!document.getElementById('account').hidden);
 assert.equal(await page.evaluate(()=>location.pathname),'/signup.html','OAuth success waits for explicit continuation');
 assert.equal(await page.evaluate(()=>localStorage.getItem('tnd_server_tok_v1')),'TEST_NEW','shared adapter persists session on game origin');
 assert.equal(await page.evaluate(()=>document.getElementById('heading').textContent),'Account requested — awaiting access');
 assert.equal(await page.evaluate(()=>document.getElementById('account-home').hidden),true);
 await shot('signup-success-320');
 identityError=true;await page.evaluate(()=>window.__signupTest.refresh());await page.waitForFunction(()=>!document.getElementById('recovery').hidden);
 assert.equal(await page.evaluate(()=>document.getElementById('account').hidden),true);await shot('signup-expired-320');
 assert.deepEqual(errors,[]);console.log('PASS signup browser: saved session, explicit sign-out, 320/390/1200px, blocked popup, provider routes, OAuth handoff, expired identity; zero page errors');
}finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
