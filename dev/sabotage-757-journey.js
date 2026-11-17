// dev/sabotage-757-journey.js — proves the #757 guards (the journey sheet): the layout and what makes a way sure, the
// frame, the one public source of a direction, the folding of rooms, the dispatch, the plaque's trail and the card. Each
// clause runs its own test of dev/tests-757-journey.js through --only.
//   node dev/sabotage-757-journey.js
var sabotage = require("./sabotage.js");
var P = "FAIL #757 ", CMD = ["node", ["dev/tests-757-journey.js"]];
var T1 = P + "the layout: a known direction is laid along it and sure; an unknown one is laid beside and unsure",
  T2 = P + "the points stay inside the frame at any size, and one place sits in the middle",
  T3 = P + "the owner's case: two places, one way of unknown direction, drawn dotted, the party at the second",
  T4 = P + "a stated direction places the way and draws it solid, from either end; nothing else does",
  T5 = P + "rooms fold into their world place, a return adds nothing, and an untravelled pair has no way",
  T6 = P + "the sheet is reached from the plaque and the list, a tap opens the place, and it is never a place itself",
  T7 = P + "a read writes nothing, and the sheet holds nothing private";
var journey = [
  { label: "a way of unknown direction is drawn as sure", find: "out.push({a:l.a,b:l.b,sure:placed});", replace: "out.push({a:l.a,b:l.b,sure:true});", mustFail: T1 },
  { label: "a way off its bearing is drawn as sure", find: "placed=m>0&&dx===d[0]*m&&dy===d[1]*m;", replace: "placed=true;", mustFail: T1 },
  { label: "a way written from the far end is not turned round", find: "dir=l.a===q?l.bearing:ATLAS_JOURNEY_OPPOSITE[l.bearing];", replace: "dir=l.bearing;", mustFail: T1 },
  { label: "an earlier unknown way beats a known bearing", find: "for(j=0;j<legs.length&&!dir;j++){l=legs[j];", replace: "for(j=0;j<legs.length&&!from;j++){l=legs[j];", mustFail: T1 },
  { label: "an occupied place is laid over", find: "for(n=1;n<=64&&!c;n++)if(!at(cells[from][0]+d[0]*n,cells[from][1]+d[1]*n))", replace: "for(n=1;n<=64&&!c;n++)if(true)", mustFail: T1 },
  { label: "the unknown order starts up the sheet", find: 'var ATLAS_JOURNEY_UNSURE_ORDER=["S","SE","SW","E","W","N","NE","NW"];', replace: 'var ATLAS_JOURNEY_UNSURE_ORDER=["N","SE","SW","E","W","S","NE","NW"];', mustFail: T1 },
  { label: "the points are not fitted to the frame", find: "s=Math.min(F.step,(x1>x0)?F.width/(x1-x0):F.step,(y1>y0)?F.height/(y1-y0):F.step);", replace: "s=F.step;", mustFail: T2 },
  { label: "the middle of the sheet names no eighth", find: 'if(!dx&&!dy)return "N";', replace: 'if(!dx&&!dy)return "unknown";', mustFail: T2 },
  { label: "the party is not shown on the journey", find: "return p?{x:p[0],y:p[1],exact:true,last:false,key:null}:null;", replace: "return null;", mustFail: T3 },
  { label: "a feature without a bearing states a direction", find: 'if(f[i].bearing!=="unknown"&&atlasKnowledgeSelfLabel(to,f[i].label))return f[i].bearing;', replace: "if(atlasKnowledgeSelfLabel(to,f[i].label))return f[i].bearing===\"unknown\"?\"N\":f[i].bearing;", mustFail: T4 },
  { label: "the far end's statement is not turned round", find: "return d?ATLAS_JOURNEY_OPPOSITE[d]:null;}", replace: "return d||null;}", mustFail: T4 },
  { label: "the far end's statement is not read at all", find: "d=named(a,b);if(d)return d;d=named(b,a);", replace: "d=named(a,b);if(d)return d;d=null;", mustFail: T4 },
  { label: "a room is a place of its own on the journey", find: 'var k=String(key==null?"":key),i=k.indexOf("|"),w=i<0?k:k.slice(0,i);', replace: 'var k=String(key==null?"":key),i=-1,w=k;', mustFail: T5 },
  { label: "a place keeps the room's sheet after the party stood in the place itself", find: "if(!p.own&&r.container===w){p.zone=r.id;p.own=true;}", replace: "", mustFail: T5 },
  { label: "a journey pin keeps a note handle", find: "return {id:null,x:j.points[p.key][0],", replace: "return {id:p.zone,x:j.points[p.key][0],", mustFail: T6 },
  { label: "the card does not open the place's sheet", find: "      opens:p.zone,unvisited:false,", replace: "      opens:null,unvisited:false,", mustFail: T6 },
  { label: "the card does not say a dotted way is order only", find: '(unsure?" A dotted way shows the order of travel only: its direction is not established.":"")', replace: '""', mustFail: T6 }
];
var dispatch = [
  { label: "the journey id draws no sheet", find: "if(atlasJourneyIs(A,zoneId))return atlasJourneyDoc(A);/* #757: the journey sheet */", replace: "", mustFail: T3 },
  { label: "the journey's card is asked of a place", find: "if(atlasJourneyIs(A,zoneId))return atlasJourneyCard(A,target);/* #757 */", replace: "", mustFail: T6 },
  { label: "the journey's party is asked of a place", find: "if(atlasJourneyIs(A,zoneId))return atlasJourneyParty(A);/* #757 */", replace: "", mustFail: T3 },
  { label: "the journey has no title", find: "if(atlasJourneyIs(A,zoneId))return ATLAS_JOURNEY_TITLE;/* #757 */", replace: "", mustFail: T6 },
  { label: "the plaque's trail does not lead to the journey", find: "var over=atlasPublicOverview(A),out=[{key:over.id,text:over.title,current:over.id===shownZone}],place=", replace: "var out=[],place=", mustFail: T6 }/* #771 P2: the trail is atlasPublicTrail (atlas-public.js) */
];
var atlas = [
  { label: "the journey is not a known sheet: the plaque's tier opens nothing", find: "||atlasJourneyIs(A,id)||atlasPublicPlace(A,id))", replace: "||atlasPublicPlace(A,id))", mustFail: T6 }
];
var pane = [
  { label: "the full pane's list does not offer the journey", find: "_jo=new Option(_ov.title,_ov.id);", replace: "_jo=new Option(\"\",\"\");", mustFail: T6 }
];
var failed = sabotage.prove({ file: "atlas-public-journey.js", command: CMD, only: P, cases: journey });
if (!failed) failed = sabotage.prove({ file: "atlas-public.js", command: CMD, only: P, cases: dispatch });
if (!failed) failed = sabotage.prove({ file: "atlas.js", command: CMD, only: P, cases: atlas });
if (!failed) failed = sabotage.prove({ file: "ui-atlas.js", command: CMD, only: P, cases: pane });
process.exit(failed ? 1 : 0);
