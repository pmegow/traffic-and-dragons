// dev/sabotage-81b-item-canon-travels.js — proves the #81b clauses are guarded: the portable sheet carries the carried items'
// canon, adoption merges missing keys only, and every export/import site is wired. Disposable clone per mutation.
//   node dev/sabotage-81b-item-canon-travels.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "#81b item canon"]], cases: cases, also: ["ui-browsers.js"] }); }
prove("helpers.js", [
  { label: "the portable sheet carries no canon",
    find: 'if(any)copy.itemDefs=JSON.parse(JSON.stringify(defs));else delete copy.itemDefs;', replace: 'delete copy.itemDefs;',
    mustFail: "#81b portableSheet attaches" },
  { label: "adoption overwrites the destination's canon",
    find: 'if(worldState.itemBible[k])continue;/* the destination\'s canon wins — write-once */', replace: '',
    mustFail: "#81b adoptSheetItemDefs merges" },
  { label: "uncarried items travel too",
    find: 'var inv=sheet.inventory||[],i;for(i=0;i<inv.length;i++){var key=itemBaseName(inv[i]);', replace: 'var inv=Object.keys(ovs),i;for(i=0;i<inv.length;i++){var key=itemBaseName(inv[i]);',
    mustFail: "#81b portableSheet attaches" }
]);
prove("game.js", [
  { label: "a resident moves in without their canon",
    find: 'if(typeof adoptSheetItemDefs==="function")adoptSheetItemDefs(sheet);/* #81b: the resident\'s gear keeps its canon */', replace: '',
    mustFail: "#81b every export and every import is wired" }
  /* "the write-back sends the raw sheet" retired with villageWriteBack (#427, 2026-09-21) — the two manual library-save
     branches below are the only senders left and keep their own portable-copy clause. */
]);
prove("ui-browsers.js", [
  { label: "the .char export drops the canon",
    find: 'character:portableSheet(sheet)},null,2);', replace: 'character:sheet},null,2);',
    mustFail: "#81b every export and every import is wired" }
]);
process.exit(code);
