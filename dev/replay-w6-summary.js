// replay-w6-summary.js — exact W6 summary-identity failure lifecycle.
// Drives the async summarize() boundary three times, JSON-round-tripping campaign state between
// attempts, and proves the rejected t1644-shaped chapter never enters an injected memory tier.
var engine=require("./load-engine.js");
engine.loadEngine();

var elStub={appendChild:function(){},remove:function(){},style:{},textContent:"",innerHTML:""};
addMsg=function(){return elStub;};showToast=function(){};syncUI=function(){};reportError=function(){};
updateAbPanel=function(){};updateSpPanel=function(){};showArchetypeModal=function(){};showStatBumpModal=function(){};
var coreSaves=0,memSaves=0;saveCore=function(){coreSaves++;};saveMem=function(){memSaves++;};saveAll=function(){};
if(typeof storageAdapter==="undefined")storageAdapter={syncToServer:function(){},syncNow:function(){}};

function fail(msg){throw new Error("W6 REPLAY FAILED: "+msg);}
function reloadCampaign(){worldState=JSON.parse(JSON.stringify(worldState));memory=JSON.parse(JSON.stringify(memory));sessionLog=JSON.parse(JSON.stringify(sessionLog));_sumFails=worldState.summaryFailure&&worldState.summaryFailure.count||0;}

engine.makeTestWorld();worldState.turn=1644;worldState.character.name="Ammut";worldState.character.gender="M";worldState.character.aliases=["The Ash Walker"];
var i,long="The party crosses the mountain passage while the old scholar studies the violet tablets. ";
for(i=0;i<16;i++)long+=long.slice(0,120);
for(i=0;i<4;i++){sessionLog.push({role:"user",content:"Turn "+i+": "+long});sessionLog.push({role:"assistant",content:"The passage continues. "+long});}
var originalLen=sessionLog.length;
var rejected="Ammut spins, sword coming up. Invisible, boots silent as held breath, she crosses the ritual chamber and rips the closed-eye satchel free. She runs for the tunnel.";
callGM=async function(){return JSON.stringify({chapterSummary:rejected,npcUpdates:[],loreDiscovered:["should never file"],decisionsMade:["should never file"],futureEvents:[],resolvedEvents:[],supersededFacts:[],sameNpc:[],npcDeaths:[]});};

(async function(){
  await summarize();
  if(!worldState.summaryFailure||worldState.summaryFailure.count!==1)fail("first persisted strike missing");
  if(sessionLog.length!==originalLen||memory.chapters.length||memory.lore.length||worldState.eventHistory.length)fail("first failure changed source window or canon");
  reloadCampaign();
  await summarize();
  if(!worldState.summaryFailure||worldState.summaryFailure.count!==2)fail("reload evaded the second strike");
  if(sessionLog.length!==originalLen||memory.chapters.length||memory.lore.length||worldState.eventHistory.length)fail("second failure changed source window or canon");
  reloadCampaign();
  await summarize();
  var q=memory.archive&&memory.archive.identityQuarantines;
  if(worldState.summaryFailure!==undefined||_sumFails!==0)fail("safe exhaustion left a stale strike");
  if(!q||q.length!==1||q[0].kind!=="summary-validation"||q[0].subject!=="Ammut"||q[0].attempts!==3)fail("validation receipt missing or malformed: "+JSON.stringify(q));
  if(memory.chapters.length||memory.lore.length||memory.keyDecisions.length||worldState.eventHistory.length)fail("rejected generated summary entered canon");
  if(sessionLog.length>=originalLen||worldState.sessKept!==sessionLog.length||sessionTokens()!==0)fail("safe exhaustion did not retain and mark the live tail");
  var prompt=buildSysPrompt(),all=String(prompt.stable||"")+String(prompt.volatile||"");
  if(all.indexOf(rejected)>=0)fail("rejected generated prose reached the gameplay prompt");
  if(coreSaves<3||memSaves!==1)fail("failure lifecycle did not persist each strike and the final receipt");
  console.log("W6 SUMMARY LIFECYCLE GREEN");
  console.log("reload-persistent strikes: 1 -> 2 -> safe quarantine at 3");
  console.log("canon writes: 0 | rejected prose injected: no | retained messages: "+sessionLog.length);
})().catch(function(e){console.error(e&&e.stack||e);process.exit(1);});
