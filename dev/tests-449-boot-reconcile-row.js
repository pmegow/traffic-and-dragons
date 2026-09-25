// tests-449-boot-reconcile-row.js — #449 (field, 2026-09-24): the boot reconcile adopts THIS campaign's cloud row.
//
// Why a standalone battery: these assertions drive storageAdapter.load(), which re-reads the store and REPLACES
// the live worldState/sessionLog/memory globals — it cannot share engine-tests.js's fixture (the JP0-11 precedent).
// Own fetch stub, own store seeding, own toast/console sinks. Run directly:
//   node dev/tests-449-boot-reconcile-row.js
//
// The defect being pinned: GET /api/state answers with the account's most recently UPDATED campaign, whichever one.
// A desktop parked on campaign A (turn 35) while the phone played A to turn 51 and then played B never adopted A's
// row — the identity guard refused B's blob on every reload, SILENTLY, while the per-campaign CAS kept answering
// 409 "reload to adopt it". The reconcile now asks for the active campaign's own row; only a fresh device (no local
// campaign at all) takes the account's latest. ES5 throughout, matching the engine.

var fs = require("fs");
var path = require("path");
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
var chain = Promise.resolve();
function tAsync(name, fn) {
  var label = curSection + " › " + name;
  chain = chain.then(function () {
    return Promise.resolve().then(fn).then(
      function (r) { if (r === true || r === undefined) pass++; else fails.push(label + " — " + r); },
      function (e) { fails.push(label + " — threw: " + e.message); }
    );
  });
}

// ── Stubs ────────────────────────────────────────────────────────────────────
var BASE = "https://unit.test";
var calls = [];
var responder = null;   // function(url, opts) → Promise|null (null = default 200 {})
global.fetch = function (url, opts) {
  opts = opts || {};
  calls.push({ url: url, method: opts.method || "GET", body: opts.body });
  var r = responder ? responder(url, opts) : null;
  return r || Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } });
};
function ok(data) { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(data || {}); } }); }
function httpErr(status, data) { return Promise.resolve({ ok: false, status: status, json: function () { return Promise.resolve(data || {}); } }); }
function settle() { return new Promise(function (res) { setTimeout(res, 40); }); }

var toasts = [], warns = [], errors = [];
global.showToast = function (m) { toasts.push(String(m)); };
global.addMsg = function () {};
global.syncUI = function () {};
global.showGame = function () {};
global.initAbilities = function () {};
global.initSpells = function () {};
global.rebuildNarrativeFromTranscript = function () { return true; };
global.busy = false;
console.warn = function () { warns.push(Array.prototype.slice.call(arguments).join(" ")); };
console.error = function () { errors.push(Array.prototype.slice.call(arguments).join(" ")); };
console.info = function () {};

// ── Fixture ──────────────────────────────────────────────────────────────────
var A = "camp_1700000000000_0449", B = "camp_1700000000001_0450";
function blob(campId, turn, hero) {
  return { worldState: { turn: turn, campId: campId, character: { name: hero, hp: 20, maxHp: 20, inventory: [], abilities: [], spells: [] },
                         world: { location: "The Deep Filtration Sump" }, npcs: [], questLog: [], eventHistory: [],
                         transcript: [{ t: turn, r: "gm", x: "Turn " + turn + " of " + campId + "." }] },
           sessionLog: [], memory: blankMemory(), portrait: null, npcPortraits: null, campaignId: campId, updatedAt: 1 };
}
function seedLocal(turn) {
  var ws = blob(A, turn, "Ammut").worldState;
  store.set(WSK, serializeWorldState(ws));
  store.set(SLK, "[]");
  store.set(MEM_KEY, JSON.stringify(blankMemory()));
  setActiveCampId(A);
  worldState = ws; sessionLog = []; memory = blankMemory();
}
function clearLocal() {
  store.del(WSK); store.del(SLK); store.del(MEM_KEY); setActiveCampId(null);
  worldState = null; sessionLog = []; memory = blankMemory();
}
function resetAll() {
  calls.length = 0; toasts.length = 0; warns.length = 0; errors.length = 0; responder = null;
  storageAdapter.clearFlushDirty(A);
  storageAdapter.resetSyncState();
}
// The account's shape in the field: campaign A's row is at turn 51, campaign B was UPDATED more recently.
function fieldServer(overrides) {
  overrides = overrides || {};
  return function (url, opts) {
    var m = opts.method || "GET";
    if (m === "POST") return overrides.post || ok({});
    if (url === BASE + "/api/campaigns/" + A + "/turn") return ok({ campaignId: A, turn: 51 });
    if (url === BASE + "/api/campaigns/" + A) return overrides.row || ok(blob(A, 51, "Ammut"));
    if (url === BASE + "/api/state") return ok(blob(B, 89, "Nyla"));
    return null;
  };
}
function gets(suffix) { return calls.filter(function (c) { return c.method === "GET" && c.url === BASE + suffix; }); }

storageAdapter.setServer(BASE, "TOK_449");

