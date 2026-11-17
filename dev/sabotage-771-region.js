// dev/sabotage-771-region.js — proves the #771 P3 region guards: the sheet above the places, the ground alone, a place
// set once in the direction travelled on fitting ground, the waiting place, the kept spot, the fog, the party and the
// cards, the loud failure, and the wiring. Each clause runs its own test through --only.
//   node dev/sabotage-771-region.js
var sabotage = require("./sabotage.js");
var P = "FAIL #771 region ", CMD = ["node", ["dev/tests-771-region.js"]];
var T1 = P + "the region is the sheet above the places wherever place sheets are drawn; the journey sheet where they are not",
  T2 = P + "the region names nothing of its own: the first place stands on the ground its name says, and it is the only name",
  T3 = P + "a place is set in the direction the party travelled and its way is a track; with no direction it is set beside and its way is dotted",
  T4 = P + "a place whose ground is still being asked waits; answered, it is set on that ground; left unasked, it is set on any land",
  T5 = P + "what a place is drawn as says the ground it stands on: open country its terrain, a cave rising ground, a building any land",
  T6 = P + "the writer keeps each spot once, and a kept spot never moves: not for a direction stated later, not for a newer answer",
  T8 = P + "the fog: the ground around the placed places and along the travelled ways; off, the sheet is whole; a place sheet has none",
  T9 = P + "the party stands at the world place it is in, from a place inside it too; a tap on a place opens its sheet",
  T10 = P + "a failure to set a place down is said, writes nothing, and is tried again",
  T12 = P + "the game sets a new place down after the ground ask at both doors; the file is loaded, cached and in the engine; the pane frames and fogs the region";
