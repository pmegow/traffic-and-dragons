// dev/sabotage-599b5-review.js — proves the closures of the independent review of #599 release (b) are guarded
// (audits/REVIEW_599_release_b_2026_10_09.md): the typed-prose clamp exemption, the first-want rule, the stash gate, the
// live-shelf splice, the trimming grammar, the once-said junk, the doors installing the healed copy, the admitted library
// update / legacy pick / companion pick / quick start, the host pairing, and the comment scanner's own proof.
//   node dev/sabotage-599b5-review.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#599 (b5)"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var R1 = "#599b5 review 1", R4 = "#599b5 review 4", R13 = "#599b5 review 13", R10 = "#599b5 review 10", R6 = "#599b5 review 6", R11 = "#599b5 review 11/12",
    R12 = "#599b5 review 12", R7 = "#599b5 review 7", BOUNDARY = "INVENTORY BOUNDARY CONTRACT", ADMISSION = "ADMISSION CONTRACT", STRIP = "STRIP COMMENTS SELF-TEST";
prove("admission.js", [
  { label: "the clamp ignores typed prose again (the wizard's backstory is cut)",
    find: "applies:function(ctx){return ctx.mode!==\"same\"&&!ctx.typed;},", replace: "applies:function(ctx){return ctx.mode!==\"same\";},",
    mustFail: R1 },
  { label: "the stash gate rethrows a corrupted mark (a village import aborts mid-list)",
    find: "run:function(sheet,ctx){try{ctx.stashMark=stashCopyMark(ctx.source);return \"\";}catch(e){ctx.stashMark=null;return (sheet.name||\"the copy\")+\"'s stash history is unreadable (\"+((e&&e.message)||e)+\") — refused\";}},",
    replace: "run:function(sheet,ctx){ctx.stashMark=stashCopyMark(ctx.source);return \"\";},",
    mustFail: R13 },
]);
prove("game.js", [
  { label: "the new-game hero is no longer typed (the clamp applies)",
    find: "sheetAdmit(char,{door:\"new game hero\",mode:\"cross\",detach:false,rel:null,typed:true});", replace: "sheetAdmit(char,{door:\"new game hero\",mode:\"cross\",detach:false,rel:null});",
    mustFail: R1 },
  { label: "the bought ware is spliced among ALL wares again (an expired twin takes the live row's place)",
    find: "var wi,_lw=(typeof nodeWaresLive===\"function\")?nodeWaresLive(node):(node.wares||[]);for(wi=0;wi<_lw.length;wi++)if(itemKey(_lw[wi].item)===itemKey(l.name)){var _wx=node.wares.indexOf(_lw[wi]);if(_wx>=0)node.wares.splice(_wx,1);break;}}",
    replace: "var wi;for(wi=0;wi<(node.wares||[]).length;wi++)if(itemKey(node.wares[wi].item)===itemKey(l.name)){node.wares.splice(wi,1);break;}}",
    mustFail: R10 },
  { label: "the hero door installs the library object itself",
    find: "  var hero=_ad.sheet,_stashMark=_ctx.stashMark;", replace: "  var hero=c,_stashMark=_ctx.stashMark;",
    mustFail: R12 },
  { label: "the village door installs the library object itself",
    find: "    var sheet=_ad.sheet,pr=pronounsForGender(sheet.gender);", replace: "    var sheet=c,pr=pronounsForGender(sheet.gender);",
    mustFail: R12 },
  { label: "the legacy pick builds pendingLegacy from the raw library sheet again",
    find: "  if(!_ad.ok)return;pick=_ad.sheet;", replace: "  if(!_ad.ok)return;",
    mustFail: R7 },
]);
prove("helpers.js", [
  { label: "the counter's want map is last-wins again (one want paid, another retired)",
    find: "if(!wanted[_wk])wanted[_wk]=wl[i];}", replace: "wanted[_wk]=wl[i];}",
    mustFail: R4 },
  { label: "the library update copies fields from the raw library sheet again",
    find: "  var d=libUpdateDiff(cur,_src),i,row;", replace: "  var d=libUpdateDiff(cur,lib),i,row;",
    mustFail: R7 },
]);
prove("inventory.js", [
  { label: "the stored grammar stops trimming ('Torch x3 ' is one item)",
    find: "function invStoredParse(s){var str=String(s==null?\"\":s).trim(),", replace: "function invStoredParse(s){var str=String(s==null?\"\":s),",
    mustFail: R6 },
  { label: "junk is said on every call again",
    find: "if(!invEntries._said[sig]){invEntries._said[sig]=1;", replace: "if(true){",
    mustFail: R11 },
  { label: "a null entry prints as the word null",
    find: "out.push(typeof e===\"string\"?e:(e==null?\"\":(typeof e===\"object\"&&typeof e.name===\"string\"?invText(e):String(e))));", replace: "out.push(typeof e===\"string\"?e:(typeof e===\"object\"&&e&&typeof e.name===\"string\"?invText(e):String(e)));",
    mustFail: R11 },
  { label: "the extras bag is a plain object again (an own __proto__ field becomes the prototype)",
    find: "function invExtras(row){var o=keyedDict(),k;", replace: "function invExtras(row){var o={},k;",
    mustFail: R11 },
]);
prove("ui-browsers.js", [
  { label: "quick start consumes the handoff before the registry can refuse it",
    find: "  if(!sheetAdmit(char,{door:\"quick start\",mode:\"cross\",detach:false,stage:\"preview\",rel:\"@import:\"+(char.name||\"character\"),portable:true}).ok)return false;\n",
    replace: "",
    mustFail: ADMISSION },
  { label: "the companion pick queues a copy without admitting it",
    find: "  if(!sheetAdmit(char,{door:\"companion pick\",mode:\"cross\",detach:false,stage:\"preview\",rel:\"@import:\"+(char.name||\"character\"),portable:true}).ok)return;\n",
    replace: "",
    mustFail: R7 },
]);
prove("ui-shell.js", [
  { label: "a legacy entry reader planted in an engine file",
    find: "function showToast(", replace: "function _p599b5(c){return invStoredName(c.inventory.slice()[0]);}\nfunction showToast(",
    mustFail: BOUNDARY },
]);
prove("bible_editor.html", [
  { label: "the bible editor loads helpers.js without inventory.js again (item editing throws)",
    find: "\"helpers.js\",\"inventory.js\",\"class_bible.js\"", replace: "\"helpers.js\",\"class_bible.js\"",
    mustFail: BOUNDARY },
]);
prove("dev/bible-server.js", [
  { label: "the bible server stops serving inventory.js",
    find: "  \"/inventory.js\": \"inventory.js\",", replace: "",
    mustFail: BOUNDARY },
]);
prove("dev/run-tests.js", [
  { label: "an EXEMPT row names a step with no live site",
    find: "{ file: \"helpers.js\", fn: \"portraitsSanitizeWorld\", step: \"portraitAdmit(\",", replace: "{ file: \"helpers.js\", fn: \"portraitsSanitizeWorld\", step: \"voicePinsFill(\",",
    mustFail: ADMISSION },
  { label: "the comment scanner strips line comments first again (adjacent block comments swallow the code after them)",
    find: "  var src = String(text), out = \"\", i = 0, n = src.length, c, q, p, d, cls, e2, seg;", replace: "  var src = String(text).replace(/\\/\\/[^\\n]*/g, \"\"), out = \"\", i = 0, n = src.length, c, q, p, d, cls, e2, seg;",
    mustFail: STRIP },
]);
process.exit(code);
