// p7-phantom-stands.js — does the record ever hold a stand the party did not have?
//  W1 a settlement with ONE way back onto the realm: entering it by name (and every [SUBLOCATION_LEAVE] inside it)
//     stands the party AT that road's end (atlasWayIn: "the ONE portal that points back"), which is EXACT — so the fog's
//     record takes the town's edge as a stand and draws a walk to it. Counts such settlements over a few realms, then
//     drives the flow with REAL turns in one of them: inn -> LEAVE -> market.
//  W2 a house with one door: the party "at the door" — what does the building's fog show?
// node dev/review-717/p7-phantom-stands.js [ROOT]
var H = require("./h.js")(process.argv[2]), say = H.say, hr = H.hr, out = H.out;
function nm(doc, k) { var t = k.charAt(0) === "t" ? atlasThingById(doc, k.slice(2)) : null; return t ? t.name + "#" + t.id + (t.kind ? "(" + t.kind + ")" : "") : k; }
function rec(A, z) { var d = atlasDoc(z), r = A.seen && A.seen[z]; return r ? { at: r.at.map(function (k) { return nm(d, k); }), legs: r.legs.map(function (l) { return nm(d, l[0]) + " <-> " + nm(d, l[1]); }) } : null; }

hr("W1a settlements whose sheet has exactly ONE portal pointing back at their place on the realm");
var found = null;
["campaign-1", "review-717-a", "review-717-b"].forEach(function (seed) {
  var reg = TnDMaps.generate("region", { seed: seed }), one = [], n = 0;
  reg.places.forEach(function (p) {
    var town = TnDMaps.generate("town", TnDMaps.town.fromRegion(reg, p.id)), back = town.portals.filter(function (q) { return q.to && q.to.id === p.id; });
    n++; if (back.length === 1) { one.push(p.name + " (" + p.kind + ", via " + back[0].name + ")"); if (!found) found = { seed: seed, place: p, back: back[0] }; }
  });
  out(seed, one.length + " of " + n + ": " + one.join("; "));
});

hr("W1b REAL turns in one of them: arrive by name, the inn (or any building), LEAVE, another thing");
(function () {
  if (!found) { out("skipped", "no such settlement in these realms"); return; }
  H.stubs(); var A = H.fresh(found.seed, false), tz, town, things, a, b, steps = [];
  function step(l) { steps.push(l + " | at=" + A.zones[A.at].kind + " spot=" + A.spot + " marker=" + JSON.stringify((function (m) { return m && { exact: m.exact, key: m.key }; })(atlasPartyIn(tz || A.at)))); }
  H.turn("[LOCATION:" + found.place.name + "] Arrived."); tz = A.at; town = atlasDoc(tz); step("arrive by name");
  things = atlasThings(town).filter(function (t) { return t.id !== found.back.id && town.portals.filter(function (q) { return q.id === t.id && q.to && q.to.generator === "region"; }).length === 0 && atlasThings(town).filter(function (u) { return atlasNameKey(u.name) === atlasNameKey(t.name); }).length === 1; });
  a = things.filter(function (t) { return t.portal; })[0] || things[0]; b = things.filter(function (t) { return t !== a && !t.portal; })[0] || things[1];
  out("the town's record after arriving (did the story say the party is at the road's end?)", rec(A, tz));
  H.turn("[SUBLOCATION:" + a.name + "] Into " + a.name + "."); step("into " + a.name);
  H.turn("[SUBLOCATION_LEAVE] Back out to the street."); step("LEAVE");
  H.turn("[SUBLOCATION:" + b.name + "] On to " + b.name + "."); step("to " + b.name);
  steps.forEach(function (x) { say("  " + x); });
  out("the town's record", rec(A, tz));
  var spec = atlasReveal(tz), kpu = town.frame.kmPerUnit * 1000, L = 0;
  spec.paths.forEach(function (p) { var i; for (i = 1; i < p.length; i++) L += Math.sqrt(Math.pow(p[i][0] - p[i - 1][0], 2) + Math.pow(p[i][1] - p[i - 1][1], 2)); });
  out("metres of street the fog shows as walked", Math.round(L * kpu)); out("straight metres " + a.name + " -> " + b.name, Math.round(Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2)) * kpu));
})();

hr("W2 a house with one door (an added shrine): the party stands 'at the door' — what does its fog show?");
(function () {
  var S = H.start(true), A = S.A, c = S.c, d, m;
  H.turn("[SUBLOCATION:" + c.market.name + "]"); H.turn("[SUBLOCATION:Old Shrine of Vael] A shrine the map lacks."); d = atlasDoc(A.at); m = atlasPartyIn(A.at);
  out("at/spot", [A.zones[A.at].kind, A.spot]); out("marker", { exact: m.exact, key: m.key, x: m.x, y: m.y, label: atlasMarkers(A.at)[0].label });
  out("rooms", d.rooms.map(function (r) { return r.id; })); out("doors", d.doors.map(function (q) { return { id: q.id, rooms: q.rooms, into: q.into }; }).slice(0, 4));
  out("the room under the marker (interior.locate)", TnDMaps.interior.locate(d, [m.x, m.y]));
  out("atlasReveal (the list of rooms drawn)", atlasReveal(A.at)); out("record", H.seen(A, A.at));
})();
