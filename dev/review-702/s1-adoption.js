// s1-adoption.js — part A: where additions land, twice-borne, double adds, re-stamp, declarations, told, tap removal.
var ROOT = process.argv[2];
var H = require("./h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(label, v) { say("  " + label + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
function placeNamed(doc, n) { return (doc.places || []).filter(function (p) { return p.name === n; })[0] || null; }

/* A1 — a WORLD addition while the party stands in a town that is NOT the capital: where does it land? */
hr("A1 world addition from a non-capital town (p1): lands beside the party or beside the capital?");
(function () {
  var S = H.start(), A = S.A, c = S.c, reg = c.reg, far = null, i, d, added;
  /* the settlement farthest from the capital */
  for (i = 1; i < reg.places.length; i++) { d = H.dist(reg.places[i], c.p0); if (!far || d > far.d) far = { p: reg.places[i], d: d }; }
  H.turn("[LOCATION:" + far.p.name + "] A long ride."); out("party in", A.zones[A.at].name + " (" + A.at + ")"); out("dist cap->far", Math.round(far.d));
  H.quiet(); H.turn("[LOCATION:Bleakford] A hamlet a mile on.");
  reg = atlasDoc(A.seed); added = placeNamed(reg, "Bleakford");
  out("added", added ? { x: added.x, y: added.y, kind: added.kind } : null);
  out("dist Bleakford->far town", added ? Math.round(H.dist(added, far.p)) : null);
  out("dist Bleakford->capital", added ? Math.round(H.dist(added, c.p0)) : null);
  out("told", H.told(A)); out("toasts", H.toasts);
})();

/* A2 — a world name that is a road / a shipwreck / a wild place */
hr("A2 world names that are no settlement: a road, a shipwreck, a wild feature");
(function () {
  var S = H.start(), A = S.A, c = S.c, reg, n0;
  n0 = atlasDoc(A.seed).places.length;
  H.quiet(); H.turn("[LOCATION:The King's Road] You walk the road east.");
  reg = atlasDoc(A.seed); out("King's Road on region as", placeNamed(reg, "The King's Road") ? placeNamed(reg, "The King's Road").kind : null); out("A.at kind", A.zones[A.at] && A.zones[A.at].kind); out("told", H.told(A));
  H.quiet(); H.turn("[LOCATION:A shipwreck on the Blighted Coast] Timbers in the surf.");
  reg = atlasDoc(A.seed); out("shipwreck on region as", placeNamed(reg, "A shipwreck on the Blighted Coast") ? placeNamed(reg, "A shipwreck on the Blighted Coast").kind : null); out("told", H.told(A)); out("where", atlasWhere().text);
  out("region places now", reg.places.length + " (was " + n0 + ")");
  /* the town's own road portal as a world name, from inside the town */
  H.quiet(); H.turn("[LOCATION:" + c.p0.name + "]"); H.quiet(); H.turn("[LOCATION:" + c.road.name + "] Out by the gate.");
  out("road as world: A.at", A.at + " spot=" + A.spot + " off=" + JSON.stringify(A.off)); out("added?", !!placeNamed(atlasDoc(A.seed), c.road.name)); out("where", atlasWhere().text);
  /* a long name (> 40 chars): the library's MAX_NAME */
  H.quiet(); H.turn("[LOCATION:" + c.p0.name + "]"); H.quiet(); H.turn("[LOCATION:The Monastery of Saint Oswin upon the Grey Water] A long name.");
  out("long name added?", !!placeNamed(atlasDoc(A.seed), "The Monastery of Saint Oswin upon the Grey Water")); out("off", A.off); out("told", H.told(A)); out("reports", H.reports); out("toasts", H.toasts);
})();

/* A3 — the same name at two scales; the same sub name in two towns */
hr("A3 the same story name added at two scales (world village, then as a [SUBLOCATION:] in a town)");
(function () {
  var S = H.start(), A = S.A, c = S.c, town;
  H.quiet(); H.turn("[LOCATION:Bleakford] A hamlet."); out("adds after world add", Object.keys(A.adds));
  H.turn("[LOCATION:" + c.p0.name + "]"); H.quiet(); H.turn("[SUBLOCATION:Bleakford] The Bleakford house, in town.");
  town = atlasDoc(c.townId); out("Bleakford on the town sheet too?", town.establishments.filter(function (e) { return e.name === "Bleakford"; }).map(function (e) { return e.kind + "/" + e.word; }));
  out("adds", Object.keys(A.adds)); out("told", H.told(A));
})();

/* A4 — re-stamp: is a ZONE already entered said 'redrawn' after its PARENT gains an edit? (town after a village is added; inn after a town-level addition) */
hr("A4 redrawn notices after a parent's edit: the capital after a village is added; an inn after a town-level addition");
(function () {
  var S = H.start(), A = S.A, c = S.c;
  H.turn("[SUBLOCATION:" + c.inn.name + "] In."); var innZ = A.at; H.turn("[SUBLOCATION_LEAVE]");
  H.quiet(); H.turn("[SUBLOCATION:Harl's Forge] A smithy."); out("forge added", Object.keys(A.adds)); out("toasts", H.toasts);
  H.quiet(); H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:" + c.inn.name + "] Back to the inn.");
  out("inn redrawn?", A.zones[innZ].redrawn || null); out("toasts", H.toasts.filter(function (t) { return /redrawn/.test(t); }));
  H.quiet(); H.turn("[LOCATION:Bleakford] Out to a hamlet."); out("village added", !!placeNamed(atlasDoc(A.seed), "Bleakford")); out("toasts", H.toasts.filter(function (t) { return /redrawn/.test(t); }));
  H.quiet(); H.turn("[LOCATION:" + c.p0.name + "] Back to the capital.");
  out("capital redrawn?", A.zones[c.townId].redrawn || null); out("toasts", H.toasts.filter(function (t) { return /redrawn/.test(t); }));
  H.turn("[SUBLOCATION:" + c.inn.name + "] In again."); out("inn redrawn after village?", A.zones[innZ].redrawn || null);
  out("all redrawn", Object.keys(A.zones).filter(function (z) { return A.zones[z].redrawn; }));
})();

