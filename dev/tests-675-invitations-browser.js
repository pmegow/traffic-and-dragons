// #675: real rendered operator and acceptance flows, with disposable transport only.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('./cdp-browser.js'),fixture=require('./admin-console-fixture.js');
function acceptanceFixture(){
 window.__inviteFixture={logins:0,accepts:0,hold:false,error:null};
 var f=window.__inviteFixture;
 window.storageAdapter={
  loginWithServer:function(url,cb,provider){f.logins++;f.provider=provider;if(f.hold)f.finishLogin=function(){cb(null,{});};else cb(null,{});},
  acceptInvitation:function(token,cb){f.accepts++;f.token=token;cb(f.error,{ok:true});}
 };
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1280,height:900}}),errors=[];
  await ctx.route('**/*',async r=>{
   const u=new URL(r.request().url());
   if(u.hostname==='admin.fixture'&&u.pathname==='/invitation.html'){
    let html=fs.readFileSync(path.join(__dirname,'..','invitation.html'),'utf8').replace(/<script src="(?:globals|data|helpers|inventory|state|storage-adapter)\.js(?:\?[^"]*)?"><\/script>/g,'');
    html=html.replace('<script src="invitation.js','<script>('+acceptanceFixture.toString()+')();</script><script src="invitation.js');
    return r.fulfill({status:200,contentType:'text/html',body:html});
   }
   return fixture.route(r);
  });
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://admin.fixture/admin_console.html');
  await page.waitForFunction(()=>window.__adminTest&&document.querySelectorAll('#users>details').length===30);
  assert.equal(await page.evaluate(()=>!!document.querySelector('details#invitations')),true,'#675 invitation frame exists');
  const out=process.env.TND_SCREENSHOT_DIR||path.join(__dirname,'..','testRuns','invitations-675');fs.mkdirSync(out,{recursive:true});
  await page.evaluate(()=>{document.getElementById('invitations').open=true;document.getElementById('invitations').scrollIntoView();});
  await page.screenshot({path:path.join(out,'operator-desktop.png')});
  await page.evaluate(()=>{document.getElementById('invite-email').value='tester@gmail.com';window.confirm=()=>false;document.getElementById('invite-send').click();});
  assert.equal(await page.evaluate(()=>window.__adminFixture.inviteSends||0),0,'#675 cancelled invitation sends nothing');
  await page.evaluate(()=>{window.confirm=()=>true;window.__adminFixture.holdInvite=true;document.getElementById('invite-send').click();document.getElementById('invite-send').click();});
  assert.equal(await page.evaluate(()=>window.__adminFixture.inviteSends),1,'#675 repeated invitation send is latched');
  await page.evaluate(()=>{window.__adminFixture.holdInvite=false;window.__adminFixture.finishInvite();});
  assert.match(await page.evaluate(()=>document.getElementById('invite-status').textContent),/accepted by the mail service/i,'#675 sending shows delivery receipt');
  await page.evaluate(()=>document.querySelector('[data-invite-action="resend"]').click());
  assert.equal(await page.evaluate(()=>window.__adminFixture.inviteResends),1,'#675 resend uses the selected invitation');
  await page.evaluate(()=>document.querySelector('[data-invite-action="revoke"]').click());
  assert.equal(await page.evaluate(()=>window.__adminFixture.inviteRevokes),1,'#675 revoke uses the selected invitation');
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{document.getElementById('invite-email').value='very.long.recipient+testing@gmail.com';document.getElementById('invite-send').click();document.getElementById('invitations').scrollIntoView();});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'#675 invitation form fits a phone');
  await page.screenshot({path:path.join(out,'operator-phone.png')});
  await page.evaluate(()=>{window.__adminFixture.inviteError='HTTP 503 fixture outage';document.getElementById('invite-history').click();});
  assert.match(await page.evaluate(()=>document.getElementById('invite-status').textContent),/503/,'#675 invitation history failure is visible');
  await page.evaluate(()=>{window.__adminFixture.account={isAdmin:false};window.__adminTest.refresh();});
  assert.equal(await page.evaluate(()=>document.getElementById('invite-send').disabled),true,'#675 signed-out operator cannot send');

  const token='a'.repeat(64);
  await page.goto('http://admin.fixture/invitation.html?admin_console#'+token);
  assert.equal(await page.evaluate(()=>window.__inviteFixture.logins+window.__inviteFixture.accepts),0,'#675 link preview never authenticates or accepts');
  await page.screenshot({path:path.join(out,'accept-phone.png')});
  await page.evaluate(()=>{window.__inviteFixture.hold=true;document.getElementById('invitation-accept').click();document.getElementById('invitation-accept').click();});
  assert.equal(await page.evaluate(()=>window.__inviteFixture.logins),1,'#675 repeated acceptance is latched');
  assert.equal(await page.evaluate(()=>window.__inviteFixture.provider),'google','#675 acceptance uses Google only');
  await page.evaluate(()=>{window.__inviteFixture.error='This invitation is for a different Gmail account.';window.__inviteFixture.hold=false;window.__inviteFixture.finishLogin();});
  assert.match(await page.evaluate(()=>document.getElementById('invitation-status').textContent),/different Gmail/,'#675 wrong Gmail remains a visible refusal');
  assert.equal(await page.evaluate(()=>document.getElementById('invitation-play').hidden),true,'#675 rejected acceptance cannot enter play');
  await page.screenshot({path:path.join(out,'wrong-account-phone.png')});
  await page.evaluate(()=>{window.__inviteFixture.error=null;document.getElementById('invitation-accept').click();});
  assert.equal(await page.evaluate(()=>window.__inviteFixture.token),token,'#675 acceptance posts the exact fragment token');
  assert.equal(await page.evaluate(()=>document.getElementById('invitation-play').hidden),false,'#675 accepted invitation exposes play');
  await page.screenshot({path:path.join(out,'accepted-phone.png')});
  await page.goto('http://admin.fixture/invitation.html');
  assert.equal(await page.evaluate(()=>document.getElementById('invitation-accept').disabled),true,'#675 missing token cannot start login');
  assert.deepEqual(errors,[],'#675 no browser exceptions');
  console.log('PASS #675 invitation controls, Google acceptance, errors, concurrency and phone layout');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
