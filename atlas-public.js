/* atlas-public.js — the player atlas is a projection of public knowledge.
   Visited local sheets accumulate independently. Private recipes remain intact
   for migration/recovery, but no scene, card, identity lookup or prompt reads them in this mode. */
var _atlasPublicMemo=null;
function atlasPublicContext(){return atlasKnowledgeContext()||"Current place";}
/* Schematic units stay independent of terrain. Private start classifications never set scale. */
function atlasPublicScale(){return "wild";}
/* The sheet above the places: THE REGION (#771 P3) wherever place sheets are drawn; null where they are not (the journey sheet, #757, that stood there was removed in P4). */
function atlasPublicOverview(A){return atlasRegionOn(A)?{id:atlasRegionId(A),title:ATLAS_REGION_TITLE}:null;}
function atlasPublicRegionIs(A,zoneId){return atlasRegionOn(A)&&atlasRegionIs(A,zoneId);}
function atlasPublicTitle(zoneId){var A=atlasLive();if(atlasPublicRegionIs(A,zoneId))return ATLAS_REGION_TITLE;/* #771 P3 */var place=A?atlasPublicPlace(A,zoneId||A.at||A.seed):null;return place?place.name:"Current place";}
function atlasPublicDoc(zoneId){
  var A=atlasLive();if(atlasPublicRegionIs(A,zoneId))return atlasRegionDoc(A);/* #771 P3: the region */
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
  }catch(e){
    /* audit 2026-11-19, A8: at the place limit every follow — every turn, every pane open — raised a toast and mailed an
       error report. The limit is an answer: said once a session for the campaign, never reported. */
    if(e&&e.atlasLimit){atlasPublicLimitSay(atlasLive(),e);return null;}
    atlasProblem("following the public map",e);return null;
  }
}
function atlasPublicParty(zoneId){var A=atlasLive();if(atlasPublicRegionIs(A,zoneId))return atlasRegionParty(A);/* #771 P3 */var place=A?atlasPublicPlace(A,zoneId):null;var at=place?atlasSheetStand(atlasPublicDoc(zoneId)):null;/* #771 P2: a site's middle chamber, a drawn ground's middle, a pin sheet's */return place&&place.container===atlasPublicContext()?{x:at[0],y:at[1],exact:false,last:false,key:null,label:atlasSheetDrawn(atlasPublicDoc(zoneId))?(atlasSheetLeaf(place.container)||place.name):place.name}:null;}/* #764 (owner 2026-11-15: "the party is at Petrified Mire, might as well call it that"): a public sheet IS the place the party stands in, so its marker bears the place's name */

/* #769: the visited sheet a feature of this place IS — a sub-location of it bearing the feature's name (a leading "the",
   case and punctuation folded). The den pinned on the ridge opens the den. null when the party has not been inside. */
function atlasPublicChildSheet(A,place,label){
  var rows=atlasPublicPlacesList(A),want=atlasKnowledgeFold(label),i,r;
  if(!want)return null;
  for(i=0;i<rows.length;i++){r=rows[i];if(atlasSheetParent(r.container)===place.container&&atlasKnowledgeFold(atlasSheetLeaf(r.container))===want)return r.id;}/* #771: its OWN child — a den two steps down opens from the place it is in */
  return null;
}
/* audit 2026-11-19, A1 (owner ruling: notes are kept by sheet). The keys a note on a public sheet's thing is read under,
   the first being where it is written. A way out and a place inside bear positional ids (way-1, in-1) that every sheet
   repeats and that shift as the record grows, so their notes are filed under a REFERENCE to what they are:
   ["way", <this place>, <the place it leads to>] and ["in", <this place>, <the place inside>], as a JSON key. Places are
   named by their filing keys and RESOLVED AT THE READ (atlasPublicNoteStored): a note written before a place was merged
   is found under the name it was written with — the rule the map's own records follow (the review of the first build
   keyed by sheet id and unresolved name, and a merge left the note unreachable). A FEATURE keeps its own id (unique in
   the campaign), so notes saved before this build stay where they are; a feature that IS a way, or that names a place
   inside, also reads the note that thing had. The bare positional id comes last: what builds before v1.1478 stored,
   shared by every sheet — shown where a thing has no note of its own, and never removed by saving another note. */
