// dev/sabotage-497-ledger-wrap.js — proves the #497 guard is guarded (owner 2026-09-30: with 14 bottles marked 14/14, another
// tap should put the row back to none). A ledger row's count steps through ONE pure function (ledgerNextMark, helpers.js): up
// by one to the row's maximum, then none. The shop's counter and the chest share the click. Each mutation runs in a disposable
// clone.
//   node dev/sabotage-497-ledger-wrap.js
var sabotage = require("./sabotage.js"), rc = 0;
var CMD = ["node", ["dev/run-tests.js", "#407 the shop interface"]], T = "#497 a row's count wraps";
rc |= sabotage.prove({ file: "helpers.js", command: CMD, cases: [
  { label: "the count stops at the row's maximum again (14/14 is a dead end)",
    find: "return cur>=max?0:cur+1;}", replace: "return Math.min(max,cur+1);}",
    mustFail: T },
  { label: "a single item cannot be unmarked by a second tap",
    find: "cur=cur|0;max=Math.max(1,max|0);", replace: "cur=cur|0;max=Math.max(2,max|0);",
    mustFail: T }
]});
rc |= sabotage.prove({ file: "ui-modals.js", command: CMD, cases: [
  { label: "the row click steps on its own again, without the shared rule",
    find: "var nx=ledgerNextMark(marks[side][key]|0,max);if(nx)marks[side][key]=nx;else delete marks[side][key];render();", replace: "var cur=marks[side][key]|0;if(max<=1){if(cur)delete marks[side][key];else marks[side][key]=1;}else marks[side][key]=Math.min(max,cur+1);render();",
    mustFail: T }
]});
process.exit(rc ? 1 : 0);