section("#449 — the boot reconcile asks for the active campaign's own row");

tAsync("the field case: the account's latest campaign is a DIFFERENT one, this campaign's row is ahead → load() adopts THIS campaign's row", function () {
  seedLocal(35); resetAll();
  responder = fieldServer();
  storageAdapter.load(function () {});
  return settle().then(function () {
    if (worldState.turn !== 51) return "turn " + worldState.turn + " — the desktop is still parked at 35 (the account's latest campaign was consulted instead of this one)";
    if (worldState.campId !== A || getActiveCampId() !== A) return "adopted the wrong campaign: " + worldState.campId + " / " + getActiveCampId();
    if (worldState.character.name !== "Ammut") return "the hero changed to " + worldState.character.name;
    if (gets("/api/state").length) return "the account-latest route was consulted while a campaign is active";
    if (gets("/api/campaigns/" + A).length !== 1) return "expected exactly one GET of this campaign's row, got " + gets("/api/campaigns/" + A).length;
    if (storageAdapter.syncStatus().conflict) return "a conflict is still standing after the adopt";
    return true;
  });
});

tAsync("a standing 409 conflict on this campaign names the picker's Load in its toast and is CLEARED by the next load()", function () {
  seedLocal(35); resetAll();
  responder = fieldServer({ post: httpErr(409, { serverTurn: 51 }) });
  storageAdapter.syncNow(false);
  return settle().then(function () {
    if (!storageAdapter.syncStatus().conflict) return "the 409 never raised the conflict";
    var ahead = toasts.filter(function (m) { return /ahead/i.test(m); });
    if (ahead.length !== 1) return "expected one 'ahead' toast, got " + JSON.stringify(toasts);
    if (!/Campaigns/.test(ahead[0]) || !/Load/.test(ahead[0])) return "the conflict toast does not name File ▸ Campaigns ▸ Load as the recovery: " + ahead[0];
    calls.length = 0; toasts.length = 0;
    responder = fieldServer();
    storageAdapter.load(function () {});
    return settle();
  }).then(function () {
    if (worldState.turn !== 51) return "reload did not adopt the row the 409 was pointing at (turn " + worldState.turn + ")";
    return storageAdapter.syncStatus().conflict ? "the conflict survived the adopt" : true;
  });
});

tAsync("a fresh device (no local campaign at all) still adopts the account's latest campaign through /api/state", function () {
  clearLocal(); resetAll();
  responder = fieldServer();
  storageAdapter.load(function () {});
  return settle().then(function () {
    if (!worldState || worldState.campId !== B) return "fresh device did not adopt the account's latest campaign: " + JSON.stringify(worldState && worldState.campId);
    if (worldState.turn !== 89) return "turn " + worldState.turn;
    if (getActiveCampId() !== B) return "active id " + getActiveCampId();
    if (gets("/api/state").length !== 1) return "expected one GET /api/state on a fresh device, got " + gets("/api/state").length;
    if (calls.some(function (c) { return /\/api\/campaigns\/camp_[0-9_]+$/.test(c.url); })) return "a fresh device asked for a campaign row it cannot know";
    return true;
  });
});

tAsync("a local-only campaign (no row on the server yet, 404) keeps local state, is not a sync failure, and never adopts the account's latest", function () {
  seedLocal(35); resetAll();
  responder = fieldServer({ row: httpErr(404, { error: "Not found" }) });
  storageAdapter.load(function () {});
  return settle().then(function () {
    if (worldState.turn !== 35 || worldState.campId !== A) return "local state changed: turn " + worldState.turn + " camp " + worldState.campId;
    if (storageAdapter.syncStatus().failing) return "a missing row was reported as a sync FAILURE";
    if (warns.some(function (w) { return /sync failed/i.test(w); })) return "a missing row logged a sync failure: " + JSON.stringify(warns);
    if (gets("/api/state").length) return "fell back to the account's latest campaign — that is the #449 defect by another door";
    return toasts.length ? "unexpected toast: " + JSON.stringify(toasts) : true;
  });
});

tAsync("the identity guard still refuses a row that carries another campaign's id — and says so on the console", function () {
  seedLocal(35); resetAll();
  responder = fieldServer({ row: ok(blob(B, 89, "Nyla")) });
  storageAdapter.load(function () {});
  return settle().then(function () {
    if (worldState.turn !== 35 || worldState.campId !== A) return "a foreign blob was adopted: turn " + worldState.turn + " camp " + worldState.campId;
    var loud = errors.filter(function (e) { return /reconcile REFUSED/.test(e) && e.indexOf(B) >= 0 && e.indexOf(A) >= 0; });
    return loud.length ? true : "the refusal was silent (no console.error naming both campaigns): " + JSON.stringify(errors);
  });
});

chain.then(function () {
  console.log("#449 boot reconcile row: " + pass + " passed, " + fails.length + " failed");
  fails.forEach(function (f) { console.log("  FAIL " + f); });
  process.exit(fails.length ? 1 : 0);
});
