// Probe: does an in-flight POST /api/state for campaign A, answered after a switch to campaign B,
// seed B's CAS base (_lastAckTurn) with A's turn?
var L = require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
global.showToast = function (m) { console.log("TOAST:", m); };
L.loadEngine();
showToast = function (m) { console.log("TOAST:", m); };
var pending = [], bodies = [];
global.fetch = function (url, opts) {
  bodies.push({ url: url, body: opts && opts.body ? JSON.parse(opts.body) : null });
  return new Promise(function (res) { pending.push(res); });
};
function okResp() { return { ok: true, status: 200, json: function () { return Promise.resolve({ ok: true }); } }; }
(async function () {
  L.makeTestWorld({ campId: "campA", turn: 2000 });
  setActiveCampId("campA");
  storageAdapter.setServer("https://unit.test", "tok");
  storageAdapter.resetSyncState();
  storageAdapter.syncNow();            // A's POST in flight
  console.log("A POST baseTurn:", bodies[0].body.baseTurn, "turn:", bodies[0].body.worldState.turn);
  // player switches to B (what loadState does on a switch): new world, resetSyncState
  L.makeTestWorld({ campId: "campB", turn: 10 });
  setActiveCampId("campB");
  storageAdapter.resetSyncState();
  storageAdapter.syncNow();            // the switch's snapshotActiveCamp flush -> _pendingSync=true (A still in flight)
  console.log("after switch, lastAckTurn:", storageAdapter.syncStatus().lastAckTurn, "posts so far:", bodies.length);
  pending[0](okResp());                // A's answer lands now
  await new Promise(function (r) { setTimeout(r, 20); });
  console.log("after A's 200 landed, B's lastAckTurn:", storageAdapter.syncStatus().lastAckTurn, "unsynced:", storageAdapter.syncStatus().unsynced);
  var last = bodies[bodies.length - 1];
  console.log("next POST:", last.url, "campaignId:", last.body && last.body.campaignId, "baseTurn:", last.body && last.body.baseTurn, "turn:", last.body && last.body.worldState.turn);
  process.exit(0);
})();
