// p9-save-crossbuild.js — "an old build reads the new save": a save made by THIS build (with atlas.seen) is loaded by
// the previous build (826a53d5), played for a few moves there (one of them removes nothing, one walks to a new place),
// saved, and loaded back here. Three steps, one process each (two engines cannot share a process):
//   node p9-save-crossbuild.js make  <ROOT new>  <file>     the new build writes the save
//   node p9-save-crossbuild.js play  <ROOT old>  <file>     the old build loads it, plays, writes it back
//   node p9-save-crossbuild.js check <ROOT new>  <file>     the new build loads it and reports
var fs = require("fs"), mode = process.argv[2], file = process.argv[4];
var H = require("./h.js")(process.argv[3]), say = H.say, out = H.out, S, A, c;
function load() { H.stubs(); var raw = JSON.parse(fs.readFileSync(file, "utf8")); H.engine.makeTestWorld(); worldState = parseWorldState(raw.ws); memory = raw.memory; migrateWorldState(); atlasForget(); return worldState.atlas; }
function save() { fs.writeFileSync(file, JSON.stringify({ ws: serializeWorldState(worldState), memory: memory }), "utf8"); }
if (mode === "make") {
  S = H.start(false); A = S.A; c = S.c;
  H.turn("[SUBLOCATION:" + c.inn.name + "]"); H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:" + c.grates[0].name + "]"); H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:" + c.market.name + "]");
  save(); out("made by", APP_VERSION); out("seen", H.plain(A.seen)); out("bytes of the save's world", serializeWorldState(worldState).length);
} else if (mode === "play") {
  H.quiet(); A = load(); c = H.townCast(A, H.cast(A));
  out("loaded by", APP_VERSION); out("toasts on load", H.toasts); out("reports", H.reports); out("seen as the old build holds it", A.seen ? { proto: Object.getPrototypeOf(A.seen) === null ? "null (keyed)" : "Object", keys: Object.keys(A.seen) } : "(dropped)");
  H.turn("[SUBLOCATION:" + c.inns[1].name + "] A walk the old build does not record."); H.turn("[LOCATION:" + c.p1.name + "] And a journey.");
  out("at", [A.zones[A.at].name, A.spot]); out("seen after two moves under the old build", A.seen ? H.plain(A.seen) : "(dropped)"); save();
} else {
  H.quiet(); A = load(); c = H.townCast(A, H.cast(A));
  out("loaded by", APP_VERSION); out("toasts on load", H.toasts); out("reports", H.reports); out("seen is a keyed store", Object.getPrototypeOf(A.seen) === null);
  out("seen", H.plain(A.seen));
  out("the realm shows", atlasReveal(A.seed)); out("the town p0 shows (points)", atlasReveal(c.townId).points.length + " points, " + atlasReveal(c.townId).paths.length + " ways");
  H.turn("[LOCATION:" + c.p0.name + "] Back."); out("after the first move here: realm record", H.seen(A, A.seed)); out("toasts", H.toasts); out("reports", H.reports);
}
