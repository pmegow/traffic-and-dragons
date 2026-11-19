// sabotage-777-small.js — retained proof for audit 2026-11-19 (TODO #777), the small reproduced rows of sections C and D.
//   helpers.js   C11 the mood allow-list and the age labels answer for their own words only
//   inventory.js C7 a row's unknown field is defined, never assigned · identity.js   C8 no merge into a place's own child
//   blueprint-designer.html   D4 a patch's section is a table's own key · D1 a file is judged before it becomes the working copy
// Engine clauses run ONE named case of dev/tests-777-small.js; the D1 clauses run the designer in headless Chrome (skipped out loud without it).
var sabotage = require("./sabotage.js"), verdict = require("./battery-verdict.js");
var chrome = require("./cdp-browser.js").locateChrome();
var SMALL = ["node", ["dev/tests-777-small.js"]], ONLY = "FAIL #777 ", DESIGNER = ["node", ["dev/tests-777-designer-browser.js"]];
var failed = 0, browserClauses = 0;
function prove(file, cases) { failed += sabotage.prove({ file: file, command: SMALL, only: ONLY, cases: cases }); }
function designer(cases) { browserClauses += cases.length; failed += sabotage.prove({ file: "blueprint-designer.html", command: DESIGNER, cases: cases, skip: !chrome.path }); }

prove("helpers.js", [
  { label: "C11: the mood allow-list answers for inherited names",
    find: "var o=Object.create(null);/* audit 2026-11-19, C11", replace: "var o={};/* audit 2026-11-19, C11", mustFail: "FAIL #777 C11: a lookup table answers only for its own words" },
  { label: "C11: an age label can be an inherited function",
    find: "(Object.prototype.hasOwnProperty.call(VOICE_AGES,s)?VOICE_AGES[s]:\"\")||", replace: "VOICE_AGES[s]||", mustFail: "FAIL #777 C11: a lookup table answers only for its own words" }
]);
prove("inventory.js", [
  { label: "C7: a row's unknown field is assigned by name (a __proto__ field replaces the prototype)",
    find: "function invOwnSet(row,k,v){Object.defineProperty(row,k,{value:v,enumerable:true,writable:true,configurable:true});}", replace: "function invOwnSet(row,k,v){row[k]=v;}", mustFail: "FAIL #777 C7: a row field named __proto__ rides a move like any other field" }
]);
prove("identity.js", [
  { label: "C8: a place is merged into its own child",
    find: "  while(_mw&&_mg++<12){if(_mw===duplicate){", replace: "  while(_mw&&_mg++<12){if(false){", mustFail: "FAIL #777 C8: a place cannot be merged into its own child" }
]);
prove("blueprint-designer.html", [
  { label: "D4: an inherited name is a by-name section",
    find: "    if(_patchOwn(_PATCH_BYNAME,sec)){\n", replace: "    if(_PATCH_BYNAME[sec]){\n", mustFail: "FAIL #777 D4: the designer's review merge knows only its own section names" },
  { label: "D4: an inherited name is a top-level field",
    find: "    }else if(_patchOwn(_PATCH_TOP,sec)){", replace: "    }else if(_PATCH_TOP[sec]){", mustFail: "FAIL #777 D4: the designer's review merge knows only its own section names" }
]);
designer([
  { label: "D1: a file's unreadable entries reach the working copy",
    find: "var src=JSON.parse(JSON.stringify(obj)),_dropped=designerDropNonEntries(src);", replace: "var src=JSON.parse(JSON.stringify(obj)),_dropped=0;", mustFail: "FAIL #777 designer browser D1: a blueprint with unreadable entries opens without them" },
  { label: "D1: a file that is no blueprint is not refused before anything is read",
    find: "  if(!obj||typeof obj!==\"object\"||Array.isArray(obj))throw new Error(\"not a blueprint\");\n", replace: "", mustFail: "FAIL #777 designer browser D1: a blueprint with unreadable entries opens without them" }
]);

if (!chrome.path && !failed) { verdict.reportSkip("sabotage-777-small.js", browserClauses, chrome.why); process.exit(verdict.SKIP_EXIT); }
process.exit(failed ? 1 : 0);
