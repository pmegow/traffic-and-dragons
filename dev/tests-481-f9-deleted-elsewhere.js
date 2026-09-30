// tests-481-f9-deleted-elsewhere.js — #481 F9 (audit 2026-09-29, Fable-approved; Fable-tier): a campaign deleted on one device
// was quietly put back by another. The desktop's boot reconcile read the 404 for its active campaign as "a local-only campaign
// whose first push is still pending", the list sync pruned its picker row, and the next save re-created the server row — the
// phone's delete undone without a word. Now a 404 for a campaign the server once held ASKS (keep and re-upload, or remove from
// this device), and pushes of it pause until the answer — across a reload too. And a reconcile answer that lands after the
// device switched campaigns is ignored as stale instead of being blamed on "a server-side id mismatch".
// The #449 harness shape: the engine manifest geval'd, own fetch stub, storageAdapter.load() driving the real reconcile.
//   node dev/tests-481-f9-deleted-elsewhere.js
var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
var files = require("./engine-manifest.js").map(function (entry) { return entry.file; });
var geval = eval;
for (var i = 0; i < files.length; i++) {
  try { geval(fs.readFileSync(path.join(root, files[i]), "utf8")); }
  catch (e) { console.error("ENGINE LOAD FAILED in " + files[i] + ": " + e.message); process.exit(1); }
}
var pass = 0, fails = [], chain = Promise.resolve();
function tAsync(name, fn) {
  chain = chain.then(function () {
    return Promise.resolve().then(fn).then(
      function (r) { if (r === true || r === undefined) { pass++; process.stdout.write("PASS #481 F9 " + name + "\n"); } else { fails.push(name + " — " + r); process.stdout.write("FAIL #481 F9 " + name + " — " + r + "\n"); } },
      function (e) { fails.push(name + " — threw: " + e.message); process.stdout.write("FAIL #481 F9 " + name + " — threw: " + (e && e.stack || e) + "\n"); }
    );
  });
}
var BASE = "https://unit.test", calls = [], responder = null;
global.fetch = function (url, opts) {
  opts = opts || {}; calls.push({ url: url, method: opts.method || "GET", body: opts.body });
  var r = responder ? responder(url, opts) : null;
  return r || Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } });
};
function ok(data) { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(data || {}); } }); }
function httpErr(status, data) { return Promise.resolve({ ok: false, status: status, json: function () { return Promise.resolve(data || {}); } }); }
function settle(ms) { return new Promise(function (res) { setTimeout(res, ms || 60); }); }
var toasts = [], warns = [], errors = [], infos = [], asked = [];
global.showToast = function (m) { toasts.push(String(m)); };
global.addMsg = function () {}; global.syncUI = function () {}; global.showGame = function () {};
global.initAbilities = function () {}; global.initSpells = function () {}; global.rebuildNarrativeFromTranscript = function () { return true; };
global.busy = false;
global.onCampaignDeletedElsewhere = function (id, name) { asked.push(id + "|" + name); };
console.warn = function () { warns.push(Array.prototype.slice.call(arguments).join(" ")); };
console.error = function () { errors.push(Array.prototype.slice.call(arguments).join(" ")); };
console.info = function () { infos.push(Array.prototype.slice.call(arguments).join(" ")); };
var A = "camp_1700000000000_0481", B = "camp_1700000000001_0482";
function blob(campId, turn) {
  return { worldState: { turn: turn, campId: campId, character: { name: "Ammut", hp: 20, maxHp: 20, inventory: [], abilities: [], spells: [] },
    world: { location: "The Gate" }, npcs: [], questLog: [], eventHistory: [], transcript: [{ t: turn, r: "gm", x: "Turn " + turn + "." }] },
    sessionLog: [], memory: blankMemory(), portrait: null, npcPortraits: null, campaignId: campId, updatedAt: 1 };
}
function seedLocal(id, turn, onServer) {
  var ws = blob(id, turn).worldState;
  store.set(WSK, serializeWorldState(ws)); store.set(SLK, "[]"); store.set(MEM_KEY, JSON.stringify(blankMemory()));
  setActiveCampId(id); worldState = ws; sessionLog = []; memory = blankMemory();
  var row = { id: id, name: "The Gate road", savedAt: 1 }; if (onServer) row.onServer = true;
  setCampMeta([row]);
}
function resetAll() { calls.length = 0; toasts.length = 0; warns.length = 0; errors.length = 0; infos.length = 0; asked.length = 0; responder = null; storageAdapter.resetSyncState(); }
function deletedServer() {   /* the phone deleted A: its row is gone and the list no longer names it */
  return function (url, opts) {
    var m = opts.method || "GET";
    if (m === "POST") return ok({});
    if (url === BASE + "/api/campaigns/" + A + "/turn") return httpErr(404, { error: "Not found" });
    if (url === BASE + "/api/campaigns/" + A) return httpErr(404, { error: "Not found" });
    if (url === BASE + "/api/campaigns") return ok([]);
    return null;
  };
}
function posts() { return calls.filter(function (c) { return c.method === "POST"; }); }
storageAdapter.setServer(BASE, "TOK_481F9");

