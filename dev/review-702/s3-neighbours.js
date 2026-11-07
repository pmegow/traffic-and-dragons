// s3-neighbours.js — part D: adoption ON with the neighbours; one-reply flows through an INVENTED building.
var ROOT = process.argv[2];
var H = require("./h.js")(ROOT), say = H.say, SEP = H.SEP;
function hr(t) { say("\n== " + t); }
function out(label, v) { say("  " + label + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }

hr("D1 an invented building and its room in ONE reply: [SUBLOCATION:The Gilded Spur][SUBLOCATION:Kitchen]");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T, town;
  H.quiet(); H.turn("You push into a tavern the map does not know and through to its kitchen. [SUBLOCATION:The Gilded Spur][SUBLOCATION:Kitchen][LOCATION_DESC:THE SPUR'S KITCHEN.]");
  out("sub", H.sub()); out("nodes", H.nodesWith("Kitchen").concat(H.nodesWith("Gilded"))); out("A.at", A.at + " kind=" + (A.zones[A.at] && A.zones[A.at].kind) + " spot=" + A.spot); out("off", A.off);
  town = atlasDoc(c.townId); out("town sheet gained", town.establishments.filter(function (e) { return e.authored; }).map(function (e) { return e.name + ":" + e.kind + "/" + (e.word || ""); }));
  out("adds", Object.keys(A.adds)); out("told", H.told(A)); out("toasts", H.toasts);
  out("where", atlasWhere().text);
  /* the next reply names another room of the same tavern */
  H.quiet(); H.turn("[SUBLOCATION:Taproom] Back out front."); out("sub", H.sub()); out("A.at", A.at + " kind=" + (A.zones[A.at] && A.zones[A.at].kind)); out("town gained", atlasDoc(c.townId).establishments.filter(function (e) { return e.authored; }).map(function (e) { return e.name; })); out("adds", Object.keys(A.adds));
  /* and a mapped inn's kitchen after that: does it fuse with the town-wide Kitchen? */
  H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:" + c.inn.name + "] In the real inn."); H.quiet(); H.turn("[SUBLOCATION:Kitchen] Its kitchen."); out("sub", H.sub()); out("kitchen nodes", H.nodesWith("Kitchen")); out("geo mentions THE SPUR'S KITCHEN", buildGeoBlock().indexOf("THE SPUR'S KITCHEN") >= 0);
})();

hr("D2 the pair form with a NEW first segment: [SUBLOCATION:The Gilded Spur — Kitchen]");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T, iz;
  H.quiet(); H.turn("Into the tavern's kitchen. [SUBLOCATION:The Gilded Spur" + SEP + "Kitchen][LOCATION_DESC:THE SPUR'S KITCHEN.]");
  out("sub", H.sub()); out("A.at", A.at + " kind=" + (A.zones[A.at] && A.zones[A.at].kind) + " spot=" + A.spot); out("off", A.off);
  iz = A.at; out("adds", JSON.stringify(A.adds)); out("told", H.told(A));
  if (A.zones[iz] && A.zones[iz].kind === "interior") out("tavern rooms", atlasDoc(iz).rooms.map(function (r) { return r.name; }));
  /* the next reply names a room the tavern's sheet lacks */
  H.quiet(); H.turn("[SUBLOCATION:Cold Store] A cold store."); out("sub", H.sub()); out("off", A.off); out("adds", Object.keys(A.adds)); out("told", H.told(A));
  /* a second pair whose first segment is new again, with a room */
  H.turn("[SUBLOCATION_LEAVE]"); H.quiet(); H.turn("[SUBLOCATION:The Copper Cup" + SEP + "Snug] Across the way."); out("sub", H.sub()); out("off", A.off); out("adds", Object.keys(A.adds));
})();

