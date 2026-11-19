// Probe: the REAL switchToCampaign path. snapshotActiveCamp flushes A's POST; the switch's loadState resets the sync
// bookkeeping; A's 200 lands afterwards and seeds B's CAS base.
var L = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();
showToast = function () {}; console.info = function () {};
var pending = [], bodies = [];
global.fetch = function (url, opts) {
  bodies.push({ url: url, method: (opts && opts.method) || "GET", body: opts && opts.body ? JSON.parse(opts.body) : null });
  return new Promise(function (res) { pending.push(res); });
};
var B = L.makeTestWorld({ campId: "campB", campName: "B", turn: 10 });
store.set(campSlotKey("campB", "ws"), serializeWorldState(B)); store.set(campSlotKey("campB", "sl"), "[]"); store.set(campSlotKey("campB", "mem"), JSON.stringify(blankMemory()));
var A = L.makeTestWorld({ campId: "campA", campName: "A", turn: 2000 });
setActiveCampId("campA"); store.set(WSK, serializeWorldState(A)); store.set(SLK, "[]"); store.set(MEM_KEY, JSON.stringify(memory));
setCampMeta([{ id: "campA", campName: "A" }, { id: "campB", campName: "B" }]);
storageAdapter.setServer("https://unit.test", "tok");
var ok = switchToCampaign("campB");
console.log("switch ok:", ok, "| active:", getActiveCampId(), "| live turn:", worldState.turn, "| A POST fired:", bodies.length, bodies[0] && bodies[0].body.campaignId, "| ack now:", storageAdapter.syncStatus().lastAckTurn);
pending[0]({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } });
setTimeout(function () {
  console.log("after A's 200: B ack base =", storageAdapter.syncStatus().lastAckTurn, "| unsynced badge =", storageAdapter.syncStatus().unsynced);
  storageAdapter.syncNow();
  var p = bodies[bodies.length - 1];
  console.log("B's next POST: campaignId", p.body.campaignId, "turn", p.body.worldState.turn, "baseTurn", p.body.baseTurn);
  process.exit(0);
}, 20);
