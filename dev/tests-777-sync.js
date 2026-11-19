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

// ── S3: a local save that cannot be read or prepared ───────────────────────────────────────────────────────────────
function storedCampaign(E, mutate) {
  var ws = E.L.makeTestWorld({ campId: "campA", campName: "A", turn: 40 });
  setActiveCampId("campA");
  var raw = serializeWorldState(ws);
  if (mutate) raw = mutate(raw, ws);
  store.set(WSK, raw); store.set(SLK, "[]"); store.set(MEM_KEY, JSON.stringify(blankMemory()));
  setCampMeta([{ id: "campA", campName: "A" }]);
  E.said.toasts.length = 0; E.said.errors.length = 0;
  return raw;
}
kase("S3: a cut-off save is refused out loud — the reason is kept for the boot, the bytes are kept twice, nothing is written", function (E) {
  var raw = storedCampaign(E, function (r) { return r.slice(0, Math.floor(r.length / 2)); });
  assert.strictEqual(loadState(), false);
  var u = unreadableLoad();
  assert.ok(u && u.stage === "read" && u.campId === "campA", "the boot has no reason to show: " + JSON.stringify(u));
  assert.ok(u.reason && u.reason.length > 3, "the reason is empty");
  assert.strictEqual(store.get(WSK), raw, "the stored save was changed");
  assert.strictEqual(u.rescueKey, STORE_RESCUE_K + "core_campA");
  assert.strictEqual(store.get(u.rescueKey), raw, "no second copy of the unreadable save was kept");
  assert.ok(E.said.errors.some(function (l) { return /could not be read/.test(l); }), "nothing on the console: " + JSON.stringify(E.said.errors));
  assert.ok(E.said.toasts.some(function (t) { return /could not be read/.test(t) && /Nothing was changed/.test(t); }), "the player was told nothing: " + JSON.stringify(E.said.toasts));
  assert.strictEqual(versionRefusedLoad(), null, "a damaged save was reported as a newer build's");
});
kase("S3: a save whose heal throws (a null in a spell list) is refused the same way, and the stored bytes stay as they were", function (E) {
  var raw = storedCampaign(E, function (r, ws) { ws.character.spells = [null]; return serializeWorldState(ws); });
  assert.strictEqual(loadState(), false);
  var u = unreadableLoad();
  assert.ok(u && u.stage === "prepared", "the boot has no reason to show: " + JSON.stringify(u));
  assert.strictEqual(store.get(WSK), raw, "the stored save was changed by a half-finished heal");
  assert.strictEqual(store.get(u.rescueKey), raw);
  assert.ok(E.said.toasts.length === 1, "one toast, not " + E.said.toasts.length);
});
kase("S3: a healthy save loads with no refusal, and the next load after a refusal clears it", function (E) {
  storedCampaign(E, function (r) { return r.slice(0, 50); });
  assert.strictEqual(loadState(), false); assert.ok(unreadableLoad());
  storedCampaign(E, null);
  assert.strictEqual(loadState(), true);
  assert.strictEqual(unreadableLoad(), null, "a stale refusal survived a good load");
  assert.strictEqual(worldState.turn, 40);
});
kase("S3: with an unreadable local save the boot adopts nothing from the cloud over it", function (E) {
  storedCampaign(E, function (r) { return r.slice(0, 80); });
  var calls = [];
  global.fetch = function (url) { calls.push(String(url)); return Promise.resolve(reply(200, { campaignId: "campOther", worldState: E.L.makeTestWorld({ campId: "campOther", turn: 900 }), sessionLog: [], memory: blankMemory() })); };
  storageAdapter.setServer("https://unit.test", "tok");
  var got = null;
  storageAdapter.load(function (ok) { got = ok; });
  return tick(40).then(function () {
    assert.strictEqual(got, false);
    assert.strictEqual(calls.filter(function (u) { return /\/api\/(state|campaigns\/)/.test(u); }).length, 0, "the boot asked the cloud for a campaign to adopt: " + calls.join(", "));
    assert.strictEqual(worldState, null, "a cloud campaign was adopted over the unreadable save");
  });
});
kase("S3: switching to a campaign whose slot is unreadable rolls back, keeps a copy of the slot, and says the real reason once", function (E) {
  twoCampaigns(E);
  var bad = store.get(campSlotKey("campB", "ws")).slice(0, 60);
  store.set(campSlotKey("campB", "ws"), bad);
  E.said.toasts.length = 0;
  assert.strictEqual(switchToCampaign("campB"), false);
  assert.strictEqual(getActiveCampId(), "campA"); assert.strictEqual(worldState.campId, "campA");
  assert.strictEqual(store.get(STORE_RESCUE_K + "core_campB"), bad, "the unreadable slot was not kept");
  assert.strictEqual(unreadableLoad(), null, "the rollback left a refusal standing for the campaign that IS open");
  assert.ok(E.said.toasts.some(function (t) { return /could not be read/.test(t); }), "the reason was not said: " + JSON.stringify(E.said.toasts));
  assert.ok(!E.said.toasts.some(function (t) { return /looks corrupted/.test(t); }), "the generic line was said on top of the real reason");
});
kase("S3: the refusal screen's text escapes the reason and offers the three ways on; the boot shows it in place of the wizard", function () {
  var h = unreadableSaveHtml({ reason: "<img src=x onerror=alert(1)>", stage: "prepared", campId: "c", rescueKey: "k" });
  assert.ok(h.indexOf("<img") < 0 && h.indexOf("&lt;img") >= 0, "the reason is painted as HTML");
  ["us-download", "us-campaigns", "us-new"].forEach(function (id) { assert.ok(h.indexOf("id='" + id + "'") >= 0, "no " + id + " button"); });
  assert.ok(/prepared for play/.test(h) && /backup of the unreadable save was kept/.test(h));
  assert.ok(/could NOT be kept/.test(unreadableSaveHtml({ reason: "x", stage: "read", rescueKey: null })));
  var fs = require("fs"), boot = fs.readFileSync(path.join(__dirname, "..", "ui-boot.js"), "utf8");
  var at = boot.indexOf("if(typeof unreadableLoad===\"function\"&&unreadableLoad()){showUnreadableSaveScreen(unreadableLoad(),_wizard);return;}");
  assert.ok(at >= 0, "initState does not show the refusal screen");
  assert.ok(at < boot.indexOf("    _wizard();\n  }".replace(/\n/g, boot.indexOf("\r\n") >= 0 ? "\r\n" : "\n")), "the wizard runs before the refusal is checked");
});

