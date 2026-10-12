// dev/sabotage-618-start-world-heal.js — proves #618 is guarded: healMemory (state.js) stamps the CURRENT world's
// resolved node visited at LOAD, so a campaign begun before the #481 C11 start stamp stops telling the GM its own
// start world is "not yet visited". Each rule is mutated back: the stamp removed (the lie returns), the identity
// resolve dropped (an aliased pointer misses the canonical), the never-mint guard turned into a mint (a dead alias
// re-creates a tombstoned twin), and the idempotence lost (a visited start world is reset to one visit).
//   node dev/sabotage-618-start-world-heal.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#481 C11 prompt text"]];
var STAMP = "    if(_swN&&!(_swN.visits>0)){_swN.visits=1;if(_swN.firstVisit==null)_swN.firstVisit=0;";
var code = 0;
code |= sabotage.prove({ file: "state.js", command: CMD, cases: [
  { label: "the load heal is removed: a campaign begun before #481 C11 keeps its start world at 0 visits (#618)",
    mustFail: "#618 the load heal did not stamp the start world visited",
    find: STAMP, replace: "    if(false){_swN.visits=1;if(_swN.firstVisit==null)_swN.firstVisit=0;" },
  { label: "the identity resolve is dropped: an aliased pointer on a repaired map misses the canonical start world (#618)",
    mustFail: "#618 an aliased pointer did not stamp the canonical start world",
    find: "    var _swK=(typeof locResolve===\"function\")?locResolve(worldState.world.location):worldState.world.location,_swN=memory.map.nodes[_swK];",
    replace: "    var _swK=worldState.world.location,_swN=memory.map.nodes[_swK];" },
  { label: "the never-mint guard becomes a mint: a missing start node is re-created at load, a tombstoned twin's door (#618)",
    mustFail: "#618 the load heal minted a missing start node",
    find: ",_swN=memory.map.nodes[_swK];", replace: ",_swN=memory.map.nodes[_swK]||(memory.map.nodes[_swK]=newMapNode(0,null));" },
  { label: "the idempotence is lost: a start world already visited is reset to one visit on every load (#618)",
    mustFail: "#618 the load heal touched a start world that was already visited",
    find: STAMP, replace: "    if(_swN){_swN.visits=1;if(_swN.firstVisit==null)_swN.firstVisit=0;" }
] });
process.exit(code);
