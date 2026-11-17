// dev/sabotage-757-journey.js — proves the #757 guards that outlived the journey sheet (#771 P4): the folding of rooms
// into their world place, the travelled ways, the one public source of a direction, and that no sheet stands above the
// places where the region does not. Each clause runs its own test of dev/tests-757-journey.js through --only.
//   node dev/sabotage-757-journey.js
var sabotage = require("./sabotage.js");
var P = "FAIL #757 ", CMD = ["node", ["dev/tests-757-journey.js"]];
var T1 = P + "the places: world places, first visit first, each once; a room folds into its world place, which opens its own sheet once the party stood in it",
  T2 = P + "the ways: the party's own travel between two visited places, once each pair, in the order travelled; an untravelled pair and an unvisited place have none",
  T3 = P + "a stated direction is read from either end; nothing else states one",
  T4 = P + "the journey sheet is gone: the region is the sheet above the places, and where place sheets are not drawn there is none";
var journey = [
  { label: "a room is a place of its own on the journey", find: 'var k=String(key==null?"":key),i=k.indexOf("|"),w=i<0?k:k.slice(0,i);', replace: 'var k=String(key==null?"":key),i=-1,w=k;', mustFail: T1 },
  { label: "a place keeps the room's sheet after the party stood in the place itself", find: "if(!p.own&&r.container===w){p.zone=r.id;p.own=true;}", replace: "", mustFail: T1 },
  { label: "a way to a place the party never visited is travelled", find: "if(!a||!b||a===b||!keys[a]||!keys[b])continue;", replace: "if(!a||!b||a===b)continue;", mustFail: T2 },
  { label: "a room's doorway is a way of the journey", find: "if(!a||!b||a===b||!keys[a]||!keys[b])continue;", replace: "if(!a||!b||!keys[a]||!keys[b])continue;", mustFail: T2 },
  { label: "the way back is a second way", find: "if(seen[k])continue;seen[k]=true;", replace: "", mustFail: T2 },
  { label: "a feature without a bearing states a direction", find: 'if(f[i].bearing!=="unknown"&&atlasKnowledgeSelfLabel(to,f[i].label))return f[i].bearing;', replace: "if(atlasKnowledgeSelfLabel(to,f[i].label))return f[i].bearing===\"unknown\"?\"N\":f[i].bearing;", mustFail: T3 },
  { label: "the far end's statement is not turned round", find: "return d?ATLAS_JOURNEY_OPPOSITE[d]:null;}", replace: "return d||null;}", mustFail: T3 },
  { label: "the far end's statement is not read at all", find: "d=named(a,b);if(d)return d;d=named(b,a);", replace: "d=named(a,b);if(d)return d;d=null;", mustFail: T3 }
];
var dispatch = [
  { label: "a sheet of the old journey's id stands above the pin sheets", find: "return atlasRegionOn(A)?{id:atlasRegionId(A),title:ATLAS_REGION_TITLE}:null;}", replace: 'return atlasRegionOn(A)?{id:atlasRegionId(A),title:ATLAS_REGION_TITLE}:{id:A.seed+"/journey",title:"The journey so far"};}', mustFail: T4 },
  { label: "the plaque reads a sheet that is not there", find: "out=over?[{key:over.id,text:over.title,current:over.id===shownZone}]:[],place=", replace: "out=[{key:over.id,text:over.title,current:over.id===shownZone}],place=", mustFail: T4 }
];
var pane = [
  { label: "the full pane's list reads a sheet that is not there", find: "var _ov=atlasPublicOverview(A),_jo;if(_ov){_jo=new Option(_ov.title,_ov.id);", replace: "var _ov=atlasPublicOverview(A),_jo;if(true){_jo=new Option(_ov.title,_ov.id);", mustFail: T4 }
];
var failed = sabotage.prove({ file: "atlas-public-journey.js", command: CMD, only: P, cases: journey });
if (!failed) failed = sabotage.prove({ file: "atlas-public.js", command: CMD, only: P, cases: dispatch });
if (!failed) failed = sabotage.prove({ file: "ui-atlas.js", command: CMD, only: P, cases: pane });
process.exit(failed ? 1 : 0);
