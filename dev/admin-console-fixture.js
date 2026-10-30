// Disposable operator data for browser checks. No live account or email transport.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
function install(){
  var users=[];
  for(var i=0;i<30;i++)users.push({userId:'fixture-'+i,username:i===1?'A long player name <img src=x onerror=alert(1)>':i===2?'Player 1':'Player '+i,email:'tester'+i+'@example.test',createdAt:'2026-10-01 09:00:00',lastActive:'2026-10-30 10:00:00',tier:'tester',status:'active',periodEnd:'2030-01-01T00:00:00Z',turnsUsed30d:i+1,usage30d:[{provider:'gemini',model:'gemini-3.8-flash',kind:'turn',calls:i+1,tokIn:100,tokOut:20,errors:0}]});
  window.__adminFixture={users:users,writes:[],account:{isAdmin:true,username:'Operator fixture'}};
  var f=window.__adminFixture;
  window.storageAdapter={
    hasToken:function(){return !f.signedOut;},
    fetchAccount:function(cb){cb(f.accountError,f.account);},
    getAdminStats:function(cb){cb(null,{tiers:{tester:{label:'Tester',turnsPer30d:300},beta:{label:'Beta',turnsPer30d:2000}},metered24h:{calls:32,errors:0}});},
    listAdminUsers:function(cb){cb(f.usersError,f.users);},
    pingServerHealth:function(cb){cb(null,{status:'ok',time:'2026-10-30T18:00:00Z'});},
    readAdminActivity:function(since,visitId,cb){f.visits=f.visits||0;if(since===null)f.visits++;cb(f.activityError,{since:100,previousVisit:'2026-10-29T10:00:00Z',counts:f.counts||{'fixture-0':3,'fixture-1':2}});},
    listBetaMailings:function(cb){cb(null,f.mailings||[]);},
    previewBetaMail:function(body,cb){f.mailings=[{id:'fixture-mail',subject:body.subject,text:body.text,createdAt:'2026-10-30T19:00:00Z',missingEmail:1,duplicates:1,deliveries:[{id:'d1',recipient:'tester@example.test',status:'pending',retryable:true,message:'Pending'},{id:'d2',recipient:'another@example.test',status:'pending',retryable:true,message:'Pending'}]}];cb(null,f.mailings[0]);},
    sendBetaMail:function(id,deliveryId,cb){f.mailSends=(f.mailSends||0)+1;var m=f.mailings[0],d=m.deliveries.filter(function(x){return x.id===deliveryId;})[0];d.status=f.mailFailure?'uncertain':'accepted';d.retryable=false;d.message=f.mailFailure?'Delivery uncertain; check Email Logs.':'Accepted by Cloudflare';if(f.holdMail){f.heldMail=function(){cb(null,m);};}else cb(null,m);},
    updateSubscription:function(change,cb){f.writes.push(change);cb(null,{ok:true});}
  };
}
function html(){
  return fs.readFileSync(path.join(root,'admin_console.html'),'utf8').replace(/\r\n/g,'\n')
    .replace(/<script src="(?:data|helpers|inventory|state|storage-adapter)\.js(?:\?[^"]*)?"><\/script>/g,'')
    .replace('<script>\n(function(){','<script>('+install.toString()+')();</script>\n<script>\n(function(){');
}
async function route(request){
  const u=new URL(request.request().url());
  if(u.pathname==='/release-notes.json'&&module.exports.releaseOverride){await request.fulfill({status:200,contentType:'application/json',body:JSON.stringify(module.exports.releaseOverride)});return;}
 if(u.hostname!=='admin.fixture'){await request.abort();return;}
  const file=path.resolve(root,'.'+u.pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){await request.fulfill({status:404,body:'Fixture asset missing'});return;}
  const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'};
  await request.fulfill({status:200,contentType:types[path.extname(file)]||'text/plain',body:u.pathname==='/admin_console.html'?html():fs.readFileSync(file)});
}
module.exports={html,route};
