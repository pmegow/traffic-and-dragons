// p4-fuzz-walk.js — a seeded random walk of REAL turns over a mapped campaign (known things, rooms, grates, towns,
// caves, LEAVE, invented places with adoption on, an occasional save round trip). After every turn each sheet of the
// party's chain, and every 20 turns EVERY sheet, goes atlasReveal -> fog.spec -> scene.build. Reports: a throw or a
// refused spec (the pane would say "could not be drawn"), a recorded key the sheet no longer has, the record's size
// and the cost of one atlasReveal as the campaign grows.
// node dev/review-717/p4-fuzz-walk.js [ROOT] [turns=300] [rngSeed=1] [adopt=1]
var H = require("./h.js")(process.argv[2]), say = H.say, hr = H.hr, out = H.out;
var TURNS = +(process.argv[3] || 300), RS = +(process.argv[4] || 1), ADOPT = process.argv[5] !== "0";
var s = RS >>> 0; function rnd() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; } function pick(a) { return a[Math.floor(rnd() * a.length)]; }
var S = H.start(ADOPT), A = S.A, c = S.c, fails = [], dangling = {}, inv = 0, t, i;
function once(list) { return list.filter(function (x) { return x && typeof x.name === "string" && list.filter(function (y) { return atlasNameKey(y.name) === atlasNameKey(x.name); }).length === 1; }); }
function check(z, why) {
  var spec, step = "atlasReveal", doc, rec;
  try { spec = atlasReveal(z); step = "fog.spec"; TnDMaps.scene.fog.spec(spec); step = "scene.build"; if (why === "all") TnDMaps.scene.build(atlasDoc(z), "ink", { reveal: spec }); }
  catch (e) { fails.push("turn " + worldState.turn + " " + A.zones[z].kind + " " + (A.zones[z].name || z) + " @" + step + ": " + String(e && e.message).slice(0, 200)); return; }
  rec = A.seen && A.seen[z]; if (!rec) return; doc = atlasDoc(z);
  rec.at.forEach(function (k) { if (!atlasSeenXY(A, z, doc, k)) dangling[z + " " + k] = (dangling[z + " " + k] || worldState.turn); });
}
function move() {
  var rec = A.at ? A.zones[A.at] : null, doc = A.at ? atlasDoc(A.at) : null, r = rnd(), things, places, reg = atlasDoc(A.seed);
  if (!rec || r < 0.10) { places = once([].concat(reg.places, reg.caves || [])); return "[LOCATION:" + pick(places).name + "]"; }
  if (r < 0.16) return "[SUBLOCATION_LEAVE]";
  if (ADOPT && r < 0.22) return "[SUBLOCATION:Invented Place " + (++inv) + "] A place the map lacks.";
  if (ADOPT && r < 0.24) return "[LOCATION:Invented Hamlet " + (++inv) + "] A village the map lacks.";
  things = once(atlasThings(doc));
  if (!things.length) return "[SUBLOCATION_LEAVE]";
  if (rec.kind === "town" || rec.kind === "wild" || rec.kind === "region") return "[SUBLOCATION:" + pick(things).name + "]";
  /* indoors or underground: mostly a room of this sheet, sometimes a thing of the town above */
  if (r > 0.9 && rec.parent && A.zones[rec.parent].kind === "town") return "[SUBLOCATION:" + pick(once(atlasThings(atlasDoc(rec.parent)))).name + "]";
  return "[SUBLOCATION:" + pick(things).name + "]";
}
var t0 = Date.now(), sizes = [], costs = [];
for (t = 1; t <= TURNS; t++) {
  H.turn(move() + " …");
  A = worldState.atlas;
  if (t % 37 === 0) { worldState = parseWorldState(serializeWorldState(worldState)); migrateWorldState(); atlasForget(); A = worldState.atlas; }
  (A.at ? atlasTrail(A.at) : [A.seed]).forEach(function (z) { check(z, "chain"); });
  if (t % 20 === 0) Object.keys(A.zones).forEach(function (z) { check(z, "all"); });
  if (t % 50 === 0) {
    var bytes = JSON.stringify(A.seen).length, legs = 0, stands = 0, worst = 0, wz = null, k0, dt;
    Object.keys(A.seen).forEach(function (z) { legs += A.seen[z].legs.length; stands += A.seen[z].at.length; });
    Object.keys(A.zones).forEach(function (z) { k0 = Date.now(); try { atlasReveal(z); } catch (e) { } dt = Date.now() - k0; if (dt > worst) { worst = dt; wz = z; } });
    say("turn " + t + ": zones=" + Object.keys(A.zones).length + " sheetsOnRecord=" + Object.keys(A.seen).length + " stands=" + stands + " legs=" + legs + " seenBytes=" + bytes + " atlasBytes=" + JSON.stringify(A).length + " slowestReveal=" + worst + "ms (" + (wz && A.zones[wz].kind) + " " + (wz && A.zones[wz].name) + ", legs=" + ((A.seen[wz] || { legs: [] }).legs.length) + ")");
  }
}
hr("result after " + TURNS + " turns (rng " + RS + ", adopt " + ADOPT + ", " + (Date.now() - t0) + " ms)");
out("throws / refused specs", fails.length ? fails.slice(0, 12) : "none"); out("count", fails.length);
out("recorded keys the sheet no longer has (key: first turn seen dangling)", Object.keys(dangling).length ? dangling : "none");
out("reports", H.reports.slice(0, 6)); out("toasts mentioning the record", H.toasts.filter(function (x) { return /where the party|way between/.test(x); }).slice(0, 6));
