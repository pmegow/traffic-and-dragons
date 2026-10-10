#!/usr/bin/env node
// tests-playtest-server-mode.js — the playtest harness runs signed in (owner 2026-09-30, "sign in"). The app starts in server
// mode now: an entitled account's GM calls ride the server with the page's own model, so a run needs no key — but the
// sign-in and the owner's other campaigns share the browser storage, and every save syncs to the owner's cloud. So a
// signed-in run never wipes storage, starts only a campaign named as the harness's own, records its id, and deletes exactly
// that campaign afterwards: this device's copy first (nothing can push it again), then the cloud copy, verified gone — the
// server keeps no tombstone, so a push already in flight could re-create it.
// The decisions are pure; the page wrappers run here against stubs of the app (no browser, no network).
//   node dev/tests-playtest-server-mode.js
"use strict";
var fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert/strict");
var ROOT = path.join(__dirname, "..");
var H = require("./playtest-harness.js");
var passed = 0, failed = 0, pending = [];
function test(name, fn) {
  pending.push(Promise.resolve().then(fn).then(function () { passed++; console.log("PASS playtest server mode: " + name); },
    function (e) { failed++; console.error("FAIL playtest server mode: " + name + " — " + (e && e.message || e)); }));
}

// ── the pure decisions ──
test("only a campaign named as the harness's own counts as the harness's", function () {
  assert.equal(H.isHarnessName("PlaytestHarness 2026-09-30"), true);
  assert.equal(H.isHarnessName("modelTestCampaign_gemini"), true);
  assert.equal(H.isHarnessName("The Village"), false);
  assert.equal(H.isHarnessName("my PlaytestHarness"), false, "a prefix, not a substring");
  assert.equal(H.isHarnessName(""), false); assert.equal(H.isHarnessName(null), false);
});
test("the preflight refuses every route that would fail each turn, and names the owner's step", function () {
  var v = H.preflightVerdict;
  assert.deepEqual(v({ viaServer: true, token: true, entitled: true }), { ok: true, route: "server" });
  assert.deepEqual(v({ viaServer: false, hasKey: true }), { ok: true, route: "byok" });
  assert.equal(v({ viaServer: true, token: false }).ok, false, "keyless and signed out rides the gateway and is refused");
  assert.match(v({ viaServer: true, token: false }).ask, /Sign in/);
  assert.equal(v({ viaServer: true, token: true, entitled: false }).ok, false, "an unentitled account gets a 402 on every turn");
  assert.match(v({ viaServer: true, token: true, entitled: false }).ask, /subscription/);
  assert.equal(v({ viaServer: true, token: true, entitled: true, busy: true }).ok, false, "never start under a turn in flight");
  assert.equal(v({ viaServer: false, hasKey: false, serverMode: false }).ok, false);
  assert.match(v({ viaServer: false, hasKey: false, serverMode: true }).ask, /Sign in.*or paste a provider key/);
  [v({}), v({ viaServer: true }), v({ viaServer: true, token: true })].forEach(function (r) { assert.match(r.ask, /never handles credentials|subscription/); });
});
test("a run is recorded only when the new campaign is confirmed as the harness's own", function () {
  var r = H.runRecord;
  assert.deepEqual(r("c1", { campId: "c1", campName: "PlaytestHarness x" }, "PlaytestHarness x"), { campId: "c1", campName: "PlaytestHarness x" });
  assert.equal(r("c1", { campId: "c0", campName: "PlaytestHarness x" }, "PlaytestHarness x"), null, "the active campaign is another one (startGame refused)");
  assert.equal(r("c1", { campId: "c1", campName: "The Village" }, "PlaytestHarness x"), null, "the owner's campaign is still active");
  assert.equal(r("c1", { campId: "c1", campName: "Mine" }, "Mine"), null, "not a harness name");
  assert.equal(r(null, null, "PlaytestHarness x"), null);
});
test("the cleanup deletes only the recorded run's own campaign", function () {
  var p = H.cleanupPlan, run = { campId: "c9", campName: "PlaytestHarness x" };
  var meta = [{ id: "c1", campName: "The Village" }, { id: "c9", campName: "PlaytestHarness x" }];
  assert.deepEqual(p(meta, run, false), { ok: true, id: "c9", local: true });
  assert.equal(p(meta, null, false).ok, false, "no record, nothing of ours");
  assert.equal(p(meta, run, true).ok, false, "a turn in flight");
  assert.equal(p(meta, { campId: "c1", campName: "The Village" }, false).ok, false, "a record naming the owner's campaign is refused");
  assert.equal(p([{ id: "c9", campName: "The Village" }], run, false).ok, false, "the id now names someone else's campaign");
  assert.equal(p([{ id: "c9", campName: "PlaytestHarness x" }, { id: "c9", campName: "PlaytestHarness x" }], run, false).ok, false, "a duplicated id");
  assert.equal(p([{ id: "c1", campName: "The Village" }], run, false).ok, false, "gone from the list, and the harness never removed it");
  assert.deepEqual(p([{ id: "c1", campName: "The Village" }], { campId: "c9", campName: "PlaytestHarness x", localGone: true }, false), { ok: true, id: "c9", local: false }, "the retry after a failed cloud delete");
});

