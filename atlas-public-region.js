/* atlas-public-region.js — THE REGION (#771 P3, owner 2026-11-15: "There should be a region map that shows the overall
   topology of the campaign. The locations the player has entered (city, town, mire, whatever) and sub locations from
   there"; rulings: the generator invents ground only; the region is generated at the start and hidden by fog; 2026-11-16
   by chip: a place is set on it ONLY WHEN VISITED, and a place reached with no stated direction is set BESIDE the last
   one and joined by a dotted way).

   THE PRINCIPLE (DOC/DESIGN_771_story_led_maps.md): the story decides what exists and where it leads; the generator
   decides only what the ground looks like. TnD Maps 0.28.0 draws the campaign's region from its seed — coast, relief,
   rivers, woods — and names NOTHING on it. What stands on it is the story's:
     places   every WORLD place the party has been in (the journey's places, first visit first), each set down ONCE, in
              the direction the party travelled from the place it came from, on ground that fits the place — its name's
              (Petrified Mire is marsh), else what the story answered (atlas-ground.js), a cave on rising ground. A place
              whose ground is still being asked WAITS a turn rather than be set on the wrong ground.
     spots    where a place was set is KEPT (worldState.atlas.spots[<world place>] = {at:[x,y], turn}) and never moved:
              a direction stated later, a ground answered later, a newer map library all leave it where it stands. The
              point is the only thing stored — never the drawing.
     ways     the travel the location graph recorded between two placed places. A way is drawn as a track only when the
              story stated its direction AND the two places lie along it; any other is dotted (order of travel only).
     fog      the ground within ATLAS_REGION_REVEAL of a placed place or along a travelled way is drawn; the rest is
              blank paper (worldState.atlas.fog === false shows the sheet whole, as for the old maps).
   The region replaces the journey sheet (#757) as the plaque's first tier wherever place sheets are drawn;
   worldState.atlas.drawn === false (the campaign's pin-sheet switch) keeps the journey sheet. Nothing here reads a
   private recipe, a description or a generated name; the GM is told nothing of this sheet. */
var ATLAS_REGION_TITLE="The region";
var ATLAS_REGION_SIZE=[1600,1100];/* the library's own region sheet */
var ATLAS_REGION_REVEAL=70;/* how far the party has seen from a place it stood in and from a way it travelled, in the sheet's own units (the sheet states no distance) */
var ATLAS_REGION_NAME_MAX=80;
/* The ground the LIBRARY looks for under a place, by what the place is drawn as on its own sheet: one row per drawing. */
var ATLAS_REGION_GROUNDS={wild:function(kind){return kind.terrain;},cave:function(){return "hills";},building:function(){return null;}};
var _atlasRegionBase=null,_atlasRegionMemo=null,_atlasRegionSaid=null;
function atlasRegionId(A){return A.seed+"/region";}
function atlasRegionIs(A,id){return !!A&&typeof id==="string"&&id===atlasRegionId(A);}
/* The region stands in for the journey sheet wherever place sheets are drawn. */
function atlasRegionOn(A){return !!A&&A.knowledge===1&&A.drawn!==false&&typeof TnDMaps!=="undefined"&&!!TnDMaps.region&&typeof TnDMaps.region.place==="function";}
function atlasRegionProblem(where,e){
  var key=where+"\n"+((e&&e.message)||e);
  if(_atlasRegionSaid===key)return;_atlasRegionSaid=key;
  atlasProblem(where,e);
}
function atlasRegionParams(A,story){return {seed:atlasRegionId(A),width:ATLAS_REGION_SIZE[0],height:ATLAS_REGION_SIZE[1],title:ATLAS_REGION_TITLE,story:story};}
function atlasRegionDraw(A,story){var doc=TnDMaps.generate("region",atlasRegionParams(A,story));if(doc.stats){delete doc.stats.terrain;delete doc.stats.settlementsRoads;delete doc.stats.geometry;delete doc.stats.total;delete doc.stats.terrainStages;}/* the one thing a seed does not decide */return doc;}
/* The bare ground of this campaign's region: what a new place is set down on. Drawn once per session. */
function atlasRegionBase(A){
  var id=atlasRegionId(A);
  if(!_atlasRegionBase||_atlasRegionBase.id!==id)_atlasRegionBase={id:id,doc:atlasRegionDraw(A,{places:[],links:[]})};
  return _atlasRegionBase.doc;
}
/* What ground a world place stands on, for the library: {ground: a word of TnDMaps.region.STORY_GROUNDS | null (any
   land), owed: true while the story is still being asked (the party stands in it, its name says nothing, nothing is on
   record)}. */
