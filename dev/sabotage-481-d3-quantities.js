// dev/sabotage-481-d3-quantities.js — proves the #481 D3 guards are guarded: the one quantity grammar must read any
// count (not only x2..x9), clamp a runaway count LOUDLY, reach the companion twins (gain and loss), and the counter's tag
// text must carry a stack in one tag. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-d3-quantities.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 D3"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("api.js", [
  { label: "the parser reads only single digits again",
    find: "match(/^(.*\\S)\\s+x([1-9]\\d*)$/i);if(!m)return", replace: "match(/^(.*\\S)\\s+x([2-9])$/i);if(!m)return",
    mustFail: "x12 and x10 move twelve and ten" },
  { label: "a runaway count is no longer clamped",
    find: "return n>QTY_MAX?{base:m[1],n:QTY_MAX,clamped:true}:{base:m[1],n:n};", replace: "return {base:m[1],n:n};",
    mustFail: "an absurd count is clamped" }
]);
prove("tag_table.js", [
  { label: "the companion gain ignores its count again",
    find: "for(cIqi=0;cIqi<cIq.n;cIqi++)addInventoryItem(cIgCs.inventory,cIq.base);", replace: "addInventoryItem(cIgCs.inventory,cIq.base);",
    mustFail: "the companion twins read the count" },
  { label: "the companion loss ignores its count again",
    find: "for(cIlqi=0;cIlqi<cIlq.n;cIlqi++){if(removeInventoryItem(cIlCs.inventory,cIlq.base))cIlHit++;else break;}", replace: "if(removeInventoryItem(cIlCs.inventory,cIlq.base))cIlHit++;",
    mustFail: "the companion twins read the count" }
]);
prove("helpers.js", [
  { label: "the counter chunks at nine again",
    find: 'if(l.qty>0)t+="["+(l.kind==="sell"?"ITEM_LOST":"ITEM_GAINED")+":"+l.name+(l.qty>1?" x"+l.qty:"")+"]";}',
    replace: 'var n=l.qty;while(n>0){var chunk=Math.min(n,9);t+="["+(l.kind==="sell"?"ITEM_LOST":"ITEM_GAINED")+":"+l.name+(chunk>1?" x"+chunk:"")+"]";n-=chunk;}}',
    mustFail: "round-trips a stack of thirteen" }
]);
process.exit(code);