// ── S4, S6: the .tnd import ────────────────────────────────────────────────────────────────────────────────────────
function liveAndImport(E, mutate) {
  var live = E.L.makeTestWorld({ campId: "campLive", campName: "Live", turn: 7 });
  setActiveCampId("campLive"); memory.campId = "campLive"; memory.lore.push("LIVE-LORE");
  store.set(WSK, serializeWorldState(live)); store.set(SLK, JSON.stringify(sessionLog)); store.set(MEM_KEY, JSON.stringify(memory));
  setCampMeta([{ id: "campLive", campName: "Live" }]);
  var imp = JSON.parse(JSON.stringify(live)); imp.campId = "campForeign"; imp.campName = "Imported"; imp.character.name = "Imp";
  if (mutate) mutate(imp);
  return { live: live, data: { worldState: imp, sessionLog: [{ role: "user", content: "IMPORTED-LINE" }], memory: { lore: ["IMPORTED-LORE"] } } };
}
kase("S4: an import that throws while it is prepared is undone — the open campaign, its memory and the active id are as they were, nothing is saved", function (E) {
  var f = liveAndImport(E, function (imp) { imp.character.spells = [null]; });
  var wsBefore = store.get(WSK), memBefore = store.get(MEM_KEY), liveObj = worldState, memObj = memory, slObj = sessionLog, threw = null;
  try { importSaveData(f.data); } catch (e) { threw = e; }
  assert.ok(threw, "the import of a file with a null spell did not throw (pick another malformed field)");
  assert.strictEqual(getActiveCampId(), "campLive", "the active id is the half-imported campaign's: " + getActiveCampId());
  assert.strictEqual(worldState, liveObj, "worldState is the half-imported world: " + (worldState && worldState.campName));
  assert.strictEqual(memory, memObj, "memory is the import's: " + JSON.stringify(memory.lore));
  assert.strictEqual(sessionLog, slObj);
  assert.strictEqual(store.get(WSK), wsBefore, "the live save was written");
  assert.strictEqual(store.get(MEM_KEY), memBefore);
  assert.ok(E.said.errors.some(function (l) { return /The import is undone/.test(l); }), "the undo was not logged");
  saveAll();
  assert.strictEqual(parseWorldState(store.get(WSK)).campName, "Live", "the next save wrote the half-imported campaign");
});
kase("S4: a good import still lands whole, as before", function (E) {
  var f = liveAndImport(E, null);
  var plan = importSaveData(f.data);
  assert.strictEqual(getActiveCampId(), plan.id);
  assert.strictEqual(worldState.campName, "Imported");
  assert.deepStrictEqual(memory.lore, ["IMPORTED-LORE"]);
  assert.strictEqual(parseWorldState(store.get(WSK)).campName, "Imported");
});
kase("S6: an import while a turn is in flight is refused before anything changes", function (E) {
  var f = liveAndImport(E, null), threw = null;
  busy = true;
  try { importSaveData(f.data); } catch (e) { threw = e; }
  busy = false;
  assert.ok(threw && /turn is still in flight/.test(threw.message), "the import ran under a turn in flight: " + (threw && threw.message));
  assert.strictEqual(getActiveCampId(), "campLive"); assert.strictEqual(worldState.campName, "Live");
});

