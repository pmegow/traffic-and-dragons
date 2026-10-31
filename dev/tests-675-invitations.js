const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
let failed=0,passed=0;
async function test(name,fn){try{await fn();passed++;console.log('PASS #675 '+name);}catch(e){failed++;console.error('FAIL #675 '+name+': '+e.stack);}}
function page(){
 const nodes={'invitation-play':{hidden:true}},callbacks={},timers=[];
 const box={console:{warn(){}},window:{location:{hash:'#'+'a'.repeat(64)}},document:{getElementById(id){return nodes[id]||(nodes[id]={hidden:id==='invitation-play',addEventListener(t,f){this[t]=f;}});}},
  setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},
  storageAdapter:{loginWithServer(url,cb,provider){callbacks.login=cb;callbacks.provider=provider;},acceptInvitation(token,cb){callbacks.token=token;callbacks.accept=cb;}}};
 vm.createContext(box);vm.runInContext(fs.readFileSync('invitation.js','utf8'),box);
 return {nodes,callbacks,timers,click(){nodes['invitation-accept'].click();}};
}
(async()=>{
 await test('acceptance waits for explicit Google login and a successful server result',()=>{
  const p=page();assert(!p.callbacks.login);p.click();assert.equal(p.callbacks.provider,'google');assert(!p.callbacks.accept);
  p.callbacks.login(null);assert.equal(p.callbacks.token,'a'.repeat(64));p.callbacks.accept('Wrong Gmail account');
  assert.equal(p.nodes['invitation-play'].hidden,true);assert.equal(p.nodes['invitation-accept'].disabled,false);
  p.click();p.callbacks.login(null);p.callbacks.accept(null,{ok:false});assert.equal(p.nodes['invitation-play'].hidden,true);
  p.click();p.callbacks.login(null);p.callbacks.accept(null,{ok:true});assert.equal(p.nodes['invitation-play'].hidden,false);
 });
 await test('timed out authentication cannot approve from a late callback',()=>{
  const p=page();p.click();const late=p.callbacks.login;p.timers[0]();assert.match(p.nodes['invitation-status'].textContent,/did not finish/);
  late(null);assert(!p.callbacks.accept);assert.equal(p.nodes['invitation-accept'].disabled,false);
 });
 await test('adapter posts secrets in an authenticated body and preserves server refusal reasons',async()=>{
  const calls=[],box={console,Promise,URL,AbortController,setTimeout,clearTimeout,
   fetch:async(url,opts)=>{calls.push({url,opts});return {ok:false,status:403,json:async()=>({error:'This invitation is for a different Gmail account.'})};}};
  vm.createContext(box);vm.runInContext(fs.readFileSync('storage-adapter.js','utf8'),box);box.storageAdapter.setServer('https://fixture.test','fixture-session');
  const err=await new Promise(r=>box.storageAdapter.acceptInvitation('SECRET',r));
  assert.match(err,/different Gmail/);assert.equal(calls[0].url,'https://fixture.test/api/invitations/accept');
  assert.equal(calls[0].opts.headers.Authorization,'Bearer fixture-session');assert.equal(calls[0].opts.method,'POST');assert.deepEqual(JSON.parse(calls[0].opts.body),{token:'SECRET'});
  for(const [method,args,path] of [['listInvitations',[],''],['previewInvitation',[{email:'alice@gmail.com'}],'/preview'],['sendInvitation',[{requestId:'id'}],''],['resendInvitation',['a/b',{requestId:'id'}],'/a%2Fb/resend'],['revokeInvitation',['a/b'],'/a%2Fb/revoke']]){
   await new Promise(r=>box.storageAdapter[method](...args,r));assert.equal(calls.at(-1).url,'https://fixture.test/api/admin/invitations'+path);
  }
 });
 await test('service worker fetches the invitation page and controllers from the network',async()=>{
  const handlers={},fresh={ok:true,status:200,type:'basic',redirected:false,clone(){return this;}},stale={},box={URL,console,Promise,importScripts(){},AUDIO_CATALOG:{version:'fixture'},createAudioCache(){return{};},
   self:{location:{origin:'https://fixture.test'},addEventListener(t,f){handlers[t]=f;}},caches:{match:async()=>stale,open:async()=>({put(){}})},fetch:async()=>fresh};
  vm.createContext(box);vm.runInContext(fs.readFileSync('sw.js','utf8'),box);
  for(const p of ['invitation.html','invitation.js?admin_console','invitation.css?admin_console','admin-invitations.js?admin_console']){
   let response;handlers.fetch({request:{url:'https://fixture.test/'+p,method:'GET'},respondWith(p){response=p;},waitUntil(){}});assert.equal(await response,fresh,p+' must refresh');
  }
 });
 console.log('#675 standalone: '+passed+' passed, '+failed+' failed');process.exitCode=failed?1:0;
})();
