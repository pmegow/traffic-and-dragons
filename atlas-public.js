/* atlas-public.js — the player atlas is a projection of public knowledge.
   Visited local sheets accumulate independently. Private recipes remain intact
   for migration/recovery, but no scene, card, identity lookup or prompt reads them in this mode. */
var _atlasPublicMemo=null;
function atlasPublicContext(){return atlasKnowledgeContext()||"Current place";}
/* Schematic units stay independent of terrain. Private start classifications never set scale. */
function atlasPublicScale(){return "wild";}
function atlasPublicTitle(zoneId){var A=atlasLive();if(atlasJourneyIs(A,zoneId))return ATLAS_JOURNEY_TITLE;/* #757 */var place=A?atlasPublicPlace(A,zoneId||A.at||A.seed):null;return place?place.name:"Current place";}
function atlasPublicDoc(zoneId){
  var A=atlasLive();if(atlasJourneyIs(A,zoneId))return atlasJourneyDoc(A);/* #757: the journey sheet */
  var place=A?atlasPublicPlace(A,zoneId):null,k,p,signature,doc,landscape,sheet;
  if(!place)throw new Error("public atlas: that sheet is not available");
  k=place.container;p=atlasKnowledgeProjection(k);p={features:atlasKnowledgeShown(k,p.features)};/* #756: a place is not a feature of itself */landscape=atlasPublicLandscape(place.name,p.features);
  sheet=A.drawn===false?null:atlasSheetOf(A,place,p.features);/* worldState.atlas.drawn === false is the campaign switch (no UI): pin sheets only *//* #771 P1: the place drawn on its own ground, when the story says what ground it is */
  signature=JSON.stringify([place.id,k,place.name,atlasPublicScale(),p,landscape,sheet?sheet.params:null]);
  if(_atlasPublicMemo&&_atlasPublicMemo.signature===signature)return _atlasPublicMemo.doc;
  var spec={scale:atlasPublicScale(),title:place.name,features:p.features.map(function(f){return {id:f.id,name:f.label,kind:"landmark",bearing:f.bearing,mode:f.mode};})};
  if(landscape.terrain.length||landscape.routes.length)spec.landscape=landscape;
  doc=atlasSheetDoc(place,sheet)||TnDMaps.schematic(spec);/* no ground known, or the drawing refused (said once): the pin sheet */
  _atlasPublicMemo={signature:signature,doc:doc};return doc;
}
function atlasPublicFollow(){
  var A,p,sig,changed,id;
  try{
    A=atlasLive();p=A?atlasPointer():null;
    if(!A||!p){if(typeof worldState!=="undefined"&&worldState)delete worldState.placeDecls;return null;}
    sig=JSON.stringify([p.world,p.sub]);id=atlasPublicPlacesFollow(A);changed=A.ptr!==sig||A.at!==id;
    A.at=id;A.spot=null;A.off=null;A.ptr=sig;delete worldState.placeDecls;
    return {changed:changed,at:A.at,spot:null,off:null,entered:[]};
  }catch(e){atlasProblem("following the public map",e);return null;}
}
function atlasPublicParty(zoneId){var A=atlasLive();if(atlasJourneyIs(A,zoneId))return atlasJourneyParty(A);/* #757 */var place=A?atlasPublicPlace(A,zoneId):null;var drawn=place&&atlasPublicDoc(zoneId).generator.name==="wild";return place&&place.container===atlasPublicContext()?{x:drawn?ATLAS_SHEET_CENTRE[0]:400,y:drawn?ATLAS_SHEET_CENTRE[1]:275,exact:false,last:false,key:null,label:place.name}:null;}/* #764 (owner 2026-11-15: "the party is at Petrified Mire, might as well call it that"): a public sheet IS the place the party stands in, so its marker bears the place's name */

/* #769: the visited sheet a feature of this place IS — a sub-location of it bearing the feature's name (a leading "the",
   case and punctuation folded). The den pinned on the ridge opens the den. null when the party has not been inside. */
