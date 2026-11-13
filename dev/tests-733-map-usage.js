'use strict';
const assert=require('assert/strict'),engine=require('./load-engine.js');engine.loadEngine();
const oi=process.argv.indexOf('--only'),only=oi<0?null:process.argv[oi+1],tests=[];
function test(name,fn){if(!only||only===name)tests.push({name,fn});}
const usage={in:101,out:23,cacheRead:0,cacheWrite:0};
function setup(){engine.makeTestWorld();worldState.campId='request-campaign';memory.campId=worldState.campId;activeProvider='anthropic';providerKeys.anthropic='offline-test-placeholder';global.gmTransport=()=>({url:'https://offline.invalid',headers:{},server:false});global.buildSysPrompt=()=>({stable:'Offline system',volatile:'Offline state'});}
function response(empty){return {ok:true,status:200,raw:JSON.stringify({content:empty?[]:[{type:'text',text:'A complete response.'}],usage:{input_tokens:usage.in,output_tokens:usage.out},stop_reason:'end_turn'})};}
async function switched(kind,empty){
 setup();const original=worldState;let replacement,before;
 global._fetchTextDeadline=async()=>{worldState=JSON.parse(JSON.stringify(worldState));worldState.campId='replacement-campaign';replacement=worldState;before=JSON.stringify(replacement);return response(empty);};
 if(empty)await assert.rejects(()=>callGM('Look.','Offline system',100,null,{kind,noHistory:true,noRetry:true}));
 else await callGM('Look.',kind==='turn'?null:'Offline system',100,null,{kind,noHistory:true,noRetry:true});
 assert.equal(JSON.stringify(replacement),before,'a completed foreign request cannot bill the replacement campaign');
 assert.equal(original.usage.calls,1);assert.equal(original.usage.in,101);assert.equal(original.usage.out,23);assert.equal(original.usage.byKind[kind].calls,1);
 return {original,replacement};
}
test('atlas completion bills its captured campaign after replacement',async()=>{const r=await switched('atlas',false);assert(!r.original.healthLog);});
test('story completion keeps usage and health on its captured campaign',async()=>{const r=await switched('turn',false);assert.equal(r.original.healthLog.length,1);assert.equal(r.original.healthLog[0].t,5);assert.equal(_lastTurnSys.campId,'request-campaign');});
test('billed empty response stays attributed before parser refusal',async()=>{await switched('atlas',true);});
test('legacy usage callers still default to the active world',()=>{setup();recordUsage(usage,'atlas','claude-sonnet-4-6',0,false);assert.equal(worldState.usage.calls,1);assert.equal(worldState.usage.in,101);});
test('explicit null usage target never falls through to a replacement world',()=>{setup();const before=JSON.stringify(worldState);recordUsage(usage,'atlas','claude-sonnet-4-6',0,false,null);assert.equal(JSON.stringify(worldState),before);});
test('a request begun without a world cannot bill a later campaign',async()=>{setup();const replacement=worldState;worldState=null;const before=JSON.stringify(replacement);global._fetchTextDeadline=async()=>{worldState=replacement;return response(false);};await callGM('Look.','Offline system',100,null,{kind:'atlas',noHistory:true,noRetry:true});assert.equal(JSON.stringify(replacement),before);});
(async()=>{let pass=0,fail=0;for(const t of tests){try{await t.fn();pass++;console.log('PASS #733 usage '+t.name);}catch(e){fail++;console.error('FAIL #733 usage '+t.name+'\n'+e.stack);}}if(!tests.length)throw Error('No matching usage tests');console.log(`${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;})().catch(e=>{console.error(e.stack);process.exitCode=1;});
