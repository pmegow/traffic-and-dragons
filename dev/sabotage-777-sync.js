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
  /* a 409 or 403 that lands after the switch is stopped twice over — here when its headers arrive, and again when its body
     has been read (the review clauses below) — so this guard alone is proven by the answers that have no body step */
  { label: "S1: the old campaign's 500 counts as the new campaign's failure",
    find: GUARD, replace: NOGUARD, mustFail: "FAIL #777 S1: campaign A's failure landing after the switch (a 500, a 413, a network error)" },
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

// independent review 2026-11-19: the bodies of a 409, a 403 and a 413 arrive after the headers
sync("storage-adapter.js", [
  { label: "S1: a 409 body that arrives after the switch pauses the new campaign",
    find: "          if (_leftBody(\"HTTP 409\")) return;\n", replace: "",
    mustFail: "FAIL #777 S1: the BODY of campaign A's 409 arriving after the switch" },
  { label: "S1: a self-healing 409 body that arrives after the switch acks and re-posts for the new campaign",
    find: "          if (_leftBody(\"HTTP 409\")) return;\n", replace: "",
    mustFail: "FAIL #777 S1: the BODY of campaign A's self-healing 409 arriving after the switch" },
  { label: "S1: a 403 body that arrives after the switch re-homes the new campaign",
    find: "          if (_leftBody(\"HTTP 403\")) return;\n", replace: "",
    mustFail: "FAIL #777 S1: the BODY of campaign A's 403 foreign_campaign arriving after the switch" },
  { label: "S1: a 413 body that arrives after the switch is the new campaign's refusal",
    find: "r.json().then(function(d){ if (_left()) { _leftSay(\"HTTP 413\"); return; } _onSyncFail(", replace: "r.json().then(function(d){ _onSyncFail(",
    mustFail: "FAIL #777 S1: the BODY of campaign A's 413 arriving after the switch" },
  { label: "S9: a refusal that can never succeed re-sends the portraits with every save",
    find: "if (!_ps || _ps >= 500 || _ps === 408 || _ps === 429) {", replace: "if (true) {",
    mustFail: "FAIL #777 S9: a portrait refusal that can never succeed" },
  { label: "S9: a permanent portrait refusal is toasted on every save it is met",
    find: "if (!_portraitRefusalSaid && typeof showToast === \"function\") { _portraitRefusalSaid = true;", replace: "if (typeof showToast === \"function\") {",
    mustFail: "FAIL #777 S9: a portrait refusal that can never succeed" }
]);
sync("ui-modals.js", [
  { label: "S3: the Campaign list button runs the wizard's home-page handoffs",
    find: "close();if(typeof showChar===\"function\")showChar();if(typeof showCampaignPicker===\"function\")showCampaignPicker();", replace: "close();if(typeof onNew===\"function\")onNew();if(typeof showCampaignPicker===\"function\")showCampaignPicker();",
    mustFail: "FAIL #777 S3: the refusal screen's text escapes the reason" }
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
    find: "console.warn(\"[storage] reconcile: the cloud copy of \" + _serverCamp + \" is ahead (turn \"", replace: "void (\"[storage] reconcile: the cloud copy of \" + _serverCamp + \" is ahead (turn \"", mustFail: S2 },
  { label: "S2: a newer cloud copy is never adopted, turn in flight or not",
    find: "      // Never swap worldState out from under an in-flight turn (audit E4): that case returned above (S2), paused.\n      if (serverTurn > localTurn) {",
    replace: "      // Never swap worldState out from under an in-flight turn (audit E4): that case returned above (S2), paused.\n      if (false) {",
    mustFail: "FAIL #777 S2: with no turn in flight the same reconcile adopts the newer cloud copy" }
]);

