// _tests_B9.js — audit B9 (AUDIT_FABLE_07_16_2026 #9): tests for the storage-adapter
// transport methods (hasToken / whoAmI / getCampaignState / pushCampaignState /
// putCampaignPortrait) that ui.js's six former raw-fetch sites now route through.
//
// Standalone battery — not loaded by run-tests.js or test.html. Run directly:
//   node dev/tests-b9-transport.js
//
// Engine-tests style (section/t/eq, same reporter shape as dev/run-tests.js). The suite's
// existing adapter section (engine-tests.js ~:493-541) only exercises PURE functions
// (mergeCampaignLists / resolveCas409 / fillPortraitsFromBlob) so it never needed a fetch
// stub; these methods DO fetch, so the seam here is global.fetch — the only thing beneath
// the adapter's private _tFetch. Request-shape asserts are synchronous (fetch fires inside
// the method call); cb-propagation asserts ride a sequential promise chain (tAsync).
// ES5 throughout, matching the engine.

var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
// The manifest is the load-order authority. A copied list made this suite die before its first
// assertion when identity.js joined the engine (#18 census exhibit).
var files = require("./engine-manifest.js").map(function (entry) { return entry.file; });
var geval = eval;
for (var i = 0; i < files.length; i++) {
  try { geval(fs.readFileSync(path.join(root, files[i]), "utf8")); }
  catch (e) { console.error("ENGINE LOAD FAILED in " + files[i] + ": " + e.message); process.exit(1); }
}

// ── Reporter (mirrors run-tests.js) ──────────────────────────────────────────
var pass = 0, fails = [], curSection = "";
function section(name) { curSection = name; }
function eq(got, want, label) { if (got === want) return true; return (label || "") + " expected " + JSON.stringify(want) + " got " + JSON.stringify(got); }
function t(name, fn) {
  var label = curSection + " › " + name;
  try {
    var r = fn();
    if (r === true || r === undefined) pass++;
    else fails.push(label + " — " + r);
  } catch (e) { fails.push(label + " — threw: " + e.message); }
}
// Async variant: fn returns a Promise resolving true/failure-string. Chained sequentially
// so setServer() state changes inside the chain can't race the registrations.
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

// ── fetch stub: capture every request; respond per the queued script ─────────
var calls = [];          // [{url, opts}]
var nextResponse = null; // function() → Promise (per-test); default = 200 {}
global.fetch = function (url, opts) {
  calls.push({ url: url, opts: opts || {} });
  return nextResponse ? nextResponse() : Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } });
};
function okJson(data) { return function () { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(data); } }); }; }
function httpErr(status) { return function () { return Promise.resolve({ ok: false, status: status, json: function () { return Promise.resolve({}); } }); }; }
function rejectWith(err) { return function () { return Promise.reject(err); }; }
function abortErr() { var e = new Error("The operation was aborted"); e.name = "AbortError"; return e; }
function lastCall() { return calls[calls.length - 1]; }

// Arm server mode. setServer's localStorage write is try/caught, so headless node is fine —
// _serverUrl/_token are set before the try (same path autoConnect restores in the browser).
storageAdapter.setServer("https://unit.test", "TOK_B9");

// ── (a) request shape: path + method + auth header, all on the _tFetch seam ──
section("B9 transport — request shape");

