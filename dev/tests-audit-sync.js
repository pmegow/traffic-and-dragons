// tests-audit-sync.js — the 2026-09-18 Fable deep review, section D (state, storage, cloud sync)
// plus E3 and the E15 entries in those files. DEV TOOL, node-only; run directly:
//   node dev/tests-audit-sync.js
//
// Why a standalone battery: these assertions replace the engine's `worldState`/`sessionLog`/`memory`
// globals wholesale (checkpoint restores), install a quota-throwing localStorage, and stub fetch —
// none of which can share engine-tests.js's fixture. Same reporter shape as tests-jp011-flush-dirty.
//
// Two kinds of clause here, by necessity:
//   • BEHAVIOUR, executed — everything in state.js / storage-adapter.js / memory.js / game.js.
//   • SOURCE, scanned — ui-campaigns.js, ui-files.js, ui-boot.js and sw.js are not in the engine
//     manifest (DOM-wiring files), so their clauses read the shipped bytes the way run-tests.js's
//     contracts do. The .tnd import's memory carry is the exception: its statement window is
//     EXECUTED out of the shipped file (see "D7"), so the test drives real code, not a regex.
// ES5 throughout, matching the engine.

var fs = require("fs");
var path = require("path");
var ROOT = path.join(__dirname, "..");
var E = require("./load-engine.js");
E.loadEngine();

// ── Reporter ─────────────────────────────────────────────────────────────────
var pass = 0, fails = [], curSection = "";
function section(name) { curSection = name; }
function t(name, fn) {
  var label = curSection + " › " + name;
  var r;
  try { r = fn(); } catch (e) { fails.push(label + " — threw: " + (e && e.message) + "\n" + (e && e.stack)); return; }
  if (r === true || r === undefined) pass++; else fails.push(label + " — " + r);
}
var chain = Promise.resolve();
function tAsync(name, fn) {
  var label = curSection + " › " + name;
  chain = chain.then(function () {
    return Promise.resolve().then(fn).then(
      function (r) { if (r === true || r === undefined) pass++; else fails.push(label + " — " + r); },
      function (e) { fails.push(label + " — threw: " + (e && e.message)); }
    );
  });
}
function eq(got, want, label) { if (got === want) return true; return (label || "") + " expected " + JSON.stringify(want) + " got " + JSON.stringify(got); }
function settle() { return new Promise(function (res) { setTimeout(res, 40); }); }
function src(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }
// Comment-blind source read: a clause a COMMENT can satisfy — or trip — is not a contract. Same
// normalisation run-tests.js's SYNC COMPRESSION CONTRACT uses.
// Block comments collapse to a STATEMENT, not to nothing, so an explained `catch(e){ /* why */ }`
// still reads as non-empty to the empty-catch scan below.
function code(f) { return src(f).replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "0;"); }

// ── DOM / UI stubs (engine-tests.js lines 15-30 shape) ───────────────────────
var toasts = [], warns = [], errs = [];
global.showToast = function (m) { toasts.push(String(m)); };
global.addMsg = function () { return { appendChild: function () {}, style: {}, remove: function () {}, textContent: "", innerHTML: "" }; };
global.syncUI = function () {};
global.showGame = function () {};
global.updateAbPanel = function () {};
global.updateSpPanel = function () {};
global.rebuildNarrativeFromTranscript = function () { return true; };
global.showRespawnModal = function () {};
global.carNotify = function () {};
global.busy = false;
var realWarn = console.warn, realErr = console.error, realLog = console.log;
function captureConsole() {
  console.warn = function () { warns.push(Array.prototype.slice.call(arguments).join(" ")); };
  console.error = function () { errs.push(Array.prototype.slice.call(arguments).join(" ")); };
  console.log = function () {};
}
function releaseConsole() { console.warn = realWarn; console.error = realErr; console.log = realLog; }
function resetSinks() { toasts.length = 0; warns.length = 0; errs.length = 0; }
function sawWarn(re) { return warns.some(function (w) { return re.test(w); }); }
function sawErr(re) { return errs.some(function (w) { return re.test(w); }); }
function sawToast(re) { return toasts.some(function (w) { return re.test(w); }); }
captureConsole();