// ── the page wrappers, against stubs of the app ──
function page(opts) {
  opts = opts || {};
  var calls = [], cloud = (opts.cloud || ["c1", "c9"]).slice(), store = {}, deletes = 0;
  var meta = (opts.meta || [{ id: "c1", campName: "The Village" }, { id: "c9", campName: "PlaytestHarness x" }]).slice();
  var ctx = {
    console: console, setTimeout: setTimeout, Promise: Promise, JSON: JSON, Date: Date,
    localStorage: { getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } },
    document: { querySelectorAll: function () { return []; }, getElementById: function () { return null; } },
    logTranscript: function () {}, busy: false, APP_VERSION: "v-test",
    activeProvider: "anthropic", providerModels: {}, providerKeys: {}, apiKey: "", serverAccount: { entitled: true },
    PROVIDERS: { anthropic: { defaultModel: "claude-x" }, gemini: { defaultModel: "gemini-y" } },
    TONES: [{ id: "gritty", nm: "Gritty", vc: "grim" }],
    gmViaServer: function () { return true; },
    getActiveCampId: function () { return ctx._active; }, _active: opts.active || "c9",
    getCampMeta: function () { return meta.slice(); },
    removeActiveCampaignLocally: function (id) { calls.push("local-active:" + id); meta = meta.filter(function (c) { return c.id !== id; }); ctx._active = null; ctx.worldState = null; return true; },
    deleteCampaign: function (id) { calls.push("local:" + id); meta = meta.filter(function (c) { return c.id !== id; }); },
    showChar: function () { calls.push("showChar"); },
    /* like the real startGame (game.js): the character object becomes worldState.character and its transient _campName is
       DELETED — a harness that reads char._campName after the call reads undefined (the first signed-in run, 2026-09-30) */
    startGame: function (ch) { calls.push("startGame"); if (opts.startRefuses) return; ctx._active = "c9"; meta.push({ id: "c9", campName: ch._campName }); ctx.worldState = { campId: "c9", campName: ch._campName, turn: 0, character: ch }; delete ch._campName; },
    worldState: { campId: opts.active || "c9", campName: "PlaytestHarness x", turn: 3 },
    store: { set: function (k) { calls.push("store.set:" + k); } },
    storageAdapter: {
      isServerMode: function () { return opts.serverMode !== false; }, hasToken: function () { return opts.token !== false; },
      fetchAccount: function (cb) { calls.push("fetchAccount"); cb(null, {}); },
      getServerUrl: function () { return "https://srv.test"; }, authHeader: function () { return { Authorization: "Bearer T" }; },
      deleteCampaignFromServer: function (id, cb) {
        deletes++; calls.push("cloud-delete:" + id);
        if (opts.cloudFails && deletes <= opts.cloudFails) return cb("HTTP 500");
        cloud = cloud.filter(function (x) { return x !== id; });
        if (opts.latePushes && deletes <= opts.latePushes) cloud.push(id);   // a push already in flight lands after the delete
        cb(null, { ok: true });
      }
    },
    fetch: function (url, init) { calls.push("GET " + url); return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(cloud.map(function (id) { return { id: id }; })); } }); }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  var src = fs.readFileSync(path.join(ROOT, "ui-campaigns.js"), "utf8"), a = src.indexOf("function campDeleteRemoteOutcome(");
  vm.runInContext(src.slice(a, src.indexOf("\n}\n", a) + 3), ctx, { filename: "ui-campaigns.js#campDeleteRemoteOutcome" });   // the app's own outcome rule
  vm.runInContext(fs.readFileSync(path.join(ROOT, "dev", "playtest-harness.js"), "utf8"), ctx, { filename: "playtest-harness.js" });
  if (opts.run !== undefined) ctx.__pt.run = opts.run;
  return { ctx: ctx, calls: calls, cloud: function () { return cloud; }, meta: function () { return meta; } };
}
var RUN = { campId: "c9", campName: "PlaytestHarness x", route: "server" };
test("the preflight reads the account and returns the app's own route", async function () {
  var p = page(), r = await p.ctx.__ptPreflight();
  assert.equal(r.ok, true); assert.equal(r.route, "server"); assert.ok(p.calls.indexOf("fetchAccount") >= 0, "the account readout is refreshed first");
  var q = page(); q.ctx.serverAccount = { entitled: false }; q.ctx.storageAdapter.fetchAccount = function (cb) { cb(null, {}); };
  assert.equal((await q.ctx.__ptPreflight()).ok, false, "an unentitled account is refused");
});
test("the run's model is set in memory only — the owner's saved choice is never written", function () {
  var p = page(), r = p.ctx.__ptUseModel("gemini", "gemini-3.8-flash");
  assert.equal(p.ctx.activeProvider, "gemini"); assert.equal(p.ctx.providerModels.gemini, "gemini-3.8-flash");
  assert.deepEqual(JSON.parse(JSON.stringify(r.was)), { provider: "anthropic", model: null });
  assert.equal(p.calls.filter(function (c) { return /^store\.set/.test(c); }).length, 0, "nothing persisted");
  assert.match(p.ctx.__ptUseModel("nope", "x"), /refused/);
});
test("a run starts only a harness-named campaign, and records it", function () {
  var p = page({ run: null, active: "c1" });
  p.ctx.worldState = { campId: "c1", campName: "The Village" };
  assert.match(p.ctx.__ptStart({ _campName: "The Village" }, "gritty", ""), /refused/, "a non-harness name");
  assert.equal(p.calls.indexOf("startGame"), -1, "refused before startGame");
  var rec = p.ctx.__ptStart({ _campName: "PlaytestHarness x" }, "gritty", "");
  assert.equal(rec.campId, "c9"); assert.equal(rec.route, "server");
  assert.equal(p.ctx.__pt.run.campId, "c9", "recorded in the durable corpus");
});
test("a start that cannot be confirmed records nothing (the cleanup can never aim at the owner's active campaign)", function () {
  var p = page({ run: null, active: "c1", startRefuses: true });
  p.ctx.worldState = { campId: "c1", campName: "The Village" };
  assert.match(p.ctx.__ptStart({ _campName: "PlaytestHarness x" }, "gritty", ""), /could not be confirmed/);
  assert.equal(p.ctx.__pt.run || null, null);
});
test("a new run waits until the previous signed-in run's campaign is deleted", function () {
  var p = page({ run: { campId: "c8", campName: "PlaytestHarness old", route: "server" } });
  assert.match(p.ctx.__ptStart({ _campName: "PlaytestHarness x" }, "gritty", ""), /still in the cloud/);
  assert.equal(p.calls.indexOf("startGame"), -1);
  p.ctx.__ptClear();
  assert.equal(p.ctx.__pt.run.campId, "c8", "clearing the corpus keeps an undeleted run's record");
});
test("the cleanup removes this device's copy BEFORE the cloud delete, then verifies the cloud copy is gone", async function () {
  var p = page({ run: RUN }), r = await p.ctx.__ptDeleteRun({ waitMs: 1 });
  assert.equal(r.deleted, true, JSON.stringify(r));
  var li = p.calls.indexOf("local-active:c9"), ci = p.calls.indexOf("cloud-delete:c9"), gi = p.calls.indexOf("GET https://srv.test/api/campaigns");
  assert.ok(li >= 0 && ci > li && gi > ci, "order: local teardown, cloud delete, verify — " + p.calls.join(", "));
  assert.deepEqual(p.cloud(), ["c1"], "the owner's campaign is untouched");
  assert.ok(p.meta().some(function (c) { return c.id === "c1"; }), "the owner's local entry is untouched");
});
test("a push that lands after the delete is caught by the check and deleted again", async function () {
  var p = page({ run: RUN, latePushes: 1 }), r = await p.ctx.__ptDeleteRun({ waitMs: 1 });
  assert.equal(r.deleted, true); assert.equal(r.attempts, 2);
  assert.deepEqual(p.cloud(), ["c1"]);
});
test("a cloud copy that keeps coming back is reported, never claimed deleted", async function () {
  var p = page({ run: RUN, latePushes: 99 }), r = await p.ctx.__ptDeleteRun({ waitMs: 1 });
  assert.equal(r.deleted, false); assert.match(r.why, /came back/);
});
test("a failed cloud delete is reported, and a second call retries the cloud copy alone", async function () {
  var p = page({ run: RUN, cloudFails: 1 }), r = await p.ctx.__ptDeleteRun({ waitMs: 1 });
  assert.equal(r.deleted, false); assert.match(r.why, /cloud delete failed/);
  assert.equal(p.ctx.__pt.run.localGone, true);
  var r2 = await p.ctx.__ptDeleteRun({ waitMs: 1 });
  assert.equal(r2.deleted, true, JSON.stringify(r2)); assert.deepEqual(p.cloud(), ["c1"]);
});
test("the cleanup refuses a record that names the owner's campaign, and touches nothing", async function () {
  var p = page({ run: { campId: "c1", campName: "The Village", route: "server" }, active: "c1" }), r = await p.ctx.__ptDeleteRun({ waitMs: 1 });
  assert.equal(r.deleted, false);
  assert.deepEqual(p.calls.filter(function (c) { return /^(local|cloud)/.test(c); }), []);
  assert.deepEqual(p.cloud(), ["c1", "c9"]);
});

