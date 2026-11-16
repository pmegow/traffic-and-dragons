/* atlas-public-sheet.js — THE PLACE SHEET (#771 P1, owner 2026-11-15: "What I want is an illustration of the area I'm in…
   the player's current location mapped with topological details (swamp reeds, patches, etc), including exits from the
   current location. The next location should have an exit back to the previous one").

   THE PRINCIPLE (DOC/DESIGN_771_story_led_maps.md): the story decides what exists and where it leads; the generator
   decides only what the ground looks like. This file turns ONE place's PUBLIC record into the recipe TnD Maps 0.24.0
   draws as a story sheet — read at every draw, never stored, nothing private read:
     ground    the place's own name says it (Petrified Mire is marsh, Shattered Ridge is mountain) — the phrase's head
               noun, one row of nouns per ground of the library; else a plain observed feature says it (deep timber);
               else NOTHING is drawn and the place keeps its pin sheet. The engine never guesses a ground.
     exits     a world place: every way the party travelled to or from it (memory.map.edges), toward the place it leads
               to. A place inside another: the way back out to the place around it. The direction is the story's — a
               public feature of one end bearing the other's name with a stated bearing (the journey sheet's rule) —
               and a way whose direction nobody stated is laid at the first free edge and drawn DOTTED.
     features  every shown public feature with a bearing, set down toward it on fitting ground; one the story only
               reported is a ring. A feature that IS the place an exit leads to is the exit, not a second pin.
     listed    what has no direction, and a visited place inside this one that no feature names: listed, never drawn.
   Stability: the library's story sheet moves nothing when an exit is added; features are handed over in the order the
   story disclosed them, so a later one never takes an earlier one's ground. */