function world(campId) {
  E.makeTestWorld({ kind: "adventure", clock: { min: 625 } });
  worldState.campId = campId || null;
  worldState.turn = 40;
  worldState.transcript = [{ t: 9, r: "gm", x: "at camp" }, { t: 30, r: "gm", x: "the dead branch" }];
  sessionLog = [{ role: "user", content: "live" }, { role: "assistant", content: "live answer" }];
  memory = blankMemory(); memory.lore = ["live lore"];
  resetSinks();
  return worldState;
}
// A camp snapshot exactly as checkpointCapture writes one, but hand-built so a single part can be
// corrupted without corrupting the rest (the field failure: IndexedDB / the server slot hands the
// app a snapshot whose parts are independently damaged).
function snapshot(over) {
  var s = {
    v: 1, turn: 10, reason: "rest", at: Date.now(), campId: null, location: "Ashfen",
    ws: JSON.stringify({ turn: 10, campId: null, campName: "Test", character: { name: "Tess", hp: 3, maxHp: 14, coreMemories: [] }, world: { location: "Ashfen" }, npcs: [] }),
    sl: JSON.stringify([{ role: "user", content: "camp" }]),
    mem: JSON.stringify({ npcs: {}, locations: {}, quests: {}, lore: ["camp lore"], keyDecisions: [], futureEvents: [], chapters: [] })
  };
  Object.keys(over || {}).forEach(function (k) { s[k] = over[k]; });
  return s;
}
function liveUntouched(msg) {
  if (worldState.turn !== 40) return msg + ": worldState was replaced (turn " + worldState.turn + ")";
  if (worldState.respawns) return msg + ": a respawn was counted on a refused restore";
  if (sessionLog.length !== 2) return msg + ": the live session log was blanked (" + sessionLog.length + " entries)";
  if (!memory.lore || memory.lore[0] !== "live lore") return msg + ": the live long-term memory was blanked";
  if (worldState.transcript.some(function (e) { return e.db; })) return msg + ": the surviving transcript was stamped dead-branch";
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
section("D1 — the checkpoint holder is campaign-scoped");

t("checkpointClear() exists and empties the holder", function () {
  world("A"); checkpointHold(snapshot({ campId: "A" }));
  if (!checkpointHeld()) return "fixture: nothing held";
  checkpointClear();
  return checkpointHeld() === null ? true : "the holder survived the clear";
});

t("changing the active campaign id DROPS the held camp (the one funnel every path goes through)", function () {
  world("A"); setActiveCampId("A"); checkpointHold(snapshot({ campId: "A" }));
  if (!checkpointHeld()) return "fixture: nothing held";
  setActiveCampId("B");
  var gone = checkpointHeld() === null;
  setActiveCampId(null);
  return gone ? true : "campaign A's camp survived the switch to B — dying in B would restore A's world";
});

t("re-setting the SAME id keeps the camp (a no-op write must not cost the player their camp)", function () {
  world("A"); setActiveCampId("A"); checkpointHold(snapshot({ campId: "A" }));
  setActiveCampId("A");
  var kept = !!checkpointHeld();
  setActiveCampId(null);
  return kept ? true : "the held camp was dropped by a no-op setActiveCampId";
});

t("checkpointRestore REFUSES a camp stamped for another campaign, loudly, and changes nothing", function () {
  world("B"); resetSinks();
  var r = checkpointRestore(snapshot({ campId: "A" }), { cause: "a spear" });
  if (!r || r.ok !== false) return "expected a refusal, got " + JSON.stringify(r);
  if (!/another campaign/.test(r.reason || "")) return "reason does not name the mismatch: " + r.reason;
  if (!sawWarn(/REFUSED/)) return "the refusal was silent on the console";
  return liveUntouched("cross-campaign restore");
});

t("checkpointHold REFUSES a foreign camp — the transported snapshot never becomes the holder", function () {
  world("B"); checkpointClear(); resetSinks();
  var held = checkpointHold(snapshot({ campId: "A" }));
  if (held !== false) return "checkpointHold reported success for a foreign camp";
  if (checkpointHeld()) return "a foreign camp was installed as the holder";
  return sawWarn(/REFUSED/) ? true : "the refusal was silent on the console";
});

t("a camp for THIS campaign still restores (the guard is not a blanket refusal)", function () {
  world("A"); resetSinks();
  var r = checkpointRestore(snapshot({ campId: "A" }), { cause: "a spear" });
  if (!r || r.ok !== true) return "a legitimate restore was refused: " + JSON.stringify(r);
  if (worldState.turn !== 40) return "the turn rewound to " + worldState.turn;
  if (memory.lore[0] !== "camp lore") return "memory did not come back from camp";
  return worldState.respawns === 1 ? true : "respawns " + worldState.respawns;
});

t("switchToCampaign re-fetches the incoming campaign's OWN camp after the switch", function () {
  var s = code("state.js");
  var slice = s.slice(s.indexOf("function switchToCampaign("), s.indexOf("function dedupeActiveCampSlots("));
  return slice.indexOf("restoreCheckpointHolder()") >= 0 ? true : "switchToCampaign never re-runs the holder restore — after a switch the player has no camp at all";
});

t("the .tnd import re-fetches the holder too", function () {
  return importBody().indexOf("restoreCheckpointHolder()") >= 0 ? true : "importSaveData never re-runs the holder restore";
});

// ═══════════════════════════════════════════════════════════════════════════════
section("D2 — a refused restore never blanks the live stores");

t("an unreadable session log in the camp REFUSES; the live session log and memory stand", function () {
  world("A"); resetSinks();
  var r = checkpointRestore(snapshot({ sl: "{not json" }), { cause: "a spear" });
  if (!r || r.ok !== false) return "expected a refusal, got " + JSON.stringify(r);
  if (!/session log/.test(r.reason || "")) return "the reason does not name the store: " + r.reason;
  if (!sawErr(/SESSION LOG/)) return "no console.error named the failing store";
  return liveUntouched("bad sl");
});

t("an unreadable long-term memory in the camp REFUSES; nothing is blanked", function () {
  world("A"); resetSinks();
  var r = checkpointRestore(snapshot({ mem: "{oops" }), { cause: "a spear" });
  if (!r || r.ok !== false) return "expected a refusal, got " + JSON.stringify(r);
  if (!/long-term memory/.test(r.reason || "")) return "the reason does not name the store: " + r.reason;
  if (!sawErr(/LONG-TERM MEMORY/)) return "no console.error named the failing store";
  return liveUntouched("bad mem");
});

t("a camp whose memory parses to a non-object (an array, a number) is refused too", function () {
  world("A"); resetSinks();
  var r = checkpointRestore(snapshot({ mem: "[1,2,3]" }), { cause: "a spear" });
  if (!r || r.ok !== false) return "an array memory was accepted: " + JSON.stringify(r);
  world("A"); resetSinks();
  var r2 = checkpointRestore(snapshot({ sl: '{"role":"user"}' }), { cause: "a spear" });
  if (!r2 || r2.ok !== false) return "a non-array session log was accepted: " + JSON.stringify(r2);
  return liveUntouched("wrong-shaped stores");
});

t("a healMemory throw REFUSES and rolls the globals back — the heal is the last thing that can fail", function () {
  world("A"); resetSinks();
  var realHeal = healMemory;
  healMemory = function () { throw new Error("heal exploded"); };
  var r;
  try { r = checkpointRestore(snapshot({ campId: "A" }), { cause: "a spear" }); }
  finally { healMemory = realHeal; }
  if (!r || r.ok !== false) return "a heal throw was swallowed: " + JSON.stringify(r);
  if (!sawErr(/could not be healed/)) return "the heal failure was silent";
  return liveUntouched("heal throw");
});

t("deathSceneChoose('back') on a refused restore: toast, no save, and the death scene SURVIVES", function () {
  world("A"); resetSinks();
  worldState.deathScene = { stage: "choose", cause: "a spear", walk: 1, startTurn: 40, answer: null };
  checkpointClear(); checkpointHold(snapshot({ campId: "A", sl: "{not json" }));
  var saved = 0, realSave = saveAll;
  saveAll = function () { saved++; };
  var r;
  try { r = deathSceneChoose("back"); } finally { saveAll = realSave; }
  if (!r || r.action !== "failed") return "expected {action:'failed'}, got " + JSON.stringify(r);
  if (saved) return "saveAll ran on a refused restore — the refusal would be persisted and synced";
  if (!sawToast(/Couldn't wake you/)) return "the player was told nothing: " + JSON.stringify(toasts);
  if (!worldState.deathScene) return "the death scene was deleted, stranding the player with no scene and no respawn";
  return liveUntouched("deathSceneChoose refusal");
});

// ═══════════════════════════════════════════════════════════════════════════════
section("D9 — a camp from a newer build is refused, not read blind");

t("checkpointRestore refuses a snapshot whose v is above CHECKPOINT_VER", function () {
  world("A"); resetSinks();
  var r = checkpointRestore(snapshot({ v: CHECKPOINT_VER + 1 }), { cause: "a spear" });
  if (!r || r.ok !== false) return "a v" + (CHECKPOINT_VER + 1) + " camp restored into a v" + CHECKPOINT_VER + " reader: " + JSON.stringify(r);
  if (!/newer version/.test(r.reason || "")) return "reason: " + r.reason;
  if (!sawWarn(/REFUSED/)) return "the refusal was silent";
  return liveUntouched("future-version camp");
});

t("checkpointHold refuses one too (restoreCheckpointHolder's only door)", function () {
  world("A"); checkpointClear(); resetSinks();
  var held = checkpointHold(snapshot({ v: CHECKPOINT_VER + 1 }));
  if (held !== false || checkpointHeld()) return "a future-version camp was installed";
  return sawWarn(/REFUSED/) ? true : "silent";
});

t("a v-less legacy snapshot is still accepted (the gate reads missing as v1, not as future)", function () {
  world("A"); checkpointClear();
  var s = snapshot({ campId: "A" }); delete s.v;
  return checkpointHold(s) === true && checkpointHeld() ? true : "a pre-stamp camp was refused";
});

// ═══════════════════════════════════════════════════════════════════════════════
section("D3 — snapshotActiveCamp writes the slot all-or-nothing");

// A capacity-limited localStorage: the Nth tnd_camp_ write throws QuotaExceededError, exactly the
// field shape (#337/#395) — the ws part lands and the memory part does not.
function withQuotaStore(failOnWrite, fn) {
  var had = ("localStorage" in global), real = had ? global.localStorage : undefined;
  var backing = {}, writes = 0;
  global.localStorage = {
    getItem: function (k) { return (k in backing) ? backing[k] : null; },
    setItem: function (k, v) {
      if (k.indexOf("tnd_camp_") === 0) { writes++; if (writes >= failOnWrite) { var e = new Error("quota"); e.name = "QuotaExceededError"; throw e; } }
      backing[k] = v;
    },
    removeItem: function (k) { delete backing[k]; }
  };
  try { return fn(backing); }
  finally {
    if (had) global.localStorage = real; else delete global.localStorage;
    Object.keys(_mKeys).forEach(function (k) { if (k.indexOf("tnd_camp_") === 0) { delete _m[k]; delete _mKeys[k]; } });
  }
}
function slotKeysIn(backing, id) { return Object.keys(backing).filter(function (k) { return k.indexOf("tnd_camp_" + id + "_") === 0; }); }

t("a quota throw mid-triple leaves NO partial slot (ws@N beside mem@N-k is the drift hole)", function () {
  world("QD3"); setActiveCampId("QD3");
  store.set(WSK, '{"turn":40}'); store.set(SLK, "[]"); store.set(MEM_KEY, '{"lore":["x"]}');
  var realSync = storageAdapter.syncNow, realMode = storageAdapter.isServerMode;
  storageAdapter.syncNow = function () {}; storageAdapter.isServerMode = function () { return false; };
  var out;
  try {
    out = withQuotaStore(2, function (backing) {
      var ok = snapshotActiveCamp();
      return { ok: ok, left: slotKeysIn(backing, "QD3") };
    });
  } finally {
    storageAdapter.syncNow = realSync; storageAdapter.isServerMode = realMode;
    store.del(WSK); store.del(SLK); store.del(MEM_KEY); setActiveCampId(null); store.del(CAMP_META_K);
  }
  if (out.ok !== false) return "expected false, got " + out.ok;
  if (out.left.length) return "a PARTIAL slot survived the failed snapshot: " + JSON.stringify(out.left);
  return true;
});

t("a slot part whose live key is MISSING is deleted, never left over from the previous snapshot", function () {
  world("QD3b"); setActiveCampId("QD3b");
  store.set(campSlotKey("QD3b", "mem"), '{"lore":["stale memory from two campaigns ago"]}');
  store.set(WSK, '{"turn":41}'); store.set(SLK, "[]"); store.del(MEM_KEY);
  var realSync = storageAdapter.syncNow; storageAdapter.syncNow = function () {};
  var ok, leftover;
  try {
    ok = snapshotActiveCamp();
    leftover = store.get(campSlotKey("QD3b", "mem"));
  } finally {
    storageAdapter.syncNow = realSync;
    removeCampaignLocalCopy("QD3b"); store.del(WSK); store.del(SLK); setActiveCampId(null); store.del(CAMP_META_K);
  }
  if (ok !== true) return "the snapshot failed: " + ok;
  return leftover == null ? true : "the stale memory part outlived the world it belonged to: " + leftover;
});

t("the #337 writer is what snapshotActiveCamp uses (no raw store.set of a slot key)", function () {
  var s = code("state.js");
  var slice = s.slice(s.indexOf("function snapshotActiveCamp("), s.indexOf("function storageUsedChars("));
  if (/store\.set\(\s*campSlotKey\(/.test(slice)) return "a raw slot write is back in snapshotActiveCamp";
  return slice.indexOf("writeCampaignSlot(") >= 0 ? true : "snapshotActiveCamp no longer routes through writeCampaignSlot";
});

// ═══════════════════════════════════════════════════════════════════════════════
section("D10/D13 — a campaign's sync markers die with the campaign");

t("deleteCampaign clears the unsynced-flush marker and the payload-size latch", function () {
  store.set("tnd_sync_dirty_v1", JSON.stringify({ DEADC: 77, OTHER: 5 }));
  store.set("tnd_sync_size_warned_v1", "|OTHER||DEADC|");
  setCampMeta([{ id: "DEADC", campName: "Doomed" }, { id: "OTHER", campName: "Alive" }]);
  deleteCampaign("DEADC");
  var dirty = storageAdapter.flushDirtyTurn("DEADC"), survivor = storageAdapter.flushDirtyTurn("OTHER");
  var seen = store.get("tnd_sync_size_warned_v1") || "";
  store.del("tnd_sync_size_warned_v1"); store.del("tnd_sync_dirty_v1"); store.del(CAMP_META_K);
  if (dirty != null) return "the dead campaign kept its flush marker (turn " + dirty + ") — it evicts a LIVE campaign's from the capped map";
  if (survivor !== 5) return "the prune took a LIVE campaign's flush marker with it (" + survivor + ")";
  if (seen.indexOf("|DEADC|") >= 0) return "the size-warn latch still carries the deleted campaign: " + seen;
  return seen.indexOf("|OTHER|") >= 0 ? true : "the prune took the surviving campaign's segment with it: " + seen;
});

t("'Remove local' (teardown) clears them; a mid-switch slot free does NOT", function () {
  store.set("tnd_sync_dirty_v1", JSON.stringify({ KEEPC: 12 }));
  removeCampaignLocalCopy("KEEPC");
  var afterTransport = storageAdapter.flushDirtyTurn("KEEPC");
  removeCampaignLocalCopy("KEEPC", { teardown: true });
  var afterTeardown = storageAdapter.flushDirtyTurn("KEEPC");
  storageAdapter.clearFlushDirty("KEEPC"); store.del("tnd_sync_dirty_v1");
  if (afterTransport !== 12) return "the switch's slot-free dropped the marker for a campaign that is about to be PLAYED (turns the server never saw)";
  return afterTeardown == null ? true : "the teardown left the marker behind: " + afterTeardown;
});

t("the eviction path passes {teardown:true}", function () {
  return /removeCampaignLocalCopy\(id,\{teardown:true\}\)/.test(code("ui-campaigns.js")) ? true : "campRemoveLocal's evict() still frees the slot as if it were a transport step";
});

// ═══════════════════════════════════════════════════════════════════════════════
section("D8 — the campaign list has ONE reader and ONE writer");

t("storage-adapter.js holds no raw tnd_camps_v1 access", function () {
  var s = code("storage-adapter.js");
  if (/localStorage\.(get|set)Item\(\s*["']tnd_camps_v1["']/.test(s)) return "syncCampaignList still reads/writes the list on raw localStorage with a duplicated key literal";
  var slice = s.slice(s.indexOf("function syncCampaignList("), s.indexOf("function fillPortraitsFromBlob("));
  if (slice.length < 200) return "could not locate syncCampaignList…fillPortraitsFromBlob";
  if (slice.indexOf("getCampMeta()") < 0) return "the merge no longer reads through getCampMeta — the E72 corrupt-list backup is lost again";
  return slice.indexOf("setCampMeta(") >= 0 ? true : "the merge no longer writes through setCampMeta — the store fallback and _mKeys shadow are lost again";
});

tAsync("a CORRUPT local list is backed up and does not unlist every local campaign silently", function () {
  store.set(CAMP_META_K, "{this is not a list");
  resetSinks();
  var realFetch = global.fetch;
  global.fetch = function () {
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve([{ id: "SERVER1", campName: "Cloud" }]); } });
  };
  storageAdapter.setServer("https://unit.test", "tok");
  return new Promise(function (res) { storageAdapter.syncCampaignList(function () { res(); }); })
    .then(settle)
    .then(function () {
      var rescued = store.get(CAMP_META_RESCUE_K);
      global.fetch = realFetch; storageAdapter.setServer(null, null);
      store.del(CAMP_META_K); store.del(CAMP_META_RESCUE_K);
      if (rescued !== "{this is not a list") return "the corrupt list was not preserved under the rescue key: " + JSON.stringify(rescued);
      return sawWarn(/campaign list corrupt/) ? true : "the corruption was silent: " + JSON.stringify(warns);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
section("D4 — the manual push is CAS-guarded and gates on the STATE row");

t("pushCampaignState ships baseTurn when it is given one", function () {
  var body = null, realFetch = global.fetch;
  global.fetch = function (url, opts) { body = JSON.parse(opts.body); return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } }); };
  storageAdapter.setServer("https://unit.test", "tok");
  storageAdapter.pushCampaignState("campX", { worldState: { turn: 3, npcs: [] }, sessionLog: [], memory: { lore: [] }, baseTurn: 7 }, function () {});
  global.fetch = realFetch; storageAdapter.setServer(null, null);
  if (!body) return "no POST fired";
  return eq(body.baseTurn, 7, "baseTurn");
});

t("…and omits it entirely when it is not (the connect-time bulk upload is byte-identical)", function () {
  var body = null, realFetch = global.fetch;
  global.fetch = function (url, opts) { body = opts.body; return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } }); };
  storageAdapter.setServer("https://unit.test", "tok");
  storageAdapter.pushCampaignState("campX", { worldState: { turn: 3, npcs: [] }, sessionLog: [], memory: { lore: [] } }, function () {});
  global.fetch = realFetch; storageAdapter.setServer(null, null);
  return ("baseTurn" in JSON.parse(body)) ? "baseTurn leaked into the unguarded path" : true;
});

t("campCloudPushSilent probes the STATE row, not the campaign LIST", function () {
  var s = code("ui-campaigns.js");
  var slice = s.slice(s.indexOf("function campCloudPushSilent("), s.indexOf("function disconnectFromServer("));
  if (slice.length < 200) return "could not locate campCloudPushSilent";
  if (slice.indexOf("getServerCampaignTurn(") >= 0) return "the push still gates on the campaign LIST turn, which #377 measured as LAGGING the state row the CAS guard compares";
  return slice.indexOf("getServerStateTurn(") >= 0 ? true : "the push no longer probes the server at all";
});

t("…passes the probed turn through as baseTurn, so the server's CAS guard decides", function () {
  var s = code("ui-campaigns.js");
  var slice = s.slice(s.indexOf("function campCloudPushSilent("), s.indexOf("function disconnectFromServer("));
  return /baseTurn:\s*\(typeof serverTurn==="number"\?serverTurn:undefined\)/.test(slice) ? true : "pushCampaignState is called without baseTurn — a device that wrote between the probe and the POST is silently overwritten";
});

t("…and a 409 is announced on BOTH channels, naming the campaign", function () {
  var s = code("ui-campaigns.js");
  var slice = s.slice(s.indexOf("function campCloudPushSilent("), s.indexOf("function disconnectFromServer("));
  if (slice.indexOf("409") < 0) return "nothing in the push recognises a CAS refusal";
  if (!/console\.warn\([^)]*REFUSED/.test(slice)) return "a refused push says nothing on the console";
  if (slice.indexOf("showToast") < 0) return "a refused push says nothing to the player — campSaveRename pushes with a null cb, so this is the only channel";
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════════
section("D5 — a missing memory slot is UNKNOWN, never empty");

t("the push no longer defaults a missing memory slot to {}", function () {
  var s = code("ui-campaigns.js");
  if (/campSlotKey\(id,"mem"\)\)\|\|"\{\}"/.test(s)) return 'store.get(campSlotKey(id,"mem"))||"{}" is back — an empty memory ships with a real turn and the next reconcile adopts it over a healthy one';
  if (/\|\|"\{\}"/.test(s)) return "another ||\"{}\" default is back in ui-campaigns.js: " + (s.match(/.{60}\|\|"\{\}".{20}/) || [""])[0];
  return true;
});

t("…it refuses the push, on both channels", function () {
  var s = code("ui-campaigns.js");
  var slice = s.slice(s.indexOf("function campCloudPushSilent("), s.indexOf("function disconnectFromServer("));
  if (slice.indexOf("memory slot is missing") < 0) return "no refusal names the missing memory slot";
  if (!/console\.warn/.test(slice)) return "the refusal is silent on the console";
  if (slice.indexOf("showToast") < 0) return "the refusal is silent to the player";
  return true;
});

t("an UNPARSEABLE memory or session slot refuses instead of throwing out of the callback", function () {
  var s = code("ui-campaigns.js");
  var slice = s.slice(s.indexOf("function campCloudPushSilent("), s.indexOf("function disconnectFromServer("));
  if (/sessionLog:JSON\.parse\(sl\)/.test(slice) || /memory:JSON\.parse\(mem\)/.test(slice)) return "the parses still run bare inside the push — a corrupt slot throws out of an async callback with nothing shown";
  return /try\{memObj=JSON\.parse\(mem\);\}catch/.test(slice) ? true : "the memory slot is not parsed defensively";
});

// ═══════════════════════════════════════════════════════════════════════════════
section("D6 — the summarize commit is atomic");

// Drives the real summarize() with a stubbed extractor. The defect: retainSessionTail() truncated
// the session log in RAM BEFORE two unchecked writes, so saveMem failing on quota while saveCore
// succeeded left the disk saying "summarized" with the extraction nowhere — the window's events
// surviving only in the raw transcript.
function summarizeWorld() {
  world("SUM");
  var big = new Array(700).join("word ");
  sessionLog = [];
  for (var i = 0; i < 8; i++) sessionLog.push({ role: i % 2 ? "assistant" : "user", content: big + i });
  worldState.sessKept = 0;
  return sessionLog.length;
}
function withSaves(coreOk, memOk, fn) {
  var rc = saveCore, rm = saveMem, rl = saveLocal, ra = saveAll, rg = callGM, rce = compileEraIfDue;
  saveCore = function () { return coreOk; };
  saveMem = function () { return memOk; };
  saveAll = function () { return coreOk && memOk; };
  compileEraIfDue = function () {};
  callGM = function () { return Promise.resolve(JSON.stringify({ chapterSummary: "The pier burned and the party walked south." })); };
  return Promise.resolve().then(fn).then(
    function (v) { saveCore = rc; saveMem = rm; saveLocal = rl; saveAll = ra; callGM = rg; compileEraIfDue = rce; return v; },
    function (e) { saveCore = rc; saveMem = rm; saveLocal = rl; saveAll = ra; callGM = rg; compileEraIfDue = rce; throw e; }
  );
}

tAsync("both writes land → the session log is truncated and the chapter is filed", function () {
  var n = summarizeWorld();
  return withSaves(true, true, function () { return summarize(); }).then(function () {
    if (sessionLog.length >= n) return "the session log was never retained down (" + sessionLog.length + " of " + n + ")";
    return memory.chapters.length ? true : "no chapter was filed";
  });
});

tAsync("saveMem fails on quota → the session log is KEPT INTACT and the failure is loud", function () {
  var n = summarizeWorld(); resetSinks();
  return withSaves(true, false, function () { return summarize(); }).then(function () {
    if (sessionLog.length !== n) return "the session log was truncated although the extraction never reached the disk (" + sessionLog.length + " of " + n + ") — the window's events now exist only in the raw transcript";
    return sawErr(/did NOT persist/) ? true : "the failed commit was silent: " + JSON.stringify(errs);
  });
});

tAsync("saveCore fails → same refusal (either half failing means the commit did not happen)", function () {
  var n = summarizeWorld(); resetSinks();
  return withSaves(false, true, function () { return summarize(); }).then(function () {
    return sessionLog.length === n ? true : "the session log was truncated on a failed worldState write";
  });
});

t("the three commit sites are ONE committer that saves before it truncates", function () {
  var s = code("memory.js");
  if (/retainSessionTail\(\);summaryFailureClear\(\);saveMem\(\);saveCore\(\);/.test(s)) return "the unchecked two-write commit is back";
  var slice = s.slice(s.indexOf("function _sumCommit("), s.indexOf("function _sumCommit(") + 900);
  if (slice.indexOf("saveLocal()") < 0) return "_sumCommit does not pair the writes through saveLocal";
  if (slice.indexOf("saveLocal()") > slice.indexOf("retainSessionTail()")) return "_sumCommit still truncates before it knows the writes landed";
  return (s.match(/_sumCommit\(/g) || []).length >= 4 ? true : "not every summarize exit routes through the committer";
});

// ═══════════════════════════════════════════════════════════════════════════════
section("D7 — the .tnd import carries every blankMemory() key");

// The import's memory build is EXECUTED out of the shipped import body — since #423 (v1.953) that
// is state.js importSaveData, the engine half of importSave (it moved there verbatim; ui-files.js
// keeps the file read and the DOM refresh): the window from `var mm=data.memory||{};` to
// `migrateWorldState();` is sliced and run with the engine's own blankMemory/archiveRebuild in
// scope. A regex would only prove the shape of the code; this proves what it produces.
function importBody() {
  var s = code("state.js");
  var from = s.indexOf("function importSaveData("), to = s.indexOf("function updateCampMeta(", from);
  if (from < 0 || to < 0) throw new Error("could not locate importSaveData in state.js");
  return s.slice(from, to);
}
function runImportMemoryBuild(data) {
  var s = importBody();
  var from = s.indexOf("var mm=data.memory||{};");
  var to = s.indexOf("migrateWorldState();", from);
  if (from < 0 || to < 0) throw new Error("could not locate the import's memory window in state.js importSaveData");
  var body = s.slice(from, to);
  /* jshint evil:true */
  var f = new Function("data", "blankMemory", "archiveRebuild", "var memory;" + body + "\nreturn memory;");
  return f(data, blankMemory, archiveRebuild);
}
function fullMemory() {
  var m = blankMemory();
  m.npcs = { Hemlock: { attitude: "wary", knowledge: ["the broadsheet"], events: [], aliases: [] } };
  m.locations = { Ashfen: { notes: ["the bell"] } };
  m.quests = { q1: { name: "The Bell", by: "Hemlock", wasOffered: true } };
  m.lore = ["The bell was cast in Magnimar."];
  m.keyDecisions = ["spared the raider"];
  m.futureEvents = [{ what: "the tide turns", resolved: false }];
  m.chapters = [{ turn: 12, text: "chapter one" }];
  m.eras = [{ text: "the first era" }];
  m.nameIdx = 70;
  m.attitudeSpec = 2;
  m.map = { nodes: { Ashfen: { visits: 3 } }, edges: [["Ashfen", "The Reach"]], lastArrivalFrom: "The Reach" };
  m.npcGraph = { edges: [{ a: "Hemlock", b: "Tess" }], factions: { Guild: 1 }, factionEdges: [], npcFactions: { Hemlock: "Guild" } };
  m.archive.npcKnowledge = [{ npc: "Hemlock", fact: "old fact", turn: 3 }];
  m.archive.futureCategoryNobodyKnowsYet = [{ x: 1 }];
  return m;
}

t("every key of blankMemory() survives a .tnd round-trip, with its value", function () {
  var full = fullMemory();
  var got = runImportMemoryBuild({ memory: JSON.parse(JSON.stringify(full)) });
  var keys = Object.keys(blankMemory()), i, k, lost = [];
  for (i = 0; i < keys.length; i++) {
    k = keys[i];
    if (!(k in got)) { lost.push(k + " (key absent)"); continue; }
    if (JSON.stringify(got[k]) !== JSON.stringify(full[k])) lost.push(k + " (value changed: " + JSON.stringify(got[k]).slice(0, 60) + ")");
  }
  return lost.length ? "the import DROPPED " + lost.length + " memory field(s): " + lost.join(", ") : true;
});

t("nameIdx specifically — the name rotation no longer resets to 0 on every import", function () {
  var got = runImportMemoryBuild({ memory: { nameIdx: 70 } });
  return got.nameIdx === 70 ? true : "nameIdx came back as " + JSON.stringify(got.nameIdx) + " — the GM re-offers names it already spent";
});

t("a file with NO attitudeSpec marker leaves it undefined so the v1.383 heal still fires", function () {
  var got = runImportMemoryBuild({ memory: { npcs: {} } });
  return got.attitudeSpec === undefined ? true : "attitudeSpec was defaulted to " + got.attitudeSpec + ", suppressing the one-time clear on a pre-v1.383 file";
});

t("junk values are refused by the blank SHAPE, not by a second key list", function () {
  var got = runImportMemoryBuild({ memory: { lore: "not an array", npcs: 7, nameIdx: "seventy", chapters: null } });
  if (!Array.isArray(got.lore) || got.lore.length) return "a string became memory.lore";
  if (!got.npcs || typeof got.npcs !== "object") return "a number became memory.npcs";
  if (got.nameIdx !== undefined) return "a string nameIdx was carried (healMemory seeds 0 for undefined)";
  return Array.isArray(got.chapters) ? true : "a null chapters list did not fall back to []";
});

t("unknown archive categories still ride through verbatim (JP0-5 is not weakened)", function () {
  var got = runImportMemoryBuild({ memory: fullMemory() });
  return (got.archive && got.archive.futureCategoryNobodyKnowsYet && got.archive.futureCategoryNobodyKnowsYet.length === 1) ? true : "the unknown-category carry broke";
});

t("the build is DERIVED — no hand-listed field enumeration is left", function () {
  var s = importBody();
  var from = s.indexOf("var mm=data.memory||{};");
  var body = s.slice(from, s.indexOf("migrateWorldState();", from));
  if (body.indexOf("Object.keys(blankMemory())") < 0 && body.indexOf("blankMemory()") < 0) return "the import no longer derives its key list from blankMemory()";
  if (/keyDecisions:Array\.isArray\(mm\.keyDecisions\)/.test(body)) return "the hand-listed whitelist is back — the shape that lost five fields";
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════════
section("D11 — the unload path POSTs once");

t("snapshotActiveCamp({noSync:true}) skips the debounce flush; the default still flushes", function () {
  world("D11C"); setActiveCampId("D11C");
  store.set(WSK, '{"turn":40}'); store.set(SLK, "[]"); store.set(MEM_KEY, "{}");
  var flushes = 0, realSync = storageAdapter.syncNow;
  storageAdapter.syncNow = function () { flushes++; };
  var quiet, loud;
  try {
    snapshotActiveCamp({ noSync: true }); quiet = flushes;
    snapshotActiveCamp(); loud = flushes;
  } finally {
    storageAdapter.syncNow = realSync;
    removeCampaignLocalCopy("D11C"); store.del(WSK); store.del(SLK); store.del(MEM_KEY); setActiveCampId(null); store.del(CAMP_META_K);
  }
  if (quiet !== 0) return "the unload option still fired a plain, unload-abandoned POST";
  return loud === 1 ? true : "the ordinary snapshot stopped flushing (" + loud + ")";
});

t("the legacy quiet=true argument still means quiet (switchToCampaign's toast contract)", function () {
  world("D11Q"); setActiveCampId("D11Q");
  store.set(WSK, '{"turn":40}'); store.set(SLK, "[]"); store.set(MEM_KEY, "{}");
  var realSync = storageAdapter.syncNow, realMode = storageAdapter.isServerMode;
  storageAdapter.syncNow = function () {}; storageAdapter.isServerMode = function () { return false; };
  var out;
  try {
    out = withQuotaStore(1, function () { resetSinks(); return { ok: snapshotActiveCamp(true), toasts: toasts.slice() }; });
  } finally {
    storageAdapter.syncNow = realSync; storageAdapter.isServerMode = realMode;
    store.del(WSK); store.del(SLK); store.del(MEM_KEY); setActiveCampId(null); store.del(CAMP_META_K);
  }
  if (out.ok !== false) return "a total quota failure did not refuse";
  return out.toasts.length === 0 ? true : "quiet=true toasted anyway (the caller owns the message): " + JSON.stringify(out.toasts);
});

t("the unload handler passes it", function () {
  return /beforeunload[\s\S]{0,120}snapshotActiveCamp\(\{noSync:true\}\)/.test(code("ui-boot.js")) ? true : "beforeunload still fires two POSTs of the same state, the first of them abandoned by the browser";
});

// ═══════════════════════════════════════════════════════════════════════════════
section("D14 — the SW serves /dev/ network-first");

t("the network-first REGEX itself covers /dev/ (not a comment mention)", function () {
  var s = src("sw.js");/* raw: the regex LITERAL is the thing under test, and stripping // comments would eat its own trailing \/DOC\// */
  var m = s.match(/if\(\/([^\n]+?)\/\.test\(e\.request\.url\)\)/);
  if (!m) return "could not locate sw.js's network-first regex — the fetch-handler shape changed";
  if (m[1].indexOf("\\/dev\\/") < 0) return "test.html's suite and map_cleanup's repair core still fall through to cache-first, and neither bumps CACHE";
  var re = new RegExp(m[1]);
  if (!re.test("https://x.test/dev/engine-tests.js")) return "the regex does not actually match a /dev/ script";
  return re.test("https://x.test/game/state.js") ? "the regex now swallows an app-shell file" : true;
});

t("nothing under /dev/ is in APP_SHELL (so this costs no precache bandwidth)", function () {
  var s = src("sw.js");
  var shell = s.slice(s.indexOf("var APP_SHELL = ["), s.indexOf("];", s.indexOf("var APP_SHELL = [")));
  return shell.indexOf("/dev/") < 0 ? true : "a /dev/ file is precached AND network-first — it would re-download every load";
});

// ═══════════════════════════════════════════════════════════════════════════════
section("E3 — campaign transport is busy-gated");

t("campCloudPull and campRemoveLocal refuse while a turn is in flight", function () {
  var s = code("ui-campaigns.js");
  // Slice on CODE anchors only: code() has stripped the comments, so a comment boundary resolves to
  // -1 and the slice silently runs to the end of the file — a clause satisfied by the NEXT
  // function's gate. (That is exactly how this pair first read green against the unfixed source.)
  var pull = s.slice(s.indexOf("function campCloudPull("), s.indexOf("function campRemoveLocal("));
  var rem = s.slice(s.indexOf("function campRemoveLocal("), s.indexOf("function campDelete("));
  if (pull.length < 200 || rem.length < 200) return "could not locate campCloudPull/campRemoveLocal";
  if (!/typeof busy!=="undefined"&&busy/.test(pull)) return "campCloudPull replaces live worldState/memory with no busy gate — an in-flight turn writes into the discarded objects";
  if (!/typeof busy!=="undefined"&&busy/.test(rem)) return "campRemoveLocal is ungated — its push-then-evict reads the store mid-turn";
  return true;
});

// ═══════════════════════════════════════════════════════════════════════════════
section("E15 — the swallowed data conditions in these files now speak");

t("the campaign-list rescue no longer claims a backup it may not have written", function () {
  var s = code("state.js");
  var slice = s.slice(s.indexOf("function getCampMeta("), s.indexOf("function setCampMeta("));
  if (/catch\(x\)\{\}/.test(slice)) return "the backup write is still swallowed — the console line claims a backup that does not exist";
  return slice.indexOf("could NOT be preserved") >= 0 ? true : "the failure case is not reported";
});

t("the rename slot patch and the local-turn parse report what was lost", function () {
  var s = code("ui-campaigns.js");
  if (/catch\(e\)\{\}/.test(s)) return "an empty catch(e){} is still swallowing a data condition in ui-campaigns.js";
  if (/catch\(x\)\{\}/.test(s)) return "an empty catch(x){} is still swallowing a data condition in ui-campaigns.js";
  return true;
});

t("the remaining silent catches in these files are storage/feature probes that say WHY", function () {
  var files = ["state.js", "storage-adapter.js"], i, bad = [];
  for (i = 0; i < files.length; i++) {
    var s = code(files[i]);
    var re = /catch\s*\(\s*\w*\s*\)\s*\{\s*\}/g, m;
    while ((m = re.exec(s))) {
      var line = s.slice(0, m.index).split("\n").length;
      bad.push(files[i] + ":" + line);
    }
  }
  // Known-and-explained probes carry a comment INSIDE the catch, so they no longer match the
  // empty-catch pattern above at all; anything still matching is unexplained.
  return bad.length ? "unexplained empty catch(es): " + bad.join(", ") : true;
});

t("the JP0-4 rescue keys are joined by the campaign-list one, and nothing deletes any of them", function () {
  var files = fs.readdirSync(ROOT).filter(function (f) { return /\.js$/.test(f); }), i, bad = [];
  for (i = 0; i < files.length; i++) {
    var s = fs.readFileSync(path.join(ROOT, files[i]), "utf8");
    if (/store\.del\(\s*(STORE_RESCUE_K|CLOCK_RESCUE_K|CAMP_META_RESCUE_K)/.test(s)) bad.push(files[i]);
    if (/(store\.del|localStorage\.removeItem)\(\s*["']tnd_camps_v1_corrupt["']/.test(s)) bad.push(files[i] + " (literal)");
  }
  if (bad.length) return "a shipped file deletes a rescue key: " + bad.join(", ");
  return /var CAMP_META_RESCUE_K="tnd_camps_v1_corrupt";/.test(code("state.js")) ? true : "the campaign-list rescue slot is an anonymous literal again — invisible to the rescue-key policy (D12)";
});

// ── report ───────────────────────────────────────────────────────────────────
chain.then(function () {
  releaseConsole();
  if (fails.length) {
    console.error("AUDIT SYNC TESTS FAILED (" + fails.length + " of " + (pass + fails.length) + "):");
    for (var f = 0; f < fails.length; f++) console.error("  ✗ " + fails[f]);
    process.exit(1);
  }
  console.log("ALL GREEN — " + pass + " assertions passed (audit D + E3/E15: state, storage, cloud sync)");
  process.exit(0);
});
