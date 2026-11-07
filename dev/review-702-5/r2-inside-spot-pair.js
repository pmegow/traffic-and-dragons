// r2-inside-spot-pair.js — the fifth reviewer: the strip of a leading home-sheet SPOT (review 4, finding 3) when the party
// is INSIDE a building. "[SUBLOCATION:<market> — Fishmonger's Stall]" written from inside the inn: the GM has gone out to
// the square and names a new stall there. After the strip the remainder is a bare name; line 597 returns it as a
// home-sheet name only when the home sheet bears it or the chain is EMPTY — inside the inn the chain is not, so the
// stall falls to atlasLeafAt and files under the inn. Also an invented BUILDING off the square from inside another one,
// and the known-thing controls. Run at HEAD and at the parent (6671e60a) to see what the strip changed.
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
function authored(c) { return atlasDoc(c.townId).establishments.filter(function (e) { return e.authored; }).map(function (e) { return e.name + ":" + e.kind; }); }
function innRooms(A, c) { var z = c.townId + "/" + c.inn.id; return A.zones[z] ? (atlasDoc(z).rooms || []).filter(function (r) { return r.authored || /stall|spur|gilded/i.test(r.name); }).map(function (r) { return r.name; }) : null; }

hr("R2a inside the inn, then [SUBLOCATION:<market> — Fishmonger's Stall] (out to the square, a new stall) in the next reply");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c;
  H.turn("[SUBLOCATION:" + c.inn.name + "] In."); H.quiet();
  out("resolve", resolvePlaceName(c.market.name + SEP + "Fishmonger's Stall", T, { sub: c.inn.name, fresh: false }));
  H.turn("Out to the square. [SUBLOCATION:" + c.market.name + SEP + "Fishmonger's Stall][LOCATION_DESC:STALL ONE.]");
  out("sub", H.sub()); out("nodes", H.nodesWith("Stall")); out("adds", Object.keys(A.adds)); out("off", A.off); out("A.at kind", A.zones[A.at] && A.zones[A.at].kind); out("A.at/spot", A.at + "/" + A.spot);
  out("town sheet gained", authored(c)); out("inn rooms authored", innRooms(A, c)); out("toasts", H.toasts); out("where", atlasWhere().text);
})();

hr("R2b inside the inn, then [SUBLOCATION:<market> — The Gilded Spur] (out to the square, into an invented building)");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c;
  H.turn("[SUBLOCATION:" + c.inn.name + "] In."); H.quiet();
  H.turn("[SUBLOCATION:" + c.market.name + SEP + "The Gilded Spur][LOCATION_DESC:SPUR ONE.]");
  out("sub", H.sub()); out("nodes", H.nodesWith("Spur")); out("adds", Object.keys(A.adds)); out("off", A.off); out("A.at kind", A.zones[A.at] && A.zones[A.at].kind);
  out("town sheet gained", authored(c)); out("inn rooms authored", innRooms(A, c)); out("toasts", H.toasts); out("where", atlasWhere().text);
  H.quiet(); H.turn("[SUBLOCATION:Kitchen][LOCATION_DESC:SPUR KITCHEN.]"); out("next: sub", H.sub()); out("adds", Object.keys(A.adds)); out("where", atlasWhere().text);
})();

hr("R2c control: inside the inn, then [SUBLOCATION:<market> — <other inn>] (a KNOWN building off the square)");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, other = c.inns[1] || c.temple;
  H.turn("[SUBLOCATION:" + c.inn.name + "] In."); H.quiet();
  H.turn("[SUBLOCATION:" + c.market.name + SEP + other.name + "][LOCATION_DESC:OTHER.]");
  out("sub", H.sub()); out("A.at via", A.zones[A.at] && A.zones[A.at].via); out("expected via", other.id); out("off", A.off);
})();

hr("R2d control: inside the inn, then [SUBLOCATION:<market>] alone, then [SUBLOCATION:Fishmonger's Stall] — two tags");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c;
  H.turn("[SUBLOCATION:" + c.inn.name + "] In."); H.quiet();
  H.turn("[SUBLOCATION:" + c.market.name + "][SUBLOCATION:Fishmonger's Stall][LOCATION_DESC:STALL TWO.]");
  out("sub", H.sub()); out("adds", Object.keys(A.adds)); out("off", A.off); out("town sheet gained", authored(c));
})();

hr("R2e from the street at the market: [SUBLOCATION:<market>] then [SUBLOCATION:<market> — Fishmonger's Stall] — WHERE is the stall drawn?");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, st;
  H.turn("[SUBLOCATION:" + c.market.name + "] On the square."); H.quiet(); out("A.spot before", A.spot);
  H.turn("[SUBLOCATION:" + c.market.name + SEP + "Fishmonger's Stall][LOCATION_DESC:STALL.]");
  st = atlasDoc(c.townId).establishments.filter(function (e) { return e.name === "Fishmonger's Stall"; })[0];
  out("sub", H.sub()); out("stall drawn", !!st); if (st) out("stall dist to the market / to the town centre", H.dist(st, c.market).toFixed(1) + " / " + H.dist(st, { x: atlasCentre(c.town)[0], y: atlasCentre(c.town)[1] }).toFixed(1));
  out("told", H.told(A)); out("A.at/spot after", A.at + "/" + A.spot);
})();