// ── the action pool: the newest narration's buttons only ──
function storyDoc(narrations) {   // narrations: [[{action, disabled}], …], oldest first
  var nars = narrations.map(function (btns) {
    var els = btns.map(function (b) { return { disabled: !!b.disabled, getAttribute: function (k) { return k === "data-action" ? b.action : null; } }; });
    return { querySelectorAll: function (sel) { return sel === ".qa[data-action]" ? els : []; } };
  });
  var all = []; nars.forEach(function (n) { all = all.concat(n.querySelectorAll(".qa[data-action]")); });
  return { getElementById: function () { return null; }, querySelectorAll: function (sel) { return sel === "#story-narrative .msg.narrator" ? nars : sel === "#story-narrative .qa[data-action]" ? all : []; } };
}
test("the action pool is the newest narration's buttons only — never the previous turn's last button (the v1.1078 t5 pick)", function () {
  var p = page(); var B = function (a) { return { action: a }; };
  p.ctx.document = storyDoc([[B("Interrogate the pinned slaver leader."), B("Cut down the reaver."), B("Finish Kadrun.")], [B("Cut down the surviving reaver."), B("Demand the reaver surrender."), B("Search Kadrun's corpse.")]]);
  assert.deepEqual(Array.from(p.ctx.__ptLiveActions()), ["Cut down the surviving reaver.", "Demand the reaver surrender.", "Search Kadrun's corpse."]);
  p.ctx.document = storyDoc([[B("a"), B("b"), B("c")], [B("d"), B("e"), B("f"), B("Buy the Dagger (2 gp).")]]);
  assert.deepEqual(Array.from(p.ctx.__ptLiveActions()), ["d", "e", "f", "Buy the Dagger (2 gp)."], "the engine's fourth button rides along");
  p.ctx.document = storyDoc([[B("a")], [B("d"), { action: "e", disabled: true }]]);
  assert.equal(p.ctx.__ptLiveActions(), null, "not ready while the newest buttons are disabled");
  p.ctx.document = storyDoc([[B("a")], []]);
  assert.equal(p.ctx.__ptLiveActions(), null, "not ready before the newest narration has its buttons — an older turn's never stand in");
  p.ctx.document = storyDoc([]);
  assert.equal(p.ctx.__ptLiveActions(), null);
});

Promise.all(pending).then(function () {
  console.log((failed ? "FAIL" : "PASS") + " playtest server mode: " + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
});
