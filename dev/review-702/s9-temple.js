// s9-temple.js — an invented room in the temple displaces the Crypt Stair (the way down): what becomes of an ENTERED crypt?
var ROOT = process.argv[2];
var H = require("./h.js")(ROOT), say = H.say, SEP = H.SEP;
function out(label, v) { say("  " + label + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
var S = H.start(), A = S.A, c = S.c, T = S.T, tz, td, stair, cz, cd, ch, crTitle;
H.turn("[SUBLOCATION:" + c.temple.name + "] Into the temple."); tz = A.at; td = atlasDoc(tz); stair = td.portals.filter(function (p) { return p.way === "down"; })[0];
out("temple rooms", td.rooms.map(function (r) { return r.name; })); out("stair", stair.name + " id=" + stair.id);
H.turn("[SUBLOCATION:" + stair.name + "][LOCATION_DESC:A worn stair.] Down."); cz = A.at; cd = atlasDoc(cz); ch = H.deepRoom(cd); crTitle = cd.title.name;
H.turn("[SUBLOCATION:" + ch.name + "][LOCATION_DESC:HALL OF BONES.] In."); out("in the crypt", H.sub() + " at " + A.at + "/" + A.spot);
H.turn("[SUBLOCATION:" + stair.name + "] Back up the stair."); H.turn("[SUBLOCATION:" + c.temple.name + "] Up into the nave."); out("back in the temple", H.sub() + " at " + A.at);
/* the GM invents a room of the temple */
H.quiet(); H.turn("[SUBLOCATION:The Reliquary][LOCATION_DESC:Robes on pegs.] A side room."); out("sub", H.sub()); out("A.at/spot", A.at + "/" + A.spot); out("off", A.off);
td = atlasDoc(tz); out("temple rooms now", td.rooms.map(function (r) { return r.name; })); out("stair still a portal?", td.portals.some(function (p) { return p.id === stair.id; })); out("warnings", td.warnings);
out("told", H.told(A)); out("toasts", H.toasts); out("reports", H.reports);
/* the entered crypt: can it still be drawn? settled? */
try { atlasDoc(cz); out("crypt redraw", "ok"); } catch (e) { out("crypt redraw", "THREW: " + e.message); }
H.quiet(); try { atlasSettleChain(A, cz); out("settle crypt", "ok redrawn=" + JSON.stringify(A.zones[cz].redrawn || null)); } catch (e) { out("settle crypt", "THREW: " + e.message); }
/* the party goes down again by the stair's name, then names a chamber */
H.quiet(); H.turn("[SUBLOCATION:" + stair.name + "] Down the stair again."); out("sub", H.sub()); out("A.at/spot", A.at + "/" + A.spot); out("off", A.off); out("toasts", H.toasts); out("reports", H.reports); out("where", atlasWhere().text);
H.quiet(); H.turn("[SUBLOCATION:" + ch.name + "] Into the hall."); out("sub", H.sub()); out("A.at/spot", A.at + "/" + A.spot); out("off", A.off); out("toasts", H.toasts); out("reports", H.reports);
out("nodes", H.nodesWith(crTitle).concat(H.nodesWith(stair.name)).concat(H.nodesWith("Reliquary")));
out("geo mentions HALL OF BONES", buildGeoBlock().indexOf("HALL OF BONES") >= 0);
out("map block", atlasMapBlock().split("\n")[1].slice(0, 500));
/* the pair form from the nave */
H.turn("[SUBLOCATION_LEAVE]"); H.turn("[SUBLOCATION:" + c.temple.name + "]"); H.quiet(); H.turn("[SUBLOCATION:" + crTitle + SEP + ch.name + "] Straight down."); out("pair sub", H.sub()); out("A.at", A.at + "/" + A.spot); out("off", A.off); out("reports", H.reports);
/* the load door with this store */
var blob = serializeWorldState(worldState), back = parseWorldState(blob); worldState = back; H.quiet(); migrateWorldState(); atlasForget(); out("heal toasts", H.toasts); out("zones after load", Object.keys(worldState.atlas.zones));
