// Local visual fixture: shipping HTML and pricing, disposable roster, no account/network writes.
// node dev/preview-292-admin-console.js → http://localhost:8124/admin_console.html
// ?mode=error, ?mode=nonadmin and ?mode=signedout exercise the visible refusal states.
var http=require("http"),fs=require("fs"),path=require("path"),root=path.join(__dirname,"..");
function fixture(mode){
  var users=[
    {userId:"test_operator",username:"Operator (fixture)",createdAt:"2026-08-01 09:00:00",lastActive:"2026-09-04 10:58:00",tier:"beta",status:"active",periodEnd:"2026-11-01T00:00:00Z",turnsUsed30d:248,
      usage30d:[{provider:"anthropic",model:"claude-sonnet-5",calls:640,tokIn:843100,tokOut:201250,cacheRead:8712400,cacheWrite:829400,errors:3}]},
    {userId:"test_long_id_123456789012345678901234567890",username:"A deliberately long tester name <img src=x onerror=alert(1)>",createdAt:"2026-09-01 09:00:00",lastActive:"2026-09-03 22:15:00",tier:"tester",status:"active",periodEnd:"2026-10-01T00:00:00Z",turnsUsed30d:12,
      usage30d:[{provider:"gemini",model:"gemini-3.7-flash",calls:24,tokIn:643100,tokOut:71250,cacheRead:712400,cacheWrite:0,errors:0},{provider:"fal",model:"unpriced-image",calls:2,tokIn:0,tokOut:0,cacheRead:0,cacheWrite:0,errors:0}]},
    {userId:"test_new",username:"New arrival",createdAt:"2026-09-04 10:59:00",lastActive:null,tier:null,status:null,periodEnd:null,turnsUsed30d:0,usage30d:[]}
  ];
  window.storageAdapter={
    hasToken:function(){return mode!=="signedout";},
    fetchAccount:function(cb){cb(null,{username:"Fixture — no server writes",isAdmin:mode!=="nonadmin"});},
    getAdminStats:function(cb){cb(null,{tiers:{beta:{label:"Beta tester",turnsPer30d:2000},tester:{label:"Tester",turnsPer30d:300},standard:{label:"Standard",turnsPer30d:250},premium:{label:"Premium",turnsPer30d:500}},metered24h:{calls:146,errors:3}});},
    listAdminUsers:function(cb){cb(mode==="error"?"HTTP 401 — session expired":null,users);},
    pingServerHealth:function(cb){cb(null,{status:"ok",time:"2026-09-04T11:00:00Z"});},
    updateSubscription:function(change,cb){var u=users.filter(function(x){return x.userId===change.userId;})[0];if(change.action==="revoke")u.tier=null;else if(change.action==="grant")u.tier=change.tier;cb(null,{ok:true});}
  };
}
http.createServer(function(req,res){
  var url=new URL(req.url,"http://localhost"),files={"/admin_console.html":"text/html","/satellite.css":"text/css","/globals.js":"text/javascript"};
  if(!Object.prototype.hasOwnProperty.call(files,url.pathname)){res.writeHead(404);res.end("Not a fixture asset");return;}
  var body=fs.readFileSync(path.join(root,url.pathname.slice(1)),"utf8");
  if(url.pathname==="/admin_console.html")body=body.replace(/<script src="(?:data|helpers|state|storage-adapter)\.js"><\/script>/g,"").replace("<script>\n(function(){","<script>("+fixture.toString()+")("+JSON.stringify(url.searchParams.get("mode")||"roster")+");</script>\n<script>\n(function(){");
  res.writeHead(200,{"Content-Type":files[url.pathname],"Cache-Control":"no-store"});res.end(body);
}).listen(8124,"127.0.0.1",function(){console.log("Operator fixture: http://127.0.0.1:8124/admin_console.html — no real account writes");});
