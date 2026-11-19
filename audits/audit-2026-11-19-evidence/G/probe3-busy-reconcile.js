// Probe: the boot reconcile finds the cloud AHEAD while a turn is in flight (busy). It seeds the CAS base with the
// server's turn, skips the adopt, and the next ordinary save then POSTs the older local state with baseTurn = serverTurn.
var L = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();
var logs = [];
showToast = function (m) { logs.push("TOAST " + m); };
var ow = console.warn, oi = console.info, oe = console.error;
console.warn = function () { logs.push("WARN " + [].join.call(arguments, " ")); };
console.info = function () { logs.push("INFO " + [].join.call(arguments, " ")); };
console.error = function () { logs.push("ERR " + [].join.call(arguments, " ")); };
syncUI = function () {}; addMsg = function () { return {}; };
var posts = [];
var local = L.makeTestWorld({ campId: "campA", turn: 10 });
var server = JSON.parse(JSON.stringify(local)); server.turn = 50; server.character.name = "Tess";
setActiveCampId("campA");
store.set(WSK, serializeWorldState(local)); store.set(SLK, "[]"); store.set(MEM_KEY, JSON.stringify(blankMemory()));
global.fetch = function (url, opts) {
  var m = (opts && opts.method) || "GET";
  if (m === "POST") { posts.push(JSON.parse(opts.body)); return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } }); }
  if (/\/api\/campaigns\/campA$/.test(url)) return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ campaignId: "campA", worldState: server, sessionLog: [], memory: blankMemory() }); } });
  return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve([]); } });
};
storageAdapter.setServer("https://unit.test", "tok");
busy = true;                                   // the player sent a turn while the reconcile GET was in flight
storageAdapter.load(function () {});
setTimeout(function () {
  oe.call(console, "after reconcile: local turn", worldState.turn, "| lastAckTurn", storageAdapter.syncStatus().lastAckTurn, "| unsynced", storageAdapter.syncStatus().unsynced);
  busy = false; worldState.turn = 11;          // the turn commits
  storageAdapter.syncNow();                    // the turn's save
  setTimeout(function () {
    var p = posts[posts.length - 1];
    oe.call(console, "POST after the turn: turn", p && p.worldState.turn, "baseTurn", p && p.baseTurn, "(server held 50)");
    oe.call(console, "messages:", JSON.stringify(logs.filter(function (l) { return /reconcile|adopt|busy|ahead|TOAST/.test(l); })));
    process.exit(0);
  }, 30);
}, 50);
