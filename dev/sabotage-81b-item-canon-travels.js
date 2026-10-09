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
    find: 'var _ie=invEntries(sheet.inventory||[]),i;', replace: 'var _ie=invEntries(Object.keys(ovs)),i;',/* #599 (b4): the reader goes through invEntries — every bible key "travels" */
    mustFail: "#81b portableSheet attaches" }
]);
prove("game.js", [
  { label: "a resident moves in without their canon",
    /* #599 (b): the canon is the registry's itemDefs publish — a door that calls itself a preview never publishes */
    find: '{door:"village resident "+nm,mode:"cross",name:nm,', replace: '{door:"village resident "+nm,mode:"cross",stage:"preview",name:nm,',
    mustFail: "#81b every export and every import is wired" }
  /* "the write-back sends the raw sheet" retired with villageWriteBack (#427, 2026-09-21) — the two manual library-save
     branches below are the only senders left and keep their own portable-copy clause. */
]);
prove("ui-browsers.js", [
  { label: "the .char export drops the canon (since #599 (a) the CHARACTER EDITOR CONTRACT pins the wrapper's portableSheet first — the #81b source pin stands behind it)",
    find: 'character:portableSheet(sheet)},null,2);', replace: 'character:sheet},null,2);',
    mustFail: "CHARACTER EDITOR CONTRACT" }
]);
process.exit(code);