// ── S5: what counts as a long-term memory ──────────────────────────────────────────────────────────────────────────
kase("S5: {} and every other non-memory are named as such; a real memory passes; a partial one keeps what it has", function () {
  assert.strictEqual(memoryShapeIssue(blankMemory()), "");
  assert.ok(/empty shell/.test(memoryShapeIssue({})));
  assert.strictEqual(memoryShapeIssue(undefined), "absent"); assert.strictEqual(memoryShapeIssue(null), "null");
  assert.strictEqual(memoryShapeIssue([]), "an array"); assert.strictEqual(memoryShapeIssue("x"), "a string");
  var a = memoryAdmit({});
  assert.ok(a.blank && a.issue && Object.keys(a.memory.npcs).length === 0 && Array.isArray(a.memory.lore));
  var partial = blankMemory(); partial.lore = ["KEPT"]; delete partial.keyDecisions; partial.locations = [];
  var p = memoryAdmit(partial);
  assert.strictEqual(p.blank, false); assert.strictEqual(p.issue, "missing locations, keyDecisions");
  assert.deepStrictEqual(p.memory.lore, ["KEPT"]); assert.ok(Array.isArray(p.memory.keyDecisions) && !Array.isArray(p.memory.locations));
  assert.strictEqual(memoryAdmit(blankMemory()).issue, "");
});
kase("S5: a stored memory of {} is rescued and replaced at load, not loaded as healthy", function (E) {
  storedCampaign(E, null);
  store.set(MEM_KEY, "{}");
  assert.strictEqual(loadState(), true);
  assert.ok(memory.npcs && Array.isArray(memory.lore), "the loaded memory has no stores");
  assert.strictEqual(store.get(STORE_RESCUE_K + "mem_campA"), "{}", "the unusable memory was not kept");
  assert.ok(E.said.toasts.some(function (t) { return /long-term memory could not be read/.test(t); }), "the player was not told: " + JSON.stringify(E.said.toasts));
});
kase("S5: the reconcile adopts a cloud copy whose memory is {} with an empty memory, and says so", function (E) {
  var local = E.L.makeTestWorld({ campId: "campA", turn: 10 }), server = JSON.parse(JSON.stringify(local)); server.turn = 50;
  setActiveCampId("campA"); store.set(WSK, serializeWorldState(local)); store.set(SLK, "[]"); store.set(MEM_KEY, JSON.stringify(blankMemory()));
  setCampMeta([{ id: "campA", campName: "A", onServer: true }]);
  global.fetch = function (url, opts) {
    if (opts && opts.method === "POST") return Promise.resolve(reply(200, { ok: true }));
    if (/\/api\/campaigns\/campA$/.test(url)) return Promise.resolve(reply(200, { campaignId: "campA", worldState: server, sessionLog: [], memory: {} }));
    return Promise.resolve(reply(200, []));
  };
  storageAdapter.setServer("https://unit.test", "tok");
  E.said.toasts.length = 0; E.said.warns.length = 0;
  storageAdapter.load(function () {});
  return tick(60).then(function () {
    assert.strictEqual(worldState.turn, 50);
    assert.ok(memory.npcs && memory.locations && Array.isArray(memory.chapters), "the adopted memory has no stores (the first reader throws)");
    assert.ok(E.said.warns.some(function (l) { return /no usable long-term memory/.test(l); }), "not logged: " + JSON.stringify(E.said.warns));
    assert.ok(E.said.toasts.some(function (t) { return /no long-term memory/.test(t); }), "the player was not told: " + JSON.stringify(E.said.toasts));
  });
});
kase("S5: a camp held with a memory of {} is refused at restore; the live campaign is untouched", function (E) {
  var ws = E.L.makeTestWorld({ campId: "campA", turn: 12 });
  setActiveCampId("campA"); worldState = ws; memory.lore.push("LIVE-LORE");
  var snap = checkpointCapture("rest");
  assert.ok(snap && snap.mem, "no camp was captured");
  var broken = JSON.parse(JSON.stringify(snap)); broken.mem = "{}";
  var liveMem = memory, r = checkpointRestore(broken, { cause: "a fall" });
  assert.strictEqual(r.ok, false, "a camp with no memory stores was restored (then saved and synced)");
  assert.ok(/empty shell/.test(r.reason), r.reason);
  assert.strictEqual(memory, liveMem); assert.deepStrictEqual(memory.lore, ["LIVE-LORE"]);
  assert.strictEqual(checkpointRestore(snap, { cause: "a fall" }).ok, true, "a whole camp no longer restores");
});
function shell(E, file) {   /* a DOM-shell file is not in the engine manifest: evaluated here over a document that holds nothing */
  global.document = { getElementById: function () { return null; }, querySelector: function () { return null; }, addEventListener: function () {} };
  (0, eval)(require("fs").readFileSync(path.join(__dirname, "..", file), "utf8"));
}
kase("S5: the manual pull's memory check is the same one — {} downloads as an empty memory, loudly", function (E) {
  shell(E, "ui-campaigns.js");
  setCampMeta([{ id: "campA", campName: "Riverlight" }]);
  E.said.toasts.length = 0; E.said.warns.length = 0;
  var m = _pulledMemory({ memory: {} }, "campA");
  assert.ok(m.npcs && Array.isArray(m.lore), "{} was handed on as the campaign's memory");
  assert.ok(E.said.warns.some(function (l) { return /no usable long-term memory/.test(l); }) && E.said.toasts.length === 1);
  var real = blankMemory(); real.lore.push("X");
  assert.strictEqual(_pulledMemory({ memory: real }, "campA"), real);
});

