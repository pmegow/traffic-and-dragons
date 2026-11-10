// p2-prompt-identity.js — the GM is never fogged: drives one scripted mapped campaign (flows the author's nine-step
// capture did not name: adoption, [MAP_PLACE:], the pair form, LEAVE, off the map, the sewer, a hand tie, a save round
// trip mid-way) and prints, per step, sha256(stable), sha256(volatile) and sha256(MAP block). Run it on two checkouts
// and diff the output: any differing line is a prompt change between the two engines.
// node dev/review-717/p2-prompt-identity.js [ROOT] > out.txt
var crypto = require("crypto");
var H = require("./h.js")(process.argv[2]), say = H.say, SEP = H.SEP;
function sha(s) { return crypto.createHash("sha256").update(String(s), "utf8").digest("hex").slice(0, 16); }
var step = 0, MODE = process.argv[3] || "";
function cap(label) {
  var sys, mb = atlasMapBlock();
  if (MODE === "fogoff" && worldState.atlas) worldState.atlas.fog = false;
  if (MODE === "norecord" && worldState.atlas && worldState.atlas.seen) worldState.atlas.seen = keyedDict();
  sys = buildSysPrompt();
  say((++step) + "\t" + label + "\tstable=" + sha(sys.stable) + " (" + sys.stable.length + ")\tvolatile=" + sha(sys.volatile.replace(/APP_VERSION[^\n]*/g, "")) + " (" + sys.volatile.length + ")\tmap=" + sha(mb) + " (" + mb.length + ")\tmapInVolatile=" + (sys.volatile.indexOf(mb) >= 0));
}
var S = H.start(true), A = S.A, c = S.c, T = S.T, idoc, rooms, sdoc, ups, deep, t1doc, i1, r1, r;
cap("start in " + T);
H.turn("[SUBLOCATION:" + c.inn.name + "] In."); cap("inn by name");
idoc = atlasDoc(A.at); rooms = H.onceRooms(idoc);
H.turn("[SUBLOCATION:" + rooms[0].name + "] A room."); cap("bare room");
H.turn("[SUBLOCATION:" + c.inn.name + SEP + rooms[1].name + "] Another."); cap("pair form");
H.turn("[SUBLOCATION_LEAVE] Out."); cap("leave");
H.turn("[SUBLOCATION:" + c.market.name + "] Square."); cap("market");
H.turn("[SUBLOCATION:The Gilded Spur] A tavern the map lacks."); cap("adopted tavern");
H.turn("[SUBLOCATION:Back Room] Invented room."); cap("adopted room (growth)");
H.turn("[SUBLOCATION:Wine Cellar] Invented."); cap("adopted room 2");
H.turn("[SUBLOCATION:Harl's Forge][MAP_PLACE:Harl's Forge|near " + c.inn.name + "] A smithy."); cap("MAP_PLACE near");
H.turn("[SUBLOCATION:" + c.grates[0].name + "] Down."); cap("down the grate");
sdoc = atlasDoc(A.at); ups = sdoc.portals.filter(function (p) { return p.way === "up"; });
deep = sdoc.rooms.filter(function (rm) { return !ups.some(function (u) { return u.id === rm.id; }) && sdoc.rooms.filter(function (q) { return atlasNameKey(q.name) === atlasNameKey(rm.name); }).length === 1 && !atlasFind(c.town, rm.name); })[0];
H.turn("[SUBLOCATION:" + deep.name + "] Deep."); cap("deep chamber");
H.turn("[SUBLOCATION:Rat King's Den] A chamber the map lacks."); cap("adopted chamber");
/* a save round trip mid-campaign */
worldState = parseWorldState(serializeWorldState(worldState)); migrateWorldState(); atlasForget(); A = worldState.atlas; cap("after a save round trip");
H.turn("[SUBLOCATION_LEAVE] Up and out."); cap("leave the sewer");
H.turn("[LOCATION:Thistlewick Hollow] A village the map lacks."); cap("adopted village");
H.turn("[LOCATION:Saltmere][MAP_PLACE:Saltmere|between " + c.p0.name + " and " + c.p1.name + "] Another."); cap("MAP_PLACE between");
t1doc = TnDMaps.generate("town", TnDMaps.town.fromRegion(c.reg, c.p1.id)); i1 = t1doc.establishments.filter(function (e) { return e.kind === "inn"; })[0];
r1 = H.onceRooms(TnDMaps.generate("interior", TnDMaps.interior.fromTown(t1doc, i1.id)))[0];
H.turn("On. [LOCATION:" + c.p1.name + "][SUBLOCATION:" + i1.name + SEP + r1.name + "]"); cap("world+building+room in one reply");
A.adopt = false;
H.turn("[LOCATION:Nowhere The Map Knows] Lost."); cap("off the map");
r = atlasPlace(A.seed, { id: c.reg.places[2].id }); cap("hand tie onto a third town: " + JSON.stringify({ ok: r.ok, reason: r.reason }));
H.turn("[LOCATION:" + c.p0.name + "] Home."); cap("back to p0");
if (c.reg.caves && c.reg.caves[0]) { H.turn("[LOCATION:" + c.reg.caves[0].name + "] A cave."); cap("a cave from the region"); }
H.point(c.p1.name, null); atlasFollow(); cap("a Sync edit of the pointer (no turn)");
say("toasts=" + H.toasts.length + " reports=" + JSON.stringify(H.reports));