function atlasPublicNoteStored(ref){
  var A=atlasLive(),notes=A&&A.publicNotes,canon=JSON.stringify(ref),out=[canon],ks,i,p;
  if(!notes||typeof notes!=="object")return out;
  ks=Object.keys(notes);
  for(i=0;i<ks.length;i++){
    if(ks[i]===canon||ks[i].charAt(0)!=="[")continue;
    try{p=JSON.parse(ks[i]);}catch(e){continue;}
    if(Array.isArray(p)&&p.length===3&&typeof p[1]==="string"&&typeof p[2]==="string"&&atlasPublicPlaceKey(p[1])===ref[1]&&atlasPublicPlaceKey(p[2])===ref[2])out.push(ks[i]);
  }
  return out;
}
/* the visited place inside this one that bears the label, as its filing key, or null */
function atlasPublicChildContainer(A,place,label){
  var rows=atlasPublicPlacesList(A),want=atlasKnowledgeFold(label),i,r;
  if(!want)return null;
  for(i=0;i<rows.length;i++){r=rows[i];if(atlasSheetParent(r.container)===place.container&&atlasKnowledgeFold(atlasSheetLeaf(r.container))===want)return r.container;}
  return null;
}
function atlasPublicNoteKeys(zoneId,id){
  var A=atlasLive(),place,doc,sheet,feats,i,w,child,here;
  id=String(id);
  try{
    if(!A||atlasPublicRegionIs(A,zoneId))return [id];
    place=atlasPublicPlace(A,zoneId);if(!place)return [id];
    doc=atlasPublicDoc(zoneId);if(!atlasSheetDrawn(doc))return [id];
    feats=atlasKnowledgeShown(place.container,atlasKnowledgeProjection(place.container).features);
    sheet=atlasSheetOf(A,place,feats);if(!sheet)return [id];
    here=atlasPublicPlaceKey(place.container);
    for(i=0;i<sheet.ways.length;i++){
      w=sheet.ways[i];
      if(w.feature===id)return [id].concat(atlasPublicNoteStored(["way",here,atlasPublicPlaceKey(w.key)]));
      if(w.id===id)return atlasPublicNoteStored(["way",here,atlasPublicPlaceKey(w.key)]).concat([id]);
    }
    for(i=0;i<sheet.inside.length;i++)if(sheet.inside[i].id===id)return atlasPublicNoteStored(["in",here,atlasPublicPlaceKey(sheet.inside[i].key)]).concat([id]);
    for(i=0;i<feats.length;i++)if(feats[i].id===id){child=atlasPublicChildContainer(A,place,feats[i].label);if(child)return [id].concat(atlasPublicNoteStored(["in",here,atlasPublicPlaceKey(child)]));}
  }catch(e){if(typeof console!=="undefined")console.warn("[atlas] the note keys of "+id+" could not be read: "+((e&&e.message)||e));}
  return [id];
}
function atlasPublicCard(zoneId,target){
  var A=atlasLive();if(atlasPublicRegionIs(A,zoneId))return atlasRegionCard(A,target);/* #771 P3 */
  var place=A?atlasPublicPlace(A,zoneId):null,p,i,f,t,doc,sheet,w,at,stand;
  if(!place)return null;p=atlasKnowledgeProjection(place.container);p={features:atlasKnowledgeShown(place.container,p.features)};/* #756 */
  if(!target||target.id==null)return null;
  doc=atlasPublicDoc(zoneId);
  /* #771 P1: on a drawn sheet a way out and a place inside are things too — each opens the sheet it leads to */
  sheet=atlasSheetDrawn(doc)?atlasSheetOf(A,place,p.features):null;
  at=atlasSheetStand(doc);stand=at;
  if(sheet)for(i=0;i<sheet.ways.length;i++)if(sheet.ways[i].id===target.id&&!sheet.ways[i].feature){
    w=sheet.ways[i];at=(doc.portals||[]).filter(function(x){return x.id===w.id;})[0];
    return {id:w.id,x:at?at.x:stand[0],y:at?at.y:stand[1],title:"The way to "+w.name,word:w.bearing?"The party travelled this way. It leads "+ATLAS_KNOWLEDGE_DIRECTIONS[w.bearing]+".":"The party travelled between these places. Its direction was never stated, so the way is drawn dotted.",opens:w.to,unvisited:false,partyHere:false,place:null,added:null,note:atlasNote(zoneId,w.id)};/* audit 2026-11-19, A1 */
  }
  if(sheet)for(i=0;i<sheet.inside.length;i++)if(sheet.inside[i].id===target.id){
    w=sheet.inside[i];return {id:w.id,x:stand[0],y:stand[1],title:w.name,word:"A place within "+place.name+" the party has entered. Where it lies was never stated.",opens:w.to,unvisited:false,partyHere:false,place:null,added:null,note:atlasNote(zoneId,w.id)};
  }
  for(i=0;i<p.features.length;i++)if(p.features[i].id===target.id){
    f=p.features[i];t=doc.features.filter(function(x){return x.id===f.id;})[0]||(doc.portals||[]).filter(function(x){return x.id===f.id;})[0];
    w=sheet?sheet.ways.filter(function(x){return x.feature===f.id;})[0]:null;/* #771: this feature is a way out — its card opens where the way leads */
    return {id:f.id,x:t?t.x:stand[0],y:t?t.y:stand[1],title:f.label,word:(f.mode==="reported"?"Reported":"Observed")+" · "+(f.bearing==="unknown"?"Position not established":f.bearing)+". Disclosed on turn "+f.source.turn+".",opens:atlasPublicChildSheet(A,place,f.label)||(w?w.to:null),unvisited:false,partyHere:false,place:null,added:null,note:atlasNote(zoneId,f.id)};
  }
  return null;
}
/* #771 P3, the fog of a public sheet: the region's (the ground the party has seen); every other public sheet is whole. */
function atlasPublicReveal(zoneId){var A=atlasLive();return atlasPublicRegionIs(A,zoneId)?atlasRegionReveal(A):null;}
function atlasPublicRevealNone(zoneId){var A=atlasLive();return atlasPublicRegionIs(A,zoneId)?atlasRegionRevealNone(A):null;}
/* The plaque's tiers: the region (#771 P3; no tier above the places where place sheets are not drawn), then the place the party stands in UNDER the places around it — Petrified
   Mire › Shattered Ridge › Wyrm Lair (#771 P2, the owner's hierarchy). A place around it the party never stood in itself
   has no sheet to open and is no tier. Each tier is named by its own step; a tap opens its sheet. */
