// h.js — the reviewer's harness over a tree copy of the repo (ROOT = scratch head/ or base/).
// usage: var H = require("./h.js")(ROOT); H.start(); H.turn("...");
var path = require("path");
module.exports = function (ROOT) {
  var engine = require(path.join(ROOT, "dev", "load-engine.js"));
  engine.loadEngine();
  var toasts = [], warns = [], infos = [], reports = [], logs = [];
  var realWarn = console.warn, realInfo = console.info, realLog = console.log;
  global.showToast = function (m) { toasts.push(String(m)); };
  global.reportError = function (ctx, msg) { reports.push(ctx + ": " + msg); };
  console.warn = function () { warns.push([].slice.call(arguments).join(" ")); };
  console.info = function () { infos.push([].slice.call(arguments).join(" ")); };
  function quiet() { toasts.length = 0; warns.length = 0; infos.length = 0; reports.length = 0; logs.length = 0; }
  function stubs() {
    var values = Object.create(null);
    global.store = { get: function (k) { return Object.prototype.hasOwnProperty.call(values, k) ? values[k] : null; }, set: function (k, v) { values[k] = String(v); }, del: function (k) { delete values[k]; } };
    global.syncUI = function () { }; global.addMsg = function () { }; global.generateActions = function () { }; global.storageAdapter = { syncToServer: function () { }, resetSyncState: function () { } };
  }
  function turn(t, action) { console.log = function () { logs.push([].slice.call(arguments).join(" ")); }; try { if (action != null) lastAction = action; commitGmTurn(t, { userMsg: action || "x", playerTxt: action || "x" }); } finally { console.log = realLog; } }
  function mutsOf(t) { var R; console.log = function () { }; try { R = applyMuts(t); } finally { console.log = realLog; } return R; }
  function point(world, sub) { worldState.world.location = world; worldState.world.sublocation = sub || null; }
  function plain(o) { return JSON.parse(JSON.stringify(o)); }
  function cast(A) {
    var reg = atlasDoc(A.seed), p0 = reg.places[0], townId = A.seed + "/" + p0.id;
    return { reg: reg, p0: p0, p1: reg.places[1], townId: townId };
  }
  function townCast(A, c) {
    var town = atlasDoc(c.townId);
    c.town = town;
    c.inn = town.establishments.filter(function (e) { return e.kind === "inn"; })[0];
    c.inns = town.establishments.filter(function (e) { return e.kind === "inn"; });
    c.grates = town.portals.filter(function (p) { return p.kind === "grate"; });
    c.market = town.landmarks.filter(function (l) { return l.kind === "market"; })[0];
    c.road = town.portals.filter(function (p) { return p.kind === "road"; })[0];
    c.temple = town.landmarks.filter(function (l) { return l.kind === "temple"; })[0];
    return c;
  }
  function roomCast(c) {
    var shared = {}, twice = null;
    c.town.portals.filter(function (p) { return p.to && p.to.generator === "interior"; }).forEach(function (p) {
      var d = TnDMaps.generate("interior", TnDMaps.interior.fromTown(c.town, p.id)), seen = {};
      d.rooms.forEach(function (rm) { seen[rm.name] = (seen[rm.name] || 0) + 1; });
      Object.keys(seen).forEach(function (n) { if (seen[n] === 1) (shared[n] = shared[n] || []).push(p.name); else if (!twice) twice = { in: p.name, room: n, n: seen[n] }; });
    });
    var room = Object.keys(shared).filter(function (n) { return shared[n].length >= 3; })[0], r = { room: room, a: shared[room][0], b: shared[room][1], third: shared[room][2], twice: twice };
    r.other = Object.keys(shared).filter(function (n) { return n !== room && shared[n].indexOf(r.a) >= 0 && shared[n].indexOf(r.b) >= 0; })[0];
    return r;
  }
  /* a fresh mapped campaign: adoption as the campaign default (true) unless told */
  function fresh(seed, adopt) { engine.makeTestWorld(); atlasForget(); quiet(); var A = atlasCreate(seed || "campaign-1"); if (adopt === false) A.adopt = false; return A; }
  function start(adopt) { stubs(); var A = fresh("campaign-1", adopt), c = cast(A); turn("At the gate. [LOCATION:" + c.p0.name + "]"); townCast(A, c); return { A: A, c: c, T: c.p0.name, r: roomCast(c) }; }
  function startBare() { stubs(); engine.makeTestWorld(); atlasForget(); quiet(); }
  function node(k) { return memory.map.nodes[locResolve(k)]; }
  function sub() { return worldState.world.sublocation; }
  function nodesWith(s) { return Object.keys(memory.map.nodes).filter(function (k) { return k.indexOf(s) >= 0; }).sort(); }
  function deepRoom(doc) { return doc.rooms.filter(function (rm) { return !doc.portals.some(function (p) { return p.id === rm.id; }); })[0]; }
  function bz(S, name) { var p = S.c.town.portals.filter(function (q) { return q.name === name; })[0]; return p ? S.c.townId + "/" + p.id : null; }
  function dist(a, b) { return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)); }
  function told(A) { return (A.told || []).map(function (t) { return t.turn + ": " + t.text; }); }
  function say() { realLog.apply(console, arguments); }
  return { engine: engine, toasts: toasts, warns: warns, infos: infos, reports: reports, logs: logs, quiet: quiet, stubs: stubs, turn: turn, mutsOf: mutsOf, point: point, plain: plain, cast: cast, townCast: townCast, roomCast: roomCast, fresh: fresh, start: start, startBare: startBare, node: node, sub: sub, nodesWith: nodesWith, deepRoom: deepRoom, bz: bz, dist: dist, told: told, say: say, SEP: " — " };
};