function atlasRegionGround(A,p){
  var place={id:p.zone,container:p.key,name:p.name},kind=atlasSheetNameKind(place),stored,row;
  if(!kind){
    stored=atlasGroundStored(A,p.key);
    if(!stored||atlasGroundStale(A,p.key)){if(atlasPublicPlaceKey(atlasPublicContext())===p.key)return {ground:null,owed:true};}
    else kind=atlasSheetKind({id:p.zone,container:p.key,name:p.name,ground:stored},[]);
  }
  row=kind?ownValue(ATLAS_REGION_GROUNDS,kind.draws):null;
  return {ground:row?row(kind):null,owed:false};
}
/* The kept spot of a world place, or null: read through the identity layer (a merged place keeps its spot). A record
   that cannot be read is said on the console and the place is set down afresh. */
function atlasRegionStored(A,key){
  var store=A&&A.spots,keys,i,r;
  if(!store||typeof store!=="object")return null;
  keys=Object.keys(store);
  for(i=0;i<keys.length;i++){
    if(atlasPublicPlaceKey(keys[i])!==key)continue;
    r=store[keys[i]];
    if(r&&typeof r==="object"&&Array.isArray(r.at)&&r.at.length===2&&typeof r.at[0]==="number"&&typeof r.at[1]==="number"&&isFinite(r.at[0])&&isFinite(r.at[1])&&r.at[0]>=0&&r.at[1]>=0&&r.at[0]<=ATLAS_REGION_SIZE[0]&&r.at[1]<=ATLAS_REGION_SIZE[1])return [r.at[0],r.at[1]];
    if(typeof console!=="undefined")console.warn("[region] the spot recorded for "+keys[i]+" cannot be read; the place is set down afresh");
  }
  return null;
}
/* PURE over the record: where every visited world place stands — {places, legs, spots: {key: [x, y]}, fresh: [{key,
   at}], waiting: [key]}. A kept spot stands. A place without one is set down now, in order of first visit, from the
   place it shares a travelled way with (along the way's stated bearing when there is one), else beside the place visited
   before it; one whose ground is owed waits. Nothing is written: atlasRegionSettle keeps what is fresh. */
function atlasRegionSpots(A){
  var places=atlasJourneyPlaces(A),legs=atlasJourneyLegs(places),spots=Object.create(null),fresh=[],waiting=[],taken=[],base=null,i,j,p,s,g,l,q,from,dir,hit,last=null;
  for(i=0;i<places.length;i++){
    p=places[i];s=atlasRegionStored(A,p.key);
    if(!s){
      g=atlasRegionGround(A,p);if(g.owed){waiting.push(p.key);continue;}
      from=null;dir=null;
      for(j=0;j<legs.length&&!dir;j++){l=legs[j];q=l.a===p.key?l.b:(l.b===p.key?l.a:null);if(!q||!spots[q])continue;
        if(l.bearing){from=q;dir=l.a===q?l.bearing:ATLAS_JOURNEY_OPPOSITE[l.bearing];}else if(!from)from=q;}
      if(!from)from=last;
      if(!base)base=atlasRegionBase(A);
      hit=TnDMaps.region.place(base,{ground:g.ground,from:from?spots[from]:null,bearing:from?dir:null,taken:taken});
      s=hit.at;fresh.push({key:p.key,at:[s[0],s[1]]});
    }
    spots[p.key]=s;taken.push(s);last=p.key;
  }
  return {places:places,legs:legs,spots:spots,fresh:fresh,waiting:waiting};
}
/* THE WRITER: keeps the spot of every place set down since the last turn. Called after a turn's commit, once the ground
   of the place the party stands in has been asked (game.js). Never throws; returns what it kept, or null. */