function atlasPublicTrail(A,shownZone){
  var over=atlasPublicOverview(A),out=over?[{key:over.id,text:over.title,current:over.id===shownZone}]:[],place=atlasPublicPlace(A,A.at),rows,chain=[],key,i,j;
  if(!place||place.container!==atlasPublicContext())return out;
  rows=atlasPublicPlacesList(A);
  for(key=place.container;key!==null;key=atlasSheetParent(key))chain.unshift(key);
  for(i=0;i<chain.length;i++)for(j=0;j<rows.length;j++)if(rows[j].container===chain[i])out.push({key:rows[j].id,text:i===chain.length-1&&chain.length===1?rows[j].name:(atlasSheetLeaf(rows[j].container)||rows[j].name),current:rows[j].id===shownZone});
  return out;
}
function atlasPublicWhere(){
  var A=atlasLive(),place=A?atlasPublicPlace(A,A.at):null,placed=!!place&&place.container===atlasPublicContext();
  return {placed:placed,zone:placed?place.id:null,zoneName:placed?place.name:null,zoneKind:"schematic",spot:null,spotName:null,off:null,ties:[],text:placed?"The party is in "+place.name+". This map is schematic; positions and distances are not measured.":"The current place has no mapped sheet. Earlier explored places remain available."};
}
/* Explicit paths are authoritative. A bare room may reuse an existing scoped node, never a
   generated private room. New multi-room paths must be supplied by the narration's location tags. */
/* #771 P2 (owner 2026-11-15: "the hierarchy should be Petrified Mire: Shattered Ridge: Wyrm lair"): a bare name written
   while the party stands in a place inside the world place is read from WHERE IT STANDS, in this order — a place already
   it stands in or one around it, named again (that very place); a place already known inside the one it stands in (the
   way back in); a place known beside it (as before); a place known at the world
   place's own level (the default's to find); else, when the sheet of the place it stands in SHOWS a feature of that name,
   the site the map already pins there: filed INSIDE it (the lair on the ridge is in the ridge, never beside it). Anything
   else is a new place of the world place, as always. No name is guessed: every branch is a node or a public feature. */
function atlasPublicCanon(name,parent,sub){
  var parts=atlasPathParts(String(name||"")),base=atlasPathParts(String(sub||"")),key,here,want,shown,i;
  if(parts.length>1)return {key:atlasLocKey(String(parent)+"|"+atlasPathJoin(parts))};
  if(!parts.length||!base.length)return null;
  want=atlasKnowledgeFold(parts[0]);if(!want)return null;
  for(i=base.length-1;i>=0;i--)if(atlasKnowledgeFold(base[i])===want)return {key:atlasLocKey(String(parent)+"|"+atlasPathJoin(base.slice(0,i+1)))};/* the place it stands in, or one around it, named again: that very place (the lair, named from the nest inside it) */
  key=atlasLocKey(String(parent)+"|"+atlasPathJoin(base.concat(parts)));if(memory.map.nodes[key])return {key:key};
  if(base.length>1){key=atlasLocKey(String(parent)+"|"+atlasPathJoin(base.slice(0,-1).concat(parts)));if(memory.map.nodes[key])return {key:key};}
  if(memory.map.nodes[atlasLocKey(String(parent)+"|"+parts[0])])return null;
  here=atlasLocKey(String(parent)+"|"+atlasPathJoin(base));
  try{shown=atlasKnowledgeShown(here,atlasKnowledgeProjection(here).features);}
  catch(e){if(typeof console!=="undefined")console.warn("[public map] the sheet of "+here+" could not be read for a site named on it: "+((e&&e.message)||e));return null;}
  for(i=0;i<shown.length;i++)if(atlasKnowledgeFold(shown[i].label)===want)return {key:atlasLocKey(String(parent)+"|"+atlasPathJoin(base.concat(parts)))};
  return null;
}
/* [SUBLOCATION_LEAVE] from a place inside another steps OUT ONE: the lair to the ridge, the ridge to the mire. */
function atlasPublicLeave(sub){var parts=atlasPathParts(String(sub||""));return parts.length>1?atlasPathJoin(parts.slice(0,-1)):null;}
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
