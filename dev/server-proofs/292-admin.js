// node dev/server-proofs/292-admin.js <server-checkout>
// Only a disposable source copy is mutated. No .env or database enters the fixture.
// Server sources are a separate checkout, absent from game CI's repo-local applicability scan.
var fs=require("fs"),path=require("path"),os=require("os"),cp=require("child_process"),sabotage=require("../sabotage.js");
var source=path.resolve(process.argv[2]||"");
if(!process.argv[2]||!fs.existsSync(path.join(source,"admin.js")))throw new Error("Pass the server checkout containing admin.js");
var scratch=fs.mkdtempSync(path.join(os.tmpdir(),"tnd-292-proof-"));
try{
  fs.readdirSync(source).filter(function(f){return /\.(?:m?js)$/.test(f)||f==="package.json";}).forEach(function(f){fs.copyFileSync(path.join(source,f),path.join(scratch,f));});
  fs.symlinkSync(path.join(source,"node_modules"),path.join(scratch,"node_modules"),"junction");
  var command=[process.execPath,[path.join(scratch,"test-gateway.mjs")]],baseline=cp.spawnSync(command[0],command[1],{cwd:scratch,encoding:"utf8"});
  if(baseline.status!==0)throw new Error("Server proof baseline failed: "+baseline.stdout+baseline.stderr);
  process.exitCode=sabotage.prove({file:path.join(scratch,"admin.js"),cwd:scratch,command:command,cases:[
    {label:"server admin gate",find:"if (isAdmin(session.user_id)) return null;",replace:"if (true) return null;",mustFail:"❌ non-admin operator stats → 403"},
    {label:"remaining subscription time",find:"Math.max(Date.now(), Number.isFinite(previousEnd) ? previousEnd : 0)",replace:"Date.now()",mustFail:"❌ Extend preserves all remaining subscription time and the existing tier"},
    {label:"whole-day validation",find:"!Number.isInteger(days)",replace:"!Number.isFinite(days)",mustFail:'❌ invalid admin payload is refused: {"userId":"gh_999","tier":"tester","days":1.5}'},
    {label:"real user required",find:'if (!db.prepare("SELECT 1 FROM users WHERE id = ?").get(userId))',replace:"if (false)",mustFail:"❌ grant cannot create an entitlement for a nonexistent user"},
    {label:"30-day token window",find:"THEN tok_in ELSE 0 END",replace:"THEN tok_in ELSE tok_in END",mustFail:"❌ 30-day token rollups preserve provider/model/cache/status without lifetime leakage"},
    {label:"last-active roster field",find:"user.lastActive = r.last_active;",replace:"user.lastActive = null;",mustFail:"❌ roster last-active is metered activity and turns exclude old events"},
    {label:"explicit revoke",find:'db.prepare("DELETE FROM subscriptions WHERE user_id = ?").run(userId);',replace:"",mustFail:"❌ explicit Revoke removes only the selected subscription"}
  ]});
}finally{
  if(path.dirname(path.resolve(scratch))!==path.resolve(os.tmpdir()))throw new Error("Refusing cleanup outside the temporary directory");
  fs.rmSync(scratch,{recursive:true,force:true});
}