// ── S3: a save this build could not read or prepare ─────────────────────────────────────────────────────────────────
var S3_CUT = "FAIL #777 S3: a cut-off save is refused out loud";
var S3_SCREEN = "FAIL #777 S3: the refusal screen's text escapes the reason";
sync("state.js", [
  { label: "S3: a save that fails to parse is dropped without a word again",
    find: "    else refuseUnreadableSave(ws,e,\"read\",!!(opts&&opts.screen));", replace: "", mustFail: S3_CUT },
  { label: "S3: a save whose heal throws is dropped without a word again",
    find: "worldState=null;refuseUnreadableSave(ws,e,\"prepared\",!!(opts&&opts.screen));", replace: "worldState=null;",
    mustFail: "FAIL #777 S3: a save whose heal throws" },
  { label: "S3: no second copy of the unreadable save is kept",
    find: "rk=STORE_RESCUE_K+\"core_\"+id,kept=false;", replace: "rk=STORE_RESCUE_K+\"core_\"+id,kept=false;raw=null;", mustFail: S3_CUT },
  { label: "S3: a refusal survives the next good load",
    find: "_versionRefusedLoad=null;_unreadableLoad=null;", replace: "_versionRefusedLoad=null;",
    mustFail: "FAIL #777 S3: a healthy save loads with no refusal" },
  { label: "S3: an unreadable slot gets the generic line on top of its reason",
    find: "var _vr=_versionRefusedLoad||_unreadableLoad;", replace: "var _vr=_versionRefusedLoad;",
    mustFail: "FAIL #777 S3: switching to a campaign whose slot is unreadable" }
]);
sync("storage-adapter.js", [
  { label: "S3: the boot adopts the account's latest cloud campaign over an unreadable save",
    find: "    if (!localOk && typeof unreadableLoad === \"function\" && unreadableLoad()) {", replace: "    if (false) {",
    mustFail: "FAIL #777 S3: with an unreadable local save the boot adopts nothing" },
  { label: "S3: the boot toasts the reason on top of its refusal screen",
    find: "var localOk = loadState({ screen: true });", replace: "var localOk = loadState();",
    mustFail: "FAIL #777 S3: with an unreadable local save the boot adopts nothing" }
]);
sync("ui-boot.js", [
  { label: "S3: the wizard is shown over an unreadable save",
    find: "    if(typeof unreadableLoad===\"function\"&&unreadableLoad()){showUnreadableSaveScreen(unreadableLoad(),_wizard);return;}\n", replace: "", mustFail: S3_SCREEN }
]);
sync("helpers.js", [
  { label: "S3: the refusal screen paints the reason as HTML",
    find: "\": \"+escHtml(String(info.reason||\"unknown error\"))+\".</p>\"", replace: "\": \"+String(info.reason||\"unknown error\")+\".</p>\"", mustFail: S3_SCREEN }
]);

// ── S4, S6: the .tnd import ─────────────────────────────────────────────────────────────────────────────────────────
var S4 = "FAIL #777 S4: an import that throws while it is prepared is undone";
sync("state.js", [
  { label: "S4: a failed import leaves the half-prepared world in the globals",
    find: "    worldState=_prevWs;sessionLog=_prevSl;memory=_prevMem;\n    setActiveCampId(_prevId);_checkpointMem=_prevCamp;", replace: "    setActiveCampId(_prevId);_checkpointMem=_prevCamp;", mustFail: S4 },
  { label: "S4: a failed import leaves the new campaign id active",
    find: "    setActiveCampId(_prevId);_checkpointMem=_prevCamp;", replace: "    _checkpointMem=_prevCamp;", mustFail: S4 },
  { label: "S4: the undo is not logged",
    find: "console.error(\"[import] the file could not be prepared — \"", replace: "void (\"[import] the file could not be prepared — \"", mustFail: S4 },
  { label: "S6: an import runs under a turn in flight",
    find: "if(typeof busy!==\"undefined\"&&busy)throw new Error(\"A turn is still in flight", replace: "if(false)throw new Error(\"A turn is still in flight",
    mustFail: "FAIL #777 S6: an import while a turn is in flight" }
]);

// ── S5: what counts as a long-term memory ───────────────────────────────────────────────────────────────────────────
sync("state.js", [
  { label: "S5: {} counts as a memory again",
    find: "if(missing.length===MEMORY_CORE_STORES.length)return \"an empty shell — none of its stores are there\";", replace: "if(missing.length===MEMORY_CORE_STORES.length)return \"\";",
    mustFail: "FAIL #777 S5: {} and every other non-memory are named as such" },
  { label: "S5: a memory missing some stores is blanked whole (what it holds is thrown away)",
    find: "if(!m||typeof m!==\"object\"||Array.isArray(m)||/^an empty shell/.test(issue))return", replace: "if(true)return",
    mustFail: "FAIL #777 S5: {} and every other non-memory are named as such" },
  { label: "S5: a stored {} loads without being kept or said",
    find: "  if(_hma.blank)throw new Error(\"the long-term memory is \"+_hma.issue);\n", replace: "",
    mustFail: "FAIL #777 S5: a stored memory of {} is rescued and replaced at load" },
  { label: "S5: a camp with no memory stores is restored (the heal lets an empty shell through)",
    find: "  if(_hma.blank)throw new Error(\"the long-term memory is \"+_hma.issue);\n", replace: "",
    mustFail: "FAIL #777 S5: a camp held with a memory of {} is refused at restore" }
]);
sync("storage-adapter.js", [
  { label: "S5: the reconcile adopts any truthy memory again",
    find: "var _adm = memoryAdmit(data.memory);", replace: "var _adm = { memory: data.memory || blankMemory(), issue: \"\" };",
    mustFail: "FAIL #777 S5: the reconcile adopts a cloud copy whose memory is {}" },
  { label: "S5: an adopted empty memory is not said",
    find: "if (_adm.blank && typeof showToast === \"function\") showToast(", replace: "if (false) showToast(",
    mustFail: "FAIL #777 S5: the reconcile adopts a cloud copy whose memory is {}" }
]);
sync("ui-campaigns.js", [
  { label: "S5: the manual pull hands {} on as the campaign's memory",
    find: "  if(!a.issue)return a.memory;\n", replace: "  if(data&&data.memory&&typeof data.memory===\"object\")return data.memory;\n",
    mustFail: "FAIL #777 S5: the manual pull's memory check is the same one" },
  { label: "S5: the manual push uploads a memory of {}",
    find: "  if(_pmi){_refuse(\"its memory slot is \"+_pmi", replace: "  if(false){_refuse(\"its memory slot is \"+_pmi",
    mustFail: "FAIL #777 S13: a push of a campaign whose saved world cannot be read says so" },
  { label: "S13: an unreadable world is refused without a word",
    find: "catch(e){_refuse(\"its saved world could not be read\",\"unparseable: \"+(e&&e.message));return;}", replace: "catch(e){if(cb)cb(false);return;}",
    mustFail: "FAIL #777 S13: a push of a campaign whose saved world cannot be read says so" },
  { label: "S7: the local Load switches campaigns under a turn in flight",
    find: "  if(typeof busy!==\"undefined\"&&busy){showToast(\"Finish the current turn first.\");return;}\n  var ok=switchToCampaign(id);", replace: "  var ok=switchToCampaign(id);",
    mustFail: "FAIL #777 S7: the local Load does not switch campaigns while a turn is in flight" }
]);

