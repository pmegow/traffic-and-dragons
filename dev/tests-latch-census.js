// tests-latch-census.js — disposable-fixture and shipped-source checks for TODO #277-3.
var fs=require("fs"),path=require("path"),census=require("./latch-census.js");
var ROOT=path.join(__dirname,"..");
var failed=0;
function check(name,fn){try{var r=fn();if(r===true||r===undefined)console.log("PASS "+name);else{failed++;console.error("FAIL "+name+": "+r);}}catch(e){failed++;console.error("FAIL "+name+": "+e.message);}}

var fixtureApi='\nvar NOTE_LATCH_FIELDS=["known"];\nfunction buildFake(){fakeHelper();}\nfunction buildAlias(){var rec=worldState.aliasLatch;rec.used=true;}\nvar NOTE_BUILDERS=[buildFake,buildAlias];\n';
var fixtureHelpers='\nfunction fakeHelper(){var row=worldState.fakeLatch;row.used=true;}\n';

check("helper-routed fakeLatch is visible to the NOTE_BUILDERS census",function(){
  var r=census.censusSources({"api.js":fixtureApi,"helpers.js":fixtureHelpers});
  return r.missing.indexOf("fakeLatch")>=0?true:"fake helper write escaped: "+JSON.stringify(r);
});
check("alias-routed aliasLatch is visible without a direct worldState.aliasLatch assignment",function(){
  var r=census.censusSources({"api.js":fixtureApi,"helpers.js":fixtureHelpers});
  return r.missing.indexOf("aliasLatch")>=0?true:"alias write escaped: "+JSON.stringify(r);
});
check("exemptions are writer-scoped, never blanket key allowlists",function(){
  var api='\nvar NOTE_LATCH_FIELDS=[];\nfunction clockEnsure(){worldState.clock={};}\nfunction badWriter(){worldState.clock={};}\nvar NOTE_BUILDERS=[clockEnsure,badWriter];\n';
  var r=census.censusSources({"api.js":api});
  return r.missing.indexOf("clock")>=0?true:"a second clock writer hid behind clockEnsure's exemption: "+JSON.stringify(r);
});
check("shipped NOTE_BUILDERS reachable writes are declared, narrowly restored, or ruled exempt",function(){
  var sources={},files=census.NOTE_LATCH_CENSUS_FILES,i;
  for(i=0;i<files.length;i++)sources[files[i]]=fs.readFileSync(path.join(ROOT,files[i]),"utf8");
  var r=census.censusSources(sources);
  if(r.missing.length)return "actual undeclared reachable latches: "+r.missing.join(", ")+(r.rationaleFailures.length?" ("+r.rationaleFailures.join("; ")+")":"");
  if(r.writes.indexOf("pendingRewardClaims")<0||!r.writeOwners.pendingRewardClaims||r.writeOwners.pendingRewardClaims.indexOf("rewardClaimQueue")<0)return "rewardClaimQueue's helper-routed write is still invisible";
  if(r.writes.indexOf("clock")<0||!r.writeOwners.clock||r.writeOwners.clock.indexOf("clockEnsure")<0)return "buildScheduleEscalation -> scheduleDue -> clockEnsure is still invisible";
  if(r.writes.indexOf("questLog")<0||!r.writeOwners.questLog||r.writeOwners.questLog.indexOf("buildQuestStaleNudge")<0)return "buildQuestStaleNudge's aliased quest-row write is still invisible";
  if(!r.nested.questLog)return "questLog[].staleNudged is not classified through its title-keyed restoration";
  return true;
});
check("clockEnsure lazy repair exemption carries the ruled rationale verbatim",function(){
  var want="invariant-repair — restoring corruption after a failed request would undo a repair, not un-burn a note";
  return census.NOTE_LATCH_EXEMPT.clock&&census.NOTE_LATCH_EXEMPT.clock.rationale===want?true:"clock exemption rationale missing or changed";
});
check("pendingRewardClaims exemption carries the ruled rationale verbatim",function(){
  var want="f31: the player-visible shelve decision precedes the request; subject+tokens dedupe prevents a duplicate claim";
  return census.NOTE_LATCH_EXEMPT.pendingRewardClaims&&census.NOTE_LATCH_EXEMPT.pendingRewardClaims.rationale===want?true:"pendingRewardClaims exemption rationale missing or changed";
});

if(failed){console.error("LATCH CENSUS TESTS FAILED — "+failed);process.exit(1);}
console.log("ALL GREEN — 6 latch-census assertions");
