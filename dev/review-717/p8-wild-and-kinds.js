// p8-wild-and-kinds.js — the fog on the sheet kinds the #717 groups never BUILD: a wild zone (the start of every
// "open country" campaign, #708/#710), a cave hung from the realm, a crypt under a temple (interior > dungeon). For
// each: the party's marker, the record, atlasReveal, the library's own validator and a real scene.build — and how much
// of the sheet 100 m is. Also the realm before the party is placed.
// node dev/review-717/p8-wild-and-kinds.js [ROOT]
var H = require("./h.js")(process.argv[2]), say = H.say, hr = H.hr, out = H.out;
function build(z) { var spec, step = "atlasReveal"; try { spec = atlasReveal(z); step = "fog.spec"; TnDMaps.scene.fog.spec(spec); step = "scene.build"; var sc = TnDMaps.scene.build(atlasDoc(z), "ink", { reveal: spec }); return { ok: true, spec: spec, layers: sc.layers.map(function (L) { return L.name + ":" + L.items.length; }).join(" ") }; } catch (e) { return { ok: false, step: step, msg: String(e.message).slice(0, 300), spec: spec }; } }
function brief(spec) { return spec instanceof Array ? spec : spec ? { points: spec.points, paths: spec.paths.length, radiusM: spec.radiusM } : spec; }

hr("K0 the realm before the party is placed (a start the map refused, #708)");
(function () { H.stubs(); var A = H.fresh("campaign-1", false), r; H.point("Nowhere The Map Knows"); atlasFollow(); r = build(A.seed); out("where", atlasWhere().text); out("reveal", brief(r.spec)); out("built", r.ok ? r.layers : r); out("markers", atlasMarkers(A.seed)); })();

hr("K1 a wild zone: open country by the tap on the realm, then its features and an edge");
(function () {
  H.stubs(); var A = H.fresh("campaign-1", false), c = H.cast(A), pt, r, wz, w, m, feats, edges, i;
  H.point("The Lonely Heath"); atlasFollow();
  for (i = 0; i < 400 && !wz; i++) { pt = [c.p0.x + 8 + i * 0.37, c.p0.y + 6 + (i % 7)]; r = atlasPlace(A.seed, { x: pt[0], y: pt[1] }); if (r.ok) wz = A.at; }
  out("placed", { ok: r.ok, at: A.at, kind: A.zones[A.at].kind, spot: A.spot }); w = atlasDoc(wz);
  out("the wild sheet", { frame: [w.frame.width, w.frame.height], kmPerUnit: w.frame.kmPerUnit, widthM: Math.round(w.frame.width * w.frame.kmPerUnit * 1000), radiusUnits: 100 / (w.frame.kmPerUnit * 1000), shareOfWidth: (200 / (w.frame.width * w.frame.kmPerUnit * 1000)).toFixed(3) });
  m = atlasPartyIn(wz); out("marker on the wild sheet", { exact: m.exact, key: m.key, xy: [m.x, m.y] }); out("marker on the realm", (function (q) { return { exact: q.exact, key: q.key, xy: [q.x, q.y] }; })(atlasPartyIn(A.seed)));
  out("record", H.plain(A.seen)); r = build(wz); out("reveal (wild)", brief(r.spec)); out("built (wild)", r.ok ? r.layers : r);
  r = build(A.seed); out("reveal (realm)", brief(r.spec)); out("built (realm)", r.ok ? "ok" : r);
  feats = atlasThings(w).filter(function (t) { return !t.portal; }); edges = atlasThings(w).filter(function (t) { return t.portal; });
  out("named things on the wild sheet", atlasThings(w).map(function (t) { return t.name + "#" + t.id + (t.portal ? "(portal " + t.portal.way + ")" : ""); }));
  if (feats[0]) { H.turn("[SUBLOCATION:" + feats[0].name + "] To a feature."); out("after naming a feature: at/spot/off", [A.zones[A.at].kind, A.spot, A.off && A.off.why]); out("record (wild)", H.seen(A, wz)); r = build(wz); out("reveal", brief(r.spec)); out("built", r.ok ? "ok" : r); }
  if (feats[1]) { H.turn("[SUBLOCATION:" + feats[1].name + "] To another."); out("record (wild)", H.seen(A, wz)); r = build(wz); out("reveal", brief(r.spec)); out("built", r.ok ? "ok" : r); if (r.ok && r.spec.paths.length) out("the way", TnDMaps.route(w, r.spec.points[0], r.spec.points[1]).via); }
  out("toasts", H.toasts.slice(-4)); out("reports", H.reports);
})();

hr("K2 a cave hung from the realm");
(function () {
  var S = H.start(false), A = S.A, c = S.c, cave = (c.reg.caves || [])[0], r, d;
  if (!cave) { out("skipped", "the fixture realm has no cave"); return; }
  H.turn("[LOCATION:" + cave.name + "] To the cave."); out("at/spot/off", [A.at && A.zones[A.at].kind, A.spot, A.off && A.off.why]);
  if (A.zones[A.at].kind !== "dungeon") return; d = atlasDoc(A.at);
  out("record", H.plain(A.seen)); r = build(A.at); out("reveal (cave)", brief(r.spec)); out("built", r.ok ? "ok" : r); out("portals", d.portals.map(function (p) { return p.id + ":" + p.way; }));
  r = build(A.seed); out("reveal (realm)", brief(r.spec)); out("built", r.ok ? "ok" : r);
})();

hr("K3 a crypt under the temple (town > interior > dungeon), then a level below if there is one");
(function () {
  var S = H.start(false), A = S.A, c = S.c, t = c.temple, idoc, stair, r, cz, cd, down;
  if (!t) { out("skipped", "no temple"); return; }
  H.turn("[SUBLOCATION:" + t.name + "] Into the temple."); out("at", [A.zones[A.at].kind, A.zones[A.at].name, A.spot]); idoc = atlasDoc(A.at);
  stair = (idoc.portals || []).filter(function (p) { return p.way === "down"; })[0];
  if (!stair) { out("skipped", "this temple has no way down: " + JSON.stringify(idoc.portals.map(function (p) { return p.name + ":" + p.way; }))); return; }
  H.turn("[SUBLOCATION:" + stair.name + "] Down the stair."); cz = A.at; cd = atlasDoc(cz); out("at", [A.zones[cz].kind, A.zones[cz].name, A.spot]);
  out("record", H.plain(A.seen)); r = build(cz); out("reveal (crypt)", brief(r.spec)); out("built", r.ok ? "ok" : r);
  r = build(A.zones[cz].parent); out("reveal (the temple above, party below)", brief(r.spec)); out("built", r.ok ? "ok" : r);
  down = (cd.portals || []).filter(function (p) { return p.way === "down"; })[0];
  if (down) { H.turn("[SUBLOCATION:" + down.name + "] Deeper."); out("deeper at", [A.zones[A.at].kind, A.zones[A.at].name, A.spot, A.off && A.off.why]); r = build(A.at); out("reveal", brief(r.spec)); out("built", r.ok ? "ok" : r); r = build(cz); out("reveal (level above)", brief(r.spec)); }
  out("toasts", H.toasts.slice(-3)); out("reports", H.reports);
})();
