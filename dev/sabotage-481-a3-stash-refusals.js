// dev/sabotage-481-a3-stash-refusals.js — proves the #481 A3 guards are guarded: a refused item move must reach the GM
// (stashRefusedPing, for a refused placement and a refused take), and the household rule must hold (a companion who lives
// in the hero's house takes from the hero's chest; another resident's chest keeps its item). Each mutation runs in a
// disposable clone.
//   node dev/sabotage-481-a3-stash-refusals.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 A3"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("tag_table.js", [
  { label: "a refused placement no longer reaches the GM",
    find: "    worldState.stashRefusedPing={turn:R.turn,item:_lnm,action:_lact,place:_lplace||null,reason:_lwhy};/* #481 A3: the GM is told, once */\n", replace: "",
    mustFail: "a refused placement and a refused take each arm" },
  { label: "a refused take no longer reaches the GM",
    find: 'worldState.stashRefusedPing={turn:R.turn,item:_lnm,action:"taken",reason:"a stash take names no actor"};/* #481 A3: the GM is told */', replace: "",
    mustFail: "a refused placement and a refused take each arm" },
  { label: "a companion's gain no longer takes from where the item lies",
    find: "    var _cAt=mutPolicy(R).autoTake?autoTakeLocationItem(cIq.base,cIgCs.name||cOwner,cIq.n,rPlaceAt(R,cIgOff[cIgi]).key):null;", replace: "    var _cAt=null;",
    mustFail: "the household: a companion who lives in the hero's house" }
]);
prove("memory.js", [
  { label: "the household no longer counts as the owner's hand",
    find: "  if(node.owner!==hero)return false;\n  var n=(typeof wsNpcByName===\"function\")?wsNpcByName(who):null;", replace: "  return false;\n  var n=(typeof wsNpcByName===\"function\")?wsNpcByName(who):null;",
    mustFail: "the household: a companion who lives in the hero's house" },
  { label: "any companion takes from any resident's chest",
    find: "  if(node.owner!==hero)return false;\n", replace: "  if(false)return false;\n",
    mustFail: "the household: a companion who lives in the hero's house" }
]);
process.exit(code);
