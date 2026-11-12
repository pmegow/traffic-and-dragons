/* atlas-public.js — the player atlas is a projection of public knowledge.
   The first representation is a schematic of the current place. Private recipes remain intact
   for migration/recovery, but no scene, card, identity lookup or prompt reads them in this mode. */
var _atlasPublicMemo=null;
function atlasPublicContext(){return atlasKnowledgeContext()||"Current place";}
/* The neutral unitless canvas uses the library's wild scale slot. No environmental kind is
   inferred from a sublocation string or a private legacy start classifier. */
function atlasPublicScale(){return "wild";}
function atlasPublicTitle(){var w=worldState.world||{};return String(w.sublocation||w.location||"Current place");}
function atlasPublicDoc(zoneId){
  var A=atlasLive(),s=memory&&memory.map&&memory.map.geography,k=atlasPublicContext(),p,signature,doc;
  if(!A||zoneId!==A.seed)throw new Error("public atlas: that sheet is not available");
  p=atlasKnowledgeProjection(k);
  signature=JSON.stringify([A.seed,k,atlasPublicTitle(),atlasPublicScale(),p]);
  if(_atlasPublicMemo&&_atlasPublicMemo.signature===signature)return _atlasPublicMemo.doc;
  doc=TnDMaps.schematic({scale:atlasPublicScale(),title:atlasPublicTitle(),features:p.features.map(function(f){return {id:f.id,name:f.label,kind:"landmark",bearing:f.bearing,mode:f.mode};})});
  _atlasPublicMemo={signature:signature,doc:doc};return doc;
}
function atlasPublicFollow(){
  var A,p,sig,changed;
  try{
    A=atlasLive();p=A?atlasPointer():null;
    if(!A||!p){if(typeof worldState!=="undefined"&&worldState)delete worldState.placeDecls;return null;}
    sig=JSON.stringify([p.world,p.sub]);changed=A.ptr!==sig||A.at!==A.seed;
    A.at=A.seed;A.spot=null;A.off=null;A.ptr=sig;delete worldState.placeDecls;
    return {changed:changed,at:A.at,spot:null,off:null,entered:[]};
  }catch(e){atlasProblem("following the public map",e);return null;}
}
function atlasPublicParty(zoneId){var A=atlasLive();return A&&zoneId===A.seed?{x:400,y:275,exact:false,last:false,key:null}:null;}
function atlasPublicCard(zoneId,target){
  var p=atlasKnowledgeProjection(atlasPublicContext()),i,f,t,doc;
  if(!target||target.id==null)return null;
  doc=atlasPublicDoc(zoneId);
  for(i=0;i<p.features.length;i++)if(p.features[i].id===target.id){
    f=p.features[i];t=doc.features.filter(function(x){return x.id===f.id;})[0];
    return {id:f.id,x:t.x,y:t.y,title:f.label,word:(f.mode==="reported"?"Reported":"Observed")+" · "+(f.bearing==="unknown"?"Position not established":f.bearing)+". Disclosed on turn "+f.source.turn+".",opens:null,unvisited:false,partyHere:false,place:null,added:null,note:atlasNote(zoneId,f.id)};
  }
  return null;
}
function atlasPublicWhere(){var A=atlasLive();return {placed:true,zone:A.seed,zoneName:atlasPublicTitle(),zoneKind:"schematic",spot:null,spotName:null,off:null,ties:[],text:"The party is in "+atlasPublicTitle()+". This map is schematic; positions and distances are not measured."};}
/* Explicit paths are authoritative. A bare room may reuse an existing scoped node, never a
   generated private room. New multi-room paths must be supplied by the narration's location tags. */
function atlasPublicCanon(name,parent,sub){
  var parts=atlasPathParts(String(name||"")),base=atlasPathParts(String(sub||"")),key;
  if(parts.length>1)return {key:atlasLocKey(String(parent)+"|"+atlasPathJoin(parts))};
  if(base.length>1){key=atlasLocKey(String(parent)+"|"+atlasPathJoin(base.slice(0,-1).concat(parts)));if(memory.map.nodes[key])return {key:key};}
  return null;
}
/* Activation is explicit during rollout. Retain the old atlas once, and refuse damaged/newer
   knowledge; absence of a migration record must never silently mean an empty recovered map. */
function atlasPublicEnable(){
  var A=atlasLive(),p,backup,knowledge,hasKnowledge,sig;
  if(!A)return {ok:false,reason:"this campaign has no compatible atlas"};
  if(SAVE_VER<13||ATLAS_VER<2)return {ok:false,reason:"this build cannot safely save public map knowledge"};
  if(!memory||!memory.map)return {ok:false,reason:"this campaign has no location memory"};
  if(A.knowledge===1){p=MapKnowledge.problem(memory.map.geography);return p?{ok:false,reason:p}:{ok:true,already:true};}
  try{
    hasKnowledge=Object.prototype.hasOwnProperty.call(memory.map,"geography");
    if(hasKnowledge){p=MapKnowledge.problem(memory.map.geography);if(p)return {ok:false,reason:p};}
    p=atlasPointer();if(!p)return {ok:false,reason:"the party has no established location"};
    sig=JSON.stringify([p.world,p.sub]);backup=JSON.parse(JSON.stringify(A));
    knowledge=hasKnowledge?memory.map.geography:MapKnowledge.create();
    if(typeof atlasPaneClose==="function")atlasPaneClose({defer:true});
  }catch(e){return {ok:false,reason:"map activation could not be prepared: "+atlasProblem("preparing the public map",e)};}
  A.legacyAtlas=backup;A.knowledge=1;A.v=ATLAS_VER;A.publicNotes=Object.create(null);
  memory.map.geography=knowledge;worldState.ver=SAVE_VER;
  A.at=A.seed;A.spot=null;A.off=null;A.ptr=sig;delete worldState.placeDecls;
  atlasForget();
  try{if(typeof atlasDoorPaint==="function")atlasDoorPaint();}
  catch(e2){atlasProblem("opening the public map",e2);}
  return {ok:true,withheldLegacy:true,reason:"Legacy recipes and notes are retained in the atlas backup; only sourced disclosures appear in the public sketch."};
}