var ATLAS_SHEET_GROUNDS=[
  {terrain:"forest",nouns:["forest","woods","wood","woodland","woodlands","timber","weald","grove","thicket","jungle","copse","glade","clearing"]},
  {terrain:"marsh",nouns:["marsh","marshes","swamp","swamps","wetlands","bog","bogs","fen","fens","mire","mires","morass","quagmire","slough"]},
  {terrain:"desert",nouns:["desert","dunes","waste","wastes","wasteland","wastelands","sands","badlands","barrens"]},
  {terrain:"mountain",nouns:["mountain","mountains","peak","peaks","ridge","ridges","crag","crags","cliff","cliffs","pass","summit","spire","spires","escarpment","scarp","gorge","ravine","canyon"]},
  {terrain:"hills",nouns:["hill","hills","downs","highlands","bluff","bluffs","knoll","fells","foothills"]},
  {terrain:"heath",nouns:["heath","moor","moors","moorland","grassland","grasslands","meadow","meadows","plain","plains","steppe","prairie","field","fields","crossroads","crossing"]}
];
/* What a plain observed thing is DRAWN as: the library's own mark for its head noun. The name stays the story's. */
var ATLAS_SHEET_KINDS=[
  {kind:"pond",nouns:["pool","pond","mere","tarn"]},{kind:"spring",nouns:["spring"]},{kind:"fall",nouns:["waterfall","falls"]},
  {kind:"den",nouns:["den","lair","nest","burrow","warren"]},{kind:"bones",nouns:["bones","carcass","skeleton","remains"]},
  {kind:"cairn",nouns:["cairn"]},{kind:"barrow",nouns:["barrow","mound","tomb"]},{kind:"stone",nouns:["stone","monolith","menhir","obelisk","pillar"]},{kind:"stones",nouns:["stones"]},
  {kind:"ruin",nouns:["ruin","ruins"]},{kind:"hut",nouns:["hut","cabin","shack","hovel","cottage","bothy"]},{kind:"barn",nouns:["barn"]},{kind:"camp",nouns:["camp","campsite","encampment"]},
  {kind:"shrine",nouns:["shrine","altar"]},{kind:"well",nouns:["well"]},{kind:"arch",nouns:["arch"]},{kind:"gallows",nouns:["gallows"]},
  {kind:"tree",nouns:["tree","oak","yew"]},{kind:"snag",nouns:["snag","stump"]},{kind:"copse",nouns:["copse","grove","thicket"]},{kind:"glade",nouns:["glade","clearing"]}
];
var ATLAS_SHEET_WAY_NOUNS=["road","causeway","highway","path","trail","track","lane","way"];
var ATLAS_SHEET_NAME_MAX=40,ATLAS_SHEET_WAY_MAX=80,ATLAS_SHEET_EXIT_CAP=16,ATLAS_SHEET_LIST_CAP=64,ATLAS_SHEET_LIST_NAME_MAX=200;
var ATLAS_SHEET_SIZE=700;/* a SQUARE sheet: a phone and the drawer are tall, and a square shows half its width there where the zone's 800 by 550 showed a third */
var ATLAS_SHEET_CENTRE=[ATLAS_SHEET_SIZE/2,ATLAS_SHEET_SIZE/2];/* where the party stands on a drawn sheet */
var _atlasSheetSaid=null;
/* The head noun of a phrase: its last word, an article and an "of …" tail set aside (The Crossroads of Ashenveil → crossroads). */
function atlasSheetNoun(phrase){
  var p=String(phrase||"").toLowerCase().replace(/^(?:the|a|an) /,"").replace(/ of .*$/,"").replace(/[^a-z' ]+/g," ").replace(/\s+/g," ").trim().split(" ");
  return p[p.length-1]||"";
}
function atlasSheetRow(table,phrase){var n=atlasSheetNoun(phrase),i;if(!n)return null;for(i=0;i<table.length;i++)if(table[i].nouns.indexOf(n)>=0)return table[i];return null;}
function atlasSheetCut(s,max){s=String(s||"").trim();return s.length<=max?s:s.slice(0,max-1).replace(/\s+$/,"")+"…";}
/* A plain one-word label that is a noun of the sheet's OWN ground names the ground, not a thing on it. */
function atlasSheetIsGround(terrain,label){
  var p=String(label||"").toLowerCase().replace(/^(?:the|a|an) /,"").replace(/[^a-z' ]+/g," ").replace(/\s+/g," ").trim(),i;
  if(!p||p.indexOf(" ")>=0||atlasPublicLandscapeNamed(label))return false;
  for(i=0;i<ATLAS_SHEET_GROUNDS.length;i++)if(ATLAS_SHEET_GROUNDS[i].terrain===terrain)return ATLAS_SHEET_GROUNDS[i].nouns.indexOf(p)>=0;
  return false;
}
/* The ground a place is drawn on, or null (no drawing): its own name, else the first plain observed feature that says one. */
function atlasSheetGround(place,features){
  var row=atlasSheetRow(ATLAS_SHEET_GROUNDS,place.name),i,f,w;
  if(row)return row.terrain;
  if(ATLAS_SHEET_WAY_NOUNS.indexOf(atlasSheetNoun(place.name))>=0){/* a place that is a WAY wears the ground it runs through: the Forest Road is forest */
    w=String(place.name).toLowerCase().replace(/[^a-z' ]+/g," ").split(" ");
    for(i=0;i<w.length-1;i++){row=atlasSheetRow(ATLAS_SHEET_GROUNDS,w[i]);if(row)return row.terrain;}
  }
  for(i=0;i<features.length;i++){f=features[i];if(f.mode!=="observed"||atlasPublicLandscapeNamed(f.label))continue;row=atlasSheetRow(ATLAS_SHEET_GROUNDS,f.label);if(row)return row.terrain;}
  return null;
}
/* The ways out of a place: [{id, key, name, bearing|null, to}] in a stable order — key is the container it leads to, to
   the visited sheet a tap opens (null when the party never stood there itself). */
function atlasSheetWays(A,place){
  var rows=atlasPublicPlacesList(A),k=place.container,cut=k.lastIndexOf("|"),out=[],places,legs,i,l,other,p,parent,b;
  function sheetOf(key){var j;for(j=0;j<rows.length;j++)if(rows[j].container===key)return rows[j].id;return null;}
  if(cut>=0){
    parent=k.slice(0,cut);b=null;
    try{p=atlasKnowledgeProjection(parent).features;for(i=0;i<p.length&&!b;i++)if(p[i].bearing!=="unknown"&&atlasKnowledgeSelfLabel(k,p[i].label))b=ATLAS_JOURNEY_OPPOSITE[p[i].bearing];}
    catch(e){if(typeof console!=="undefined")console.warn("[sheet] the way back out could not be read: "+((e&&e.message)||e));}
    out.push({key:parent,name:atlasPublicPlaceName(parent),bearing:b,lean:"S",to:sheetOf(parent)});
  }else{
    places=atlasJourneyPlaces(A);legs=atlasJourneyLegs(places);
    for(i=0;i<legs.length;i++){
      l=legs[i];other=l.a===k?l.b:(l.b===k?l.a:null);if(!other)continue;
      p=places.filter(function(x){return x.key===other;})[0];
      out.push({key:other,name:p?p.name:atlasPublicPlaceName(other),bearing:l.bearing?(l.a===k?l.bearing:ATLAS_JOURNEY_OPPOSITE[l.bearing]):null,lean:l.a===k?"S":"N",to:p?p.zone:null});
    }
  }
  out=out.slice(0,ATLAS_SHEET_EXIT_CAP);
  for(i=0;i<out.length;i++)out[i].id="way-"+(i+1);
  return out;
}
/* The visited places INSIDE this one that none of its shown features names: [{id, name, to}]. */
function atlasSheetInside(A,place,features){
  var rows=atlasPublicPlacesList(A),pre=place.container+"|",out=[],i,j,r,named;
  for(i=0;i<rows.length;i++){
    r=rows[i];if(r.container.indexOf(pre)!==0||r.container.slice(pre.length).indexOf("|")>=0)continue;
    named=false;for(j=0;j<features.length&&!named;j++)if(atlasKnowledgeFold(features[j].label)===atlasKnowledgeFold(r.name))named=true;
    if(!named)out.push({id:"in-"+(out.length+1),name:r.name,to:r.id});
  }
  return out;
}
/* PURE over what it is handed: the place, its shown features, its ways and the places inside it → the recipe, or null
   when no ground is known. {terrain, params, ways, inside} — params is what TnDMaps.generate("wild", …) takes. */
function atlasSheetRecipe(place,features,ways,inside){
  var terrain=atlasSheetGround(place,features),used=Object.create(null),exits=[],edits=[],listed=[],isWay=Object.create(null),byName=Object.create(null),sorted,i,f,w,row,j,e,k;
  if(!terrain)return null;
  sorted=features.slice().sort(function(a,b){var ta=a.source&&a.source.turn||0,tb=b.source&&b.source.turn||0;return (ta-tb)||(a.id<b.id?-1:a.id>b.id?1:0);});
  for(i=0;i<sorted.length;i++){k=atlasKnowledgeFold(sorted[i].label);if(k&&!byName[k])byName[k]=sorted[i];}
  /* a feature that names the place a way leads to IS that way: one thing on the sheet, under the feature's own id — so its card, and a note the player wrote on it, stay with it */
  ways=ways.map(function(x){var named=byName[atlasKnowledgeFold(x.name)];if(named)isWay[named.id]=true;return {id:named?named.id:x.id,key:x.key,name:x.name,bearing:x.bearing,lean:x.lean,to:x.to,feature:named?named.id:null};});
  for(i=0;i<ways.length;i++)if(ways[i].bearing)used[ways[i].bearing]=true;
  for(i=0;i<ways.length;i++){
    w=ways[i];e={id:w.id,name:atlasSheetCut(w.name,ATLAS_SHEET_WAY_MAX),sure:!!w.bearing,bearing:w.bearing};
    if(!e.bearing&&w.lean&&!used[w.lean])e.bearing=w.lean;/* the journey sheet lays an unstated way DOWN the sheet: onward is south, the way back north, so both ends of one way agree */
    if(!e.bearing){for(j=0;j<ATLAS_JOURNEY_UNSURE_ORDER.length&&!e.bearing;j++)if(!used[ATLAS_JOURNEY_UNSURE_ORDER[j]])e.bearing=ATLAS_JOURNEY_UNSURE_ORDER[j];if(!e.bearing)e.bearing=ATLAS_JOURNEY_UNSURE_ORDER[0];}
    used[e.bearing]=true;
    exits.push(e);
  }
  for(i=0;i<sorted.length;i++){
    f=sorted[i];
    if(isWay[f.id])continue;/* the exit says it */
    if(atlasSheetIsGround(terrain,f.label))continue;/* "mire" on a mire, "ridge" on a ridge: the ground is drawn, not pinned */
    if(f.bearing==="unknown"){if(listed.length<ATLAS_SHEET_LIST_CAP)listed.push({id:f.id,name:atlasSheetCut(f.label,ATLAS_SHEET_LIST_NAME_MAX),mode:f.mode});continue;}
    row=f.mode==="observed"&&!atlasPublicLandscapeNamed(f.label)?atlasSheetRow(ATLAS_SHEET_KINDS,f.label):null;
    e={op:"add",id:f.id,kind:row?row.kind:"custom",name:atlasSheetCut(f.label,ATLAS_SHEET_NAME_MAX),bearing:f.bearing,mode:f.mode};
    if(!row)e.word="a place";
    edits.push(e);
  }
  for(i=0;i<inside.length&&listed.length<ATLAS_SHEET_LIST_CAP;i++)listed.push({id:inside[i].id,name:atlasSheetCut(inside[i].name,ATLAS_SHEET_LIST_NAME_MAX),mode:"observed"});
  return {terrain:terrain,ways:ways,inside:inside,params:{seed:place.id+"/sheet",width:ATLAS_SHEET_SIZE,height:ATLAS_SHEET_SIZE,terrain:terrain,title:place.name,site:{exits:exits,unplaced:listed},edits:edits}};
}
/* The recipe of a visited sheet from the live record, or null. A failure to read it is said once and the pin sheet stands. */
function atlasSheetOf(A,place,features){
  try{return atlasSheetRecipe(place,features,atlasSheetWays(A,place),atlasSheetInside(A,place,features));}
  catch(e){atlasSheetProblem(place,"reading the record for the drawing of "+place.name,e);return null;}
}
function atlasSheetProblem(place,where,e){
  var key=place.id+"\n"+where+"\n"+((e&&e.message)||e);
  if(_atlasSheetSaid===key)return;_atlasSheetSaid=key;
  atlasProblem(where+" (the pin sheet is shown instead)",e);
}
/* The drawn document, or null (no ground, or the library refused — said once). */
function atlasSheetDoc(place,recipe){
  if(!recipe)return null;
  var doc;
  try{doc=TnDMaps.generate("wild",recipe.params);if(doc.stats)delete doc.stats.ms;/* the one thing a seed does not decide: two draws of one record are one document */return doc;}
  catch(e){atlasSheetProblem(place,"drawing "+place.name,e);return null;}
}
