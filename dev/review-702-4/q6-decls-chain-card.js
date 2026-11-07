// q6-decls-chain-card.js — the fourth reviewer: (6) atlasDeclsOfTurn on the pre-send follow path (a sheet-sync parse,
// a Sync edit of the pointer, then atlasFollow() in the SAME turn); (7) atlasChainBetween when the tie's zone is a wild
// zone, a far town's inn, or the home sheet itself; (8) the card of an added building's DOOR while the pointer is a room
// inside it.
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }

hr("Q6 a [MAP_PLACE:] parsed outside a commit at turn N, then the pointer moved by a Sync edit, then the pre-send atlasFollow() at turn N");
(function () {
  var S = H.start(), A = S.A, c = S.c, t;
  out("turn", worldState.turn); H.mutsOf("[MAP_PLACE:Thornwick|near " + c.p1.name + "] a sheet-sync reply"); out("decls", worldState.placeDecls);
  H.point("Thornwick"); H.quiet(); atlasFollow();/* the sendAction follow */
  t = atlasDoc(A.seed).places.filter(function (p) { return p.name === "Thornwick"; })[0]; out("Thornwick added?", !!t); if (t) out("dist to p1 / p0", H.dist(t, c.p1) + " / " + H.dist(t, c.p0)); out("told", H.told(A)); out("infos", H.infos.filter(function (i) { return /set aside/.test(i); }));
})();

hr("Q7a the pointer's building tied to OPEN COUNTRY (a region tap) — where do its rooms file afterwards?");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, r, pt;
  H.turn("[SUBLOCATION:Harl's Forge] A smithy."); H.quiet();
  pt = (function () { var reg = atlasDoc(A.seed), x, y; for (y = 100; y < reg.frame.height - 100; y += 40) for (x = 100; x < reg.frame.width - 100; x += 40) { try { TnDMaps.wild.fromRegion(reg, [x, y]); if (H.dist({ x: x, y: y }, c.p0) > 200) return [x, y]; } catch (e) { } } return null; })();
  r = atlasPlace(A.seed, { x: pt[0], y: pt[1] }); out("tap on open country", { ok: r.ok, reason: r.reason, at: A.at, kind: A.zones[A.at] && A.zones[A.at].kind }); out("names", A.names); out("adds", Object.keys(A.adds));
  H.quiet(); H.turn("[SUBLOCATION:Anvil Room][LOCATION_DESC:ANVILS.]"); out("sub", H.sub()); out("adds", Object.keys(A.adds)); out("off", A.off); out("A.at kind", A.zones[A.at] && A.zones[A.at].kind); out("toasts", H.toasts);
  out("town sheet gained", atlasDoc(c.townId).establishments.filter(function (e) { return e.authored; }).map(function (e) { return e.name; }));
})();

hr("Q7b the pointer's building tied to a room of ANOTHER town's inn (a far sheet)");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, r, t1, inn1, iz1, back;
  H.turn("[LOCATION:" + c.p1.name + "] On."); t1 = A.at; inn1 = atlasDoc(t1).establishments.filter(function (e) { return e.kind === "inn"; })[0]; H.turn("[SUBLOCATION:" + inn1.name + "] In."); iz1 = A.at; back = H.deepRoom(atlasDoc(iz1));
  H.turn("[SUBLOCATION_LEAVE]"); H.turn("[LOCATION:" + T + "] Back."); H.turn("[SUBLOCATION:Harl's Forge] A smithy."); H.quiet();
  r = atlasPlace(iz1, { id: back.id }); out("tap", { ok: r.ok, reason: r.reason, at: A.at }); out("names", A.names);
  H.quiet(); H.turn("[SUBLOCATION:Anvil Room][LOCATION_DESC:ANVILS.]"); out("sub", H.sub()); out("adds", Object.keys(A.adds)); out("off", A.off); out("A.at", A.at); out("toasts", H.toasts);
  var pos = atlasPosition(A, T, "Harl's Forge"); out("position chain/zone/spot", [pos.chain.map(function (x) { return x.name + "@" + x.parentZone; }), pos.zone, pos.spot && pos.spot.name]);
})();

hr("Q7c a tie for '<inn> — Kitchen' pointing at the MARKET (the home sheet): rooms after it");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, r, pos;
  H.turn("[SUBLOCATION:" + c.inn.name + SEP + "Kitchen] In."); H.quiet(); r = atlasPlace(c.townId, { id: c.market.id }); out("tap", { ok: r.ok, reason: r.reason, at: A.at, spot: A.spot }); out("names", A.names);
  pos = atlasPosition(A, T, H.sub()); out("position chain/zone/spot", [pos.chain.map(function (x) { return x.name; }), pos.zone, pos.spot && pos.spot.name]);
  H.quiet(); H.turn("[SUBLOCATION:Pantry][LOCATION_DESC:P.]"); out("sub", H.sub()); out("adds", Object.keys(A.adds)); out("off", A.off);
})();

hr("Q8 the DOOR's card on the town sheet while the pointer is a ROOM inside the added tavern");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, tz, door, card, r;
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:The Pot and Kettle] A tavern."); tz = A.at; door = A.zones[tz].via; H.turn("[SUBLOCATION:The Snug][LOCATION_DESC:A SNUG.]");
  out("pointer", H.sub()); out("preview", atlasPlacePreview()); card = atlasCard(c.townId, { id: door }); out("door card", { title: card.title, added: card.added, place: card.place, partyHere: card.partyHere });
  H.quiet(); r = atlasPlace(c.townId, { id: door }); out("tap on the door", { ok: r.ok, reason: r.reason, bound: r.bound }); out("names", A.names); out("adds", Object.keys(A.adds)); out("snug still drawn?", !!(atlasFind(atlasDoc(tz), "The Snug") && atlasFind(atlasDoc(tz), "The Snug").thing)); out("A.at/spot", A.at + "/" + A.spot); out("where", atlasWhere().text); out("infos", H.infos);
})();
