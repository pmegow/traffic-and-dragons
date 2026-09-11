const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),{pathToFileURL}=require('url');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async function(root,run){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'tnd-browser-qa-'));
 const child=cp.spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--disable-background-networking','--disable-sync','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let socket;
 try{
  const portfile=path.join(profile,'DevToolsActivePort');for(let i=0;!fs.existsSync(portfile);i++){if(i>100)throw Error('Chrome startup timed out');await sleep(100);}
  const port=fs.readFileSync(portfile,'utf8').split('\n')[0],tabs=await(await fetch('http://127.0.0.1:'+port+'/json')).json();
  socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j});let id=0;const pending=new Map();
  socket.onmessage=ev=>{let m=JSON.parse(ev.data);if(pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{let n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params,sessionId}));});
  const evaluate=async expression=>{let r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['https://*','http://*']});
  await send('Emulation.setDeviceMetricsOverride',{width:1200,height:1100,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:pathToFileURL(path.join(root,'index.html')).href});
  for(let i=0;!(await evaluate('typeof showHealthModal === "function" && document.readyState === "complete"'));i++){if(i>100)throw Error('page scripts did not load');await sleep(100);}
  await run({send,evaluate,sleep,screenshot:async(file)=>{fs.mkdirSync(path.dirname(file),{recursive:true});const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(file,Buffer.from(r.data,'base64'));}});
 }finally{if(socket)socket.close();child.kill();}
};

// Run manually with Node 22 and Chrome; an optional URL exercises a Pages preview.
// A fresh profile, synthetic key and intercepted speech endpoint prevent paid requests.
const assert=require('assert/strict');
module.exports(process.cwd(),async b=>{
 if(process.argv[2]){await b.send('Network.setBlockedURLs',{urls:[]});await b.send('Page.navigate',{url:process.argv[2]});for(var i=0;i<100;i++){await b.sleep(100);if(await b.evaluate('typeof TTS!=="undefined" && !!TTS._openai && document.readyState==="complete"'))break;}await b.send('Network.setBlockedURLs',{urls:['https://*','http://*']});}
 await b.evaluate(`store.del(TTS._openai.keys.on);providerKeys.openai="";TTS.showSettingsModal();window.__requests=[];window.__aborts=0;window.fetch=function(u,o){if(u==='https://api.openai.com/v1/audio/speech'){__requests.push(JSON.parse(o.body));o.signal.addEventListener('abort',function(){__aborts++});return new Promise(function(){});}return Promise.reject(new Error('Offline fixture'));};document.getElementById('tts-openai-on').click();`);
 assert(await b.evaluate(`!document.getElementById('tts-openai-on').checked`),'keyless opt-in accepted');
 var oldProvider=await b.evaluate('activeProvider');
 await b.evaluate(`document.getElementById('tts-openai-key').value='synthetic-test-key';document.getElementById('tts-openai-key-save').click();document.getElementById('tts-openai-on').click();document.getElementById('tts-openai-narr').value='cedar';document.getElementById('tts-openai-dir').value='Read softly.';`);
 assert.equal(await b.evaluate('activeProvider'),oldProvider,'voice key changed GM provider');
 assert(await b.evaluate(`document.getElementById('tts-openai-key').value===''&&JSON.parse(store.get(PKEYS_K)).openai==='synthetic-test-key'`),'key was not saved/cleared from input');
 await b.send('Runtime.evaluate',{expression:`document.getElementById('tts-openai-test').click()`,userGesture:true});await b.sleep(1200);
 var audition=await b.evaluate(`({requests:__requests.length,voice:__requests[0]&&__requests[0].voice,direction:__requests[0]&&__requests[0].instructions,button:document.getElementById('tts-openai-test').textContent})`);
 assert.equal(audition.requests,1);assert.equal(audition.voice,'cedar');assert.equal(audition.direction,'Read softly.');assert.match(audition.button,/Preparing [1-9][0-9]*s/);
 await b.evaluate('TTS.stop()');assert(await b.evaluate(`__aborts===1&&!TTS.isPlaying()&&document.getElementById('tts-openai-test').textContent==='▶ Test'`),'stop/callback failed');
 await b.evaluate(`providerKeys.gemini='fixture';document.getElementById('tts-gem-on').click();`);assert(await b.evaluate(`!document.getElementById('tts-openai-on').checked&&document.getElementById('tts-gem-on').checked`),'provider switches overlap');
 await b.evaluate(`document.getElementById('tts-openai-on').click();document.getElementById('tts-openai-narr').dispatchEvent(new Event('change'));document.getElementById('tts-openai-dir').dispatchEvent(new Event('change'));document.getElementById('tts-modal-x').click();TTS.showSettingsModal();`);
 assert(await b.evaluate(`document.getElementById('tts-openai-on').checked&&document.getElementById('tts-openai-narr').value==='cedar'&&document.getElementById('tts-openai-dir').value==='Read softly.'`),'voice preferences did not persist');
 await b.sleep(6000);await b.screenshot(process.cwd()+'/audits/screenshots/398-desktop.png');
 await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await b.screenshot(process.cwd()+'/audits/screenshots/398-mobile.png');
 assert(await b.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'mobile horizontal overflow');
 console.log('ALL GREEN — browser key setup, provider isolation, DOM audition, timer, cancellation, persistence and desktop/mobile layout; '+await b.evaluate('APP_VERSION'));
}).catch(e=>{console.error(e);process.exitCode=1});
