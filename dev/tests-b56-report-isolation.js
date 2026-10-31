// B56: loading fixture code must not arm the production bug-report transport.
const assert=require('assert/strict');
const loader=require('./load-engine.js');
const nativeFetch=global.fetch;
const calls=[];
global.fetch=function(url,opts){
  calls.push({url:String(url),body:opts&&opts.body});
  return Promise.resolve({ok:true,status:200,text:()=>Promise.resolve('{"ok":true}')});
};
(async()=>{
 try{
  for(const target of ['error-report.js',undefined]){
   loader.loadEngine(target);
   const before=calls.length;
   reportError('memory-owner','memory camp_fixture_A under worldState camp_fixture_B',{turn:5});
   assert.equal(calls.length,before,'B56 development engine loads never send fixture crashes');
   let result;
   sendUserReport('Fixture user report',null,(ok,error)=>{result={ok,error};});
   assert.equal(calls.length,before,'B56 development user reports never reach the live feed');
   assert.equal(result.ok,false);
   assert.match(result.error,/not configured|isn't configured/);
  }
  ERROR_WEBHOOK_URL='https://reports.example.invalid/fixture';
  _erLastSentAt=0;_erSentCount=0;
  assert.equal(reportError('fixture','intentional transport probe','detail'),'sent');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls.length,1,'B56 reporter tests can explicitly exercise a fake transport');
  assert.equal(calls[0].url,'https://reports.example.invalid/fixture');
  assert.equal(JSON.parse(calls[0].body).ctx,'fixture');
  console.log('PASS B56 fixture reports disabled after full and partial loads; explicit fake transport still exercised');
 }finally{global.fetch=nativeFetch;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});

