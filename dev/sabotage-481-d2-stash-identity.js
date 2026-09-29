// dev/sabotage-481-d2-stash-identity.js — proves the #481 D2 guards are guarded: the chest and the pack must agree on
// what an item is (ONE stashKey), a stash row stores the base name with the tag's count, a take moves n units, and legacy
// "…xN" rows heal at load. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-d2-stash-identity.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 D2"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("memory.js", [
  { label: "a stash row stores the raw tag text again (the Hemp rope x2 copy machine)",
    find: "  if(qtyMode)name=_sq.base;\n", replace: "",
    mustFail: "is ONE row of two" },
  { label: "a new row ignores the tag's count",
    find: "var nr={name:name,placed:turn,taken:false,qty:_sq.n,by:hero,min:now};", replace: "var nr={name:name,placed:turn,taken:false,qty:1,by:hero,min:now};",
    mustFail: "is ONE row of two" },
  { label: "a take moves one unit whatever the count",
    find: "var _got=Math.min(_un,it.qty||1);", replace: "var _got=1;",
    mustFail: "taking 'x2' takes two from the chest" },
  { label: "the auto-take matches the raw lowercase name again",
    find: "if(((typeof stashKey===\"function\")?stashKey(it.name):it.name.toLowerCase())!==_tk||it.taken||it.qty===0)continue;",
    replace: "if(it.name.toLowerCase()!==String(itemName).toLowerCase()||it.taken||it.qty===0)continue;",
    mustFail: "a plural or dash variant reaches the right row" },
  { label: "the legacy heal no longer renames",
    find: "      var q=_qtyParse(it.name);if(q.base===it.name)continue;\n", replace: "      continue;\n",
    mustFail: "legacy '…xN' village rows heal" },
  { label: "a counted take on the record moves one unit again",
    find: "_tn=Math.min(_sq.n,r2.qty||1);", replace: "_tn=1;",
    mustFail: "a counted take on the record" }
]);
prove("tag_table.js", [
  { label: "the auto-take receipt is silent again",
    find: "if(_at&&_at.taken&&_at.n)R.muts.push(", replace: "if(false)R.muts.push(",
    mustFail: "the receipt names the two units" }
]);
process.exit(code);