/* A5 — declarations misread */
hr("A5 declarations: near a twice-borne name; between with one unknown; a declaration for a place the reply found by name inside a building (path pointer); told wording at the opening");
(function () {
  var S = H.start(), A = S.A, c = S.c, r = S.r, innDoc, twiceName, rooms, seen = {}, i;
  H.turn("[SUBLOCATION:" + r.twice.in + "] In."); innDoc = atlasDoc(A.at); rooms = innDoc.rooms;
  for (i = 0; i < rooms.length; i++) seen[rooms[i].name] = (seen[rooms[i].name] || 0) + 1; twiceName = Object.keys(seen).filter(function (n) { return seen[n] > 1; })[0];
  H.quiet(); H.turn("[SUBLOCATION:The Snug][MAP_PLACE:The Snug|near " + twiceName + "] A snug off the hall.");
  out("sub", H.sub()); out("told", H.told(A)); out("adds", Object.keys(A.adds));
  /* a declaration for a room the sheet HAS (found by name) — is it 'no place the party went to'? */
  var one = rooms.filter(function (rm) { return seen[rm.name] === 1; })[0];
  H.quiet(); H.turn("[SUBLOCATION:" + one.name + "][MAP_PLACE:" + one.name + "|near " + twiceName + "] Through.");
  out("sub", H.sub()); out("told", H.told(A));
  /* between with one unknown */
  H.turn("[SUBLOCATION_LEAVE]"); H.turn("[LOCATION:" + c.p0.name + "]"); H.quiet();
  H.turn("[LOCATION:Ashford][MAP_PLACE:Ashford|between " + c.p1.name + " and Nowhere]"); out("Ashford added", !!placeNamed(atlasDoc(A.seed), "Ashford")); out("told", H.told(A));
  /* the opening: no party on the map; a declaration naming nothing */
  var A2 = H.fresh("campaign-1"); H.point("The Crossroads"); worldState.placeDecls = [{ name: "The Crossroads", where: "near Nowhere", turn: 0 }]; atlasFollow();
  out("opening told", H.told(A2)); out("opening where", atlasWhere().text);
})();

