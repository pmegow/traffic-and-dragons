// tests-423-import-ownership.js — #423: an imported save must never write over another account's
// cloud campaign (research doc DOC/Research/remote_player_exploration.html §14 finding S1).
//
// The defect on the client side: importSave adopted the .tnd file's own campId ("reuse the file's
// own campId if present"), and the next autosave POSTed that id. Server-side the upsert keyed on id
// alone, so a friend importing an exported save overwrote the sender's row — no malice, no guessing.
// The server now refuses a foreign id with 403 + reason "foreign_campaign" (server test-state-
// ownership.mjs). This battery pins the CLIENT half:
//   • resolveImportedCampaignId — the file's id is reused only when THIS account/device already owns
//     it (campaign list or a local slot); otherwise a fresh id is minted. Legacy files without an id
//     keep their old landing (the active campaign, else a new one).
//   • rehomeCampaign — moving the active campaign to a fresh id carries everything keyed by the old
//     one: the local slot, the campaign-list row (its onServer flag dropped), the JP0-11 unsynced
//     marker, memory.campId (#365 owner stamp), the held checkpoint, the live worldState.campId.
//   • the sync path — a 403 with reason foreign_campaign re-homes ONCE and retries; any other 403 is
//     an ordinary sync failure; the retry is loop-bounded; the unsynced marker clears only on the 200.
//   • the honest case — account B imports account A's export through the REAL import core
//     (importSaveData, the engine half of importSave), plays a turn, syncs: A's row is unchanged, B's
//     campaign lands under a new id, and no #365 owner mismatch is left behind.
//
// Transport: by default a CONTRACT STUB of the server (rows per user, the 403 reason, the CAS 409),
// so CI needs no server. With TND_SERVER_DIR=<path to traffic-and-dragons-server> the same scenarios
// run against the REAL server on a scratch database (dev-login for A, a synthetic user B) — the proof
// that both halves agree on the wire. The one stub-only scenario (a server that 403s everything, for
// the loop bound) says so loudly instead of skipping silently.
//   node dev/tests-423-import-ownership.js
//   TND_SERVER_DIR=C:/Users/hannu/Projects/traffic-and-dragons-server node dev/tests-423-import-ownership.js
// ES5 throughout, matching the engine.

var fs = require("fs");
var path = require("path");
var cp = require("child_process");
var root = path.join(__dirname, "..");
var files = require("./engine-manifest.js").map(function (entry) { return entry.file; });
var geval = eval;
for (var i = 0; i < files.length; i++) {
  try { geval(fs.readFileSync(path.join(root, files[i]), "utf8")); }
  catch (e) { console.error("ENGINE LOAD FAILED in " + files[i] + ": " + e.message); process.exit(1); }
}

// ── Reporter (mirrors tests-jp011-flush-dirty.js) ────────────────────────────
var pass = 0, fails = [], curSection = "";
function section(name) { curSection = name; }
// The chain is GATED on bring-up: in REAL mode the scenarios must not start before the server answers
// /health (they queue as microtasks at load, and the first POST used to race the spawn: ECONNREFUSED).
var _startGate = null;
var chain = new Promise(function (res) { _startGate = res; });
function tAsync(name, fn) {
  var label = curSection + " › " + name;
  chain = chain.then(function () {
    return Promise.resolve().then(fn).then(
      function (r) { if (r === true || r === undefined) pass++; else fails.push(label + " — " + r); },
      function (e) { fails.push(label + " — threw: " + (e && e.stack || e)); }
    );
  });
}
function waitFor(pred, ms) {
  var t0 = Date.now();
  return new Promise(function (res) {
    (function tick() { if (pred() || Date.now() - t0 > ms) res(); else setTimeout(tick, 15); })();
  });
}
function settle(ms) { return new Promise(function (res) { setTimeout(res, ms || 60); }); }

// ── DOM/UI sinks ─────────────────────────────────────────────────────────────
var toasts = [], warns = [], infos = [];
global.showToast = function (m) { toasts.push(String(m)); };
global.addMsg = function () {};
global.syncUI = function () {};
global.showGame = function () {};
global.rebuildNarrativeFromTranscript = function () { return true; };
global.busy = false;
var _realWarn = console.warn, _realInfo = console.info;
console.warn = function () { warns.push(Array.prototype.slice.call(arguments).join(" ")); };
console.info = function () { infos.push(Array.prototype.slice.call(arguments).join(" ")); };

