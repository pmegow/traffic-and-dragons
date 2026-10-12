const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
let passed=0,failed=0;
function test(name,fn){try{fn();console.log('PASS '+name);passed++;}catch(e){console.error('FAIL '+name+': '+e.message);failed++;}}
function fixture(connected=false){
 const elements={},warns=[],calls=[],timers=new Map();let seq=0;
 const get=id=>elements[id]||(elements[id]={hidden:false,disabled:false,textContent:'',addEventListener(){}});
 const adapter={isServerMode:()=>connected,whoAmI:cb=>{calls.push('identity');adapter.identity=cb;},
  loginWithServer:(url,cb,provider)=>{calls.push({url,provider});adapter.login=(err,info)=>{if(!err)connected=true;cb(err,info);};},
  logoutFromServer:cb=>{calls.push('logout');connected=false;adapter.logout=cb;}};
 const box={document:{getElementById:get},storageAdapter:adapter,console:{warn:(...a)=>warns.push(a)},window:{addEventListener(){}},
  setTimeout:fn=>{timers.set(++seq,fn);return seq;},clearTimeout:id=>timers.delete(id)};
 vm.createContext(box);const html=read('signup.html');
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())vm.runInContext(m[1],box);
 return {elements,adapter,calls,warns,timers,seam:box.window.__signupTest};
}
test('Sign up has a dedicated destination even with saved credentials',()=>{
 const h=read('website/index.html');assert.match(h, /href="https:\/\/traffic-and-dragons.pages.dev\/signup.html">Sign up</);
 assert.match(h,/href="https:\/\/traffic-and-dragons.pages.dev\/">Continue your Campaign/);
});
if(!fs.existsSync(path.join(root,'signup.html'))){console.error('FAIL dedicated sign-up page does not exist');process.exit(1);}
test('signup page cannot boot or write a campaign',()=>{
 const h=read('signup.html');assert.match(h,/href="satellite.css"/);assert.match(h,/href="home.html"/);
 assert(!/src="(?:game|ui-boot|ui-campaigns)\.js"|\b(?:init|newGame|saveAll|syncToServer)\s*\(|location\.(?:href|replace|assign)/.test(h));
 assert(!/tnd_server_tok|localStorage/.test(h),'authentication storage belongs to the shared adapter');
});
test('fresh visit waits for an explicit provider choice',()=>{const f=fixture();assert.equal(f.elements.providers.hidden,false);assert.deepEqual(f.calls,[]);assert.equal(f.elements.account.hidden,true);});
test('saved session waits for identity and never auto-continues',()=>{const f=fixture(true);assert.equal(f.elements.providers.hidden,true);assert.equal(f.elements.account.hidden,true);f.adapter.identity(null,{username:'Peter'});assert.equal(f.elements.account.hidden,false);assert.equal(f.elements['account-name'].textContent,'Peter');assert.equal(f.elements.providers.hidden,true);});
test('failed session verification offers retry and sign-out without account continuation',()=>{const f=fixture(true);f.adapter.identity('HTTP 401: expired');assert.equal(f.elements.account.hidden,true);assert.equal(f.elements.recovery.hidden,false);assert.match(f.elements.status.textContent,/401/);assert.equal(f.warns.length,1);f.seam.refresh();assert.equal(f.calls.length,2);});
test('malformed identity cannot authorize continuation',()=>{const f=fixture(true);f.adapter.identity(null,{});assert.equal(f.elements.account.hidden,true);assert.match(f.elements.status.textContent,/identity/);});
test('both providers use the shared login adapter',()=>{for(const provider of ['google','github']){const f=fixture();f.seam.signIn(provider);assert.equal(f.calls[0].provider,provider);assert.equal(f.calls[0].url,'https://traffic-and-dragons-server.fly.dev');assert.equal(f.elements['signup-google'].disabled,true);f.adapter.login(null,{username:'Peter'});assert.equal(f.calls[1],'identity');f.adapter.identity(null,{username:'Peter'});assert.equal(f.elements.account.hidden,false);assert.equal(f.timers.size,0);}});
test('blocked and cancelled popup errors remain visible and allow retry',()=>{for(const error of ['Popup blocked','Login cancelled']){const f=fixture();f.seam.signIn('google');f.adapter.login(error);assert.match(f.elements.status.textContent,new RegExp(error));assert.equal(f.elements['signup-google'].disabled,false);assert.equal(f.warns.length,1);assert.equal(f.timers.size,0);}});
test('double click and unsupported provider cannot start a second login',()=>{const f=fixture();f.seam.signIn('microsoft');assert.equal(f.calls.length,0);f.seam.signIn('google');f.seam.signIn('github');assert.equal(f.calls.length,1);});
test('abandoned login has a visible deadline and can be retried',()=>{const f=fixture();f.seam.signIn('google');[...f.timers.values()][0]();assert.match(f.elements.status.textContent,/timed out/);assert.equal(f.elements['signup-google'].disabled,false);});
test('sign-out is explicit and server failure is visible',()=>{const f=fixture(true);f.adapter.identity(null,{username:'Peter'});assert(!f.calls.includes('logout'));f.seam.signOut();f.adapter.logout('Server session may still be active');assert.equal(f.elements.account.hidden,true);assert.equal(f.elements.providers.hidden,false);assert.match(f.elements.status.textContent,/still be active/);assert.equal(f.warns.length,1);});
test('untrusted account names are rendered as text',()=>{const f=fixture(true);const name='<img src=x onerror=alert(1)>';f.adapter.identity(null,{username:name});assert.equal(f.elements['account-name'].textContent,name);assert(!/innerHTML/.test(read('signup.html')));});
console.log(`${passed} sign-up checks passed, ${failed} failed`);process.exitCode=failed?1:0;