/* A6 — A.told: how many prompts carry one told line? */
hr("A6 told lines: on how many successive turns does one addition's line ride the MAP block?");
(function () {
  var S = H.start(), A = S.A, c = S.c, i, lines = [];
  H.quiet(); H.turn("[LOCATION:Bleakford] A hamlet."); out("turn after the add", worldState.turn); out("told turns", (A.told || []).map(function (t) { return t.turn; }));
  for (i = 0; i < 3; i++) { atlasFollow(); lines.push("turn " + worldState.turn + ": " + atlasToldLines(A).length + " line(s)"); H.turn("You rest. [NO_CHANGE]"); }
  out("MAP block told lines per turn", lines);
})();

/* A7 — the tap removal of a village the party added things inside; the dangling adds */
hr("A7 tap removal: a village with an added forge inside, then the player ties the village elsewhere; then the forge is named again");
(function () {
  var S = H.start(), A = S.A, c = S.c, res, zonesBefore;
  H.quiet(); H.turn("[LOCATION:Bleakford] A hamlet."); out("in Bleakford", A.zones[A.at].kind + " " + A.at);
  H.turn("[SUBLOCATION:Harl's Forge] A smithy."); out("adds", Object.keys(A.adds)); out("zones", Object.keys(A.zones));
  H.turn("[SUBLOCATION_LEAVE]"); zonesBefore = Object.keys(A.zones).length;
  res = atlasPlace(A.seed, { id: c.p1.id }); out("tap result", { ok: res.ok, at: res.at, bound: res.bound, level: res.level, reason: res.reason });
  out("zones after tap", Object.keys(A.zones)); out("adds after tap", JSON.stringify(A.adds)); out("names", A.names); out("A.at/spot", A.at + " / " + A.spot);
  out("Bleakford on region?", !!placeNamed(atlasDoc(A.seed), "Bleakford"));
  H.quiet(); H.turn("[SUBLOCATION:Harl's Forge] The smithy, here in Bleakford."); out("sub", H.sub()); out("A.at", A.at); out("off", A.off); out("told", H.told(A));
  out("heal changed?", atlasHeal()); out("adds after heal", JSON.stringify(A.adds));
})();

/* A8 — save/load of a campaign with additions at every scale and a tie */
hr("A8 save/load round trip with a village, a forge, a room, a chamber and a tie; redraw and settle every zone");
(function () {
  var S = H.start(), A = S.A, c = S.c, before, blob, back, zs, said = [], names = [];
  H.turn("[LOCATION:Bleakford] A hamlet."); H.turn("[SUBLOCATION:Harl's Forge] A smithy."); H.turn("[SUBLOCATION:Back Room] A store."); H.turn("[SUBLOCATION_LEAVE]");
  H.turn("[LOCATION:" + c.p0.name + "]"); H.turn("[SUBLOCATION:" + c.grates[0].name + "] Down."); var sewer = A.at; H.turn("[SUBLOCATION:The Bone Niche] A side cut.");
  H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:The Gilded Spur] A tavern."); atlasPlace(c.townId, { id: c.inn.id });
  out("adds", Object.keys(A.adds)); out("edits per zone", Object.keys(A.zones).map(function (z) { return z + ":" + ((A.zones[z].params && A.zones[z].params.edits) || []).length; }));
  before = JSON.stringify(worldState.atlas); blob = serializeWorldState(worldState); back = parseWorldState(blob); worldState = back; migrateWorldState(); atlasForget(); H.quiet(); A = worldState.atlas;
  out("store identical after round trip", JSON.stringify(worldState.atlas) === before);
  out("adds proto null after load?", Object.getPrototypeOf(A.adds) === null); out("zones proto null?", Object.getPrototypeOf(A.zones) === null);
  zs = Object.keys(A.zones); zs.forEach(function (z) { try { atlasDoc(z); } catch (e) { said.push(z + ": " + e.message); } });
  zs.forEach(function (z) { atlasSettleChain(A, z); });
  out("draw errors", said); out("redrawn", zs.filter(function (z) { return A.zones[z].redrawn; })); out("toasts", H.toasts);
  names.push(["Bleakford", !!placeNamed(atlasDoc(A.seed), "Bleakford")]);
  var bz = zs.filter(function (z) { return A.zones[z].via === "a1"; })[0]; names.push(["Harl's Forge in Bleakford", !!(bz && atlasFind(atlasDoc(bz), "Harl's Forge"))]);
  var fz = zs.filter(function (z) { return A.zones[z].via === "s1" && A.zones[z].parent === bz; })[0]; names.push(["Back Room in the forge", !!(fz && atlasFind(atlasDoc(fz), "Back Room"))]);
  names.push(["Bone Niche in the sewer", !!atlasFind(atlasDoc(sewer), "The Bone Niche")]);
  out("names back", names); out("fp match", zs.map(function (z) { return z + ":" + (atlasFingerprint(atlasDoc(z)) === A.zones[z].fp); }));
  atlasFollow(); out("where", atlasWhere().text);
})();

