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

