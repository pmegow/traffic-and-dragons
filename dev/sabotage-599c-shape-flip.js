// dev/sabotage-599c-shape-flip.js — proves the guards of #599 release (c), the shape flip (DOC/DESIGN_599_inventory_rows.md
// §5, §8.2 gate 6): the sheet heal (worn folded, junk filed once, the stamp), the load door (all or nothing, the v11 stamp,
// every sheet a world carries, the checkpoint restore), the handlers over rows, copy ownership, the Wearing line, the Sync
// modal's line mapping, the delete marks by key, the faucets, the census oracle, the satellites, the version constants
// and the place writer's unit argument. Every clause must fail its NAMED test (mustFail), never an unrelated red.
//   node dev/sabotage-599c-shape-flip.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#599 (c)"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var HEAL = "#599c the heal", LOAD = "#599c the load is a door", HANDLERS = "#599c gate 3", COPY = "#599c gate 14", WEAR = "#599c the Equipped line",
    SYNC = "#599c the Sync modal", MARKS = "#599c the delete marks", FAUCET = "#599c the model faucets", CENSUS = "#599c gate 7", SATELLITES = "#599c the satellites",
    STAMPS = "#599c what this build stamps", PLACE = "#599c the place writer", BOUNDARY = "INVENTORY BOUNDARY CONTRACT";
