// #678: real reporter and deployed GAS schema, with all I/O replaced by local fakes.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'..');
function harness(mode){
 const calls=[],warnings=[],timers=new Map();let timerId=0,reply;
 const c={console:{info(){},warn(...v){warnings.push(v.join(' '));}},Date,Math,JSON,Promise,setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);},APP_VERSION:'fixture',worldState:{campName:'Fixture',turn:1,character:{name:'Not The Reporter'}},serverAccount:{username:'STALE_ACCOUNT',email:'private@example.invalid',token:'NEVER_SEND'},
  storageAdapter:{hasToken(){return mode!=='guest';},whoAmI(cb){reply=cb;if(mode==='ok')cb(null,{username:'Mira Vale',email:'private@example.invalid',token:'NEVER_SEND'});if(mode==='refused')cb('HTTP 401');if(mode==='blank')cb(null,{username:'  '});if(mode==='throws')throw Error('lookup unavailable');}},
  fetch(url,opts){calls.push({url,body:JSON.parse(opts.body)});return Promise.resolve({ok:true,status:200,text:()=>Promise.resolve('{"ok":true}')});}
 };
 if(mode==='boot')delete c.storageAdapter;
 vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'error-report.js'),'utf8'),c);c.ERROR_WEBHOOK_URL='https://reports.example.invalid/fixture';
 return {c,calls,warnings,timers,reply:()=>reply};
}
function legacyWebhook(payload){
 const header=['id','receivedAt','clientTs','kind','ctx','message','detail','app','camp','turn','url','ua','online','suppressed','screenshotUrl'],rows=[header],emails=[];
 const sheet={appendRow(row){rows.push(row);},getDataRange(){return {getValues(){return rows.map(r=>r.slice());}};}};
 const props={getProperty(k){return {SHEET_ID:'fixture',SECRET:'fixture'}[k]||null;}};
 const c={PropertiesService:{getScriptProperties:()=>props},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet})},Utilities:{getUuid:()=> 'fixture-report'},MailApp:{sendEmail(...a){emails.push(a);}},ContentService:{MimeType:{JSON:'json'},createTextOutput(s){return {text:s,setMimeType(){return this;}};}}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'dev/gas-error-webhook.gs'),'utf8'),c);
 const posted=JSON.parse(c.doPost({postData:{contents:JSON.stringify(payload)}}).text);assert.equal(posted.ok,true);
 const feed=JSON.parse(c.doGet({parameter:{s:'fixture'}}).text);assert.equal(feed.reports.length,1);
 return {report:feed.reports[0],email:emails[0][2],columns:rows[0].length};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 for(const kind of ['crash','user-report']){
  const h=harness('ok');if(kind==='crash')h.c.reportError('fixture','Fixture failure','stack');else h.c.sendUserReport('Fixture user report',null,()=>{});await flush();
  assert.equal(h.calls.length,1,'#678 exactly one report is delivered');const p=h.calls[0].body;
  assert.equal(p.reporter&&p.reporter.username,'Mira Vale','#678 reports use the current signed-in username');
  assert(!JSON.stringify(p).includes('STALE_ACCOUNT')&&!JSON.stringify(p).includes('NEVER_SEND')&&!JSON.stringify(p).includes('private@example.invalid'),'#678 account credentials and stale cached identities stay out of reports');
  const gas=legacyWebhook(p);assert.match(gas.report.detail,/^Reporter: .*Mira Vale/,'#678 existing GAS sheet and JSON feed preserve reporter');assert.match(gas.email,/Reporter: .*Mira Vale/,'#678 existing notification email includes reporter');assert.equal(gas.columns,15);
 }
 for(const mode of ['guest','refused','throws','timeout','blank','boot']){
  const h=harness(mode);h.c.sendUserReport('Still deliver this report',null,()=>{});
  if(mode==='timeout')for(const fn of Array.from(h.timers.values()))fn();await flush();
  assert.equal(h.calls.length,1,'#678 '+mode+' still delivers the report');assert.equal(h.calls[0].body.reporter.username,null);assert.equal(h.calls[0].body.reporter.state,mode==='guest'?'signed-out':'unavailable');
  if(mode!=='guest')assert(h.warnings.length>0,'#678 identity failures are visible in the console');
  if(mode==='timeout'){h.reply()(null,{username:'Too late'});await flush();assert.equal(h.calls.length,1,'#678 late identity callback cannot double-send');}
 }
 const switched=harness('timeout');switched.c.sendUserReport('Account switch',null,()=>{});switched.c.serverAccount={username:'Other Person'};switched.reply()(null,{username:'Original Reporter'});await flush();assert.equal(switched.calls[0].body.reporter.username,'Original Reporter');
 console.log('PASS #678 report attribution: both send paths, legacy GAS sheet/feed/email, privacy, signed-out/refused/thrown/timeout lookup, late callback and account switch');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
