// dev/sabotage-608-display-order.js — proves #608 is guarded: the equipped rows lead, the rest sort by the decoded KEY (not the
// raw text), the equipped rows keep pack order, and every group (Unclassified included) takes the one display order.
//   node dev/sabotage-608-display-order.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#608"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var ORDER = "#608 invDisplayOrder", ONE = "#608 ONE sort";
prove("inventory.js", [
  { label: "the equipped rows no longer lead",
    find: "    if(!!a.equipped!==!!b.equipped)return a.equipped?-1:1;\n", replace: "",
    mustFail: ORDER },
  { label: "the rest sort on the raw name (case-sensitive) instead of the decoded key",
    find: "var ka=itemKey(a.name),kb=itemKey(b.name);", replace: "var ka=a.name,kb=b.name;",
    mustFail: ORDER },
  { label: "the equipped rows sort by name instead of keeping pack order",
    find: "    if(!a.equipped){var ka=itemKey(a.name),kb=itemKey(b.name);if(ka<kb)return -1;if(ka>kb)return 1;}", replace: "    {var ka=itemKey(a.name),kb=itemKey(b.name);if(ka<kb)return -1;if(ka>kb)return 1;}",
    mustFail: ORDER },
  { label: "the Unclassified group is left in pack order",
    find: "un.rows=invDisplayOrder(un.rows);", replace: "",
    mustFail: ORDER },
  { label: "the sort runs on the live bucket array instead of a copy",
    find: "  return (rows||[]).slice().sort(function(a,b){", replace: "  return (rows||[]).sort(function(a,b){",
    mustFail: ONE }
]);
process.exit(code);