// ── S7: Load re-checks `busy` at the switch ────────────────────────────────────────────────────────────────────────
kase("S7: the local Load does not switch campaigns while a turn is in flight (it can be reached 20 s after the first check)", function (E) {
  twoCampaigns(E); shell(E, "ui-campaigns.js");
  var applied = 0; _applyLoadedCampaign = function () { applied++; };
  E.said.toasts.length = 0; busy = true;
  _campLoadLocal("campB");
  assert.strictEqual(getActiveCampId(), "campA", "the campaign was switched under a turn in flight");
  assert.strictEqual(applied, 0);
  assert.ok(E.said.toasts.some(function (t) { return /Finish the current turn first/.test(t); }), "nothing was said");
  busy = false; _campLoadLocal("campB");
  assert.strictEqual(getActiveCampId(), "campB"); assert.strictEqual(applied, 1);
});

// ── S8: the scripts a network-first page loads ─────────────────────────────────────────────────────────────────────
kase("S8: a script loaded by a page outside the app shell is network-first too — the designer's own scripts included", function () {
  var cg = require("./class-guards.js"), fs = require("fs"), root = path.join(__dirname, "..");
  var sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  assert.deepStrictEqual(cg.networkFirstScriptProblems(root), [], "a network-first page loads a cache-first script");
  var page = { file: "blueprint-designer.html", text: "<script src=\"designer-acts.js\"></script><script src='globals.js'></script><script src=\"https://cdn.example/x.js\"></script><link rel=\"stylesheet\" href=\"satellite.css\"><script src=\"stray-tool.js?v=3\"></script>" };
  var found = cg.networkFirstScriptProblems(root, { pages: [page], sw: sw });
  assert.strictEqual(found.length, 1, "expected only the stray script to be flagged: " + JSON.stringify(found));
  assert.ok(/stray-tool\.js\?v=3/.test(found[0]));
  var old = sw.replace("|\\/designer-/.test(e.request.url)", "/.test(e.request.url)");
  assert.notStrictEqual(old, sw, "sw.js's network-first regex no longer names /designer-");
  assert.ok(cg.networkFirstScriptProblems(root, { sw: old }).some(function (p) { return /designer-acts\.js/.test(p); }), "without /designer- in the regex the guard must name the designer scripts");
  assert.ok(cg.allProblems(root).length === 0, "the class guards are red: " + cg.allProblems(root).join(" | "));
  assert.ok(String(cg.allProblems).indexOf(".concat(networkFirstScriptProblems(root))") >= 0, "the script check is not part of the class guards run-tests calls");
});

