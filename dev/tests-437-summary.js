// Drives the real summarizer with a scripted provider and inert persistence.
var engine=require('./load-engine.js'),assert=require('assert');engine.loadEngine();
var warns=[],toasts=[],messages=[],calls=0;
addMsg=function(k,t){messages.push(String(t));return {remove:function(){}};};
showToast=function(t){toasts.push(String(t));};reportError=function(){};
saveLocal=function(){return true;};saveCore=function(){return true;};saveMem=function(){return true;};compileEraIfDue=function(){};
syncUI=function(){};saveAll=function(){};
var realWarn=console.warn;console.warn=function(t){warns.push(String(t));};
var A='Find her missing brother.',B='Protect the village from raiders.';
function seed(){
  worldState=engine.makeTestWorld();memory=blankMemory();worldState.turn=40;worldState.campId='camp-a';worldState.campName='The Hollow';
  worldState.npcs=[{name:'Daeris',partyMember:true,status:'steady',charSheet:{name:'Daeris',motivation:A,coreMemories:[]}}];
  sessionLog=[{role:'user',content:'Daeris looks for her brother.'},{role:'assistant',content:'Daeris finds her brother alive. '.repeat(500)}];
  warns=[];toasts=[];messages=[];calls=0;assert.ok(sessionTokens()>SUMMARIZE_AT);
  return findCompanionChar('Daeris');
}
function response(change){return JSON.stringify({chapterSummary:'Daeris found her brother alive.',motivationChanges:[change]});}
function successful(){assert.equal(calls,1);assert.ok(messages.some(function(t){return /Memory updated/.test(t);}),messages.join('\n'));assert.ok(!worldState.summaryFailure);}
var pass=0,fail=0;
async function test(name,fn){try{await fn();pass++;console.log('PASS #437 async '+name);}catch(e){fail++;console.error('FAIL #437 async '+name+' — '+e.stack);}}
(async function(){
  await test('untagged fulfillment and birth use served exact references',async function(){
    var d=seed();callGM=async function(msg){calls++;assert.ok(msg.includes('COMPANION PURPOSES')&&msg.includes(A)&&msg.includes('settledPurpose'));return response({name:'Daeris',settledPurpose:A,settled:'her brother returned safely',now:B});};
    await summarize();successful();assert.equal(d.motivation,B);assert.equal(d.motivationHistory.length,1);assert.equal(d.motivationHistory[0].text,A);assert.equal(toasts.filter(function(t){return /^★ Daeris/.test(t);}).length,2);
  });
  await test('tagged transition replay preserves the entire sheet and emits no toast',async function(){
    var d=seed();applyMuts('Daeris smiles. [COMPANION_GROWTH:Daeris|motivation|settled: her brother returned safely]');applyMuts('Daeris raises her shield. [COMPANION_GROWTH:Daeris|motivation|'+B+']');
    var before=JSON.stringify(d);toasts=[];
    callGM=async function(msg){calls++;assert.ok(msg.includes('alreadyApplied')&&msg.includes(A)&&msg.includes(B));return response({name:'Daeris',settledPurpose:A,settled:'her brother returned safely',now:B});};
    await summarize();successful();assert.equal(JSON.stringify(d),before);assert.deepEqual(toasts,[]);
  });
  await test('request snapshot precedes the wait and survives until application',async function(){
    var d=seed(),before;
    callGM=async function(msg){calls++;assert.ok(msg.includes(A));motivationSettle(d,'her brother returned safely',40);motivationBirth(d,A,41);before=JSON.stringify(d);return response({name:'Daeris',settledPurpose:A,settled:'her brother returned safely'});};
    await summarize();successful();assert.equal(JSON.stringify(d),before);assert.ok(warns.some(function(t){return /changed since extraction began/.test(t);}));assert.equal(toasts.length,1);assert.ok(/purpose change not filed/.test(toasts[0]));
  });
  await test('campaign replacement cannot file a purpose onto its namesake',async function(){
    seed();var next,before;
    callGM=async function(){calls++;worldState=JSON.parse(JSON.stringify(worldState));worldState.campId='camp-b';next=findCompanionChar('Daeris');before=JSON.stringify(next);return response({name:'Daeris',settledPurpose:A,settled:'her brother returned safely'});};
    await summarize();successful();assert.equal(JSON.stringify(next),before);assert.ok(warns.some(function(t){return /companion or campaign changed/.test(t);}));
  });
  await test('sheet replacement within the same world cannot receive the previous sheet result',async function(){
    seed();var next,before;
    callGM=async function(){calls++;worldState.npcs[0].charSheet=JSON.parse(JSON.stringify(worldState.npcs[0].charSheet));next=findCompanionChar('Daeris');before=JSON.stringify(next);return response({name:'Daeris',settledPurpose:A,settled:'her brother returned safely'});};
    await summarize();successful();assert.equal(JSON.stringify(next),before);assert.ok(warns.some(function(t){return /companion or campaign changed/.test(t);}));
  });
  await test('reframed retry keeps original purpose evidence after a mid-request change',async function(){
    var d=seed(),before;
    callGM=async function(msg){calls++;if(calls===1){motivationSettle(d,'her brother returned safely',40);motivationBirth(d,B,41);before=JSON.stringify(d);var e=new Error('scripted refusal');e.modelRefusal=true;throw e;}assert.ok(msg.includes('"standing":"'+A+'"'));return response({name:'Daeris',settledPurpose:A,settled:'her brother returned safely',now:B});};
    await summarize();assert.equal(calls,2);assert.ok(messages.some(function(t){return /Memory updated/.test(t);}));assert.equal(JSON.stringify(d),before);assert.ok(warns.some(function(t){return /changed since extraction began/.test(t);}));
  });
  console.warn=realWarn;console.log('#437 async summary: '+pass+' passed, '+fail+' failed');process.exitCode=fail?1:0;
})().catch(function(e){console.warn=realWarn;console.error(e.stack);process.exitCode=1;});