tAsync("the repro: a campaign the server once held and no longer does is not quietly re-uploaded — the device asks", function () {
  store.del("tnd_deleted_elsewhere_v1");
  seedLocal(A, 35, true); resetAll(); responder = deletedServer();
  storageAdapter.load(function () {});
  return settle().then(function () {
    calls.length = 0; storageAdapter.syncNow(false); return settle();
  }).then(function () {
    if (posts().length) return "the deleted campaign was re-uploaded (" + posts().length + " POST) — the phone's delete undone silently";
    if (asked.length !== 1 || asked[0].indexOf(A) !== 0) return "the device never asked: " + JSON.stringify(asked);
    return worldState && worldState.campId === A && worldState.turn === 35 ? true : "the local copy changed before the answer";
  });
});
tAsync("the question and the pause survive a reload (the list sync pruned the picker row)", function () {
  resetAll(); responder = deletedServer();
  storageAdapter.load(function () {});
  return settle().then(function () {
    calls.length = 0; storageAdapter.syncNow(false); return settle();
  }).then(function () {
    if (posts().length) return "after a reload the deleted campaign was re-uploaded";
    return asked.length === 1 ? true : "the reload did not ask again: " + JSON.stringify(asked);
  });
});
tAsync("Keep re-uploads it; the question is answered", function () {
  resetAll(); responder = deletedServer();
  if (typeof storageAdapter.resolveDeletedElsewhere !== "function") return "storageAdapter.resolveDeletedElsewhere is missing";
  if (storageAdapter.resolveDeletedElsewhere(A, true) !== true) return "the keep answer was not taken";
  storageAdapter.syncNow(false);
  return settle().then(function () {
    return posts().length === 1 ? true : "Keep must upload the campaign again (POSTs: " + posts().length + ")";
  });
});
tAsync("Remove clears it from this device: its live keys, its row, the active id", function () {
  seedLocal(A, 35, true); resetAll(); responder = deletedServer();
  store.del("tnd_deleted_elsewhere_v1");
  storageAdapter.load(function () {});
  return settle().then(function () {
    if (asked.length !== 1) return "fixture: the question was not asked";
    if (typeof removeActiveCampaignLocally !== "function") return "removeActiveCampaignLocally is missing (state.js)";
    storageAdapter.resolveDeletedElsewhere(A, false);
    if (removeActiveCampaignLocally(A) !== true) return "the removal refused";
    if (store.get(WSK)) return "the live world key survived";
    if (getCampMeta().some(function (c) { return c.id === A; })) return "the picker row survived";
    if (getActiveCampId()) return "the removed campaign is still active: " + getActiveCampId();
    calls.length = 0; storageAdapter.syncNow(false); return settle();
  }).then(function (r) { if (typeof r === "string") return r; return posts().length ? "something was pushed after the removal" : true; });
});
tAsync("the list road: the picker's list sync runs FIRST and no longer names the campaign on screen — the same question, the same pause", function () {
  store.del("tnd_deleted_elsewhere_v1");
  seedLocal(A, 35, true); resetAll(); responder = deletedServer();
  var done = false; storageAdapter.syncCampaignList(function () { done = true; });
  return settle().then(function () {
    if (!done) return "fixture: the list sync never finished";
    if (asked.length !== 1 || asked[0].indexOf(A) !== 0) return "the list sync pruned the campaign on screen without asking: " + JSON.stringify(asked);
    calls.length = 0; storageAdapter.syncNow(false); return settle();
  }).then(function (r) { if (typeof r === "string") return r; return posts().length ? "the push was not paused after the list road" : true; });
});
tAsync("a never-uploaded campaign (no onServer flag) keeps #449's behaviour: 404 = first push pending, no question", function () {
  store.del("tnd_deleted_elsewhere_v1");
  seedLocal(A, 35, false); resetAll(); responder = deletedServer();
  storageAdapter.load(function () {});
  return settle().then(function () {
    if (asked.length) return "a local-only campaign was asked about: " + JSON.stringify(asked);
    calls.length = 0; storageAdapter.syncNow(false); return settle();
  }).then(function (r) { if (typeof r === "string") return r; return posts().length === 1 ? true : "its first push must go out (POSTs: " + posts().length + ")"; });
});
tAsync("an answer that lands after the device switched campaigns is ignored as stale — never blamed on the server", function () {
  store.del("tnd_deleted_elsewhere_v1");
  seedLocal(A, 35, true); resetAll();
  responder = function (url, opts) {
    if ((opts.method || "GET") === "POST") return ok({});
    if (url === BASE + "/api/campaigns/" + A + "/turn") return ok({ campaignId: A, turn: 35 });
    if (url === BASE + "/api/campaigns/" + A) return new Promise(function (res) { setTimeout(function () { res({ ok: true, status: 200, json: function () { return Promise.resolve(blob(A, 51)); } }); }, 30); });
    if (url === BASE + "/api/campaigns") return ok([{ id: A, name: "The Gate road" }]);
    return null;
  };
  storageAdapter.load(function () {});
  return settle(10).then(function () {
    var wsB = blob(B, 7).worldState; setActiveCampId(B); worldState = wsB;   /* the player switched while the GET was in flight */
    return settle(80);
  }).then(function () {
    if (worldState.campId !== B || worldState.turn !== 7) return "the stale answer was adopted over the campaign on screen";
    if (errors.some(function (e) { return /server-side id mismatch/.test(e); })) return "a local switch was blamed on the server: " + JSON.stringify(errors);
    return infos.some(function (m) { return /after this device switched/.test(m); }) ? true : "the stale answer must be said on the console: " + JSON.stringify(infos);
  });
});
tAsync("the question itself (ui-campaigns.js): a forced choice, Keep first; Keep resolves and uploads, Remove clears the campaign on screen and opens the picker", function () {
  var els = {}, shells = [], shown = [];
  function el(id) { return els[id] || (els[id] = { id: id, innerHTML: "", style: {}, onclick: null, remove: function () { shown.push("removed " + id); } }); }
  global.document = { getElementById: function (id) { return el(id); }, createElement: function () { return el("_" + Math.random()); }, body: el("body") };
  var hook = global.onCampaignDeletedElsewhere;
  geval(fs.readFileSync(path.join(root, "ui-campaigns.js"), "utf8"));
  var ui = onCampaignDeletedElsewhere; global.onCampaignDeletedElsewhere = hook;
  global.modalShell = function (id, html, opts) { shells.push({ id: id, html: html, opts: opts }); return el(id); };
  global.showChar = function () { shown.push("wizard"); }; global.showCampaignPicker = function () { shown.push("picker"); };
  store.del("tnd_deleted_elsewhere_v1"); seedLocal(A, 35, true); resetAll(); responder = deletedServer();
  storageAdapter.load(function () {});
  return settle().then(function () {
    ui(A, "The Gate road");
    var s = shells[shells.length - 1];
    if (!s || s.opts.wireClose !== false) return "the question must be a forced choice (wireClose:false)";
    if (s.html.indexOf("de-keep") < 0 || s.html.indexOf("de-keep") > s.html.indexOf("de-remove")) return "Keep must come first — the default focus is the safe answer";
    el("de-keep").onclick(); calls.length = 0; storageAdapter.syncNow(false); return settle();
  }).then(function (r) {
    if (typeof r === "string") return r;
    if (posts().length !== 1) return "Keep did not upload the campaign again";
    store.del("tnd_deleted_elsewhere_v1"); seedLocal(A, 35, true); resetAll(); responder = deletedServer();
    storageAdapter.load(function () {}); return settle();
  }).then(function (r) {
    if (typeof r === "string") return r;
    ui(A, "The Gate road"); shown.length = 0; el("de-remove").onclick();
    if (getActiveCampId() || store.get(WSK)) return "Remove left the campaign on this device";
    if (shown.indexOf("picker") < 0 || shown.indexOf("wizard") < 0) return "after Remove the wizard and the picker must open: " + JSON.stringify(shown);
    return store.get("tnd_deleted_elsewhere_v1") ? "the question was left pending after Remove" : true;
  });
});
chain.then(function () {
  store.del("tnd_deleted_elsewhere_v1");
  console.log("#481 F9 deleted elsewhere: " + pass + " passed, " + fails.length + " failed");
  process.exit(fails.length ? 1 : 0);
});
