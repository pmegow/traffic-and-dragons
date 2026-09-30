// Cosmetic descriptors never select a URL or alter campaign facts.
var AUDIO_PROFILE_FIELDS = {
  enclosure:["open","covered","sealed","unspecified"],
  setting:["settlement","wilderness","interior","subterranean","coast","unspecified"],
  biome:["temperate","arid","tropical","frozen","unspecified"],
  quiet:["normal","hushed","silent"]
};
/* The SOUNDSCAPE content vocabulary — the ONE list the parser accepts and the engine note teaches (buildSoundscapeNote derives
   from it). chimes/bells added 2026-09-23 for the accent layer (Fable review; owner ruling: chimes hang where the GM says, bells ring outdoors). */
var AUDIO_CONTENTS = ["birds","insects","wind","water","fire","crowd","voices","rain","thunder","animals","machinery","music","chimes","bells"];
var AUDIO_PROFILE_META = ["schema","cohort","variant","revision","stamp","source"];
var audioCommitDepth = 0, audioPublishedScene = null, audioPlaybackGeneration = 0;
var audioPublishedWorld = null, audioPublishedCharacter = null, audioPublishedRespawns = null;
function audioRequestScope(){return {world:worldState,campaignId:worldState.campId,character:worldState.character&&worldState.character.name,respawns:worldState.respawns||0,generation:audioPlaybackGeneration};}
function audioRequestCurrent(scope){return scope.world===worldState&&scope.campaignId===worldState.campId&&scope.character===(worldState.character&&worldState.character.name)&&scope.respawns===(worldState.respawns||0)&&scope.generation===audioPlaybackGeneration;}
function audioValidateProfile(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {ok:false,reason:"profile must be a record"};
  var p={}, k, i, keys=Object.keys(input);
  if (JSON.stringify(input).length>1024) return {ok:false,reason:"profile exceeds 1 KiB"};
  for(i=0;i<keys.length;i++){k=keys[i];if(!Object.prototype.hasOwnProperty.call(AUDIO_PROFILE_FIELDS,k)&&k!=="allows"&&k!=="forbid"&&AUDIO_PROFILE_META.indexOf(k)<0)return {ok:false,reason:"unknown profile field: "+k};}
  for(k in AUDIO_PROFILE_FIELDS){if(AUDIO_PROFILE_FIELDS[k].indexOf(input[k])<0)return {ok:false,reason:"invalid "+k};p[k]=input[k];}
  for(i=0;i<2;i++){
    k=i?"forbid":"allows";var list=input[k];
    if(!Array.isArray(list)||list.length>AUDIO_CONTENTS.length)return {ok:false,reason:"invalid "+k};
    if(list.some(function(x){return AUDIO_CONTENTS.indexOf(x)<0;}))return {ok:false,reason:"unknown content in "+k};
    p[k]=list.filter(function(x,n){return list.indexOf(x)===n;}).sort();
  }
  if(p.allows.some(function(x){return p.forbid.indexOf(x)>=0;}))return {ok:false,reason:"content both allowed and forbidden"};
  for(i=0;i<AUDIO_PROFILE_META.length;i++){
    k=AUDIO_PROFILE_META[i];if(input[k]===undefined)continue;
    if(k==="schema"&&input[k]!==1)return {ok:false,reason:"unsupported audio profile schema"};
    if(k==="revision"&&(!(input[k]>=1)||input[k]!==Math.floor(input[k])))return {ok:false,reason:"invalid profile revision"};
    if(k!=="schema"&&k!=="revision"&&(typeof input[k]!=="string"||!/^[a-zA-Z0-9_-]{1,64}$/.test(input[k])))return {ok:false,reason:"invalid profile metadata"};
    p[k]=input[k];
  }
  return {ok:true,profile:p};
}
function audioHash(value){var h=2166136261,s=String(value),i;for(i=0;i<s.length;i++){h^=s.charCodeAt(i);h+=(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24);}return (h>>>0).toString(16);}
function audioNodeStamp(node){var notes=node.stateNotes||[],last=notes.length?notes[notes.length-1]:null;return audioHash(JSON.stringify([node.parent||null,node.description||null,notes.length,last]));}
function audioNodeProfile(node){
  if(!node||!node.soundscape)return null;
  var v=audioValidateProfile(node.soundscape);
  return v.ok&&v.profile.stamp===audioNodeStamp(node)?v.profile:null;
}
/* #481 E7 (audit 2026-09-29): a VALID profile whose freshness stamp no longer matches (a state note moved it) is STALE, not
   classified — the snapshot publishes it apart, and the plan plays the unclassified fallback (authored bindings plus the
   hearth) until the GM reclassifies; buildSoundscapeNote re-asks as before. An INVALID stored profile stays "classified
   without a profile" and never becomes a fallback. */
function audioNodeStale(node){if(!node||!node.soundscape)return false;var v=audioValidateProfile(node.soundscape);return !!(v.ok&&v.profile.stamp!==audioNodeStamp(node));}
/* #481 E5 (audit 2026-09-29, Fable-approved with changes): a content word outside AUDIO_CONTENTS is LEFT OUT here — in allows and
   forbid alike — and named in v.dropped. The catalog holds vocabulary words only, so an invented word could never match or veto a
   recording; it used to throw the whole classification away (Village t198 "footsteps"). An allows list of ONLY unknown words is
   still refused (an empty list would silence a place the GM meant to fill), the enum fields stay strict, and the validator stays
   the strict gate for every stored profile. A space after a comma is formatting, not a word. */
