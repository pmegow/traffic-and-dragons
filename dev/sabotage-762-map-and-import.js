// dev/sabotage-762-map-and-import.js — proves the guards of #762 (the wizard's import skips the Play-as chooser), #763 (a
// disclosure stated twice prints one receipt), #764 (the public marker bears the place's name) and #765 (the ground is
// read from the head noun). Each clause runs its own test through --only.
//   node dev/sabotage-762-map-and-import.js
var sabotage = require("./sabotage.js");
var P = "FAIL #762 ", CMD = ["node", ["dev/tests-762-map-and-import.js"]];
var T1 = P + "a disclosure the reply states twice prints its receipt once, at the first statement",
  T2 = P + "two different disclosures, and one disclosure from two places, each keep their own receipt",
  T3 = P + "the public sheet's party marker bears the place's name",
  T4 = P + "the ground is read from the head noun; a named feature elsewhere lends none",
  T5 = P + "in the wizard an import skips the Play-as chooser; the sheet is admitted first either way";
var knowledge = [
  { label: "every statement prints its receipt again", find: '+(said[sk]?"":"\\n\\n"+e.quote+"\\n\\n");said[sk]=1;', replace: '+"\\n\\n"+e.quote+"\\n\\n";', mustFail: T1 },
  { label: "the receipt is remembered across places: a second place's view is unsaid", find: "sk=JSON.stringify([item.container,e.quote]);", replace: "sk=JSON.stringify([e.quote]);", mustFail: T2 },
  { label: "one receipt silences every other disclosure of its place", find: "sk=JSON.stringify([item.container,e.quote]);", replace: "sk=JSON.stringify([item.container]);", mustFail: T2 }
];
var pub = [
  { label: "the public position names nothing", find: "exact:false,last:false,key:null,label:atlasSheetDrawn(atlasPublicDoc(zoneId))?(atlasSheetLeaf(place.container)||place.name):place.name}", replace: "exact:false,last:false,key:null}", mustFail: T3 }
];
var atlas = [
  { label: "the marker ignores the position's own name", find: 'label:p.label?p.label:(p.last?"Last mapped place"', replace: 'label:(p.last?"Last mapped place"', mustFail: T3 }
];
var land = [
  { label: "a mire is not marsh", find: '"fen","fens","mire","mires","morass","quagmire"', replace: '"fen","fens","morass","quagmire"', mustFail: T4 },
  { label: "any word of the phrase may be the ground: a tavern named for a ridge is hills", find: "head=words[words.length-1],i;", replace: "head=words[0],i;", mustFail: T4 },
  { label: "a named feature elsewhere paints this sheet", find: "if(!feature||!atlasPublicLandscapeNamed(label))ground(row.terrain);return;", replace: "ground(row.terrain);return;", mustFail: T4 },
  { label: "a plain phrase lends no ground either", find: "if(!feature||!atlasPublicLandscapeNamed(label))ground(row.terrain);return;", replace: "if(!feature)ground(row.terrain);return;", mustFail: T4 },
  { label: "a route with no direction is drawn", find: 'if(feature&&bearing==="unknown")return;', replace: "", mustFail: T4 },
  { label: "a track is drawn as a road", find: '{nouns:["path","trail","track","lane"],route:"path"}', replace: '{nouns:["path","trail","lane"],route:"path"},{nouns:["track"],route:"road"}', mustFail: T4 },
  { label: "a capital that opens a phrase makes it a name", find: '.replace(/^./,function(c){return c.toLowerCase();})', replace: "", mustFail: T4 }
];
var browsers = [
  { label: "the wizard asks Play-as again", find: "  if(charImportDirect()){onAccept();return;}", replace: "", mustFail: T5 },
  { label: "a running game skips the chooser too", find: 'return !!(scr&&scr.style&&scr.style.display!=="none");}', replace: "return !!scr;}", mustFail: T5 },
  { label: "the direct road runs before the sheet is admitted", find: "function showCharImportPreview(char, onAccept, onCancel){", replace: "function showCharImportPreview(char, onAccept, onCancel){if(charImportDirect()){onAccept();return;}", mustFail: T5 }
];
var failed = sabotage.prove({ file: "atlas-knowledge.js", command: CMD, only: P, cases: knowledge });
if (!failed) failed = sabotage.prove({ file: "atlas-public.js", command: CMD, only: P, cases: pub });
if (!failed) failed = sabotage.prove({ file: "atlas.js", command: CMD, only: P, cases: atlas });
if (!failed) failed = sabotage.prove({ file: "atlas-public-landscape.js", command: CMD, only: P, cases: land });
if (!failed) failed = sabotage.prove({ file: "ui-browsers.js", command: CMD, only: P, cases: browsers });
process.exit(failed ? 1 : 0);
