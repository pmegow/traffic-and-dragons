// s2b-displace.js — part B: over every interior of the fixture capital, add one 8 m2 custom room (as atlasAdopt does) and
// see whether any GENERATED room disappears (the design's "may displace a generated room") or the authored one is dropped.
var ROOT = process.argv[2];
var H = require("./h.js")(ROOT), say = H.say;
var A = H.fresh("campaign-1"), c = H.cast(A); H.point(c.p0.name); atlasFollow(); H.townCast(A, c);
var doors = c.town.portals.filter(function (p) { return p.to && p.to.generator === "interior"; }), displaced = 0, dropped = 0, placed = 0, rows = [];
doors.forEach(function (p) {
  var params = TnDMaps.interior.fromTown(c.town, p.id), d0 = TnDMaps.generate("interior", params), names0 = d0.rooms.map(function (r) { return r.name + "@" + r.floor; }), d1, names1, gone, has;
  params.edits = [{ op: "add", id: "r1", kind: "custom", word: "room", name: "Invented Room", m2: 8 }];
  try { d1 = TnDMaps.generate("interior", params); } catch (e) { rows.push(p.name + ": THREW " + e.message); return; }
  names1 = d1.rooms.map(function (r) { return r.name + "@" + r.floor; }); gone = names0.filter(function (n) { return names1.indexOf(n) < 0; }); has = names1.some(function (n) { return /^Invented Room@/.test(n); });
  if (gone.length) displaced++; if (!has) dropped++; if (has && !gone.length) placed++;
  rows.push(p.name + " (" + d0.rooms.length + " rooms): invented " + (has ? "PLACED" : "DROPPED") + (gone.length ? "; generated rooms GONE: " + gone.join(", ") : "") + (d1.warnings.length ? " | warnings: " + d1.warnings.join(" / ") : ""));
});
rows.forEach(function (r) { say("  " + r); });
say("buildings=" + doors.length + " placed-without-displacement=" + placed + " displaced-a-generated-room=" + displaced + " authored-dropped=" + dropped);
