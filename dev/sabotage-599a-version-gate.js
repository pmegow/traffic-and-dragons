// dev/sabotage-599a-version-gate.js — proves the #599 (a) version gate is guarded. Release (a) of the inventory-rows plan
// (DOC/DESIGN_599_inventory_rows.md §5.4, §12 row a): a world or a sheet stamped by a NEWER build than this one is refused
// at every door BEFORE any write, loudly; a newer cloud copy locks this device's pushes for that campaign until the newer
// build runs here. Each mutation runs in a disposable clone; a mutation that changes no bytes is a failure.
//   node dev/sabotage-599a-version-gate.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#599 (a)"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var RULE = "#599a the gate is pure and reads one rule", INFLATE = "#599a inflateWorldStateSnapshot refuses a newer world BEFORE touching it",
    CAMP = "#599a checkpointRestore refuses a camp whose nested world", DOORS = "#599a the library doors refuse a sheet from a newer build",
    STAMP = "#599a what this build writes is stamped", LOCK = "#599a the publication lock", PUSH = "#599a while the lock names the active campaign no push leaves this device",
    DOM = "#599a every DOM door gates before its first write",
    REVIEW_IMPORT = "#599a review R1", REVIEW_LOCKMAP = "#599a review R4", REVIEW_UPLOADS = "#599a review R3/R8", REVIEW_BOOT = "#599a review R2",
    REVIEW_EDGES = "#599a review R14/R13/R5", REVIEW_SOURCE = "#599a review R12/R5/R6/R10";
