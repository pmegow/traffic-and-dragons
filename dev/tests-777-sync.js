// dev/tests-777-sync.js — audit 2026-11-19 (TODO #777), section S: cloud sync and saves.
// Every case runs the REAL engine in a process of its own (the sync bookkeeping, the store and the globals are module
// state; one case must never inherit another's), with fetch stubbed. A case name opens with its audit row.
//   node dev/tests-777-sync.js             every case
//   node dev/tests-777-sync.js --only S1   the cases whose name contains the text
// ES5 throughout, matching the engine.
var path = require("path"), cp = require("child_process"), assert = require("assert");
var CASES = [];
function kase(name, fn) { CASES.push({ name: name, fn: fn }); }
function tick(ms) { return new Promise(function (r) { setTimeout(r, ms || 15); }); }
function reply(status, body) { return { ok: status >= 200 && status < 300, status: status, json: function () { return Promise.resolve(body == null ? {} : body); } }; }

// ── the child's world ───────────────────────────────────────────────────────────────────────────────────────────────
function boot() {
  var L = require("./load-engine.js");
  L.loadEngine();
  var said = { toasts: [], warns: [], errors: [], infos: [] };
  showToast = function (m) { said.toasts.push(String(m)); };
  console.warn = function () { said.warns.push([].join.call(arguments, " ")); };
  console.info = function () { said.infos.push([].join.call(arguments, " ")); };
  console.error = function () { said.errors.push([].join.call(arguments, " ")); };
  syncUI = function () {}; addMsg = function () { return {}; };
  return { L: L, said: said };
}
// two campaigns on this device: A (turn 2000) active and live, B (turn 10) in its slot; a server that answers when told to
function twoCampaigns(E) {
  var net = { calls: [], pending: [] };
  global.fetch = function (url, opts) {
    var call = { url: String(url), method: (opts && opts.method) || "GET", body: opts && opts.body ? JSON.parse(opts.body) : null };
    net.calls.push(call);
    return new Promise(function (res, rej) { net.pending.push({ call: call, answer: res, fail: rej }); });
  };
  var B = E.L.makeTestWorld({ campId: "campB", campName: "B", turn: 10 });
  store.set(campSlotKey("campB", "ws"), serializeWorldState(B)); store.set(campSlotKey("campB", "sl"), "[]"); store.set(campSlotKey("campB", "mem"), JSON.stringify(blankMemory()));
  var A = E.L.makeTestWorld({ campId: "campA", campName: "A", turn: 2000 });
  setActiveCampId("campA"); store.set(WSK, serializeWorldState(A)); store.set(SLK, "[]"); store.set(MEM_KEY, JSON.stringify(memory));
  setCampMeta([{ id: "campA", campName: "A" }, { id: "campB", campName: "B" }]);
  storageAdapter.setServer("https://unit.test", "tok");
  return net;
}
function switchWithAInFlight(E) {
  var net = twoCampaigns(E);
  assert.strictEqual(switchToCampaign("campB"), true, "the switch itself failed");
  assert.strictEqual(getActiveCampId(), "campB");
  var posts = net.pending.filter(function (p) { return p.call.method === "POST" && /\/api\/state$/.test(p.call.url); });
  assert.strictEqual(posts.length, 1, "the switch should have flushed campaign A once; POSTs seen: " + posts.length);
  assert.strictEqual(posts[0].call.body.campaignId, "campA");
  assert.strictEqual(storageAdapter.syncStatus().lastAckTurn, -1, "the switch did not reset the sync base");
  net.aPost = posts[0];
  return net;
}
function lastStatePost(net) { var c = net.calls.filter(function (x) { return x.method === "POST" && /\/api\/state$/.test(x.url); }); return c[c.length - 1]; }