// ── S8–S11 ──────────────────────────────────────────────────────────────────────────────────────────────────────────
var S8 = "FAIL #777 S8: a script loaded by a page outside the app shell is network-first too";
sync("sw.js", [
  { label: "S8: the designer's scripts are served cache-first again",
    find: "|\\/designer-/.test(e.request.url)", replace: "/.test(e.request.url)", mustFail: S8 }
]);
sync("dev/class-guards.js", [
  { label: "S8: the script check leaves the class guards",
    find: ".concat(networkFirstScriptProblems(root))", replace: "", mustFail: S8 },
  { label: "S8: a script in the app shell or on another origin is all the check looks past (a query string hides a script)",
    find: "sw.regex.test(\"https://tnd.example/\" + url.replace(/^\\.\\//, \"\"))", replace: "(sw.regex.test(\"https://tnd.example/\" + url.replace(/^\\.\\//, \"\")) || url.indexOf(\"?\") >= 0)", mustFail: S8 }
]);
sync("storage-adapter.js", [
  { label: "S9: a refused portrait upload reads as a success",
    find: "      if (r && r.ok) return;", replace: "      return;",
    mustFail: "FAIL #777 S9: a portrait upload the server refuses is logged and sent again" }
]);
var S10 = "FAIL #777 S10: a re-homed campaign takes its preserved copies with it";
var S11_DEL = "FAIL #777 S11: a deleted campaign's camp leaves IndexedDB";
sync("state.js", [
  { label: "S10: the preserved copies stay under the old id",
    find: "try{store.set(_rn[i],v);if(store.get(_rn[i])===v)store.del(_ro[i]);else throw new Error(\"the copy did not read back\");}", replace: "try{}", mustFail: S10 },
  { label: "S10: the saved-campaign rescue is not on the list that moves",
    find: "STORE_RESCUE_K+\"mem_\"+id,STORE_RESCUE_K+\"core_\"+id];}", replace: "STORE_RESCUE_K+\"mem_\"+id];}", mustFail: S10 },
  { label: "S11: a deleted campaign keeps its camp in IndexedDB",
    find: "  forgetCampaignCheckpoint(id);/* S11: and its camp */\n", replace: "", mustFail: S11_DEL },
  { label: "S11: Remove local keeps the camp in IndexedDB",
    find: "forgetCampaignSyncMarkers(id);forgetCampaignCheckpoint(id);/* S11: a campaign that comes back", replace: "forgetCampaignSyncMarkers(id);/* S11: a campaign that comes back", mustFail: S11_DEL },
  { label: "S11: freeing a slot mid-switch drops the camp too",
    find: "  if(opts&&opts.teardown){forgetCampaignSyncMarkers(id);", replace: "  forgetCampaignCheckpoint(id);if(opts&&opts.teardown){forgetCampaignSyncMarkers(id);", mustFail: S11_DEL },
  { label: "S11: a re-homed campaign's camp stays under the old id",
    find: "return idbPutCheckpoint(nid,snap).then(function(){return idbDelCheckpoint(old);});", replace: "return null;",
    mustFail: "FAIL #777 S11: a re-homed campaign's camp is moved to the new id" }
]);

process.exit(failed ? 1 : 0);