// ── Transport: contract stub or the real server ──────────────────────────────
var SERVER_DIR = process.env.TND_SERVER_DIR || "";
var REAL = !!SERVER_DIR;
var BASE = REAL ? "http://127.0.0.1:4695" : "https://unit.test";
var TOK_A = "TOK_A", TOK_B = "TOK_B";      // replaced by real session ids in REAL mode
var calls = [];                             // every request, both transports
var realFetch = global.fetch;
var stub = { rows: {}, users: { TOK_A: "userA", TOK_B: "userB" }, seq: 0, forceForeign: false };
function jres(status, data) { return Promise.resolve({ ok: status >= 200 && status < 300, status: status, json: function () { return Promise.resolve(data); }, text: function () { return Promise.resolve(JSON.stringify(data)); } }); }
function stubFetch(url, opts) {
  opts = opts || {};
  var method = opts.method || "GET", p = url.slice(BASE.length);
  var tok = ((opts.headers || {}).Authorization || "").replace(/^Bearer /, "");
  var user = stub.users[tok]; if (!user) return jres(401, { error: "Not logged in" });
  var m;
  if (method === "POST" && p === "/api/state") {
    var body = JSON.parse(opts.body);
    var id = body.campaignId || ("camp_" + user + "_" + Date.now());
    var row = stub.rows[id];
    if (stub.forceForeign || (row && row.user !== user)) return jres(403, { error: "campaign belongs to another account", reason: "foreign_campaign", campaignId: id });
    if (body.campaignId && typeof body.baseTurn === "number" && row && typeof row.ws.turn === "number" && row.ws.turn > body.baseTurn) return jres(409, { error: "conflict", serverTurn: row.ws.turn, baseTurn: body.baseTurn });
    stub.rows[id] = { user: user, ws: body.worldState, sl: body.sessionLog, mem: body.memory, name: body.worldState.campName || "", seq: ++stub.seq };
    return jres(200, { ok: true, campaignId: id });
  }
  if (method === "GET" && (m = p.match(/^\/api\/campaigns\/([^\/]+)\/turn$/))) { var r1 = stub.rows[decodeURIComponent(m[1])]; return (r1 && r1.user === user) ? jres(200, { campaignId: m[1], turn: r1.ws.turn || 0 }) : jres(404, { error: "Not found" }); }
  if (method === "GET" && (m = p.match(/^\/api\/campaigns\/([^\/]+)\/checkpoint$/))) return jres(200, { checkpoint: null, snapshot: null });
  if (method === "PUT" && (m = p.match(/^\/api\/campaigns\/([^\/]+)\/portrait$/))) { var r2 = stub.rows[decodeURIComponent(m[1])]; return (r2 && r2.user === user) ? jres(200, { ok: true }) : jres(404, { error: "Not found" }); }
  if (method === "GET" && (m = p.match(/^\/api\/campaigns\/([^\/]+)$/))) { var r3 = stub.rows[decodeURIComponent(m[1])]; return (r3 && r3.user === user) ? jres(200, { worldState: r3.ws, sessionLog: r3.sl, memory: r3.mem, campaignId: m[1] }) : jres(404, { error: "Not found" }); }
  if (method === "GET" && p === "/api/campaigns") { var list = []; Object.keys(stub.rows).forEach(function (k) { if (stub.rows[k].user === user) list.push({ id: k, name: stub.rows[k].name, turn: stub.rows[k].ws.turn || 0 }); }); return jres(200, list); }
  if (method === "GET" && p === "/api/state") { var best = null, bk = null; Object.keys(stub.rows).forEach(function (k) { if (stub.rows[k].user === user && (!best || stub.rows[k].seq > best.seq)) { best = stub.rows[k]; bk = k; } }); return best ? jres(200, { worldState: best.ws, sessionLog: best.sl, memory: best.mem, campaignId: bk }) : jres(200, { worldState: null }); }
  return jres(200, {});
}
global.fetch = function (url, opts) {
  opts = opts || {};
  calls.push({ url: url, method: opts.method || "GET", body: opts.body, auth: (opts.headers || {}).Authorization || "" });
  if (!REAL) return stubFetch(url, opts);
  return realFetch(url, opts).catch(function (e) { throw new Error("fetch failed for " + (opts.method || "GET") + " " + url + " — " + (e && e.cause ? (e.cause.code || e.cause.message) : (e && e.message))); });
};
// The server's view of a row, through the API — the same question in both transports.
function serverRow(token, id) {
  return fetch(BASE + "/api/campaigns/" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + token } })
    .then(function (r) { return r.status === 200 ? r.json() : null; })
    .then(function (d) { return d ? JSON.stringify({ ws: d.worldState, sl: d.sessionLog, mem: d.memory }) : null; });
}
function serverList(token) {
  return fetch(BASE + "/api/campaigns", { headers: { Authorization: "Bearer " + token } }).then(function (r) { return r.json(); });
}
function postAs(token, campaignId, turn, who, baseTurn) {
  var body = { worldState: { turn: turn, campId: campaignId, character: { name: who, inventory: [], abilities: [], spells: [] }, campName: who + "'s campaign", world: { location: "Sandpoint" }, npcs: [], questLog: [], eventHistory: [], transcript: [] }, sessionLog: [{ t: turn }], memory: { campId: campaignId }, campaignId: campaignId, narrativeHtml: "" };
  if (typeof baseTurn === "number") body.baseTurn = baseTurn;
  return fetch(BASE + "/api/state", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(body) }).then(function (r) { return r.status; });
}