function atlasPublicChildSheet(A,place,label){
  var rows=atlasPublicPlacesList(A),want=atlasKnowledgeFold(label),pre=place.container+"|",i,r;
  if(!want)return null;
  for(i=0;i<rows.length;i++){r=rows[i];if(r.container.indexOf(pre)===0&&atlasKnowledgeFold(r.name)===want)return r.id;}
  return null;
}
function atlasPublicCard(zoneId,target){
  var A=atlasLive();if(atlasJourneyIs(A,zoneId))return atlasJourneyCard(A,target);/* #757 */
  var place=A?atlasPublicPlace(A,zoneId):null,p,i,f,t,doc,sheet,w,at;
  if(!place)return null;p=atlasKnowledgeProjection(place.container);p={features:atlasKnowledgeShown(place.container,p.features)};/* #756 */
  if(!target||target.id==null)return null;
  doc=atlasPublicDoc(zoneId);
  /* #771 P1: on a drawn sheet a way out and a place inside are things too — each opens the sheet it leads to */
  sheet=doc.generator&&doc.generator.name==="wild"?atlasSheetOf(A,place,p.features):null;
  if(sheet)for(i=0;i<sheet.ways.length;i++)if(sheet.ways[i].id===target.id&&!sheet.ways[i].feature){
    w=sheet.ways[i];at=(doc.portals||[]).filter(function(x){return x.id===w.id;})[0];
    return {id:w.id,x:at?at.x:ATLAS_SHEET_CENTRE[0],y:at?at.y:ATLAS_SHEET_CENTRE[1],title:"The way to "+w.name,word:w.bearing?"The party travelled this way. It leads "+ATLAS_KNOWLEDGE_DIRECTIONS[w.bearing]+".":"The party travelled between these places. Its direction was never stated, so the way is drawn dotted.",opens:w.to,unvisited:false,partyHere:false,place:null,added:null,note:null};
  }
  if(sheet)for(i=0;i<sheet.inside.length;i++)if(sheet.inside[i].id===target.id){
    w=sheet.inside[i];return {id:w.id,x:ATLAS_SHEET_CENTRE[0],y:ATLAS_SHEET_CENTRE[1],title:w.name,word:"A place within "+place.name+" the party has entered. Where it lies was never stated.",opens:w.to,unvisited:false,partyHere:false,place:null,added:null,note:null};
  }
  for(i=0;i<p.features.length;i++)if(p.features[i].id===target.id){
    f=p.features[i];t=doc.features.filter(function(x){return x.id===f.id;})[0]||(doc.portals||[]).filter(function(x){return x.id===f.id;})[0];
    w=sheet?sheet.ways.filter(function(x){return x.feature===f.id;})[0]:null;/* #771: this feature is a way out — its card opens where the way leads */
    return {id:f.id,x:t?t.x:ATLAS_SHEET_CENTRE[0],y:t?t.y:ATLAS_SHEET_CENTRE[1],title:f.label,word:(f.mode==="reported"?"Reported":"Observed")+" · "+(f.bearing==="unknown"?"Position not established":f.bearing)+". Disclosed on turn "+f.source.turn+".",opens:atlasPublicChildSheet(A,place,f.label)||(w?w.to:null),unvisited:false,partyHere:false,place:null,added:null,note:atlasNote(zoneId,f.id)};
  }
  return null;
}
function atlasPublicWhere(){
  var A=atlasLive(),place=A?atlasPublicPlace(A,A.at):null,placed=!!place&&place.container===atlasPublicContext();
  return {placed:placed,zone:placed?place.id:null,zoneName:placed?place.name:null,zoneKind:"schematic",spot:null,spotName:null,off:null,ties:[],text:placed?"The party is in "+place.name+". This map is schematic; positions and distances are not measured.":"The current place has no mapped sheet. Earlier explored places remain available."};
}
/* Explicit paths are authoritative. A bare room may reuse an existing scoped node, never a
   generated private room. New multi-room paths must be supplied by the narration's location tags. */
function atlasPublicCanon(name,parent,sub){
  var parts=atlasPathParts(String(name||"")),base=atlasPathParts(String(sub||"")),key;
  if(parts.length>1)return {key:atlasLocKey(String(parent)+"|"+atlasPathJoin(parts))};
  if(base.length>1){key=atlasLocKey(String(parent)+"|"+atlasPathJoin(base.slice(0,-1).concat(parts)));if(memory.map.nodes[key])return {key:key};}
  return null;
}
/* Activation of an existing campaign is explicit. Retain the old atlas once, and refuse damaged/newer
   knowledge; absence of a migration record must never silently mean an empty recovered map. */
function atlasPublicEnable(){
  var A=atlasLive(),p,backup,knowledge,hasKnowledge,sig,places;
  if(!A)return {ok:false,reason:"this campaign has no compatible atlas"};
  if(SAVE_VER<14||ATLAS_VER<3)return {ok:false,reason:"this build cannot safely save public map knowledge"};
  if(!memory||!memory.map)return {ok:false,reason:"this campaign has no location memory"};
  if(A.knowledge===1){p=MapKnowledge.problem(memory.map.geography);return p?{ok:false,reason:p}:{ok:true,already:true};}
  try{
    hasKnowledge=Object.prototype.hasOwnProperty.call(memory.map,"geography");
    if(hasKnowledge){p=MapKnowledge.problem(memory.map.geography);if(p)return {ok:false,reason:p};}
    p=atlasPointer();if(!p)return {ok:false,reason:"the party has no established location"};
    sig=JSON.stringify([p.world,p.sub]);backup=JSON.parse(JSON.stringify(A));places=atlasPublicPlacesRead(A);
    knowledge=hasKnowledge?memory.map.geography:MapKnowledge.create();
    if(typeof atlasPaneClose==="function")atlasPaneClose({defer:true});
  }catch(e){return {ok:false,reason:"map activation could not be prepared: "+atlasProblem("preparing the public map",e)};}
  A.legacyAtlas=backup;A.knowledge=1;A.v=ATLAS_VER;A.publicNotes=Object.create(null);
  memory.map.geography=knowledge;worldState.ver=SAVE_VER;
  A.publicPlaces=places;A.at=A.seed;A.spot=null;A.off=null;A.ptr=sig;delete worldState.placeDecls;
  atlasForget();
  try{if(typeof atlasDoorPaint==="function")atlasDoorPaint();}
  catch(e2){atlasProblem("opening the public map",e2);}
  return {ok:true,withheldLegacy:true,reason:"Legacy recipes and notes are retained in the atlas backup; only sourced disclosures appear in the public sketch."};
}
