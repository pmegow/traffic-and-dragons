// dev/sabotage-607-jewelry.js — proves #607 is guarded: the registry entry, and that every copy of the category vocabulary
// (the ITEM_DEF parse and doc line, the define prompt, the bible editor's dropdown and sort order, the bible's filing) DERIVES
// from the one registry rather than restating it.
//   node dev/sabotage-607-jewelry.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#607"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var PARSE = "#607 the ITEM_DEF parse", ONE = "#607 the vocabulary has ONE source", CENSUS = "#607 the bible census";
/* The registry mutations are caught by the BIBLE EDITOR CONTRACT in run-tests.js BEFORE any engine test runs: the serializer
   derives its header and its membership order from the registry the contract extracts out of helpers.js, so item_bible.js on
   disk (the serializer's own output, with jewelry in the header and filed first) no longer re-serializes byte-identical.
   That is the guard the clause claims — the file IS the registry's projection. */
var SER = "BIBLE EDITOR CONTRACT: serialize(on-disk data) !== on-disk item_bible.js";
prove("helpers.js", [
  { label: "the jewelry entry leaves the registry (the bible on disk no longer re-serializes — its header and filing name jewelry)",
    find: "  {id:\"jewelry\",    label:\"Jewelry\"},/* #607 (owner ask 2026-10-09): rings, amulets, bracelets, signets — their own section, after Armor */\n", replace: "",
    mustFail: SER },
  { label: "jewelry files after quest instead of after armor (the serialized header and membership order move)",
    find: "  {id:\"jewelry\",    label:\"Jewelry\"},/* #607 (owner ask 2026-10-09): rings, amulets, bracelets, signets — their own section, after Armor */\n  {id:\"quest\",      label:\"Quest\"},",
    replace: "  {id:\"quest\",      label:\"Quest\"},\n  {id:\"jewelry\",    label:\"Jewelry\"},",
    mustFail: SER }
]);
prove("tag_table.js", [
  { label: "the ITEM_DEF parse goes back to a hand list that does not know jewelry",
    find: "var ID_CATS={},_idci,_idcs=invCategoryIds();for(_idci=0;_idci<_idcs.length;_idci++)ID_CATS[_idcs[_idci]]=1;", replace: "var ID_CATS={weapon:1,armor:1,consumable:1,tool:1,quest:1,treasure:1,mundane:1};",
    mustFail: PARSE },
  { label: "the STATE TAGS line goes back to a hand list",
    find: "category is one of \"+invCategoryIds().join(\"/\")+\"; '=' per field", replace: "category is one of weapon/armor/consumable/tool/quest/treasure/mundane; '=' per field",
    mustFail: ONE }
]);
prove("api.js", [
  { label: "the define prompt goes back to a hand list",
    find: "(categories: \"+invCategoryIds().join(\"/\")+\"); the PLAYER confirms it", replace: "(categories: weapon/armor/consumable/tool/quest/treasure/mundane); the PLAYER confirms it",
    mustFail: ONE }
]);
prove("bible_editor.html", [
  { label: "the editor's dropdown goes back to a hand list",
    find: "  var ITEM_CATEGORIES = invCategoryIds(); // #607: derived from the ONE registry (helpers.js)", replace: "  var ITEM_CATEGORIES = [\"weapon\", \"armor\", \"consumable\", \"tool\", \"quest\", \"treasure\", \"mundane\"];",
    mustFail: ONE },
  { label: "the serializer's sort order goes back to a hand list (jewelry falls out of every membership — the bible on disk no longer re-serializes)",
    find: "  var _ord = invCategoryIds(); // #607: the registry order, derived (helpers.js) — never a hand copy", replace: "  var _ord = [\"weapon\", \"armor\", \"quest\", \"consumable\", \"tool\", \"treasure\", \"mundane\"];",
    mustFail: SER }
]);
prove("item_bible.js", [
  { label: "a ring is filed back under treasure first",
    find: "  \"brass ring\": {\n    \"category\": \"jewelry\",", replace: "  \"brass ring\": {\n    \"category\": \"treasure\",",
    mustFail: CENSUS }
]);
process.exit(code);
