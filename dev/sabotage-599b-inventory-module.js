// dev/sabotage-599b-inventory-module.js — proves the #599 (b) inventory module is guarded: one home for the inventory
// functions, one key on a count-free name, the row form prepared losslessly or refused whole (I1–I5, §5.2), the detached
// copy. The legacy functions' own batteries (#388, #481 A2/D3, #545, W2) guard the moved code; this one guards what is new.
// Each mutation runs in a disposable clone; a mutation that changes no bytes is a failure.
//   node dev/sabotage-599b-inventory-module.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#599 (b)"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var HOME = "#599b one home", KEY = "#599b one key", GATE1 = "#599b gate 1", ROWS = "#599b the row functions", GATE14 = "#599b gate 14", LEGACY = "#599b→c the legacy names are DELEGATES over rows";
prove("inventory.js", [
  { label: "itemKey strips a count — a row named 'Torch x2' becomes Torch (I3 broken)",
    find: "function itemKey(name){return String(name==null?\"\":name).toLowerCase()", replace: "function itemKey(name){return String(name==null?\"\":name).replace(/\\s*x\\d+\\s*$/i,\"\").toLowerCase()",
    mustFail: KEY },
  { label: "the row bound is the tag bound (9999 → 999)",
    find: "var INV_QTY_MAX=9999;", replace: "var INV_QTY_MAX=999;",
    mustFail: KEY },
  { label: "a stored count above the bound is clamped instead of refused",
    find: "if(p.qty>INV_QTY_MAX)return {refuse:\"a stored count above \"+INV_QTY_MAX+\" ('\"+entry+\"')\"};", replace: "if(p.qty>INV_QTY_MAX)p.qty=INV_QTY_MAX;",
    mustFail: GATE1 },
  { label: "a same-key fold ignores differing extras (I5 lost in silence)",
    find: "      if(!invDeepEqual(invExtras(have),invExtras(r.row)))return {ok:false,rows:null,diagnostics:[],reason:\"two rows share the key '\"+k+\"' with different fields ('\"+have.name+\"', '\"+r.row.name+\"')\"};\n", replace: "",
    mustFail: GATE1 },
  { label: "a non-finite count is cloned instead of refused (JSON turns it into null)",
    find: "  var ji=invJsonIssue(entry);if(ji)return {refuse:ji+\" on '\"+entry.name+\"'\"};\n", replace: "",
    mustFail: GATE1 },
  { label: "an invalid count repairs to 1 with no evidence",
    find: "  else{diag={reason:\"an invalid count repaired to 1\",original:JSON.parse(JSON.stringify(entry))};row.qty=1;}", replace: "  else{row.qty=1;}",
    mustFail: GATE1 },
  { label: "a worn name nobody carries is dropped in silence",
    find: "else diags.push({reason:\"a worn item that is not carried\",original:w[i]});", replace: "else{}",
    mustFail: GATE1 },
  { label: "junk is dropped in silence",
    find: "    if(!r.ok){diags.push(r.diag);continue;}", replace: "    if(!r.ok){continue;}",
    mustFail: GATE1 },
  { label: "a container that is not a list is not kept as evidence",
    find: "  if(!Array.isArray(list)){diags.push({reason:\"the inventory is not a list\",original:list});list=[];}", replace: "  if(!Array.isArray(list)){list=[];}",
    mustFail: GATE1 },
  { label: "invFind chooses the first of two bases instead of refusing",
    find: "  if(hits.length===1)return hits[0];\n  invFind.last=", replace: "  if(hits.length>=1)return hits[0];\n  invFind.last=",
    mustFail: ROWS },
  { label: "add clamps at the bound instead of refusing",
    find: "if(rows[i].qty+n>INV_QTY_MAX)return {ok:false,reason:\"'\"+rows[i].name+\"' would pass \"+INV_QTY_MAX};rows[i].qty+=n;", replace: "rows[i].qty=Math.min(INV_QTY_MAX,rows[i].qty+n);",
    mustFail: ROWS },
  { label: "the removed fragment loses the row's fields (I5 through a transfer)",
    find: "frag=JSON.parse(JSON.stringify(row));frag.qty=take;", replace: "frag={name:row.name,qty:take,equipped:row.equipped};",
    mustFail: ROWS },
  { label: "a rename onto an existing key is allowed (two rows, one key)",
    find: "  for(j=0;j<rows.length;j++)if(j!==i&&_invIsRow(rows[j])&&itemKey(rows[j].name)===t)return {ok:false,reason:\"'\"+nm+\"' already on the sheet\"};\n", replace: "",
    mustFail: ROWS },
  { label: "the detached copy is not validated (a cycle throws, a Date stringifies)",
    find: "function invDetach(rows){var ji=invJsonIssue(rows);if(ji)return {ok:false,reason:ji,rows:null};", replace: "function invDetach(rows){",
    mustFail: GATE14 },
]);
prove("api.js", [
  { label: "a second inventory API grows back in api.js",
    find: "/* #599 (b): the inventory-string functions that lived here", replace: "function _invNorm(s){return s;}\n/* #599 (b): the inventory-string functions that lived here",
    mustFail: HOME },
]);
/* the manifest and the hosts' load order are pinned by the HOME test and the ENGINE MANIFEST CONTRACT (run-tests.js) — a
   manifest mutation stops the suite before any test runs, so it is not provable here */
process.exit(code);
