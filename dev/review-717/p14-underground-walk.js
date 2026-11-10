// p14-underground-walk.js — does a leg bridge ground the party did not walk? The party goes DOWN one grate, walks the
// sewer to the landing under another grate (naming that grate from below — "a way in and the room beneath it are one
// node", #693), and never surfaces. On the sewer's sheet that is a walk along the passages. What does the TOWN's sheet
// record and show? (The sheet above shows the party at the way it is AT, exactly — so the town sees two exact stands.)
// node dev/review-717/p14-underground-walk.js [ROOT] [realm seed=campaign-1] [place index=1]
var H = require("./h.js")(process.argv[2]), say = H.say, hr = H.hr, out = H.out;
(function () {
  H.stubs(); var A = H.fresh(process.argv[3] || "campaign-1", false), reg = atlasDoc(A.seed), place = reg.places[+(process.argv[4] || 1)], tz, town, grates, sz, unit, spec, L = 0, r;
  H.turn("[LOCATION:" + place.name + "] Arrived."); tz = A.at; town = atlasDoc(tz); unit = town.frame.kmPerUnit * 1000;
  grates = town.portals.filter(function (q) { return q.kind === "grate" || q.kind === "outfall"; });
  if (grates.length < 2) { out("skipped", place.name + " has fewer than two ways down"); return; }
  H.turn("[SUBLOCATION:" + grates[0].name + "] Down the first grate."); sz = A.at;
  out("below", { at: A.zones[sz].name, spot: A.spot }); out("town record", H.seen(A, tz));
  H.turn("[SUBLOCATION:" + grates[grates.length - 1].name + "] Along the sewer to the foot of the far ladder — still below.");
  out("still below", { at: A.zones[A.at].name, kind: A.zones[A.at].kind, spot: A.spot, sub: H.sub() });
  out("sewer record", H.seen(A, sz)); out("TOWN record", H.seen(A, tz));
  spec = atlasReveal(tz); spec.paths.forEach(function (p) { var i; for (i = 1; i < p.length; i++) L += Math.sqrt(Math.pow(p[i][0] - p[i - 1][0], 2) + Math.pow(p[i][1] - p[i - 1][1], 2)); });
  r = A.seen[tz].legs.length ? TnDMaps.route(town, spec.points[0], spec.points[1]) : null;
  out("the town's sheet shows", { stands: spec.points.length, ways: spec.paths.length, metresOfStreetShownAsWalked: Math.round(L * unit), via: r && r.via });
  out("straight metres between the two grates", Math.round(Math.sqrt(Math.pow(grates[0].x - grates[grates.length - 1].x, 2) + Math.pow(grates[0].y - grates[grates.length - 1].y, 2)) * unit));
  out("did the story ever put the party on a street between them?", "no: both turns are below ground");
})();