// ── S1: a response for the campaign this device has left ───────────────────────────────────────────────────────────
kase("S1: campaign A's 200 landing after the switch to B leaves B's sync base alone — B's next save is still guarded", function (E) {
  var net = switchWithAInFlight(E);
  storageAdapter.markFlushDirty("campA", 1999); storageAdapter.markFlushDirty("campB", 10);
  net.aPost.answer(reply(200, { ok: true }));
  return tick().then(function () {
    var s = storageAdapter.syncStatus();
    assert.strictEqual(s.lastAckTurn, -1, "A's turn (2000) became B's sync base: " + s.lastAckTurn);
    assert.strictEqual(storageAdapter.flushDirtyTurn("campA"), null, "A's own save landed — A's unsynced marker must clear");
    assert.strictEqual(storageAdapter.flushDirtyTurn("campB"), 10, "B's unsynced marker was cleared by A's answer");
    assert.ok(!net.calls.some(function (c) { return /\/portrait$/.test(c.url); }), "a portrait upload was fired from A's answer — it would carry B's portraits under A's id: " + JSON.stringify(net.calls.map(function (c) { return c.method + " " + c.url; })));
    storageAdapter.syncNow();
    var p = lastStatePost(net);
    assert.strictEqual(p.body.campaignId, "campB");
    assert.strictEqual(p.body.worldState.turn, 10);
    assert.strictEqual(p.body.baseTurn, -1, "B's save went out with A's turn as its base (the server then accepts an older B over a newer one): baseTurn " + p.body.baseTurn);
  });
});
kase("S1: campaign A's 409 landing after the switch does not pause B's sync", function (E) {
  var net = switchWithAInFlight(E);
  net.aPost.answer(reply(409, { serverTurn: 2500 }));
  return tick().then(function () {
    assert.strictEqual(storageAdapter.syncStatus().conflict, null, "B is paused on A's conflict");
    assert.ok(!E.said.toasts.some(function (t) { return /Another device is ahead/.test(t); }), "the player was told B is behind another device: " + E.said.toasts.join(" | "));
    storageAdapter.syncNow();
    assert.strictEqual(lastStatePost(net).body.campaignId, "campB", "B's save did not go out");
  });
});
kase("S1: campaign A's self-healing 409 (server turn below A's) does not hand B a base or re-post B as A's retry", function (E) {
  var net = switchWithAInFlight(E);
  net.aPost.answer(reply(409, { serverTurn: 5 }));   // 5 <= B's local turn 10: the stale handler used to "heal", ack 5 for B and re-post
  return tick().then(function () {
    assert.strictEqual(storageAdapter.syncStatus().lastAckTurn, -1, "A's 409 seeded B's base: " + storageAdapter.syncStatus().lastAckTurn);
    assert.strictEqual(net.calls.filter(function (c) { return c.method === "POST" && /\/api\/state$/.test(c.url); }).length, 1, "A's 409 fired a retry that carried campaign B");
  });
});
kase("S1: campaign A's 403 foreign_campaign landing after the switch does not move campaign B to a new id", function (E) {
  var net = switchWithAInFlight(E);
  net.aPost.answer(reply(403, { reason: "foreign_campaign" }));
  return tick().then(function () {
    assert.strictEqual(getActiveCampId(), "campB", "campaign B was re-homed on campaign A's refusal: " + getActiveCampId());
    assert.strictEqual(worldState.campId, "campB");
    assert.ok(getCampMeta().some(function (m) { return m.id === "campB"; }), "B's list row is gone");
    assert.strictEqual(storageAdapter.syncStatus().failCount, 0, "A's refusal was counted as B's sync failure");
  });
});
kase("S1: campaign A's failure landing after the switch (a 500, a 413, a network error) is not B's failure, and each is logged", function (E) {
  var net = switchWithAInFlight(E);
  net.aPost.answer(reply(500, {}));
  return tick().then(function () {
    assert.strictEqual(storageAdapter.syncStatus().failCount, 0, "A's 500 lit B's failure badge");
    assert.ok(E.said.infos.concat(E.said.warns).some(function (l) { return /campA/.test(l) && /campB/.test(l); }), "the dropped answer was not logged with both campaign ids: " + JSON.stringify(E.said));
  });
});
kase("S1: campaign A's network error landing after the switch is not B's failure either", function (E) {
  var net = switchWithAInFlight(E);
  net.aPost.fail(new Error("socket hang up"));
  return tick().then(function () {
    assert.strictEqual(storageAdapter.syncStatus().failCount, 0, "A's network error lit B's failure badge");
    assert.ok(E.said.infos.some(function (l) { return /campA/.test(l) && /socket hang up/.test(l); }), "the dropped failure was not logged: " + JSON.stringify(E.said.infos));
  });
});
kase("S1: the same campaign still acks its own 200 (the guard is on identity, not on every late answer)", function (E) {
  var net = twoCampaigns(E);
  storageAdapter.resetSyncState();
  storageAdapter.syncNow();
  var post = net.pending.filter(function (p) { return p.call.method === "POST"; })[0];
  assert.strictEqual(post.call.body.campaignId, "campA");
  storageAdapter.markFlushDirty("campA", 2000);
  post.answer(reply(200, { ok: true }));
  return tick().then(function () {
    assert.strictEqual(storageAdapter.syncStatus().lastAckTurn, 2000, "the active campaign's own 200 was not acked");
    assert.strictEqual(storageAdapter.flushDirtyTurn("campA"), null);
  });
});