prove("helpers.js", [
  { label: "the rule reads 'at or above' — this build's own stamp refuses itself",
    find: "function versionNewer(v,mine){return typeof v===\"number\"&&v>mine;}", replace: "function versionNewer(v,mine){return typeof v===\"number\"&&v>=mine;}",
    mustFail: RULE },
  { label: "the rule reads 'two above' — the next build's save passes",
    find: "function versionNewer(v,mine){return typeof v===\"number\"&&v>mine;}", replace: "function versionNewer(v,mine){return typeof v===\"number\"&&v>mine+1;}",
    mustFail: RULE },
  { label: "Infinity passes as legacy again (review R14)",
    find: "function versionNewer(v,mine){return typeof v===\"number\"&&v>mine;}", replace: "function versionNewer(v,mine){return typeof v===\"number\"&&isFinite(v)&&v>mine;}",
    mustFail: REVIEW_EDGES },
  { label: "a companion's sheet stamp is not read by the world gate",
    find: "  for(i=0;i<ns.length;i++){s=sheetVersionIssue(ns[i]&&ns[i].charSheet);if(s)return s;}\n", replace: "",
    mustFail: RULE },
  { label: "the portable copy is not stamped",
    find: "  copy.sheetVer=SHEET_VER;/* #599 (a): every portable copy says which build wrote it, so an older build can refuse it */\n", replace: "",
    mustFail: STAMP },
  { label: "a sheet door refuses silently (no toast)",
    find: "if(typeof showToast===\"function\")showToast(\"⚠ \"+why+VERSION_RELOAD_HINT,9000);return true;}", replace: "return true;}",
    mustFail: DOORS },
]);
prove("state.js", [
  { label: "the world door does not gate (inflate accepts a newer world)",
    find: "  var _vi=worldVersionIssue(o);if(_vi){var _ve=new Error(_vi);_ve.incompatible=true;throw _ve;}\n", replace: "",
    mustFail: INFLATE },
  { label: "the world door gates AFTER the first write (keyedStores has already touched the object)",
    find: "  var _vi=worldVersionIssue(o);if(_vi){var _ve=new Error(_vi);_ve.incompatible=true;throw _ve;}\n  keyedStores(o,\"world\");", replace: "  keyedStores(o,\"world\");\n  var _vi=worldVersionIssue(o);if(_vi){var _ve=new Error(_vi);_ve.incompatible=true;throw _ve;}",
    mustFail: INFLATE },
  { label: "a refused local load leaves no reason for the boot (the wizard would open over the newer save)",
    find: "if(e&&e.incompatible){_versionRefusedLoad=e.message;", replace: "if(e&&e.incompatible){",
    mustFail: INFLATE },
  { label: "the lock answers for every campaign, not the one it names",
    find: "return m[campId]?{campId:campId,why:m[campId].why,at:m[campId].at}:null;}", replace: "var k;for(k in m)return {campId:campId,why:m[k].why,at:m[k].at};return null;}",
    mustFail: LOCK },
]);
prove("storage-adapter.js", [
  { label: "a locked campaign is still pushed",
    find: "    if (_vl) { console.warn(\"[version] sync paused — the cloud copy of \" + campId + \" was written by a newer app version (\" + _vl.why + \"); reload to update\"); _fin(\"sync paused — the cloud copy was written by a newer app version; reload to update\"); return; }\n", replace: "",
    mustFail: PUSH },
  { label: "the manual push ignores the lock (review R3)",
    find: "    if (_pvl) { var _pwhy =", replace: "    if (false) { var _pwhy =",
    mustFail: REVIEW_UPLOADS },
  { label: "the server camp slot ignores the lock (review R8)",
    find: "    if (typeof versionLockFor === \"function\" && versionLockFor(campId)) { console.warn(\"[version] server camp slot not written", replace: "    if (false) { console.warn(\"[version] server camp slot not written",
    mustFail: REVIEW_UPLOADS },
  { label: "the boot reconciles after a refused local load (review R2: the cloud copy adopts over the newer save)",
    find: "    if (!localOk && typeof versionRefusedLoad === \"function\" && versionRefusedLoad()) {", replace: "    if (false) {",
    mustFail: REVIEW_BOOT },
]);
/* the reconcile's own gate and lock-clear live in a path only the async sync suite drives */
var CMD_SYNC = ["node", ["dev/tests-audit-sync.js"]];
if (!code) code = sabotage.prove({ file: "storage-adapter.js", command: CMD_SYNC, cases: [
  { label: "the reconcile adopts a cloud world from a newer build",
    find: "      if (_vIssue) {\n        console.error(\"[version] reconcile REFUSED — \"", replace: "      if (false) {\n        console.error(\"[version] reconcile REFUSED — \"",
    mustFail: "a cloud world from a newer build is refused before any consumer" },
  { label: "a compatible cloud world leaves the lock in place",
    find: "      if (typeof versionLockClear === \"function\" && versionLockClear(_srvCampV))", replace: "      if (false)",
    mustFail: "a compatible cloud world clears the lock" },
] });
prove("state.js", [
  { label: "the .tnd import is not gated (review R1)",
    find: "  var _ivi=worldVersionIssue(ws);if(_ivi){console.error(\"[version] .tnd import REFUSED — \"+_ivi+\"; nothing changed\");throw new Error(_ivi+VERSION_RELOAD_HINT);}\n", replace: "",
    mustFail: REVIEW_IMPORT },
  { label: "the lock holds one campaign at a time again (review R4)",
    find: "function versionLockSet(campId,why){if(!campId)return;var m=_versionLocks();m[campId]={why:String(why||\"\"),at:Date.now()};_versionLocksWrite(m);}", replace: "function versionLockSet(campId,why){if(!campId)return;var m=keyedDict();m[campId]={why:String(why||\"\"),at:Date.now()};_versionLocksWrite(m);}",
    mustFail: REVIEW_LOCKMAP },
  { label: "a newer camp is held, refused only at the restore (review R13)",
    find: "  if(typeof snap.ws===\"string\"){var _hv=null;try{_hv=JSON.parse(snap.ws);}catch(e){_hv=null;}var _hvi=_hv?worldVersionIssue(_hv):\"\";if(_hvi)return {ok:false,reason:_hvi};}\n", replace: "",
    mustFail: REVIEW_EDGES },
]);
prove("game.js", [
  { label: "the library hero door does not gate",
    find: "  if(sheetVersionRefused(c,\"library hero\"))return null;/* #599 (a): before any write */\n", replace: "",
    mustFail: DOORS },
  { label: "startGame installs a pending companion from a newer build (review R5)",
    find: "if(sheetVersionRefused(comp,\"companion \"+comp.name))continue;", replace: "",
    mustFail: REVIEW_SOURCE },
  { label: "the library companion door does not gate",
    find: "  if(sheetVersionRefused(c,\"library companion \"+n.name))return null;/* #599 (a): before any write */\n", replace: "",
    mustFail: DOORS },
  { label: "the village import door does not gate",
    find: "    if(sheetVersionRefused(c,\"village resident \"+nm)){skipped.push(nm);continue;}/* #599 (a): a library copy from a newer build never enters */\n", replace: "",
    mustFail: DOORS },
  { label: "a new world is stamped with a literal that rots",
    find: "  worldState={ver:SAVE_VER,campId:getActiveCampId(),", replace: "  worldState={ver:10,campId:getActiveCampId(),",
    mustFail: STAMP },
]);
/* the DOM doors are pinned by a source contract (they are not in the engine manifest); each mutation removes one door's gate */
prove("ui-campaigns.js", [
  { label: "the manual pull writes the live keys without the gate",
    find: "  var _vi=worldVersionIssue(data.worldState);\n  if(_vi){console.error(\"[version] pull REFUSED — \"+_vi+\"; nothing changed, pushes for \"+id+\" are locked\");versionLockSet(id,_vi);showToast(\"⚠ \"+_vi+\" — nothing changed. Reload to update; uploads of this campaign are paused until then.\",9000);return false;}\n", replace: "",
    mustFail: DOM },
]);
prove("ui-boot.js", [
  { label: "the boot opens the wizard over a save it could not read",
    find: "    if(typeof versionRefusedLoad===\"function\"&&versionRefusedLoad()){showVersionRefusedScreen(versionRefusedLoad());return;}\n", replace: "",
    mustFail: DOM },
]);
prove("ui-browsers.js", [
  { label: "the import preview shows a sheet from a newer build",
    find: "  if(sheetVersionRefused(char,\"character import\")){if(onCancel)onCancel();return;}/* #599 (a): every import road funnels here — a sheet from a newer build never reaches a heal or a modal */\n", replace: "",
    mustFail: DOM },
  { label: "the .char import discards the envelope before reading its version",
    find: "      var _fv=charFileVersionIssue(data);if(_fv){console.error(\"[version] character import refused — \"+_fv);showToast(\"⚠ \"+_fv+VERSION_RELOAD_HINT,9000);return;}/* #599 (a): the file's envelope AND its sheet, before the envelope is discarded */\n", replace: "",
    mustFail: DOM },
]);
process.exit(code);