// ── Real-server bring-up (REAL mode only) ────────────────────────────────────
var server = null, scratchDir = null;
function bringUpRealServer() {
  var os = require("os");
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-422-"));
  var dbPath = path.join(scratchDir, "test.db");
  server = cp.spawn(process.execPath, ["index.js"], { cwd: SERVER_DIR, stdio: ["ignore", "pipe", "pipe"], env: Object.assign({}, process.env, { PORT: "4695", DB_PATH: dbPath, DEV_LOGIN_SECRET: "own-422" }) });
  var logs = ""; server.stdout.on("data", function (d) { logs += d; }); server.stderr.on("data", function (d) { logs += d; });
  var tries = 0;
  function ping() { return realFetch(BASE + "/health").then(function (r) { return r.ok; }, function () { return false; }); }
  function untilUp() { return ping().then(function (ok) { if (ok) return; if (++tries > 80) throw new Error("real server never became healthy: " + logs); return settle(100).then(untilUp); }); }
  return untilUp().then(function () {
    return realFetch(BASE + "/auth/dev-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: "own-422" }) }).then(function (r) { return r.json(); });
  }).then(function (d) {
    TOK_A = d.sessionId;
    var Database = require(path.join(SERVER_DIR, "node_modules", "better-sqlite3"));
    var db = new Database(dbPath);
    db.prepare("INSERT INTO users(id,username) VALUES('userB','Friend')").run();
    db.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES('sess-B','userB',?)").run(new Date(Date.now() + 86400000).toISOString());
    db.close();
    TOK_B = "sess-B";
    console.log("[423] REAL transport: server up at " + BASE + ", A=dev_local, B=userB");
  });
}
function tearDownRealServer() {
  if (server) { try { server.kill(); } catch (e) {} }
  return settle(250).then(function () { if (scratchDir) { try { fs.rmSync(scratchDir, { recursive: true, force: true }); } catch (e) {} } });
}

// ── Fixture ──────────────────────────────────────────────────────────────────
var A_ID = "camp_1758000000000_4242";   // A's real campaign id — the shape newCampaignId() mints, carried by every export
function freshWorld(turn, campId, who) {
  return { turn: turn, campId: campId, campName: who + "'s campaign", character: { name: who, hp: 20, maxHp: 20, inventory: [], abilities: [], spells: [], portrait: null }, world: { location: "Sandpoint" }, npcs: [], questLog: [], eventHistory: [], transcript: [{ t: turn, r: "gm", x: "The pier burns." }] };
}
function wipeLocal() {
  // every campaign-scoped key this battery may have written, plus the live triple and the list
  var meta = getCampMeta();
  meta.forEach(function (m) { removeCampaignLocalCopy(m.id, { teardown: true }); });
  removeCampaignLocalCopy(A_ID, { teardown: true });
  setCampMeta([]); store.del(WSK); store.del(SLK); store.del(MEM_KEY); setActiveCampId(null);
  worldState = null; sessionLog = []; memory = blankMemory();
  calls.length = 0; toasts.length = 0; warns.length = 0; infos.length = 0;
  storageAdapter.resetSyncState();
}
function connectAs(token) { storageAdapter.setServer(BASE, token); storageAdapter.resetSyncState(); }
function lastPosts() { return calls.filter(function (c) { return c.method === "POST" && c.url === BASE + "/api/state"; }); }

// ── (1) the import decision ──────────────────────────────────────────────────
section("#423 — resolveImportedCampaignId");

tAsync("a file id already in this device's campaign list is reused (my own export, re-imported)", function () {
  wipeLocal();
  setCampMeta([{ id: A_ID, campName: "Mine", charName: "Tess", onServer: true }]);
  var plan = resolveImportedCampaignId(A_ID);
  if (plan.id !== A_ID) return "expected reuse of " + A_ID + ", got " + plan.id;
  if (plan.reminted) return "reminted flag set on a reuse";
});
tAsync("a file id that only has a local slot (no list row) is reused too — the slot IS ownership here", function () {
  wipeLocal();
  store.set(campSlotKey(A_ID, "ws"), serializeWorldState(freshWorld(3, A_ID, "Tess")));
  var plan = resolveImportedCampaignId(A_ID);
  return plan.id === A_ID && !plan.reminted ? true : "slot-only id was not reused: " + JSON.stringify(plan);
});
tAsync("a file id this device has never seen is RE-MINTED — a fresh camp_<ts>_<4 digits> id", function () {
  wipeLocal();
  var plan = resolveImportedCampaignId(A_ID);
  if (plan.id === A_ID) return "the foreign id was adopted";
  if (!plan.reminted) return "reminted flag missing";
  if (!/^camp_\d+_\d{4}$/.test(plan.id)) return "minted id has the wrong shape: " + plan.id;
});
tAsync("legacy file without an id keeps the old landing: the active campaign, else a new one", function () {
  wipeLocal();
  setActiveCampId("camp_1_0001");
  var p1 = resolveImportedCampaignId(null);
  if (p1.id !== "camp_1_0001" || p1.reminted) return "active id not kept for a legacy file: " + JSON.stringify(p1);
  setActiveCampId(null);
  var p2 = resolveImportedCampaignId("");
  if (!/^camp_\d+_\d{4}$/.test(p2.id) || p2.reminted) return "no active + no file id should mint quietly: " + JSON.stringify(p2);
});

// ── (2) re-homing ────────────────────────────────────────────────────────────
section("#423 — rehomeCampaign");

tAsync("everything keyed by the old id moves: slot, list row (onServer dropped), unsynced marker, memory stamp, checkpoint, live id", function () {
  wipeLocal();
  worldState = freshWorld(7, A_ID, "Tess"); sessionLog = [{ t: 7 }]; memory = blankMemory(); memory.campId = A_ID;
  setActiveCampId(A_ID); saveLocal();
  store.set(campSlotKey(A_ID, "ws"), serializeWorldState(worldState)); store.set(campSlotKey(A_ID, "sl"), "[]"); store.set(campSlotKey(A_ID, "mem"), JSON.stringify(memory));
  var meta = getCampMeta(); meta[0].onServer = true; setCampMeta(meta);
  storageAdapter.clearFlushDirty(A_ID);
  // an unsynced marker for the old id, and a held checkpoint stamped with it
  storageAdapter.flushDirtyTurn(A_ID);
  var mk = JSON.parse(store.get("tnd_sync_dirty_v1") || "{}"); mk[A_ID] = 7; store.set("tnd_sync_dirty_v1", JSON.stringify(mk));
  var camp = checkpointCapture("camp"); if (!camp) return "fixture: no checkpoint captured";
  var nid = rehomeCampaign("test");
  if (!nid || nid === A_ID || !/^camp_\d+_\d{4}$/.test(nid)) return "bad new id: " + nid;
  if (getActiveCampId() !== nid) return "active id not moved";
  if (worldState.campId !== nid) return "worldState.campId not moved";
  if (memory.campId !== nid) return "memory.campId not restamped (#365 would fire on the next load)";
  if (memoryOwnerMismatch(worldState, memory)) return "owner mismatch after rehome";
  if (store.get(campSlotKey(A_ID, "ws")) != null) return "old slot still present";
  if (store.get(campSlotKey(nid, "ws")) == null) return "new slot missing";
  var m2 = getCampMeta(), row = null; m2.forEach(function (r) { if (r.id === nid) row = r; if (r.id === A_ID) row = row || "OLD"; });
  if (row === "OLD" || !row) return "campaign-list row not re-keyed: " + JSON.stringify(m2);
  if (row.onServer) return "onServer flag survived the rehome — the picker would believe the cloud holds this id";
  if (storageAdapter.flushDirtyTurn(A_ID) !== null) return "unsynced marker still keyed by the old id";
  if (storageAdapter.flushDirtyTurn(nid) !== 7) return "unsynced marker did not move to the new id (got " + storageAdapter.flushDirtyTurn(nid) + ")";
  var held = checkpointHeld(); if (!held) return "held checkpoint was dropped by the id change";
  if (held.campId !== nid) return "held checkpoint not restamped";
});
tAsync("a memory stamped for a DIFFERENT campaign is left alone — the #365 signal is not silenced", function () {
  wipeLocal();
  worldState = freshWorld(2, A_ID, "Tess"); memory = blankMemory(); memory.campId = "camp_9_9999";
  setActiveCampId(A_ID);
  rehomeCampaign("test");
  return memory.campId === "camp_9_9999" ? true : "a foreign memory stamp was rewritten: " + memory.campId;
});

// ── (3) the sync path ────────────────────────────────────────────────────────
section("#423 — sync 403 foreign_campaign → re-home once → retry");

tAsync("a device already carrying another account's id (a pre-fix import) re-homes on the first 403 and lands under its own id; A's row is untouched", function () {
  wipeLocal();
  return postAs(TOK_A, A_ID, 5, "Tess").then(function (st) {
    if (st !== 200) return "fixture: A's save returned " + st;
    return serverRow(TOK_A, A_ID);
  }).then(function (aBefore) {
    if (!aBefore) return "fixture: A's row not readable";
    connectAs(TOK_B);
    worldState = freshWorld(3, A_ID, "Tess"); sessionLog = [{ t: 3 }]; memory = blankMemory(); memory.campId = A_ID;
    setActiveCampId(A_ID); saveLocal();
    var mk = {}; mk[A_ID] = 3; store.set("tnd_sync_dirty_v1", JSON.stringify(mk));
    calls.length = 0;
    storageAdapter.syncNow();
    return waitFor(function () { return lastPosts().length >= 2; }, 4000).then(function () { return settle(120); }).then(function () {
      var posts = lastPosts();
      if (posts.length !== 2) return "expected exactly 2 POSTs (403 then the re-homed retry), saw " + posts.length;
      var b1 = JSON.parse(posts[0].body), b2 = JSON.parse(posts[1].body);
      if (b1.campaignId !== A_ID) return "first POST did not carry the foreign id";
      var nid = getActiveCampId();
      if (nid === A_ID) return "the campaign was not re-homed";
      if (b2.campaignId !== nid) return "the retry did not carry the new id (" + b2.campaignId + " vs " + nid + ")";
      if (b2.worldState.campId !== nid) return "the retried blob still says campId=" + b2.worldState.campId;
      if (storageAdapter.flushDirtyTurn(nid) !== null) return "the unsynced marker did not clear on the retry's 200";
      if (!toasts.some(function (t) { return /another account/i.test(t); })) return "no toast named the cause: " + JSON.stringify(toasts);
      if (!warns.some(function (w) { return /foreign_campaign|another account/i.test(w); })) return "no console.warn recorded the re-home";
      return serverRow(TOK_A, A_ID).then(function (aAfter) {
        if (aAfter !== aBefore) return "A's row CHANGED";
        return serverRow(TOK_B, nid);
      }).then(function (bRow) {
        if (!bRow) return "B's campaign did not land under the new id";
        if (JSON.parse(bRow).ws.turn !== 3) return "B's row carries the wrong turn";
        return serverList(TOK_B);
      }).then(function (list) {
        return list.some(function (c) { return c.id === A_ID; }) ? "A's id appears in B's list" : true;
      });
    });
  });
});
tAsync("any other 403 is an ordinary sync failure — no re-home, no id churn", function () {
  wipeLocal(); connectAs(TOK_B);
  var keep = global.fetch;
  global.fetch = function (url, opts) { calls.push({ url: url, method: (opts && opts.method) || "GET", body: opts && opts.body }); return (opts && opts.method === "POST") ? jres(403, { error: "Forbidden" }) : keep(url, opts); };
  worldState = freshWorld(1, "camp_2_0002", "Brin"); memory = blankMemory(); setActiveCampId("camp_2_0002"); saveLocal();
  storageAdapter.syncNow();
  return settle(200).then(function () {
    global.fetch = keep;
    if (getActiveCampId() !== "camp_2_0002") return "re-homed on a 403 without the reason code";
    if (lastPosts().length !== 1) return "expected one POST, saw " + lastPosts().length;
    if (storageAdapter.syncStatus().failCount !== 1) return "the failure was not counted: " + JSON.stringify(storageAdapter.syncStatus());
  });
});
tAsync("the re-home is loop-bounded: a server that 403s everything gets at most two POSTs and a counted failure" + (REAL ? " [STUB-ONLY — the real server cannot be made to lie; not run in this transport]" : ""), function () {
  if (REAL) { console.log("[423] loop-bound scenario NOT RUN against the real server (needs a lying server) — covered by the stub run"); return true; }
  wipeLocal(); connectAs(TOK_B);
  stub.forceForeign = true;
  worldState = freshWorld(1, "camp_3_0003", "Brin"); memory = blankMemory(); memory.campId = "camp_3_0003"; setActiveCampId("camp_3_0003"); saveLocal();
  storageAdapter.syncNow();
  return settle(250).then(function () {
    stub.forceForeign = false;
    var n = lastPosts().length;
    if (n !== 2) return "expected exactly 2 POSTs (one re-home), saw " + n;
    if (getActiveCampId() === "camp_3_0003") return "no re-home happened";
    if (storageAdapter.syncStatus().failCount < 1) return "the second refusal was not surfaced as a failure";
  });
});

// ── (4) the honest case ──────────────────────────────────────────────────────
section("#423 — the honest case: B imports A's export, plays a turn, syncs");

tAsync("A's row is unchanged, B's campaign saves under a new id, no #365 mismatch", function () {
  wipeLocal();
  return postAs(TOK_A, A_ID, 5, "Tess").then(function (st) {
    if (st !== 200) return "fixture: A's save returned " + st;
    return serverRow(TOK_A, A_ID);
  }).then(function (aBefore) {
    // A's .tnd export — exactly what exportSave writes: {worldState, sessionLog, memory}
    var aWorld = freshWorld(5, A_ID, "Tess"); var aMem = blankMemory(); aMem.campId = A_ID;
    var exportFile = JSON.parse(JSON.stringify({ worldState: aWorld, sessionLog: [{ t: 5 }], memory: aMem }));
    // B's device: signed in as B, its own unrelated campaign active
    connectAs(TOK_B);
    worldState = freshWorld(2, "camp_4_0004", "Brin"); memory = blankMemory(); memory.campId = "camp_4_0004"; setActiveCampId("camp_4_0004"); saveLocal();
    calls.length = 0; toasts.length = 0;
    var result = importSaveData(exportFile);
    if (!result || !result.reminted) return "the import did not re-mint: " + JSON.stringify(result);
    var nid = getActiveCampId();
    if (nid === A_ID) return "the import adopted A's id";
    if (result.id !== nid) return "result id disagrees with the active id";
    if (worldState.campId !== nid) return "worldState.campId=" + worldState.campId;
    if (memory.campId !== nid) return "memory.campId=" + memory.campId + " — #365 would fire on the next load";
    if (memoryOwnerMismatch(worldState, memory)) return "owner mismatch after import";
    if (worldState.character.name !== "Tess" || worldState.turn !== 5) return "imported state is not A's export";
    if (!toasts.some(function (t) { return /new campaign/i.test(t); })) return "no toast told the player the import landed as a new campaign: " + JSON.stringify(toasts);
    // the outgoing campaign was snapshotted, not lost (E12)
    if (store.get(campSlotKey("camp_4_0004", "ws")) == null) return "B's outgoing campaign lost its slot on import";
    // play a turn, then sync
    worldState.turn = 6; worldState.transcript.push({ t: 6, r: "gm", x: "Tess draws her blade." });
    saveAll(); storageAdapter.syncNow();
    return waitFor(function () { return lastPosts().length >= 1 && storageAdapter.syncStatus().lastAckTurn >= 6; }, 4000).then(function () { return settle(100); }).then(function () {
      var posts = lastPosts();
      if (!posts.length) return "no sync POST fired";
      for (var k = 0; k < posts.length; k++) if (JSON.parse(posts[k].body).campaignId === A_ID) return "a POST carried A's id";
      if (storageAdapter.flushDirtyTurn(nid) !== null) return "an unsynced marker is standing after the 200";
      return serverRow(TOK_A, A_ID).then(function (aAfter) {
        if (aAfter !== aBefore) return "A's row CHANGED after B's import+turn+sync";
        return serverRow(TOK_B, nid);
      }).then(function (bRow) {
        if (!bRow) return "B's campaign did not land under " + nid;
        var b = JSON.parse(bRow);
        if (b.ws.turn !== 6 || b.ws.character.name !== "Tess") return "B's row is not the played turn: " + JSON.stringify(b.ws).slice(0, 120);
        if (b.mem.campId !== nid) return "B's synced memory is stamped " + b.mem.campId;
        return serverList(TOK_A);
      }).then(function (aList) {
        if (!aList.some(function (c) { return c.id === A_ID; })) return "A lost its campaign from the list";
        return aList.some(function (c) { return c.id === nid; }) ? "B's new campaign leaked into A's list" : true;
      });
    });
  });
});
tAsync("re-importing MY OWN export keeps its id (the cross-device workflow still works)", function () {
  wipeLocal(); connectAs(TOK_A);
  setCampMeta([{ id: A_ID, campName: "Tess's campaign", charName: "Tess", onServer: true }]);
  var aWorld = freshWorld(5, A_ID, "Tess"); var aMem = blankMemory(); aMem.campId = A_ID;
  var result = importSaveData(JSON.parse(JSON.stringify({ worldState: aWorld, sessionLog: [], memory: aMem })));
  if (result.reminted || result.id !== A_ID) return "own export was re-minted: " + JSON.stringify(result);
  return getActiveCampId() === A_ID ? true : "active id is " + getActiveCampId();
});
tAsync("a malformed file still fails loudly through the same core (no partial adoption)", function () {
  wipeLocal(); setActiveCampId("camp_5_0005"); worldState = freshWorld(1, "camp_5_0005", "Brin"); memory = blankMemory();
  var threw = null; try { importSaveData({ worldState: { character: { name: 42 } } }); } catch (e) { threw = e.message; }
  if (!threw) return "invalid character data was accepted";
  return getActiveCampId() === "camp_5_0005" && worldState.campId === "camp_5_0005" ? true : "the active campaign was repointed before validation failed";
});

// ── run ──────────────────────────────────────────────────────────────────────
var boot = REAL ? bringUpRealServer() : Promise.resolve();
boot.then(function () { _startGate(); return chain; }).then(function () { return tearDownRealServer(); }).then(function () {
  console.warn = _realWarn; console.info = _realInfo;
  var mode = REAL ? "REAL server" : "contract stub";
  if (fails.length) {
    console.error("#423 IMPORT OWNERSHIP TESTS FAILED (" + fails.length + " of " + (pass + fails.length) + ", " + mode + "):");
    for (var f = 0; f < fails.length; f++) console.error("  ✗ " + fails[f]);
    process.exit(1);
  }
  console.log("ALL GREEN — " + pass + " assertions passed (#423 import ownership, " + mode + ")");
  process.exit(0);
}, function (e) {
  console.warn = _realWarn; console.info = _realInfo;
  console.error("#423 battery could not run: " + (e && e.stack || e));
  return tearDownRealServer().then(function () { process.exit(1); });
});
