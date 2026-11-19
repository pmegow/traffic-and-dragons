// sabotage-777-sync.js — retained proof for audit 2026-11-19 (TODO #777), section S: cloud sync and saves.
//   S1  a sync answer belongs to the campaign that was posted (storage-adapter.js _syncNow)
//   S2  the cloud ahead while a turn is in flight is a pause, never a sync base (_reconcileFromServer)
// Each clause runs ONE named case of dev/tests-777-sync.js (the suite's own --only).
var sabotage = require("./sabotage.js");
var SYNC = ["node", ["dev/tests-777-sync.js"]], ONLY = "FAIL #777 ";
var failed = 0;
function sync(file, cases) { failed += sabotage.prove({ file: file, command: SYNC, only: ONLY, cases: cases }); }

var GUARD = "      if (_left()) {   /* S1: the campaign that was posted is no longer the one open";
var NOGUARD = "      if (false) {   /* S1: the campaign that was posted is no longer the one open";
var S1_200 = "FAIL #777 S1: campaign A's 200 landing after the switch to B leaves B's sync base alone";
sync("storage-adapter.js", [
  { label: "S1: the old campaign's 200 raises the new campaign's sync base again",
    find: GUARD, replace: NOGUARD, mustFail: S1_200 },
  { label: "S1: the old campaign's self-healing 409 acks and re-posts for the new campaign",
    find: GUARD, replace: NOGUARD, mustFail: "FAIL #777 S1: campaign A's self-healing 409 (server turn below A's)" },
  { label: "S1: the old campaign's 403 re-homes the new campaign",
    find: GUARD, replace: NOGUARD, mustFail: "FAIL #777 S1: campaign A's 403 foreign_campaign landing after the switch" },
  { label: "S1: no answer is ever taken as another campaign's (the identity test is gone)",
    find: "return !!campId && !!_now && _now !== campId; }", replace: "return false; }",
    mustFail: "FAIL #777 S1: campaign A's 409 landing after the switch does not pause B's sync" },
  { label: "S1: the identity test is inverted (a campaign's own answer is dropped)",
    find: "return !!campId && !!_now && _now !== campId; }", replace: "return !!campId && !!_now && _now === campId; }",
    mustFail: "FAIL #777 S1: the same campaign still acks its own 200" },
  { label: "S1: the old campaign's landed save no longer clears its own unsynced marker",
    find: "if (r.ok) { _flushAcked(turnAt, campId); _leftSay(\"saved, turn \" + turnAt); _fin(null); }",
    replace: "if (r.ok) { _leftSay(\"saved, turn \" + turnAt); _fin(null); }", mustFail: S1_200 },
  { label: "S1: a landed save clears the marker of whichever campaign is open",
    find: "turnAt >= t) clearFlushDirty(campId);", replace: "turnAt >= t) clearFlushDirty();", mustFail: S1_200 },
  { label: "S1: the old campaign's network error counts as the new campaign's failure",
    find: "      if (_left()) _leftSay(_msg);   /* S1: another campaign's failed save", replace: "      if (false) _leftSay(_msg);   /* S1: another campaign's failed save",
    mustFail: "FAIL #777 S1: campaign A's network error landing after the switch" },
  { label: "S1: a dropped answer is dropped without a word",
    find: "function _leftSay(what) { console.info(", replace: "function _leftSay(what) { return; console.info(",
    mustFail: "FAIL #777 S1: campaign A's failure landing after the switch (a 500, a 413, a network error)" }
]);

var S2 = "FAIL #777 S2: the cloud is ahead and a turn is in flight";
var S2_IF = "      if (serverTurn > localTurn && (typeof busy !== \"undefined\" && busy)) {";
sync("storage-adapter.js", [
  { label: "S2: the world is swapped under a turn in flight",
    find: S2_IF, replace: "      if (false) {", mustFail: S2 },
  { label: "S2: the cloud's turn is taken as the sync base without the adopt",
    find: S2_IF, replace: S2_IF + " _lastAckTurn = serverTurn;", mustFail: S2 },
  { label: "S2: the skipped adopt no longer pauses sync (the next save posts the older copy)",
    find: "        _onConflict(serverTurn);\n        syncCampaignList(null);\n        return;", replace: "        syncCampaignList(null);\n        return;", mustFail: S2 },
  { label: "S2: the reason is not logged",
    find: "console.warn(\"[storage] reconcile: the cloud copy of \"", replace: "void (\"[storage] reconcile: the cloud copy of \"", mustFail: S2 },
  { label: "S2: a newer cloud copy is never adopted, turn in flight or not",
    find: "      // Never swap worldState out from under an in-flight turn (audit E4): that case returned above (S2), paused.\n      if (serverTurn > localTurn) {",
    replace: "      // Never swap worldState out from under an in-flight turn (audit E4): that case returned above (S2), paused.\n      if (false) {",
    mustFail: "FAIL #777 S2: with no turn in flight the same reconcile adopts the newer cloud copy" }
]);

process.exit(failed ? 1 : 0);
