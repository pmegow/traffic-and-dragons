// dev/sabotage-481-f9-deleted-elsewhere.js — proves the #481 F9 guards are guarded: a campaign the server once held and no
// longer does is never quietly re-uploaded — the device asks (from the reconcile's 404 and from the list sync alike), the
// question persists across a reload, pushes of that campaign pause until the answer, Keep re-uploads, Remove clears it from
// this device; and a reconcile answer that lands after a campaign switch is ignored as stale, never blamed on the server.
// Each mutation runs in a disposable clone.
//   node dev/sabotage-481-f9-deleted-elsewhere.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/tests-481-f9-deleted-elsewhere.js"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("storage-adapter.js", [
  { label: "a 404 for a campaign the server once held reads as 'first push pending' again",
    find: "        var _gone = _campOnceOnServer(_rcId);", replace: "        var _gone = null;",
    mustFail: "the repro" },
  { label: "the pending question does not pause the push",
    find: "    if (_de && campId && _de.id === campId) {", replace: "    if (false) {",
    mustFail: "the repro" },
  { label: "the question does not survive the list sync's prune (a reload forgets it)",
    find: "    var p = _delElsewhere(); if (p && p.id === id) return p;\n", replace: "",
    mustFail: "the question and the pause survive a reload" },
  { label: "Keep leaves the question pending (the campaign never uploads again)",
    find: "    var p = _delElsewhere(); if (!p || p.id !== id) return false;\n    _delElsewhereSet(null);", replace: "    var p = _delElsewhere(); if (!p || p.id !== id) return false;",
    mustFail: "Keep re-uploads it" },
  { label: "the list road prunes the campaign on screen without asking",
    find: "      if (_was && !merged.some(function (m) { return m && m.id === _act; }) && !_delElsewhere()) {", replace: "      if (false) {",
    mustFail: "the list road" },
  { label: "a stale answer after a campaign switch is blamed on the server",
    find: "      if (_rcId && _nowActive && _nowActive !== _rcId) {", replace: "      if (false) {",
    mustFail: "an answer that lands after the device switched campaigns" }
]);
prove("state.js", [
  { label: "the removal leaves the campaign active",
    find: "  forgetCampaignSyncMarkers(id);\n  setActiveCampId(null);\n", replace: "  forgetCampaignSyncMarkers(id);\n",
    mustFail: "Remove clears it from this device" }
]);
prove("ui-campaigns.js", [
  { label: "the question can be dismissed (not a forced choice)",
    find: "    {maxWidth:460,wireClose:false});\n  document.getElementById(\"de-keep\")", replace: "    {maxWidth:460,wireClose:true});\n  document.getElementById(\"de-keep\")",
    mustFail: "the question itself" },
  { label: "Remove leaves the question pending",
    find: "    m.remove();storageAdapter.resolveDeletedElsewhere(id,false);", replace: "    m.remove();",
    mustFail: "the question itself" }
]);
process.exit(code);
