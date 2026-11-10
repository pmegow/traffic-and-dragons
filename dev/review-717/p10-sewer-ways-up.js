// p10-sewer-ways-up.js — "a dungeon's ways up are known from the sheet above" (atlas.js, the room fog): true before the
// fog, when the town's sheet was whole. Now the town is fogged at 100 m — so for the party standing at ONE grate, how
// far are the sewer's OTHER ways up (which the sewer's sheet draws and names, and whose landing the town's fog hides)?
// For every town of a few realms: the ways into its sewer, the metres between them, and — through the real engine, the
// party down the first grate — which of them the town's own sheet shows (atlasFogShows-style distance) versus which the
// sewer's sheet lists (atlasReveal).
// node dev/review-717/p10-sewer-ways-up.js [ROOT]
var H = require("./h.js")(process.argv[2]), say = H.say, hr = H.hr, out = H.out;
hr("the spread of a sewer's ways up, per town (metres between the farthest two)");
var worst = null;
["campaign-1", "review-717-a"].forEach(function (seed) {
  var reg = TnDMaps.generate("region", { seed: seed });
  reg.places.forEach(function (p) {
    var town = TnDMaps.generate("town", TnDMaps.town.fromRegion(reg, p.id)), ways = town.portals.filter(function (q) { return q.to && q.to.generator === "dungeon" && /sewer/.test(String(q.to.id || q.id)) || q.kind === "grate" || q.kind === "outfall"; }), unit = town.frame.kmPerUnit * 1000, far = 0, i, j;
    for (i = 0; i < ways.length; i++) for (j = i + 1; j < ways.length; j++) far = Math.max(far, Math.sqrt(Math.pow(ways[i].x - ways[j].x, 2) + Math.pow(ways[i].y - ways[j].y, 2)) * unit);
    say("  " + seed + " " + p.name + " (" + p.kind + "): " + ways.length + " ways down [" + ways.map(function (w) { return w.kind; }).join(",") + "], farthest pair " + Math.round(far) + " m");
    if (ways.length > 1 && (!worst || far > worst.far)) worst = { seed: seed, place: p, far: far };
  });
});
hr("the real engine in the widest one: the party goes down ONE grate from a fresh arrival");
(function () {
  if (!worst) { out("skipped", "no town with two ways down"); return; }
  H.stubs(); var A = H.fresh(worst.seed, false), tz, town, ways, sz, sdoc, ids, tspec, unit, rows;
  H.turn("[LOCATION:" + worst.place.name + "] Arrived."); tz = A.at; town = atlasDoc(tz); unit = town.frame.kmPerUnit * 1000;
  ways = town.portals.filter(function (q) { return q.kind === "grate" || q.kind === "outfall"; });
  H.turn("[SUBLOCATION:" + ways[0].name + "] Down the grate."); sz = A.at; sdoc = atlasDoc(sz);
  out("town / sewer", [A.zones[tz].name, A.zones[sz].name, A.zones[sz].kind]); ids = atlasReveal(sz); tspec = atlasReveal(tz);
  out("the town's sheet shows", { points: tspec.points, ways: tspec.paths.length, radiusM: tspec.radiusM });
  rows = sdoc.portals.filter(function (p) { return p.way === "up"; }).map(function (p) {
    var t = p.to ? atlasThingById(town, p.to.id) : null, room = sdoc.rooms.filter(function (r) { return r.id === p.id || r.portal === p.id; })[0];
    return { wayUp: p.name, shownOnTheSewerSheet: !!(room && ids.indexOf(room.id) >= 0), onTheTownSheet: t ? (atlasFogShows(tz, t.x, t.y) ? "shown" : "HIDDEN by the fog, " + Math.round(Math.min.apply(null, tspec.points.map(function (q) { return Math.sqrt(Math.pow(q[0] - t.x, 2) + Math.pow(q[1] - t.y, 2)); })) * unit) + " m from the shown ground") : "?" };
  });
  rows.forEach(function (r) { out("way up", r); });
  out("ways up the sewer's sheet draws that the town's sheet hides", rows.filter(function (r) { return r.shownOnTheSewerSheet && /HIDDEN/.test(r.onTheTownSheet); }).length + " of " + rows.length);
  out("the dungeon scene's 'above' layer (the town's walls and river, drawn on the sewer's sheet whatever the fog)", (function () { var sc = TnDMaps.scene.build(sdoc, "ink", { reveal: ids }), L = sc.layers.filter(function (x) { return x.name === "above"; })[0]; return L ? L.items.length + " items: " + L.items.map(function (i) { return i.s; }).join(",") : "none"; })());
})();
