// tests-jp011-flush-dirty.js — JP0-11 (Fable f68): the page-hide flush is SIZE-BOUNDED, and the
// turns it cannot flush are marked locally and pushed at the next launch BEFORE any server adopt.
//
// Why a standalone battery: these assertions drive storageAdapter.load(), which re-reads the store
// and REPLACES the live worldState/sessionLog/memory globals — it cannot share engine-tests.js's
// fixture. Own fetch stub, own store seeding, own toast sink. Run directly:
//   node dev/tests-jp011-flush-dirty.js
//
// The defect being pinned: the unload/page-hide flush rides fetch(keepalive:true); the Fetch spec
// caps total in-flight keepalive request bodies at 64 KiB, browsers reject anything larger, and the
// rejection landed in a swallowing .catch — so "closing/backgrounding can't drop the final turn"
// was false for any character carrying a portrait (it rides INLINE by design), i.e. from ~turn 1.
// ES5 throughout, matching the engine.

var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
var files = require("./engine-manifest.js").map(function (entry) { return entry.file; });
var geval = eval;
for (var i = 0; i < files.length; i++) {
  try { geval(fs.readFileSync(path.join(root, files[i]), "utf8")); }
  catch (e) { console.error("ENGINE LOAD FAILED in " + files[i] + ": " + e.message); process.exit(1); }
}

// ── Reporter (mirrors run-tests.js / tests-b9-transport.js) ──────────────────
var pass = 0, fails = [], curSection = "";
function section(name) { curSection = name; }
function eq(got, want, label) { if (got === want) return true; return (label || "") + " expected " + JSON.stringify(want) + " got " + JSON.stringify(got); }
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
// fetch: record every request; answer from a per-test script keyed by method+path.
var calls = [];
var responder = null;   // function(url, opts) → Promise|null (null = default 200 {})
global.fetch = function (url, opts) {
  opts = opts || {};
  calls.push({ url: url, method: opts.method || "GET", keepalive: !!opts.keepalive, body: opts.body });
  var r = responder ? responder(url, opts) : null;
  return r || Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } });
};
function ok(data) { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(data || {}); } }); }
function httpErr(status, data) { return Promise.resolve({ ok: false, status: status, json: function () { return Promise.resolve(data || {}); } }); }
function later(ms, p) { return new Promise(function (res) { setTimeout(function () { res(p); }, ms); }); }
function settle() { return new Promise(function (res) { setTimeout(res, 40); }); }

var toasts = [];
global.showToast = function (m) { toasts.push(String(m)); };
global.addMsg = function () {};
global.syncUI = function () {};
global.showGame = function () {};
global.rebuildNarrativeFromTranscript = function () { return true; };
global.busy = false;

var warns = [];
var _realWarn = console.warn;
console.warn = function () { warns.push(Array.prototype.slice.call(arguments).join(" ")); };

// ── Fixture ──────────────────────────────────────────────────────────────────
var CAMP = "campJP11";
// A portrait-sized inline blob — the exact thing that pushes a real save past the keepalive cap
// (the PC portrait rides inline by design; _stripNpcPortraits only strips NPC avatars).
function bigPortrait(kb) { return "data:image/jpeg;base64," + new Array(kb * 1024).join("A"); }

function seedCampaign(turn, portraitKB) {
  var ws = {
    turn: turn, campId: CAMP,
    character: { name: "Korrag", hp: 20, maxHp: 20, portrait: portraitKB ? bigPortrait(portraitKB) : null },
    world: { location: "Sandpoint" }, npcs: [], questLog: [], eventHistory: [],
    transcript: [{ t: turn, r: "gm", x: "The pier burns." }]
  };
  store.set(WSK, serializeWorldState(ws));
  store.set(SLK, "[]");
  store.set(MEM_KEY, JSON.stringify(blankMemory()));
  setActiveCampId(CAMP);
  worldState = ws; sessionLog = []; memory = blankMemory();
}

function resetAll() {
  calls.length = 0; toasts.length = 0; warns.length = 0; responder = null;
  storageAdapter.clearFlushDirty(CAMP);
  storageAdapter.resetSyncState();
}

storageAdapter.setServer("https://unit.test", "TOK_JP11");