t("hasToken() is true while connected (the 'am I connected' check, no token key read)", function () {
  return eq(storageAdapter.hasToken(), true);
});
t("whoAmI → GET /auth/me with the bearer token", function () {
  calls.length = 0; nextResponse = okJson({ username: "pmegow" });
  storageAdapter.whoAmI(function () {});
  var c = lastCall(); if (!c) return "no fetch fired";
  if (c.url !== "https://unit.test/auth/me") return "url " + c.url;
  if (c.opts.method) return "method should be GET (unset), got " + c.opts.method;
  return eq(c.opts.headers["Authorization"], "Bearer TOK_B9", "auth header");
});
t("getCampaignState → GET /api/campaigns/:id (URI-encoded) with the bearer token", function () {
  calls.length = 0; nextResponse = okJson({ worldState: {} });
  storageAdapter.getCampaignState("camp 1", function () {});
  var c = lastCall(); if (!c) return "no fetch fired";
  if (c.url !== "https://unit.test/api/campaigns/camp%201") return "url " + c.url;
  if (c.opts.method) return "method should be GET (unset), got " + c.opts.method;
  return eq(c.opts.headers["Authorization"], "Bearer TOK_B9", "auth header");
});
t("pushCampaignState → POST /api/state, JSON content-type, bearer token", function () {
  calls.length = 0; nextResponse = okJson({});
  storageAdapter.pushCampaignState("campX", { worldState: { npcs: [] }, sessionLog: [], memory: {} }, function () {});
  var c = lastCall(); if (!c) return "no fetch fired";
  if (c.url !== "https://unit.test/api/state") return "url " + c.url;
  if (c.opts.method !== "POST") return "method " + c.opts.method;
  if (c.opts.headers["Content-Type"] !== "application/json") return "content-type " + c.opts.headers["Content-Type"];
  return eq(c.opts.headers["Authorization"], "Bearer TOK_B9", "auth header");
});
t("putCampaignPortrait → PUT /api/campaigns/:id/portrait, body passed through verbatim", function () {
  calls.length = 0; nextResponse = okJson({});
  storageAdapter.putCampaignPortrait("campX", { portrait: null, npcPortraits: { Bandit: "IMG" } }, null);
  var c = lastCall(); if (!c) return "no fetch fired";
  if (c.url !== "https://unit.test/api/campaigns/campX/portrait") return "url " + c.url;
  if (c.opts.method !== "PUT") return "method " + c.opts.method;
  if (c.opts.headers["Authorization"] !== "Bearer TOK_B9") return "auth header missing";
  return eq(c.opts.body, JSON.stringify({ portrait: null, npcPortraits: { Bandit: "IMG" } }), "portrait payload");
});
t("every method rides _tFetch — an abort signal is armed on each request (the #24 timeout)", function () {
  // opts.signal is set by _tFetch itself; a raw fetch re-implementation would lack it.
  calls.length = 0; nextResponse = okJson({});
  storageAdapter.whoAmI(function () {});
  storageAdapter.getCampaignState("campX", function () {});
  storageAdapter.pushCampaignState("campX", { worldState: { npcs: [] }, sessionLog: [], memory: {} }, function () {});
  storageAdapter.putCampaignPortrait("campX", { portrait: null, npcPortraits: {} }, null);
  if (calls.length !== 4) return "expected 4 captured requests, got " + calls.length;
  for (var k = 0; k < calls.length; k++) { if (!calls[k].opts.signal) return "request " + k + " (" + calls[k].url + ") has no abort signal — bypassed _tFetch"; }
  return true;
});

// ── (b) pushCampaignState body: exact parts, no live-state contamination ─────
section("B9 transport — pushCampaignState body");

t("ships EXACTLY the given parts — live worldState/sessionLog/memory never leak in", function () {
  // Sentinel live globals, all different from the parts being pushed (the non-live-campaign case:
  // connectToServer pushes another campaign's snapshot while a different campaign is active).
  worldState = { turn: 99, character: { name: "LIVE_PC" }, npcs: [] };
  sessionLog = [{ role: "user", content: "LIVE_SL" }];
  memory = { lore: ["LIVE_MEM"] };
  var parts = {
    worldState: { turn: 3, character: { name: "SNAP_PC", portrait: "PC_IMG" }, npcs: [{ name: "Bandit", portrait: "NPC_IMG" }, { name: "Ally", charSheet: { portrait: "SHEET_IMG" } }] },
    sessionLog: [{ role: "user", content: "SNAP_SL" }],
    memory: { lore: ["SNAP_MEM"] }
  };
  calls.length = 0; nextResponse = okJson({});
  storageAdapter.pushCampaignState("campX", parts, function () {});
  var raw = lastCall().opts.body, body = JSON.parse(raw);
  if (raw.indexOf("LIVE_") >= 0) return "live-state sentinel leaked into the payload";
  if (body.worldState.turn !== 3 || body.worldState.character.name !== "SNAP_PC") return "worldState not the given snapshot";
  if (body.sessionLog[0].content !== "SNAP_SL" || body.memory.lore[0] !== "SNAP_MEM") return "sessionLog/memory not the given parts";
  if (body.campaignId !== "campX") return "campaignId " + body.campaignId;
  if (body.narrativeHtml !== "") return "narrativeHtml should be \"\" (audit #18), got " + JSON.stringify(body.narrativeHtml);
  return ("baseTurn" in body) ? "baseTurn leaked in — that's syncToServer's CAS guard, not this path" : true;
});
t("NPC avatar portrait stripped, PC portrait INLINE, companion charSheet portrait rides (E27/#3)", function () {
  var body = JSON.parse(lastCall().opts.body);
  if (body.worldState.character.portrait !== "PC_IMG") return "PC portrait not inline";
  if (body.worldState.npcs[0].portrait !== null) return "npc.portrait not stripped: " + JSON.stringify(body.worldState.npcs[0].portrait);
  return eq(body.worldState.npcs[1].charSheet.portrait, "SHEET_IMG", "companion sheet portrait");
});
t("strip is non-destructive — the caller's snapshot object keeps its portraits", function () {
  // (relies on the previous test's parts still being reachable via the captured body only —
  // so re-run with a held reference)
  var parts = { worldState: { npcs: [{ name: "Bandit", portrait: "NPC_IMG" }] }, sessionLog: [], memory: {} };
  calls.length = 0; nextResponse = okJson({});
  storageAdapter.pushCampaignState("campY", parts, function () {});
  return eq(parts.worldState.npcs[0].portrait, "NPC_IMG", "caller object mutated");
});
t("payload is byte-identical to the pre-B9 ui.js inline construction", function () {
  var parts = {
    worldState: { turn: 3, character: { name: "SNAP_PC", portrait: "PC_IMG" }, npcs: [{ name: "Bandit", portrait: "NPC_IMG" }, { name: "Ally", charSheet: { portrait: "SHEET_IMG" } }] },
    sessionLog: [{ role: "user", content: "SNAP_SL" }],
    memory: { lore: ["SNAP_MEM"] }
  };
  calls.length = 0; nextResponse = okJson({});
  storageAdapter.pushCampaignState("campX", parts, function () {});
  // The exact expression campCloudPushSilent used before the routing (ui.js pre-B9):
  var wsObj = parts.worldState;
  var wsStripped = Object.assign({}, wsObj, { npcs: (wsObj.npcs || []).map(function (n) { return n.portrait ? Object.assign({}, n, { portrait: null }) : n; }) });
  var expected = JSON.stringify({ worldState: wsStripped, sessionLog: parts.sessionLog, memory: parts.memory, campaignId: "campX", narrativeHtml: "" });
  return eq(lastCall().opts.body, expected, "byte parity");
});

