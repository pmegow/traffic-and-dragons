// dev/sabotage-769-site-sheets.js — proves the guards of #769 (a site the party goes inside has its own sheet; the
// parent's pin opens it; the GM is told, and a crowded sheet is asked) and #770 (plain scenery is not a map feature).
//   node dev/sabotage-769-site-sheets.js
var sabotage = require("./sabotage.js");
var P = "FAIL #769 ", CMD = ["node", ["dev/tests-769-site-sheets.js"]];
var T1 = P + "what is scenery: a plain phrase whose head noun is a surface or loose matter, never a name",
  T2 = P + "scenery is kept out at the GM's door and the reader's, and the rest of the turn stands",
  T3 = P + "scenery already on file is not shown, not asked about, and not rewritten",
  T4 = P + "a site the party goes inside has a sheet of its own; its finds are filed there, not on the place around it",
  T5 = P + "the GM is told: going inside a site is a sub-location, and a crowded sheet is asked whether it hides one";
var knowledge = [
  { label: "a named place is taken for scenery", find: "if(!raw||/[A-Z]/.test(raw.slice(1)))return false;", replace: "if(!raw)return false;", mustFail: T1 },
  { label: "the first word decides, not the head noun", find: "return ATLAS_KNOWLEDGE_SCENERY.indexOf(words[words.length-1])>=0;", replace: "return ATLAS_KNOWLEDGE_SCENERY.indexOf(words[0])>=0;", mustFail: T1 },
  { label: "a floor is a place", find: 'var ATLAS_KNOWLEDGE_SCENERY=["floor","floors",', replace: 'var ATLAS_KNOWLEDGE_SCENERY=["floors",', mustFail: T1 },
  { label: "the GM's directive files scenery", find: 'if(x.directive.indexOf("[MAP_REVEAL:")!==0||!atlasKnowledgeScenery(x.event.label))return true;', replace: "if(true)return true;", mustFail: T2 },
  { label: "scenery on file is shown", find: "&&!atlasKnowledgeScenery(features[i].label))out.push(features[i]);return out;}", replace: ")out.push(features[i]);return out;}", mustFail: T3 },
  { label: "a crowded sheet is never asked", find: "    out+=atlasKnowledgeCrowdedLine(k,p.features);/* #769 */", replace: "", mustFail: T5 },
  { label: "the crowding line waits one feature too long", find: "return n>=ATLAS_KNOWLEDGE_CROWDED?", replace: "return n>ATLAS_KNOWLEDGE_CROWDED?", mustFail: T5 },
  { label: "the crowding count includes what the sheet does not show", find: "var n=atlasKnowledgeShown(container,features).length;", replace: "var n=features.length;", mustFail: T5 },
  { label: "the standing rule no longer asks for the sub-location", find: "declare it that turn with [SUBLOCATION:its name], using the name the map already knows it by when one is listed, BEFORE anything disclosed inside it.", replace: "say so.", mustFail: T5 }
];
var extract = [
  { label: "the landmark reader files scenery", find: "    if(atlasKnowledgeScenery(e.label)){", replace: "    if(false){", mustFail: T2 }
];
var pub = [
  { label: "the parent's pin opens nothing", find: "opens:atlasPublicChildSheet(A,place,f.label),", replace: "opens:null,", mustFail: T4 },
  { label: "a same-named site of another place is opened", find: "if(r.container.indexOf(pre)===0&&atlasKnowledgeFold(r.name)===want)return r.id;", replace: "if(atlasKnowledgeFold(r.name)===want)return r.id;", mustFail: T4 },
  { label: "the site must be spelled exactly as its pin", find: "if(r.container.indexOf(pre)===0&&atlasKnowledgeFold(r.name)===want)return r.id;", replace: "if(r.container.indexOf(pre)===0&&r.name===label)return r.id;", mustFail: T4 }
];
var failed = sabotage.prove({ file: "atlas-knowledge.js", command: CMD, only: P, cases: knowledge });
if (!failed) failed = sabotage.prove({ file: "atlas-knowledge-extract.js", command: CMD, only: P, cases: extract });
if (!failed) failed = sabotage.prove({ file: "atlas-public.js", command: CMD, only: P, cases: pub });
process.exit(failed ? 1 : 0);