// ── (a) the flush itself ─────────────────────────────────────────────────────
section("JP0-11 — the oversized page-hide flush");

tAsync("an oversized flush does NOT attempt the doomed keepalive request — it marks the turn instead", function () {
  seedCampaign(412, 80); resetAll();
  // The browser's actual behaviour on an over-cap keepalive body: immediate network-error rejection.
  responder = function () { return Promise.reject(new TypeError("Failed to fetch")); };
  storageAdapter.syncNow(true);
  return settle().then(function () {
    if (calls.length !== 0) return "the doomed keepalive request was still attempted (" + calls.length + " call(s))";
    if (storageAdapter.flushDirtyTurn(CAMP) !== 412) return "no unsynced-turn marker: " + JSON.stringify(storageAdapter.flushDirtyTurn(CAMP));
    return true;
  });
});

tAsync("the skip is LOUD — the console names the size and the deferred turn (no swallowed rejection)", function () {
  seedCampaign(413, 80); resetAll();
  storageAdapter.syncNow(true);
  return settle().then(function () {
    var hit = warns.filter(function (w) { return /page-hide flush/i.test(w) && /413/.test(w); });
    return hit.length ? true : "no console line named the skipped flush: " + JSON.stringify(warns);
  });
});

tAsync("a SMALL payload keeps the keepalive path byte-for-byte (no marker, keepalive:true, POST /api/state)", function () {
  seedCampaign(9, 0); resetAll();
  responder = function () { return ok({}); };
  storageAdapter.syncNow(true);
  return settle().then(function () {
    if (calls.length !== 1) return "expected exactly one request, got " + calls.length;
    if (calls[0].method !== "POST" || calls[0].url !== "https://unit.test/api/state") return "wrong request: " + calls[0].method + " " + calls[0].url;
    if (calls[0].keepalive !== true) return "the small-payload flush lost keepalive:true";
    return storageAdapter.flushDirtyTurn(CAMP) == null ? true : "a small flush wrote an unsynced-turn marker";
  });
});

tAsync("a beacon that DOES land clears any standing marker (alt-tab return, not just next boot)", function () {
  seedCampaign(500, 80); resetAll();
  storageAdapter.syncNow(true);                       // oversize → marker
  return settle().then(function () {
    if (storageAdapter.flushDirtyTurn(CAMP) !== 500) return "marker not set by the oversize flush";
    seedCampaign(500, 0); calls.length = 0;           // same turn, now small enough to flush
    responder = function () { return ok({}); };
    storageAdapter.syncNow(true);
    return settle();
  }).then(function () {
    return storageAdapter.flushDirtyTurn(CAMP) == null ? true : "a confirmed 2xx beacon left the marker set";
  });
});

tAsync("a confirmed push of an OLDER turn never clears a NEWER marker", function () {
  seedCampaign(500, 80); resetAll();
  storageAdapter.syncNow(true);                       // marker at turn 500
  return settle().then(function () {
    if (storageAdapter.flushDirtyTurn(CAMP) !== 500) return "marker not set by the oversize flush";
    seedCampaign(400, 0); calls.length = 0;           // an older copy of the SAME campaign, small enough to flush
    responder = function () { return ok({}); };
    storageAdapter.syncNow(true);
    return settle();
  }).then(function () {
    return storageAdapter.flushDirtyTurn(CAMP) === 500 ? true : "a turn-400 ack cleared the turn-500 marker — those turns are now unrecoverable";
  });
});

// ── (b) the boot push — before any server-state adoption ─────────────────────
section("JP0-11 — the boot push");

