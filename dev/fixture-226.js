// fixture-226.js — sanitizer and verifier for the mature-campaign model-sweep fixture.
var crypto=require("crypto");
var SECRET_FIELDS={
  apikey:1,apikeys:1,providerkey:1,providerkeys:1,providermodels:1,provider:1,providers:1,
  selectedprovider:1,selectedmodel:1,modelid:1,rendermodel:1,renderprovider:1,
  sttmodel:1,sttprovider:1,ttsmodel:1,ttsprovider:1,authorization:1,accesstoken:1,
  refreshtoken:1,bearertoken:1,credential:1,credentials:1,anthropickey:1,openaikey:1,
  geminikey:1,googlekey:1,groqkey:1,deepseekkey:1,xaikey:1,falkey:1
};
var SECRET_VALUES=[
  /sk-ant-[A-Za-z0-9_-]{16,}/,/sk-[A-Za-z0-9_-]{20,}/,/AIza[0-9A-Za-z_-]{30,}/,
  /gsk_[A-Za-z0-9_-]{20,}/,/xai-[A-Za-z0-9_-]{20,}/,/Bearer\s+[A-Za-z0-9._-]{20,}/i,
  /fal[_-]?(?:key)?[:=][A-Za-z0-9_-]{16,}/i
];
function keyId(k){return String(k).toLowerCase().replace(/[^a-z0-9]/g,"");}
function clone(v){return JSON.parse(JSON.stringify(v));}
function shaValue(v){return crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");}
function shaBytes(s){return crypto.createHash("sha256").update(s).digest("hex");}
function redactTree(v,portraitsOnly){
  if(!v||typeof v!=="object")return;
  var keys=Object.keys(v),i,k,id;
  for(i=0;i<keys.length;i++){
    k=keys[i];id=keyId(k);
    if(id==="portrait"){v[k]=null;continue;}
    if(id==="portraitoffset"||id==="portraitver"){delete v[k];continue;}
    if(!portraitsOnly&&SECRET_FIELDS[id]){delete v[k];continue;}
    redactTree(v[k],portraitsOnly);
  }
}
function portraitNeutral(v){var out=clone(v);redactTree(out,true);return out;}
function protectedHashes(save){
  var ws=save.worldState||{};
  return {
    transcript:shaValue(ws.transcript||[]),sessionLog:shaValue(save.sessionLog||[]),
    memory:shaValue(save.memory||{}),rosterSansPortraits:shaValue(portraitNeutral(ws.npcs||[])),
    quests:shaValue(ws.questLog||[])
  };
}
function leaks(v,path,out){
  if(typeof v==="string"){
    for(var p=0;p<SECRET_VALUES.length;p++)if(SECRET_VALUES[p].test(v)){out.push(path+" (secret-shaped value)");break;}
    return out;
  }
  if(!v||typeof v!=="object")return out;
  var keys=Object.keys(v),i,k,id,q;
  for(i=0;i<keys.length;i++){
    k=keys[i];id=keyId(k);q=path?path+"."+k:k;
    if(id==="portrait"&&v[k]!==null)out.push(q+" (portrait not stripped)");
    if(id==="portraitoffset"||id==="portraitver")out.push(q+" (portrait metadata not stripped)");
    if(SECRET_FIELDS[id])out.push(q+" (API/provider field not stripped)");
    leaks(v[k],q,out);
  }
  return out;
}
function prepare(source,opts){
  opts=opts||{};var before=protectedHashes(source),out=clone(source),ws=out.worldState||{};
  redactTree(out,false);
  ws.campId=opts.campId||"fixture-226-mature-t2097";
  ws.campName=opts.campName||"Rise of the Runelords — mature sweep fixture (t2097)";
  var after=protectedHashes(out),k;
  for(k in before)if(before[k]!==after[k])throw new Error("protected fixture slice changed during sanitization: "+k);
  var found=leaks(out,"",[]);if(found.length)throw new Error("fixture still contains private fields: "+found.join("; "));
  return {save:out,protectedHashes:after};
}
function manifestFor(prepared,fixtureText,meta){
  var ws=prepared.save.worldState||{},mem=prepared.save.memory||{};
  return {
    fixture:meta.fixture,source:meta.source,prepared:"2026-08-29",sourceAvailableTurn:ws.turn,
    provenance:"The requested t2231 export was not present in testRuns; t2097 was the latest available late-game save and retains the active final act/arc.",
    sanitization:{campaignIdentity:"fixture-only campId/campName",portraits:"all portrait values nulled; portrait offsets/version removed",apiAdjacent:"provider/model/credential fields removed; common API-key shapes rejected"},
    counts:{turn:ws.turn,transcript:(ws.transcript||[]).length,sessionLog:(prepared.save.sessionLog||[]).length,npcs:(ws.npcs||[]).length,quests:(ws.questLog||[]).length,chapters:(mem.chapters||[]).length},
    sha256:{fixture:shaBytes(fixtureText),transcript:prepared.protectedHashes.transcript,sessionLog:prepared.protectedHashes.sessionLog,memory:prepared.protectedHashes.memory,rosterSansPortraits:prepared.protectedHashes.rosterSansPortraits,quests:prepared.protectedHashes.quests}
  };
}
module.exports={prepare:prepare,manifestFor:manifestFor,protectedHashes:protectedHashes,leaks:function(v){return leaks(v,"",[]);},shaBytes:shaBytes};
