// dev/sabotage-599b4-boundary.js — proves the #599 (b4) read/write boundary is guarded: the INVENTORY BOUNDARY CONTRACT
// (run-tests.js) names a planted string type-test, count regex, index, join or indexOf on an inventory in any engine file, a
// reader routed back around the module, and an EXEMPT row naming no site; the module's own readers are pinned by the
// "#599 (b4)" section (junk said loudly, strings verbatim, the tally by key, the one resolver). Each mutation runs in a
// disposable clone.
//   node dev/sabotage-599b4-boundary.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#599 (b4)"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var CONTRACT = "INVENTORY BOUNDARY CONTRACT", ENTRIES = "#599b4 invEntries decodes", TEXT = "#599b4 invTextList prints", TALLY = "#599b4 invTally sums", HOLDS = "#599b4 invHolds is the one resolver";
prove("ui-shell.js", [
  { label: "a string type-test on an inventory entry planted in an engine file",
    find: "function showToast(", replace: "function _p599b4a(inv){return typeof inv[0]===\"string\";}\nfunction showToast(",
    mustFail: CONTRACT },
  { label: "a hand-rolled count grammar planted in an engine file",
    find: "function showToast(", replace: "function _p599b4b(s){return s.match(/^(.*?)\\s+x(\\d+)$/);}\nfunction showToast(",
    mustFail: CONTRACT },
  { label: "a whole-list join planted in an engine file",
    find: "function showToast(", replace: "function _p599b4c(c){return c.inventory.join(\", \");}\nfunction showToast(",
    mustFail: CONTRACT },
  { label: "an index into an inventory planted in an engine file",
    find: "function showToast(", replace: "function _p599b4d(c){return c.inventory[0];}\nfunction showToast(",
    mustFail: CONTRACT },
  { label: "a whole-string indexOf on an inventory planted in an engine file",
    find: "function showToast(", replace: "function _p599b4e(c){return (c.inventory||[]).indexOf(\"Rope\")>=0;}\nfunction showToast(",
    mustFail: CONTRACT },
]);
prove("game.js", [
  { label: "the turn snapshot goes back to its own loop with the silent string guard",
    find: "  return invTally(worldState.character.inventory||[]);",
    replace: "  var m=keyedDict(),inv=worldState.character.inventory||[],i;for(i=0;i<inv.length;i++){if(typeof inv[i]!==\"string\")continue;m[_invNorm(inv[i])]={label:_invBase(inv[i]),n:_invCount(inv[i])};}return m;",
    mustFail: CONTRACT },
  { label: "the Sync diff tallies whole strings again (a respelling reads as a loss and a gain)",
    find: "  var b=invTally(before),a=invTally(after),out=[],k,d;\n  for(k in a){d=a[k].n-(b[k]?b[k].n:0);if(d>0)out.push(\"+\"+a[k].label+(d>1?\" x\"+d:\"\"));}\n  for(k in b){d=b[k].n-(a[k]?a[k].n:0);if(d>0)out.push(\"−\"+b[k].label+(d>1?\" x\"+d:\"\"));}",
    replace: "  function tally(list){var m=keyedDict(),i;for(i=0;i<(list||[]).length;i++){m[list[i]]=(m[list[i]]||0)+1;}return m;}\n  var b=tally(before),a=tally(after),out=[],k;\n  for(k in a){if((a[k]||0)>(b[k]||0))out.push(\"+\"+k+((a[k]-(b[k]||0))>1?\" x\"+(a[k]-(b[k]||0)):\"\"));}\n  for(k in b){if((b[k]||0)>(a[k]||0))out.push(\"−\"+k+((b[k]-(a[k]||0))>1?\" x\"+(b[k]-(a[k]||0)):\"\"));}",
    mustFail: TALLY },
  { label: "Define looks the item up by the whole string again",
    find: "  var carried=invHolds(worldState.character.inventory||[],rawItem);", replace: "  var carried=(worldState.character.inventory||[]).indexOf(rawItem)>=0;",
    mustFail: CONTRACT },
]);
prove("memory.js", [
  { label: "the recurring-name reader goes back to its silent string guard (the indexed form the census sees; a guard behind an alias is the proof obligation §5.3 names, not a property of the table)",
    find: "var _re=invEntries(inv);", replace: "var _re=[];for(ii=0;ii<inv.length;ii++)if(typeof inv[ii]===\"string\")_re.push({text:inv[ii]});",
    mustFail: CONTRACT },
]);
prove("inventory.js", [
  { label: "junk is skipped in silence again (no count, no console line)",
    find: "  invEntries.lastJunk=junk;\n", replace: "  invEntries.lastJunk=0;junk=0;\n",
    mustFail: ENTRIES },
  { label: "the text projection runs a string through the row printer (the prompt would read 'undefined')",
    find: "out.push(typeof e===\"string\"?e:(e==null?\"\":(typeof e===\"object\"&&typeof e.name===\"string\"?invText(e):String(e))));}return out;}", replace: "out.push(invText(e));}return out;}",
    mustFail: TEXT },
  { label: "the free-text parser stops trimming",
    find: "split(\"\\n\").map(function(x){return x.trim();}).filter(function(x){return x.length>0;});}", replace: "split(\"\\n\").filter(function(x){return x.length>0;});}",
    mustFail: TEXT },
  { label: "the tally keys by the whole text again",
    find: "var k=itemKey(es[i].name);if(!m[k])m[k]={label:es[i].name,n:0};m[k].n+=es[i].qty;}return m;}", replace: "var k=es[i].text;if(!m[k])m[k]={label:es[i].name,n:0};m[k].n+=es[i].qty;}return m;}",
    mustFail: TALLY },
  { label: "the hold test is a whole-string indexOf again",
    find: "function invHolds(inv,name){return resolveInventoryName(inv,name)>=0;}", replace: "function invHolds(inv,name){return (inv||[]).indexOf(name)>=0;}",
    mustFail: HOLDS },
]);
prove("ui-panels.js", [
  { label: "the panel reads the count with its own pattern again",
    find: "  var _qp=invStoredParse(s),_qty=_qp.qty>1?String(_qp.qty):null;s=_qp.name;", replace: "  var _qty=null,_qm=s.match(/^(.*?)\\s+x(\\d+)\\s*$/);if(_qm){s=_qm[1];_qty=_qm[2];}",
    mustFail: CONTRACT },
]);
prove("dev/run-tests.js", [
  { label: "an EXEMPT row that names no site",
    find: "  var _ibExempt = [];", replace: "  var _ibExempt = [{ file: \"game.js\", fn: \"nowhere\", rule: \"an index into an inventory (read invEntries or invEntryText)\", why: \"planted\" }];",
    mustFail: CONTRACT },
]);
process.exit(code);
