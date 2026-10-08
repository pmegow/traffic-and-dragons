// dev/sabotage-483-prompt-duplicates.js — proves the #483 guards: the NPC GRAPH carries no PLAYER row (the sheet block's Bond
// line is the one renderer of the hero's bonds) while NPC rows and a bond-less player edge still serve; in the Village the
// "Known sub-locations" line lists only what COMMONS and HOUSES do not already name. Each mutation runs in a disposable
// clone (sabotage.js); the working tree is never mutated.
//   node dev/sabotage-483-prompt-duplicates.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "#483 one renderer"]], cases: cases }); }
prove("memory.js", [
  { label: "the PLAYER row is back (the hero's bonds twice a turn)",
    find: "  var nodes=Object.keys(adj).filter(function(n){return n!==player;});\n  if(!nodes.length)return\"\";\n  var lines=[\"NPC GRAPH:\"];",
    replace: "  var nodes=Object.keys(adj).filter(function(n){return n!==player;});\n  if(!nodes.length)return\"\";\n  var lines=[\"NPC GRAPH:\"];if(adj[player])lines.push(player+\" [PLAYER]: \"+adj[player].map(function(e){return e.other+\"(\"+e.rel+\")\";}).join(\", \"));",
    mustFail: "#483 the NPC GRAPH has no PLAYER row" },
  { label: "the NPC rows are dropped with the player's",
    find: "  for(var ni=0;ni<nodes.length;ni++){\n    var name=nodes[ni];\n    var npc=memory.npcs[name]||{};", replace: "  for(var ni=0;ni<0;ni++){\n    var name=nodes[ni];\n    var npc=memory.npcs[name]||{};",
    mustFail: "#483 the NPC GRAPH has no PLAYER row" }
]);
prove("api.js", [
  { label: "the Village's sub-location list repeats COMMONS and HOUSES again",
    find: "var _leaf=locDisplayLeaf(nKeys[i]);if(!_named[String(_leaf).toLowerCase()])subLocs.push(_leaf);}}", replace: "var _leaf=locDisplayLeaf(nKeys[i]);subLocs.push(_leaf);}}",
    mustFail: "#483 in the Village" },
  { label: "the residue is dropped too (the Hall vanishes from the list)",
    find: "var _named=keyedDict();if(_stashKind){(typeof _cm2!==\"undefined\"?_cm2:[]).concat(typeof _hk2!==\"undefined\"?_hk2:[]).forEach(function(x){_named[String(x).toLowerCase()]=1;});}",
    replace: "var _named=keyedDict();if(_stashKind){Object.keys(memory.map.nodes).forEach(function(k){_named[String(locDisplayLeaf(k)).toLowerCase()]=1;});}",
    mustFail: "#483 in the Village" },
  { label: "an adventure's list is filtered too (the Rusty Dragon vanishes)",
    find: "var _named=keyedDict();if(_stashKind){", replace: "var _named=keyedDict();if(true){_named[\"rusty dragon\"]=1;",
    mustFail: "#483 in the Village" }
]);
process.exit(code);
