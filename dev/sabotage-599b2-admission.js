// dev/sabotage-599b2-admission.js — proves the #599 (b2) sheet admission registry is guarded: the gates judge the SOURCE
// and stop everything, prepare heals a detached copy, the context (mode, stage, prev) decides what runs, the writes come
// last — and the ADMISSION CONTRACT (run-tests.js) refuses a hand-run step at any door, a door without sheetAdmit, an
// admission after a write, a planted step or a planted install sink in a file nobody listed (the door census is DERIVED
// from every `.charSheet=` / `worldState.character=` / wrapper-literal sink), and an internal-transfer row that names no
// site. Each mutation runs in a disposable clone.
//   node dev/sabotage-599b2-admission.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#599 (b2)"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var SHAPE = "#599b2 the registry's shape", GATE = "#599b2 a refused gate stops everything", DETACH = "#599b2 prepare heals a DETACHED copy",
    CONTEXT = "#599b2 the context decides what runs", DOORS = "#599b2 the doors run the registry", CONTRACT = "ADMISSION CONTRACT";
prove("admission.js", [
  { label: "the version gate judges nothing",
    find: "   run:function(sheet){return sheetVersionIssue(sheet);},", replace: "   run:function(sheet){return \"\";},",
    mustFail: GATE },
  { label: "the version refusal is silent (no toast)",
    find: "if(ctx.toast!==false&&typeof showToast===\"function\")showToast(\"⚠ \"+why+VERSION_RELOAD_HINT,9000);}},", replace: "}},",
    mustFail: GATE },
  { label: "the identity gate never applies",
    find: "  {name:\"identity\",phase:\"gate\",applies:function(ctx){return ctx.exclude!==undefined;},", replace: "  {name:\"identity\",phase:\"gate\",applies:function(ctx){return false;},",
    mustFail: GATE },
  { label: "prepare heals the SOURCE (no detached copy)",
    find: "  cand=(ctx.detach===false)?source:JSON.parse(JSON.stringify(source));", replace: "  cand=source;",
    mustFail: DETACH },
  { label: "the scene cross runs on this campaign's own data too",
    find: "  {name:\"scene\",phase:\"prepare\",applies:function(ctx){return ctx.mode!==\"same\";},", replace: "  {name:\"scene\",phase:\"prepare\",applies:function(ctx){return true;},",
    mustFail: CONTEXT },
  { label: "a preview publishes the item canon",
    find: "applies:function(ctx){return ctx.mode!==\"same\"&&ctx.stage!==\"preview\";},", replace: "applies:function(ctx){return ctx.mode!==\"same\";},",
    mustFail: CONTEXT },
  { label: "the voice pins are not carried from the replaced sheet",
    find: "  {name:\"voices\",phase:\"publish\",applies:function(ctx){return !!ctx.prev;},", replace: "  {name:\"voices\",phase:\"publish\",applies:function(ctx){return false;},",
    mustFail: CONTEXT },
  { label: "the stash mark is never read from the copy",
    find: "  {name:\"stash\",phase:\"prepare\",applies:function(ctx){return ctx.mode!==\"same\";},", replace: "  {name:\"stash\",phase:\"prepare\",applies:function(ctx){return false;},",
    mustFail: CONTEXT },
  { label: "the item canon is published as a prepare (before the voices, but the shape test reads phases)",
    find: "  {name:\"itemDefs\",phase:\"publish\",", replace: "  {name:\"itemDefs\",phase:\"prepare\",",
    mustFail: SHAPE },
]);
prove("game.js", [
  { label: "a door hand-runs a step beside the registry",
    find: "  var sheet=_ad.sheet,_stashMark=_ctx.stashMark;\n  sheet.portraitOffset=sheet.portraitOffset||(n.charSheet&&n.charSheet.portraitOffset)||n.portraitOffset||null;",
    replace: "  var sheet=_ad.sheet,_stashMark=_ctx.stashMark;adoptSheetItemDefs(sheet);\n  sheet.portraitOffset=sheet.portraitOffset||(n.charSheet&&n.charSheet.portraitOffset)||n.portraitOffset||null;",
    mustFail: CONTRACT },
  { label: "a door drops the registry for its own copy (the derived census sees an install without sheetAdmit)",
    find: "_ad=sheetAdmit(c,_ctx);\n  if(!_ad.ok)return null;\n  var sheet=_ad.sheet,_stashMark=_ctx.stashMark;", replace: "_ad={ok:true,sheet:JSON.parse(JSON.stringify(c))};\n  if(!_ad.ok)return null;\n  var sheet=_ad.sheet,_stashMark=_ctx.stashMark;",
    mustFail: CONTRACT },
  { label: "a door admits but installs its own copy (the contract sees an admission; the outcome test sees the pins and canon missing)",
    find: "  var sheet=_ad.sheet,_stashMark=_ctx.stashMark;", replace: "  var sheet=JSON.parse(JSON.stringify(c)),_stashMark=_ctx.stashMark;",
    mustFail: DOORS },
]);
prove("ui-browsers.js", [
  { label: "a door admits AFTER its first write",
    find: "  var _ad=sheetAdmit(char,{door:\"companion import\",", replace: "  worldState.npcs.push(null);var _ad=sheetAdmit(char,{door:\"companion import\",",
    mustFail: CONTRACT },
]);
prove("ui-shell.js", [
  { label: "a hand-run step planted in a file nobody listed",
    find: "function showToast(", replace: "function _plant599(s){portraitAdmit(s,\"planted\");}\nfunction showToast(",
    mustFail: CONTRACT },
  { label: "an install sink planted in a file nobody listed (a .charSheet= assignment without sheetAdmit)",
    find: "function showToast(", replace: "function _plant599b(n,s){n.charSheet=s;}\nfunction showToast(",
    mustFail: CONTRACT },
  { label: "a wrapper carrying a sheet built into a variable and pushed later (the alias bypass)",
    find: "function showToast(", replace: "function _plant599c(s){var w={name:s.name,charSheet:s};worldState.npcs.push(w);}\nfunction showToast(",
    mustFail: CONTRACT },
]);
prove("ui-sheets.js", [
  { label: "an async door loses its admission (the census must attribute the sink to the async function, not its neighbour)",
    find: "    var _ad=sheetAdmit(sheet,{door:\"generated sheet \"+wsNpc.name,mode:\"same\",detach:false,rel:wsNpc.name});", replace: "    var _ad={ok:true};keyedStores(sheet,\"sheet\");",
    mustFail: CONTRACT },
]);
prove("dev/run-tests.js", [
  { label: "the step census stops seeing a real site (an exemption row removed must be noticed)",
    find: "    { file: \"game.js\", fn: \"applyBlueprint\", why: \"a blueprint's NPC seed is a roster entry with no sheet; the identity gate alone applies\" },\n", replace: "",
    mustFail: CONTRACT },
  { label: "the door census stops seeing an internal transfer (its row removed, the swap becomes a door without sheetAdmit)",
    find: "    { file: \"game.js\", fn: \"swapPlayerCharacter\", why: \"the hero swap — a companion's sheet already live in this campaign takes the hero's seat; the owners swap through relationshipSwapOwners\" },\n", replace: "",
    mustFail: CONTRACT },
  { label: "an internal-transfer row that names no site any more",
    find: "    { file: \"ui-carmode.js\", fn: \"_carUpdateParty\",", replace: "    { file: \"ui-carmode.js\", fn: \"_carUpdatePartyGone\",",
    mustFail: CONTRACT },
]);
process.exit(code);