tAsync("a marked campaign PUSHES before the reconcile GET is even issued", function () {
  seedCampaign(412, 80); resetAll();
  storageAdapter.syncNow(true);                       // arm the marker through the real path
  return settle().then(function () {
    calls.length = 0; toasts.length = 0;
    var postSeen = false;
    responder = function (url, opts) {
      if ((opts.method || "GET") === "POST") { postSeen = true; return later(15, ok({})); }
      return ok({ worldState: { turn: 999, campId: CAMP, character: { name: "Korrag" }, npcs: [] }, campaignId: CAMP });
    };
    storageAdapter.load(function () {});
    // The push is in flight and its response is deliberately delayed: nothing else may have fired.
    if (calls.length !== 1) return "expected the push alone in flight, got " + calls.length + " request(s)";
    if (calls[0].method !== "POST") return "first request was " + calls[0].method + " " + calls[0].url + " — the adopt path ran before the push";
    return settle().then(function () {
      if (!postSeen) return "no push fired";
      var getAt = -1, k;
      for (k = 0; k < calls.length; k++) { if (calls[k].method === "GET" && calls[k].url === "https://unit.test/api/state") { getAt = k; break; } }
      if (getAt < 0) return "the reconcile never ran after the push";
      return getAt > 0 ? true : "the reconcile GET was issued before the push";
    });
  });
});

tAsync("the confirmed push clears the marker and says so once", function () {
  return Promise.resolve().then(function () {
    if (storageAdapter.flushDirtyTurn(CAMP) != null) return "marker survived a confirmed 2xx push";
    var said = toasts.filter(function (m) { return /final turns/i.test(m); });
    return said.length === 1 ? true : "expected exactly one 'final turns synced' toast, got " + JSON.stringify(toasts);
  });
});

tAsync("a FAILED boot push keeps the marker (cleared only on a confirmed push) and is loud", function () {
  seedCampaign(420, 80); resetAll();
  storageAdapter.syncNow(true);
  return settle().then(function () {
    calls.length = 0; toasts.length = 0;
    responder = function (url, opts) {
      if ((opts.method || "GET") === "POST") return httpErr(500);
      return ok({ worldState: { turn: 1, campId: CAMP, character: { name: "Korrag" }, npcs: [] }, campaignId: CAMP });
    };
    storageAdapter.load(function () {});
    return settle();
  }).then(function () {
    if (storageAdapter.flushDirtyTurn(CAMP) !== 420) return "a failed push cleared the marker";
    if (!storageAdapter.syncStatus().failing) return "the failed push never surfaced through the sync badge";
    if (toasts.filter(function (m) { return /final turns/i.test(m); }).length) return "claimed the final turns synced after a FAILED push";
    var reconciled = calls.filter(function (c) { return c.method === "GET"; });
    return reconciled.length ? true : "a failed push blocked the reconcile entirely";
  });
});

tAsync("a genuine two-device conflict still lands in the LOUD CAS path and keeps the marker", function () {
  seedCampaign(430, 80); resetAll();
  storageAdapter.syncNow(true);
  return settle().then(function () {
    calls.length = 0; toasts.length = 0;
    responder = function (url, opts) {
      if ((opts.method || "GET") === "POST") return httpErr(409, { serverTurn: 900 });
      return ok({});
    };
    storageAdapter.load(function () {});
    return settle();
  }).then(function () {
    if (!storageAdapter.syncStatus().conflict) return "the CAS conflict was swallowed by the boot push";
    if (toasts.filter(function (m) { return /ahead/i.test(m); }).length !== 1) return "no conflict toast: " + JSON.stringify(toasts);
    if (storageAdapter.flushDirtyTurn(CAMP) !== 430) return "the conflict cleared the marker";
    return true;
  });
});

tAsync("no marker → load() reconciles exactly as before (one GET, no push)", function () {
  seedCampaign(11, 0); resetAll();
  responder = function () { return ok({}); };
  storageAdapter.load(function () {});
  return settle().then(function () {
    var posts = calls.filter(function (c) { return c.method === "POST"; });
    if (posts.length) return "an unmarked boot pushed anyway (" + posts.length + " POST(s))";
    var gets = calls.filter(function (c) { return c.url === "https://unit.test/api/state" && c.method === "GET"; });
    return gets.length === 1 ? true : "expected exactly one reconcile GET, got " + gets.length;
  });
});

// ── report ───────────────────────────────────────────────────────────────────
chain.then(function () {
  console.warn = _realWarn;
  if (fails.length) {
    console.error("JP0-11 TESTS FAILED (" + fails.length + " of " + (pass + fails.length) + "):");
    for (var f = 0; f < fails.length; f++) console.error("  ✗ " + fails[f]);
    process.exit(1);
  }
  console.log("ALL GREEN — " + pass + " assertions passed (JP0-11 page-hide flush)");
  process.exit(0);
});
