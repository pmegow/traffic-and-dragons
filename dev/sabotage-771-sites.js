// dev/sabotage-771-sites.js — proves the #771 P2 guards: a name or the story's answer says a site, a cave is drawn as the
// library's nameless rock with the story's names, its mouth leads back out, a site named on the sheet the party stands in
// is filed inside that place, a leave steps out one, and the plaque is the hierarchy. Each clause runs its own test.
//   node dev/sabotage-771-sites.js
var sabotage = require("./sabotage.js");
var P = "FAIL #771 sites ", CMD = ["node", ["dev/tests-771-sites.js"]];
var T1 = P + "a name says a site as it says a ground: a lair, a den, caverns are a cave; a mire is open ground; a keep is neither",
  T2 = P + "the lair on the ridge is drawn as a cave: nameless rock, the mouth back to the ridge, no scale and no level",
  T3 = P + "the mouth stands toward the place it leads back to; a direction nobody stated lays it to the south",
  T4 = P + "the story names the chambers: each thing toward its bearing from the middle chamber, a report in its own face, what has no direction listed",
  T5 = P + "a feature that names the place the mouth leads to IS the mouth: one thing, under the feature's own id",
  T6 = P + "the party is drawn in the middle chamber, and every card answers: a thing, the way out, the pin that opens the site",
  T7 = P + "a cave nobody travelled into keeps its pin sheet; the first way in is its mouth, a later way is listed and moves no rock",
  T8 = P + "the story may answer \"cave\": the place is drawn as one, said so only when it is drawn, and an old \"other\" is asked once more",
  T9 = P + "a site named on the sheet the party stands in is filed INSIDE that place; leaving steps out one; a known place is found as before",
  T10 = P + "off the public map a leave is the world place, as always",
  T11 = P + "the GM is told: a leave steps out one place, and a site inside a sub-location is written as a path",
  T12 = P + "a drawn sheet is a place on its ground or a site in its rock; a pin sheet and a legacy dungeon are neither";
