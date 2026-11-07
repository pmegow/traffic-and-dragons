// r4-tied-spot-pair.js — the fifth reviewer: the tie branch of atlasPosition ends the walk at a tied SPOT ("the walk
// ends here") while atlasWalk passes through a tied spot and reads the next segment on the same sheet. With the story's
// building tied to a LANDMARK (the player tapped the market for "Harl's Forge"), what does the taught pair
// "[SUBLOCATION:Harl's Forge — Anvil Room]" do — and the bare room after it?
var ROOT = process.argv[2];
var H = require("../review-702/h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(l, v) { say("  " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
function authored(c) { return atlasDoc(c.townId).establishments.filter(function (e) { return e.authored; }).map(function (e) { return e.name + ":" + e.kind; }); }

hr("R4a 'Harl's Forge' (a sub, added as a smith) tied by the player to the MARKET (a landmark), then [SUBLOCATION:Harl's Forge — Anvil Room]");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, r, pos;
  H.turn("[SUBLOCATION:Harl's Forge] A smithy."); out("adds after the smith", Object.keys(A.adds)); out("town sheet gained", authored(c));
  H.quiet(); r = atlasPlace(c.townId, { id: c.market.id }); out("tap on the market", { ok: r.ok, reason: r.reason, at: A.at, spot: A.spot }); out("names", A.names); out("adds after the tap", Object.keys(A.adds)); out("town sheet after the tap", authored(c));
  pos = atlasPosition(A, T, "Harl's Forge" + SEP + "Anvil Room"); out("position for the pair: chain/zone/spot/used/unknown", [pos.chain.map(function (x) { return x.name; }), pos.zone, pos.spot && pos.spot.name, pos.used, pos.unknown]);
  out("resolve the pair", resolvePlaceName("Harl's Forge" + SEP + "Anvil Room", T, { sub: "Harl's Forge", fresh: false }));
  H.quiet(); H.turn("[SUBLOCATION:Harl's Forge" + SEP + "Anvil Room][LOCATION_DESC:ANVILS.]");
  out("sub", H.sub()); out("adds", Object.keys(A.adds)); out("off", A.off); out("A.at kind", A.zones[A.at] && A.zones[A.at].kind); out("A.at/spot", A.at + "/" + A.spot);
  out("town sheet gained", authored(c)); out("toasts", H.toasts); out("told", H.told(A)); out("where", atlasWhere().text);
  H.quiet(); H.turn("[SUBLOCATION:Quenching Trough][LOCATION_DESC:TROUGH.]");
  out("next bare room: sub", H.sub()); out("adds", Object.keys(A.adds)); out("town sheet gained", authored(c)); out("toasts", H.toasts);
})();

hr("R4b the same tie, the bare room after it: [SUBLOCATION:Anvil Room] with the pointer 'Harl's Forge'");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, r;
  H.turn("[SUBLOCATION:Harl's Forge] A smithy."); r = atlasPlace(c.townId, { id: c.market.id }); out("tap", r.ok);
  H.quiet(); H.turn("[SUBLOCATION:Anvil Room][LOCATION_DESC:ANVILS.]");
  out("sub", H.sub()); out("adds", Object.keys(A.adds)); out("off", A.off); out("town sheet gained", authored(c)); out("toasts", H.toasts);
})();

hr("R4c the walk vs the reader for a tied spot followed by a segment that IS on the home sheet: tie 'The Gate' → market, pointer 'The Gate — <inn>'");
(function () {
  var S = H.start(), A = S.A, T = S.T, c = S.c, r, pos;
  H.turn("[SUBLOCATION:The Gate] A gate."); r = atlasPlace(c.townId, { id: c.market.id }); out("tap", r.ok);
  pos = atlasPosition(A, T, "The Gate" + SEP + c.inn.name); out("reader: chain/zone/spot/used", [pos.chain.map(function (x) { return x.name; }), pos.zone, pos.spot && pos.spot.name, pos.used]);
  out("resolve the pair", resolvePlaceName("The Gate" + SEP + c.inn.name, T, { sub: "The Gate", fresh: false }));
  H.quiet(); H.turn("[SUBLOCATION:The Gate" + SEP + c.inn.name + "][LOCATION_DESC:INN.]"); out("sub", H.sub()); out("A.at kind", A.zones[A.at] && A.zones[A.at].kind); out("off", A.off); out("nodes", H.nodesWith(c.inn.name));
})();