/* A9 — the pane reads on added things */
hr("A9 pane reads on added things: card, markers, reveal, preview, where, map block");
(function () {
  var S = H.start(), A = S.A, c = S.c, town, e, card, sewer, chamber;
  H.turn("[SUBLOCATION:Harl's Forge] A smithy."); town = atlasDoc(c.townId); e = town.establishments.filter(function (x) { return x.name === "Harl's Forge"; })[0];
  card = atlasCard(c.townId, { id: e.id }); out("card", card); out("markers town", atlasMarkers(c.townId)); out("markers forge", atlasMarkers(A.at)); out("preview", atlasPlacePreview()); out("where", atlasWhere().text);
  out("thingAt", atlasThingAt(c.townId, e.x, e.y) && atlasThingAt(c.townId, e.x, e.y).name);
  H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:" + c.grates[0].name + "] Down."); sewer = A.at; H.turn("[SUBLOCATION:The Bone Niche] A side cut.");
  chamber = atlasFind(atlasDoc(sewer), "The Bone Niche").thing; out("reveal has the chamber", (atlasReveal(sewer) || []).indexOf(chamber.id) >= 0); out("markers sewer", atlasMarkers(sewer));
  out("map block head", atlasMapBlock().split("\n").slice(0, 2).join(" | ").slice(0, 400));
})();

/* A10 — the opening when no land is around the capital (every wild point refused) */
hr("A10 the opening with no land around the capital (TnDMaps.wild.fromRegion refuses every point)");
(function () {
  var real = TnDMaps.wild.fromRegion, A; TnDMaps.wild.fromRegion = function () { throw new Error("TnDMaps: that point lies in the sea — {}"); };
  try { A = H.fresh("campaign-1"); H.point("The Crossroads"); atlasFollow(); out("off", A.off); out("told", H.told(A)); out("toasts", H.toasts); out("reports", H.reports); out("where", atlasWhere().text); } finally { TnDMaps.wild.fromRegion = real; }
  /* the opening when the start place IS a settlement's name */
  A = H.fresh("campaign-1"); H.point(atlasDoc(A.seed).places[3].name); atlasFollow(); out("start = settlement: A.at", A.at + " adds=" + Object.keys(A.adds).length);
})();

/* A11 — the kind table's false friends */
hr("A11 atlasAddKind on some names");
["The River Bank", "The Fish Gate", "The Watch House", "Counting House", "The Monks' Cells", "Fort Grey", "The Hunting Lodge", "The Pot and Kettle", "The Old Mill", "Market Square", "The Hall of Mirrors"].forEach(function (n) { out(n, atlasAddKind(n)); });