var sheet = [
  { label: "a lair is no site", find: '"den","lair","burrow"', replace: '"den","burrow"', mustFail: T1 },
  { label: "a name that says a site is not read", find: "  if(site)return {draws:site.draws};\n", replace: "", mustFail: T1 },
  { label: "a site the story answered is handed to the ground generator", find: 'return word.draws?{draws:word.draws}:{draws:"wild",terrain:place.ground};', replace: 'return {draws:"wild",terrain:place.ground};', mustFail: T8 },
  { label: "a cave with no way on record is given a mouth the story never told", find: "  if(!first)return null;", replace: '  if(!first)first={id:"way-1",name:"nowhere",bearing:null,lean:"S",key:"",to:null};', mustFail: T7 },
  { label: "the mouth ignores where the way back leads", find: 'b=first.bearing||first.lean||"S";', replace: 'b="S";', mustFail: T3 },
  { label: "the rock runs toward its own mouth", find: "heading:ATLAS_JOURNEY_OPPOSITE[b],", replace: "heading:b,", mustFail: T3 },
  { label: "a later way is dropped, not listed", find: "for(i=1;i<ways.length&&listed.length<ATLAS_SHEET_LIST_CAP;i++)listed.push(", replace: "for(i=1;i<0;i++)listed.push(", mustFail: T7 },
  { label: "a thing with no direction is dropped from a cave", find: 'if(f.bearing==="unknown"||story.length>=ATLAS_SHEET_STORY_CAP){if(listed.length<ATLAS_SHEET_LIST_CAP)listed.push(', replace: 'if(f.bearing==="unknown"||story.length>=ATLAS_SHEET_STORY_CAP){if(false)listed.push(', mustFail: T4 },
  { label: "\"cave\" in a cave is named as a thing", find: '    if(atlasSheetIsSite("cave",f.label))continue;/* "cave" in a cave: the rock is drawn, not named */\n', replace: "", mustFail: T4 },
  { label: "the place the mouth leads to is also a chamber", find: "    f=sorted[i];if(isWay[f.id])continue;\n    if(atlasSheetIsSite(", replace: "    f=sorted[i];\n    if(atlasSheetIsSite(", mustFail: T5 },
  { label: "a site does not say what it lies within", find: 'where:parent===null?null:"within "+atlasSheetLeaf(parent),', replace: "where:null,", mustFail: T2 },
  { label: "the mouth is not named for the place it leads to", find: 'name:atlasSheetCut("to "+first.name,ATLAS_SHEET_WAY_MAX),', replace: "name:null,", mustFail: T2 },
  { label: "a cave's document carries its timings", find: 'timings:["spine","rooms","total"]', replace: "timings:[]", mustFail: T2 },
  { label: "a legacy dungeon counts as a drawn story sheet", find: '(doc.generator.name==="dungeon"&&!!doc.story)', replace: '(doc.generator.name==="dungeon")', mustFail: T12 },
  { label: "the party is drawn at the empty frame's middle in a cave", find: "(doc.story&&doc.story.at?doc.story.at:ATLAS_SHEET_CENTRE)", replace: "ATLAS_SHEET_CENTRE", mustFail: T6 },
  { label: "an \"other\" from before the vocabulary knew a cave is never asked again", find: "return !!r&&r.ground===ATLAS_GROUND_OTHER&&!(r.set>=ATLAS_GROUND_SET);", replace: "return false;", mustFail: T8 }
];
var ground = [
  { label: "a new answer carries no edition", find: 'by:"story",set:ATLAS_GROUND_SET};', replace: 'by:"story"};', mustFail: T8 },
  { label: "a cave that is not drawn is announced as drawn", find: 'said=atlasGroundDraws(worldState.atlas,o.container)?atlasGroundSaid(o.place,filed.ground):"";', replace: "said=atlasGroundSaid(o.place,filed.ground);", mustFail: T8 },
  { label: "a cave is said as a ground", find: "(w.as||ground)", replace: "ground", mustFail: T8 },
  { label: "a site answered may be replaced", find: "if(atlasGroundStored(A,container)&&!atlasGroundStale(A,container))return refuse(", replace: "if(false)return refuse(", mustFail: T8 }
];
var pub = [
  { label: "a place around the party, named from inside, becomes a new place", find: '  for(i=base.length-1;i>=0;i--)if(atlasKnowledgeFold(base[i])===want)return {key:atlasLocKey(String(parent)+"|"+atlasPathJoin(base.slice(0,i+1)))};', replace: "", mustFail: T9 },
  { label: "a place already known inside is not found by its bare name", find: '  key=atlasLocKey(String(parent)+"|"+atlasPathJoin(base.concat(parts)));if(memory.map.nodes[key])return {key:key};\n  if(base.length>1)', replace: "  if(base.length>1)", mustFail: T9 },
  { label: "a pin on this sheet shadows a place known at the world place's level", find: '  if(memory.map.nodes[atlasLocKey(String(parent)+"|"+parts[0])])return null;\n', replace: "", mustFail: T9 },
  { label: "a site pinned on the sheet the party stands in is filed beside that place", find: "for(i=0;i<shown.length;i++)if(atlasKnowledgeFold(shown[i].label)===want)return {key:", replace: "for(i=0;i<0;i++)if(atlasKnowledgeFold(shown[i].label)===want)return {key:", mustFail: T9 },
  { label: "a leave drops to the world place from any depth", find: "return parts.length>1?atlasPathJoin(parts.slice(0,-1)):null;}", replace: "return null;}", mustFail: T9 },
  { label: "the plaque shows the place alone, not the places around it", find: "for(key=place.container;key!==null;key=atlasSheetParent(key))chain.unshift(key);", replace: "chain=[place.container];", mustFail: T6 },
  { label: "a tier of the plaque is named by its whole path", find: "(atlasSheetLeaf(rows[j].container)||rows[j].name),current:", replace: "rows[j].name,current:", mustFail: T6 },
  { label: "the party's marker in a site bears the whole path", find: "label:atlasSheetDrawn(atlasPublicDoc(zoneId))?(atlasSheetLeaf(place.container)||place.name):place.name}", replace: "label:place.name}", mustFail: T6 },
  { label: "a cave's way out has no card", find: "  sheet=atlasSheetDrawn(doc)?atlasSheetOf(A,place,p.features):null;", replace: '  sheet=doc.generator&&doc.generator.name==="wild"?atlasSheetOf(A,place,p.features):null;', mustFail: T6 }
];
var atlas = [
  { label: "a leave never asks the public map where it lands", find: 'function atlasPlaceLeave(sub){return (typeof atlasKnowledgeActive==="function"&&atlasKnowledgeActive()&&sub!=null)?atlasPublicLeave(sub):null;}', replace: "function atlasPlaceLeave(sub){return null;}", mustFail: T9 },
  { label: "a leave steps out one in every campaign", find: 'function atlasPlaceLeave(sub){return (typeof atlasKnowledgeActive==="function"&&atlasKnowledgeActive()&&sub!=null)?atlasPublicLeave(sub):null;}', replace: "function atlasPlaceLeave(sub){return sub!=null?atlasPublicLeave(sub):null;}", mustFail: T10 },
  { label: "a cave's things are not the story's", find: "(d.rooms||[]).concat(d.features||[],", replace: "(d.rooms||[]).concat([],", mustFail: T4 },
  { label: "what found no chamber is no thing of the sheet", find: "(d.unplaced||[]).map(function(u){return {id:u.id,name:u.name,x:d.story.at[0]", replace: "([]).map(function(u){return {id:u.id,name:u.name,x:d.story.at[0]", mustFail: T4 }
];
var identity = [
  { label: "the place timeline never asks where a leave lands", find: 'sub=(sub!=null&&typeof atlasPlaceLeave==="function")?atlasPlaceLeave(sub):null;', replace: "sub=null;", mustFail: T9 }
];
var rules = [
  { label: "the GM is not told a leave steps out one place", find: ": it steps out ONE place, to the place the site lies in.", replace: ".", mustFail: T11 },
  { label: "the GM is not told how to write a site inside a sub-location", find: " A site inside a sub-location the party already stands in is written as a path,", replace: " A site may be written", mustFail: T11 }
];
var pane = [
  { label: "the pane frames only open ground as a drawn sheet", find: "function atlasPaneDrawn(doc){return atlasSheetDrawn(doc);}", replace: 'function atlasPaneDrawn(doc){return !!doc&&!!doc.generator&&doc.generator.name==="wild";}', mustFail: T12 },
  { label: "a drawn sheet the party is not on opens at the whole-sheet fit", find: "  if(!how&&fresh&&atlasKnowledgeActive()&&atlasPaneDrawn(doc))how={};", replace: "", mustFail: T12 },
  { label: "a repaint of the shown sheet throws the player's view away", find: "fresh=P.zone!==zoneId;", replace: "fresh=true;", mustFail: T12 },
  { label: "a sheet the party is not on opens at the empty frame's middle", find: "how.party?how.party.x:atlasSheetStand(d)[0]", replace: "how.party?how.party.x:d.frame.width/2", mustFail: T12 }
];
var failed = sabotage.prove({ file: "atlas-public-sheet.js", command: CMD, only: P, cases: sheet });
if (!failed) failed = sabotage.prove({ file: "atlas-ground.js", command: CMD, only: P, cases: ground });
if (!failed) failed = sabotage.prove({ file: "atlas-public.js", command: CMD, only: P, cases: pub });
if (!failed) failed = sabotage.prove({ file: "atlas.js", command: CMD, only: P, cases: atlas });
if (!failed) failed = sabotage.prove({ file: "identity.js", command: CMD, only: P, cases: identity });
if (!failed) failed = sabotage.prove({ file: "atlas-knowledge.js", command: CMD, only: P, cases: rules });
if (!failed) failed = sabotage.prove({ file: "ui-atlas.js", command: CMD, only: P, cases: pane });
process.exit(failed ? 1 : 0);