prove("inventory.js", [
  { label: "the heal leaves the worn list beside the flags (two truths)",
    find: "  if(sheet.worn!==undefined){delete sheet.worn;changed=true;}\n", replace: "",
    mustFail: HEAL },
  { label: "the heal files the same evidence again on every load (bytes grow)",
    find: "for(i=0;i<r.diagnostics.length;i++){var k=invJunkKey(r.diagnostics[i]);if(!have[k]){have[k]=1;add.push(r.diagnostics[i]);}}", replace: "for(i=0;i<r.diagnostics.length;i++){add.push(r.diagnostics[i]);}",
    mustFail: HEAL },
  { label: "the heal does not stamp the sheet",
    find: "  if(sheet.sheetVer!==SHEET_VER){sheet.sheetVer=SHEET_VER;changed=true;}/* the sheet says which shape it holds (§5.4) */\n", replace: "",
    mustFail: HEAL },
  { label: "malformed evidence is overwritten instead of refused",
    find: "  if(sheet.inventoryJunk!==undefined&&!Array.isArray(sheet.inventoryJunk))return (sheet.name||\"the sheet\")+\"'s inventory evidence is malformed (not a list) — refused, nothing overwritten\";\n", replace: "",
    mustFail: HEAL },
  { label: "the worn fold erases the flag (every equipped item lost on the switch)",
    find: "    if(idx[k]!==undefined)rows[idx[k]].equipped=true;else diags.push", replace: "    if(idx[k]!==undefined)rows[idx[k]].equipped=false;else diags.push",
    mustFail: CENSUS },
  { label: "the Wearing line reads only the rows (a legacy sheet's worn list is dropped)",
    find: "  var w=(cs&&Array.isArray(cs.worn))?cs.worn:[];for(i=0;i<w.length;i++){if(typeof w[i]!==\"string\"||!w[i])continue;var k=itemKey(invStoredParse(w[i]).name);if(!seen[k]){seen[k]=1;out.push(w[i]);}}\n", replace: "",
    mustFail: WEAR },
  { label: "an ambiguous Sync line takes the first row that prints alike",
    find: "    if(hits.length>1)return {ok:false,rows:null,reason:\"'\"+lines[i]+\"' matches \"+hits.length+\" rows that print alike (\"+hits.map(function(h){return src[h].name+\" ×\"+src[h].qty;}).join(\", \")+\") — edit those on the sheet\"};\n", replace: "",
    mustFail: SYNC },
  { label: "an edited Sync line becomes a NEW row (the flag and the fields are lost)",
    find: "    if(kh>=0){claimed[kh]=1;row=src[kh];row.name=nr.row.name;row.qty=nr.row.qty;out.push(row);}/* an edited count or spelling keeps the row — its flag and its fields */\n    else out.push(nr.row);", replace: "    out.push(nr.row);",
    mustFail: SYNC },
  { label: "a mark matches the whole entry again (a row is never equal to a name)",
    find: "function _invMarkIs(inv,i,name){return itemKey(invEntryName(inv,i))===itemKey(name);}", replace: "function _invMarkIs(inv,i,name){return inv[i]===name;}",
    mustFail: MARKS },
  { label: "the model faucet pushes the raw strings again",
    find: "  return rows.slice(0,max);\n}", replace: "  return list.filter(function(s){return typeof s===\"string\"&&s;}).slice(0,max);\n}",/* #599 (c2): the faucet clamps per entry; the rows are built in place */
    mustFail: FAUCET },
  { label: "a refused rename moves the flag with it (#606 reopened: the mark follows a name the pack refused)",
    find: "  rows[i].name=nm;return {ok:true,row:rows[i]};", replace: "  rows[i].name=nm;rows[i].equipped=false;return {ok:true,row:rows[i]};",
    mustFail: HANDLERS }
]);
prove("admission.js", [
  { label: "the inventory entry is the (b) adapter again (no rows installed at any door)",
    find: "   run:function(sheet,ctx){var h=invHealSheet(sheet);if(h.ok){if(h.changed)ctx.healed=true;}else if(typeof console!==\"undefined\")console.error(\"[admission] \"+ctx.door+\" — the pack was not healed after its gate passed: \"+h.reason);}},", replace: "   run:function(sheet){if(!Array.isArray(sheet.inventory))sheet.inventory=[];}},",
    mustFail: HEAL },
  { label: "the inventoryCheck gate passes everything (a count over the bound enters)",
    find: "   run:function(sheet){return invSheetIssue(sheet);},", replace: "   run:function(sheet){return \"\";},",
    mustFail: HEAL }
]);
prove("state.js", [
  { label: "the world is never stamped v11 (every later load re-heals a v10 world)",
    find: "  if(ws&&(typeof ws.ver!==\"number\"||ws.ver<SAVE_VER)){ws.ver=SAVE_VER;changed=true;}\n", replace: "",
    mustFail: LOAD },
  { label: "all-or-nothing is lost: the sheets before a refused one are converted anyway",
    find: "  for(i=0;i<sheets.length&&!why;i++)why=invSheetIssue(sheets[i].sheet);\n", replace: "",
    mustFail: LOAD },
  { label: "the checkpoint restore skips the door (a pre-(c) camp restores string packs into a v11 world)",
    find: "  var _cia=inventoryAdmitWorld(worldState,\"checkpoint restore\");", replace: "  var _cia={ok:true};",
    mustFail: LOAD },
  { label: "the load no longer runs the door",
    find: "  var _lsa=inventoryAdmitWorld(worldState,\"load\");if(_lsa.changed)_mig=true;", replace: "  var _lsa={changed:false};",
    mustFail: LOAD }
]);
prove("helpers.js", [
  { label: "the world's sheet walk forgets the parked fallen (a rejoining sheet comes back as strings)",
    find: "  fallen=Array.isArray(ws.mpFallen)?ws.mpFallen:[];for(i=0;i<fallen.length;i++)if(fallen[i]&&fallen[i].sheet&&typeof fallen[i].sheet===\"object\")out.push({who:\"fallen \"+fallen[i].name,sheet:fallen[i].sheet,rel:fallen[i].name,portable:false});\n", replace: "",
    mustFail: LOAD }
]);
prove("game.js", [
  { label: "the ledger precheck runs on the LIVE rows (a refused sale decrements the pack)",
    find: "var sim=invSnapshot(c.inventory),node=", replace: "var sim=c.inventory,node=",
    mustFail: COPY },
  { label: "the stow hands the count baked into the name again",
    find: "if(ln.kind===\"stow\"){var st=fileLocationItem(ln.name,\"placed\",R.turn,null,null,{key:key,units:n});", replace: "if(ln.kind===\"stow\"){var st=fileLocationItem(ln.name+qs,\"placed\",R.turn,null,null,{key:key});",
    mustFail: PLACE }
]);
prove("api.js", [
  { label: "the Wearing line reads the worn list alone (a healed sheet wears nothing)",
    find: "function attireLine(cs){if(!cs)return \"\";var w=invEquippedNames(cs),", replace: "function attireLine(cs){if(!cs)return \"\";var w=(cs.worn||[]).filter(function(x){return !!x;}),",
    mustFail: WEAR }
]);
prove("tag_table.js", [
  { label: "the #510 sale precheck shares the live rows (a withheld sale still empties the pack)",
    find: "var _sSim=invSnapshot(worldState.character.inventory),", replace: "var _sSim=worldState.character.inventory,",
    mustFail: COPY }
]);
prove("memory.js", [
  { label: "the place writer ignores the unit argument and parses the name",
    find: "_sq=(at&&typeof at.units===\"number\"&&at.units>=1)?{base:String(name).trim(),n:Math.floor(at.units)}:((qtyMode&&typeof _qtyParse===\"function\")?_qtyParse(name):{base:name,n:1});", replace: "_sq=(qtyMode&&typeof _qtyParse===\"function\")?_qtyParse(name):{base:name,n:1};",
    mustFail: PLACE }
]);
prove("ui-modals.js", [
  { label: "the Sync modal rebuilds the pack from its text (every flag and field lost on Apply)",
    find: "var _ia=invApplyLines(c2.inventory,invFromLines(rawInv)),inv2=_ia.ok?_ia.rows:null;", replace: "var _ia={ok:true,rows:invRows(invFromLines(rawInv)).rows},inv2=_ia.rows;",
    mustFail: SYNC }
]);
prove("ui-sheets.js", [
  { label: "the × hands the mark the entry's TEXT again (a stacked row's mark never resolves)",
    find: "invDropToggle(_invDropMarksFor(owner),at,invEntryName(cs.inventory,at))", replace: "invDropToggle(_invDropMarksFor(owner),at,invEntryText(cs.inventory,at))",
    mustFail: MARKS }
]);
prove("globals.js", [
  { label: "the world shape is written as v10 again (a (c) save passes a (b) build's gate)",
    find: "var SAVE_VER=11,SHEET_VER=11;", replace: "var SAVE_VER=10,SHEET_VER=11;",
    mustFail: STAMPS }
]);
prove("character_editor.html", [
  { label: "the editor's healChar skips the module's heal (an old .char opens as strings in a row editor)",
    find: "var _ih=invHealSheet(c);if(!_ih.ok)", replace: "var _ih={ok:true};if(!_ih.ok)",
    mustFail: SATELLITES }
]);
prove("game.js", [
  { label: "a shallow copy of the pack grows back (the boundary contract must see it before any test does)",
    find: "var sim=invSnapshot(c.inventory),node=", replace: "var sim=c.inventory.slice(),node=",
    mustFail: BOUNDARY }
]);
process.exit(code);