// ── S2: the boot reconcile finds the cloud ahead while a turn is in flight ─────────────────────────────────────────
function reconcileWhileBusy(E) {
  var posts = [], local = E.L.makeTestWorld({ campId: "campA", turn: 10 });
  var server = JSON.parse(JSON.stringify(local)); server.turn = 50; server.character.name = "Tess";
  setActiveCampId("campA");
  store.set(WSK, serializeWorldState(local)); store.set(SLK, "[]"); store.set(MEM_KEY, JSON.stringify(blankMemory()));
  setCampMeta([{ id: "campA", campName: "A", onServer: true }]);
  global.fetch = function (url, opts) {
    var m = (opts && opts.method) || "GET";
    if (m === "POST") { posts.push(JSON.parse(opts.body)); return Promise.resolve(reply(200, { ok: true })); }
    if (/\/api\/campaigns\/campA$/.test(url)) return Promise.resolve(reply(200, { campaignId: "campA", worldState: JSON.parse(JSON.stringify(server)), sessionLog: [], memory: blankMemory() }));
    return Promise.resolve(reply(200, []));
  };
  storageAdapter.setServer("https://unit.test", "tok");
  return posts;
}
kase("S2: the cloud is ahead and a turn is in flight — the older local copy is never posted over it, and the player is told", function (E) {
  var posts = reconcileWhileBusy(E);
  busy = true;                                     // the player pressed Send before the reconcile GET returned
  storageAdapter.load(function () {});
  return tick(60).then(function () {
    var s = storageAdapter.syncStatus();
    assert.strictEqual(worldState.turn, 10, "the world was swapped under the turn in flight");
    assert.notStrictEqual(s.lastAckTurn, 50, "the cloud's turn (50) became this device's sync base while its copy was NOT adopted");
    assert.ok(s.conflict && s.conflict.serverTurn === 50, "sync is not paused on the newer cloud copy: " + JSON.stringify(s));
    assert.ok(E.said.toasts.some(function (t) { return /ahead/.test(t) && /50/.test(t); }), "nothing told the player the cloud copy is ahead: " + JSON.stringify(E.said.toasts));
    assert.ok(E.said.warns.some(function (l) { return /turn was in flight|while a turn/.test(l); }), "the reason (a turn in flight) was not logged: " + JSON.stringify(E.said.warns));
    busy = false; worldState.turn = 11;             // the turn commits
    storageAdapter.syncNow();
    return tick(40);
  }).then(function () {
    assert.strictEqual(posts.length, 0, "the older local copy was posted over the newer cloud copy: turn " + (posts[0] && posts[0].worldState.turn) + " baseTurn " + (posts[0] && posts[0].baseTurn));
  });
});
kase("S2: with no turn in flight the same reconcile adopts the newer cloud copy and seeds the base, as before", function (E) {
  var posts = reconcileWhileBusy(E);
  busy = false;
  storageAdapter.load(function () {});
  return tick(60).then(function () {
    assert.strictEqual(worldState.turn, 50, "the newer cloud copy was not adopted");
    assert.strictEqual(storageAdapter.syncStatus().lastAckTurn, 50);
    assert.strictEqual(storageAdapter.syncStatus().conflict, null);
    assert.strictEqual(posts.length, 0);
  });
});

// ── runner ──────────────────────────────────────────────────────────────────────────────────────────────────────────
var argv = process.argv.slice(2), at = argv.indexOf("--case");
if (at >= 0) {
  var one = CASES.filter(function (c) { return c.name === argv[at + 1]; })[0];
  if (!one) { process.stderr.write("no such case: " + argv[at + 1] + "\n"); process.exit(2); }
  var err = console.error, E;
  Promise.resolve().then(function () { E = boot(); return one.fn(E); }).then(function () { process.exit(0); }, function (e) { err.call(console, (e && e.stack) || String(e)); process.exit(1); });
} else {
  var only = argv.indexOf("--only") >= 0 ? argv[argv.indexOf("--only") + 1] : "", passed = 0, failed = 0;
  var run = CASES.filter(function (c) { return !only || c.name.indexOf(only) >= 0; });
  if (!run.length) { console.error("--only \"" + only + "\" matched 0 tests — NOTHING ran"); process.exit(1); }
  run.forEach(function (c) {
    var r = cp.spawnSync(process.execPath, [__filename, "--case", c.name], { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 60000 });
    if (r.status === 0) { passed++; console.log("PASS #777 " + c.name); }
    else { failed++; console.error("FAIL #777 " + c.name + " — " + (String(r.stderr || "") + String(r.stdout || "")).trim().split(/\r?\n/).slice(0, 6).join("\n    ") + (r.error ? " [" + r.error.message + "]" : "")); }
  });
  if (failed) { console.error("#777 sync: " + failed + " FAILED, " + passed + " passed"); process.exit(1); }
  console.log("ALL GREEN — " + passed + " #777 sync cases");
}
