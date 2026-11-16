/* atlas-public-sheet.js — THE PLACE SHEET (#771 P1, owner 2026-11-15: "What I want is an illustration of the area I'm in…
   the player's current location mapped with topological details (swamp reeds, patches, etc), including exits from the
   current location. The next location should have an exit back to the previous one").

   THE PRINCIPLE (DOC/DESIGN_771_story_led_maps.md): the story decides what exists and where it leads; the generator
   decides only what the ground looks like. This file turns ONE place's PUBLIC record into the recipe TnD Maps (0.24.0
   open ground, 0.25.0 a cave) draws as a story sheet — read at every draw, never stored, nothing private read:
     ground    the place's own name says it (Petrified Mire is marsh, Shattered Ridge is mountain) — the phrase's head
               noun, one row of nouns per ground of the library; else the STORY says it — asked once per place over the
               turn's public narration (atlas-ground.js, owner 2026-11-15: 8 of his campaign's 10 places had no ground
               word in their name) and kept in atlas.grounds; while nothing was answered a plain observed feature may
               say it (deep timber); else NOTHING is drawn and the place keeps its pin sheet. The engine never guesses.
     exits     a world place: every way the party travelled to or from it (memory.map.edges), toward the place it leads
               to. A place inside another: the way back out to the place around it. The direction is the story's — a
               public feature of one end bearing the other's name with a stated bearing (the journey sheet's rule) —
               and a way whose direction nobody stated is laid at the first free edge and drawn DOTTED.
     features  every shown public feature with a bearing, set down toward it on fitting ground; one the story only
               reported is a ring. A feature that IS the place an exit leads to is the exit, not a second pin.
     listed    what has no direction, and a visited place inside this one that no feature names: listed, never drawn.
     sites     #771 P2 (owner: "the hierarchy should be Petrified Mire: Shattered Ridge: Wyrm lair"): a place that is not
               open country is drawn as what it IS — ATLAS_SHEET_SITES, one row per kind (a cave today; a building is
               the next entry). A cave is the library's rock with nameless chambers: the way the party came in is its
               mouth, named for the place it leads back to; each feature with a bearing names the free chamber toward
               it; the rest is listed. A cave nobody travelled into (no way on record) keeps its pin sheet.
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
/* #771 P2: what a place that is NOT open country is drawn as, by its name's head noun. One row per site kind: the drawing
   (ATLAS_SHEET_DRAWS) and the nouns that say it. A noun here is never a noun of a ground above. */