function atlasRegionSettle(){
  var A,r,i;
  try{
    if(typeof atlasKnowledgeActive!=="function"||!atlasKnowledgeActive())return null;
    A=worldState.atlas;if(!atlasRegionOn(A))return null;
    r=atlasRegionSpots(A);if(!r.fresh.length)return null;
    if(!A.spots||typeof A.spots!=="object")A.spots=keyedDict();
    for(i=0;i<r.fresh.length;i++)A.spots[r.fresh[i].key]={at:r.fresh[i].at,turn:atlasTurn()};
    if(typeof saveAll==="function")saveAll();
    if(typeof atlasDoorPaint==="function")atlasDoorPaint();/* an open pane shows the place set down */
    return r.fresh;
  }catch(e){
    atlasKnowledgeSay("the region map could not set this place down: "+((e&&e.message)||e)+". It is tried again next turn.");
    return null;
  }
}
/* A way's direction is SURE only when the story stated it and the two places lie in that eighth of each other. */
function atlasRegionSure(leg,spots){return !!leg.bearing&&TnDMaps.geom.bearing(spots[leg.a],spots[leg.b]).name===leg.bearing;}
/* What the sheet is drawn from: {places (placed, in order), spots, legs, story}. */
function atlasRegionRead(A){
  var r=atlasRegionSpots(A),zoneOf=Object.create(null),placed=[],links=[],i,p,l;
  for(i=0;i<r.places.length;i++){p=r.places[i];if(r.spots[p.key]){zoneOf[p.key]=p.zone;placed.push(p);}}
  for(i=0;i<r.legs.length;i++){l=r.legs[i];if(r.spots[l.a]&&r.spots[l.b])links.push({id:"way-"+(links.length+1),from:zoneOf[l.a],to:zoneOf[l.b],sure:atlasRegionSure(l,r.spots),a:l.a,b:l.b});}
  return {places:placed,spots:r.spots,legs:links,waiting:r.waiting,
    story:{places:placed.map(function(x){return {id:x.zone,name:atlasSheetCut(x.name,ATLAS_REGION_NAME_MAX),at:r.spots[x.key],ground:atlasRegionGround(A,x).ground};}),
      links:links.map(function(x){return {id:x.id,from:x.from,to:x.to,sure:x.sure};})}};
}
function atlasRegionDoc(A){
  var j=atlasRegionRead(A),sig=JSON.stringify([atlasRegionId(A),j.story]);
  if(_atlasRegionMemo&&_atlasRegionMemo.signature===sig)return _atlasRegionMemo.doc;
  _atlasRegionMemo={signature:sig,doc:atlasRegionDraw(A,j.story)};return _atlasRegionMemo.doc;
}
function atlasRegionDocIs(doc){return !!doc&&!!doc.generator&&doc.generator.name==="region"&&!!doc.story;}
/* The party stands at the world place it is in — exact: a placed place is a known spot. A place still waiting for its
   ground has no spot yet, and the sheet shows no party. */
function atlasRegionParty(A){
  var j=atlasRegionRead(A),here=atlasJourneyWorld(atlasPublicContext()),s=j.spots[here];
  if(!s)return null;
  return {x:s[0],y:s[1],exact:true,last:false,key:null,label:""};/* the dagger alone: the place it stands on bears its own name, and a second slip covered it */
}
/* Where a freshly opened region is centred: the party, else the place set down last, else the sheet's middle. */
function atlasRegionStand(A){
  var j,p=atlasRegionParty(A),s;
  if(p)return [p.x,p.y];
  j=atlasRegionRead(A);s=j.places.length?j.spots[j.places[j.places.length-1].key]:null;
  return s?[s[0],s[1]]:[ATLAS_REGION_SIZE[0]/2,ATLAS_REGION_SIZE[1]/2];
}
/* THE FOG: the ground the party has seen — around every placed place and along every travelled way. null = the sheet
   whole (the campaign's fog switch). No place yet: all fog. */
function atlasRegionReveal(A){
  var j,doc;
  if(A.fog===false)return null;
  j=atlasRegionRead(A);doc=atlasRegionDoc(A);
  return {points:j.places.map(function(p){return [j.spots[p.key][0],j.spots[p.key][1]];}),paths:(doc.ways||[]).map(function(w){return w.pts;}),radius:ATLAS_REGION_REVEAL};
}
function atlasRegionRevealNone(A){return A.fog===false?null:{points:[],paths:[],radius:ATLAS_REGION_REVEAL};}
/* A tap on a place: its name, when it was first visited, what a dotted way means — and its own sheet to open. */
function atlasRegionCard(A,target){
  var j=atlasRegionRead(A),i,p,k,unsure=false;
  if(!target||target.id==null)return null;
  for(i=0;i<j.places.length;i++)if(j.places[i].zone===target.id){
    p=j.places[i];for(k=0;k<j.legs.length;k++)if(!j.legs[k].sure&&(j.legs[k].a===p.key||j.legs[k].b===p.key))unsure=true;
    return {id:null,x:j.spots[p.key][0],y:j.spots[p.key][1],title:p.name,word:"First visited on turn "+p.turn+"."+(unsure?" A dotted way shows the order of travel only: its direction is not established.":""),
      opens:p.zone,unvisited:false,partyHere:p.key===atlasJourneyWorld(atlasPublicContext()),place:null,added:null,note:null};
  }
  return null;
}