function audioParseProfile(body){
  var raw=String(body||""),cut=raw.lastIndexOf("|"),parts=[raw.slice(0,cut),raw.slice(cut+1)],input={},seen={},bad=null,dropped=[],noAllows=false;
  if(cut<1||!parts[0].trim()||parts[0].length>160||body.length>800)return {ok:false,reason:"expected explicit place|fields"};
  parts[1].split(";").forEach(function(pair){var kv=pair.trim().split("="),key=kv[0];if(kv.length!==2||seen[key]){bad="invalid or repeated field";return;}seen[key]=true;
    if(AUDIO_PROFILE_META.indexOf(key)>=0){bad="engine-owned field";return;}
    if(key!=="allows"&&key!=="forbid"){input[key]=kv[1];return;}
    if(kv[1]==="none"){input[key]=[];return;}
    var words=kv[1].split(",").map(function(x){return x.trim();}),known=words.filter(function(x){return AUDIO_CONTENTS.indexOf(x)>=0;});
    words.forEach(function(x){if(x&&AUDIO_CONTENTS.indexOf(x)<0&&dropped.indexOf(x)<0)dropped.push(x);});
    if(key==="allows"&&!known.length)noAllows=true;
    input[key]=known;});
  if(bad)return {ok:false,reason:bad};
  var v=audioValidateProfile(input);
  if(v.ok&&noAllows)v={ok:false,reason:"unknown content in allows"};   /* after the validator, so an enum mistake keeps its own reason */
  v.target=parts[0].trim();if(dropped.length)v.dropped=dropped;return v;
}
function audioSelect(s,catalog){
  var empty={scene:null,key:"",gain:0}, v=audioValidateProfile(s&&s.profile), m=s&&s.minuteOfDay;
  if(!v.ok||v.profile.quiet==="silent"||typeof m!=="number"||!isFinite(m)||m<0||m>=1440)return empty;
  var p=v.profile, eligible=(catalog.assets||[]).filter(function(a){
    var ok=a.approval;
    return a.role!=="accent"&&!a.seedOnly&&ok&&ok.recording&&ok.rights&&ok.contents&&ok.loop&&ok.mix&&a.cohort===(p.cohort||catalog.cohort)&&
      a.enclosures.indexOf(p.enclosure)>=0&&a.settings.indexOf(p.setting)>=0&&a.biomes.indexOf(p.biome)>=0&&
      (a.from<a.to?m>=a.from&&m<a.to:m>=a.from||m<a.to)&&
      a.contains.every(function(c){return p.allows.indexOf(c)>=0&&p.forbid.indexOf(c)<0;});
  }).sort(function(a,b){return a.id<b.id?-1:a.id>b.id?1:0;});
  if(!eligible.length)return empty;
  var asset=eligible[parseInt(audioHash(p.variant||s.nodeKey||""),16)%eligible.length];
  return {scene:asset,key:String(s.campaignId)+"|"+asset.role+"|"+asset.id,gain:p.quiet==="hushed"?0.5:1};
}
function audioCurrentScene(){
  var ws=typeof worldState!=="undefined"&&worldState,w=ws&&ws.world;
  if(!w||!w.location||(memory&&memory.campId&&ws.campId&&memory.campId!==ws.campId))return {campaignId:"",nodeKey:null};
  var key=locResolve(currentNodeKey()),nodes=memory&&memory.map&&memory.map.nodes,node=nodes&&nodes[key],kind=campaignKind(),common=null;
  if(kind==="village"&&node)AUDIO_SCENES.forEach(function(s){if(!s.bind.exterior&&locResolve(w.location+"|"+s.bind.common)===key)common=s.bind.common;});
  var hours=node&&node.hours,open=null,minute=clockMinuteOfDay();
  if(hours&&typeof hours.open==="number"&&typeof hours.close==="number"&&hours.open>=0&&hours.close<=24&&hours.close>=0&&hours.open<=24){var h=minute/60;open=hours.open<=hours.close?h>=hours.open&&h<hours.close:h>=hours.open||h<hours.close;}
  return {campaignId:ws.campId||getActiveCampId(),campaignKind:kind,nodeKey:key,common:common,open:open,minuteOfDay:minute,
    exterior:!!ambientExteriorNode(kind,w.location,key,nodes,locResolve,AUDIO_EXTERIORS),
    // Canonical house ownership identifies homes before their first soundscape classification.
    habitable:!!(kind==="village"&&node&&node.owner&&node.parent&&locResolve(node.parent)===locResolve(w.location)),
    profile:audioNodeProfile(node),classified:!!(node&&node.soundscape)&&!audioNodeStale(node),stale:audioNodeStale(node),generation:audioPlaybackGeneration};
}
function audioScenePublish(reason,force){
  if(audioCommitDepth&&!force)return;
  var ws=typeof worldState!=="undefined"&&worldState;
  if((ws&&ws.campId)!==audioPublishedWorld||(ws&&ws.character&&ws.character.name)!==audioPublishedCharacter||(ws&&ws.respawns)!==audioPublishedRespawns||reason==="load")audioPlaybackGeneration++;
  audioPublishedWorld=ws&&ws.campId;audioPublishedCharacter=ws&&ws.character&&ws.character.name;audioPublishedRespawns=ws&&ws.respawns;
  audioPublishedScene=reason==="save-failed"?{campaignId:"",nodeKey:null}:audioCurrentScene();
  if(audioPublishedScene.profile){Object.freeze(audioPublishedScene.profile.allows);Object.freeze(audioPublishedScene.profile.forbid);Object.freeze(audioPublishedScene.profile);}
  Object.freeze(audioPublishedScene);
  if(typeof document!=="undefined"&&document.dispatchEvent&&typeof CustomEvent!=="undefined")document.dispatchEvent(new CustomEvent("tnd:scene-committed",{detail:{reason:reason,generation:audioPlaybackGeneration}}));
}
