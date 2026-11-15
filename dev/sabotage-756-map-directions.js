// dev/sabotage-756-map-directions.js — proves the #756 guards: a place is never a feature of itself (the extractor's skip,
// the player's sheet and card), and the GM is asked for each direction the public map owes (by handle, capped, never for
// the place itself or a placed feature). Each clause runs its own test of dev/tests-756-map-directions.js through --only.
//   node dev/sabotage-756-map-directions.js
var sabotage = require("./sabotage.js");
var P = "FAIL #756 ", CMD = ["node", ["dev/tests-756-map-directions.js"]];
var T1 = P + "the place's own name is recognised, whatever its article, case or punctuation; anything else is not",
  T2 = P + "the extractor skips the place itself and files the rest of its batch",
  T3 = P + "the player's sheet does not show a place as a feature of itself, and the record is left as it was",
  T4 = P + "the GM is asked for each direction the map owes, by handle, and never for the place itself or a placed feature",
  T5 = P + "the ask is capped, and says how many more";
var knowledge = [
  { label: "a leading \"the\" makes the place a stranger to itself", find: '.replace(/^\\s*the\\s+/,"")', replace: "", mustFail: T1 },
  { label: "a part of the name is taken for the place", find: "return !!a&&a===atlasKnowledgeFold(label);", replace: "return !!a&&a.indexOf(atlasKnowledgeFold(label))>=0;", mustFail: T1 },
  { label: "a sub-location is judged by its whole key", find: '(typeof locDisplayLeaf==="function")?locDisplayLeaf(container):String(container==null?"":container).split("|").pop()', replace: 'String(container==null?"":container)', mustFail: T1 },
  { label: "the sheet shows the place as its own feature", find: "if(!atlasKnowledgeSelfLabel(container,features[i].label)&&!atlasKnowledgeScenery(features[i].label))out.push(features[i]);"/* #770: the line gained the scenery test; same mutation */, replace: "out.push(features[i]);", mustFail: T3 },
  { label: "a placed feature is asked for a direction", find: 'if(shown[i].bearing==="unknown")out.push(shown[i]);', replace: "out.push(shown[i]);", mustFail: T4 },
  { label: "the ask names no handle", find: 'parts.push("[MAP_REVEAL:"+owed[i].id+"|"', replace: 'parts.push("[MAP_REVEAL:new|"', mustFail: T4 },
  { label: "a report is asked for as an observation", find: '"|<bearing>|"+owed[i].mode+"]"', replace: '"|<bearing>|observed]"', mustFail: T4 },
  { label: "the ask is not capped", find: "for(i=0;i<owed.length&&i<ATLAS_KNOWLEDGE_OWED_CAP;i++)parts.push(", replace: "for(i=0;i<owed.length;i++)parts.push(", mustFail: T5 },
  { label: "the ask no longer makes the GM the author", find: "You are the author of this world: a feature the party can SEE lies somewhere, so decide", replace: "Decide", mustFail: T4 },/* #766 */
  { label: "the GM's brief never carries the ask", find: "    out+=atlasKnowledgeOwedLine(k,p.features);", replace: "", mustFail: T4 },
  { label: "the standing rule does not let a handle settle a direction", find: ", or to settle a direction listed under DIRECTION OWED", replace: "", mustFail: T4 },
  { label: "the standing rule does not exclude the place itself", find: "Exclude the place the party stands in and any phrase that only describes it, NPCs,", replace: "Exclude NPCs,", mustFail: T4 }
];
var extract = [
  { label: "the extractor files the place as a feature of itself", find: "if(atlasKnowledgeSelfLabel(seg.container,e.label)){", replace: "if(false){", mustFail: T2 }
];
var sheet = [
  { label: "the sheet's features are not filtered", find: "p={features:atlasKnowledgeShown(k,p.features)};/* #756: a place is not a feature of itself */", replace: "", mustFail: T3 },
  { label: "the place itself keeps a card", find: "p={features:atlasKnowledgeShown(place.container,p.features)};/* #756 */", replace: "", mustFail: T3 }
];
var discovery = [
  { label: "the extractor's prompt does not exclude the place itself", find: "Exclude the place the passage itself is set in and any phrase that only describes it, characters,", replace: "Exclude characters,", mustFail: T4 }
];
var failed = sabotage.prove({ file: "atlas-knowledge.js", command: CMD, only: P, cases: knowledge });
if (!failed) failed = sabotage.prove({ file: "atlas-knowledge-extract.js", command: CMD, only: P, cases: extract });
if (!failed) failed = sabotage.prove({ file: "atlas-public.js", command: CMD, only: P, cases: sheet });
if (!failed) failed = sabotage.prove({ file: "atlas-discovery.js", command: CMD, only: P, cases: discovery });
process.exit(failed ? 1 : 0);