var ATLAS_SHEET_SITES=[
  {draws:"cave",nouns:["cave","caves","cavern","caverns","grotto","grottoes","den","lair","burrow","warren","tunnel","tunnels","mine","mines"]}
];
var ATLAS_SHEET_BEARINGS=["N","NE","E","SE","S","SW","W","NW"];
/* A plain one-word label that is a noun of the sheet's OWN site kind names the site, not a thing in it. */
function atlasSheetIsSite(draws,label){
  var p=String(label||"").toLowerCase().replace(/^(?:the|a|an) /,"").replace(/[^a-z' ]+/g," ").replace(/\s+/g," ").trim(),i;
  if(!p||p.indexOf(" ")>=0||atlasPublicLandscapeNamed(label))return false;
  for(i=0;i<ATLAS_SHEET_SITES.length;i++)if(ATLAS_SHEET_SITES[i].draws===draws)return ATLAS_SHEET_SITES[i].nouns.indexOf(p)>=0;
  return false;
}
var ATLAS_SHEET_CAVE_SIZE="town",ATLAS_SHEET_CAVE_REACH=290,ATLAS_SHEET_STORY_CAP=64;/* how much rock a site gets (the library's extent word: some 17 chambers), how far from the sheet's middle its mouth stands, how many things a site names */
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
/* What the story may answer when a place's name does not say its ground (atlas-ground.js asks, once per place): one of
   the library's six terrains, or "other" — not open country (a building, underground, a town's streets, water), which
   keeps its pin sheet. ONE table: the ask's words and the reader's vocabulary both derive from it. */
var ATLAS_GROUND_OTHER="other";
/* The edition of the vocabulary below. An "other" answered under an OLDER edition is asked once more (a cave was "other"
   until edition 2); a terrain or a site, once answered, is never asked or replaced. A new site kind is a new edition. */
var ATLAS_GROUND_SET=2;
var ATLAS_GROUND_WORDS=[
  {ground:"forest",says:"woodland: trees, a grove, a clearing among trees, jungle"},
  {ground:"marsh",says:"wet ground: swamp, bog, fen, reeds, flooded land"},
  {ground:"desert",says:"dry waste: sand, dunes, badlands, barren flats"},
  {ground:"mountain",says:"high rock: peaks, cliffs, a ridge, a gorge, a pass"},
  {ground:"hills",says:"rolling high ground: hills, downs, bluffs"},
  {ground:"heath",says:"open low ground: grass, meadow, moor, plain, farmland"},
  {ground:"cave",draws:"cave",as:"a cave",says:"underground in natural rock: a cave, a den, a lair, a burrow, tunnels, a mine"},
  {ground:ATLAS_GROUND_OTHER,says:"none of these: inside a building, a built cellar or vault, the streets of a settlement, on water"}
];
function atlasGroundWord(g){var i;for(i=0;i<ATLAS_GROUND_WORDS.length;i++)if(ATLAS_GROUND_WORDS[i].ground===g)return ATLAS_GROUND_WORDS[i];return null;}
/* The ground the story answered for a place, or null (never asked, or a record that cannot be read — said on the console
   and asked again). Read through the identity layer, so a merged place keeps its answer. */
function atlasGroundStored(A,container){var r=atlasGroundRecord(A,container);return r?r.ground:null;}
/* An "other" answered before the vocabulary knew the sites of this edition: owed one more ask (it draws nothing meanwhile). */
function atlasGroundStale(A,container){var r=atlasGroundRecord(A,container);return !!r&&r.ground===ATLAS_GROUND_OTHER&&!(r.set>=ATLAS_GROUND_SET);}
function atlasGroundRecord(A,container){
  var store=A&&A.grounds,keys,i,r,want;
  if(!store||typeof store!=="object")return null;
  keys=Object.keys(store);want=atlasPublicPlaceKey(container);
  for(i=0;i<keys.length;i++){
    if(atlasPublicPlaceKey(keys[i])!==want)continue;
    r=store[keys[i]];
    if(r&&typeof r==="object"&&typeof r.ground==="string"&&atlasGroundWord(r.ground))return r;
    if(typeof console!=="undefined")console.warn("[sheet] the ground recorded for "+keys[i]+" cannot be read; it will be asked again");
  }
  return null;
}
/* What a place's NAME says it is drawn as, or null: {draws:"wild", terrain} for open ground, {draws:<site>} for a site. */
function atlasSheetNameKind(place){
  var name=place.container?atlasSheetLeaf(place.container):place.name,site=atlasSheetRow(ATLAS_SHEET_SITES,name),terrain;
  if(site)return {draws:site.draws};
  terrain=atlasSheetNameGround(place);return terrain?{draws:"wild",terrain:terrain}:null;
}
/* The ground a place's NAME says, or null: its head noun; a place that is a WAY wears the ground it runs through. */
function atlasSheetNameGround(place){
  var name=place.container?atlasSheetLeaf(place.container):place.name,row=atlasSheetRow(ATLAS_SHEET_GROUNDS,name),i,w;
  if(row)return row.terrain;
  if(ATLAS_SHEET_WAY_NOUNS.indexOf(atlasSheetNoun(name))>=0){/* the Forest Road is forest */
    w=String(name).toLowerCase().replace(/[^a-z' ]+/g," ").split(" ");
    for(i=0;i<w.length-1;i++){row=atlasSheetRow(ATLAS_SHEET_GROUNDS,w[i]);if(row)return row.terrain;}
  }
  return null;
}
/* The ground a place is drawn on, or null (no drawing): its own name; else what the story answered (place.ground —
   "other" is an answer: no drawing, and no feature overrides it); else, while nothing was answered, the first plain
   observed feature that says one. */
function atlasSheetGround(place,features){var k=atlasSheetKind(place,features);return k&&k.draws==="wild"?k.terrain:null;}
/* What a place is drawn as, or null (its pin sheet stays): {draws:"wild", terrain} | {draws:<a site of ATLAS_SHEET_DRAWS>}. */
function atlasSheetKind(place,features){
  var named=atlasSheetNameKind(place),word,row,i,f;
  if(named)return named;
  if(place.ground){
    word=atlasGroundWord(place.ground);
    if(!word||place.ground===ATLAS_GROUND_OTHER)return null;
    return word.draws?{draws:word.draws}:{draws:"wild",terrain:place.ground};
  }
  for(i=0;i<features.length;i++){f=features[i];if(f.mode!=="observed"||atlasPublicLandscapeNamed(f.label))continue;row=atlasSheetRow(ATLAS_SHEET_GROUNDS,f.label);if(row)return {draws:"wild",terrain:row.terrain};}
  return null;
}
/* A container's steps: the world place, then each step of the path beneath it. "Petrified Mire|Shattered Ridge — Wyrm
   Lair" is the lair in the ridge in the mire: its parent is "Petrified Mire|Shattered Ridge", never the mire. */
function atlasSheetSteps(container){var k=String(container==null?"":container),i=k.indexOf("|");return i<0?[k]:[k.slice(0,i)].concat(atlasPathParts(k.slice(i+1)));}
function atlasSheetParent(container){var s=atlasSheetSteps(container);return s.length<2?null:(s.length<3?s[0]:s[0]+"|"+atlasPathJoin(s.slice(1,-1)));}
function atlasSheetLeaf(container){var s=atlasSheetSteps(container);return s[s.length-1];}
/* The ways out of a place: [{id, key, name, bearing|null, to}] in a stable order — key is the container it leads to, to
   the visited sheet a tap opens (null when the party never stood there itself). */
function atlasSheetWays(A,place){
  var rows=atlasPublicPlacesList(A),k=place.container,out=[],places,legs,i,l,other,p,parent=atlasSheetParent(k),b,leaf;
  function sheetOf(key){var j;for(j=0;j<rows.length;j++)if(rows[j].container===key)return rows[j].id;return null;}
  if(parent!==null){
    b=null;leaf=atlasKnowledgeFold(atlasSheetLeaf(k));
    try{p=atlasKnowledgeProjection(parent).features;for(i=0;i<p.length&&!b;i++)if(p[i].bearing!=="unknown"&&leaf&&atlasKnowledgeFold(p[i].label)===leaf)b=ATLAS_JOURNEY_OPPOSITE[p[i].bearing];}
    catch(e){if(typeof console!=="undefined")console.warn("[sheet] the way back out could not be read: "+((e&&e.message)||e));}
    out.push({key:parent,name:atlasSheetLeaf(parent),bearing:b,lean:"S",to:sheetOf(parent)});
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
  var rows=atlasPublicPlacesList(A),out=[],i,j,r,named,leaf;
  for(i=0;i<rows.length;i++){
    r=rows[i];if(atlasSheetParent(r.container)!==place.container)continue;/* its own children only: what lies two steps down is its child's */
    leaf=atlasSheetLeaf(r.container);named=false;for(j=0;j<features.length&&!named;j++)if(atlasKnowledgeFold(features[j].label)===atlasKnowledgeFold(leaf))named=true;
    if(!named)out.push({id:"in-"+(out.length+1),name:leaf,to:r.id});
  }
  return out;
}
/* PURE over what it is handed: the place, its shown features, its ways and the places inside it → the recipe, or null
   when no ground is known. {terrain, params, ways, inside} — params is what TnDMaps.generate("wild", …) takes. */
function atlasSheetRecipe(place,features,ways,inside){
  var kind=atlasSheetKind(place,features),terrain=kind&&kind.draws==="wild"?kind.terrain:null,used=Object.create(null),exits=[],edits=[],listed=[],isWay=Object.create(null),byName=Object.create(null),sorted,i,f,w,row,j,e,k,draw,params;
  if(!kind)return null;
  draw=Object.prototype.hasOwnProperty.call(ATLAS_SHEET_DRAWS,kind.draws)?ATLAS_SHEET_DRAWS[kind.draws]:null;
  if(!draw)throw new Error("no drawing is defined for a "+kind.draws);
  sorted=features.slice().sort(function(a,b){var ta=a.source&&a.source.turn||0,tb=b.source&&b.source.turn||0;return (ta-tb)||(a.id<b.id?-1:a.id>b.id?1:0);});
  for(i=0;i<sorted.length;i++){k=atlasKnowledgeFold(sorted[i].label);if(k&&!byName[k])byName[k]=sorted[i];}
  /* a feature that names the place a way leads to IS that way: one thing on the sheet, under the feature's own id — so its card, and a note the player wrote on it, stay with it */
  ways=ways.map(function(x){var named=byName[atlasKnowledgeFold(x.name)];if(named)isWay[named.id]=true;return {id:named?named.id:x.id,key:x.key,name:x.name,bearing:x.bearing,lean:x.lean,to:x.to,feature:named?named.id:null};});
  if(draw.site){/* #771 P2: a site (a cave) — its own params from the same sorted record */
    params=draw.params(place,sorted,ways,inside,isWay);
    return params?{draws:kind.draws,generator:draw.generator,terrain:null,ways:ways,inside:inside,params:params}:null;
  }
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
  return {draws:"wild",generator:draw.generator,terrain:terrain,ways:ways,inside:inside,params:{seed:place.id+"/sheet",width:ATLAS_SHEET_SIZE,height:ATLAS_SHEET_SIZE,terrain:terrain,title:atlasSheetLeaf(place.container)||place.name,site:{exits:exits,unplaced:listed},edits:edits}};
}
/* A CAVE's params (TnDMaps.generate("dungeon", …), the library's story sheet for a natural site), or null when no way into
   it is on record (a cave has a mouth; the engine does not invent where). The FIRST way — how the party first came in — is
   the mouth the rock grows from, at the edge toward the place it leads back to (unstated: the south edge, the way a place
   inside another lays its way back); a later way would redraw the rock, so it is listed, never a second mouth. */
function atlasSheetCaveParams(place,sorted,ways,inside,isWay){
  var first=ways[0],b,a,story=[],listed=[],i,f,parent=atlasSheetParent(place.container);
  if(!first)return null;
  b=first.bearing||first.lean||"S";a=ATLAS_SHEET_BEARINGS.indexOf(b)*Math.PI/4;
  for(i=1;i<ways.length&&listed.length<ATLAS_SHEET_LIST_CAP;i++)listed.push({id:ways[i].id,name:atlasSheetCut("The way to "+ways[i].name,ATLAS_SHEET_LIST_NAME_MAX),mode:"observed"});
  for(i=0;i<sorted.length;i++){
    f=sorted[i];if(isWay[f.id])continue;
    if(atlasSheetIsSite("cave",f.label))continue;/* "cave" in a cave: the rock is drawn, not named */
    if(f.bearing==="unknown"||story.length>=ATLAS_SHEET_STORY_CAP){if(listed.length<ATLAS_SHEET_LIST_CAP)listed.push({id:f.id,name:atlasSheetCut(f.label,ATLAS_SHEET_LIST_NAME_MAX),mode:f.mode});continue;}
    story.push({id:f.id,name:atlasSheetCut(f.label,ATLAS_SHEET_NAME_MAX),bearing:f.bearing,mode:f.mode});
  }
  for(i=0;i<inside.length&&listed.length<ATLAS_SHEET_LIST_CAP;i++)listed.push({id:inside[i].id,name:atlasSheetCut(inside[i].name,ATLAS_SHEET_LIST_NAME_MAX),mode:"observed"});
  return {seed:place.id+"/sheet",width:ATLAS_SHEET_SIZE,height:ATLAS_SHEET_SIZE,title:atlasSheetLeaf(place.container)||place.name,site:{kind:"cave",heading:ATLAS_JOURNEY_OPPOSITE[b],where:parent===null?null:"within "+atlasSheetLeaf(parent),town:{name:null,size:ATLAS_SHEET_CAVE_SIZE},
    portals:[{id:first.id,kind:"cave",name:atlasSheetCut("to "+first.name,ATLAS_SHEET_WAY_MAX),x:Math.round(ATLAS_SHEET_CENTRE[0]+Math.sin(a)*ATLAS_SHEET_CAVE_REACH),y:Math.round(ATLAS_SHEET_CENTRE[1]-Math.cos(a)*ATLAS_SHEET_CAVE_REACH)}],story:story,unplaced:listed}};
}
/* ONE row per drawing: the library generator and, for a site, its params. A new site kind is an entry here, a row of
   ATLAS_SHEET_SITES and a word of ATLAS_GROUND_WORDS. */
var ATLAS_SHEET_DRAWS={
  wild:{generator:"wild",site:false,timings:["ms"]},
  cave:{generator:"dungeon",site:true,params:atlasSheetCaveParams,timings:["spine","rooms","total"]}
};
/* Is this document a DRAWN sheet (a place on its own ground, a site in its own rock), not a pin sheet? */
function atlasSheetDrawn(doc){return !!doc&&!!doc.generator&&(doc.generator.name==="wild"||(doc.generator.name==="dungeon"&&!!doc.story));}
/* Where the party is drawn on a sheet it stands in: a site's middle chamber, a drawn ground's middle, a pin sheet's. */
var ATLAS_SHEET_PIN_CENTRE=[400,275];
function atlasSheetStand(doc){return !atlasSheetDrawn(doc)?ATLAS_SHEET_PIN_CENTRE:(doc.story&&doc.story.at?doc.story.at:ATLAS_SHEET_CENTRE);}
/* The recipe of a visited sheet from the live record, or null. A failure to read it is said once and the pin sheet stands. */
function atlasSheetOf(A,place,features){
  try{return atlasSheetRecipe(Object.assign({},place,{ground:atlasGroundStored(A,place.container)}),features,atlasSheetWays(A,place),atlasSheetInside(A,place,features));}
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
  try{doc=TnDMaps.generate(recipe.generator,recipe.params);if(doc.stats)ATLAS_SHEET_DRAWS[recipe.draws].timings.forEach(function(k){delete doc.stats[k];});/* the one thing a seed does not decide: two draws of one record are one document */return doc;}
  catch(e){atlasSheetProblem(place,"drawing "+place.name,e);return null;}
}