// ── S9: a refused portrait upload ──────────────────────────────────────────────────────────────────────────────────
kase("S9: a portrait upload the server refuses is logged and sent again with the next save", function (E) {
  var puts = [], status = 500;
  var ws = E.L.makeTestWorld({ campId: "campA", turn: 3 }); ws.character.portrait = "data:image/jpeg;base64,AAAA";
  setActiveCampId("campA"); worldState = ws;
  global.fetch = function (url, opts) {
    if (/\/portrait$/.test(url)) { puts.push(url); return Promise.resolve(reply(status, {})); }
    return Promise.resolve(reply(200, { ok: true }));
  };
  storageAdapter.setServer("https://unit.test", "tok"); storageAdapter.resetSyncState();
  storageAdapter.syncNow();
  return tick(30).then(function () {
    assert.strictEqual(puts.length, 1, "the first save did not upload the portrait");
    assert.ok(E.said.warns.some(function (l) { return /portrait sync refused/.test(l) && /500/.test(l); }), "the refusal was not logged: " + JSON.stringify(E.said.warns));
    status = 200; worldState.turn = 4;
    storageAdapter.syncNow();
    return tick(30);
  }).then(function () {
    assert.strictEqual(puts.length, 2, "the refused portrait was never sent again");
    worldState.turn = 5; storageAdapter.syncNow();
    return tick(30);
  }).then(function () { assert.strictEqual(puts.length, 2, "an accepted portrait is uploaded again on every save"); });
});

