const fs=require('fs'),crypto=require('crypto'),path=require('path');
const root='C:/Projects/traffic-and-dragons',server='C:/Projects/traffic-and-dragons-server',out=path.join(root,'audits/verification-589-2026-10-08/deployment');
const normalize=s=>s.replace(/\r\n/g,'\n'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
(async()=>{
 const raw=fs.readFileSync(path.join(out,'server-deployed-hashes.log'),'utf8'); const deployed=JSON.parse(raw.slice(raw.indexOf('{')));
 const serverFiles=deployed.files.map(r=>{const s=normalize(fs.readFileSync(path.join(server,r.file),'utf8'));return {...r,localSha256:hash(s),equal:hash(s)===r.sha256}});
 const clientFiles=[];
 for(const file of ['library-slug.js','helpers.js','ui-browsers.js','storage-adapter.js','game.js','index.html','globals.js','sw.js']){
  const url='https://traffic-and-dragons.pages.dev/'+file;
  const r=await fetch(url,{headers:{'Cache-Control':'no-cache'}});if(!r.ok)throw Error(url+' HTTP '+r.status);
  const live=normalize(await r.text()),local=normalize(fs.readFileSync(path.join(root,file),'utf8'));
  const row={file,url,status:r.status,localSha256:hash(local),deployedSha256:hash(live),equal:hash(local)===hash(live),deployedBytes:Buffer.byteLength(live),localBytes:Buffer.byteLength(local)};
  if(file==='globals.js'){row.localVersion=(local.match(/APP_VERSION\s*=\s*[^;]+/)||[])[0];row.deployedVersion=(live.match(/APP_VERSION\s*=\s*[^;]+/)||[])[0];}
  if(!row.equal){fs.writeFileSync(path.join(out,'deployed-'+file),live);row.firstDifferentLine=(()=>{const a=local.split('\n'),b=live.split('\n');for(let i=0;i<Math.max(a.length,b.length);i++)if(a[i]!==b[i])return {line:i+1,local:a[i],deployed:b[i]}})();}
  clientFiles.push(row);
 }
 const receipt={utc:new Date().toISOString(),localNode:process.version,deployedNode:deployed.node,normalization:'CRLF to LF only',serverFiles,clientFiles};fs.writeFileSync(path.join(out,'deployment-equivalence.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
