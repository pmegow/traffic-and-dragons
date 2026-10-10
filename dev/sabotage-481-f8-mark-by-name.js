// dev/sabotage-481-f8-mark-by-name.js — proves the #481 F8 guards are guarded: an inventory × carries its row's name beside its
// index, and a mark resolves by the name when a GM turn moved the pack under a sheet left open (it used to mark — and delete —
// the neighbour). A × whose item is gone marks nothing and says so. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-f8-mark-by-name.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/tests-429-inventory-drop.js"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("inventory.js", [/* #599 (b4): invMarkResolve lives in inventory.js (one home) */
  { label: "the index wins over the name (the neighbour is marked)",
    find: "  if(idx>=0&&idx<inv.length&&_invMarkIs(inv,idx,name))return idx;\n  var best=-1", replace: "  if(idx>=0&&idx<inv.length)return idx;\n  var best=-1",/* #599 (c): the mark's name is matched by key */
    mustFail: "#481 F8 the repro" }
]);
prove("ui-sheets.js", [
  { label: "the × drops its name",
    find: "onclick=\"markInvItem(this.dataset.own,this.dataset.idx,event,this.dataset.name)\"", replace: "onclick=\"markInvItem(this.dataset.own,this.dataset.idx,event)\"",
    mustFail: "#481 F8 the × carries its row's name" },
  { label: "a gone item's × is silent",
    find: "if(name&&typeof showToast===\"function\")showToast(name+\" is no longer carried", replace: "if(false)showToast(name+\" is no longer carried",
    mustFail: "#481 F8 the × carries its row's name" }
]);
process.exit(code);