// ── S10, S11: what follows a campaign to a new id, and what leaves with it ─────────────────────────────────────────
function idbStub() {
  var seen = { put: [], del: [], get: [], store: {} };
  idbPutCheckpoint = function (id, snap) { seen.put.push(id); seen.store[id] = snap; return Promise.resolve(true); };
  idbGetCheckpoint = function (id) { seen.get.push(id); return Promise.resolve(seen.store[id] || null); };
  idbDelCheckpoint = function (id) { seen.del.push(id); delete seen.store[id]; return Promise.resolve(true); };
  return seen;
}
kase("S10: a re-homed campaign takes its preserved copies with it (the transcript rescue, the store and clock rescues)", function (E) {
  var ws = E.L.makeTestWorld({ campId: "campA", turn: 9 });
  setActiveCampId("campA"); worldState = ws; setCampMeta([{ id: "campA", campName: "A", onServer: true }]);
  store.set(WSK, serializeWorldState(ws)); store.set(SLK, "[]"); store.set(MEM_KEY, JSON.stringify(memory));
  var olds = campRescueKeys("campA");
  assert.strictEqual(olds.length, 5);
  olds.forEach(function (k, i) { store.set(k, "RESCUED-" + i); });
  var nid = rehomeCampaign("test");
  campRescueKeys(nid).forEach(function (k, i) { assert.strictEqual(store.get(k), "RESCUED-" + i, "the preserved copy " + olds[i] + " did not follow the campaign to " + k); });
  olds.forEach(function (k) { assert.strictEqual(store.get(k), null, k + " was left under the old id"); });
  assert.strictEqual(store.get(TRANSCRIPT_RESCUE_K + worldState.campId), "RESCUED-0", "the next load looks for the transcript rescue under the campaign's id and must find it");
});
kase("S11: a deleted campaign's camp leaves IndexedDB; Remove local does the same; freeing a slot mid-switch does not", function (E) {
  var seen = idbStub();
  setCampMeta([{ id: "campX", campName: "X" }, { id: "campY", campName: "Y" }, { id: "campZ", campName: "Z" }]);
  deleteCampaign("campX");
  removeCampaignLocalCopy("campY", { teardown: true });
  removeCampaignLocalCopy("campZ");
  return tick().then(function () { assert.deepStrictEqual(seen.del, ["campX", "campY"], "camps removed: " + JSON.stringify(seen.del)); });
});
kase("S11: a re-homed campaign's camp is moved to the new id in IndexedDB, restamped", function (E) {
  var seen = idbStub(), ws = E.L.makeTestWorld({ campId: "campA", turn: 9 });
  setActiveCampId("campA"); worldState = ws; setCampMeta([{ id: "campA", campName: "A" }]);
  store.set(WSK, serializeWorldState(ws)); store.set(SLK, "[]"); store.set(MEM_KEY, JSON.stringify(memory));
  seen.store.campA = { campId: "campA", turn: 5, ws: "{}" };
  var nid = rehomeCampaign("test");
  return tick().then(function () {
    assert.ok(seen.store[nid] && seen.store[nid].campId === nid, "no camp under the new id: " + JSON.stringify(Object.keys(seen.store)));
    assert.strictEqual(seen.store.campA, undefined, "the camp was left under the old id");
  });
});

// ── S13, S5: the manual push says why it refused ───────────────────────────────────────────────────────────────────
kase("S13: a push of a campaign whose saved world cannot be read says so, with or without a callback; a memory of {} is refused too", function (E) {
  twoCampaigns(E); shell(E, "ui-campaigns.js");
  store.set(campSlotKey("campB", "ws"), "{\"campId\":\"campB\",\"turn\":");
  E.said.toasts.length = 0; E.said.warns.length = 0;
  var got = null;
  campCloudPushSilent("campB", function (ok) { got = ok; });
  assert.strictEqual(got, false);
  assert.ok(E.said.toasts.some(function (t) { return /wasn't pushed/.test(t) && /could not be read/.test(t); }), "nothing told the player why: " + JSON.stringify(E.said.toasts));
  E.said.toasts.length = 0;
  campCloudPushSilent("campB", null);   // the rename path
  assert.ok(E.said.toasts.length === 1 && E.said.warns.some(function (l) { return /cloud push REFUSED/.test(l); }), "the callback-less push was silent");
  var B = E.L.makeTestWorld({ campId: "campB", campName: "B", turn: 10 });
  store.set(campSlotKey("campB", "ws"), serializeWorldState(B)); store.set(campSlotKey("campB", "mem"), "{}");
  E.said.toasts.length = 0; got = null;
  campCloudPushSilent("campB", function (ok) { got = ok; });
  assert.strictEqual(got, false, "a memory of {} was pushed to the cloud");
  assert.ok(E.said.toasts.some(function (t) { return /empty shell/.test(t); }), JSON.stringify(E.said.toasts));
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