var region = [
  { label: "the region stands in where place sheets are not drawn", find: "return !!A&&A.knowledge===1&&A.drawn!==false&&typeof TnDMaps", replace: "return !!A&&A.knowledge===1&&typeof TnDMaps", mustFail: T1 },
  { label: "the region has no title", find: "title:ATLAS_REGION_TITLE,story:story};}", replace: "title:null,story:story};}", mustFail: T2 },
  { label: "a timing rides the document", find: "delete doc.stats.total;", replace: "", mustFail: T2 },
  { label: "the place's ground is not handed to the drawing", find: "at:r.spots[x.key],ground:atlasRegionGround(A,x).ground};})", replace: "at:r.spots[x.key],ground:null};})", mustFail: T2 },
  { label: "a stated direction is ignored", find: "if(l.bearing){from=q;dir=l.a===q?l.bearing:ATLAS_JOURNEY_OPPOSITE[l.bearing];}else if(!from)from=q;}", replace: "if(!from)from=q;}", mustFail: T3 },
  { label: "every way is drawn as a track", find: "return !!leg.bearing&&TnDMaps.geom.bearing(spots[leg.a],spots[leg.b]).name===leg.bearing;", replace: "return true;", mustFail: T3 },
  { label: "a stated way is a track wherever the places lie", find: "return !!leg.bearing&&TnDMaps.geom.bearing(spots[leg.a],spots[leg.b]).name===leg.bearing;", replace: "return !!leg.bearing;", mustFail: T6 },
  { label: "a place whose ground is owed is set down at once", find: "g=atlasRegionGround(A,p);if(g.owed){waiting.push(p.key);continue;}", replace: "g=atlasRegionGround(A,p);", mustFail: T4 },
  { label: "a place the party left is waited for for ever", find: "if(atlasPublicPlaceKey(atlasPublicContext())===p.key)return {ground:null,owed:true};", replace: "return {ground:null,owed:true};", mustFail: T4 },
  { label: "an other of an older edition is taken as the answer", find: "if(!stored||atlasGroundStale(A,p.key)){", replace: "if(!stored){", mustFail: T4 },
  { label: "a cave is set on any land", find: 'cave:function(){return "hills";}', replace: "cave:function(){return null;}", mustFail: T5 },
  { label: "a name's ground is not read", find: "kind=atlasSheetNameKind(place),stored,row;", replace: "kind=null,stored,row;", mustFail: T5 },
  { label: "the writer keeps nothing", find: "A.spots[r.fresh[i].key]={at:r.fresh[i].at,turn:atlasTurn()};", replace: "", mustFail: T6 },
  { label: "the store is a plain object", find: "A.spots=keyedDict();", replace: "A.spots={};", mustFail: T6 },
  { label: "a kept spot is not saved", find: 'if(typeof saveAll==="function")saveAll();', replace: "", mustFail: T6 },
  { label: "a kept spot is ignored: the place is set down again", find: "p=places[i];s=atlasRegionStored(A,p.key);", replace: "p=places[i];s=null;", mustFail: T6 },
  { label: "a spot off the sheet is trusted", find: "&&r.at[0]<=ATLAS_REGION_SIZE[0]&&r.at[1]<=ATLAS_REGION_SIZE[1])return [r.at[0],r.at[1]];", replace: ")return [r.at[0],r.at[1]];", mustFail: T6 },
  { label: "the fog switch is ignored", find: "  if(A.fog===false)return null;\n  j=atlasRegionRead(A);doc=atlasRegionDoc(A);", replace: "  j=atlasRegionRead(A);doc=atlasRegionDoc(A);", mustFail: T8 },
  { label: "the travelled ways stay under the fog", find: "paths:(doc.ways||[]).map(function(w){return w.pts;}),", replace: "paths:[],", mustFail: T8 },
  { label: "the fog's radius is not the table's", find: "return w.pts;}),radius:ATLAS_REGION_REVEAL};", replace: "return w.pts;}),radius:7};", mustFail: T8 },
  { label: "a pane that could not hand over the fog shows the sheet whole", find: "function atlasRegionRevealNone(A){return A.fog===false?null:{points:[],paths:[],radius:ATLAS_REGION_REVEAL};}", replace: "function atlasRegionRevealNone(A){return null;}", mustFail: T8 },
  { label: "the party inside a place of a world place has no spot", find: "here=atlasJourneyWorld(atlasPublicContext()),s=j.spots[here];", replace: "here=atlasPublicContext(),s=j.spots[here];", mustFail: T9 },
  { label: "the party's marker covers the place's name with words of its own", find: 'exact:true,last:false,key:null,label:""};', replace: "exact:true,last:false,key:null,label:null};", mustFail: T9 },
  { label: "a place's card opens nothing", find: "      opens:p.zone,unvisited:false,", replace: "      opens:null,unvisited:false,", mustFail: T9 },
  { label: "the card does not say a dotted way is order only", find: '(unsure?" A dotted way shows the order of travel only: its direction is not established.":"")', replace: '""', mustFail: T9 },
  { label: "a failure is silent", find: 'atlasKnowledgeSay("the region map could not set this place down: "+((e&&e.message)||e)+". It is tried again next turn.");', replace: "", mustFail: T10 },
  { label: "a pin-sheet campaign is given spots", find: "A=worldState.atlas;if(!atlasRegionOn(A))return null;", replace: "A=worldState.atlas;", mustFail: T10 }
];
var dispatch = [
  { label: "the overview is always the journey sheet", find: "return atlasRegionOn(A)?{id:atlasRegionId(A),title:ATLAS_REGION_TITLE}:", replace: "return false?{id:atlasRegionId(A),title:ATLAS_REGION_TITLE}:", mustFail: T1 },
  { label: "the region is a sheet where place sheets are not drawn", find: "function atlasPublicRegionIs(A,zoneId){return atlasRegionOn(A)&&atlasRegionIs(A,zoneId);}", replace: "function atlasPublicRegionIs(A,zoneId){return atlasRegionIs(A,zoneId);}", mustFail: T1 },
  { label: "the region's id draws no sheet", find: "if(atlasPublicRegionIs(A,zoneId))return atlasRegionDoc(A);/* #771 P3: the region */", replace: "", mustFail: T1 },
  { label: "the region has no title of its own", find: "if(atlasPublicRegionIs(A,zoneId))return ATLAS_REGION_TITLE;/* #771 P3 */", replace: "", mustFail: T1 },
  { label: "the region's party is asked of a place", find: "if(atlasPublicRegionIs(A,zoneId))return atlasRegionParty(A);/* #771 P3 */", replace: "", mustFail: T9 },
  { label: "the region's card is asked of a place", find: "if(atlasPublicRegionIs(A,zoneId))return atlasRegionCard(A,target);/* #771 P3 */", replace: "", mustFail: T9 },
  { label: "the region is never fogged", find: "return atlasPublicRegionIs(A,zoneId)?atlasRegionReveal(A):null;}", replace: "return null;}", mustFail: T8 },
  { label: "the region fails open", find: "return atlasPublicRegionIs(A,zoneId)?atlasRegionRevealNone(A):null;}", replace: "return null;}", mustFail: T8 }
];
var atlas = [
  { label: "the region is not a known sheet: the plaque's tier opens nothing", find: "(atlasPublicRegionIs(A,id)/* #771 P3: the region */||", replace: "(", mustFail: T1 },
  { label: "a public sheet's fog is never asked", find: "{return atlasPublicReveal(zoneId);}", replace: "{return null;}", mustFail: T8 },
  { label: "a public sheet's closed fog is never asked", find: "{return atlasPublicRevealNone(zoneId);}", replace: "{return null;}", mustFail: T8 }
];
var store = [{ label: "the spots are not a registered keyed store", find: '"atlas.grounds","atlas.spots",', replace: '"atlas.grounds",', mustFail: T6 }];
var game = [
  { label: "a story turn never sets a place down", find: 'atlasRegionSettle();/* #771 P3: a place visited for the first time', replace: "/* #771 P3: a place visited for the first time", mustFail: T12 },
  { label: "the opening never sets a place down", find: "atlasRegionSettle();/* #771 P3: the opening place is the region's first */", replace: "", mustFail: T12 }
];
var page = [{ label: "the game does not load the file", find: '<script src="atlas-public-region.js"></script>', replace: "", mustFail: T12 }];
var shell = [{ label: "the offline shell lacks the file", find: '  "/atlas-public-region.js",', replace: "", mustFail: T12 }];
var pane = [
  { label: "a region newly shown opens at the whole-sheet fit", find: "(atlasPaneDrawn(doc)||atlasRegionDocIs(doc))", replace: "(atlasPaneDrawn(doc))", mustFail: T12 },
  { label: "the region is not centred on the party", find: "d=atlasRegionStand(atlasLive());P.view.center(d[0],d[1],", replace: "d=[0,0];P.view.center(d[0],d[1],", mustFail: T12 }
];
var failed = sabotage.prove({ file: "atlas-public-region.js", command: CMD, only: P, cases: region });
if (!failed) failed = sabotage.prove({ file: "atlas-public.js", command: CMD, only: P, cases: dispatch });
if (!failed) failed = sabotage.prove({ file: "atlas.js", command: CMD, only: P, cases: atlas });
if (!failed) failed = sabotage.prove({ file: "helpers.js", command: CMD, only: P, cases: store });
if (!failed) failed = sabotage.prove({ file: "game.js", command: CMD, only: P, cases: game });
if (!failed) failed = sabotage.prove({ file: "index.html", command: CMD, only: P, cases: page });
if (!failed) failed = sabotage.prove({ file: "sw.js", command: CMD, only: P, cases: shell });
if (!failed) failed = sabotage.prove({ file: "ui-atlas.js", command: CMD, only: P, cases: pane });
process.exit(failed ? 1 : 0);
