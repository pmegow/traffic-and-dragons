// h.js — the #717 reviewer's harness over a checkout of the repo (ROOT; default: this worktree). Loads the real engine,
// stubs the DOM-side globals a turn's commit calls, and drives REAL turns (commitGmTurn). Not a probe by itself.
// usage: var H = require("./h.js")(process.argv[2]); var S = H.start(); H.turn("[SUBLOCATION:…]");
var path = require("path");
module.exports = function (ROOT) {
  ROOT = ROOT || path.join(__dirname, "..", "..");
  var engine = require(path.join(ROOT, "dev", "load-engine.js"));
  engine.loadEngine();
  var toasts = [], warns = [], infos = [], reports = [], logs = [];
  var realLog = console.log;
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
  function point(world, sub) { worldState.world.location = world; worldState.world.sublocation = sub || null; }
  function plain(o) { return JSON.parse(JSON.stringify(o)); }
  function cast(A) { var reg = atlasDoc(A.seed), p0 = reg.places[0]; return { reg: reg, p0: p0, p1: reg.places[1], townId: A.seed + "/" + p0.id }; }
  function townCast(A, c) {
    var town = atlasDoc(c.townId);
    c.town = town;
    c.inns = town.establishments.filter(function (e) { return e.kind === "inn"; }); c.inn = c.inns[0];
    c.grates = town.portals.filter(function (p) { return p.kind === "grate"; });
    c.market = town.landmarks.filter(function (l) { return l.kind === "market"; })[0];
    c.road = town.portals.filter(function (p) { return p.kind === "road"; })[0];
    c.temple = town.landmarks.filter(function (l) { return l.kind === "temple"; })[0];
    return c;
  }
  function fresh(seed, adopt) { engine.makeTestWorld(); atlasForget(); quiet(); var A = atlasCreate(seed || "campaign-1"); if (adopt === false) A.adopt = false; return A; }
  function start(adopt, seed) { stubs(); var A = fresh(seed || "campaign-1", adopt), c = cast(A); turn("At the gate. [LOCATION:" + c.p0.name + "]"); townCast(A, c); return { A: A, c: c, T: c.p0.name }; }
  function sub() { return worldState.world.sublocation; }
  function say() { realLog.apply(console, arguments); }
  function hr(t) { say("\n== " + t); }
  function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
  function seen(A, z) { return A.seen && A.seen[z] ? plain(A.seen[z]) : null; }
  /* the rooms of a sheet whose name exactly one room bears and no portal shares */
  function onceRooms(doc) { return (doc.rooms || []).filter(function (r) { return doc.rooms.filter(function (q) { return atlasNameKey(q.name) === atlasNameKey(r.name); }).length === 1 && !(doc.portals || []).some(function (p) { return p.id === r.id || atlasNameKey(p.name) === atlasNameKey(r.name); }); }); }
  return { ROOT: ROOT, engine: engine, toasts: toasts, warns: warns, infos: infos, reports: reports, logs: logs, quiet: quiet, stubs: stubs, turn: turn, point: point, plain: plain, cast: cast, townCast: townCast, fresh: fresh, start: start, sub: sub, say: say, hr: hr, out: out, seen: seen, onceRooms: onceRooms, SEP: " — " };
};
