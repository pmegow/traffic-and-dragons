// dev/sabotage-599c2-review.js — proves the closures of the independent review of #599 release (c) are guarded
// (audits/REVIEW_599_release_c_2026_10_09.md): a refused write lands no receipt and no pair hit, the take pair reads the
// hero's refusal, the ledger prechecks a gain on the copy, a world holding a row is stamped SAVE_VER at every write boundary,
// a fragment's unknown fields ride a give and a take or the move is restored, a stow of such a row refuses, the load door
// says a dropped portrait once, the Sync mapper refuses junk, prepare keeps a nameless object, a malformed worn is evidence,
// the model faucet clamps one entry, and the three dev tools read rows.
//   node dev/sabotage-599c2-review.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#599 (c2)"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var R1 = "#599c2 review 1", R2 = "#599c2 review 2", R3 = "#599c2 review 3", R4A = "#599c2 review 4a", R4B = "#599c2 review 4b", R4C = "#599c2 review 4c",
    R5 = "#599c2 review 5", R6 = "#599c2 review 6", R7 = "#599c2 review 7", R8 = "#599c2 review 8", R9 = "#599c2 review 9", R10 = "#599c2 review 10";
prove("inventory.js", [
  { label: "invAdd merges a fragment into a stack with DIFFERENT fields (the give overwrites nothing but the fields are lost)",
    find: "if(exn&&!invDeepEqual(invExtras(rows[i]),ex))return {ok:false,reason:\"'\"+rows[i].name+\"' carries different fields\",fields:true};", replace: "",
    mustFail: R4A },
  { label: "invAdd drops a fragment's fields from the new row it creates",
    find: "if(exn)for(k in ex)row[k]=JSON.parse(JSON.stringify(ex[k]));", replace: "",
    mustFail: R4A },
  { label: "a worn value that is not a list is deleted without evidence again",
    find: "if(worn!==undefined&&worn!==null&&!Array.isArray(worn))diags.push({reason:\"a worn list that is not a list\",original:worn});", replace: "",
    mustFail: R8 },
  { label: "a worn entry that is not a name is skipped without evidence again",
    find: "if(w[i]!==undefined&&w[i]!==null)diags.push({reason:\"a worn entry that is not a name\",original:w[i]});", replace: "",
    mustFail: R8 },
  { label: "the Sync mapper maps a source holding junk (a '7' row, an '[object Object]' row)",
    find: "if(p.diagnostics.length)return {ok:false,rows:null,reason:p.diagnostics.length+\" unreadable entr\"", replace: "if(false)return {ok:false,rows:null,reason:p.diagnostics.length+\" unreadable entr\"",
    mustFail: R6 },
  { label: "prepare classifies junk by invEntryRow again (a nameless object is neither converted nor kept)",
    find: "for(i=0;i<inv.length;i++)if(!invRowOf(inv[i]).ok)keep.push(inv[i]);", replace: "for(i=0;i<inv.length;i++)if(!invEntryRow(inv[i]))keep.push(inv[i]);",
    mustFail: R7 },
  { label: "addInventoryItem ignores the fragment it is handed",
    find: "r=invAdd(inv,d.name,d.qty,frag?invExtras(frag):null);", replace: "r=invAdd(inv,d.name,d.qty);",
    mustFail: R4A },
  { label: "removeInventoryItem exposes no fragment (a transfer has nothing to carry)",
    find: "removeInventoryItem.lastRow=r.removed;", replace: "removeInventoryItem.lastRow=null;",
    mustFail: R4A },
  { label: "the model faucet empties the whole pack over one count past the bound again",
    find: "if(q>INV_QTY_MAX){clamped.push(p.name+\" x\"+q);q=INV_QTY_MAX;}", replace: "if(q>INV_QTY_MAX){return [];}",
    mustFail: R9 },
  { label: "invCarryFields puts a fragment's fields onto a plain stack the hero already held (no restore)",
    find: "if(row.qty!==units)return {ok:false,reason:\"'\"+row.name+\"' is a stack of \"+row.qty+\" without those fields\"};", replace: "",
    mustFail: R4B },
]);
prove("state.js", [
  { label: "inventoryStampWorld never stamps",
    find: "if(sheets[i].sheet&&invHoldsRow(sheets[i].sheet.inventory)){ws.ver=SAVE_VER;return true;}", replace: "if(false){ws.ver=SAVE_VER;return true;}",
    mustFail: R3 },
  { label: "the camp is captured without the stamp",
    find: "  inventoryStampWorld(worldState);/* #599 (c2), review 3: a camp of a world holding a row carries SAVE_VER */\n", replace: "",
    mustFail: R3 },
  { label: "saveCore serializes without the stamp",
    find: "function saveCore(){try{inventoryStampWorld(worldState);/* #599 (c2), review 3 */", replace: "function saveCore(){try{",
    mustFail: R3 },
  { label: "the load door drops portraits with only a console line again",
    find: "if(dropped&&typeof showToast===\"function\")showToast(", replace: "if(false)showToast(",
    mustFail: R5 },
]);
prove("admission.js", [
  { label: "the portrait entry stops counting what it dropped",
    find: "ctx.portraitsDropped=(ctx.portraitsDropped||0)+_pd;", replace: "",
    mustFail: R5 },
]);
prove("tag_table.js", [
  { label: "a refused ITEM_GAINED prints its receipt anyway",
    find: "if(!_igL){R.muts.push(\"⚠ Nothing gained — '\"+igq.base+\"': \"", replace: "if(false){R.muts.push(\"⚠ Nothing gained — '\"+igq.base+\"': \"",
    mustFail: R2 },
  { label: "ITEM_LOST notes no fragment for the pair",
    find: "itemPairNote(R,\"ilFrags\",ilq.base,removeInventoryItem.lastRow,_ilB);", replace: "",/* #518 */
    mustFail: R4A },
  { label: "a stow of a row with fields is filed in the chest (the fields are lost)",
    find: "if(_lact===\"placed\"&&invFragsHaveFields(itemPairList(R,\"ilFrags\",_lnm,_liB))){", replace: "if(false){",/* #518 */
    mustFail: R4C },
  { label: "a gift's refused unit vanishes instead of returning to the hero",
    find: "if(_gHits!==null){if(addInventoryItem(worldState.character.inventory,_cgF?_cgF.name:cIq.base,_cgF))_cgB++;", replace: "if(false){if(addInventoryItem(worldState.character.inventory,_cgF?_cgF.name:cIq.base,_cgF))_cgB++;",
    mustFail: R4A },
  { label: "the take pair hands the unit over although the hero's gain was refused (the item is destroyed)",
    find: "_tlMiss=itemPairMissWhy(R,\"igMiss\",cIlq.base,_tlB);if(_tlMiss){", replace: "_tlMiss=itemPairMissWhy(R,\"igMiss\",cIlq.base,_tlB);if(false){",/* #518 */
    mustFail: R2 },
  { label: "a take onto a plain stack keeps the move (the companion's fields are lost)",
    find: "if(cIlHit&&_tlG>0&&invFragsHaveFields(_tlF)){", replace: "if(false){",
    mustFail: R4B },
]);
prove("game.js", [
  { label: "the ledger lands a buy the pack refuses and charges the coin",
    find: "if(l.kind===\"buy\"||l.kind===\"take\"){for(j=0;j<l.qty;j++)if(!addInventoryItem(sim,l.name))return", replace: "if(false){for(j=0;j<l.qty;j++)if(!addInventoryItem(sim,l.name))return",
    mustFail: R2 },
  { label: "the ledger stows a row with fields (the chest row cannot hold them)",
    find: "if(l.kind===\"stow\"&&invFragsHaveFields([removeInventoryItem.lastRow]))return", replace: "if(false)return",
    mustFail: R4C },
]);
prove("ui-files.js", [
  { label: "File ▸ Save exports a row-bearing world without the stamp",
    find: "    inventoryStampWorld(worldState);/* #599 (c2), review 3: a world holding a row is written as SAVE_VER */\n", replace: "",
    mustFail: R3 },
  { label: "the #424 copy exports a row-bearing world without the stamp",
    find: "  inventoryStampWorld(ws);/* #599 (c2), review 3: a copy holding a row is written as SAVE_VER */\n", replace: "",
    mustFail: R3 },
]);
prove("storage-adapter.js", [
  { label: "the wire form goes out without the stamp",
    find: "    inventoryStampWorld(worldState);/* #599 (c2), review 3: a world holding a row goes over the wire as SAVE_VER */\n", replace: "",
    mustFail: R3 },
]);
prove("dev/check-replay-rebaseline.js", [
  { label: "the re-baseline checker accepts rows carrying extra fields again",
    find: "    if (!bad && y.some(function (r) { return Object.keys(r).sort().join(\",\") !== \"equipped,name,qty\"; })) bad = ", replace: "    if (false) bad = ",
    mustFail: R10 },
]);
prove("dev/playtest-harness.js", [
  { label: "the playtest harness reads consumables by index again (none on a row campaign)",
    find: "var _es=invEntries(c.inventory||[]);", replace: "var _es=(c.inventory||[]).map(function(x){return {name:String(x)};});",
    mustFail: R1 },
]);
prove("dev/item-bible-coverage.js", [
  { label: "the coverage tool walks the raw entries again (every row a miss)",
    find: "invEntries(o.inv).forEach(function(en){var raw=en.name;", replace: "o.inv.forEach(function(raw){",
    mustFail: R1 },
]);
process.exit(code);