// ── (c) cb propagation: success, HTTP error, and the _tFetch timeout ─────────
section("B9 transport — cb propagation");

tAsync("whoAmI cb(null, data) on 200", function () {
  nextResponse = okJson({ username: "pmegow" });
  return new Promise(function (res) { storageAdapter.whoAmI(function (err, d) { res(err === null && d && d.username === "pmegow" ? true : "err=" + err + " d=" + JSON.stringify(d)); }); });
});
tAsync("getCampaignState cb('HTTP 404') on a missing campaign (same string the sites toasted)", function () {
  nextResponse = httpErr(404);
  return new Promise(function (res) { storageAdapter.getCampaignState("nope", function (err) { res(eq(err, "HTTP 404")); }); });
});
tAsync("whoAmI: timeout (AbortError) lands in cb, not thrown", function () {
  nextResponse = rejectWith(abortErr());
  return new Promise(function (res) { storageAdapter.whoAmI(function (err, d) { res(err && !d ? true : "err=" + err); }); });
});
tAsync("getCampaignState: timeout lands in cb, not thrown", function () {
  nextResponse = rejectWith(abortErr());
  return new Promise(function (res) { storageAdapter.getCampaignState("campX", function (err, d) { res(err && !d ? true : "err=" + err); }); });
});
tAsync("pushCampaignState: timeout lands in cb, not thrown", function () {
  nextResponse = rejectWith(abortErr());
  return new Promise(function (res) { storageAdapter.pushCampaignState("campX", { worldState: { npcs: [] }, sessionLog: [], memory: {} }, function (err, d) { res(err && !d ? true : "err=" + err); }); });
});
tAsync("putCampaignPortrait: timeout lands in cb, not thrown", function () {
  nextResponse = rejectWith(abortErr());
  return new Promise(function (res) { storageAdapter.putCampaignPortrait("campX", { portrait: null, npcPortraits: {} }, function (err, d) { res(err && !d ? true : "err=" + err); }); });
});
tAsync("putCampaignPortrait tolerates a null cb on failure (the fire-and-forget portrait push)", function () {
  nextResponse = rejectWith(abortErr());
  storageAdapter.putCampaignPortrait("campX", { portrait: null, npcPortraits: {} }, null);
  // Nothing to await on the null-cb path — settle the rejection on a microtask and pass if no throw escaped.
  return new Promise(function (res) { setTimeout(function () { res(true); }, 0); });
});

// ── disconnected guard (inside the chain, AFTER the connected tests ran) ─────
section("B9 transport — disconnected guard");

tAsync("hasToken() flips false after setServer(null)", function () {
  storageAdapter.setServer(null, null);
  return eq(storageAdapter.hasToken(), false);
});
tAsync("all four methods cb 'Not connected' without touching fetch", function () {
  calls.length = 0;
  var got = [];
  return new Promise(function (res) {
    storageAdapter.whoAmI(function (e) { got.push(e); });
    storageAdapter.getCampaignState("x", function (e) { got.push(e); });
    storageAdapter.pushCampaignState("x", { worldState: { npcs: [] }, sessionLog: [], memory: {} }, function (e) { got.push(e); });
    storageAdapter.putCampaignPortrait("x", {}, function (e) { got.push(e); });
    // guards are synchronous
    if (calls.length) return res("fetch fired while disconnected");
    res(got.length === 4 && got.every(function (e) { return e === "Not connected"; }) ? true : "got " + JSON.stringify(got));
  });
});

// ── report ────────────────────────────────────────────────────────────────────
chain.then(function () {
  if (fails.length) {
    console.error("B9 TESTS FAILED (" + fails.length + " of " + (pass + fails.length) + "):");
    for (var f = 0; f < fails.length; f++) console.error("  ✗ " + fails[f]);
    process.exit(1);
  }
  console.log("ALL GREEN — " + pass + " assertions passed (B9 transport fragment)");
  process.exit(0);
});
