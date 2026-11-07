// p2-misc.js — the third reviewer: a GM 'at' tie through the load door; two trades invented near one spot; the index that
// outlives its thing; a room named inside an invented trade whose house is small.
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }

hr("P2a a GM 'at' tie survives the save round trip and the load heal; the where-line still says the GM placed it");
(function () {
  var S = H.start(), A = S.A, c = S.c, blob, back;
  H.turn("[LOCATION:The Old Crossing][MAP_PLACE:The Old Crossing|at " + c.p1.name + "]"); out("names", A.names); out("where", atlasWhere().text);
  blob = serializeWorldState(worldState); back = parseWorldState(blob); worldState = back; H.quiet(); migrateWorldState(); atlasForget(); A = worldState.atlas;
  out("junk?", worldState.atlasJunk || null); out("names after load", A.names); out("toasts", H.toasts); atlasFollow(); out("where after load", atlasWhere().text); out("ties", atlasWhere().ties);
})();

hr("P2b three trades invented from one spot take three different houses?");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T, town, es;
  H.turn("[SUBLOCATION:" + c.market.name + "] In the square."); H.quiet();
  H.turn("[SUBLOCATION:Harl's Forge] A smithy."); H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:" + c.market.name + "]");
  H.turn("[SUBLOCATION:The Pot and Kettle] A tavern."); H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:" + c.market.name + "]");
  H.turn("[SUBLOCATION:The Golden Loaf] A bakery."); H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:" + c.market.name + "]");
  H.turn("[SUBLOCATION:The Quiet Inn] An inn.");
  town = atlasDoc(c.townId); es = town.establishments.filter(function (e) { return e.authored; });
  out("authored", es.map(function (e) { return e.name + ":" + e.kind + " b=" + e.building + " @" + Math.round(e.x) + "," + Math.round(e.y); }));
  out("edits", (A.zones[c.townId].params.edits || []).map(function (e) { return e.name + " b=" + e.building; }));
  out("distinct buildings", es.map(function (e) { return e.building; }).filter(function (b, i, a) { return a.indexOf(b) === i; }).length + " of " + es.length);
  out("off", A.off); out("refusal toasts", H.toasts.filter(function (t) { return /could not/.test(t); }));
  out("rooms of each", es.map(function (e) { var z = c.townId + "/" + e.id; return e.name + ": " + (A.zones[z] ? atlasDoc(z).rooms.length + " rooms" : "not entered"); }));
})();

hr("P2c 'added once already': the index outlives the thing — what the player and the GM see");
(function () {
  var S = H.start(), A = S.A, c = S.c, rec;
  H.turn("[SUBLOCATION:Harl's Forge] A smithy."); out("adds", Object.keys(A.adds));
  H.turn("[SUBLOCATION_LEAVE]"); rec = A.zones[c.townId]; rec.params.edits = rec.params.edits.filter(function (e) { return e.name !== "Harl's Forge"; }); if (!rec.params.edits.length) delete rec.params.edits; rec.fp = null; atlasForget();
  H.quiet(); H.turn("[SUBLOCATION:Harl's Forge] Back to the smithy."); out("sub", H.sub()); out("off", A.off); out("toasts", H.toasts); out("told", H.told(A)); out("where", atlasWhere().text); out("map block line", atlasMapBlock().split("\n")[1].slice(0, 300));
  out("heal", atlasHeal() + " adds=" + JSON.stringify(A.adds));
})();

hr("P2d an invented room inside an invented TAVERN (a trade with a house): does the roomiest house hold it?");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T, tz;
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.quiet(); H.turn("[SUBLOCATION:The Pot and Kettle] A tavern."); tz = A.at; out("tavern", A.zones[tz] && A.zones[tz].kind + " rooms=" + JSON.stringify(atlasDoc(tz).rooms.map(function (r) { return r.name + "@" + r.floor; })) + " warnings=" + JSON.stringify(atlasDoc(tz).warnings));
  H.quiet(); H.turn("[SUBLOCATION:The Snug] A snug."); out("sub", H.sub()); out("off", A.off); out("toasts", H.toasts); out("adds", Object.keys(A.adds));
  H.quiet(); H.turn("[SUBLOCATION:Cold Store] A cold store."); out("sub", H.sub()); out("off", A.off); out("toasts", H.toasts);
})();

hr("P2e a GM 'at' tie onto a thing, then the GM declares the same place 'near' something: the first stands");
(function () {
  var S = H.start(), A = S.A, c = S.c;
  H.turn("[LOCATION:The Old Crossing][MAP_PLACE:The Old Crossing|at " + c.p1.name + "]"); H.turn("[LOCATION:" + c.p0.name + "]"); H.quiet();
  H.turn("[LOCATION:The Old Crossing][MAP_PLACE:The Old Crossing|near " + c.p0.name + "]"); out("A.at", A.at); out("told", H.told(A)); out("names", A.names);
})();

hr("P2f told lines: a refusal is toasted — is the GM told anything on the MAP block?");
(function () {
  var S = H.start(), A = S.A, c = S.c;
  H.quiet(); H.turn("[SUBLOCATION:The Monastery of Saint Oswin upon the Grey Water] A long name.");
  out("told", H.told(A)); out("map block where-line", atlasMapBlock().split("\n")[1].slice(0, 400));
})();
