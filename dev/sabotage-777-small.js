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

// ── batch 2 (2026-11-20): C9, C10, C12, C16 ────────────────────────────────────────────────────────────────────────
var T2 = { C10: "C10: the item-section store is bounded", C12: "C12: the coin scan stays fast on a long run of number words",
  PAINT: "C16: the painter is never told the hero is", COPY: "C16: a blueprint is applied from a copy", DEATH: "C16: the prompt of Death's arrival says Death has just arrived" };
prove("item-kinds.js", [
  { label: "C10: the store is never trimmed",
    find: "  keys=Object.keys(store);over=keys.length-ITEM_KIND_STORE_CAP;if(over<=0)return 0;", replace: "  return 0;", mustFail: ONLY + T2.C10 },
  { label: "C10: the record of a carried thing is let go",
    find: "cand=keys.filter(function(k){return !carried[k];})", replace: "cand=keys.filter(function(k){return true;})", mustFail: ONLY + T2.C10 },
  { label: "C10: the newest records are let go first",
    find: "return (((store[a]&&store[a].turn)||0)-((store[b]&&store[b].turn)||0))||", replace: "return (((store[b]&&store[b].turn)||0)-((store[a]&&store[a].turn)||0))||", mustFail: ONLY + T2.C10 },
  { label: "C10: letting records go is not said",
    find: "  if(dropped&&typeof console!==\"undefined\")console.warn(\"[items] #776 \"+dropped+\" item-section record\"+(dropped===1?\"\":\"s\")+\" of things nobody carries", replace: "  if(false)console.warn(\"[items] #776 \"+dropped+\" item-section record\"+(dropped===1?\"\":\"s\")+\" of things nobody carries", mustFail: ONLY + T2.C10 },
  { label: "C10: the load does not hold the store at its bound",
    find: "  dropped+=itemKindsTrim(ws);/* C10: the load holds the store at its bound", replace: "  /* C10: the load holds the store at its bound", mustFail: ONLY + T2.C10 },
  { label: "C10: the load does not report what it let go",
    find: "  dropped+=itemKindsTrim(ws);/* C10:", replace: "  itemKindsTrim(ws);/* C10:", mustFail: ONLY + T2.C10 },
  { label: "C10: a turn that files answers never trims",
    find: "    itemKindsTrim(ws);/* C10 */\n", replace: "", mustFail: ONLY + T2.C10 }
]);
prove("helpers.js", [
  { label: "C12: a long reply is scanned in part (amounts from its head against tags from all of it)",
    find: "return {amounts:[],text:\"\",cut:true};}", replace: "clean=clean.slice(0,COIN_NARRATION_SCAN_MAX);}", mustFail: ONLY + T2.C12 },
  { label: "C12: the scan is unbounded again",
    find: "return {amounts:[],text:\"\",cut:true};}", replace: "}", mustFail: ONLY + T2.C12 },
  { label: "C12: a reply cut for the scan is not said",
    find: "if(typeof console!==\"undefined\")console.info(\"[coin] the reply is \"", replace: "if(false)console.info(\"[coin] the reply is \"", mustFail: ONLY + T2.C12 }
]);
prove("game.js", [
  { label: "C16: a hero with no age is \"undefined\" to the painter",
    find: "+(c.age?\" \"+c.age:\"\")+", replace: "+\" \"+c.age+", mustFail: ONLY + T2.PAINT },
  { label: "C16: a hero with no look is \"undefined\" to the painter",
    find: "+(c.appear?\", \"+c.appear:\"\")", replace: "+\", \"+c.appear", mustFail: ONLY + T2.PAINT },
  { label: "C16: statuses are stamped into the file's own acts",
    find: "acts:JSON.parse(JSON.stringify(bp.acts))}", replace: "acts:bp.acts}", mustFail: ONLY + T2.COPY },
  { label: "C16: the campaign shares the file's creature list",
    find: "worldState.bestiary=JSON.parse(JSON.stringify(bp.creatures));", replace: "worldState.bestiary=bp.creatures;", mustFail: ONLY + T2.COPY }
]);
prove("game.js", [
  { label: "C16: a reload past the question re-sends Death's arrival",
    find: "  if(ds.stage!==\"arrive\"&&ds.stage!==\"question\"){delete ds.arrivalOwed;return;}", replace: "  ", mustFail: ONLY + T2.DEATH },
  { label: "C16: a stale arrival stays owed",
    find: "{delete ds.arrivalOwed;return;}/* audit 2026-11-19, C16 (its review)", replace: "{return;}/* audit 2026-11-19, C16 (its review)", mustFail: ONLY + T2.DEATH }
]);
prove("api.js", [
  { label: "C16: the arrival's own prompt lacks its arrival line",
    find: "(ds.stage===\"arrive\"||(ds.arrivalOwed&&ds.stage===\"question\")/*", replace: "(ds.stage===\"arrive\"/*", mustFail: ONLY + T2.DEATH },
  { label: "C16: the arrival line rides every prompt while the arrival is owed",
    find: "(ds.stage===\"arrive\"||(ds.arrivalOwed&&ds.stage===\"question\")/*", replace: "(ds.stage===\"arrive\"||(ds.arrivalOwed)/*", mustFail: ONLY + T2.DEATH }
]);
/* C9 lives in the engine suite (it needs the #504 fixtures): run-tests names SECTIONS, the clause names the test */
failed += sabotage.prove({ file: "identity.js", command: ["node", ["dev/run-tests.js", "#504 fixes"]], cases: [
  { label: "C9: the name-path death gate compares a stored negative by raw string",
    find: "if(_sceneRefEntitySame(ng[k].entity,canon)&&ng[k].mode===\"explicit\"&&!ng[k].resolved)return null;}", replace: "if(ng[k].entity===canon&&ng[k].mode===\"explicit\"&&!ng[k].resolved)return null;}", mustFail: "#777 C9 the name-path death gate reads a stored scene negative through the exact resolver" }
] });

if (!chrome.path && !failed) { verdict.reportSkip("sabotage-777-small.js", browserClauses, chrome.why); process.exit(verdict.SKIP_EXIT); }
process.exit(failed ? 1 : 0);
