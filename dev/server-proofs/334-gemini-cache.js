// node dev/server-proofs/334-gemini-cache.js <server-checkout>
// Mutations run only in a disposable copy; no .env or database is copied.
var fs=require("fs"),path=require("path"),os=require("os"),cp=require("child_process"),sabotage=require("../sabotage.js");
var source=path.resolve(process.argv[2]||"");
if(!process.argv[2]||!fs.existsSync(path.join(source,"gemini-cache.js")))throw Error("Pass the server checkout containing gemini-cache.js");
var scratch=fs.mkdtempSync(path.join(os.tmpdir(),"tnd-334-proof-")),rc=0;
// Each bounded prove invocation retains its restoration handlers until process exit.
process.setMaxListeners(40);
try{
  fs.readdirSync(source).filter(function(f){return /\.(?:m?js)$/.test(f)||f==="package.json";}).forEach(function(f){fs.copyFileSync(path.join(source,f),path.join(scratch,f));});
  fs.symlinkSync(path.join(source,"node_modules"),path.join(scratch,"node_modules"),"junction");
  var baseline=cp.spawnSync(process.execPath,[path.join(scratch,"test-gemini-cache.mjs")],{cwd:scratch,encoding:"utf8"});
  if(baseline.status!==0)throw Error("Cache proof baseline failed: "+baseline.stdout+baseline.stderr);
  function prove(label,find,replace,test){rc|=sabotage.prove({file:path.join(scratch,"gemini-cache.js"),cwd:scratch,command:[process.execPath,[path.join(scratch,"test-gemini-cache.mjs"),test]],cases:[{label:label,find:find,replace:replace,mustFail:"FAIL: "+test}]});}
  prove("disabled flag ignored","!enabled||q.kind", "false||q.kind","disabled/malformed/non-turn requests");
  prove("system-only count request omits required contents","{contents:[systemInstruction]}",'{generateContentRequest:{model:"models/"+q.model,systemInstruction}}',"token admission counts stable text");
  prove("live state inflates cache admission","{contents:[systemInstruction]}","{contents:[systemInstruction,...q.parsed.contents]}","token admission counts stable text");
  prove("user omitted from identity","[q.userId,q.model,keyHash,stable,CACHE_LAYOUT]","[q.model,keyHash,stable,CACHE_LAYOUT]","single-flight and restart reuse");
  prove("model omitted from identity","[q.userId,q.model,keyHash,stable,CACHE_LAYOUT]","[q.userId,keyHash,stable,CACHE_LAYOUT]","single-flight and restart reuse");
  prove("key rotation reuses old resource","[q.userId,q.model,keyHash,stable,CACHE_LAYOUT]","[q.userId,q.model,stable,CACHE_LAYOUT]","single-flight and restart reuse");
  prove("volatile bytes enter cached system","c.stable+CACHE_LAYOUT","c.stable+c.live+CACHE_LAYOUT","cache stores only stable system rules");
  prove("current state dropped","engineState:c.live","engineState:''","cache stores only stable system rules");
  prove("renew on every turn","RENEW_MS=900000","RENEW_MS=7200000","renewal is on use near expiry");
  prove("undersized prefix creates billed cache","count.totalTokens<FLOORS[q.model]","false","short prefixes and cache failures");
  prove("creation rate ceiling removed","n>=MAX_ATTEMPTS","false","cache-creation churn is bounded");
  prove("failed delete silently loses billed handle",'await api("/"+victim.cache_name,"DELETE",q.key);','void 0;',"cache-creation churn is bounded");
  prove("different cold hashes race active cap","const prior=users.get(q.userId)||Promise.resolve();","const prior=Promise.resolve();","concurrent different prefixes");
  prove("cold-start failure cooldown ignored","if(row?.retry_after>at)return null;","if(false)return null;","ambiguous creation and renewal failures");
  prove("ambiguous create exposure hidden",'"create",count.totalTokens,TTL_MS/1000','"create",count.totalTokens,0',"ambiguous creation and renewal failures");
  prove("unrelated cache error permits retry","&&message.includes(prepared.name)","","only explicit cache-not-found");
  var cmd=[process.execPath,[path.join(scratch,"test-gemini-gateway.mjs")]];
  baseline=cp.spawnSync(cmd[0],cmd[1],{cwd:scratch,encoding:"utf8"});
  if(baseline.status!==0)throw Error("Gateway proof baseline failed: "+baseline.stdout+baseline.stderr);
  rc|=sabotage.prove({file:path.join(scratch,"gateway.js"),cwd:scratch,command:cmd,cases:[
    {label:"server protocol advertisement omitted",find:'transportCapabilities: { geminiStableCacheV1: 1 }',replace:'transportCapabilities: {}',mustFail:"account advertises cache-header support independently of entitlement"},
    {label:"stale retry sends incomplete cached body",find:'body:rawBody,signal:ctl.signal',replace:'body:prepared.body,signal:ctl.signal',mustFail:"explicit stale cache retries once using byte-complete original body"},
    {label:"gateway forgets ambiguous-failure retry veto",find:'retryable: false',replace:'retryable: true',mustFail:"ambiguous generation transport loss forbids gateway and client retries"}
  ]});
  process.exitCode=rc?1:0;
}finally{
  if(path.dirname(path.resolve(scratch))!==path.resolve(os.tmpdir()))throw Error("Refusing cleanup outside temporary directory");
  fs.rmSync(scratch,{recursive:true,force:true});
}