hr("D3 the neighbours over an added place: W5, EXIT, PARTY_SPLIT, soundscape, pass-through");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T, R, x, n, sheet;
  H.turn("[SUBLOCATION:Harl's Forge] A smithy."); H.turn("[SUBLOCATION:Workshop] Within."); out("sub", H.sub());
  /* W5: a [LOCATION:] naming the added building from inside it, and from the street */
  H.turn("[LOCATION:Harl's Forge] (as a world)"); out("W5 inside: world", worldState.world.location + " sub=" + H.sub() + " twins=" + JSON.stringify((worldState.locationTwinConflicts || []).map(function (t) { return t.child; })));
  H.turn("[SUBLOCATION_LEAVE]"); worldState.locationTwinConflicts = []; H.turn("[LOCATION:Harl's Forge] From the street."); out("W5 street: world", worldState.world.location + " nodes=" + JSON.stringify(Object.keys(memory.map.nodes).filter(function (k) { return /Harl/.test(k); })));
  /* EXIT from the street naming the added forge; from inside naming a room of it */
  R = H.mutsOf("A door. [EXIT:Harl's Forge|the forge door]"); out("EXIT street", R.muts.filter(function (m) { return /EXIT/.test(m) || /Way/.test(m); }));
  H.turn("[SUBLOCATION:Harl's Forge] In."); R = H.mutsOf("[EXIT:Workshop|a low arch]"); atlasFollow(); out("EXIT inside to a room on record", R.muts.filter(function (m) { return /EXIT|Way|way/.test(m); }));
  /* PARTY_SPLIT into the added forge's room, then fold */
  sheet = JSON.parse(JSON.stringify(worldState.character)); sheet.name = "Bren"; delete sheet.splitLoc;
  worldState.npcs.push({ name: "Bren", status: "travelling with the party", attitude: "friendly", partyMember: true, charSheet: sheet }); if (!memory.npcs.Bren) memory.npcs.Bren = { events: [], firstSeen: 1 };
  H.turn("Bren stays. [PARTY_SPLIT:Bren|" + T + "|Workshop][SUBLOCATION:Hall] You step to the hall."); n = worldState.npcs.filter(function (p) { return p.name === "Bren"; })[0];
  out("split stored", n.charSheet.splitLoc); H.turn("[SUBLOCATION:Workshop] Back to Bren."); out("folded", n.charSheet.splitLoc === undefined);
  /* soundscape */
  var res = audioFileCandidates(["Workshop|enclosure=sealed;setting=interior;biome=temperate;quiet=normal;allows=fire;forbid=none"]); out("soundscape ok", res.ok + " " + (res.why || ""));
  /* pass-through: an invented room walked through */
  H.quiet(); H.turn("[SUBLOCATION:Anteroom][LOCATION_ITEM:Hammer|placed] Through the anteroom. [SUBLOCATION:Hall] To the hall."); out("sub", H.sub()); out("anteroom nodes", H.nodesWith("Anteroom")); out("adds", Object.keys(A.adds)); out("forge rooms", atlasDoc(A.at).rooms.map(function (r) { return r.name; }));
})();

hr("D4 the GM declares a place that is passed through, and a declaration carried over to a later turn");
(function () {
  var S = H.start(), A = S.A, c = S.c, T = S.T;
  H.quiet(); H.turn("[LOCATION:Bleakford][MAP_PLACE:Bleakford|near " + c.p1.name + "] On, past the hamlet. [LOCATION:" + c.p1.name + "]");
  out("world", worldState.world.location); out("Bleakford on region", atlasDoc(A.seed).places.some(function (p) { return p.name === "Bleakford"; })); out("told", H.told(A)); out("placeDecls", worldState.placeDecls);
  /* a stale declaration left by a parse outside a commit */
  H.mutsOf("[MAP_PLACE:Thornwick|near " + c.p1.name + "]"); out("decls after a bare applyMuts", worldState.placeDecls);
  H.quiet(); H.turn("[LOCATION:Thornwick] A hamlet."); var tw = atlasDoc(A.seed).places.filter(function (p) { return p.name === "Thornwick"; })[0]; out("Thornwick dist to p1", tw ? Math.round(H.dist(tw, c.p1)) : null); out("told", H.told(A));
})();
