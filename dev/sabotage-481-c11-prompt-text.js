// dev/sabotage-481-c11-prompt-text.js — proves the #481 C11 guards are guarded. Part 1 (stable text and notes): the village
// substitutes the crisis rule in its slot, the kind's tag-doc note ends its own line, and the presence/separation notes
// answer with [NO_CHANGE]. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-c11-prompt-text.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 C11"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("data.js", [
  { label: "the village serves the adventure's crisis rule again",
    find: "    ruleOverrides:{\"ACTIVE CRISES ARE QUESTS TOO\":\"GOALS THE PLAYER TAKES ON ARE QUESTS", replace: "    ruleOverrides:{\"ACTIVE CRISES ARE QUESTS TOO (unmatched)\":\"GOALS THE PLAYER TAKES ON ARE QUESTS",
    mustFail: "the village's stable half" }
]);
prove("tag_table.js", [
  { label: "the kind's tag-doc note glues onto the next section again",
    find: "return out.join(\"\")+(_tdn&&!/\\n$/.test(_tdn)?_tdn+\"\\n\":_tdn);", replace: "return out.join(\"\")+_tdn;",
    mustFail: "the village's stable half" }
]);
prove("api.js", [
  { label: "the presence check says 'emit nothing' again",
    find: "If everyone listed is genuinely present, emit [NO_CHANGE].]\";", replace: "If everyone listed is genuinely present, emit nothing.]\";",
    mustFail: "answer with [NO_CHANGE]" },
  { label: "the separation note's [NO_CHANGE] is no registered ack",
    find: "ack:[\"PARTY_SPLIT\",\"NO_CHANGE\"]},/* #481 C11 */\n  buildPlayerSplitNudge", replace: "ack:[\"PARTY_SPLIT\"]},/* #481 C11 */\n  buildPlayerSplitNudge",
    mustFail: "answer with [NO_CHANGE]" }
]);
/* Part 2 (volatile text and the start stamp) */
prove("helpers.js", [
  { label: "a snippet is cut mid-word again (no sentence end is sought)",
    find: "  if(end>20)return s.slice(0,end);", replace: "  if(false)return s.slice(0,end);",
    mustFail: "'First met' is a sentence" },
  { label: "a paragraph break is no sentence end (the old '. '-only rule)",
    find: "var re=/[.!?][\"'\\u201d\\u2019)\\]]*(?=\\s)/g,", replace: "var re=/[.!?][\"'\\u201d\\u2019)\\]]*(?= )/g,",
    mustFail: "'First met' is a sentence" }
]);
prove("tag_table.js", [
  { label: "the filed first encounter bypasses the sentence cutter",
    find: "feSnip=(typeof snippetAtSentence===\"function\")?snippetAtSentence(ft,280):ft.slice(0,280);", replace: "feSnip=ft.slice(0,280);",
    mustFail: "'First met' is a sentence" }
]);
prove("memory.js", [
  { label: "an imported resident gets a first meeting again",
    find: "if(n.firstEncounter&&!(_feW&&(_feW.resident||typeof _feW.libraryAt===\"number\")))", replace: "if(n.firstEncounter)",
    mustFail: "'First met' is a sentence" },
  { label: "the shown first meeting is the stored text, cut or not",
    find: "lines.push(\"  First met: \"+((typeof snippetAtSentence===\"function\")?snippetAtSentence(n.firstEncounter):n.firstEncounter));", replace: "lines.push(\"  First met: \"+n.firstEncounter);",
    mustFail: "'First met' is a sentence" }
]);
prove("game.js", [
  { label: "a pre-minted start node stays unvisited",
    find: "  if(!(n.visits>0))n.visits=1;if(n.firstVisit==null)n.firstVisit=0;", replace: "",
    mustFail: "the start place is visited from turn 0" },
  { label: "startGame seeds the start node itself again (only when missing)",
    find: "  startNodeStamp();/* #481 C11: visited from turn 0 even when a village or blueprint minted the node first */", replace: "  if(memory.map&&worldState.world&&worldState.world.location&&!memory.map.nodes[worldState.world.location])memory.map.nodes[worldState.world.location]=newMapNode(0,null,{visits:1});",
    mustFail: "the start place is visited from turn 0" }
]);
prove("api.js", [
  { label: "the location line repeats the place as its region",
    find: "+((w.region&&String(w.region).trim().toLowerCase()!==String(w.location).trim().toLowerCase())?\", \"+w.region:\"\")+", replace: "+\", \"+w.region+",
    mustFail: "the location line names a region only when it differs" }
]);
process.exit(code);
