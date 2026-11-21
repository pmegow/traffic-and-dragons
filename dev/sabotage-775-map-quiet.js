// dev/sabotage-775-map-quiet.js — proves the #775 guards: a map disclosure adds no line to the story (the engine's or the
// reply's own), the Console says what the map gained, and the GM's standing rule says so.
//   node dev/sabotage-775-map-quiet.js
var sabotage = require("./sabotage.js");
var P = "FAIL #775 ", CMD = ["node", ["dev/tests-775-map-quiet.js"]];
var T1 = P + "a real turn: the owner's two lines leave the story, the stored turn and the GM's history; the map holds both",
  T2 = P + "a reply that wrote no such line is stored byte for byte, and the engine adds none",
  T3 = P + "the Console names what changed, once: new, heard of, a direction settled — never a repeat, scenery or the place itself",
  T5 = P + "the standing rule: nothing is added to the narration, no formulaic line, no reciting unless the player asks";
var cases = [
  { label: "the reply's own receipt lines stay in the stored turn", find: "result.text=atlasKnowledgeUnsaid(raw,items);", replace: "result.text=raw;", mustFail: T1 },
  { label: "the engine writes its receipt into the story again", find: "result.text=atlasKnowledgeUnsaid(raw,items);", replace: "result.text=out;", mustFail: T2 },
  { label: "what the map gained is not said", find: "    atlasKnowledgeNews(s0,s);", replace: "", mustFail: T1 },
  { label: "an unchanged repeat is said again", find: "      if(o&&o.label===f.label&&o.bearing===f.bearing&&o.mode===f.mode)continue;\n", replace: "", mustFail: T3 },
  { label: "the place's own name is announced as a marker", find: "if(atlasKnowledgeScenery(f.label)||atlasKnowledgeSelfLabel(f.container,f.label))continue;", replace: "if(atlasKnowledgeScenery(f.label))continue;", mustFail: T3 },
  { label: "scenery an older store holds is announced as a marker", find: "if(atlasKnowledgeScenery(f.label)||atlasKnowledgeSelfLabel(f.container,f.label))continue;", replace: "if(atlasKnowledgeSelfLabel(f.container,f.label))continue;", mustFail: T3 },
  { label: "a thing heard of is announced as seen", find: "(f.mode===\"reported\"?\" is said to lie to the \":\" lies to the \")", replace: "\" lies to the \"", mustFail: T3 },
  { label: "a thing with no position is given a direction's wording", find: "  if(d===\"position not established\")return f.label+(f.mode===\"reported\"?\" is spoken of\":\"\")+\" (position not established)\";\n", replace: "", mustFail: T3 },
  { label: "each feature is said on a line of its own", find: "    if(lines.length&&typeof showToast===\"function\")showToast(\"Map: \"+lines.join(\"; \")+\".\",5000);", replace: "    for(i=0;i<lines.length;i++)if(typeof showToast===\"function\")showToast(\"Map: \"+lines[i]+\".\",5000);", mustFail: T1 },
  { label: "the GM is not told that nothing is added to its narration", find: "The directive puts the feature on the player's map; nothing is added to your narration for it. ", replace: "", mustFail: T5 },
  { label: "the GM is not told to leave the map's details to the map", find: ", and do not recite a place's features or their directions unless the player asks or the scene calls for it", replace: "", mustFail: T5 },
  { label: "the GM is not told never to write the formulaic line", find: "never write a formulaic \\\"You see/hear of [label] to the [direction]\\\" line (older turns show some; do not imitate them)", replace: "narrate freely", mustFail: T5 },
  { label: "the reroll note asks for the discoveries to be preserved as before", find: "keep the prose true to them and do not restate them as lines of their own: ", replace: "keep the prose true to them: ", mustFail: T5 }
];
process.exit(sabotage.prove({ file: "atlas-knowledge.js", command: CMD, only: P, cases: cases }) ? 1 : 0);
