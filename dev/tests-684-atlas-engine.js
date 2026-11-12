// dev/tests-684-atlas-engine.js — #684: the atlas ENGINE (atlas.js) over the real game engine (dev/load-engine.js) and
// the real map library. Design record: DOC/DESIGN_684_atlas.md. The library's pin is dev/tests-684-atlas.js.
//   • the store is RECIPES: created once, a few KB, survives the save round trip, redraws every document identically
//   • entry: an exact map name enters the zone behind it, once; a sub-location enters the building; idempotent
//   • THE RULE: the engine never guesses — an unknown or twice-borne name is off the map, with the reason
//   • We are here: the player's tap ties the story's own name to a map place; the world before a sub-location; the ONLY
//     ties are the player's — a name is looked up afresh where the party stands (the other inn's Common Room is never
//     found), a card the story moved past is refused, a merged place keeps its tie
//   • a party that left the mapped places is never drawn as there; the sheet above shows the way the party is AT
//   • version drift: a zone that draws differently from its record is said out loud; a read never writes
//   • a failure never escapes a writer; an unreadable store is set aside at load; the party marker is derived
//   • what the pane says (where the party is, what a tap would tie, a thing's card) — and no peeking; the fog of war
//   • THE MAP BLOCK the GM reads: "" without an atlas; the realm in brief, a town with its neighbours, a building, a
//     dungeon; honest off the map and behind a pointer nothing followed; capped at a sentence; never in GEOGRAPHY
//   • #717 FOG OF WAR: the visit record (ids only, a set, exact stands, a leg per walk), what a sheet may show (a radius
//     per sheet, the way along the sheet's own network, room by room under a roof), the switch, the tap, the load door
//   • THE FIXTURE GATE: a re-vendored library that redraws the fixture realm fails here until accepted on purpose
//   • the turn's commit and the load door call the atlas; the load order carries atlas.js
//   node dev/tests-684-atlas-engine.js
//   node dev/tests-684-atlas-engine.js --only "<part of a group's name>"   (one group alone; nothing matched = red)
var assert = require("assert/strict"), fs = require("fs"), path = require("path");
var engine = require("./load-engine.js");
engine.loadEngine();
var ROOT = path.join(__dirname, "..");
function src(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }
var passed = 0, matched = 0;
/* --only <text> (2026-11-06): run only the groups whose name contains the text. Every group builds its own state from
   fresh() / start() / makeTestWorld(), so one runs alone exactly as it runs in the file (dev/check-684-groups-alone.js
   proves it for every group). The sabotage batteries run each clause's own named test this way (sabotage.js `only:`) —
   the file took 13 s per clause, one group takes the engine load. A text that names NO group is said and exits red,
   never a silent green (the #677 lesson: a filter that ran nothing proved eight clauses falsely). */
var ONLY = (function () { var i = process.argv.indexOf("--only"); return i > 0 && typeof process.argv[i + 1] === "string" ? process.argv[i + 1] : null; })();
function test(name, fn) {
  if (ONLY !== null && name.indexOf(ONLY) < 0) return;
  matched++;
  try { fn(); passed++; console.log("PASS #684 " + name); } catch (e) { process.exitCode = 1; console.error("FAIL #684 " + name + " — " + e.stack); }
}
/* #708: a group that awaits (the start's classification is a model call) — the same filter, count and verdict; the file's IIFE is async and awaits it in place */
async function atest(name, fn) {
  if (ONLY !== null && name.indexOf(ONLY) < 0) return;
  matched++;
  try { await fn(); passed++; console.log("PASS #684 " + name); } catch (e) { process.exitCode = 1; console.error("FAIL #684 " + name + " — " + e.stack); }
}

/* THE FIXTURE GATE's table — what the vendored library draws for the fixture realm (seed campaign-1). A document carries
   the version of the library that drew it, so every line is read under ONE fixed stamp (ATLAS_FIXTURES_STAMP, the
   version that first pinned the table): a re-vendor that draws the same realm passes untouched, and one that changes a
   line redraws maps under saved campaigns. Accept that on purpose (re-run with ATLAS_FIXTURES=print and paste), say so
   in the commit and the release note, and name the redrawn zones in a table like ATLAS_REDRAWN_BY_0_13 below.
   Accepted so far: 0.13.0 redrew the wild zone (every wild zone made from a region; nothing else). 0.14.0 redrew NOTHING:
   the table below was re-hashed under fingerprint scheme 2 (the drawing without its params echo, ATLAS_FP_SCHEME), because
   0.14.0 gave the region a default `edits: []` — every drawing was compared byte for byte with 0.13.0's, the params aside.
   0.15.0 (#711: the view's HUD, the scene's `frame` layer) touched no document: nothing redrawn.
   0.16.0 (#711 round 3: the view's bounds and pan) touched no document: nothing redrawn.
   0.17.0 (#711 round 4: the view's margin and the plaque's trail) touched no document: nothing redrawn.
   0.18.0 (#717: the area fog and TnDMaps.route) touched no document: nothing redrawn. */
var ATLAS_FIXTURES_STAMP = "0.12.0";
var ATLAS_FIXTURES = {
  "campaign-1": "region 2d58ee8-5viy",
  "campaign-1/p0": "town cc991e45-2xhl",
  "campaign-1/p0/inn-1": "interior 2d57c132-aar",
  "campaign-1/p0/sewer": "dungeon 1719f900-im0",
  "campaign-1/c0": "dungeon 24b52d0c-5ln",
  "campaign-1/z202_178": "wild a1fc1666-dj5"
};
/* What library 0.12.0 itself recorded in a campaign that mapped those six zones (the table above as 0.12.0 printed it,
   never to be regenerated), and the zones library 0.13.0 draws differently from those records. */
var ATLAS_RECORDS_0_12 = {
  "campaign-1": "89d812b3-5vq5",
  "campaign-1/p0": "ad9ad4eb-2y0f",
  "campaign-1/p0/inn-1": "dafa5fef-al3",
  "campaign-1/p0/sewer": "244e0f70-tpf",
  "campaign-1/c0": "a7204fce-60w",
  "campaign-1/z202_178": "e02a63d6-efp"
};
var ATLAS_REDRAWN_BY_0_13 = ["campaign-1/z202_178"];

(async function () {/* async since #708: one group awaits the start's classification; the groups still run in file order */
  var toasts = [], warns = [], infos = [], reports = [];
  global.showToast = function (m) { toasts.push(String(m)); };
  global.reportError = function (ctx, msg) { reports.push(ctx + ": " + msg); };
  var realWarn = console.warn, realInfo = console.info;
  console.warn = function () { warns.push([].slice.call(arguments).join(" ")); };
  console.info = function () { infos.push([].slice.call(arguments).join(" ")); };
  function quiet() { toasts.length = 0; warns.length = 0; infos.length = 0; reports.length = 0; }
  /* the engine's own behaviour, with "You are here" OFF: these groups probe what the map does with a name it does not know
     (off the map, with the reason); the adoption groups below set `adopt` back on, the campaign's default */
  function fresh(seed) { engine.makeTestWorld(); atlasForget(); quiet(); var A = atlasCreate(seed || "campaign-1"); A.adopt = false; return A; }
  function point(world, sub) { worldState.world.location = world; worldState.world.sublocation = sub || null; }
  function zoneCount() { return Object.keys(worldState.atlas.zones).length; }
  function plain(o) { return JSON.parse(JSON.stringify(o)); }
  /* the fixture realm's cast, read from the document (never hard-coded names) */
  function cast(A) {
    var reg = atlasDoc(A.seed), p0 = reg.places[0], townId = A.seed + "/" + p0.id, c = { reg: reg, p0: p0, p1: reg.places[1], townId: townId };
    return c;
  }
  /* a point of open water inside a zone that holds land: the library opens that zone by its id and refuses the point */
  function shorePoint(reg) {
    var x, y, id;
    for (y = 5; y < 1000; y += 17) for (x = 5; x < 1000; x += 17) {
      try { TnDMaps.wild.fromRegion(reg, [x, y]); continue; } catch (e) { }
      id = TnDMaps.wild.zoneAt(reg, [x, y]).id;
      try { TnDMaps.wild.fromRegion(reg, id); return [x, y]; } catch (e2) { }
    }
    return null;
  }
  /* a point of firm ground inside a zone whose middle is water */
  function coastLand(reg) {
    var x, y, z;
    for (y = 3; y < 1000; y += 11) for (x = 3; x < 1000; x += 11) {
      try { TnDMaps.wild.fromRegion(reg, [x, y]); } catch (e) { continue; }
      z = TnDMaps.wild.zoneAt(reg, [x, y]);
      try { TnDMaps.wild.fromRegion(reg, [z.cx, z.cy]); } catch (e2) { return [x, y]; }
    }
    return null;
  }
  function townCast(A, c) {
    var town = atlasDoc(c.townId);
    c.town = town;
    c.inn = town.establishments.filter(function (e) { return e.kind === "inn"; })[0];
    c.grates = town.portals.filter(function (p) { return p.kind === "grate"; });
    c.market = town.landmarks.filter(function (l) { return l.kind === "market"; })[0];
    c.road = town.portals.filter(function (p) { return p.kind === "road"; })[0];
    assert(c.inn && c.grates.length >= 2 && c.market && c.road, "the fixture capital has an inn, two grates, a market and a road");
    return c;
  }

  test("atlasCreate: the store, the region recipe with its resolved params, and one seed one realm; a second atlas and a bad seed are refused", function () {
    var A = fresh(), rec = A.zones["campaign-1"];
    assert.equal(A.v, ATLAS_VER); assert.equal(A.seed, "campaign-1"); assert.equal(A.at, null); assert.equal(A.off, null);
    assert.equal(rec.kind, "region"); assert.equal(rec.parent, null); assert.equal(rec.params.seed, "campaign-1");
    assert.equal(typeof rec.params.settlements, "number", "the root recipe keeps the RESOLVED params — a changed library default must not redraw the realm");
    assert.equal(rec.lib, TnDMaps.VERSION); assert(/^[0-9a-f]+-[0-9a-z]+$/.test(rec.fp), "a fingerprint: " + rec.fp);
    assert.equal(rec.fp, atlasFingerprint(TnDMaps.generate("region", { seed: "campaign-1" })), "the recipe redraws the document it recorded");
    atlasForget(); assert.equal(atlasFingerprint(atlasDoc(A.seed)), rec.fp, "from the stored recipe alone");
    assert.equal(rec.name, atlasDoc(A.seed).title.name);
    assert.throws(function () { atlasCreate("another-seed"); }, /already has an atlas/);
    engine.makeTestWorld(); assert.throws(function () { atlasCreate("a/b"); }, /4–40 letters/);
    assert(/^[a-z0-9]{12}$/.test(atlasSeedMint()) && atlasSeedMint() !== atlasSeedMint(), "a minted seed");
  });

  test("the fingerprint ignores the timings and the caches a library hangs on a document — and since library 0.13.0 a read writes nothing onto one", function () {
    var A = fresh(), doc = atlasDoc(A.seed), fp = atlasFingerprint(doc), raw = JSON.stringify(doc), timed, other;
    TnDMaps.digest(doc); TnDMaps.wild.fromRegion(doc, [doc.places[0].x, doc.places[0].y]);
    assert.equal(JSON.stringify(doc), raw, "a read wrote onto the document: the fingerprint's underscore guard is load-bearing again — say so in this test's name");
    assert.equal(atlasFingerprint(doc), fp, "a read document must fingerprint like a fresh one");
    timed = Object.assign({}, doc); timed.stats = { ms: 1 }; timed._cache = [1, 2, 3];
    assert.equal(atlasFingerprint(timed), fp, "timings and a cache key are not the drawing");
    other = plain(doc); other.places[0].name = "Elsewhere"; assert.notEqual(atlasFingerprint(other), atlasFingerprint(plain(doc)), "a changed name is a different drawing");
  });

  test("entry by an exact world name: the town is drawn once, its recipe is {kind, parent, via}, the match is NOT kept as a tie, and following is idempotent", function () {
    var A = fresh(), c = cast(A), r, rec;
    point(c.p0.name); r = atlasFollow();
    assert.equal(r.changed, true); assert.deepEqual(r.entered, [c.townId]); assert.equal(A.at, c.townId); assert.equal(A.spot, null, "which road the party came in by is not on record"); assert.equal(A.off, null);
    rec = A.zones[c.townId];
    assert.deepEqual([rec.kind, rec.parent, rec.via, rec.params], ["town", A.seed, c.p0.id, null]);
    assert.equal(rec.name, c.p0.name); assert.equal(rec.lib, TnDMaps.VERSION); assert.equal(rec.fp, atlasFingerprint(atlasDoc(c.townId)));
    assert.deepEqual(Object.keys(A.names), [], "a name the story used is looked up afresh each time — only the player's taps are ties");
    assert.equal(atlasDoc(c.townId).seed, c.townId, "a zone id IS the seed the library derives");
    r = atlasFollow(); assert.equal(r.changed, false); assert.deepEqual(r.entered, []); assert.equal(zoneCount(), 2);
    /* a recipe that no longer derives its own zone is refused, never drawn as something else */
    rec.via = c.p1.id; atlasForget();
    assert.throws(function () { atlasDoc(c.townId); }, /now derives the seed/, "a recipe whose way in leads to another zone must not be served under this zone's id");
    rec.via = c.p0.id;
  });

  test("a sub-location by name enters the building (case, a leading 'the' and punctuation folded); clearing it stands the party back in the town", function () {
    var A = fresh(), c = cast(A), innZone;
    point(c.p0.name); atlasFollow(); townCast(A, c); innZone = c.townId + "/" + c.inn.id;
    point(c.p0.name, "  " + c.inn.name.replace(/^The /, "").toUpperCase() + "! "); atlasFollow();
    assert.equal(A.at, innZone); assert.equal(A.zones[innZone].kind, "interior"); assert.deepEqual([A.zones[innZone].parent, A.zones[innZone].via], [c.townId, c.inn.id]);
    assert.equal(A.off, null);
    point(c.p0.name, c.market.name); atlasFollow();
    assert.equal(A.at, c.townId); assert.equal(A.spot, c.market.id, "a landmark is a spot on the town's own sheet");
    point(c.p0.name); atlasFollow(); assert.equal(A.at, c.townId); assert.equal(A.spot, null); assert.equal(zoneCount(), 3);
    point(c.inn.name); atlasFollow(); assert.equal(A.at, innZone, "a world move to a name on the sheet the party stands on finds it (the story's grain is narrative)");
    point(c.p1.name); atlasFollow(); assert.equal(A.at, A.seed + "/" + c.p1.id, "from inside a town, another town's name is found on the region above");
  });

  test("THE RULE — the engine never guesses: an unknown name is off the map with the reason, nothing is drawn, the last mapped place stands", function () {
    var A = fresh(), c = cast(A), before;
    point("The Salted Wound Tavern"); atlasFollow();
    assert.equal(A.at, null); assert.equal(A.off.name, "The Salted Wound Tavern"); assert(/no place on the map has that name/.test(A.off.why)); assert.equal(zoneCount(), 1);
    point(c.p0.name); atlasFollow(); townCast(A, c);
    point(c.p0.name, "The Rusty Flagon"); atlasFollow();
    assert.equal(A.at, c.townId); assert.deepEqual(plain(A.off), { name: "The Rusty Flagon", why: "no place on the map has that name", within: c.townId, absent: true, zone: c.townId, segment: "The Rusty Flagon", path: ["The Rusty Flagon"] }); assert.equal(zoneCount(), 2);
    var part = c.inn.name.split(" ").pop();
    assert(!atlasFind(c.town, part), "the fixture: '" + part + "' alone names nothing in the town");
    point(c.p0.name, part); atlasFollow();
    assert.equal(A.at, c.townId); assert.equal(A.off.name, part, "part of a name is not the name: '" + part + "' must not find " + c.inn.name); assert.equal(zoneCount(), 2);
    point("A shipwreck on the Blighted Coast"); atlasFollow();
    assert.equal(A.at, c.townId, "the last mapped place stands"); assert.equal(A.off.name, "A shipwreck on the Blighted Coast"); assert.equal(A.off.within, undefined);
    /* two bearers of one name is a refusal, never a pick */
    point(c.p0.name, c.inn.name); atlasFollow(); before = A.at;
    var rooms = atlasDoc(before).rooms, twice = rooms.filter(function (r) { return rooms.filter(function (q) { return atlasNameKey(q.name) === atlasNameKey(r.name); }).length > 1; })[0];
    assert(twice, "the fixture inn has two rooms of one name");
    point(c.p0.name, twice.name); atlasFollow();
    assert.equal(A.at, c.townId, "the party is in the town; which room is not decided"); assert(/are called that/.test(A.off.why), A.off.why); assert.equal(A.off.name, twice.name);
  });

  test("We are here: a tap ties the story's own name to a map place, and the tie brings the party back; the world is tied before a sub-location", function () {
    var A = fresh(), c = cast(A), r, p3 = c.reg.places[3], z3 = A.seed + "/" + p3.id;
    point("The Crossroads of Ashenveil"); atlasFollow(); assert.equal(A.at, null);
    r = atlasPlace(A.seed, { id: p3.id });
    assert.equal(r.ok, true); assert.equal(r.bound, "The Crossroads of Ashenveil"); assert.equal(r.level, "world"); assert.deepEqual(r.entered, [z3]);
    assert.equal(A.at, z3); assert.equal(A.off, null); assert.deepEqual(plain(A.names["The Crossroads of Ashenveil"]), { zone: A.seed, id: p3.id });
    point(c.p0.name); atlasFollow(); assert.equal(A.at, c.townId);
    point("The Crossroads of Ashenveil"); r = atlasFollow(); assert.equal(A.at, z3); assert.deepEqual(r.entered, [], "the tie leads back; nothing is redrawn");
    /* the world first */
    A = fresh(); c = cast(A); point("Sandpoint", "The Rusty Dragon"); atlasFollow();
    r = atlasPlace(A.seed, { id: c.p0.id });
    assert.equal(r.ok, true); assert.equal(r.level, "world"); assert.equal(r.bound, "Sandpoint"); assert.equal(A.at, c.townId);
    assert.equal(A.off.name, "The Rusty Dragon", "the sub-location is still off the map, inside the town"); assert.equal(A.off.within, c.townId);
    townCast(A, c);
    r = atlasPlace(c.townId, { id: c.inn.id });
    assert.equal(r.ok, true); assert.equal(r.level, "sub"); assert.equal(r.bound, "The Rusty Dragon"); assert.equal(A.at, c.townId + "/" + c.inn.id); assert.equal(A.off, null);
    assert.deepEqual(plain(A.names["Sandpoint|The Rusty Dragon"]), { zone: c.townId, id: c.inn.id });
    assert.equal(atlasPlace(A.seed, { id: "no-such-thing" }).ok, false); assert.equal(atlasPlace("no-such-zone", { id: "p0" }).ok, false); assert.equal(atlasPlace(A.seed, {}).ok, false);
    assert.equal(atlasPlace(c.townId, { x: 10, y: 10 }).ok, false, "only the region has open country");
  });

  test("We are here on open ground draws the wild zone at that point; the sea is refused in the library's own words and changes nothing", function () {
    var A = fresh(), c = cast(A), land = null, sea = c.reg.features.filter(function (f) { return f.kind === "sea"; })[0], r, before;
    c.reg.features.forEach(function (f) { if (land || f.kind === "sea" || f.kind === "lake") return; try { TnDMaps.wild.fromRegion(c.reg, [f.x, f.y]); land = f; } catch (e) { } });
    assert(land && sea, "the fixture realm has open country and a sea");
    point("A forest clearing near ancient ruins"); atlasFollow();
    r = atlasPlace(A.seed, { x: land.x, y: land.y });
    assert.equal(r.ok, true); assert.equal(A.zones[A.at].kind, "wild"); assert.equal(A.zones[A.at].parent, A.seed); assert.equal(A.zones[A.at].via, TnDMaps.wild.zoneAt(c.reg, [land.x, land.y]).id);
    assert.equal(A.at, A.seed + "/" + A.zones[A.at].via); assert.equal(A.spot, null);
    before = JSON.stringify(worldState.atlas); quiet();
    r = atlasPlace(A.seed, { x: sea.x, y: sea.y });
    assert.equal(r.ok, false); assert(/^that point lies in the sea/.test(r.reason) && !/\{|z\d+_\d+/.test(r.reason), "the library's reason for the POINT, without its data or a zone's id: " + r.reason);
    assert.equal(JSON.stringify(worldState.atlas), before, "a refused tap changes nothing"); assert.equal(reports.length, 0, "a library refusal is not a bug report");
    /* the shore: open water inside a zone that holds land — the tap is judged as the point it is, never as its zone */
    var shore = shorePoint(c.reg); assert(shore, "the fixture realm has open water inside a zone that holds land");
    r = atlasPlace(A.seed, { x: shore[0], y: shore[1] });
    assert.equal(r.ok, false); assert(/^that point lies in (the sea|a lake)/.test(r.reason), "water at the shore is refused as the point it is: " + r.reason);
    assert.equal(JSON.stringify(worldState.atlas), before, "and the refused shore tap changes nothing"); assert.equal(reports.length, 0);
    /* the coast: firm ground in a zone whose middle is water is stood on (library 0.12.0 judged a zone by its middle) */
    var coast = coastLand(c.reg); assert(coast, "the fixture realm has land in a zone whose middle is water");
    r = atlasPlace(A.seed, { x: coast[0], y: coast[1] });
    assert.equal(r.ok, true, "land at the coast is stood on: " + r.reason); assert.equal(A.zones[A.at].kind, "wild"); assert.equal(A.zones[A.at].via, TnDMaps.wild.zoneAt(c.reg, coast).id);
  });

  test("portals: every way into the sewers is ONE zone; a cave hangs from the region; a way back up lands on the thing it came from", function () {
    var A = fresh(), c = cast(A), sewer, cave = c.reg.caves[0];
    point(c.p0.name); atlasFollow(); townCast(A, c); sewer = c.townId + "/sewer";
    point(c.p0.name, c.grates[0].name); atlasFollow();
    assert.equal(A.at, sewer); assert.equal(A.spot, c.grates[0].id, "the party stands at the grate it came down"); assert.deepEqual([A.zones[sewer].kind, A.zones[sewer].parent], ["dungeon", c.townId]);
    var n = zoneCount();
    point(c.p0.name, c.grates[1].name); atlasFollow();
    assert.equal(A.at, sewer); assert.equal(A.spot, c.grates[1].id); assert.equal(zoneCount(), n, "the second grate opens the same sewer");
    var up = atlasDoc(sewer).portals.filter(function (p) { return p.id === c.grates[0].id; })[0], back = atlasPortalTarget(A, sewer, up, []);
    assert.deepEqual(back, { zone: c.townId, spot: c.grates[0].id }, "the way up comes out at the same grate on the town");
    point(cave.name); atlasFollow();
    assert.equal(A.at, A.seed + "/" + cave.id); assert.deepEqual([A.zones[A.at].kind, A.zones[A.at].parent, A.zones[A.at].via], ["dungeon", A.seed, cave.id]); assert.equal(A.spot, cave.id, "at the mouth");
    assert.deepEqual(atlasPortalTarget(A, c.townId, c.road, []), { zone: A.seed, spot: c.p0.id }, "a town's road leads onto the region at its own place");
  });

  test("persistence: the store is recipes (a few KB for seven zones), survives the save round trip as keyed stores, and redraws every document identically", function () {
    var A = fresh(), c = cast(A), ids, fps = {}, B, size;
    point(c.p0.name); atlasFollow(); townCast(A, c);
    point(c.p0.name, c.inn.name); atlasFollow(); point(c.p0.name, c.grates[0].name); atlasFollow(); point(c.p1.name); atlasFollow(); point(c.reg.caves[0].name); atlasFollow();
    point("Open country"); atlasFollow(); atlasPlace(A.seed, { x: c.p0.x + 6, y: c.p0.y + 4 });
    ids = Object.keys(A.zones); assert.equal(ids.length, 7);
    ids.forEach(function (id) { fps[id] = A.zones[id].fp; assert(fps[id], id + " has a fingerprint"); });
    size = JSON.stringify(A).length; assert(size < 4000, "the atlas store is recipes, not documents: " + size + " bytes");
    worldState = parseWorldState(serializeWorldState(worldState)); migrateWorldState(); atlasForget(); quiet();
    B = worldState.atlas;
    assert.equal(Object.getPrototypeOf(B.zones), null, "zones is a keyed store after a load"); assert.equal(Object.getPrototypeOf(B.names), null, "names is a keyed store after a load");
    assert.deepEqual(plain(B), plain(A));
    ids.forEach(function (id) { assert.equal(atlasFingerprint(atlasDoc(id)), fps[id], id + " redraws identically from its recipe"); });
    assert.equal(atlasFollow().changed, false); assert.equal(toasts.length, 0, "nothing to say after a clean load");
  });

  test("version drift: a zone that draws differently from its record is said out loud and recorded — and a READ never writes the campaign", function () {
    var A = fresh(), c = cast(A), rec, before;
    point(c.p0.name); atlasFollow(); rec = A.zones[c.townId];
    var real = rec.fp; rec.fp = "deadbeef-1"; rec.lib = "0.11.0"; atlasForget(); quiet();
    before = JSON.stringify(worldState.atlas);
    atlasDoc(c.townId); atlasThings(atlasDoc(c.townId)); atlasMarkers(c.townId); atlasPartyIn(A.seed); atlasZones();
    assert.equal(JSON.stringify(worldState.atlas), before, "reads never write"); assert.equal(toasts.length, 0);
    worldState.turn = 42; atlasFollow();
    assert.deepEqual(plain(rec.redrawn), { from: "0.11.0", to: TnDMaps.VERSION, was: "deadbeef-1", turn: 42 }); assert.equal(rec.fp, real); assert.equal(rec.lib, TnDMaps.VERSION);
    assert(toasts.some(function (t) { return /redrawn by a newer map library \(0\.11\.0 → /.test(t) && t.indexOf(c.p0.name) >= 0; }), "the redraw is toasted: " + toasts.join(" | "));
    quiet(); atlasFollow(); assert.equal(toasts.length, 0, "said once");
  });

  test("a newer library that draws the SAME sheet is not a redraw: a record is read as its own library stamped it — a campaign mapped under 0.12.0 settles silently, but for the wild zone 0.13.0 really redrew", function () {
    var A = fresh(), c = cast(A), rec, doc, asOld, said;
    point(c.p0.name); atlasFollow(); rec = A.zones[c.townId]; doc = atlasDoc(c.townId);
    asOld = atlasFingerprint(doc, "0.11.0");
    assert.notEqual(asOld, rec.fp, "a document carries the version of the library that drew it, so another version's stamp fingerprints differently");
    assert.equal(atlasFingerprint(doc, TnDMaps.VERSION), rec.fp, "read as this library stamped it, the drawing is its own record");
    rec.fp = asOld; rec.lib = "0.11.0"; atlasForget(); quiet(); atlasDoc(c.townId); worldState.turn = 43; atlasFollow();
    assert.equal(rec.redrawn, undefined, "the same drawing under a newer library's stamp is NOT a redraw"); assert.equal(toasts.length, 0, "and nothing is said: " + toasts.join(" | "));
    assert.equal(rec.lib, TnDMaps.VERSION); assert.equal(rec.fp, atlasFingerprint(atlasDoc(c.townId)), "the record is re-stamped by the library that draws it now");
    /* the REAL records: what library 0.12.0 wrote into a campaign that mapped the fixture realm's six zones */
    A = fresh(); c = cast(A); point(c.p0.name); atlasFollow(); townCast(A, c);
    point(c.p0.name, c.inn.name); atlasFollow(); point(c.p0.name, c.grates[0].name); atlasFollow(); point(c.reg.caves[0].name); atlasFollow();
    point("Open country"); atlasFollow(); atlasPlace(A.seed, { x: c.p0.x + 6, y: c.p0.y + 4 });
    assert.deepEqual(Object.keys(A.zones).sort(), Object.keys(ATLAS_RECORDS_0_12).sort(), "the six fixture zones");
    /* as a save of that day holds them: scheme-1 fingerprints (no fpv), and the root's params as 0.12.0 echoed them — without the `edits` key 0.14.0 added */
    Object.keys(A.zones).forEach(function (id) { A.zones[id].fp = ATLAS_RECORDS_0_12[id]; A.zones[id].lib = "0.12.0"; delete A.zones[id].fpv; });
    delete A.zones[A.seed].params.edits;
    atlasForget(); quiet(); worldState.turn = 44;
    Object.keys(A.zones).forEach(function (id) { atlasDoc(id); atlasSettleChain(A, id); });
    said = Object.keys(A.zones).filter(function (id) { return A.zones[id].redrawn; });
    assert.deepEqual(said, ATLAS_REDRAWN_BY_0_13, "exactly the zones library 0.13.0 redrew are recorded as redrawn — every other sheet is the one the campaign was mapped on");
    assert.equal(A.zones[said[0]].redrawn.from, "0.12.0"); assert.equal(A.zones[said[0]].redrawn.was, ATLAS_RECORDS_0_12[said[0]]);
    assert.equal(toasts.length, 1, "one notice, for the one zone: " + toasts.join(" | ")); assert(/redrawn by a newer map library \(0\.12\.0 → /.test(toasts[0]), toasts[0]);
    Object.keys(A.zones).forEach(function (id) { assert.equal(A.zones[id].lib, TnDMaps.VERSION, id + " is re-stamped"); assert.equal(A.zones[id].fp, atlasFingerprint(atlasDoc(id)), id); assert.equal(A.zones[id].fpv, ATLAS_FP_SCHEME, id + " carries the scheme"); });
    /* THE SCHEME: the drawing without its params echo — a library that adds a default parameter changes nothing a record sees */
    doc = atlasDoc(A.seed);
    assert.equal(atlasFingerprint(doc), atlasFingerprint(Object.assign({}, doc, { params: Object.assign({}, doc.params, { someDefaultOfTomorrow: 1 }) })), "scheme 2 ignores the params echo");
    assert.notEqual(atlasFingerprint(doc, null, 1), atlasFingerprint(Object.assign({}, doc, { params: Object.assign({}, doc.params, { someDefaultOfTomorrow: 1 }) }), null, 1), "scheme 1 hashed it");
    assert.equal(atlasFingerprint(doc, null, 1, { only: "these" }), atlasFingerprint(Object.assign({}, doc, { params: { only: "these" } }), null, 1), "scheme 1 can be reproduced with the params a recipe stored");
  });

  test("a failure inside the atlas never escapes a writer: the turn still commits, the reason is on record, a half-made zone is rolled back", function () {
    var A = fresh(), c = cast(A), real = TnDMaps.generate, r, n;
    point(c.p0.name); atlasFollow(); n = zoneCount(); quiet();
    TnDMaps.generate = function (kind) { if (kind === "town") throw new Error("boom"); return real.apply(TnDMaps, arguments); };
    try {
      point(c.p1.name);
      assert.doesNotThrow(function () { r = atlasFollow(); });
      assert.equal(zoneCount(), n, "the half-made zone is rolled back"); assert.equal(A.at, c.townId, "the last mapped place stands");
      assert(/boom/.test(A.off.why), A.off.why); assert(toasts.some(function (t) { return /failed — boom/.test(t); }), "toasted"); assert.equal(reports.length, 1, "an unexpected failure is reported once");
    } finally { TnDMaps.generate = real; }
    point(c.p0.name); atlasFollow(); point(c.p1.name); atlasFollow();
    assert.equal(A.at, A.seed + "/" + c.p1.id, "the next move follows normally"); assert.equal(A.off, null);
  });

  test("load: an unreadable store is set aside as evidence, loudly; a newer build's store is left untouched; a dangling position is dropped", function () {
    var A = fresh(), c = cast(A), junk;
    worldState.atlas = { v: 1, seed: "campaign-1", zones: {} }; quiet();
    assert.equal(atlasHeal(), true); assert.equal(worldState.atlas, undefined); junk = worldState.atlasJunk;
    assert(/region recipe is missing/.test(junk.why)); assert.equal(junk.was.seed, "campaign-1"); assert(toasts.some(function (t) { return /set aside/.test(t); }));
    assert.equal(atlasFollow(), null); assert.deepEqual(atlasMarkers("x"), []); assert.deepEqual(atlasZones(), []);
    A = fresh(); A.v = 99; quiet(); var s = JSON.stringify(worldState.atlas);
    assert.equal(atlasHeal(), false); assert.equal(atlasFollow(), null); assert.equal(atlasFollow(), null); assert.equal(JSON.stringify(worldState.atlas), s, "a newer store is untouched");
    assert.equal(toasts.filter(function (t) { return /newer version of the game/.test(t); }).length, 1, "said once");
    A = fresh(); c = cast(A); point(c.p0.name); atlasFollow(); A.at = "campaign-1/gone"; A.names["Ghost"] = { zone: "campaign-1/gone", id: "x" };
    assert.equal(atlasHeal(), true); assert.equal(A.at, null); assert.equal(A.names["Ghost"], undefined); assert.equal(A.ptr, null);
    atlasFollow(); assert.equal(A.at, c.townId, "the map follows the story again");
    A.zones["campaign-1/orphan"] = { kind: "town", parent: "campaign-1/nope", via: "p9", params: null };
    assert.equal(atlasHeal(), true); assert(/hangs from a zone that is not there/.test(worldState.atlasJunk.why));
    engine.makeTestWorld(); assert.equal(atlasHeal(), false); assert.equal(atlasFollow(), null, "a campaign without an atlas: every atlas function is a no-op");
  });

  test("the party marker is derived, never stored: on its own sheet at its spot, on every sheet above at the way down; the library accepts it", function () {
    var A = fresh(), c = cast(A), innZone, m;
    assert.deepEqual(atlasMarkers(A.seed), [], "not placed: no marker");
    point(c.p0.name); atlasFollow(); townCast(A, c); innZone = c.townId + "/" + c.inn.id;
    m = atlasPartyIn(c.townId); assert.equal(m.exact, false, "in the town, the map does not know where"); assert.deepEqual([m.x, m.y], atlasCentre(c.town));
    assert.equal(atlasMarkers(c.townId)[0].label, "The party (somewhere here)", "a marker at a sheet's middle says it is not a known spot");
    point(c.p0.name, c.inn.name); atlasFollow();
    m = atlasMarkers(c.townId); assert.deepEqual(m, [{ id: "party", kind: "party", x: c.inn.x, y: c.inn.y, label: "The party" }], "on the town: at the inn's door");
    m = atlasMarkers(A.seed); assert.deepEqual([m[0].x, m[0].y], [c.p0.x, c.p0.y], "on the region: at the town");
    assert.equal(atlasThingAt(A.seed, m[0].x, m[0].y).id, c.p0.id, "the thing under the marker is the town (a marker wins the click in the pane)");
    assert.equal(atlasThingAt(c.townId, c.inn.x, c.inn.y).id, c.inn.id); assert.equal(atlasThingAt(A.seed, c.p0.x + 3, c.p0.y), null); assert.equal(atlasThingAt("nope", 1, 1), null);
    assert.equal(atlasMarkers(innZone).length, 1); assert.equal(atlasPartyIn(A.seed + "/nowhere"), null);
    [A.seed, c.townId, innZone].forEach(function (z) { TnDMaps.markers.validate(atlasMarkers(z), atlasDoc(z).frame); assert(/The party/.test(TnDMaps.markers.describe(atlasDoc(z), atlasMarkers(z)).text)); });
    assert.equal(JSON.stringify(worldState.atlas).indexOf("\"party\""), -1, "no marker in the store");
    point("Open country"); atlasFollow(); atlasPlace(A.seed, { x: c.p0.x + 6, y: c.p0.y + 4 });
    var z = TnDMaps.wild.zoneAt(c.reg, [c.p0.x + 6, c.p0.y + 4]); m = atlasPartyIn(A.seed);
    assert.deepEqual([m.x, m.y, m.exact], [z.cx, z.cy, true], "a wild zone sits on the region at its own middle");
    assert.deepEqual(atlasTrail(innZone), [A.seed, c.townId, innZone]);
    assert.deepEqual(atlasZones().map(function (zz) { return zz.kind; }), ["region", "town", "interior", "wild"]);
  });

  test("the documents held in memory are bounded: past the cap the oldest is dropped and redraws identically on demand", function () {
    var A = fresh(), c = cast(A), doors, i, fp = A.zones[A.seed].fp;
    point(c.p0.name); atlasFollow(); townCast(A, c);
    doors = c.town.portals.filter(function (p) { return p.to.generator === "interior"; }).slice(0, ATLAS_DOC_CAP + 3);
    assert(doors.length > ATLAS_DOC_CAP, "the fixture capital has more doors than the cap");
    for (i = 0; i < doors.length; i++) { point(c.p0.name, doors[i].name); atlasFollow(); assert.equal(A.at, c.townId + "/" + doors[i].id, doors[i].name); }
    assert(Object.keys(_atlasDocs).length <= ATLAS_DOC_CAP && _atlasDocOrder.length <= ATLAS_DOC_CAP && Object.keys(_atlasDrawn).length <= ATLAS_DOC_CAP, "held: " + Object.keys(_atlasDocs).length);
    assert.equal(atlasFingerprint(atlasDoc(c.townId + "/" + doors[0].id)), A.zones[c.townId + "/" + doors[0].id].fp, "a dropped document redraws identically");
    assert.equal(atlasFingerprint(atlasDoc(A.seed)), fp);
  });


  test("what the pane says: where the party is in words, what a tap would tie, the card of a tapped thing — and no peeking into a zone the party has not entered", function () {
    var A = fresh(), c = cast(A), w, card, s;
    A.fog = false;/* #717: the cards' own words, read on a whole sheet — what the fog withholds from a tap is the #717 groups' subject */
    point("The Salted Wound Tavern"); atlasFollow(); w = atlasWhere();
    assert.equal(w.placed, false); assert.equal(w.text, "The party is not on the map yet. \"The Salted Wound Tavern\" is not on the map (no place on the map has that name).");
    assert.deepEqual(atlasPlacePreview(), { level: "world", name: "The Salted Wound Tavern" });
    s = JSON.stringify(worldState.atlas);
    card = atlasCard(A.seed, { id: c.p0.id });
    assert.deepEqual([card.title, card.opens, card.unvisited, card.partyHere], [c.p0.name, null, true, false], "an unvisited town is named, never opened");
    assert.deepEqual(card.place, { level: "world", name: "The Salted Wound Tavern" });
    card = atlasCard(A.seed, { id: c.reg.caves[0].id }); assert.deepEqual([card.opens, card.unvisited], [null, true], "an unvisited cave is not opened either");
    card = atlasCard(A.seed, { x: c.p0.x + 6, y: c.p0.y + 4 }); assert.deepEqual([card.title, card.opens, card.id], ["Open country", null, null]);
    assert.equal(JSON.stringify(worldState.atlas), s, "a card is a read: it draws and files nothing"); assert.equal(zoneCount(), 1);
    point(c.p0.name); atlasFollow(); townCast(A, c);
    assert.equal(atlasWhere().text, "The party is in " + c.p0.name + ".");
    card = atlasCard(A.seed, { id: c.p0.id }); assert.deepEqual([card.opens, card.unvisited, card.partyHere], [c.townId, false, true], "the town the party is in: its sheet opens, the party is here");
    point(c.p0.name, c.market.name); atlasFollow(); assert.equal(atlasWhere().text, "The party is in " + c.p0.name + ", at " + c.market.name + ".");
    card = atlasCard(c.townId, { id: c.market.id }); assert.deepEqual([card.partyHere, card.opens], [true, null]);
    card = atlasCard(c.townId, { id: c.road.id }); assert.equal(card.opens, A.seed, "a road leads back onto the region's sheet"); assert.equal(card.partyHere, false);
    point(c.p0.name, "The Rusty Flagon"); atlasFollow();
    assert.equal(atlasWhere().text, "The party is in " + c.p0.name + ". \"The Rusty Flagon\" is not on its map (no place on the map has that name).");
    assert.deepEqual(atlasPlacePreview(), { level: "sub", name: "The Rusty Flagon" });
    point("Far Away"); atlasFollow();
    assert.equal(atlasWhere().text, "\"Far Away\" is not on the map (no place on the map has that name). The party's last mapped place is " + c.p0.name + ".");
    var sea = c.reg.features.filter(function (f) { return f.kind === "sea"; })[0]; card = atlasCard(A.seed, { x: sea.x, y: sea.y });
    assert(card && /^that point lies in the sea/.test(card.refused) && !/\{|z\d+_\d+/.test(card.refused) && card.place === null, "open water says why it cannot be stood on, as the point it is: " + JSON.stringify(card));
    var shore = shorePoint(c.reg); card = atlasCard(A.seed, { x: shore[0], y: shore[1] });
    assert(card && /^that point lies in (the sea|a lake)/.test(card.refused) && card.opens === null && card.place === null, "water at the shore offers nothing, though its zone holds land: " + JSON.stringify(card));
    assert.equal(atlasCard(c.townId, { x: 5, y: 5 }), null, "only the region has open ground"); assert.equal(atlasCard(A.seed, { id: "nope" }), null);
    engine.makeTestWorld(); assert.equal(atlasWhere(), null); assert.equal(atlasPlacePreview(), null); assert.equal(atlasCard("x", { id: "y" }), null); assert.equal(atlasReveal("x"), null);
  });

  test("the fog of war: a dungeon shows its ways up, the chambers the party stood in and the passages walked between them, nothing else; a drawn sheet is fogged by distance and a building room by room (#717); with the campaign's fog off every sheet is whole", function () {
    var A = fresh(), c = cast(A), sewer, ids, doc, ups, deep, after;
    point(c.p0.name); atlasFollow(); townCast(A, c); sewer = c.townId + "/sewer";
    assert(atlasReveal(A.seed).radiusM > 0 && atlasReveal(c.townId).radiusM > 0, "#717 (owner 2026-11-09): the realm and a town are fogged by distance from where the party has been");
    A.fog = false; assert.equal(atlasReveal(A.seed), null); assert.equal(atlasReveal(c.townId), null, "the campaign's switch: every sheet whole"); delete A.fog;
    point(c.p0.name, c.inn.name); atlasFollow(); assert.deepEqual(atlasReveal(A.at), [], "#717: a building is fogged room by room (until then it was read whole, like a published plan) — entered by its name, no room is known yet");
    point(c.p0.name, c.grates[0].name); atlasFollow(); doc = atlasDoc(sewer); ids = atlasReveal(sewer);
    ups = waysShown(c.townId, c.town, doc); assert(ups.indexOf(A.spot) >= 0, "the party stands at a way up");
    assert.deepEqual(ids.slice().sort(), ups.slice().sort(), "the ways up the sheet above shows — the party stands at one of them (#717 review, finding 2: a way the town's fog hides is not drawn below)");
    assert(ids.length < doc.rooms.length, "the rest of the sewer is not shown");
    deep = doc.rooms.filter(function (r) { return ids.indexOf(r.id) < 0 && doc.rooms.filter(function (q) { return atlasNameKey(q.name) === atlasNameKey(r.name); }).length === 1 && !atlasFind(c.town, r.name); })[0];
    assert(deep, "the fixture sewer has a chamber with a name of its own");
    point(c.p0.name, deep.name); atlasFollow();
    assert.equal(A.at, sewer, "a chamber's name is found on the entered sheet beneath the town"); assert.equal(A.spot, deep.id);
    after = atlasReveal(sewer);
    ids.concat([deep.id]).forEach(function (id) { assert(after.indexOf(id) >= 0, id + ": the ways up and the chamber the party stands in are shown"); });
    /* #717: what else is shown lies on the way walked (until then: the chamber "and only it") — the #717 room group measures that way */
    assert(after.filter(function (id) { return doc.rooms.some(function (r) { return r.id === id; }); }).length < doc.rooms.length, "chambers off the way stay hidden: " + after.join(","));
    A.fog = false; assert.equal(atlasReveal(sewer), null, "fog off: the sewer whole"); delete A.fog;
    TnDMaps.scene.build(doc, "ink", { reveal: atlasReveal(sewer) });
  });

  test("THE RULE, where the party stands: a name is looked up afresh on the sheets the party is on — the other inn's Common Room, another town's tavern and a room of a building the party is not in are never found, and no match is ever kept", function () {
    var A = fresh(), c = cast(A), inns, shared, zoneOf = function (e) { return c.townId + "/" + e.id; };
    point(c.p0.name); atlasFollow(); townCast(A, c);
    inns = c.town.establishments.filter(function (e) { return e.kind === "inn"; });
    assert(inns.length >= 2, "the fixture capital has two inns");
    function roomsOnce(e) { var rs = TnDMaps.generate("interior", TnDMaps.interior.fromTown(c.town, e.id)).rooms; return rs.filter(function (r) { return rs.filter(function (q) { return atlasNameKey(q.name) === atlasNameKey(r.name); }).length === 1; }).map(function (r) { return r.name; }); }
    shared = roomsOnce(inns[0]).filter(function (n) { return roomsOnce(inns[1]).indexOf(n) >= 0 && !atlasFind(c.town, n); })[0];
    assert(shared, "the two inns share a room name each bears once (a Common Room)");
    point(c.p0.name, inns[0].name); atlasFollow(); point(c.p0.name, shared); atlasFollow();
    assert.equal(A.at, zoneOf(inns[0])); assert(A.spot, "in the first inn's " + shared);
    point(c.p0.name, inns[1].name); atlasFollow(); assert.equal(A.at, zoneOf(inns[1]));
    point(c.p0.name, shared); atlasFollow();
    assert.equal(A.at, zoneOf(inns[1]), "the " + shared + " of the inn the party is IN — not the one it was found in first");
    assert.equal(atlasWhere().text, "The party is in " + inns[1].name + ", at " + shared + ".");
    /* an invented building, then one of its rooms: not a room of an inn the party once visited */
    point(c.p0.name, "Widow Hale's House"); atlasFollow(); assert.equal(A.at, c.townId); assert.equal(A.off.name, "Widow Hale's House");
    point(c.p0.name, shared); atlasFollow();
    assert.equal(A.at, c.townId, "the party is in the town; a room of a house the map does not know is not a room of an inn"); assert.equal(A.off.name, shared); assert.equal(A.off.within, c.townId);
    /* another town: a tavern that stands only in the capital is not found from there */
    var t1 = A.seed + "/" + c.p1.id, only;
    point(c.p1.name); atlasFollow(); assert.equal(A.at, t1);
    only = c.town.establishments.filter(function (e) { return !atlasFind(atlasDoc(t1), e.name) && !atlasFind(c.reg, e.name); })[0];
    assert(only, "the capital has a trade the second town has not");
    point(only.name); atlasFollow();
    assert.equal(A.at, t1, "the party stays where it is"); assert.equal(A.off.name, only.name); assert(/no place on the map has that name/.test(A.off.why));
    point(c.p1.name, only.name); atlasFollow(); assert.equal(A.at, t1); assert.equal(A.off.within, t1);
    assert.deepEqual(Object.keys(A.names), [], "a name the story used is never kept as a tie — only the player's taps are");
  });

  test("the player's ties: a tap on a mapped town's building ties the SUB-location; a card the story has moved past is refused; a merged place keeps its tie", function () {
    var A = fresh(), c = cast(A), r, s;
    point(c.p0.name, "The Rusty Flagon"); atlasFollow(); townCast(A, c);
    assert.deepEqual(atlasPlacePreview(), { level: "sub", name: "The Rusty Flagon" }, "the world place is on the map by its own name: a tap places the sub-location");
    r = atlasPlace(c.townId, { id: c.inn.id }, atlasPlacePreview());
    assert.equal(r.ok, true); assert.equal(r.level, "sub"); assert.equal(A.at, c.townId + "/" + c.inn.id);
    assert.deepEqual(Object.keys(A.names), [c.p0.name + "|The Rusty Flagon"], "one tie, the player's");
    /* the story moves on under an open card */
    point("The Drowned Chapel"); s = JSON.stringify(worldState.atlas);
    r = atlasPlace(A.seed, { id: c.p1.id }, { level: "sub", name: "The Rusty Flagon" });
    assert.equal(r.ok, false); assert.equal(r.moved, true); assert(/moved on/.test(r.reason) && /The Drowned Chapel/.test(r.reason), r.reason);
    assert.equal(Object.keys(A.names).length, 1, "the stale tap tied nothing"); assert.equal(A.names["The Drowned Chapel"], undefined);
    r = atlasPlace(A.seed, { id: c.p1.id }, atlasPlacePreview()); assert.equal(r.ok, true); assert.equal(r.bound, "The Drowned Chapel");
    /* a merge in the identity layer: the place keeps its tie under its new name */
    memory.map.nodes["The Sunken Chapel"] = newMapNode(1, null);
    assert.equal(locAliasRegister("The Sunken Chapel", "The Drowned Chapel", null), true, "the fixture: the old name is now an alias");
    point(c.p0.name); atlasFollow(); point("The Sunken Chapel"); atlasFollow();
    assert.equal(A.at, A.seed + "/" + c.p1.id, "the merged place is still where the player put it"); assert.equal(A.off, null);
  });

  /* #692 (the live spot-check, 2026-11-05): the tie was kept and never SAID. The GM read "The party is in Hushwick." beside
     a story place called The Crossroads of Ashenveil, kept the two apart and put Hushwick two hours down the road. */
  test("a player's tie is SAID (#692): the where-line and the MAP block name the story place the player put there — for the place the party stands in only, never for a name match", function () {
    var A = fresh(), c = cast(A), p3 = c.reg.places[3], z3 = A.seed + "/" + p3.id, w, b, s, est, land = null;
    function say(story, at) { return "The story's \"" + story + "\" is at " + at + " on this map: the player placed it there."; }
    /* on the map by its own name: there is no tie to say */
    point(c.p0.name); atlasFollow(); w = atlasWhere();
    assert.deepEqual(w.ties, []); assert.equal(w.text, "The party is in " + c.p0.name + ".");
    /* the spot-check's case: the story's place, put on a settlement by the player */
    point("The Crossroads of Ashenveil"); atlasFollow();
    assert.equal(atlasPlace(A.seed, { id: p3.id }, atlasPlacePreview()).ok, true);
    s = JSON.stringify(worldState.atlas); w = atlasWhere();
    assert.deepEqual(plain(w.ties), [{ level: "world", name: "The Crossroads of Ashenveil", at: p3.name }]);
    assert.equal(w.text, "The party is in " + p3.name + ". " + say("The Crossroads of Ashenveil", p3.name));
    b = atlasMapBlock();
    assert.equal(b.indexOf(ATLAS_BRIEF_HEAD + "\n" + w.text + "\n"), 0, "the GM is told the tie on the where-line: " + b.slice(0, 520));
    assert.equal(JSON.stringify(worldState.atlas), s, "saying a tie writes nothing");
    /* in the real prompt: the tie rides the volatile half, once, inside the MAP block; the cached stable half is the same with or without it */
    var tied = buildSysPrompt(), kept = A.names["The Crossroads of Ashenveil"], untied;
    delete A.names["The Crossroads of Ashenveil"]; untied = buildSysPrompt(); A.names["The Crossroads of Ashenveil"] = kept;/* the fixture: the same position, the tie unsaid */
    assert.equal(tied.volatile.split(say("The Crossroads of Ashenveil", p3.name)).length, 2, "the prompt says the tie exactly once");
    assert(tied.volatile.indexOf(say("The Crossroads of Ashenveil", p3.name)) > tied.volatile.indexOf("MAP (the drawn map of this world"), "inside the MAP block");
    assert.equal(tied.volatile.replace(" " + say("The Crossroads of Ashenveil", p3.name), ""), untied.volatile, "the tie adds its one sentence to the volatile half and nothing else");
    assert.equal(tied.stable, untied.stable, "the stable half does not carry the tie"); assert.equal(tied.stable.indexOf("the player placed it there"), -1);
    /* the party walks into the settlement under its own name: the same zone, and no tie stands behind THAT name */
    point(p3.name); atlasFollow(); w = atlasWhere();
    assert.equal(A.at, z3); assert.deepEqual(w.ties, []); assert.equal(w.text, "The party is in " + p3.name + ".");
    /* current place only: elsewhere the tie is not mentioned */
    point(c.p0.name); atlasFollow(); b = atlasMapBlock();
    assert.equal(b.indexOf("The Crossroads of Ashenveil"), -1, "a tie is said for the place the party stands in, never listed from afar"); assert.equal(b.indexOf("the player placed it there"), -1);
    /* a pointer the atlas has not followed: nothing is claimed about it */
    point("The Crossroads of Ashenveil"); assert.deepEqual(atlasWhere().ties, [], "the story moved and nothing followed: no tie is said for the new pointer");
    atlasFollow(); assert.equal(atlasWhere().text, "The party is in " + p3.name + ". " + say("The Crossroads of Ashenveil", p3.name), "back at the tied place, it is said again");
    /* a sub-location the map does not know, inside the tied place: the tie first, then the reason */
    point("The Crossroads of Ashenveil", "The Gibbet Yard"); atlasFollow();
    assert.equal(atlasWhere().text, "The party is in " + p3.name + ". " + say("The Crossroads of Ashenveil", p3.name) + " \"The Gibbet Yard\" is not on its map (no place on the map has that name).");
    /* the sub-location tied too: both are said, the world place first */
    est = atlasDoc(z3).establishments[0]; assert(est, "the fixture settlement has a building");
    assert.equal(atlasPlace(z3, { id: est.id }, atlasPlacePreview()).ok, true); w = atlasWhere();
    assert.deepEqual(plain(w.ties), [{ level: "world", name: "The Crossroads of Ashenveil", at: p3.name }, { level: "sub", name: "The Gibbet Yard", at: est.name }]);
    assert.equal(w.text.indexOf("The party is in " + A.zones[A.at].name), 0, w.text);
    assert.equal(w.text.slice(-(say("The Crossroads of Ashenveil", p3.name) + " " + say("The Gibbet Yard", est.name)).length), say("The Crossroads of Ashenveil", p3.name) + " " + say("The Gibbet Yard", est.name), w.text);
    /* a merged place keeps its tie, and it is said under the name the story uses NOW */
    memory.map.nodes["The Ashen Cross"] = newMapNode(1, null);
    assert.equal(locAliasRegister("The Ashen Cross", "The Crossroads of Ashenveil", null), true, "the fixture: the old name is now an alias");
    point("The Ashen Cross"); atlasFollow();
    assert.equal(atlasWhere().text, "The party is in " + p3.name + ". " + say("The Ashen Cross", p3.name));
    point("The Crossroads of Ashenveil"); atlasFollow();
    assert.equal(atlasWhere().text, "The party is in " + p3.name + ". " + say("The Crossroads of Ashenveil", p3.name), "the name said is the pointer's own — the words the story uses — never the identity layer's key");
    /* the commonest shape (independent review): the world place on the map by its own name, a building the GM invented
       tied by the player — the sub-location's tie is said on its own */
    A = fresh(); c = cast(A); point(c.p0.name, "The Gibbet Yard"); atlasFollow(); townCast(A, c);
    assert.equal(atlasPlace(c.townId, { id: c.market.id }, atlasPlacePreview()).ok, true); w = atlasWhere();
    assert.deepEqual(plain(w.ties), [{ level: "sub", name: "The Gibbet Yard", at: c.market.name }]);
    assert.equal(w.text, "The party is in " + c.p0.name + ", at " + c.market.name + ". " + say("The Gibbet Yard", c.market.name));
    /* a party that has left the mapped places: the last-mapped line carries no tie, even one filed under the pointer */
    A.off = { name: c.p0.name, why: "the fixture" };/* the fixture: a world place the map can no longer find, its sub-location's tie still on file */
    w = atlasWhere(); assert.deepEqual(w.ties, [], "nothing is placed for a party that is not on the map");
    assert.equal(w.text, "\"" + c.p0.name + "\" is not on the map (the fixture). The party's last mapped place is " + c.p0.name + ".");
    /* a tie to a thing that bears the story's own name says nothing new (the tap that settles two same-named things) —
       the same once case and punctuation are folded, as a name match is */
    A = fresh(); c = cast(A); var loud = c.p1.name.toUpperCase() + "!";
    A.names[loud] = { zone: A.seed, id: c.p1.id };/* the fixture: as atlasPlace files it */
    point(loud); atlasFollow(); w = atlasWhere();
    assert.equal(A.at, A.seed + "/" + c.p1.id); assert.deepEqual(w.ties, []); assert.equal(w.text, "The party is in " + c.p1.name + ".");
    /* open country: the tie is to the stretch of country the player tapped */
    c.reg.features.forEach(function (f) { if (land || f.kind === "sea" || f.kind === "lake") return; try { TnDMaps.wild.fromRegion(c.reg, [f.x, f.y]); land = f; } catch (e) { } });
    point("A forest clearing near ancient ruins"); atlasFollow();
    assert.equal(atlasPlace(A.seed, { x: land.x, y: land.y }, atlasPlacePreview()).ok, true); w = atlasWhere();
    assert.equal(A.zones[A.at].kind, "wild"); assert.equal(w.ties.length, 1); assert.equal(w.ties[0].at, A.zones[A.at].name || "open country");
    assert.equal(w.text, "The party is in " + (A.zones[A.at].name || A.at) + ". " + say("A forest clearing near ancient ruins", w.ties[0].at));
    /* a tie to a sheet's edge (independent review): an edge is named by a bearing, which is no place — it is said as
       the edge of its sheet, never "is at north" */
    var wild = A.at, wname = A.zones[wild].name, edge = atlasDoc(wild).portals.filter(function (p) { return p.kind === "edge" && p.to && p.to.id; })[0];
    assert(edge && wname, "the fixture zone is named and has an edge that leads on");
    point("The Standing Stone"); atlasFollow();
    assert.equal(atlasPlace(wild, { id: edge.id }, atlasPlacePreview()).ok, true); w = atlasWhere();
    assert.deepEqual(plain(w.ties), [{ level: "world", name: "The Standing Stone", at: "the edge of " + wname + ", " + edge.name }]);
    assert(w.text.indexOf(" " + say("The Standing Stone", "the edge of " + wname + ", " + edge.name)) > 0, w.text);
    /* a tie whose thing a redrawn sheet no longer has — the position stands from the save and the pointer has not moved, so
       nothing follows again: the tie is not said (nothing loose is claimed) and the read does not break */
    A = fresh(); c = cast(A); point("The Lost Mill"); atlasFollow();
    assert.equal(atlasPlace(A.seed, { id: c.p1.id }, atlasPlacePreview()).ok, true); assert.equal(atlasWhere().ties.length, 1);
    A.names["The Lost Mill"].id = "gone-after-a-redraw";/* the fixture: what a library that renumbers its places leaves behind */
    w = atlasWhere(); assert.deepEqual(w.ties, [], "a thing the sheet no longer has is not named"); assert.equal(w.text, "The party is in " + c.p1.name + ".");
  });

  test("a party that has left the mapped places is never drawn as being there: the marker says last mapped place, and every card offers We are here", function () {
    var A = fresh(), c = cast(A), m, card;
    point(c.p0.name); atlasFollow(); townCast(A, c);
    point("Sandpoint"); atlasFollow();
    m = atlasPartyIn(A.seed); assert.equal(m.last, true); assert.equal(m.exact, false);
    assert.equal(atlasMarkers(A.seed)[0].label, "Last mapped place"); assert.equal(atlasMarkers(c.townId)[0].label, "Last mapped place");
    card = atlasCard(A.seed, { id: c.p0.id });
    assert.equal(card.partyHere, false, "the town the party LEFT is not where the party is"); assert.deepEqual(card.place, { level: "world", name: "Sandpoint" }, "so the tap that fixes it is offered");
    assert.equal(atlasPlace(A.seed, { id: c.p0.id }, card.place).ok, true); assert.equal(atlasMarkers(A.seed)[0].label, "The party");
  });

  test("the sheet above shows the way the party is AT, never the first way it used: down a second grate, then deep in the sewer, then through a wild zone's edge", function () {
    var A = fresh(), c = cast(A), sewer, m, deep, doc;
    point(c.p0.name); atlasFollow(); townCast(A, c); sewer = c.townId + "/sewer";
    point(c.p0.name, c.grates[0].name); atlasFollow(); assert.equal(A.zones[sewer].via, c.grates[0].id, "the sewer was first entered by the first grate");
    point(c.p0.name, c.grates[1].name); atlasFollow();
    m = atlasPartyIn(c.townId); assert.deepEqual([m.x, m.y, m.exact], [c.grates[1].x, c.grates[1].y, true], "on the town: at the grate the party stands under, not the first one it used");
    doc = atlasDoc(sewer); deep = doc.rooms.filter(function (r) { return atlasReveal(sewer).indexOf(r.id) < 0 && doc.rooms.filter(function (q) { return atlasNameKey(q.name) === atlasNameKey(r.name); }).length === 1 && !atlasFind(c.town, r.name); })[0];
    point(c.p0.name, deep.name); atlasFollow(); assert.equal(A.spot, deep.id);
    m = atlasPartyIn(c.townId); assert.equal(m.exact, false, "deep in a sewer with three ways in, the town sheet does not know under which street"); assert.deepEqual([m.x, m.y], atlasCentre(c.town));
    assert.equal(atlasMarkers(c.townId)[0].label, "The party (somewhere here)");
    assert.deepEqual([atlasPartyIn(A.seed).x, atlasPartyIn(A.seed).exact], [c.p0.x, true], "on the region the town is still the town");
    /* a wild zone's edge: walking north comes in at the far zone's way BACK, never its own north edge */
    point("Open country"); atlasFollow(); atlasPlace(A.seed, { x: c.p0.x + 6, y: c.p0.y + 4 });
    var here = A.at, edge = atlasDoc(here).portals.filter(function (p) { return p.kind === "edge" && p.to && p.to.id; })[0];
    assert(edge, "the fixture zone has an edge that leads on");
    point(edge.name); atlasFollow();
    assert.equal(A.at, A.seed + "/" + edge.to.id, "through the edge into the next zone"); assert.notEqual(A.spot, edge.id, "not at the new zone's own " + edge.id);
    var back = atlasDoc(A.at).portals.filter(function (p) { return p.to && p.to.id === A.zones[here].via; });
    assert.equal(A.spot, back.length === 1 ? back[0].id : null, "at the way that points back to the zone the party left");
    if (A.spot) assert(/^The party is in .+, at its edge, /.test(atlasWhere().text), atlasWhere().text);
  });

  test("a store whose zones loop is set aside at load; a failed follow is not retried every turn; one campaign's silence is not the next one's", function () {
    var A = fresh(), c = cast(A), real = TnDMaps.generate, realDigest = TnDMaps.digest;
    point(c.p0.name); atlasFollow();
    A.zones["campaign-1/x"] = { kind: "town", parent: "campaign-1/y", via: "p1", params: null }; A.zones["campaign-1/y"] = { kind: "town", parent: "campaign-1/x", via: "p2", params: null };
    assert.equal(atlasHeal(), true); assert(/does not hang from the region/.test(worldState.atlasJunk.why), worldState.atlasJunk.why); assert.equal(worldState.atlas, undefined);
    /* a failed follow stamps the pointer: the same failure is not toasted and reported again on the next turn */
    A = fresh(); c = cast(A); point(c.p0.name); atlasFollow(); quiet();
    TnDMaps.generate = function (kind) { if (kind === "town") throw new Error("boom"); return real.apply(TnDMaps, arguments); };
    try { point(c.p1.name); atlasFollow(); assert.equal(reports.length, 1); atlasFollow(); atlasFollow(); assert.equal(reports.length, 1, "the same pointer is not followed, and not reported, again"); assert.equal(toasts.filter(function (t) { return /boom/.test(t); }).length, 1); }
    finally { TnDMaps.generate = real; }
    /* the MAP block's once-latch belongs to the campaign that tripped it */
    TnDMaps.digest = function () { throw new Error("digest boom"); };
    try {
      A = fresh("campaign-1"); c = cast(A); point(c.p0.name); atlasFollow(); atlasForget(); quiet();
      _atlasWarned = {}; atlasMapBlock(); atlasMapBlock(); assert.equal(toasts.filter(function (t) { return /digest boom/.test(t); }).length, 1);
      engine.makeTestWorld(); atlasCreate("campaign-2"); point(atlasDoc("campaign-2").places[0].name); atlasFollow(); _atlasDocs = {}; _atlasDocOrder = []; _atlasDrawn = {};
      atlasMapBlock(); assert.equal(toasts.filter(function (t) { return /digest boom/.test(t); }).length, 2, "the next campaign's failure is said too — the latch is per campaign");
    } finally { TnDMaps.digest = realDigest; }
  });

  test("the MAP block: nothing without an atlas; unplaced, the realm in brief with every settlement by name and the naming rule", function () {
    engine.makeTestWorld(); atlasForget();
    assert.equal(atlasMapBlock(), "", "a campaign without an atlas adds nothing to its prompt");
    var A = fresh(), c = cast(A), b, s;
    point("The Salted Wound Tavern"); atlasFollow(); s = JSON.stringify(worldState.atlas);
    b = atlasMapBlock();
    assert.equal(b.indexOf(ATLAS_BRIEF_HEAD + "\nThe party is not on the map yet. \"The Salted Wound Tavern\" is not on the map (no place on the map has that name).\n"), 0, b.slice(0, 500));
    assert(b.indexOf(c.reg.title.name + " — a region about") > 0, "the realm's own opening line");
    c.reg.places.forEach(function (p) { assert(b.indexOf(p.name + " (" + p.kind + ")") > 0, "every settlement is named: " + p.name); });
    c.reg.caves.forEach(function (cv) { assert(b.indexOf(cv.name) > 0, "every cave is named: " + cv.name); });
    assert.equal(b.slice(-(ATLAS_BRIEF_RULE.length + 2)), ATLAS_BRIEF_RULE + "\n\n", "the naming rule closes the block");
    assert.equal(b.indexOf(" lies "), -1, "no settlement's own paragraph while the party is nowhere");
    assert.equal(atlasMapBlock(), b, "the block is a pure function of the state"); assert.equal(JSON.stringify(worldState.atlas), s, "building the block writes nothing");
    assert(b.length < 2200, "the realm in brief is brief: " + b.length);
  });

  test("the MAP block in a town: its digest with its trades, its neighbours with bearing, distance and days; in a building and under the ground, that sheet", function () {
    var A = fresh(), c = cast(A), b, digest, line;
    point(c.p0.name); atlasFollow(); townCast(A, c); b = atlasMapBlock(); digest = TnDMaps.digest(c.town).text;
    assert(b.indexOf("\nThe party is in " + c.p0.name + ".\n" + digest.slice(0, 200)) > 0, "the where-line, then the town's digest: " + b.slice(0, 600));
    assert(b.indexOf(c.inn.name + " (inn)") > 0, "the trades the sub-locations bind to");
    line = b.split("\n").filter(function (l) { return l.indexOf("On the region: " + c.p0.name + " is ") === 0; })[0];
    assert(line && /lies \d+ km to the [NSEW]+ (by road )?\(\d+ days?\)/.test(line), "the neighbours with bearing, distance and days: " + line);
    assert(b.length <= ATLAS_BRIEF_HEAD.length + ATLAS_BRIEF_RULE.length + ATLAS_BRIEF_CAP + 200, "inside the cap: " + b.length);
    assert.equal(b.indexOf(ATLAS_BRIEF_CUT), -1, "a city fits whole under the cap");
    point(c.p0.name, c.inn.name); atlasFollow(); b = atlasMapBlock();
    assert(b.indexOf(TnDMaps.digest(atlasDoc(A.at)).text.slice(0, 120)) > 0 && b.indexOf("On the region:") < 0, "inside the inn: the inn's sheet, not the town's");
    point(c.p0.name, c.grates[0].name); atlasFollow(); b = atlasMapBlock();
    var sewer = atlasDoc(A.at), deep = sewer.rooms.filter(function (r) { return atlasReveal(A.at).indexOf(r.id) < 0; })[0];
    assert(b.indexOf("The party is in " + sewer.title.name + ", at " + c.grates[0].name + ".") > 0, b.slice(0, 500));
    assert(b.indexOf(deep.name) > 0, "the GM is told the whole sewer — the chamber '" + deep.name + "' the player's sheet keeps fogged");
    assert.equal(buildGeoBlock().indexOf("MAP ("), -1, "GEOGRAPHY — which Table Talk reuses — never carries the MAP block");
    assert.equal(buildGeoBlock().indexOf(deep.name), -1, "the help desk is never handed a fogged chamber");
  });

  test("the MAP block is honest: a party off the map is not served the sheet it left; a pointer nothing followed is not described; the cap cuts at a sentence and says so", function () {
    var A = fresh(), c = cast(A), b, cap = ATLAS_BRIEF_CAP;
    point(c.p0.name); atlasFollow(); townCast(A, c);
    point("Far Away"); atlasFollow(); b = atlasMapBlock();
    assert(b.indexOf("\"Far Away\" is not on the map (no place on the map has that name). The party's last mapped place is " + c.p0.name + ".") > 0, b.slice(0, 500));
    assert.equal(b.indexOf(c.inn.name), -1, "the town the party left is not served as where it is"); assert(b.indexOf("Settlements: ") > 0, "the realm in brief instead");
    point(c.p0.name, "The Rusty Flagon"); atlasFollow(); b = atlasMapBlock();
    assert(b.indexOf("\"The Rusty Flagon\" is not on its map") > 0 && b.indexOf(c.inn.name + " (inn)") > 0, "an unmapped room inside a mapped town: the town's sheet is still served");
    /* the pointer moves outside a turn (a Sync edit) and nothing follows it */
    point(c.p1.name); quiet(); b = atlasMapBlock();
    assert.equal(b, ATLAS_BRIEF_HEAD + "\nThe map has not followed the story to its current place yet; it says nothing this turn.\n\n");
    assert(warns.some(function (w) { return /MAP block is withheld/.test(w); }), "said in the console");
    atlasFollow(); assert(atlasMapBlock().indexOf("The party is in " + c.p1.name + ".") > 0, "followed: described");
    /* the cap */
    point(c.p0.name); atlasFollow();
    try {
      ATLAS_BRIEF_CAP = 600; b = atlasMapBlock();
      var sheet = b.slice(b.indexOf("\n", ATLAS_BRIEF_HEAD.length + 1) + 1, b.length - ATLAS_BRIEF_RULE.length - 3);
      assert.equal(sheet.slice(-ATLAS_BRIEF_CUT.length), ATLAS_BRIEF_CUT, "a cut sheet says it is cut: " + sheet.slice(-80));
      assert(sheet.length <= 600 + ATLAS_BRIEF_CUT.length, "cut to the cap: " + sheet.length);
      assert(/[.;]$/.test(sheet.slice(0, -ATLAS_BRIEF_CUT.length)), "cut at the end of a sentence or a list item, never mid-word: " + sheet.slice(-90));
      assert.equal(b.slice(-(ATLAS_BRIEF_RULE.length + 2)), ATLAS_BRIEF_RULE + "\n\n", "the naming rule is never cut");
      assert(b.indexOf("The party is in " + c.p0.name + ".") > 0, "the where-line is never cut");
    } finally { ATLAS_BRIEF_CAP = cap; }
  });

  test("the MAP block never breaks a prompt: a failure inside it is one honest line, said once; and the prompt carries the block right after GEOGRAPHY, in the volatile half", function () {
    var A = fresh(), c = cast(A), real = TnDMaps.digest, b;
    point(c.p0.name); atlasFollow(); atlasForget(); quiet();
    TnDMaps.digest = function () { throw new Error("digest boom"); };
    try {
      assert.doesNotThrow(function () { b = atlasMapBlock(); });
      assert.equal(b, ATLAS_BRIEF_HEAD + "\nThe map could not be read this turn; it says nothing.\n\n");
      assert(toasts.some(function (t) { return /digest boom/.test(t); }), "the failure is toasted");
      assert.equal(atlasMapBlock(), b, "the next prompt gets the same honest line");
      assert.equal(toasts.filter(function (t) { return /digest boom/.test(t); }).length, 1, "said once: a standing failure must not toast on every prompt");
      assert.equal(reports.length, 1, "and reported once");
    } finally { TnDMaps.digest = real; }
    /* the real builder: an atlas changes the volatile half by exactly the block, and the cached half not at all */
    var name = TnDMaps.generate("region", { seed: "campaign-1" }).places[0].name, plain, mapped, block;
    engine.makeTestWorld(); atlasForget(); worldState.world.location = name; plain = buildSysPrompt();
    assert.equal(buildSysPrompt().volatile, plain.volatile, "the fixture prompt is stable call to call");
    atlasCreate("campaign-1"); atlasFollow(); mapped = buildSysPrompt(); block = atlasMapBlock();
    assert(block.indexOf("The party is in " + name + ".") > 0, "the mapped fixture stands in the town");
    assert.equal(mapped.stable, plain.stable, "an atlas must not change one byte of the cached stable half");
    assert.equal(mapped.volatile.replace(block, ""), plain.volatile, "the volatile half gains the MAP block and nothing else");
    assert(mapped.volatile.indexOf(buildGeoBlock() + block) >= 0, "right after GEOGRAPHY");
    var api = src("api.js");
    assert(api.indexOf("    +buildGeoBlock()\n    +((typeof atlasMapBlock===\"function\")?atlasMapBlock():\"\")") > 0, "buildSysPrompt serves the MAP block right after GEOGRAPHY");
    assert(api.indexOf("atlasMapBlock") > api.indexOf("var volatile_="), "in the volatile half — a per-turn block must never touch the cached stable half");
    assert(api.indexOf('audience==="player"')>=0 && api.indexOf("atlasKnowledgePlayerBlock()")>=0, "player geography uses the explicit public projection");
    assert.equal(src("table-talk.js").indexOf("atlas"), -1, "Table Talk is never handed the map");
    var game = src("game.js"), sa = game.indexOf("async function sendAction("), body = game.slice(sa, game.indexOf("\nasync function ", sa + 10) > 0 ? game.indexOf("\nasync function ", sa + 10) : sa + 20000);
    assert(body.indexOf("atlasFollow()") > 0 && body.indexOf("atlasFollow()") < body.indexOf("callGM("), "sendAction follows the pointer before the prompt is built");
  });

  /* ── #693: a room is filed under its building (owner rulings 2026-11-06). The second build: the building comes from the
     POINTER's names, read through the map (atlasPosition), never from where the map last stood. Design record and the
     rules (a)–(f): DOC/DESIGN_684_atlas.md ▸ "A room is filed under its building". Every test here drives REAL turn
     commits (commitGmTurn), as the reviewer of the first build did. ────────────────────────────────────────────── */
  var SEP = ATLAS_PATH_SEP;
  var realLog = console.log;
  function stubs() {
    var values = Object.create(null);
    global.store = { get: function (k) { return Object.prototype.hasOwnProperty.call(values, k) ? values[k] : null; }, set: function (k, v) { values[k] = String(v); }, del: function (k) { delete values[k]; } };
    global.syncUI = function () { }; global.addMsg = function () { }; global.generateActions = function () { }; global.storageAdapter = { syncToServer: function () { }, resetSyncState: function () { } };
  }
  function turn(t, action) { console.log = function () { }; try { if (action != null) lastAction = action; commitGmTurn(t, { userMsg: action || "x", playerTxt: action || "x" }); } finally { console.log = realLog; } }
  function node(k) { return memory.map.nodes[locResolve(k)]; }
  function sub() { return worldState.world.sublocation; }
  function nodesWith(s) { return Object.keys(memory.map.nodes).filter(function (k) { return k.indexOf(s) >= 0; }).sort(); }
  function nodeCount() { return Object.keys(memory.map.nodes).length; }
  /* the zone a building on the fixture capital's sheet opens */
  function bz(S, name) { var p = S.c.town.portals.filter(function (q) { return q.name === name; })[0]; assert(p, "the fixture capital has " + name); return S.c.townId + "/" + p.id; }
  /* a chamber of a dungeon that is no way up */
  function deepRoom(doc) { return doc.rooms.filter(function (rm) { return !doc.portals.some(function (p) { return p.id === rm.id; }); })[0]; }
  /* the rooms cast: three buildings that each bear one room name once, a second room the first two share, and a building that repeats a name */
  function roomCast(c) {
    var shared = {}, twice = null;
    c.town.portals.filter(function (p) { return p.to && p.to.generator === "interior"; }).forEach(function (p) {
      var d = TnDMaps.generate("interior", TnDMaps.interior.fromTown(c.town, p.id)), seen = {};
      d.rooms.forEach(function (rm) { seen[rm.name] = (seen[rm.name] || 0) + 1; });
      Object.keys(seen).forEach(function (n) { if (seen[n] === 1) (shared[n] = shared[n] || []).push(p.name); else if (!twice) twice = { in: p.name, room: n, n: seen[n] }; });
    });
    var room = Object.keys(shared).filter(function (n) { return shared[n].length >= 3; })[0], r = { room: room, a: shared[room][0], b: shared[room][1], third: shared[room][2], twice: twice };
    r.other = Object.keys(shared).filter(function (n) { return n !== room && shared[n].indexOf(r.a) >= 0 && shared[n].indexOf(r.b) >= 0; })[0];
    assert(room && r.a && r.b && r.third && r.other && twice, "the fixture capital has a room name three buildings bear once each, a second the first two share, and a building that repeats a name");
    return r;
  }
  function start(adopt) { stubs(); var A = fresh(), c = cast(A); A.adopt = adopt !== false; turn("At the gate. [LOCATION:" + c.p0.name + "]"); townCast(A, c); return { A: A, c: c, T: c.p0.name, r: roomCast(c) }; }

  test("#693 a room is filed under its building: two inns' rooms of one name are two places with their own memory, and the GM is told the right one", function () {
    var S = start(), T = S.T, r = S.r, A = S.A, g;
    turn("[SUBLOCATION:" + r.a + "] In."); assert.equal(sub(), r.a, "a building on the town's sheet is bare, as named"); assert(node(T + "|" + r.a));
    turn("[SUBLOCATION:" + r.room + "][LOCATION_DESC:The FIRST building's room: a copper still.][LOCATION_STATE:The still was smashed.] In the room.");
    assert.equal(sub(), r.a + SEP + r.room, "the room is filed under its building");
    assert.equal(node(T + "|" + r.a + SEP + r.room).description, "The FIRST building's room: a copper still.");
    assert.equal(atlasWhere().text, "The party is in " + r.a + ", at " + r.room + ".", "the follow walks the path to the room");
    turn("[SUBLOCATION_LEAVE] Out."); turn("[SUBLOCATION:" + r.b + "] In the second.");
    turn("[SUBLOCATION:" + r.room + "][LOCATION_DESC:The SECOND building's room: bare flagstones.] In the second room.");
    assert.equal(sub(), r.b + SEP + r.room); assert.equal(atlasWhere().text, "The party is in " + r.b + ", at " + r.room + ".");
    assert.equal(node(T + "|" + r.b + SEP + r.room).description, "The SECOND building's room: bare flagstones.");
    assert.equal(node(T + "|" + r.a + SEP + r.room).visits, 1); assert.equal(node(T + "|" + r.b + SEP + r.room).visits, 1);
    assert.equal(node(T + "|" + r.room), undefined, "no town-wide node bears the bare room name");
    g = buildGeoBlock();
    assert(g.indexOf("bare flagstones") > 0 && g.indexOf("still was smashed") < 0 && g.indexOf("copper still") < 0, "the GM is told the second room's memory, never the first's: " + g.slice(0, 400));
    assert(g.indexOf("Sub-location: " + r.b + SEP + r.room) > 0, "and reads the room with its building");
    /* room to room inside one building; a place operand names a room by its own name */
    turn("[SUBLOCATION:" + r.other + "] Next door."); assert.equal(sub(), r.b + SEP + r.other);
    turn("[LOCATION_ITEM:Silver key|placed|" + r.room + "][LOCATION_STATE:The floor is flooded.|" + r.room + "] A key left behind.");
    assert(node(T + "|" + r.b + SEP + r.room).items.some(function (it) { return it.name === "Silver key"; }), "an item placed by a room's own name lands in THIS building's room");
    assert((node(T + "|" + r.b + SEP + r.room).stateNotes || []).some(function (x) { return x.n === "The floor is flooded."; }), "and so does a state note");
    assert(!(node(T + "|" + r.a + SEP + r.room).items || []).length, "never in the other building's");
    /* a name the building bears more than once is still filed under the building; the map does not pick */
    turn("[SUBLOCATION_LEAVE] Out."); turn("[SUBLOCATION:" + r.twice.in + "] In."); turn("[SUBLOCATION:" + r.twice.room + "] Along.");
    assert.equal(sub(), r.twice.in + SEP + r.twice.room); assert.equal(A.at, bz(S, r.twice.in), "the party is in that building");
    assert(A.off && A.off.within === A.at && /are called that/.test(A.off.why), "which room is not decided: " + JSON.stringify(A.off));
    /* from inside a building, a thing on the TOWN's sheet and the building itself are bare, as before */
    turn("[SUBLOCATION:" + S.c.market.name + "] To the market."); assert.equal(sub(), S.c.market.name); assert.equal(A.at, S.c.townId);
    turn("[SUBLOCATION:" + r.a + "] In."); turn("[SUBLOCATION:" + r.room + "] The room."); turn("[SUBLOCATION:" + r.a + "] Back to the door."); assert.equal(sub(), r.a); assert.equal(A.at, bz(S, r.a));
  });

  test("#693 the building comes from the pointer, never from where the map last stood: an invented room, a re-stated town and a first-entry reply all keep the building", function () {
    var S = start(), T = S.T, r = S.r, A = S.A;
    /* an invented room the sheet does not bear, then a mapped room — in two buildings */
    turn("[SUBLOCATION:" + r.a + "] In."); turn("[SUBLOCATION:Back Room] A private booth.");
    assert.equal(sub(), r.a + SEP + "Back Room", "ruling 2: a place the sheet lacks is filed under the building"); assert.equal(A.at, bz(S, r.a)); assert.equal(A.off, null, "and drawn onto the building's sheet (You are here, ruling 7): " + JSON.stringify(A.off)); assert(atlasFind(atlasDoc(A.at), "Back Room").thing, "the room is on the sheet");
    turn("[SUBLOCATION:" + r.room + "][LOCATION_DESC:FIRST room: a copper still.] On."); assert.equal(sub(), r.a + SEP + r.room);
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:" + r.b + "] In."); turn("[SUBLOCATION:Back Room] A snug."); assert.equal(sub(), r.b + SEP + "Back Room");
    turn("[SUBLOCATION:" + r.room + "] On."); assert.equal(sub(), r.b + SEP + r.room);
    assert.deepEqual(nodesWith(SEP + r.room), [T + "|" + r.a + SEP + r.room, T + "|" + r.b + SEP + r.room].sort()); assert.equal(node(T + "|" + r.room), undefined);
    assert(buildGeoBlock().indexOf("copper still") < 0, "no carry-over");
    /* the footer pair: the town re-stated, then the room, inside a building */
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:" + r.a + "] In.");
    turn("Into the room. [LOCATION:" + T + "][SUBLOCATION:" + r.room + "]"); assert.equal(sub(), r.a + SEP + r.room, "a room named after a re-stated town is the room of the building the party was in"); assert.equal(worldState.world.location, T);
    turn("[LOCATION:" + T + "] Out into the streets."); assert.equal(sub(), null, "#511: the same-world tag alone still leaves the venue to the streets");
    /* a building first entered and a room named in one reply; the next turns' rooms stay under it */
    turn("[SUBLOCATION:" + r.third + "] In. [SUBLOCATION:" + r.room + "][LOCATION_DESC:THIRD room.] Through.");
    assert.equal(sub(), r.third + SEP + r.room, "an unentered building's room is filed under the building — the way in on the town's sheet says where the party is");
    assert.equal(A.at, bz(S, r.third), "and the follow entered it along the path"); assert.equal(A.off, null);
    turn("[SUBLOCATION:" + r.other + "] Next."); assert.equal(sub(), r.third + SEP + r.other);
    /* from one building into another and its room, in one reply */
    turn("[SUBLOCATION:" + r.a + "] Across town. [SUBLOCATION:" + r.room + "] And in."); assert.equal(sub(), r.a + SEP + r.room); assert.equal(node(T + "|" + r.a + SEP + r.room).visits, 3, "the first building's room: the first visit, the footer pair, this"); assert.equal(node(T + "|" + r.third + SEP + r.room).visits, 1);
    assert(buildGeoBlock().indexOf("THIRD room") < 0, "the third building's memory stays its own");
  });

  test("#693 from the street a bare room name stays a town-wide node (the accepted limit), and [SUBLOCATION_LEAVE] is a departure", function () {
    var S = start(), T = S.T, r = S.r, A = S.A;
    turn("[SUBLOCATION:" + r.a + "] In."); turn("[SUBLOCATION_LEAVE] Out.");
    turn("Round the back, into the kitchen. [SUBLOCATION:" + r.room + "]"); assert.equal(sub(), r.room); assert(node(T + "|" + r.room), "bare, as in every unmapped campaign");
    assert(atlasFind(atlasDoc(S.c.townId), r.room).thing, "You are here makes the limit visible: a town-level place of that name is added to the town's sheet, since the GM named it from the street"); assert.equal(A.zones[A.at].parent, S.c.townId, "and the party is in it");
    turn("[SUBLOCATION:" + r.a + "] In."); turn("[SUBLOCATION_LEAVE][SUBLOCATION:" + r.room + "] Out and round the back."); assert.equal(sub(), r.room, "an explicit leave puts the party on the street before the room is named");
    assert.equal(node(T + "|" + r.room).visits, 2);
  });

  test("#693 a zone named by its own title keeps the party in it, and its chambers are filed under the zone: the sewer, and a crypt under its temple in three segments", function () {
    var S = start(), T = S.T, A = S.A, c = S.c, sewer, sd, title, deep, temple, tz, td, cz, cd, chamber, down, up;
    turn("[SUBLOCATION:" + c.grates[0].name + "] Down the drain."); sewer = A.at; sd = atlasDoc(sewer); title = A.zones[sewer].name;
    assert.equal(A.zones[sewer].kind, "dungeon"); assert.equal(sub(), c.grates[0].name, "the way in is a thing on the town's sheet: bare");
    turn("[SUBLOCATION:" + title + "] You wade on."); assert.equal(sub(), title, "the zone's own title is one segment"); assert.equal(A.at, sewer); assert.equal(A.spot, null); assert(node(T + "|" + title));
    deep = deepRoom(sd);
    turn("[SUBLOCATION:" + deep.name + "] To the junction."); assert.equal(sub(), title + SEP + deep.name, "a chamber is filed under its sewer"); assert.equal(A.at, sewer); assert.equal(A.spot, deep.id);
    turn("[SUBLOCATION:" + title + "] Back into the dark."); assert.equal(sub(), title); assert.equal(A.at, sewer); assert.equal(node(T + "|" + title).visits, 2);
    /* a crypt under a temple: three segments, and the sheet above is still in reach */
    temple = c.town.landmarks.filter(function (l) { return l.kind === "temple"; })[0]; assert(temple, "the fixture capital has a temple");
    turn("[SUBLOCATION:" + temple.name + "] Up and into the temple."); tz = A.at; td = atlasDoc(tz); assert.equal(sub(), temple.name); assert.equal(A.zones[tz].kind, "interior");
    down = td.portals.filter(function (p) { return p.way === "down"; })[0]; assert(down, "the fixture temple has a way down");
    turn("[SUBLOCATION:" + down.name + "] Down the stair."); cz = A.at; cd = atlasDoc(cz);
    assert.equal(sub(), temple.name + SEP + down.name, "the stair is a thing on the temple's sheet"); assert.equal(A.zones[cz].kind, "dungeon"); assert.equal(A.zones[cz].parent, tz);
    chamber = deepRoom(cd);
    turn("[SUBLOCATION:" + chamber.name + "] Into the dark."); assert.equal(sub(), temple.name + SEP + A.zones[cz].name + SEP + chamber.name, "three segments: the temple, the crypt, the chamber"); assert.equal(A.at, cz); assert.equal(A.spot, chamber.id);
    turn("[SUBLOCATION:" + A.zones[cz].name + "] Somewhere in the crypt."); assert.equal(sub(), temple.name + SEP + A.zones[cz].name, "the crypt by its title"); assert.equal(A.at, cz); assert.equal(A.spot, null);
    up = td.rooms.filter(function (rm) { return rm.id !== down.id && atlasFind(td, rm.name) && atlasFind(td, rm.name).thing; })[0]; assert(up, "the fixture temple has a room of its own with one name");
    turn("[SUBLOCATION:" + up.name + "] Back up into the temple."); assert.equal(sub(), temple.name + SEP + up.name, "a room of the sheet above is found from the crypt: every sheet the party is in, deepest first"); assert.equal(A.at, tz); assert.equal(A.spot, up.id);
    assert.equal(node(T + "|" + up.name), undefined); assert.equal(node(T + "|" + temple.name + SEP + A.zones[cz].name + SEP + up.name), undefined, "never under the crypt");
    /* a zone's title from the street: an entered child of the town, by its title */
    turn("[SUBLOCATION_LEAVE] Out into the streets."); turn("[SUBLOCATION:" + title + "] Back down into the sewers, by another way."); assert.equal(sub(), title); assert.equal(A.at, sewer); assert.equal(A.spot, null);
  });

  test("#693 a way in and the room beneath it are one node: a grate re-stated from below, the crypt stair named from the crypt", function () {
    var S = start(), T = S.T, A = S.A, c = S.c, g = c.grates[0], temple, td, stair, cz, cd, chamber, n0;
    turn("[SUBLOCATION:" + g.name + "][LOCATION_DESC:A rusted grate; the ladder drops into black water.] Down."); assert.equal(sub(), g.name); assert.equal(A.zones[A.at].kind, "dungeon");
    n0 = nodeCount();
    turn("[SUBLOCATION:" + g.name + "] You catch your breath at the foot of the ladder."); assert.equal(sub(), g.name, "the landing bears the grate's name: the same node"); assert.equal(nodeCount(), n0);
    assert(buildGeoBlock().indexOf("rusted grate") > 0, "its description is still served"); assert.equal(node(T + "|" + g.name).visits, 2);
    temple = c.town.landmarks.filter(function (l) { return l.kind === "temple"; })[0];
    turn("[SUBLOCATION:" + temple.name + "] In."); td = atlasDoc(A.at); stair = td.portals.filter(function (p) { return p.way === "down"; })[0];
    turn("[SUBLOCATION:" + stair.name + "][LOCATION_DESC:A worn stair behind the altar.] Down."); cz = A.at; cd = atlasDoc(cz); assert.equal(sub(), temple.name + SEP + stair.name); assert.equal(A.zones[cz].kind, "dungeon");
    chamber = deepRoom(cd);
    turn("[SUBLOCATION:" + chamber.name + "] On."); n0 = nodeCount();
    turn("[SUBLOCATION:" + stair.name + "] Back to the foot of the stair."); assert.equal(sub(), temple.name + SEP + stair.name, "the crypt's way up IS the temple's stair"); assert.equal(nodeCount(), n0, "no second node for one position");
    assert.equal(A.at, cz, "the party stands at the foot of the stair, in the crypt"); assert.equal(A.spot, stair.id);
    assert(buildGeoBlock().indexOf("worn stair") > 0, "the stair's description is served at the stair");
    turn("[SUBLOCATION:" + stair.name + "] Still here."); assert.equal(nodeCount(), n0); assert.equal(node(T + "|" + temple.name + SEP + stair.name).visits, 3);
  });

  test("#693 a passed-through room is filed by its qualified name, and an item and a state note between two moves land on it", function () {
    var S = start(), T = S.T, r = S.r, k = T + "|" + r.a + SEP + r.room;
    turn("[SUBLOCATION:" + r.a + "] In.");
    turn("[SUBLOCATION:" + r.room + "] You drop the key on the table. [LOCATION_ITEM:Silver key|placed][LOCATION_STATE:The window is broken.] Then on through. [SUBLOCATION:" + r.other + "] The next room.");
    assert.equal(sub(), r.a + SEP + r.other); assert(node(k), "the passed-through room has its node"); assert.equal(node(k).visits, 1);
    assert.equal(node(T + "|" + r.room), undefined, "no bare ghost");
    assert((node(k).items || []).some(function (it) { return it.name === "Silver key"; }), "the item landed on the passed-through room"); assert((node(k).stateNotes || []).some(function (x) { return x.n === "The window is broken."; }), "and the state note");
    turn("[SUBLOCATION:" + r.room + "] Back."); assert.equal(node(k).visits, 2, "one node for the room, walked through or stood in");
  });

  test("#693 the qualified form is accepted as written — a hyphen, other casing, an unentered building — and the follow enters along it", function () {
    var S = start(), T = S.T, r = S.r, A = S.A, n0;
    turn("[SUBLOCATION:" + r.third.toLowerCase() + " - " + r.room.toLowerCase() + "][LOCATION_DESC:THIRD room, first visit.] Straight through to the room.");
    assert.equal(sub(), r.third + SEP + r.room, "the map's spelling of the building and the room, the dash"); assert.equal(A.at, bz(S, r.third), "an unentered building is entered along the path"); assert.equal(A.off, null);
    turn("[SUBLOCATION_LEAVE] Out."); turn("[SUBLOCATION:" + r.third + "] In by the door."); turn("[SUBLOCATION:" + r.room + "] The room.");
    assert.equal(sub(), r.third + SEP + r.room); assert.equal(node(T + "|" + r.third + SEP + r.room).visits, 2); assert(buildGeoBlock().indexOf("THIRD room, first visit") > 0, "one node, its memory kept");
    n0 = nodeCount();
    turn("[SUBLOCATION:" + r.third.toUpperCase() + " – " + r.room + "] Re-stated with an en dash."); assert.equal(sub(), r.third + SEP + r.room); assert.equal(nodeCount(), n0, "no twin");
    assert.deepEqual(nodesWith(r.room), [T + "|" + r.third + SEP + r.room]);
    /* an item operand in the qualified form, from the street: no position needed */
    turn("[SUBLOCATION_LEAVE]"); turn("[LOCATION_ITEM:Brass key|placed|" + r.third + " - " + r.room + "] Tossed through the window.");
    assert((node(T + "|" + r.third + SEP + r.room).items || []).some(function (it) { return it.name === "Brass key"; }), "a qualified place operand needs no position");
  });

  test("#693 a building the player tied under a story name keeps the story's name for its rooms, and the where-line still says the tie", function () {
    var S = start(), T = S.T, A = S.A, c = S.c, res, w, innDoc, innRoom, sewer, title, deep;
    turn("[SUBLOCATION:Widow Hale's House] A narrow house."); assert.equal(sub(), "Widow Hale's House"); assert(A.adds[T + "|Widow Hale's House"], "You are here added the house to the town"); assert(atlasFind(atlasDoc(c.townId), "Widow Hale's House").thing);
    res = atlasPlace(c.townId, { id: c.inn.id }); assert.equal(res.ok, true); assert.equal(res.level, "sub"); assert.equal(A.at, c.townId + "/" + c.inn.id);
    assert.equal(A.adds[T + "|Widow Hale's House"], undefined, "the player's tap is the correction: the engine's addition is put away"); assert.equal(atlasFind(atlasDoc(c.townId), "Widow Hale's House"), null, "and gone from the sheet");
    innDoc = atlasDoc(A.at); innRoom = innDoc.rooms.filter(function (rm) { return atlasFind(innDoc, rm.name) && atlasFind(innDoc, rm.name).thing; })[0];
    turn("[SUBLOCATION:" + innRoom.name + "] Into the widow's room.");
    assert.equal(sub(), "Widow Hale's House" + SEP + innRoom.name, "the story's name stands for the building the tap put it at"); assert.equal(A.at, c.townId + "/" + c.inn.id); assert.equal(A.spot, innRoom.id);
    w = atlasWhere(); assert.equal(w.ties.length, 1, JSON.stringify(w.ties)); assert.equal(w.ties[0].name, "Widow Hale's House"); assert.equal(w.ties[0].at, c.inn.name);
    assert(w.text.indexOf("The story's \"Widow Hale's House\" is at " + c.inn.name + " on this map") > 0, w.text); assert(atlasMapBlock().indexOf("Widow Hale's House\" is at") > 0, "the GM is told the tie behind the room");
    /* the map's own name for the same building files under the story's name too — one building, one set of rooms */
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:" + c.inn.name + "] In by the map's name."); turn("[SUBLOCATION:" + innRoom.name + "] The room again.");
    assert.equal(sub(), "Widow Hale's House" + SEP + innRoom.name, "the tied name is the building's name in every key"); assert.equal(node(T + "|Widow Hale's House" + SEP + innRoom.name).visits, 2); assert.equal(nodesWith(SEP + innRoom.name).length, 1);
    /* a tie to a grate does not rename the sewer: three grates, one sewer, one set of chambers */
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:The Drain] A grate in the alley."); res = atlasPlace(c.townId, { id: c.grates[0].id }); assert.equal(res.ok, true);
    sewer = A.at; title = A.zones[sewer].name; deep = deepRoom(atlasDoc(sewer));
    turn("[SUBLOCATION:" + deep.name + "] Down and along."); assert.equal(sub(), title + SEP + deep.name, "a zone with several ways in keeps its own title");
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:" + c.grates[1].name + "] Down the other grate."); turn("[SUBLOCATION:" + deep.name + "] Along."); assert.equal(node(T + "|" + title + SEP + deep.name).visits, 2, "one chamber, one node, from either grate");
  });

  test("#693 the neighbours compare through the resolver: a [LOCATION:] naming a room is refused as a twin, a split member left in the room folds back when the party returns, and a door to a room on record is a way already", function () {
    var S = start(), T = S.T, r = S.r, k = T + "|" + r.a + SEP + r.room, n, x, sheet, R;
    turn("[SUBLOCATION:" + r.a + "] In."); turn("[SUBLOCATION:" + r.room + "] The room."); turn("[SUBLOCATION:" + r.other + "] Out to the other room.");
    /* W5 — inside the building the resolver decides (an article the bare-leaf scan cannot fold: "the Kitchen" is this building's Kitchen) */
    turn("Back to the room. [LOCATION:the " + r.room + "]"); assert.equal(worldState.world.location, T, "the world move is refused"); assert.equal(sub(), r.a + SEP + r.other);
    assert((worldState.locationTwinConflicts || []).some(function (tc) { return tc.child === k; }), "the twin is the building's room: " + JSON.stringify(worldState.locationTwinConflicts)); assert.equal(memory.map.nodes["the " + r.room], undefined, "no world node minted");
    turn("[SUBLOCATION_LEAVE] Out."); worldState.locationTwinConflicts = [];
    turn("[LOCATION:" + r.room + "] From the street."); assert.equal(worldState.world.location, T, "from the street too: a world named like a known room is refused (W5 keeps its teeth)"); assert.equal(memory.map.nodes[r.room], undefined);
    /* PARTY_SPLIT */
    sheet = JSON.parse(JSON.stringify(worldState.character)); sheet.name = "Bren"; delete sheet.splitLoc;
    worldState.npcs.push({ name: "Bren", status: "travelling with the party", attitude: "friendly", partyMember: true, charSheet: sheet }); if (!memory.npcs.Bren) memory.npcs.Bren = { events: [], firstSeen: 1 };
    turn("[SUBLOCATION:" + r.a + "] In."); turn("[SUBLOCATION:" + r.room + "] The room.");
    turn("Bren stays to watch the cook. [PARTY_SPLIT:Bren|" + T + "|" + r.room + "][SUBLOCATION:" + r.other + "] You go next door.");
    n = worldState.npcs.filter(function (p) { return p.name === "Bren"; })[0];
    assert.deepEqual([n.charSheet.splitLoc.location, n.charSheet.splitLoc.sublocation], [T, r.a + SEP + r.room], "the split's room is stored resolved, under its building");
    turn("A quiet moment."); turn("[SUBLOCATION:" + r.room + "] Back in, where Bren waits.");
    assert.equal(n.charSheet.splitLoc, undefined, "the party returned to the split's node: folded back (#133b)");
    /* exits */
    turn("[SUBLOCATION:" + r.other + "] Next door."); x = node(T + "|" + r.a + SEP + r.other);
    console.log = function () { }; try { R = applyMuts("A swing door leads to the kitchen. [EXIT:" + r.room + "|a swing door]"); } finally { console.log = realLog; } atlasFollow();
    assert(R.muts.some(function (m) { return /\[EXIT:\] refused/.test(m) && /already a place on record here/.test(m); }), "a door to a room on record here is REFUSED at the filing (never filed, so never resolved by the seam): " + R.muts.join(" | ")); assert(!(x.exits || []).some(function (e) { return e.name === r.room; }));
    turn("A low door you had not noticed. [EXIT:Scullery|a low door]"); assert((x.exits || []).some(function (e) { return e.name === "Scullery"; }), "a door to a room not on record is filed");
    turn("[SUBLOCATION:Scullery] Through the low door.", "I go on"); assert.equal(sub(), r.a + SEP + "Scullery");
    assert(!(x.exits || []).some(function (e) { return e.name === "Scullery"; }), "a room now on record under the building resolves the door by its name");
  });

  test("#693 a named place operand in a tag block that changes building is read where the block began, and the receipt says so", function () {
    var S = start(), T = S.T, r = S.r, ka = T + "|" + r.a + SEP + r.room, kb = T + "|" + r.b + SEP + r.room, R;
    turn("[SUBLOCATION:" + r.b + "] In b."); turn("[SUBLOCATION:" + r.room + "] b's room."); turn("[SUBLOCATION_LEAVE] Out.");
    turn("[SUBLOCATION:" + r.a + "] In a."); turn("[SUBLOCATION:" + r.room + "] a's room.");
    console.log = function () { }; try { R = applyMuts("You leave the ladle on the table and cross town. [LOCATION_ITEM:Ladle|placed|" + r.room + "][SUBLOCATION_LEAVE][SUBLOCATION:" + r.b + "]"); } finally { console.log = realLog; } atlasFollow();
    assert((node(ka).items || []).some(function (it) { return it.name === "Ladle"; }), "the ladle stays in the room the party was in when the block began"); assert(!(node(kb).items || []).some(function (it) { return it.name === "Ladle"; }), "never in the new building's room");
    assert(R.muts.some(function (m) { return /'Ladle'/.test(m) && /read where the block began/.test(m) && m.indexOf(r.a + SEP + r.room) > 0; }), "the receipt says so: " + R.muts.join(" | "));
    assert.equal(sub(), r.b);
    /* the same building: the block's end decides, as #511 says */
    turn("[SUBLOCATION:" + r.a + "] Back."); turn("[SUBLOCATION:" + r.room + "] a's room.");
    turn("You hang the cleaver up and step next door. [LOCATION_ITEM:Cleaver|placed|" + r.room + "][LOCATION_STATE:The window is broken.|" + r.room + "][SUBLOCATION:" + r.other + "]");
    assert((node(ka).items || []).some(function (it) { return it.name === "Cleaver"; })); assert((node(ka).stateNotes || []).some(function (x) { return x.n === "The window is broken."; })); assert.equal(sub(), r.a + SEP + r.other);
  });

  test("#693 the soundscape target and an item filed outside the parser are read at the party's position", function () {
    var S = start(), T = S.T, r = S.r, k = T + "|" + r.a + SEP + r.room, res;
    turn("[SUBLOCATION:" + r.a + "] In."); turn("[SUBLOCATION:" + r.room + "] The room.");
    fileLocationItem("Tin cup", "placed", worldState.turn, r.room, null);
    assert((node(k).items || []).some(function (it) { return it.name === "Tin cup"; }), "a filer called outside the parser reads the live pointer's position");
    res = audioFileCandidates([r.room + "|enclosure=sealed;setting=interior;biome=temperate;quiet=normal;allows=fire;forbid=none"]);
    assert.equal(res.ok, true, "the soundscape names the room by its own name: " + JSON.stringify(res));
  });

  test("#693 without an atlas nothing changes, and under a world the map has not followed the map says nothing", function () {
    var S;
    stubs(); engine.makeTestWorld(); atlasForget();
    turn("[LOCATION:Oakhaven]"); turn("[SUBLOCATION:The Old Ram]"); turn("[SUBLOCATION:Kitchen]"); assert.equal(sub(), "Kitchen"); assert(node("Oakhaven|Kitchen"), "no atlas: the two-level key is untouched");
    assert.deepEqual(resolvePlaceName("Kitchen", "Oakhaven", { sub: "The Old Ram" }), { key: "Oakhaven|Kitchen", via: "exact" });
    assert.equal(resolvePlaceName("Scullery", "Oakhaven", { sub: "The Old Ram" }), null, "no atlas: an unknown room is not qualified");
    turn("[SUBLOCATION:The Old Ram - Kitchen]"); assert.equal(sub(), "The Old Ram - Kitchen", "a dash is just a dash without a map");
    S = start(false);/* adoption off: a world the map does not know stays off it */
    assert.equal(resolvePlaceName("Kitchen", "Nowhere Town", { sub: "The Old Ram" }), null, "a world the map has not followed: nothing");
    turn("[LOCATION:The Salt-Pits] Out of the realm."); turn("[SUBLOCATION:Camp Kitchen] A fire."); assert.equal(sub(), "Camp Kitchen"); turn("[SUBLOCATION:Mess Tent] Another."); assert.equal(sub(), "Mess Tent"); assert(node("The Salt-Pits|Mess Tent"));
    assert.equal(S.A.at, S.c.townId, "the last mapped place stands"); assert(S.A.off && !S.A.off.within);
  });

  test("#693 a world move with a building and its room in one reply: the new town's sheet is drawn for the look, never recorded, and the room is filed under the building", function () {
    var S = start(), A = S.A, c = S.c, p1 = c.p1, town1, inn1, innDoc1, room1, zones, res;
    town1 = TnDMaps.generate("town", TnDMaps.town.fromRegion(c.reg, p1.id)); inn1 = town1.portals.filter(function (p) { return p.to && p.to.generator === "interior"; })[0];
    innDoc1 = TnDMaps.generate("interior", TnDMaps.interior.fromTown(town1, inn1.id)); room1 = innDoc1.rooms.filter(function (rm) { return atlasFind(innDoc1, rm.name) && atlasFind(innDoc1, rm.name).thing; })[0];
    zones = Object.keys(A.zones).slice().sort(); quiet();
    res = resolvePlaceName(room1.name, p1.name, { sub: inn1.name });
    assert.deepEqual(res, { key: p1.name + "|" + inn1.name + SEP + room1.name, via: "atlas" }, "the room is keyed under the building of a town the party has not entered");
    assert.deepEqual(Object.keys(A.zones).slice().sort(), zones, "the look recorded nothing"); assert.equal(reports.length, 0);
    turn("[LOCATION:" + p1.name + "] A day's ride. [SUBLOCATION:" + inn1.name + "] The inn. [SUBLOCATION:" + room1.name + "] Its room.");
    assert.equal(worldState.world.location, p1.name); assert.equal(sub(), inn1.name + SEP + room1.name); assert.equal(A.at, A.seed + "/" + p1.id + "/" + inn1.id); assert.equal(A.spot, room1.id);
  });

  test("#693 a failure while asking the map is reported once and never breaks a turn; two zones of one title under a sheet are refused, never picked", function () {
    var S = start(), T = S.T, r = S.r, A = S.A, c = S.c, real = atlasThings, sewer, title, fake;
    turn("[SUBLOCATION:" + r.a + "] In."); quiet(); atlasThings = function () { throw new Error("the fixture: the sheet cannot be read"); };
    try { assert.doesNotThrow(function () { turn("[SUBLOCATION:" + r.room + "] On."); }); assert.doesNotThrow(function () { turn("[SUBLOCATION:" + r.other + "] On."); }); } finally { atlasThings = real; }
    assert.equal(reports.filter(function (x) { return /asking the map/.test(x); }).length, 1, "the resolver's failure is reported once over two turns (the follow's own failure is its own report): " + JSON.stringify(reports));
    assert.equal(sub(), r.other, "the map had nothing to say: filed as named");
    /* two entered zones titled alike under the town */
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:" + c.grates[0].name + "] Down."); sewer = A.at; title = A.zones[sewer].name;
    fake = c.townId + "/fake"; A.zones[fake] = { kind: "dungeon", parent: c.townId, via: "none", params: null, name: title, lib: null, fp: null, turn: 0 };
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:" + title + "] Into the sewers.");
    assert.equal(sub(), title); assert(A.off && /are called that/.test(A.off.why), "not picked: " + JSON.stringify(A.off)); assert.equal(A.at, c.townId);
    delete A.zones[fake];
  });

  test("#693 a legacy mapped save keeps following: a bare pointer inside a building is found on the sheet the party stands on, and a re-statement mints no node", function () {
    var S = start(), T = S.T, r = S.r, A = S.A, innZone, innDoc, rm, n0;
    turn("[SUBLOCATION:" + r.a + "] In."); innZone = A.at; innDoc = atlasDoc(innZone); rm = atlasFind(innDoc, r.room).thing;
    /* the pre-#693 state by hand: a bare pointer and a bare node, the atlas standing in the room */
    worldState.world.sublocation = r.room; ensureMapNode(T + "|" + r.room, worldState.turn, T); memory.map.nodes[T + "|" + r.room].description = "LEGACY description."; memory.map.nodes[T + "|" + r.room].visits = 3;
    A.at = innZone; A.spot = rm.id; A.off = null; A.ptr = JSON.stringify([T, r.room]);
    assert.equal(atlasHeal(), false, "nothing to heal"); n0 = nodeCount();
    turn("You wait. [SUBLOCATION:" + r.room + "]"); assert.equal(sub(), r.room, "a re-stated legacy pointer stays bare"); assert.equal(nodeCount(), n0); assert(buildGeoBlock().indexOf("LEGACY description") > 0);
    assert.equal(A.at, innZone); assert.equal(A.spot, rm.id, "the map keeps the party's spot");
    A.ptr = null; atlasFollow(); assert.equal(A.at, innZone); assert.equal(A.spot, rm.id, "a bare pointer re-followed is found on the sheet the party stands on, as before");
    turn("[SUBLOCATION:" + r.other + "] Next door."); assert.equal(sub(), r.other, "legacy: a bare room in force puts the party at the town's level, so the next room files bare until the building is re-entered by name");
    assert.equal(A.at, innZone, "and the map still follows it on the sheet the party stands on");
  });

  test("#693 the rule the GM reads is true in every flow: inside a building the room's own name is enough; from the street, the building first", function () {
    start();
    assert(/[Ii]nside a building/.test(ATLAS_BRIEF_RULE) && /room's own name/.test(ATLAS_BRIEF_RULE) && /[Ff]rom the street/.test(ATLAS_BRIEF_RULE) && ATLAS_BRIEF_RULE.indexOf("<building> — <room>") > 0, ATLAS_BRIEF_RULE);
    assert(/\[SUBLOCATION:[^\]]+ — [^\]]+\]/.test(ATLAS_BRIEF_RULE), "the pair form is shown");
    assert(atlasMapBlock().indexOf(ATLAS_BRIEF_RULE) > 0, "the MAP block carries it");
  });

  /* ── the independent review of the second build (2026-11-06): one test per finding ───────────────────────────── */
  test("#693 a one-reply descent lands the party below: a zone named by its title is opened through its way in, and the chambers after it file in that zone", function () {
    var S = start(), T = S.T, A = S.A, c = S.c, g = c.grates[0], sd, title, deep, deep2, sewer, temple, td, stair, cz, cd, ch1, ch2;
    sd = TnDMaps.generate("dungeon", TnDMaps.dungeon.fromTown(c.town, g.id)); title = sd.title.name; deep = deepRoom(sd); deep2 = sd.rooms.filter(function (rm) { return rm.id !== deep.id && !sd.portals.some(function (p) { return p.id === rm.id; }); })[0];
    turn("You lift the grate and drop down. [SUBLOCATION:" + g.name + "][SUBLOCATION:" + deep.name + "][LOCATION_DESC:JUNCTION: four tunnels meet.]");
    assert.equal(sub(), title + SEP + deep.name, "the chamber is keyed under the sewer the grate opens"); sewer = A.at;
    assert.equal(A.zones[sewer] && A.zones[sewer].kind, "dungeon", "the follow opened the sewer through its title: " + JSON.stringify(A.off)); assert.equal(A.spot, deep.id); assert.equal(A.off, null);
    turn("[SUBLOCATION:" + deep2.name + "][LOCATION_DESC:CISTERN: a round brick well.] On."); assert.equal(sub(), title + SEP + deep2.name); assert.equal(A.at, sewer);
    turn("[SUBLOCATION_LEAVE] Up and out."); turn("[SUBLOCATION:" + g.name + "] Down again."); turn("[SUBLOCATION:" + deep2.name + "] Back to the cistern.");
    assert.equal(node(T + "|" + title + SEP + deep2.name).visits, 2, "one chamber, one node"); assert.equal(nodesWith(deep2.name).length, 1); assert(buildGeoBlock().indexOf("round brick well") > 0, "its description is served");
    /* a crypt reached in one breath: temple, stair, chamber */
    temple = c.town.landmarks.filter(function (l) { return l.kind === "temple"; })[0]; td = TnDMaps.generate("interior", TnDMaps.interior.fromTown(c.town, temple.id)); stair = td.portals.filter(function (p) { return p.way === "down"; })[0];
    cd = TnDMaps.generate("dungeon", TnDMaps.dungeon.fromInterior(td, stair.id)); ch1 = deepRoom(cd); ch2 = cd.rooms.filter(function (rm) { return rm.id !== ch1.id && !cd.portals.some(function (p) { return p.id === rm.id; }); })[0];
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:" + temple.name + "][SUBLOCATION:" + stair.name + "][SUBLOCATION:" + ch1.name + "][LOCATION_DESC:HALL: bones underfoot.] Down and in.");
    assert.equal(sub(), temple.name + SEP + cd.title.name + SEP + ch1.name); cz = A.at; assert.equal(A.zones[cz] && A.zones[cz].kind, "dungeon", "the crypt is open: " + JSON.stringify(A.off)); assert.equal(A.spot, ch1.id);
    turn("[SUBLOCATION:" + ch2.name + "] On."); assert.equal(sub(), temple.name + SEP + cd.title.name + SEP + ch2.name); assert.equal(A.at, cz);
    assert.equal(nodesWith(ch1.name).length, 1); assert(buildGeoBlock().indexOf("bones underfoot") < 0 || sub().indexOf(ch1.name) > 0);
    /* the crypt by its title from the nave, never entered in this campaign */
    S = start(); T = S.T; A = S.A; c = S.c;
    turn("[SUBLOCATION:" + temple.name + "] In."); turn("[SUBLOCATION:" + cd.title.name + SEP + ch1.name + "][LOCATION_DESC:HALL from the nave.] Straight down.");
    assert.equal(sub(), temple.name + SEP + cd.title.name + SEP + ch1.name, "the pair names the crypt by its title"); assert.equal(A.zones[A.at].kind, "dungeon", "and the follow opened it through the stair: " + JSON.stringify(A.off)); assert.equal(A.spot, ch1.id);
    assert.equal(node(T + "|" + temple.name + SEP + cd.title.name + SEP + ch1.name).description, "HALL from the nave.", "the description lands on the pointer's node");
  });

  test("#693 a door named as the sub-location is the building itself: the next room files under the building, never town-wide", function () {
    var S = start(), T = S.T, r = S.r, A = S.A, innDoc, door;
    turn("[SUBLOCATION:" + r.a + "] In."); innDoc = atlasDoc(A.at); door = innDoc.portals.filter(function (p) { return p.way === "out"; })[0]; assert(door, "the fixture inn has a door out");
    turn("[SUBLOCATION:" + door.name + "] You slip out by the back."); assert.equal(sub(), r.a, "a way back onto the town's sheet is the building's own node"); assert.equal(A.at, bz(S, r.a)); assert.equal(node(T + "|" + door.name), undefined, "no town-wide door node");
    turn("[SUBLOCATION:" + r.room + "][LOCATION_DESC:FIRST room after the door.] Back in through the kitchen."); assert.equal(sub(), r.a + SEP + r.room);
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:" + r.b + "] In b."); turn("[SUBLOCATION:" + door.name + "] Out by its door."); assert.equal(sub(), r.b);
    turn("[SUBLOCATION:" + r.room + "] Its kitchen."); assert.equal(sub(), r.b + SEP + r.room); assert.equal(node(T + "|" + r.room), undefined, "the review's fusion through a door is closed");
    assert(buildGeoBlock().indexOf("FIRST room after the door") < 0, "no carry-over");
  });

  test("#693 a partial path is read from where the party stands, and every key the resolver writes re-resolves to itself without a position", function () {
    var S = start(), T = S.T, r = S.r, A = S.A, c = S.c, temple, td, stair, cd, ch, keys;
    turn("[SUBLOCATION:" + r.a + "] In."); turn("[SUBLOCATION:" + r.room + "] The room.");
    turn("[SUBLOCATION:" + r.room + SEP + r.other + "][LOCATION_DESC:THE OTHER ROOM: shelves of jars.] Through to the next."); assert.equal(sub(), r.a + SEP + r.other, "the path's first segment is the room the party stood in; the rest is the thing");
    assert.equal(node(currentNodeKey()).description, "THE OTHER ROOM: shelves of jars.", "the pointer and the node agree, so the description lands");
    turn("[LOCATION_ITEM:Jar of honey|placed] Left on a shelf."); assert((node(currentNodeKey()).items || []).some(function (it) { return it.name === "Jar of honey"; }), "a placement at the pointer is not refused");
    turn("[SUBLOCATION:" + r.room + SEP + "Smoke Hole][LOCATION_DESC:A hole in the ceiling.] Up a ladder."); assert.equal(sub(), r.a + SEP + "Smoke Hole", "an unknown place after a known room is filed under the building (the known room is passed through), as [SUBLOCATION:Smoke Hole] alone would file it");
    assert.equal(node(currentNodeKey()).description, "A hole in the ceiling.");
    temple = c.town.landmarks.filter(function (l) { return l.kind === "temple"; })[0]; turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:" + temple.name + "] In."); td = atlasDoc(A.at); stair = td.portals.filter(function (p) { return p.way === "down"; })[0];
    turn("[SUBLOCATION:" + stair.name + "] Down."); cd = atlasDoc(A.at); ch = deepRoom(cd);
    turn("[SUBLOCATION:" + cd.title.name + SEP + ch.name + "][LOCATION_DESC:HALL: bones.] In."); assert.equal(sub(), temple.name + SEP + cd.title.name + SEP + ch.name, "the crypt's title from inside the crypt is the crypt, not a room of it"); assert.equal(node(currentNodeKey()).description, "HALL: bones.");
    keys = Object.keys(memory.map.nodes).filter(function (k) { return k.indexOf(T + "|") === 0; });
    assert(keys.length >= 6, keys.join(" ; "));
    keys.forEach(function (k) { var rp = resolvePlaceName(placeKeyLeaf(k), T); assert(rp && rp.key === k, "re-resolves to itself: " + k + " → " + JSON.stringify(rp)); });
  });

  test("#693 the cave pair: a name that opens with the world place's own name names the rest, so the cave's chamber is one node", function () {
    var S = start(), A = S.A, c = S.c, cave = c.reg.caves[0], cd, ch;
    turn("[LOCATION:" + cave.name + "] Into the hills."); cd = atlasDoc(A.at); assert.equal(A.zones[A.at].kind, "dungeon"); ch = deepRoom(cd);
    turn("[SUBLOCATION:" + ch.name + "][LOCATION_DESC:THE CAVERN: dripping.] In."); assert.equal(sub(), ch.name, "a chamber of the cave that IS the world place is bare");
    turn("[SUBLOCATION:" + cave.name + SEP + ch.name + "] Deeper in the same cavern."); assert.equal(sub(), ch.name, "the pair that opens with the world's own name is the chamber"); assert.equal(node(cave.name + "|" + ch.name).visits, 2); assert.equal(nodesWith(ch.name).length, 1, "no twin");
    assert.equal(node(cave.name + "|" + cave.name + SEP + ch.name), undefined);
  });

  test("#693 a town re-stated twice still carries the building, and the footer pair's item and state operands land in the building's room", function () {
    var S = start(), T = S.T, r = S.r, k = T + "|" + r.a + SEP + r.room, R;
    turn("[SUBLOCATION:" + r.a + "] In.");
    turn("Into the room. [LOCATION:" + T + "][LOCATION:" + T + "][SUBLOCATION:" + r.room + "]"); assert.equal(sub(), r.a + SEP + r.room, "two same-world footers carry the building as one does");
    console.log = function () { }; try { R = applyMuts("You leave the fork and step out. [LOCATION:" + T + "][LOCATION_ITEM:Fork|placed|" + r.room + "][LOCATION_STATE:Dusty.|" + r.room + "]"); } finally { console.log = realLog; } atlasFollow();
    assert((node(k).items || []).some(function (it) { return it.name === "Fork"; }), "the item operand after a same-world footer means the building's room: " + R.muts.join(" | "));
    assert((node(k).stateNotes || []).some(function (x) { return x.n === "Dusty."; }), "and so does the state note's");
    assert.equal(sub(), null, "the footer alone still leaves the party on the street (#511)");
  });

  test("#693 without a map, a named operand in a block that changes world keeps #511's reading to the byte", function () {
    var R;
    stubs(); engine.makeTestWorld(); atlasForget();
    turn("[LOCATION:Marrowgate]"); turn("[SUBLOCATION:Kitchen]"); turn("[LOCATION:Oakhaven]"); turn("[SUBLOCATION:Kitchen]");
    console.log = function () { }; try { R = applyMuts("[LOCATION_ITEM:Letter|placed|Kitchen][LOCATION:Marrowgate]"); } finally { console.log = realLog; }
    assert.deepEqual(R.muts, ["-> Marrowgate", "Left: Letter — at Kitchen"], "the receipts of a campaign without a map are the ones the baseline engine wrote");
    assert((node("Marrowgate|Kitchen").items || []).some(function (it) { return it.name === "Letter"; }), "#511 ②: the block's arrival decides, as before"); assert(!(node("Oakhaven|Kitchen").items || []).length);
  });

  test("#693 the design's claims under mutation: a legit world move from inside a room is not refused, the map's answer comes before a bare ghost, an invented room folds its case, the peek cache is bounded", function () {
    var S = start(), T = S.T, r = S.r, A = S.A, c = S.c, i, inns;
    turn("[SUBLOCATION:" + r.a + "] In."); turn("[SUBLOCATION:" + r.room + "] The room.");
    turn("[LOCATION:" + c.p1.name + "] A day's ride."); assert.equal(worldState.world.location, c.p1.name, "a world move to a map name from inside a room is a move"); assert.equal(sub(), null);
    turn("[LOCATION:" + T + "]"); ensureMapNode(T + "|" + r.room, worldState.turn, T); memory.map.nodes[T + "|" + r.room].description = "GHOST: a town-wide room from before";
    turn("[SUBLOCATION:" + r.a + "] In."); turn("[SUBLOCATION:" + r.room + "] The room."); assert.equal(sub(), r.a + SEP + r.room, "inside the building the map's answer wins over the bare ghost"); assert(buildGeoBlock().indexOf("GHOST") < 0);
    turn("[SUBLOCATION:Back Room] A booth."); turn("[SUBLOCATION:back room] The same booth, in lower case."); assert.equal(sub(), r.a + SEP + "Back Room"); assert.equal(nodesWith("Back Room").length + nodesWith("back room").length, 1, "one node for one invented room, whatever the case");
    inns = [];
    for (i = 1; i < c.reg.places.length && inns.length < ATLAS_PEEK_CAP + 2; i++) { var tn = TnDMaps.generate("town", TnDMaps.town.fromRegion(c.reg, c.reg.places[i].id)), p = tn.portals.filter(function (q) { return q.to && q.to.generator === "interior"; })[0]; if (p) inns.push({ place: c.reg.places[i].name, inn: p.name }); }
    assert(inns.length > ATLAS_PEEK_CAP, "the fixture realm has enough towns to overflow the cache");
    var zonesBefore = Object.keys(A.zones).sort();
    inns.forEach(function (x) { resolvePlaceName("Kitchen", x.place, { sub: x.inn }); });
    assert(Object.keys(_atlasPeeks).length <= ATLAS_PEEK_CAP && _atlasPeekOrder.length <= ATLAS_PEEK_CAP, "the look's cache is bounded: " + Object.keys(_atlasPeeks).length);
    assert.deepEqual(Object.keys(A.zones).sort(), zonesBefore, "and none of the looks recorded a zone");
  });

  /* ── You are here (owner rulings 2026-11-06): a place the GM names that the map does not know is ADDED to the map ──── */
  function adds(A) { return Object.keys(A.adds || {}); }
  function edits(A, zone) { return (A.zones[zone].params && A.zones[zone].params.edits) || []; }

  test("You are here: a world place the story names and the map lacks is added as a village — at the opening beside the capital, later beside the party — and the party stands in it", function () {
    stubs(); engine.makeTestWorld(); atlasForget(); quiet();
    var A = atlasCreate("campaign-1"), reg = atlasDoc(A.seed), cap = reg.places[0], nBefore = reg.places.length, zones0, added, dist, t1, t2;
    point("The Crossroads of Ashenveil"); atlasFollow();
    assert.equal(adds(A).length, 1, "one addition: " + JSON.stringify(A.adds)); assert.equal(edits(A, A.seed).length, 1); assert.equal(edits(A, A.seed)[0].kind, "village"); assert.equal(edits(A, A.seed)[0].name, "The Crossroads of Ashenveil");
    reg = atlasDoc(A.seed); added = reg.places.filter(function (p) { return p.authored; })[0]; assert(added && added.name === "The Crossroads of Ashenveil", "the region sheet bears it");
    dist = Math.sqrt((added.x - cap.x) * (added.x - cap.x) + (added.y - cap.y) * (added.y - cap.y)); assert(dist >= 40 && dist <= 200, "beside the capital, on land: " + dist);
    assert.equal(reg.places.length, nBefore + 1); assert.equal(A.off, null, "the party is on the map"); assert.equal(A.zones[A.at] && A.zones[A.at].kind, "town", "and stands in the added place's own sheet: " + A.at);
    assert(atlasWhere().text.indexOf("The party is in The Crossroads of Ashenveil") === 0, atlasWhere().text);
    assert(atlasToldLines(A).some(function (t) { return /added to the map of .* near " + cap.name|was added to the map/.test(t) && t.indexOf("The Crossroads of Ashenveil") >= 0; }), "the GM is told: " + JSON.stringify(A.told));
    assert(atlasMapBlock().indexOf("was added to the map") > 0, "on the MAP block"); assert(toasts.some(function (t) { return /added/.test(t); }), "and the player sees a toast");
    assert.equal(reg.places.filter(function (p) { return !p.authored; }).length, nBefore, "no generated place moved or was renamed"); assert.equal(reg.places[0].name, cap.name);
    /* the drawing is the campaign's own on purpose: no 'redrawn' notice, the fingerprint re-stamped */
    assert(!A.zones[A.seed].redrawn, "an edit of the game's own is not drift"); assert.equal(A.zones[A.seed].fp, atlasFingerprint(reg)); assert(!toasts.some(function (t) { return /redrawn/.test(t); }), toasts.join(" | "));
    /* later, from inside a town: beside that town */
    zones0 = Object.keys(A.zones).length; quiet();
    point(cap.name); atlasFollow(); point("Bleakford"); atlasFollow();
    assert.equal(adds(A).length, 2); reg = atlasDoc(A.seed); added = reg.places.filter(function (p) { return p.name === "Bleakford"; })[0]; assert(added, "Bleakford is on the region");
    dist = Math.sqrt((added.x - cap.x) * (added.x - cap.x) + (added.y - cap.y) * (added.y - cap.y)); assert(dist >= 40 && dist <= 200, "beside the town the party was in: " + dist);
    assert(A.zones[A.at] && A.zones[A.at].via === added.id, "the party is in Bleakford");
    /* the same name again adds nothing more — even when the map no longer shows the addition (a lost edit): once per story place */
    t1 = edits(A, A.seed).length; point(cap.name); atlasFollow(); point("Bleakford"); atlasFollow(); assert.equal(edits(A, A.seed).length, t1, "one addition per story place");
    assert.equal(adds(A).length, 2);
    A.zones[A.seed].params.edits.forEach(function (e) { if (e.name === "Bleakford") e.name = "Bleakford-that-was"; }); A.zones[A.seed].fp = null; atlasForget(); point(cap.name); atlasFollow(); quiet(); point("Bleakford"); atlasFollow();
    assert.equal(edits(A, A.seed).length, t1, "a story place added once is never added again, even when its name is no longer found"); assert(A.off && /added to the map once already/.test(A.off.why), JSON.stringify(A.off)); assert.equal(adds(A).length, 2);
  });

  test("You are here: the GM says where — near A, between A and B, at A (a tie, refused when the player placed it) — and an unreadable declaration is said and falls back", function () {
    var S = start(), A = S.A, c = S.c, reg = c.reg, p2 = reg.places[2], p3 = reg.places[3], added, mid, dist, R;
    /* near */
    console.log = function () { }; try { R = applyMuts("You ride out to Bleakford. [LOCATION:Bleakford][MAP_PLACE:Bleakford|near " + p2.name + "]"); } finally { console.log = realLog; } atlasFollow();
    assert(R.muts.some(function (m) { return /^Map place: Bleakford/.test(m); }), "the tag is received: " + R.muts.join(" | "));
    reg = atlasDoc(A.seed); added = reg.places.filter(function (p) { return p.name === "Bleakford"; })[0]; assert(added, "added");
    dist = Math.sqrt((added.x - p2.x) * (added.x - p2.x) + (added.y - p2.y) * (added.y - p2.y)); assert(dist >= 40 && dist <= 200, "near " + p2.name + ": " + dist);
    assert(atlasToldLines(A).some(function (t) { return t.indexOf("near " + p2.name) > 0; }), JSON.stringify(A.told)); assert.equal(worldState.placeDecls, undefined, "the declaration was consumed");
    /* between */
    turn("[LOCATION:" + c.p0.name + "]"); quiet();
    turn("A hamlet on the road. [LOCATION:Ashford][MAP_PLACE:Ashford|between " + p2.name + " and " + p3.name + "]");
    reg = atlasDoc(A.seed); added = reg.places.filter(function (p) { return p.name === "Ashford"; })[0]; assert(added, "added");
    mid = [(p2.x + p3.x) / 2, (p2.y + p3.y) / 2]; dist = Math.sqrt((added.x - mid[0]) * (added.x - mid[0]) + (added.y - mid[1]) * (added.y - mid[1])); assert(dist <= 200, "about midway: " + dist);
    /* at: a tie, said */
    turn("[LOCATION:" + c.p0.name + "]"); quiet();
    turn("You reach the old crossing. [LOCATION:The Old Crossing][MAP_PLACE:The Old Crossing|at " + p3.name + "]");
    assert.deepEqual(plain(A.names["The Old Crossing"]), { zone: A.seed, id: p3.id, by: "gm" }, "a tie, as the player's tap would make — marked as the GM's"); assert.equal(A.at, A.seed + "/" + p3.id, "the party is in " + p3.name);
    assert.equal(atlasDoc(A.seed).places.filter(function (p) { return p.name === "The Old Crossing"; }).length, 0, "nothing added"); assert(atlasWhere().text.indexOf("The story's \"The Old Crossing\" is at " + p3.name) > 0, atlasWhere().text);
    /* the player's tap wins over a later declaration */
    turn("[LOCATION:" + c.p0.name + "]"); quiet();
    turn("[LOCATION:The Old Crossing][MAP_PLACE:The Old Crossing|at " + p2.name + "]");
    assert.deepEqual(plain(A.names["The Old Crossing"]), { zone: A.seed, id: p3.id, by: "gm" }, "the tie stands"); assert.equal(A.at, A.seed + "/" + p3.id);
    assert(atlasToldLines(A).some(function (t) { return /You placed The Old Crossing at .* earlier with \[MAP_PLACE:\]; that placing stands and your .*was not applied/.test(t); }), "the GM is told, and that the first placing was its own: " + JSON.stringify(A.told));
    /* unreadable, and a name the map lacks: said, the default stands */
    turn("[LOCATION:" + c.p0.name + "]"); quiet();
    turn("[LOCATION:Thornwick][MAP_PLACE:Thornwick|over the hills]"); assert(atlasDoc(A.seed).places.some(function (p) { return p.name === "Thornwick"; }), "added at the default"); assert(atlasToldLines(A).some(function (t) { return /was not understood/.test(t); }), JSON.stringify(A.told));
    turn("[LOCATION:" + c.p0.name + "]"); quiet();
    turn("[LOCATION:Mirefen][MAP_PLACE:Mirefen|near Nowhere-upon-Nothing]"); assert(atlasDoc(A.seed).places.some(function (p) { return p.name === "Mirefen"; }), "added at the default"); assert.equal(atlasToldLines(A).filter(function (t) { return /named "Nowhere-upon-Nothing", which is no place on this sheet/.test(t); }).length, 1, "said once: " + JSON.stringify(A.told));
    /* "at <the town's own name>" is the GM saying "in this town" (the live run): the default, with no complaint */
    turn("[LOCATION:" + c.p0.name + "]"); turn("[SUBLOCATION:" + c.inn.name + "]"); quiet();
    turn("[SUBLOCATION_LEAVE][SUBLOCATION:Harl's Forge][MAP_PLACE:Harl's Forge|at " + c.p0.name + "] A smithy by the bridge.");
    assert(atlasDoc(c.townId).establishments.some(function (e) { return e.name === "Harl's Forge" && e.kind === "smith"; }), "added beside the party as a smith"); assert(!atlasToldLines(A).some(function (t) { return /was not understood|which is no place/.test(t); }), "no complaint: " + JSON.stringify(A.told)); assert(A.names[S.T + "|Harl's Forge"] === undefined, "and no tie to the town");
  });

  test("You are here: a town-level place takes its kind from its name — a tavern with an interior, a house, a feature of the story's own — and its rooms file under it", function () {
    var S = start(), T = S.T, A = S.A, c = S.c, town, e;
    turn("[SUBLOCATION:The Rat-Catcher's Rest] A low door off the square."); town = atlasDoc(c.townId);
    e = town.establishments.filter(function (x) { return x.name === "The Rat-Catcher's Rest"; })[0]; assert(e && e.kind === "inn" && e.authored, "an inn, from 'Rest': " + JSON.stringify(e && { kind: e.kind }));
    assert.equal(A.zones[A.at].kind, "interior", "the party is inside it"); assert.equal(A.zones[A.at].via, e.id);
    assert.equal(sub(), "The Rat-Catcher's Rest"); assert(atlasWhere().text.indexOf("The party is in The Rat-Catcher's Rest") === 0, atlasWhere().text);
    turn("[SUBLOCATION:Kitchen][LOCATION_DESC:The Rest's kitchen.] Through."); assert.equal(sub(), "The Rat-Catcher's Rest" + SEP + "Kitchen", "its rooms file under it as under any building"); assert.equal(A.zones[A.at].via, e.id);
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:Widow Hale's Cottage] A narrow house."); town = atlasDoc(c.townId);
    e = town.establishments.filter(function (x) { return x.name === "Widow Hale's Cottage"; })[0]; assert(e && e.kind === "custom" && e.word === "house", "a house, from 'Cottage': " + JSON.stringify(e && { kind: e.kind, word: e.word }));
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:The Weeping Stone] A standing stone in the yard."); town = atlasDoc(c.townId);
    e = town.establishments.filter(function (x) { return x.name === "The Weeping Stone"; })[0]; assert(e && e.kind === "custom" && e.word === "place", "a feature of the story's own: " + JSON.stringify(e && { kind: e.kind, word: e.word }));
    assert.equal(adds(A).length, 3); assert.equal(edits(A, c.townId).length, 3);
    assert.equal(town.establishments.filter(function (x) { return !x.authored; }).length, c.town.establishments.length, "nothing the seed drew moved"); assert.deepEqual(town.establishments.filter(function (x) { return !x.authored; }).map(function (x) { return x.name + "@" + x.x + "," + x.y; }), c.town.establishments.map(function (x) { return x.name + "@" + x.x + "," + x.y; }));
    /* an invented room inside a mapped building is drawn on its sheet; two buildings' invented rooms are two rooms */
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:" + c.inn.name + "] In."); turn("[SUBLOCATION:Still Room][LOCATION_DESC:Copper and steam.] Behind the kitchen.");
    assert.equal(sub(), c.inn.name + SEP + "Still Room"); assert.equal(A.at, c.townId + "/" + c.inn.id, "the party is in the inn"); assert(atlasFind(atlasDoc(A.at), "Still Room").thing, "the room is on the inn's sheet"); assert.equal(A.spot, atlasFind(atlasDoc(A.at), "Still Room").thing.id, "and the party stands in it");
    assert.equal(edits(A, c.townId + "/" + c.inn.id).length, 1); assert.equal(edits(A, c.townId + "/" + c.inn.id)[0].kind, "custom");
  });

  test("You are here: a chamber the story names under the ground is dug beside the party; the delta survives the save round trip and redraws identically; the tap puts an addition away", function () {
    var S = start(), T = S.T, A = S.A, c = S.c, sewer, sd, deep, before, blob, back, r;
    turn("[SUBLOCATION:" + c.grates[0].name + "] Down."); sewer = A.at; sd = atlasDoc(sewer); deep = deepRoom(sd);
    turn("[SUBLOCATION:" + deep.name + "] Along."); turn("[SUBLOCATION:The Bone Niche][LOCATION_DESC:Skulls in a row.] A side cut.");
    assert.equal(sub(), sd.title.name + SEP + "The Bone Niche"); assert(atlasFind(atlasDoc(sewer), "The Bone Niche").thing, "dug"); assert.equal(A.at, sewer); assert.equal(A.spot, atlasFind(atlasDoc(sewer), "The Bone Niche").thing.id);
    assert.equal(edits(A, sewer).length, 1); assert.equal(edits(A, sewer)[0].word, "chamber");
    /* persistence */
    before = JSON.stringify(worldState.atlas); blob = serializeWorldState(worldState); back = parseWorldState(blob); worldState = back; migrateWorldState(); atlasForget(); A = worldState.atlas;
    assert.equal(JSON.stringify(worldState.atlas), before, "the store, the delta and the adds survive the save as they were");
    assert(atlasFind(atlasDoc(sewer), "The Bone Niche").thing, "redrawn from the recipe, the chamber is there"); assert.equal(atlasFingerprint(atlasDoc(sewer)), A.zones[sewer].fp, "and it is the drawing the record stamped");
    /* the tap: a story place the engine added, placed by the player somewhere else, is put away */
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:The Gilded Spur] A tavern the story knows."); assert(adds(A).some(function (k) { return k === T + "|The Gilded Spur"; }), JSON.stringify(A.adds));
    assert.equal(A.zones[A.at].via, edits(A, c.townId)[0].id, "the party is inside the added tavern");
    r = atlasPlace(c.townId, { id: c.inn.id }); assert.equal(r.ok, true);
    assert.equal(A.adds[T + "|The Gilded Spur"], undefined, "the addition is gone"); assert.equal(edits(A, c.townId).length, 0); assert.equal(atlasFind(atlasDoc(c.townId), "The Gilded Spur"), null, "and off the sheet"); assert(!Object.keys(A.zones).some(function (z) { return A.zones[z].via && /^s\d+$/.test(A.zones[z].via); }), "the interior opened through it is gone too");
    assert.equal(A.at, c.townId + "/" + c.inn.id, "the party is in the inn the player named"); assert.deepEqual(plain(A.names[T + "|The Gilded Spur"]), { zone: c.townId, id: c.inn.id });
  });

  test("You are here: the switch and the contract — a campaign with adoption off keeps every name off the map with its reason; a twice-borne name is never added; the tag is parsed, stripped and taught only by the MAP block; no atlas drops it", function () {
    var S = start(false), A = S.A, c = S.c, n, twice, R;
    turn("[LOCATION:Nowhere Town]"); assert.equal(adds(A).length, 0); assert(A.off && A.off.absent === true && !A.off.within, JSON.stringify(A.off));
    S = start(); A = S.A; c = S.c; turn("[SUBLOCATION:" + c.inn.name + "] In."); n = atlasDoc(A.at).rooms;
    twice = n.filter(function (rm) { return n.filter(function (q) { return atlasNameKey(q.name) === atlasNameKey(rm.name); }).length > 1; })[0]; assert(twice, "the fixture inn has a twice-borne room name");
    turn("[SUBLOCATION:" + twice.name + "] Along."); assert.equal(adds(A).length, 0, "a name two things bear is a refusal, never an addition"); assert(A.off && /are called that/.test(A.off.why) && !A.off.absent, JSON.stringify(A.off));
    turn("[LOCATION:" + c.inn.name + "]"); turn("[SUBLOCATION:" + twice.name + "] Along, with the inn as the world place."); assert.equal(adds(A).length, 0, "a bare twice-borne name on the world place's own sheet is a refusal too"); assert(A.off && /are called that/.test(A.off.why) && !A.off.absent, JSON.stringify(A.off));
    assert.equal(cleanTxt("A [MAP_PLACE:Bleakford|near Great Brem] B"), "A  B", "stripped from prose"); assert.equal(buildStateTagsDoc().indexOf("[MAP_PLACE:"), -1, "not in the standing doc"); assert(TAG_DOC_ENGINE_ONLY.indexOf("MAP_PLACE") >= 0);
    assert(ATLAS_BRIEF_RULE.indexOf("[MAP_PLACE:<its name>|near <map name>]") > 0 && ATLAS_BRIEF_RULE.indexOf("is ADDED to the map beside the party") > 0, "taught by the MAP block: " + ATLAS_BRIEF_RULE);
    assert(!/atlas(?:Follow|Doc|Adopt|KnowledgeCommit|PublicEnable)\s*\(/.test(src("tag_table.js")), "the parser never draws or publishes map state");
    stubs(); engine.makeTestWorld(); atlasForget();
    console.log = function () { }; try { R = applyMuts("[LOCATION:Oakhaven][MAP_PLACE:Oakhaven|near Marrowgate]"); } finally { console.log = realLog; } atlasFollow();
    assert(R.muts.some(function (m) { return /^Map place: Oakhaven/.test(m); })); assert.equal(worldState.placeDecls, undefined, "without an atlas the declaration is dropped by the follow"); assert.equal(worldState.atlas, undefined);
  });

  /* ── the second independent review of #702 (2026-11-06, audits/AUDIT_2026-11-06_702_review.md): one group per finding,
     each through real commits, and one for the mutants of the new code that the suite had let live ───────────────────── */
  function dist(a, b) { var x = (a.x != null ? a.x : a[0]) - (b.x != null ? b.x : b[0]), y = (a.y != null ? a.y : a[1]) - (b.y != null ? b.y : b[1]); return Math.sqrt(x * x + y * y); }

  test("#702 review: an added town-level thing bearing a room's name leaves every inn's room of that name under its inn (finding 1): the deepest sheet answers before the town's", function () {
    var S = start(), T = S.T, r = S.r, A = S.A, c = S.c, g, sewerName;
    turn("[SUBLOCATION:" + r.room + "][LOCATION_DESC:A STREET PLACE.] A stall of that name on the square.");
    assert.equal(sub(), r.room, "from the street: town-wide (the accepted limit), and added"); assert(adds(A).indexOf(T + "|" + r.room) >= 0, JSON.stringify(A.adds)); assert(atlasFind(atlasDoc(c.townId), r.room).thing, "on the town's sheet");
    turn("[SUBLOCATION:" + r.a + "] In."); turn("[SUBLOCATION:" + r.room + "][LOCATION_DESC:A's ROOM.] The room.");
    assert.equal(sub(), r.a + SEP + r.room, "inside the inn the name is the inn's room, never the street's thing");
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:" + r.b + "] In."); turn("[SUBLOCATION:" + r.room + "][LOCATION_DESC:B's ROOM.] The room.");
    assert.equal(sub(), r.b + SEP + r.room);
    assert.equal(node(T + "|" + r.room).description, "A STREET PLACE."); assert.equal(node(T + "|" + r.a + SEP + r.room).description, "A's ROOM."); assert.equal(node(T + "|" + r.b + SEP + r.room).description, "B's ROOM.");
    g = buildGeoBlock(); assert(g.indexOf("B's ROOM") > 0 && g.indexOf("A STREET PLACE") < 0 && g.indexOf("A's ROOM") < 0, "the GM reads B's room only: " + g.slice(0, 300));
    assert.equal(adds(A).length, 1, "no further addition: " + JSON.stringify(A.adds));
    /* a way back onto the town's sheet is still the town's thing: the grate re-stated from the landing is the grate's own node */
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:" + c.grates[0].name + "] Down."); sewerName = sub(); assert.equal(sewerName, c.grates[0].name);
    turn("[SUBLOCATION:" + c.grates[0].name + "] On the landing."); assert.equal(sub(), c.grates[0].name, "the way in and the landing beneath it are one node");
  });

  test("#702 review: a building and its room invented in ONE reply land as a building and its room (finding 1, flow 2; finding 5, the pair): each under its own key, and the tap on the pair puts the room away", function () {
    var S = start(), T = S.T, A = S.A, c = S.c, spur, room, r2;
    turn("[SUBLOCATION:The Gilded Spur][SUBLOCATION:Kitchen][LOCATION_DESC:THE SPUR'S KITCHEN.] Through the door and into the back.");
    assert.equal(sub(), "The Gilded Spur" + SEP + "Kitchen", "the room is filed under the invented building");
    spur = atlasFind(atlasDoc(c.townId), "The Gilded Spur"); assert(spur && spur.thing && atlasDoc(c.townId).establishments.some(function (x) { return x.id === spur.thing.id && x.authored; }), "the building was added to the town: " + JSON.stringify(A.off)); assert.equal(atlasFind(atlasDoc(c.townId), "Kitchen"), null, "the room was not added as a town-level place");
    assert(A.zones[A.at] && A.zones[A.at].via === spur.thing.id, "the party is inside the Spur: " + A.at); room = atlasFind(atlasDoc(A.at), "Kitchen"); assert(room && room.thing, "and its kitchen is drawn on the Spur's sheet"); assert.equal(A.spot, room.thing.id);
    assert(adds(A).indexOf(T + "|The Gilded Spur") >= 0, "the building under its own key: " + JSON.stringify(A.adds)); assert.equal(adds(A).indexOf(T + "|The Gilded Spur" + SEP + "Kitchen") >= 0, !!atlasDoc(A.at).rooms.filter(function (x) { return x.id === room.thing.id; })[0].authored, "the room under its own key when the house had none: " + JSON.stringify(A.adds));
    assert.equal(node(T + "|Kitchen"), undefined, "no town-wide Kitchen");
    /* a re-statement of the invented building inside it is the building, not a room of itself */
    turn("[SUBLOCATION:The Gilded Spur] Back to the door."); assert.equal(sub(), "The Gilded Spur"); assert(adds(A).length <= 2, JSON.stringify(A.adds));
    /* the real inn's kitchen afterwards is the inn's */
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:" + c.inn.name + "] In."); turn("[SUBLOCATION:Kitchen][LOCATION_DESC:THE INN'S KITCHEN.] Warm.");
    assert.equal(sub(), c.inn.name + SEP + "Kitchen"); assert(buildGeoBlock().indexOf("THE SPUR'S KITCHEN") < 0, "the inn's kitchen never reads the Spur's");
    /* the pair form with a new building: the inn under its own key, the room under its own */
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:The Rat-Catcher's Rest" + SEP + "Snug] A low door, then the snug.");
    assert.equal(sub(), "The Rat-Catcher's Rest" + SEP + "Snug"); assert(adds(A).indexOf(T + "|The Rat-Catcher's Rest") >= 0 && adds(A).indexOf(T + "|The Rat-Catcher's Rest" + SEP + "Snug") >= 0, JSON.stringify(A.adds));
    assert.equal(A.off, null, "the party is in the snug: " + JSON.stringify(A.off)); assert(atlasFind(atlasDoc(A.at), "Snug").thing);
    r2 = atlasPlace(c.townId, { id: c.inn.id }); assert.equal(r2.ok, true, JSON.stringify(r2));
    assert.equal(A.adds[T + "|The Rat-Catcher's Rest" + SEP + "Snug"], undefined, "the room's addition is put away"); assert(A.adds[T + "|The Rat-Catcher's Rest"], "the building stays"); assert(atlasFind(atlasDoc(c.townId), "The Rat-Catcher's Rest").thing, "on the sheet");
    assert.equal(A.at, c.townId + "/" + c.inn.id, "the party is in the inn the tap named");
  });

  test("#702 review: an addition never displaces what the map had (finding 2): a drawing that loses a thing is rolled back and refused, the temple keeps its crypt stair", function () {
    var S = start(), T = S.T, A = S.A, c = S.c, temple, tz, td, down, cz, hall, before, after, real, cut;
    temple = c.town.landmarks.filter(function (l) { return l.kind === "temple"; })[0]; assert(temple, "the fixture capital has a temple");
    turn("[SUBLOCATION:" + temple.name + "] In."); tz = A.at; td = atlasDoc(tz); down = td.portals.filter(function (p) { return p.way === "down"; })[0]; assert(down, "a way down");
    turn("[SUBLOCATION:" + down.name + "] Down."); cz = A.at; assert.notEqual(cz, tz); hall = deepRoom(atlasDoc(cz)); turn("[SUBLOCATION:" + hall.name + "][LOCATION_DESC:HALL OF BONES.] Bones.");
    turn("[SUBLOCATION:" + temple.name + "] Up."); assert.equal(A.at, tz); quiet();
    before = atlasThings(td).map(function (t) { return t.id + ":" + t.name; }).sort();
    turn("[SUBLOCATION:The Reliquary] A side chapel.");
    after = atlasThings(atlasDoc(tz)).map(function (t) { return t.id + ":" + t.name; });
    before.forEach(function (k) { assert(after.indexOf(k) >= 0, "the temple lost " + k); });
    assert.equal(sub(), temple.name + SEP + "The Reliquary", "filed under the temple either way");
    if (A.off) { assert(/displaced/.test(A.off.why), "refused for the displacement, in words: " + JSON.stringify(A.off)); assert(toasts.some(function (t) { return /could not be added/.test(t); }), "and the player is told: " + JSON.stringify(toasts)); }
    assert(atlasFind(atlasDoc(tz), down.name).thing && atlasFind(atlasDoc(tz), down.name).thing.portal, "the way down stands"); assert.doesNotThrow(function () { atlasDoc(cz); }, "the crypt still draws");
    turn("[SUBLOCATION:" + down.name + "] Down again."); assert.equal(A.at, cz); turn("[SUBLOCATION:" + hall.name + "] The hall."); assert.equal(sub(), temple.name + SEP + atlasDoc(cz).title.name + SEP + hall.name); assert(buildGeoBlock().indexOf("HALL OF BONES") > 0, "the same hall, with its memory");
    /* the guard itself, forced: a library that drops the stair for an edit is refused and rolled back */
    turn("[SUBLOCATION:" + temple.name + "] Up."); quiet(); real = TnDMaps.generate; cut = JSON.stringify(edits(A, tz));
    TnDMaps.generate = function (kind, params) { var d = real.apply(this, arguments); if (kind === "interior" && params && params.edits && params.edits.some(function (e) { return e.name === "Forced Room"; })) d.portals = d.portals.filter(function (p) { return p.way !== "down"; }); return d; };
    try { turn("[SUBLOCATION:Forced Room] A nook."); } finally { TnDMaps.generate = real; }
    assert(A.off && A.off.why.indexOf("displaced " + down.name) > 0, JSON.stringify(A.off)); assert.equal(JSON.stringify(edits(A, tz)), cut, "rolled back"); assert.equal(sub(), temple.name + SEP + "Forced Room", "filed within");
    assert.equal(atlasLost(td, JSON.parse(JSON.stringify(td))), null); assert.equal(atlasLost(td, (function () { var d = JSON.parse(JSON.stringify(td)); d.portals = d.portals.filter(function (p) { return p.id !== down.id; }); return d; })()), down.name, "a way that is gone is a loss, though its room stands");
    assert.equal(atlasLost(td, (function () { var d = JSON.parse(JSON.stringify(td)); d.rooms = d.rooms.filter(function (x) { return x.id !== down.id; }); d.portals = d.portals.filter(function (p) { return p.id !== down.id; }); return d; })()), down.name, "a thing that is gone is a loss");
    assert.equal(atlasLost(td, (function () { var d = JSON.parse(JSON.stringify(td)); var plainRoom = d.rooms.filter(function (x) { return !d.portals.some(function (p) { return p.id === x.id; }); })[0]; plainRoom.name = "Renamed"; return d; })()), td.rooms.filter(function (x) { return !td.portals.some(function (p) { return p.id === x.id; }); })[0].name, "a thing renamed is a loss");
  });

  test("#702 review: an undeclared world addition lands beside the party's LAST mapped place, never the capital from afar (finding 3)", function () {
    var S = start(), A = S.A, c = S.c, cap = c.p0, far, added;
    far = c.reg.places.slice(1).sort(function (a, b) { return dist(b, cap) - dist(a, cap); })[0]; assert(dist(far, cap) > 400, "fixture: a settlement far from the capital: " + dist(far, cap));
    turn("[LOCATION:" + far.name + "] A long road."); assert.equal(A.at, A.seed + "/" + far.id);
    turn("[LOCATION:Bleakford] A hamlet nearby."); added = atlasDoc(A.seed).places.filter(function (p) { return p.name === "Bleakford"; })[0]; assert(added, "added");
    assert(dist(added, far) <= 200, "beside " + far.name + ": " + dist(added, far)); assert(dist(added, cap) > dist(added, far), "nearer the party's last place than the capital: " + dist(added, cap));
    assert(atlasToldLines(A).some(function (t) { return t.indexOf("beside the party's last mapped place") > 0; }), JSON.stringify(A.told));
  });

  test("#702 review: the tap on the very thing the engine added for a name places nothing (finding 4); a tie onto an addition keeps it, index and all (finding 15)", function () {
    var S = start(), T = S.T, A = S.A, c = S.c, s1, r, other;
    turn("[SUBLOCATION:Harl's Forge] A smithy."); s1 = atlasFind(atlasDoc(c.townId), "Harl's Forge").thing.id; assert.equal(A.zones[A.at].via, s1);
    r = atlasPlace(c.townId, { id: s1 }); assert.equal(r.ok, false); assert(/already on the map there/.test(r.reason), r.reason);
    assert(A.adds[T + "|Harl's Forge"], "the addition stays"); assert.equal(A.names[T + "|Harl's Forge"], undefined, "no tie"); assert(atlasFind(atlasDoc(c.townId), "Harl's Forge").thing, "on the sheet");
    atlasFollow(); assert.equal(A.off, null); assert.equal(A.zones[A.at].via, s1, "the party is still inside it");
    /* another story name the player ties to the addition keeps it when the addition's own name is placed elsewhere */
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:" + c.inn.name + "] In."); r = atlasPlace(c.townId, { id: s1 }); assert.equal(r.ok, true, "the inn's story name tied to the forge (the player's call): " + JSON.stringify(r));
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:Harl's Forge] Back."); assert.equal(A.zones[A.at].via, s1);
    other = atlasDoc(c.townId).establishments.filter(function (e) { return !e.authored; })[0];
    r = atlasPlace(c.townId, { id: other.id }); assert.equal(r.ok, true);
    assert(A.adds[T + "|Harl's Forge"], "the addition stays: a tie points at it"); assert(atlasFind(atlasDoc(c.townId), "Harl's Forge").thing); assert.deepEqual(plain(A.names[T + "|" + c.inn.name]), { zone: c.townId, id: s1 }, "that tie points at a thing that is there");
    assert.deepEqual(plain(A.names[T + "|Harl's Forge"]), { zone: c.townId, id: other.id }); assert.equal(A.at, c.townId + "/" + other.id);
  });

  test("#702 review: a tap that moves an added village takes the additions inside it along, so the next naming is not refused (finding 6)", function () {
    var S = start(), A = S.A, c = S.c, p1 = c.reg.places[1], vz, r;
    turn("[LOCATION:Bleakford] A hamlet."); assert(A.adds["Bleakford"]); vz = A.at;
    turn("[SUBLOCATION:Harl's Forge] A smithy."); assert(A.adds["Bleakford|Harl's Forge"], JSON.stringify(A.adds));
    turn("[SUBLOCATION_LEAVE]"); r = atlasPlace(A.seed, { id: p1.id }); assert.equal(r.ok, true, "Bleakford is placed on " + p1.name + ": " + JSON.stringify(r)); assert.equal(r.level, "world");
    assert.equal(A.adds["Bleakford"], undefined); assert.equal(A.adds["Bleakford|Harl's Forge"], undefined, "the forge's index went with its sheet"); assert.equal(A.zones[vz], undefined);
    turn("[SUBLOCATION:Harl's Forge] The smithy here."); assert(A.adds["Bleakford|Harl's Forge"], "named again in the Bleakford the player placed, it is added there: " + JSON.stringify(A.off)); assert.equal(A.adds["Bleakford|Harl's Forge"].zone, A.seed + "/" + p1.id);
  });

  test("#702 review: the told lines are true (finding 7) and ride ONE prompt (finding 8)", function () {
    var S = start(), T = S.T, A = S.A, c = S.c, r = S.r, p2 = c.reg.places[2], p3 = c.reg.places[3], inn, other, B, cap;
    /* (a) a declaration naming the room the party went to — by its own name, though the key carries the building */
    turn("[SUBLOCATION:" + r.a + "] In."); quiet(); inn = atlasDoc(A.at); other = inn.rooms.filter(function (x) { return x.name !== r.room; })[0];
    turn("[SUBLOCATION:" + r.room + "][MAP_PLACE:" + r.room + "|near " + other.name + "] Through.");
    assert(!atlasToldLines(A).some(function (t) { return /does not name where the party stands|names no place/.test(t); }), "the room IS where the party went: " + JSON.stringify(A.told));
    assert(atlasToldLines(A).some(function (t) { return /is on the map under its own name/.test(t); }), "a mapped room needs no placing: " + JSON.stringify(A.told));
    /* (b) a GM tie is said as the GM's — on the where-line, on the MAP block, and when it is declared again */
    turn("[LOCATION:" + c.p0.name + "]"); turn("[LOCATION:The Old Crossing][MAP_PLACE:The Old Crossing|at " + p3.name + "]");
    assert(atlasWhere().text.indexOf("is at " + p3.name + " on this map: the GM placed it there.") > 0, atlasWhere().text); assert(atlasMapBlock().indexOf("the GM placed it there") > 0, "on the block");
    turn("[LOCATION:" + c.p0.name + "]"); turn("[LOCATION:The Old Crossing][MAP_PLACE:The Old Crossing|at " + p2.name + "]");
    assert(atlasToldLines(A).some(function (t) { return /You placed The Old Crossing at .* earlier with \[MAP_PLACE:\]/.test(t); }), JSON.stringify(A.told)); assert.equal(A.at, A.seed + "/" + p3.id, "the first placing stands");
    /* (c) at the opening an unreadable declaration says where the place went: near the capital, never "beside the party" */
    stubs(); engine.makeTestWorld(); atlasForget(); quiet(); B = atlasCreate("campaign-1"); cap = atlasDoc(B.seed).places[0];
    point("The Crossroads of Ashenveil"); worldState.placeDecls = [{ name: "The Crossroads of Ashenveil", where: "over the hills", turn: worldState.turn }]; atlasFollow();/* stamped as the handler stamps it: another turn's declaration is set aside (review 3, finding 4) */
    assert(atlasToldLines(B).some(function (t) { return /was not understood/.test(t) && t.indexOf("was put near " + cap.name) > 0; }), JSON.stringify(B.told)); assert(!atlasToldLines(B).some(function (t) { return /beside the party/.test(t); }), JSON.stringify(B.told));
    /* (d) a declaration for a place the reply passed through is said for what it is */
    S = start(); A = S.A; c = S.c; turn("[LOCATION:Bleakford][MAP_PLACE:Bleakford|near " + c.reg.places[2].name + "][LOCATION:" + c.reg.places[1].name + "] On through Bleakford.");
    assert(atlasToldLines(A).some(function (t) { return /does not name where the party stands at the end of this reply/.test(t); }), JSON.stringify(A.told));
    /* (e) one prompt: stamped at the turn's follow, shown on the next prompt and no other */
    S = start(); A = S.A; turn("[SUBLOCATION:Harl's Forge] A smithy."); assert.equal(atlasToldLines(A).length, 1, JSON.stringify(A.told)); assert.equal(A.told[A.told.length - 1].turn, worldState.turn); assert(atlasMapBlock().indexOf("was added to the map") > 0);
    turn("The smith looks up."); assert.equal(atlasToldLines(A).length, 0, "gone after the next turn"); assert.equal(atlasMapBlock().indexOf("was added to the map"), -1);
  });

  test("#702 review: a refusal is said to the player with the real reason (finding 9); a name the map bears at another scale is not added again (finding 11); a refused add leaves the recipe as it was (finding 14)", function () {
    var S = start(), A = S.A, c = S.c, long = "The Monastery of Saint Oswin upon the Grey Water", rec, p0;
    assert(long.length > 40, "fixture: over the library's cap"); quiet(); rec = A.zones[c.townId]; p0 = rec.params;
    turn("[SUBLOCATION:" + long + "] A long name.");
    assert(A.off && /40 characters/.test(A.off.why), "the real reason, the library's own: " + JSON.stringify(A.off)); assert(toasts.some(function (t) { return /could not be added/.test(t) && /40 characters/.test(t); }), "the player sees why: " + JSON.stringify(toasts));
    assert.equal(adds(A).length, 0); assert.strictEqual(rec.params, p0, "params as they were (null stays null, no {} left behind)"); assert.equal(sub(), long, "the node is filed, within the town");
    /* a settlement's name from inside a town is not added as a town-level place */
    quiet(); turn("[SUBLOCATION:" + c.reg.places[2].name + "] A house by that name."); assert.equal(adds(A).length, 0); assert(A.off && /a settlement of/.test(A.off.why), JSON.stringify(A.off)); assert(toasts.some(function (t) { return /could not be added/.test(t); }));
    /* the town's own name as a sub-location is the town; the village's own name inside the village is the village */
    quiet(); turn("[SUBLOCATION:" + c.p0.name + "] In the square."); assert.equal(adds(A).length, 0); assert.equal(A.at, c.townId);
    turn("[LOCATION:Bleakford] Out to the hamlet."); assert.equal(adds(A).length, 1); turn("[SUBLOCATION:Bleakford] In the village square."); assert.equal(adds(A).length, 1, "nothing added for the village's own name: " + JSON.stringify(A.adds)); assert.equal(adds(A)[0], "Bleakford");
  });

  test("#702 review: the mutants the suite let live (finding 10) — the cap of three, between, a consumed declaration, a mapped declaration, the removal re-stamp, the region's points, the rollback, the catch, the floor, the chamber, the told ring, the title peek, the fold, the carry, no accumulation", function () {
    var S = start(), T = S.T, A = S.A, c = S.c, r = S.r, p2, p3, added, mid, dm, rd, sea, pts, real, ed0, fp0, rooms, up, lin, sewer, sd, deep, ch, i, drew, realI, n, tl;
    /* #1 the cap: a path of four unknown segments keys as the building and its last room (review 3, finding 1: a key never carries a room in the middle), two additions and the party on the map; the guard of three is proven on an adoption that never stands the party */
    turn("[SUBLOCATION:The Gilded Spur Inn" + SEP + "Back Hall" + SEP + "Cellar Stair" + SEP + "Wine Vault] Down and down.");
    assert.equal(sub(), "The Gilded Spur Inn" + SEP + "Wine Vault", "the inn and the room the party is in"); assert.equal(adds(A).length, 2, JSON.stringify(A.adds)); assert.equal(A.off, null, JSON.stringify(A.off));
    (function () { var real = atlasAdopt, calls = 0; atlasAdopt = function () { calls++; return true; }; try { turn("[SUBLOCATION_LEAVE][SUBLOCATION:Nowhere Lane] A lane."); } finally { atlasAdopt = real; } assert.equal(calls, 3, "three attempts and the follow stops: " + calls); assert(A.off && A.off.absent && A.off.segment === "Nowhere Lane", JSON.stringify(A.off)); })();
    /* #3 between is read: the point lies about midway */
    S = start(); A = S.A; c = S.c; (function () { var ps = c.reg.places.slice(1), best = 0, i, j, m; for (i = 0; i < ps.length; i++) for (j = i + 1; j < ps.length; j++) { m = [(ps[i].x + ps[j].x) / 2, (ps[i].y + ps[j].y) / 2]; if (dist(ps[i], ps[j]) >= 200 && dist(m, c.p0) > best) { best = dist(m, c.p0); p2 = ps[i]; p3 = ps[j]; } } })();
    mid = [(p2.x + p3.x) / 2, (p2.y + p3.y) / 2]; assert(dist(mid, c.p0) >= 250, "fixture: a pair whose midpoint is away from the capital: " + dist(mid, c.p0));
    turn("[LOCATION:Ashford][MAP_PLACE:Ashford|between " + p2.name + " and " + p3.name + "]"); added = atlasDoc(A.seed).places.filter(function (p) { return p.name === "Ashford"; })[0]; dm = dist(added, mid);
    assert(dm <= 180 && dm < dist(added, c.p0), "about midway, not beside the party: " + dm + " / " + dist(added, c.p0));
    /* #4 a consumed declaration is not answered twice; #6 a declaration for a mapped place is answered */
    S = start(); A = S.A; c = S.c; turn("[LOCATION:Bleakford][MAP_PLACE:Bleakford|near " + c.reg.places[2].name + "]");
    assert.equal(atlasToldLines(A).filter(function (t) { return /Bleakford/.test(t); }).length, 1, "one line for the addition, none answering the consumed declaration: " + JSON.stringify(A.told));
    turn("[LOCATION:" + c.reg.places[1].name + "][MAP_PLACE:" + c.reg.places[1].name + "|near " + c.reg.places[2].name + "]");
    assert(atlasToldLines(A).some(function (t) { return t.indexOf(c.reg.places[1].name + " is on the map under its own name") === 0; }), JSON.stringify(A.told));
    /* #9 a removal re-stamps: the next drawing is the campaign's own, not drift */
    S = start(); T = S.T; A = S.A; c = S.c; turn("[SUBLOCATION:The Gilded Spur] A tavern."); atlasPlace(c.townId, { id: c.inn.id }); atlasForget(); atlasDoc(c.townId); atlasFollow(); point(c.p0.name, c.market.name); atlasFollow();
    assert(!A.zones[c.townId].redrawn, "the removal is not drift"); assert.equal(A.zones[c.townId].fp, atlasFingerprint(atlasDoc(c.townId)));
    /* #11, #12 the region's points: never within the frame's margin (the library refuses those itself; the filter spares the calls), never in the water */
    rd = atlasDoc(A.seed); sea = rd.features.filter(function (f) { return f.kind === "sea"; })[0];
    (function () { var edge = rd.places.slice().sort(function (a, b) { return Math.min(a.x, a.y) - Math.min(b.x, b.y); })[0]; assert(Math.min(edge.x, edge.y) - 50 < 40, "fixture: a settlement within 90 px of the frame's edge: " + edge.name);
      pts = atlasRegionPoints(rd, [edge.x, edge.y]); assert(pts.length, "points beside " + edge.name); pts.forEach(function (q) { assert(q[0] >= 40 && q[1] >= 40 && q[0] <= rd.frame.width - 40 && q[1] <= rd.frame.height - 40, "inside the margin: " + q); }); })();
    assert(sea, "fixture: the realm has a sea"); pts = atlasRegionPoints(rd, [sea.x, sea.y]); pts.forEach(function (q) { assert.doesNotThrow(function () { TnDMaps.wild.fromRegion(rd, q); }, "on land: " + q); });
    /* #14 the rollback: a library that refuses leaves the recipe as it was; #17 a failure inside the add never breaks the turn */
    S = start(); T = S.T; A = S.A; c = S.c; real = TnDMaps.generate; ed0 = JSON.stringify(edits(A, c.townId)); fp0 = A.zones[c.townId].fp;
    TnDMaps.generate = function (kind, params) { if (params && params.edits && params.edits.some(function (e) { return e.name === "Nowhere House"; })) throw new Error("TnDMaps: edits[0]: at lies on another place"); return real.apply(this, arguments); };
    try { turn("[SUBLOCATION:Nowhere House] A door."); } finally { TnDMaps.generate = real; }
    assert.equal(JSON.stringify(edits(A, c.townId)), ed0, "the refused edit is not left in the recipe"); assert.equal(A.zones[c.townId].fp, fp0, "the fingerprint as it was"); assert(A.off && /another place/.test(A.off.why), JSON.stringify(A.off)); assert.equal(sub(), "Nowhere House", "the node is filed, within the town");
    TnDMaps.generate = function (kind, params) { if (params && params.edits && params.edits.some(function (e) { return e.name === "Boom House"; })) throw new Error("boom: not a refusal"); return real.apply(this, arguments); };
    quiet(); try { turn("[SUBLOCATION:Boom House] A door."); } finally { TnDMaps.generate = real; }
    assert.equal(sub(), "Boom House", "the turn committed"); assert(A.off && /adding it to the map failed/.test(A.off.why), JSON.stringify(A.off)); assert.equal(JSON.stringify(edits(A, c.townId)), ed0); assert.equal(reports.length, 1, "reported once: " + JSON.stringify(reports));
    /* #15 a room is added on the party's floor */
    S = start(); A = S.A; c = S.c; (function () { var ps = c.town.portals.filter(function (p) { return p.to && p.to.generator === "interior"; }), k, d; for (k = 0; k < ps.length && !up; k++) { d = TnDMaps.generate("interior", TnDMaps.interior.fromTown(c.town, ps[k].id)); rooms = d.rooms; up = rooms.filter(function (x) { return typeof x.floor === "number" && x.floor > 0 && rooms.filter(function (y) { return atlasNameKey(y.name) === atlasNameKey(x.name); }).length === 1; })[0]; if (up) up.building = ps[k].name; } })(); assert(up, "fixture: a building with an upper-floor room of its own name");
    turn("[SUBLOCATION:" + up.building + "] In."); turn("[SUBLOCATION:" + up.name + "] Upstairs."); assert.equal(A.spot, up.id); turn("[SUBLOCATION:The Linen Press] A cupboard of a room."); lin = atlasFind(atlasDoc(A.at), "The Linen Press").thing; assert(lin, "added: " + JSON.stringify(A.off)); (function () { /* the floor is a preference the library may refuse: when a room of that size fits on the party's floor, it goes there */
      var z = A.at, rec = A.zones[z], placed = atlasDoc(z).rooms.filter(function (x) { return x.id === lin.id; })[0].floor, mine = edits(A, z).filter(function (e) { return e.name === "The Linen Press"; })[0], keep = rec.params.edits, can;
      var base, forced; rec.params.edits = keep.filter(function (e) { return e !== mine; }); rec.fp = null; atlasForget(); base = atlasDoc(z);
      rec.params.edits = keep.filter(function (e) { return e !== mine; }).concat([Object.assign({}, mine, { floor: up.floor, m2: 8 })]); rec.fp = null; atlasForget();
      try { forced = atlasDoc(z); can = forced.rooms.some(function (x) { return x.name === "The Linen Press" && x.floor === up.floor; }) && atlasLost(base, forced) === null; } finally { rec.params.edits = keep; rec.fp = null; atlasForget(); }
      if (can) assert.equal(placed, up.floor, "on the party's floor, which had room for it"); else assert.notEqual(placed, undefined, "placed on a floor that had room"); })();
    /* #16 a chamber is dug beside the party */
    S = start(); A = S.A; c = S.c; turn("[SUBLOCATION:" + c.grates[0].name + "] Down."); sewer = A.at; sd = atlasDoc(sewer); deep = deepRoom(sd); turn("[SUBLOCATION:" + deep.name + "] Along.");
    turn("[SUBLOCATION:The Bone Niche] A side cut."); ch = atlasFind(atlasDoc(sewer), "The Bone Niche").thing; assert(ch, JSON.stringify(A.off)); assert(dist(ch, deep) <= 80, "beside the party's chamber: " + dist(ch, deep));
    /* #20 the told ring is bounded */
    S = start(); A = S.A; for (i = 0; i < 6; i++) { turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:Stall " + i + "] A stall."); } assert(A.told.length <= 4, "the ring holds four: " + A.told.length);
    /* #21 only a dungeon's leads are peeked for a title: a name from the street draws no interior */
    S = start(); A = S.A; A.adopt = false; drew = 0; realI = TnDMaps.interior.fromTown; TnDMaps.interior.fromTown = function () { drew++; return realI.apply(this, arguments); };
    try { turn("[SUBLOCATION:Nowhere At All] Nothing."); } finally { TnDMaps.interior.fromTown = realI; } assert.equal(drew, 0, "no interior drawn for a title look");
    /* #27 the fold: with adoption off, a name that differs in case or article lands on the node that is there */
    S = start(false); A = S.A; c = S.c; turn("[SUBLOCATION:" + c.inn.name + "] In."); turn("[SUBLOCATION:The Reliquary][LOCATION_DESC:FIRST.] A nook."); n = nodeCount();
    turn("[SUBLOCATION:" + c.inn.name + "] Back."); turn("[SUBLOCATION:reliquary] Again."); assert.equal(sub(), c.inn.name + SEP + "The Reliquary", "folded onto the node that is there"); assert.equal(nodeCount(), n);
    /* #30, #31 the carry ends at a sub-location or a leave */
    S = start(); T = S.T; A = S.A; c = S.c; r = S.r; turn("[SUBLOCATION:" + r.a + "] In."); turn("[SUBLOCATION:" + r.room + "] The room.");
    tl = placeTimeline("[LOCATION:" + T + "][SUBLOCATION:" + c.market.name + "]", T, r.a + SEP + r.room); assert.equal(tl.states[tl.states.length - 1].carried, null, "a sub-location named after the footer ends the carry");
    tl = placeTimeline("[LOCATION:" + T + "][SUBLOCATION_LEAVE]", T, r.a + SEP + r.room); assert.equal(tl.states[tl.states.length - 1].carried, null, "a leave ends the carry");
    tl = placeTimeline("[LOCATION:" + T + "]", T, r.a + SEP + r.room); assert.equal(tl.states[tl.states.length - 1].carried, r.a + SEP + r.room, "the footer alone carries");
    /* #33 declarations never accumulate across replies: the follow clears them, mapped or not */
    S = start(); A = S.A; turn("[MAP_PLACE:Nowhere|near Somewhere] Idle talk."); assert.equal(worldState.placeDecls, undefined);
    stubs(); engine.makeTestWorld(); atlasForget(); turn("[MAP_PLACE:Nowhere|near Somewhere] Idle talk."); assert.equal(worldState.placeDecls, undefined, "an unmapped campaign keeps no declarations either");
    /* finding 13: the adds are a keyed store — a world named like an Object property is added, and survives a load */
    S = start(); A = S.A; assert(KEYED_STORE_PATHS.world.indexOf("atlas.adds") >= 0); turn("[LOCATION:constructor] A strange name."); assert(A.adds["constructor"] && A.adds["constructor"].zone === A.seed, JSON.stringify(A.adds));
    worldState = parseWorldState(serializeWorldState(worldState)); migrateWorldState(); assert.equal(Object.getPrototypeOf(worldState.atlas.adds), null, "a keyed dictionary after the load"); assert(worldState.atlas.adds["constructor"]);
  });

  /* ── the third independent review (2026-11-07, audits/AUDIT_2026-11-07_702_review3.md): one group per finding ───────────────── */
  test("#702 review 3: a key never carries a room in the middle (finding 1): three subs through an invented building, the pair with an unknown middle, the three-pair from the street, a partial pair inside — one node each, re-stated to itself", function () {
    var S = start(), T = S.T, A = S.A, c = S.c, inn = c.inn.name, keys;
    turn("[SUBLOCATION:The Gilded Spur][SUBLOCATION:Kitchen][SUBLOCATION:Pantry][LOCATION_DESC:THE PANTRY, FIRST.] In, through the kitchen, and into the pantry.");
    assert.equal(sub(), "The Gilded Spur" + SEP + "Pantry", "the building and the room the party is in: the kitchen passed through is no zone");
    assert.equal(node(T + "|The Gilded Spur" + SEP + "Kitchen" + SEP + "Pantry"), undefined, "no key with a room in the middle"); assert(node(T + "|The Gilded Spur" + SEP + "Kitchen"), "the kitchen passed through has its own node under the building");
    turn("[SUBLOCATION:Pantry][LOCATION_DESC:THE PANTRY, AGAIN.] You look around.");
    assert.equal(sub(), "The Gilded Spur" + SEP + "Pantry", "re-stated by its own name: the same node"); assert.equal(nodesWith("Pantry").length, 1, nodesWith("Pantry").join(" ; ")); assert(buildGeoBlock().indexOf("THE PANTRY, FIRST") >= 0, "the first description survives the re-statement");
    /* the pair of three from the street with an invented tavern: the building and the LAST room, each added under its own key */
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:The Copper Cup" + SEP + "Kitchen" + SEP + "Pantry][LOCATION_DESC:C1.] Straight through to the back.");
    assert.equal(sub(), "The Copper Cup" + SEP + "Pantry"); assert(adds(A).indexOf(T + "|The Copper Cup") >= 0 && adds(A).indexOf(T + "|The Copper Cup" + SEP + "Pantry") >= 0, JSON.stringify(A.adds)); assert.equal(A.off, null, JSON.stringify(A.off));
    turn("[SUBLOCATION:Pantry][LOCATION_DESC:C2.] Still here."); assert.equal(sub(), "The Copper Cup" + SEP + "Pantry"); assert.equal(nodesWith("Copper").length, 1, nodesWith("Copper").join(" ; ")); assert(buildGeoBlock().indexOf("C1.") >= 0, "one node: its first description is served");
    /* the pair with an unknown middle in a KNOWN inn: the inn and the last room; the room's addition under the key the pointer carries */
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:" + inn + SEP + "Scullery" + SEP + "Pantry][LOCATION_DESC:F1.] Through the scullery to the pantry.");
    assert.equal(sub(), inn + SEP + "Pantry"); assert(adds(A).indexOf(T + "|" + inn + SEP + "Pantry") >= 0, "the room's add under the key the pointer carries: " + JSON.stringify(A.adds)); assert.equal(adds(A).indexOf(T + "|" + inn + SEP + "Scullery" + SEP + "Pantry"), -1);
    turn("[SUBLOCATION:Pantry][LOCATION_DESC:F2.] The pantry again."); assert.equal(sub(), inn + SEP + "Pantry"); assert(buildGeoBlock().indexOf("F1.") >= 0, "one node: the first description is served");
    /* a partial pair inside the inn whose first segment nothing bears: the last segment under the inn (the first is a room passed through) */
    turn("[SUBLOCATION:Scullery" + SEP + "Larder][LOCATION_DESC:L1.] On through."); assert.equal(sub(), inn + SEP + "Larder");
    /* every key the resolver wrote re-resolves to itself without a position */
    keys = Object.keys(memory.map.nodes).filter(function (k) { return k.indexOf(T + "|") === 0; }); assert.equal(keys.length, 6, "the six places the flows named, one node each: " + keys.join(" ; "));
    keys.forEach(function (k) { var rp = resolvePlaceName(placeKeyLeaf(k), T); assert(rp && rp.key === k, "re-resolves to itself: " + k + " → " + JSON.stringify(rp)); });
  });

  test("#702 review 3: a tap on a room inside the place the engine added for the story's name places nothing (finding 2a), and a tie that lands beneath the home sheet files the rooms after it under that building (finding 2b)", function () {
    var S = start(), T = S.T, A = S.A, c = S.c, tz, room, door, card, r, iz, back, pos;
    turn("[SUBLOCATION:" + c.market.name + "] On the square."); turn("[SUBLOCATION:The Pot and Kettle][LOCATION_DESC:A tavern.] In."); tz = A.at; door = A.zones[tz].via; assert(A.adds[T + "|The Pot and Kettle"], JSON.stringify(A.adds));
    turn("[SUBLOCATION:The Snug][LOCATION_DESC:A SNUG WITH A FIRE.] A snug off the taproom."); assert(atlasFind(atlasDoc(tz), "The Snug").thing, "the snug is drawn inside: " + JSON.stringify(A.off)); assert(A.adds[T + "|The Pot and Kettle" + SEP + "The Snug"], JSON.stringify(A.adds));
    turn("[SUBLOCATION:The Pot and Kettle] Back to the door."); quiet();
    room = atlasDoc(tz).rooms.filter(function (x) { return x.name !== "The Snug" && atlasFind(atlasDoc(tz), x.name) && atlasFind(atlasDoc(tz), x.name).thing; })[0]; assert(room, "fixture: a room of the tavern with a name of its own");
    card = atlasCard(tz, { id: room.id }); assert(card.added && /this is inside it/.test(card.added), "the room's card says so: " + JSON.stringify(card)); assert(/added "The Pot and Kettle" to the map here/.test(atlasCard(c.townId, { id: door }).added), "and so does the door's: " + JSON.stringify(atlasCard(c.townId, { id: door })));
    r = atlasPlace(tz, { id: room.id }); assert.equal(r.ok, false, JSON.stringify(r)); assert(/this is inside it/.test(r.reason), r.reason);
    assert(atlasFind(atlasDoc(tz), "The Snug").thing, "the snug stays"); assert(A.adds[T + "|The Pot and Kettle"] && A.adds[T + "|The Pot and Kettle" + SEP + "The Snug"], "both additions stay: " + JSON.stringify(A.adds)); assert.equal(Object.keys(A.names).length, 0, "no tie"); assert.equal(atlasToldLines(A).length, 0, "nothing re-added: " + JSON.stringify(A.told));
    /* the removal itself: a tie under the story's own key that points INTO the addition is no correction — the addition stays */
    A.names[T + "|The Pot and Kettle"] = { zone: tz, id: room.id }; assert.equal(atlasAddRemove(A, T + "|The Pot and Kettle"), false); assert(A.adds[T + "|The Pot and Kettle"] && atlasFind(atlasDoc(tz), "The Snug").thing, "kept, rooms and all"); delete A.names[T + "|The Pot and Kettle"];
    turn("[SUBLOCATION:The Snug] Back to the snug."); assert.equal(sub(), "The Pot and Kettle" + SEP + "The Snug"); assert(buildGeoBlock().indexOf("A SNUG WITH A FIRE") >= 0, "its description is served"); assert.equal(atlasFind(atlasDoc(c.townId), "The Snug"), null, "no town-level Snug");
    /* (b) the story's forge tied to a back room of the real inn: the forge's rooms are that inn's rooms afterwards, never the town's */
    S = start(); T = S.T; A = S.A; c = S.c; turn("[SUBLOCATION:" + c.inn.name + "] In."); iz = A.at; back = deepRoom(atlasDoc(iz)); turn("[SUBLOCATION_LEAVE]");
    turn("[SUBLOCATION:Harl's Forge] A smithy."); assert(A.adds[T + "|Harl's Forge"], JSON.stringify(A.adds)); quiet();
    r = atlasPlace(iz, { id: back.id }); assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(A.adds[T + "|Harl's Forge"], undefined, "the addition goes: the player's tie points elsewhere");
    pos = atlasPosition(A, T, "Harl's Forge"); assert.deepEqual(pos.chain.map(function (x) { return x.name; }), [c.inn.name], "the chain reaches the inn the tie landed in"); assert.equal(pos.spot && pos.spot.id, back.id);
    turn("[SUBLOCATION:Anvil Room][LOCATION_DESC:ANVILS.] At the anvil."); assert.equal(sub(), c.inn.name + SEP + "Anvil Room", "filed under the building the tie landed in"); assert.equal(node(T + "|Anvil Room"), undefined, "never town-wide");
    assert(atlasFind(atlasDoc(iz), "Anvil Room").thing, "added inside the inn: " + JSON.stringify(A.off)); assert.equal(atlasDoc(c.townId).establishments.filter(function (e) { return e.authored; }).length, 0, "nothing added to the town's sheet");
  });

  test("#702 review 3: the region's margin filter is load-bearing (finding 3): where the ring of points crosses the frame's margin on land, every offered point stays inside it", function () {
    var A = fresh(), rd = atlasDoc(A.seed), x, landX = null, pts, raw;
    for (x = 60; x < rd.frame.width - 60 && landX === null; x += 5) { try { TnDMaps.wild.fromRegion(rd, [x, 20]); landX = x; } catch (e) { } }
    assert(landX !== null, "fixture: a point of land 20 px below the frame's top edge (the library accepts margin land; the filter is the game's own)");
    raw = [landX, 20]; pts = atlasRegionPoints(rd, [landX, 70]); assert(pts.length, "points beside the centre");
    pts.forEach(function (q) { assert(q[0] >= 40 && q[1] >= 40 && q[0] <= rd.frame.width - 40 && q[1] <= rd.frame.height - 40, "inside the margin: " + q); });
    assert(!pts.some(function (q) { return q[0] === raw[0] && q[1] === raw[1]; }), "the ring's first bearing lands on the margin point, and it is not offered");
    assert.doesNotThrow(function () { TnDMaps.generate("region", Object.assign({}, rd.params, { edits: [{ op: "add", id: "a1", name: "Edgeford", kind: "village", at: raw }] })); }, "the library would take a village there: the filter is what keeps settlements off the frame's edge");
  });

  test("#702 review 3: a [MAP_PLACE:] parsed outside the turn's commit is set aside (finding 4): the next commit does not act on it, and says so on the console", function () {
    var S = start(), A = S.A, c = S.c, p1 = c.p1, R, t;
    console.log = function () { }; try { R = applyMuts("[MAP_PLACE:Thornwick|near " + p1.name + "] A correction's reply, parsed outside a commit."); } finally { console.log = realLog; }
    assert(R.muts.some(function (m) { return /^Map place: Thornwick/.test(m); }), R.muts.join(" | ")); assert(worldState.placeDecls && worldState.placeDecls.length === 1, "recorded for a follow");
    quiet(); turn("[LOCATION:Thornwick] On to Thornwick."); t = atlasDoc(A.seed).places.filter(function (p) { return p.name === "Thornwick"; })[0]; assert(t, "added");
    assert(dist(t, p1) > 300 && dist(t, c.p0) < 120, "beside the party's last place, not near " + p1.name + ": " + dist(t, p1) + " / " + dist(t, c.p0));
    assert(!atlasToldLines(A).some(function (l) { return l.indexOf("near " + p1.name) >= 0; }), JSON.stringify(A.told)); assert(infos.some(function (i) { return /from another turn's parse set aside/.test(i); }), "said on the console: " + JSON.stringify(infos));
    assert.equal(worldState.placeDecls, undefined, "cleared");
  });

  test("#702 review 3: the one refusal that was silent — a place added once already and not found since — is said like the others (finding 5)", function () {
    var S = start(), T = S.T, A = S.A, c = S.c;
    A.adds = A.adds || keyedDict(); A.adds[T + "|Harl's Forge"] = { zone: c.townId, id: "s99", turn: 1 };/* an index whose thing the sheet no longer has (an edited recipe) */
    quiet(); turn("[SUBLOCATION:Harl's Forge] Back to the smithy.");
    assert(A.off && /added to the map once already/.test(A.off.why), JSON.stringify(A.off)); assert(toasts.some(function (t) { return /Harl's Forge could not be added — it was added to the map once already/.test(t); }), "toasted: " + JSON.stringify(toasts));
    assert.equal(atlasFind(atlasDoc(c.townId), "Harl's Forge"), null, "not added again");
  });

  test("#702 review 3: the gaps the mutants showed (finding 6) — a twice-borne name over an added street thing, the same-reply re-statement of an invented building, the second house radius, a street-sited trade, the room variants", function () {
    var S = start(), T = S.T, A = S.A, c = S.c, r = S.r, tw = r.twice, town, bs, x, y, best = null, m, i, d, cat, street, inn, spot, pf, floors, expect;
    /* #5: a name added from the street; inside an inn that bears the name TWICE it is the inn's, as written, never the street's thing */
    turn("[SUBLOCATION:" + tw.room + "][LOCATION_DESC:A STREET THING.] A covered way off the square."); assert.equal(sub(), tw.room); assert(atlasFind(atlasDoc(c.townId), tw.room).thing, "added at the town's level");
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:" + tw.in + "] In."); turn("[SUBLOCATION:" + tw.room + "][LOCATION_DESC:THE INN'S.] Along it.");
    assert.equal(sub(), tw.in + SEP + tw.room, "the inn's, as written (the sheet bears it twice)"); assert(buildGeoBlock().indexOf("A STREET THING") < 0, "the street thing's description is not served inside");
    /* #8: the invented building re-stated inside the SAME reply is the building, not a room of itself */
    S = start(); T = S.T; A = S.A; turn("[SUBLOCATION:The Gilded Spur][SUBLOCATION:The Gilded Spur] In, and in again."); assert.equal(sub(), "The Gilded Spur"); assert.equal(node(T + "|The Gilded Spur" + SEP + "The Gilded Spur"), undefined);
    /* #23: the second radius — a point whose nearest free house lies beyond 80 px but within 160 still takes a house */
    town = atlasDoc(S.c.townId); bs = town.buildings.filter(function (b) { return b && !b.est && b.pts && b.c; });
    function nearest(cx, cy) { var mn = Infinity, k, dd; for (k = 0; k < bs.length; k++) { dd = Math.sqrt((bs[k].c[0] - cx) * (bs[k].c[0] - cx) + (bs[k].c[1] - cy) * (bs[k].c[1] - cy)); if (dd < mn) mn = dd; } return mn; }
    for (y = 20; y < town.frame.height - 20 && !best; y += 10) for (x = 20; x < town.frame.width - 20 && !best; x += 10) { m = nearest(x, y); if (m > 85 && m < 150) best = [x, y, m]; }
    assert(best, "fixture: a point of the town whose nearest free house lies between 85 and 150 px away");
    i = atlasRoomyHouse(town, [best[0], best[1]], "inn"); assert(i >= 0, "a house within 160 px is taken"); d = Math.sqrt((town.buildings[i].c[0] - best[0]) * (town.buildings[i].c[0] - best[0]) + (town.buildings[i].c[1] - best[1]) * (town.buildings[i].c[1] - best[1])); assert(d > 80 && d <= 160, "beyond the first radius, within the second: " + d);
    /* #26: a trade whose catalogue site is the street takes no house, even with a free house at hand */
    cat = TnDMaps.establishments.CATALOGUE; street = Object.keys(cat).filter(function (k) { return cat[k].site === "street"; })[0]; assert(street, "fixture: the catalogue has a street-sited kind");
    assert.equal(atlasRoomyHouse(town, [bs[0].c[0], bs[0].c[1]], street), -1); assert(atlasRoomyHouse(town, [bs[0].c[0], bs[0].c[1]], "inn") >= 0, "a house-sited kind at the same point takes one");
    /* #31: the room variants, in order — the party's floor at 8 then 6 m², any floor at 8 then 6, each other floor at 6; without a spot, from "any floor" */
    inn = TnDMaps.generate("interior", TnDMaps.interior.fromTown(town, S.c.inn.id)); spot = inn.rooms.filter(function (rm) { return typeof rm.floor === "number"; })[0]; assert(spot, "fixture: the inn's rooms have floors"); pf = spot.floor;
    floors = []; inn.rooms.forEach(function (rm) { if (typeof rm.floor === "number" && floors.indexOf(rm.floor) < 0) floors.push(rm.floor); }); assert(floors.length >= 2, "fixture: the inn has two floors or more");
    expect = [{ floor: pf, m2: 8 }, { floor: pf, m2: 6 }, { m2: 8 }, { m2: 6 }].concat(floors.filter(function (f) { return f !== pf; }).map(function (f) { return { floor: f, m2: 6 }; }));
    assert.deepEqual(atlasRoomVariants(inn, spot), expect); assert.deepEqual(atlasRoomVariants(inn, null), [{ m2: 8 }, { m2: 6 }].concat(floors.map(function (f) { return { floor: f, m2: 6 }; })), "no spot: any floor first, then each floor");
  });

  test("#702 review 3: a custom place is drawn medium and grows large once for a room it cannot hold (finding 8, owner 2026-11-07); a failed growth is undone; a trade's house and a large place never grow", function () {
    var S = start(), T = S.T, A = S.A, c = S.c, sz, ed, i, townBefore, rooms0, grewAt = 0, real, r, fp0;
    turn("[SUBLOCATION:" + c.market.name + "] On the square."); townBefore = plain(atlasDoc(c.townId));
    turn("[SUBLOCATION:The Gilded Spur][LOCATION_DESC:A nameless house.] In."); sz = A.at; ed = edits(A, c.townId).filter(function (e) { return e.name === "The Gilded Spur"; })[0];
    assert(ed && ed.kind === "custom" && ed.footprint === "medium", "drawn medium by default: " + JSON.stringify(ed)); rooms0 = atlasDoc(sz).rooms.length; assert(rooms0 >= 4 && rooms0 <= 6, "a medium house: " + rooms0);
    for (i = 1; i <= 8 && !grewAt; i++) { quiet(); turn("[SUBLOCATION:Store Room " + i + "] A store."); assert(atlasFind(atlasDoc(sz), "Store Room " + i).thing, "room " + i + " is on the sheet: " + JSON.stringify(A.off)); assert.equal(A.at, sz, "the same zone, grown or not"); if (ed.footprint === "large") grewAt = i; }
    assert(grewAt, "the medium house ran out of room within eight and was drawn large"); assert(atlasDoc(sz).rooms.length > rooms0 + grewAt, "a large house now: " + atlasDoc(sz).rooms.length);
    assert(atlasToldLines(A).some(function (t) { return t.indexOf("Store Room " + grewAt + " was added") >= 0 && /drawn larger to hold it/.test(t); }), "the GM is told: " + JSON.stringify(A.told)); assert(toasts.some(function (t) { return /drawn larger to hold it/.test(t); }), "and the player: " + JSON.stringify(toasts));
    assert.equal(atlasLost(townBefore, atlasDoc(c.townId)), null, "the town kept every thing and way"); for (i = 1; i <= grewAt; i++) assert(atlasFind(atlasDoc(sz), "Store Room " + i).thing, "the earlier rooms still stand after the growth");
    turn("[SUBLOCATION:Store Room 9] One more."); assert(atlasFind(atlasDoc(sz), "Store Room 9").thing, JSON.stringify(A.off)); assert.equal(ed.footprint, "large", "grows once"); assert.equal(atlasGrowHouse(A, sz), null, "a large place never grows again");
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:The Copper Cup] A tavern."); assert.equal(atlasGrowHouse(A, A.at), null, "a trade's house is the library's, never grown");
    /* a growth the library refuses, or that would lose a thing, is undone: the footprint and the town's fingerprint as they were */
    S = start(); A = S.A; c = S.c; turn("[SUBLOCATION:The Gilded Spur] In."); sz = A.at; ed = edits(A, c.townId).filter(function (e) { return e.name === "The Gilded Spur"; })[0]; fp0 = A.zones[c.townId].fp; assert(fp0, "settled");
    real = TnDMaps.generate; TnDMaps.generate = function (kind, params) { if (params && params.edits && params.edits.some(function (e) { return e.footprint === "large"; })) throw new Error("TnDMaps: edits[0]: at lies on another place"); return real.apply(this, arguments); };
    try { r = atlasGrowHouse(A, sz); } finally { TnDMaps.generate = real; }
    assert(r && r.grew === false && /another place/.test(r.why), JSON.stringify(r)); assert.equal(ed.footprint, "medium", "undone"); assert.equal(A.zones[c.townId].fp, fp0, "the town's fingerprint as it was");
  });

  /* ── the fourth independent review (2026-11-07, audits/AUDIT_2026-11-07_702_review4.md): one group per finding ───────────────── */
  test("#702 review 4: the fresh path's re-statement guard compares the container (finding 1): the invented building re-stated after its room is the building, the room re-stated is the room, a last room re-stated is itself, and nothing lands at the town's level", function () {
    var S = start(), T = S.T, A = S.A, c = S.c;
    function authored() { return atlasDoc(c.townId).establishments.filter(function (e) { return e.authored; }).map(function (e) { return e.name; }); }
    turn("In, to the kitchen, and back to the door. [SUBLOCATION:The Gilded Spur][SUBLOCATION:Kitchen][SUBLOCATION:The Gilded Spur][LOCATION_DESC:THE DOOR, AGAIN.]");
    assert.equal(sub(), "The Gilded Spur", "the building re-stated is the building"); assert.equal(node(T + "|The Gilded Spur" + SEP + "The Gilded Spur"), undefined, "never a room of itself"); assert.deepEqual(authored(), ["The Gilded Spur"]);
    turn("[SUBLOCATION:The Gilded Spur][LOCATION_DESC:THE DOOR, THRICE.] Still here."); assert(buildGeoBlock().indexOf("THE DOOR, AGAIN") >= 0, "one node: its description is served");
    S = start(); T = S.T; A = S.A; c = S.c; turn("[SUBLOCATION:The Gilded Spur][SUBLOCATION:Kitchen][SUBLOCATION:Kitchen][LOCATION_DESC:THE KITCHEN, TWICE.]");
    assert.equal(sub(), "The Gilded Spur" + SEP + "Kitchen", "the room re-stated is the room"); assert.equal(node(T + "|Kitchen"), undefined, "no town-level Kitchen"); assert.deepEqual(authored(), ["The Gilded Spur"], "nothing added at the town's level");
    S = start(); T = S.T; A = S.A; c = S.c; turn("[SUBLOCATION:The Gilded Spur][SUBLOCATION:Kitchen][SUBLOCATION:Pantry][SUBLOCATION:Pantry][LOCATION_DESC:THE PANTRY, TWICE.]");
    assert.equal(sub(), "The Gilded Spur" + SEP + "Pantry"); assert.equal(nodesWith("Pantry").length, 1, nodesWith("Pantry").join(" ; ")); assert.deepEqual(authored(), ["The Gilded Spur"]);
  });

  test("#702 review 4: a partial path on a sheet the SAME reply entered is read with the position's adapters (finding 2): the one-reply descent to the crypt by its title, the stair's pair, an unknown pair inside an inn entered this reply — no report, no town-level junk", function () {
    var S = start(), T = S.T, A = S.A, c = S.c, temple = c.town.landmarks.filter(function (l) { return l.kind === "temple"; })[0], tdoc, stair, crypt, title;
    function authored() { return atlasDoc(c.townId).establishments.filter(function (e) { return e.authored; }).map(function (e) { return e.name; }); }
    tdoc = TnDMaps.generate("interior", TnDMaps.interior.fromTown(c.town, temple.id)); stair = tdoc.portals.filter(function (p) { return p.way === "down"; })[0]; crypt = TnDMaps.generate("dungeon", TnDMaps.dungeon.fromInterior(tdoc, stair.id)); title = crypt.title.name;
    quiet(); turn("Down into the crypt. [SUBLOCATION:" + temple.name + "][SUBLOCATION:" + title + SEP + "Hall of Bones][LOCATION_DESC:BONES.]");
    assert.equal(sub(), temple.name + SEP + title + SEP + "Hall of Bones", "the crypt by its title from the nave, the temple entered this very reply"); assert.equal(A.zones[A.at] && A.zones[A.at].kind, "dungeon", JSON.stringify(A.off)); assert.equal(reports.length, 0, "nothing reported: " + JSON.stringify(reports)); assert.deepEqual(authored(), [], "no town-level junk");
    S = start(); T = S.T; A = S.A; c = S.c; quiet(); turn("[SUBLOCATION:" + temple.name + "][SUBLOCATION:" + stair.name + SEP + "Hall of Bones][LOCATION_DESC:BONES.]");
    assert.equal(sub(), temple.name + SEP + title + SEP + "Hall of Bones", "the stair's pair: the stair is a lead on the temple's peeked sheet"); assert.equal(reports.length, 0, JSON.stringify(reports)); assert.deepEqual(authored(), []);
    S = start(); T = S.T; A = S.A; c = S.c; quiet(); turn("[SUBLOCATION:" + c.inn.name + "][SUBLOCATION:Scullery" + SEP + "Larder][LOCATION_DESC:L.] Through the scullery.");
    assert.equal(sub(), c.inn.name + SEP + "Larder", "an unknown pair inside an inn entered this reply"); assert.equal(reports.length, 0, JSON.stringify(reports)); assert.deepEqual(authored(), []); assert(adds(A).indexOf(T + "|" + c.inn.name + SEP + "Larder") >= 0, JSON.stringify(A.adds));
  });

  test("#702 review 4: a pair that opens with a spot of the home sheet names the rest (finding 3): the inn off the square is the inn, an invented stall off the square is the stall, and the position reader passes a spot through as the walk does", function () {
    var S = start(), T = S.T, A = S.A, c = S.c, pos;
    function authored() { return atlasDoc(c.townId).establishments.filter(function (e) { return e.authored; }).map(function (e) { return e.name; }); }
    turn("The inn off the square. [SUBLOCATION:" + c.market.name + SEP + c.inn.name + "][LOCATION_DESC:INN ONE.]");
    assert.equal(sub(), c.inn.name, "the square names the inn"); assert.equal(A.zones[A.at].kind, "interior"); assert.equal(A.zones[A.at].via, c.inn.id);
    pos = atlasPosition(A, T, c.market.name + SEP + c.inn.name); assert.deepEqual(pos.chain.map(function (x) { return x.name; }), [c.inn.name], "a raw pointer through the square: the spot is passed through, the party is in the inn"); assert.equal(pos.spot, null);
    turn("[SUBLOCATION:Kitchen][LOCATION_DESC:KITCHEN ONE.] Through."); assert.equal(sub(), c.inn.name + SEP + "Kitchen", "the room files under the inn"); assert.equal(node(T + "|Kitchen"), undefined); assert.deepEqual(authored(), []);
    turn("[SUBLOCATION:" + c.inn.name + "] Back to the common room."); assert(buildGeoBlock().indexOf("INN ONE") >= 0, "the inn's node is the one the pair made");
    S = start(); T = S.T; A = S.A; c = S.c; turn("[SUBLOCATION:" + c.market.name + SEP + "Fishmonger's Stall][LOCATION_DESC:STALL ONE.]");
    assert.equal(sub(), "Fishmonger's Stall", "an invented thing off the square is a thing of the town"); assert(A.adds[T + "|Fishmonger's Stall"], "added under the key the pointer carries: " + JSON.stringify(A.adds));
    turn("[SUBLOCATION:Fishmonger's Stall][LOCATION_DESC:STALL TWO.]"); assert.equal(nodesWith("Stall").length, 1, nodesWith("Stall").join(" ; ")); assert(buildGeoBlock().indexOf("STALL ONE") >= 0);
  });

  test("#702 review 4: the growth is judged against the larger house without the room (finding 4), a refused growth says why (finding 5), a growth the large house still cannot hold is undone and said, a fault during the growth undoes it, the town is not read as redrawn, and the note says the rooms were redrawn (finding 8)", function () {
    var S, A, c, sz, ed, real = TnDMaps.generate, realLost = atlasLost, seen = [], i, grewAt = 0, name;
    function spur() { S = start(); A = S.A; c = S.c; turn("[SUBLOCATION:" + c.market.name + "]"); turn("[SUBLOCATION:The Gilded Spur] In."); sz = A.at; ed = edits(A, c.townId).filter(function (e) { return e.name === "The Gilded Spur"; })[0]; assert.equal(ed.footprint, "medium"); }
    /* finding 4: during the large pass the baseline handed to the loss check does not hold the room being added */
    spur(); atlasLost = function (was, now) { seen.push({ fp: ed.footprint, wasHasRoom: (was.rooms || []).some(function (r) { return r.name === name; }), nowRooms: (now.rooms || []).length }); return realLost(was, now); };
    try { for (i = 1; i <= 8 && !grewAt; i++) { name = "Store Room " + i; seen.length = 0; quiet(); turn("[SUBLOCATION:" + name + "] A store."); if (ed.footprint === "large") grewAt = i; } } finally { atlasLost = realLost; }
    assert(grewAt, "the house grew"); assert(seen.some(function (x) { return x.fp === "large" && x.nowRooms > 0; }), "the large pass checked for loss: " + JSON.stringify(seen)); seen.forEach(function (x) { if (x.fp === "large" && x.nowRooms > 0) assert.equal(x.wasHasRoom, false, "the baseline is the larger house WITHOUT the room: " + JSON.stringify(x)); });
    assert.equal(A.zones[c.townId].redrawn, undefined, "a growth is an intended edit, never drift"); assert(!toasts.some(function (t) { return /map of .* was redrawn/.test(t); }), JSON.stringify(toasts));
    assert(atlasToldLines(A).some(function (t) { return /drawn larger to hold it; its rooms were redrawn, so places the story used inside it may have moved/.test(t); }), "the note says the rooms were redrawn: " + JSON.stringify(A.told));
    /* finding 5: a growth the library refuses says why, and the house stays medium */
    spur(); TnDMaps.generate = function (k, p) { if (p && p.edits && p.edits.some(function (e) { return e.footprint === "large"; })) throw new Error("TnDMaps: edits[0]: at lies on another place"); return real.apply(this, arguments); };
    try { quiet(); turn("[SUBLOCATION:Store Room 1] A store."); } finally { TnDMaps.generate = real; }
    assert(A.off && /drawing The Gilded Spur larger was refused: edits\[0\]: at lies on another place/.test(A.off.why), JSON.stringify(A.off)); assert(toasts.some(function (t) { return /larger was refused: edits\[0\]: at lies on another place/.test(t); }), JSON.stringify(toasts)); assert.equal(ed.footprint, "medium");
    /* a room the LARGE house still cannot hold: the growth is undone and said */
    spur(); TnDMaps.generate = function (k, p) { var d = real.apply(this, arguments); if (k === "interior" && d.rooms) d.rooms = d.rooms.filter(function (r) { return r.name !== "Never Fits"; }); return d; };
    try { quiet(); turn("[SUBLOCATION:Never Fits] A store."); } finally { TnDMaps.generate = real; }
    assert(A.off && /even drawn larger it had no room for it/.test(A.off.why), JSON.stringify(A.off)); assert.equal(ed.footprint, "medium", "undone"); assert(A.zones[c.townId].fp, "the town's fingerprint as it was");
    /* a fault that is no refusal during the growth: undone, reported once, the turn committed */
    spur(); TnDMaps.generate = function (k, p) { if (p && p.edits && p.edits.some(function (e) { return e.footprint === "large"; })) throw new Error("boom: not a refusal"); return real.apply(this, arguments); };
    try { quiet(); turn("[SUBLOCATION:Store Room 1] A store."); } finally { TnDMaps.generate = real; }
    assert(A.off && /adding it to the map failed: boom/.test(A.off.why), JSON.stringify(A.off)); assert.equal(ed.footprint, "medium", "undone before the fault was rethrown"); assert.equal(reports.length, 1, JSON.stringify(reports)); assert.equal(sub(), "The Gilded Spur" + SEP + "Store Room 1", "the turn committed");
  });

  test("#702 review 4: a bookkeeping parse declares no map place (finding 6), a sub-location tie outside the world place is refused (finding 7), a tie onto the home sheet at depth resets the chain, and a tied building keeps the story's name in a rebuilt chain", function () {
    var S = start(), T = S.T, A = S.A, c = S.c, body = src("game.js"), at, r, pt, t1, inn1, iz1, back, pos, innZone;
    /* finding 6: the sheet-sync's applyMuts (a bookkeeping parse) is followed by the declarations' removal — only the turn's commit declares */
    at = body.indexOf("applyMuts(resp);/* #40: deliberately NO detectCoreMoments here"); assert(at > 0, "the sheet-sync parse is where it was"); assert(/^\s*delete worldState\.placeDecls;/m.test(body.slice(at, at + 400).split("\n")[1]), "the next statement drops the declarations: " + body.slice(at, at + 300));
    /* finding 7: the story's forge cannot stand in open country or in another town's inn while the story is in this town */
    turn("[SUBLOCATION:Harl's Forge] A smithy."); pt = (function () { var reg = atlasDoc(A.seed), x, y; for (y = 100; y < reg.frame.height - 100; y += 40) for (x = 100; x < reg.frame.width - 100; x += 40) { try { TnDMaps.wild.fromRegion(reg, [x, y]); if (dist([x, y], c.p0) > 200) return [x, y]; } catch (e) { } } return null; })(); assert(pt, "fixture: open country away from the capital");
    r = atlasPlace(A.seed, { x: pt[0], y: pt[1] }); assert.equal(r.ok, false); assert(r.reason.indexOf("cannot stand there: that sheet is not in " + T) >= 0, r.reason); assert(A.adds[T + "|Harl's Forge"], "the addition stays"); assert.equal(Object.keys(A.names).length, 0);
    S = start(); T = S.T; A = S.A; c = S.c; turn("[LOCATION:" + c.p1.name + "] On."); t1 = A.at; inn1 = atlasDoc(t1).establishments.filter(function (e) { return e.kind === "inn"; })[0]; turn("[SUBLOCATION:" + inn1.name + "] In."); iz1 = A.at; back = deepRoom(atlasDoc(iz1));
    turn("[SUBLOCATION_LEAVE]"); turn("[LOCATION:" + T + "] Back."); turn("[SUBLOCATION:Harl's Forge] A smithy."); r = atlasPlace(iz1, { id: back.id }); assert.equal(r.ok, false); assert(r.reason.indexOf("that sheet is not in " + T) >= 0, r.reason);
    /* a tie for a room onto the home sheet at depth: the chain is reset, the party stands on the street */
    S = start(); T = S.T; A = S.A; c = S.c; turn("[SUBLOCATION:" + c.inn.name + "] In."); turn("[SUBLOCATION:Kitchen] The kitchen."); r = atlasPlace(c.townId, { id: c.market.id }); assert.equal(r.ok, true, JSON.stringify(r));
    pos = atlasPosition(A, T, c.inn.name + SEP + "Kitchen"); assert.equal(pos.chain.length, 0, "the chain is reset onto the home sheet"); assert.equal(pos.spot && pos.spot.id, c.market.id);
    /* a building the player tied under a story name keeps that name in a chain rebuilt from a tie INTO it */
    S = start(); T = S.T; A = S.A; c = S.c; innZone = c.townId + "/" + c.inn.id; turn("[SUBLOCATION:Widow Hale's House] A house."); r = atlasPlace(c.townId, { id: c.inn.id }); assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(A.adds[T + "|Widow Hale's House"], undefined, "the addition went: the tie points elsewhere");
    turn("[SUBLOCATION_LEAVE]"); turn("[SUBLOCATION:The Snug] A snug."); r = atlasPlace(innZone, { id: deepRoom(atlasDoc(innZone)).id }); assert.equal(r.ok, true, JSON.stringify(r));
    pos = atlasPosition(A, T, "The Snug"); assert.deepEqual(pos.chain.map(function (x) { return x.name; }), ["Widow Hale's House"], "the rebuilt chain carries the story's name for the tied building (ruling 7)");
    turn("[SUBLOCATION:Cellar][LOCATION_DESC:C.] Down a step."); assert.equal(sub(), "Widow Hale's House" + SEP + "Cellar"); assert.equal(node(T + "|Cellar"), undefined);
  });

  /* ── the fifth independent review (2026-11-07, audits/AUDIT_2026-11-07_702_review5.md) ───────────────────────────────────────── */
  test("#702 review 5: a path written under a fresh container is read as a path (finding 1), a square-pair from inside a building names a thing of the town (finding 2), a building the player placed on a spot keeps its rooms in the story and the map draws none (finding 3, owner 2026-11-07), a one-reply world move's pair reads the new town's sheet without the store, a region tap for a sub-location says why, and a bare invented place lands beside the party's spot", function () {
    var S = start(), T = S.T, A = S.A, c = S.c, iz, r, t1doc, i1, sp;
    function authored() { return atlasDoc(c.townId).establishments.filter(function (e) { return e.authored; }).map(function (e) { return e.name + ":" + e.kind; }); }
    /* finding 1: "The Gilded Spur — Kitchen" written under the fresh Spur is its kitchen; "Kitchen — Pantry" its pantry; the description lands and is served */
    turn("[SUBLOCATION:The Gilded Spur][SUBLOCATION:The Gilded Spur" + SEP + "Kitchen][LOCATION_DESC:KITCHEN FIRST.] In and through.");
    assert.equal(sub(), "The Gilded Spur" + SEP + "Kitchen", "the pair under its own container is the room"); assert.equal(node(currentNodeKey()).description, "KITCHEN FIRST.", "the pointer and the node agree"); assert.deepEqual(nodesWith("Spur"), [T + "|The Gilded Spur", T + "|The Gilded Spur" + SEP + "Kitchen"]);
    turn("[SUBLOCATION:Kitchen] Still here."); assert(buildGeoBlock().indexOf("KITCHEN FIRST") >= 0, "served on the re-statement");
    S = start(); T = S.T; A = S.A; c = S.c; turn("[SUBLOCATION:The Gilded Spur][SUBLOCATION:Kitchen" + SEP + "Pantry][LOCATION_DESC:P.] Through to the back.");
    assert.equal(sub(), "The Gilded Spur" + SEP + "Pantry", "a pair of rooms under the container: the last room"); assert.equal(adds(A).indexOf(T + "|The Gilded Spur" + SEP + "Kitchen" + SEP + "Pantry"), -1, "no key with a room in the middle: " + JSON.stringify(A.adds));
    /* finding 2: off the square is off the square, written from inside the inn too */
    S = start(); T = S.T; A = S.A; c = S.c; turn("[SUBLOCATION:" + c.inn.name + "] In."); iz = A.at; turn("[SUBLOCATION:" + c.market.name + SEP + "Fishmonger's Stall][LOCATION_DESC:S1.] Out to the stall.");
    assert.equal(sub(), "Fishmonger's Stall", "a thing of the town"); assert.deepEqual(atlasDoc(iz).rooms.filter(function (x) { return x.authored; }), [], "never a room of the inn"); assert(A.adds[T + "|Fishmonger's Stall"], JSON.stringify(A.adds)); assert.notEqual(A.at, iz, "the party left the inn");
    S = start(); T = S.T; A = S.A; c = S.c; turn("[SUBLOCATION:" + c.inn.name + "] In."); iz = A.at; turn("[SUBLOCATION:" + c.market.name + SEP + "The Gilded Cup][LOCATION_DESC:C.] Across the square and in.");
    assert.equal(sub(), "The Gilded Cup"); assert(authored().indexOf("The Gilded Cup:tavern") >= 0, "the invented tavern is the town's: " + JSON.stringify(authored())); assert.deepEqual(atlasDoc(iz).rooms.filter(function (x) { return x.authored; }), [], "never drawn as a room of the inn"); assert.equal(A.zones[A.at].kind, "interior"); assert.notEqual(A.at, iz);
    turn("[SUBLOCATION:Kitchen] Its kitchen."); assert.equal(sub(), "The Gilded Cup" + SEP + "Kitchen");
    /* finding 3 (owner 2026-11-07): the story's forge tied to the market — its rooms stay the forge's in the story, the map draws none and says why */
    S = start(); T = S.T; A = S.A; c = S.c; turn("[SUBLOCATION:Harl's Forge] A smithy."); r = atlasPlace(c.townId, { id: c.market.id }); assert.equal(r.ok, true, JSON.stringify(r)); assert.deepEqual(authored(), [], "the addition went: the player placed the forge on the square");
    quiet(); turn("[SUBLOCATION:Harl's Forge" + SEP + "Anvil Room][LOCATION_DESC:ANVILS.] At the anvil.");
    assert.equal(sub(), "Harl's Forge" + SEP + "Anvil Room", "the story's key stands"); assert.equal(node(currentNodeKey()).description, "ANVILS."); assert(A.off && !A.off.absent && A.off.why.indexOf("is at " + c.market.name + " on this map, which has no inside; Anvil Room cannot be drawn there") >= 0, JSON.stringify(A.off)); assert.deepEqual(authored(), [], "nothing added"); assert.deepEqual(adds(A), []);
    assert(atlasWhere().text.indexOf("which has no inside") > 0, atlasWhere().text);
    turn("[SUBLOCATION:Quenching Trough][LOCATION_DESC:T.] By the trough."); assert.equal(sub(), "Harl's Forge" + SEP + "Quenching Trough", "a bare room after it is the forge's too"); assert.deepEqual(authored(), []); assert.equal(node(T + "|Quenching Trough"), undefined);
    turn("[SUBLOCATION:Harl's Forge] Back to the door."); assert.equal(sub(), "Harl's Forge", "the re-statement is the place itself"); turn("[SUBLOCATION:" + c.inn.name + "] Over to the inn."); assert.equal(sub(), c.inn.name); assert.equal(A.zones[A.at].kind, "interior", "a real building after it is entered as before");
    S = start(); T = S.T; A = S.A; c = S.c; turn("[SUBLOCATION:Harl's Forge] A smithy."); atlasPlace(c.townId, { id: c.market.id }); turn("[SUBLOCATION:Anvil Room][LOCATION_DESC:A.] In."); assert.equal(sub(), "Harl's Forge" + SEP + "Anvil Room", "a bare room inside the tied place"); assert.deepEqual(authored(), []);
    /* the strip's lead lookup takes the position's adapters: a world move and the new town's pair in ONE reply reach no unrecorded zone */
    S = start(); T = S.T; A = S.A; c = S.c; t1doc = TnDMaps.generate("town", TnDMaps.town.fromRegion(c.reg, c.p1.id)); i1 = t1doc.establishments.filter(function (e) { return e.kind === "inn"; })[0];
    quiet(); turn("On to the next town, straight into its inn's kitchen. [LOCATION:" + c.p1.name + "][SUBLOCATION:" + i1.name + SEP + "Kitchen][LOCATION_DESC:K.]"); assert.equal(sub(), i1.name + SEP + "Kitchen"); assert.equal(reports.length, 0, JSON.stringify(reports)); assert.equal(A.zones[A.at].kind, "interior");
    /* the region tap for a sub-location names the right reason when the tapped thing is the party's own town */
    S = start(); T = S.T; A = S.A; c = S.c; turn("[SUBLOCATION:Harl's Forge] A smithy."); r = atlasPlace(A.seed, { id: c.p0.id }); assert.equal(r.ok, false); assert(r.reason.indexOf("the realm's sheet shows " + T + " from outside") > 0, r.reason);
    /* a bare invented place named from the square lands beside the square, not at the town's centre */
    S = start(); T = S.T; A = S.A; c = S.c; turn("[SUBLOCATION:" + c.market.name + "] On the square."); turn("[SUBLOCATION:The Gilded Spur] A house off the square."); sp = atlasDoc(c.townId).establishments.filter(function (e) { return e.name === "The Gilded Spur"; })[0]; assert(sp, JSON.stringify(A.off));
    assert(dist(sp, c.market) < 60, "beside the square: " + dist(sp, c.market)); assert(atlasToldLines(A).some(function (t) { return t.indexOf("beside " + c.market.name) > 0; }), JSON.stringify(A.told));
  });

  /* ── #717 FOG OF WAR (owner rulings 2026-11-09): the visit record and what a sheet may show ──────────────────────── */
  function leg(a, b) { return a < b ? [a, b] : [b, a]; }
  /* a sheet's record as the stands and the legs (the `last` pointer — where the party last showed on the sheet — is read on its own) */
  function recOf(A, z) { var r = A.seen && A.seen[z]; return r ? { at: plain(r.at), legs: plain(r.legs) } : undefined; }
  function walked(A) { var o = {}; Object.keys(A.seen || {}).forEach(function (z) { o[z] = recOf(A, z); }); return JSON.stringify(o); }
  /* the ways up of a dungeon that the sheet above shows the player (review finding 2: the others are not known) */
  function waysShown(parentZone, parentDoc, doc) { return doc.portals.filter(function (p) { var t = p.way === "up" && p.to ? atlasThingById(parentDoc, p.to.id) : null; return !!t && atlasFogShows(parentZone, t.x, t.y); }).map(function (p) { return p.id; }); }
  function legRoute(doc, l) { return TnDMaps.route(doc, l[0].slice(2), l[1].slice(2)); }
  function numbersIn(o) { var n = 0; JSON.stringify(o, function (k, v) { if (typeof v === "number") n++; return v; }); return n; }
  /* every room or passage a route crosses, sampled far finer than the engine samples it */
  function crossed(doc, kind, paths) {
    var out = {}, i, k, a, b, id, n;
    paths.forEach(function (p) {
      for (i = 0; i < p.length; i++) {
        id = TnDMaps[kind].locate(doc, p[i]); if (id != null) out[id] = 1;
        if (!i) continue;
        a = p[i - 1]; b = p[i]; n = Math.ceil(Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2)) / 0.1);
        for (k = 1; k < n; k++) { id = TnDMaps[kind].locate(doc, [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); if (id != null) out[id] = 1; }
      }
    });
    return out;
  }

  test("#717 the visit record: a stand the map knows is recorded on every sheet it shows on, as a thing's id, and a walk between two of them as a leg — ids only, never a coordinate; a stand the map does not know, a follow repeated and a gap off the map record nothing", function () {
    var A = fresh(), c = cast(A), innZone, was;
    assert.deepEqual(plain(A.seen), {}, "a new atlas has an empty record");
    point(c.p0.name); atlasFollow(); townCast(A, c);
    assert.deepEqual(recOf(A, A.seed), { at: ["t:" + c.p0.id], legs: [] }, "on the region: the town the party entered");
    assert.equal(A.seen[c.townId], undefined, "in the town the map does not know where: nothing is recorded there");
    point(c.p0.name, c.inn.name); atlasFollow(); innZone = c.townId + "/" + c.inn.id; assert.equal(A.at, innZone);
    assert.deepEqual(recOf(A, c.townId), { at: ["t:" + c.inn.id], legs: [] }, "on the town: the inn's door — and no leg from a spot the map did not know");
    assert.equal(A.seen[innZone], undefined, "inside by the building's name: no room is known yet");
    point(c.p0.name, c.market.name); atlasFollow(); assert.equal(A.at, c.townId); assert.equal(A.spot, c.market.id);
    assert.deepEqual(recOf(A, c.townId), { at: ["t:" + c.inn.id, "t:" + c.market.id], legs: [leg("t:" + c.inn.id, "t:" + c.market.id)] }, "the walk from the inn to the market is a leg on the town's sheet");
    assert.deepEqual(recOf(A, A.seed), { at: ["t:" + c.p0.id], legs: [] }, "the realm's sheet saw no move: the party is still in that town");
    was = JSON.stringify(A.seen); atlasFollow(); atlasFollow(); assert.equal(JSON.stringify(A.seen), was, "following again records nothing");
    point(c.p1.name); atlasFollow();
    assert.deepEqual(recOf(A, A.seed), { at: ["t:" + c.p0.id, "t:" + c.p1.id], legs: [leg("t:" + c.p0.id, "t:" + c.p1.id)] }, "town to town is a leg on the realm");
    assert.equal(numbersIn(A.seen), 0, "the record holds ids, never a coordinate (a sheet redrawn by another engine or library moves its things, not their ids)");
    Object.keys(A.seen).forEach(function (z) { A.seen[z].at.forEach(function (k) { assert(/^(t|p):/.test(k), k); }); });
    /* off the map and back: the unknown ground between is no leg */
    was = walked(A); point("Nowhere the map knows"); atlasFollow(); assert(A.off && !A.off.within); assert.equal(walked(A), was, "a place off the map records nothing");
    point(c.p0.name); atlasFollow(); assert.equal(A.at, c.townId); assert.equal(walked(A), was, "back from off the map: both towns are on record already, and no new leg bridges the gap");
    /* …and on to a town the party has NOT been to (review, MU1: the walk back to p0 above cannot fail — its leg to p1 is on record already) */
    var p2 = c.reg.places[2], p3 = c.reg.places[3];
    point(p2.name); atlasFollow(); assert(recOf(A, A.seed).legs.some(function (l) { return l.join() === leg("t:" + c.p0.id, "t:" + p2.id).join(); }), "a walk on the map: p0 to p2 is a leg");
    point("Nowhere the map knows"); atlasFollow(); point(p3.name); atlasFollow(); assert.equal(A.at, A.seed + "/" + p3.id);
    assert(recOf(A, A.seed).at.indexOf("t:" + p3.id) >= 0, "the town reached is a stand");
    assert(!recOf(A, A.seed).legs.some(function (l) { return l.indexOf("t:" + p3.id) >= 0; }), "no leg reaches it across the stretch off the map: " + JSON.stringify(recOf(A, A.seed).legs));
    /* the record is a set: the same walk a hundred times is the same record */
    for (var i = 0; i < 100; i++) { point(c.p0.name, i % 2 ? c.inn.name : c.market.name); atlasFollow(); }
    assert.deepEqual(recOf(A, c.townId).legs, [leg("t:" + c.inn.id, "t:" + c.market.id)], "a hundred walks of one street: one leg (bounded by the sheet's things, not by play time)");
    assert.equal(A.seen[c.townId].at.length, 2);
  });

  test("#717 the reveal on a drawn sheet: the ground within the sheet's own radius of every recorded stand and of the way between two of them — the road on the realm, the streets in a town — plus the ground under the marker as it stands now; a recorded stand stays when the party leaves", function () {
    var A = fresh(), c = cast(A), r, road, street;
    assert.deepEqual(atlasReveal(A.seed), { points: [], paths: [], radiusM: ATLAS_FOG.region.radiusM }, "not placed yet: the whole realm is fog");
    assert(ATLAS_FOG.town.radiusM === 100 && ATLAS_FOG.wild.radiusM === 100 && ATLAS_FOG.region.radiusM >= 2000 && ATLAS_FOG.region.radiusM <= 10000, "owner 2026-11-09: about 100 m in a town, a few km on the realm");
    point(c.p0.name); atlasFollow(); townCast(A, c);
    assert.deepEqual(atlasReveal(A.seed), { points: [[c.p0.x, c.p0.y]], paths: [], radiusM: ATLAS_FOG.region.radiusM });
    assert.deepEqual(atlasReveal(c.townId), { points: [atlasCentre(c.town)], paths: [], radiusM: 100 }, "somewhere in the town: the ground under the marker is shown, though nothing is on record");
    point(c.p0.name, c.inn.name); atlasFollow();
    assert.deepEqual(atlasReveal(c.townId).points, [[c.inn.x, c.inn.y]], "the middle of the town was never a known stand: it is not kept");
    point(c.p0.name, c.market.name); atlasFollow();
    r = atlasReveal(c.townId); street = legRoute(c.town, A.seen[c.townId].legs[0]);
    assert.equal(street.via, "street", "the fixture's inn and market are joined by streets"); assert(street.points.length > 2);
    assert.deepEqual(r, { points: [[c.inn.x, c.inn.y], [c.market.x, c.market.y]], paths: street.paths, radiusM: 100 }, "the two stands and the streets between them");
    point(c.p1.name); atlasFollow();
    r = atlasReveal(A.seed); road = legRoute(c.reg, A.seen[A.seed].legs[0]);
    assert.equal(road.via, "road"); assert.deepEqual(r, { points: [[c.p0.x, c.p0.y], [c.p1.x, c.p1.y]], paths: road.paths, radiusM: ATLAS_FOG.region.radiusM }, "the two towns and the road between them");
    assert.deepEqual(atlasReveal(c.townId), { points: [[c.inn.x, c.inn.y], [c.market.x, c.market.y]], paths: street.paths, radiusM: 100 }, "the town the party left keeps what it showed: fog never returns over a recorded stand");
    [A.seed, c.townId, A.at].forEach(function (z) { var spec = atlasReveal(z); TnDMaps.scene.fog.spec(spec); TnDMaps.scene.build(atlasDoc(z), "ink", { reveal: spec }); });
    /* a reveal is a read: nothing it does is written */
    var s = JSON.stringify(worldState.atlas); atlasReveal(A.seed); atlasReveal(c.townId); assert.equal(JSON.stringify(worldState.atlas), s, "a read never writes the campaign");
    /* a party off the map: the last mapped place keeps its ground (its marker is still drawn there) */
    point("Nowhere the map knows"); atlasFollow(); assert(atlasPartyIn(A.at).last);
    assert.deepEqual(atlasReveal(A.at).points, [atlasCentre(atlasDoc(A.at))], "the 'last mapped place' marker never sits on blank paper");
  });

  test("#717 room by room under a roof and under the ground: a building shows the rooms the party stood in and those it walked through between them, a dungeon its ways up besides — whole rooms by id, nothing by distance", function () {
    var A = fresh(), c = cast(A), innZone, idoc, once, a, b, ids, innIds, way, on, sewer, sdoc, ups, all, deep, sway, son;
    point(c.p0.name); atlasFollow(); townCast(A, c);
    point(c.p0.name, c.inn.name); atlasFollow(); innZone = A.at; idoc = atlasDoc(innZone);
    assert.deepEqual(atlasReveal(innZone), [], "inside by the building's name, no room known: the outline alone");
    once = idoc.rooms.filter(function (r) { return idoc.rooms.filter(function (q) { return atlasNameKey(q.name) === atlasNameKey(r.name); }).length === 1 && !/^(passage|stair)/.test(r.id); });
    a = once.filter(function (r) { return r.floor === 0; })[0]; b = once.filter(function (r) { return r.floor !== 0; })[0];
    assert(a && b, "the fixture inn has a once-named room on the ground floor and one on another floor");
    point(c.p0.name, a.name); atlasFollow(); assert.equal(A.spot, a.id);
    assert.deepEqual(atlasReveal(innZone), [a.id], "the room the party stands in");
    point(c.p0.name, b.name); atlasFollow(); assert.equal(A.spot, b.id);
    assert.deepEqual(recOf(A, innZone), { at: ["t:" + a.id, "t:" + b.id], legs: [leg("t:" + a.id, "t:" + b.id)] });
    ids = atlasReveal(innZone); way = legRoute(idoc, A.seen[innZone].legs[0]); on = crossed(idoc, "interior", way.paths);
    assert.equal(way.via, "doors"); assert(way.paths.length >= 2, "another floor: the way crosses a stair, one path a floor");
    assert(ids.indexOf(a.id) >= 0 && ids.indexOf(b.id) >= 0, "both rooms");
    way.paths.forEach(function (p) { p.forEach(function (q) { var id = TnDMaps.interior.locate(idoc, q); if (id != null) assert(ids.indexOf(id) >= 0, "a room the way turns in is shown: " + id); }); });
    ids.forEach(function (id) { assert(on[id] || id === a.id || id === b.id, id + " is shown but the way does not cross it"); });
    assert(ids.length > 2 && ids.length < idoc.rooms.length, "the hall and the stair between are shown; the rest of the house is not: " + ids.length + " of " + idoc.rooms.length);
    assert.equal(ids.length, Object.keys(ids.reduce(function (m, id) { m[id] = 1; return m; }, {})).length, "no id twice");
    TnDMaps.scene.build(idoc, "ink", { reveal: ids }); innIds = ids;
    /* under the ground: the ways up are known from the sheet above */
    point(c.p0.name, c.grates[0].name); atlasFollow(); sewer = A.at; sdoc = atlasDoc(sewer);
    all = sdoc.portals.filter(function (p) { return p.way === "up"; }).map(function (p) { return p.id; }); ups = waysShown(c.townId, c.town, sdoc);
    assert(ups.indexOf(A.spot) >= 0 && ups.length < all.length, "fixture: the town's sheet shows the grate the party went down and hides another");
    assert.deepEqual(atlasReveal(sewer).slice().sort(), ups.slice().sort(), "the ways up the sheet above shows — the party stands at one of them — and no way the town's fog hides (review finding 2)");
    deep = sdoc.rooms.filter(function (r) { return all.indexOf(r.id) < 0 && sdoc.rooms.filter(function (q) { return atlasNameKey(q.name) === atlasNameKey(r.name); }).length === 1 && !atlasFind(c.town, r.name); })[0];
    point(c.p0.name, deep.name); atlasFollow(); assert.equal(A.spot, deep.id);
    ids = atlasReveal(sewer); sway = legRoute(sdoc, A.seen[sewer].legs[0]); son = crossed(sdoc, "dungeon", sway.paths);
    assert.equal(sway.via, "passage"); ups.concat([deep.id]).forEach(function (id) { assert(ids.indexOf(id) >= 0, id); });
    assert(ids.some(function (id) { return sdoc.passages.some(function (p) { return p.id === id; }); }), "the passages walked are shown");
    ids.forEach(function (id) { assert(son[id] || ups.indexOf(id) >= 0 || id === deep.id, id + " is shown but the way does not cross it"); });
    assert(ids.length < sdoc.rooms.length + sdoc.passages.length, "the rest of the sewer is not shown");
    TnDMaps.scene.build(sdoc, "ink", { reveal: ids });
    /* the inn's record is the inn's: leaving it kept its rooms */
    assert.deepEqual(atlasReveal(innZone), innIds, "a room once stood in stays shown after the party has left the building");
  });

  test("#717 a campaign mapped before the fog starts from now: a store without a record heals to an empty one, each sheet shows the ground under the party as it stands, and the first move records the old stand, the new one and the way between", function () {
    var A = fresh(), c = cast(A);
    point(c.p0.name); atlasFollow(); townCast(A, c); point(c.p0.name, c.inn.name); atlasFollow(); point(c.p0.name, c.market.name); atlasFollow();
    delete A.seen;/* as a build before #717 saved it */
    assert.deepEqual(atlasReveal(c.townId), { points: [[c.market.x, c.market.y]], paths: [], radiusM: 100 }, "read before any heal: the marker's ground, and no throw");
    assert.equal(atlasHeal(), true); assert.deepEqual(plain(A.seen), {}); assert.equal(Object.getPrototypeOf(A.seen), null, "a keyed store");
    assert.equal(atlasHeal(), false, "healed once");
    assert.deepEqual(atlasReveal(c.townId), { points: [[c.market.x, c.market.y]], paths: [], radiusM: 100 }, "from now: where the party stands");
    assert.deepEqual(atlasReveal(A.seed), { points: [[c.p0.x, c.p0.y]], paths: [], radiusM: ATLAS_FOG.region.radiusM });
    point(c.p0.name, c.inn.name); atlasFollow();
    assert.deepEqual(recOf(A, c.townId), { at: ["t:" + c.market.id, "t:" + c.inn.id], legs: [leg("t:" + c.inn.id, "t:" + c.market.id)] }, "the first move keeps the stand the party left, the one it reached and the way between");
    assert.deepEqual(recOf(A, A.seed), { at: ["t:" + c.p0.id], legs: [] });
    /* the load door: a record for a zone that is gone is dropped, an unreadable one is dropped and SAID; the rest is kept */
    A.seen["campaign-1/gone"] = { at: ["t:x"], legs: [] }; A.seen[A.seed] = "junk"; quiet();
    assert.equal(atlasHeal(), true); assert.equal(A.seen["campaign-1/gone"], undefined); assert.equal(A.seen[A.seed], undefined);
    assert(toasts.some(function (t) { return /where the party has been/.test(t) && /could not be read/.test(t); }), toasts.join(" | "));
    assert.deepEqual(recOf(A, c.townId).legs, [leg("t:" + c.inn.id, "t:" + c.market.id)], "a readable record is untouched");
    assert.deepEqual(atlasReveal(A.seed).points, [[c.p0.x, c.p0.y]], "the realm starts from now again");
    /* review, MU7/MU8: the door reads every element — a leg that is no pair, a stand that is no key, a pointer that is no key */
    [{ at: ["t:a"], legs: [null] }, { at: [3], legs: [] }, { at: ["t:a"], legs: [["t:a"]] }, { at: [""], legs: [] }, { at: [], legs: [], last: 7 }, { at: "t:a", legs: [] }, null].forEach(function (junk) {
      A.seen[c.townId] = junk; quiet(); assert.equal(atlasHeal(), true, JSON.stringify(junk)); assert.equal(A.seen[c.townId], undefined, "dropped: " + JSON.stringify(junk));
      assert.equal(toasts.filter(function (t) { return /could not be read/.test(t); }).length, 1, "and said: " + JSON.stringify(junk)); TnDMaps.scene.fog.spec(atlasReveal(c.townId));
    });
    A.seen[c.townId] = { at: ["t:" + c.inn.id], legs: [], last: "t:" + c.inn.id }; quiet(); assert.equal(atlasHeal(), false, "a record with its pointer is readable"); assert.equal(toasts.length, 0);
    /* review finding 9: a WHOLE record that is junk is replaced and said; a store that never had one is replaced quietly (ruling 4) */
    ["junk", 7, [1, 2]].forEach(function (junk) { A.seen = junk; quiet(); assert.equal(atlasHeal(), true); assert.deepEqual(plain(A.seen), {}); assert.equal(toasts.filter(function (t) { return /where the party has been/.test(t) && /could not be read/.test(t); }).length, 1, "said: " + JSON.stringify(junk)); });
    delete A.seen; quiet(); assert.equal(atlasHeal(), true); assert.equal(toasts.length, 0, "a campaign mapped before the fog: nothing to say");
  });

  test("#717 the record is saved with the campaign: it survives the save round trip as a keyed store, and every sheet shows the same ground after a load", function () {
    var A = fresh(), c = cast(A), before = {}, B;
    point(c.p0.name); atlasFollow(); townCast(A, c); point(c.p0.name, c.inn.name); atlasFollow(); point(c.p0.name, c.market.name); atlasFollow(); point(c.p1.name); atlasFollow();
    Object.keys(A.zones).forEach(function (z) { before[z] = JSON.stringify(atlasReveal(z)); });
    assert(KEYED_STORE_PATHS.world.indexOf("atlas.seen") >= 0, "the record is a registered keyed store");
    worldState = parseWorldState(serializeWorldState(worldState)); migrateWorldState(); atlasForget(); quiet(); B = worldState.atlas;
    assert.equal(Object.getPrototypeOf(B.seen), null, "a keyed store after a load"); assert.deepEqual(plain(B.seen), plain(A.seen));
    Object.keys(B.zones).forEach(function (z) { assert.equal(JSON.stringify(atlasReveal(z)), before[z], z + " shows the same ground after a load"); });
    assert.equal(toasts.length, 0, "nothing to say after a clean load");
  });

  test("#717 a failure in the record never costs the party its place, and a way that cannot be found is drawn straight and said once", function () {
    var A = fresh(), c = cast(A), realRoute = TnDMaps.route, r;
    point(c.p0.name); atlasFollow(); townCast(A, c); point(c.p0.name, c.inn.name); atlasFollow(); quiet();
    Object.defineProperty(A, "seen", { configurable: true, get: function () { throw new Error("boom in the record"); } });
    try { point(c.p0.name, c.market.name); r = atlasFollow(); } finally { delete A.seen; A.seen = keyedDict(); }
    assert.equal(A.at, c.townId); assert.equal(A.spot, c.market.id); assert.equal(A.off, null, "the party stands where the story put it: a failed record is not a failed follow");
    assert.equal(r.changed, true);
    assert(toasts.some(function (t) { return /recording where the party has been/.test(t) && /boom in the record/.test(t); }), toasts.join(" | "));
    assert(reports.some(function (x) { return /boom in the record/.test(x); }), "reported once: the phone's console is invisible");
    /* the read side: the library refusing a route is not a blank sheet */
    point(c.p0.name, c.inn.name); atlasFollow(); assert.equal(A.seen[c.townId].legs.length, 1); quiet();
    TnDMaps.route = function () { throw new Error("TnDMaps: no network today"); };
    try { r = atlasReveal(c.townId); atlasReveal(c.townId); } finally { TnDMaps.route = realRoute; }
    assert.deepEqual(r.paths, [[[c.inn.x, c.inn.y], [c.market.x, c.market.y]]].map(function (p) { return A.seen[c.townId].legs[0][0] === "t:" + c.inn.id ? p : p.slice().reverse(); }), "the way is drawn straight between the two stands");
    TnDMaps.scene.fog.spec(r);
    assert.equal(warns.filter(function (w) { return /way between/.test(w) && /no network today/.test(w); }).length, 1, "said once per campaign per session, not at every paint: " + warns.join(" | "));
    /* a stand whose thing has left the sheet is skipped, never a throw */
    A.seen[c.townId].at.push("t:no-such-thing"); A.seen[c.townId].legs.push(leg("t:no-such-thing", "t:" + c.inn.id));
    r = atlasReveal(c.townId); assert.equal(r.points.length, 2); assert.equal(r.paths.length, 1); TnDMaps.scene.fog.spec(r);
    /* a leg that is no pair, in memory with no load door between (the reviewer's H4: the read threw): skipped, the sheet still drawn */
    A.seen[c.townId].legs.push(null); A.seen[c.townId].legs.push("t:x"); r = atlasReveal(c.townId); assert.equal(r.paths.length, 1); TnDMaps.scene.fog.spec(r); assert.equal(atlasFogShows(c.townId, c.inn.x, c.inn.y), true);
  });

  test("#717 the switch and the prompt: a campaign with the fog off shows every sheet whole and still keeps its record; the MAP block the GM reads is the same to the byte with the fog on, off, and with no record at all", function () {
    var A = fresh(), c = cast(A), on, held;
    point(c.p0.name); atlasFollow(); townCast(A, c); point(c.p0.name, c.inn.name); atlasFollow(); point(c.p0.name, c.market.name); atlasFollow();
    on = atlasMapBlock(); assert(on.indexOf("MAP (") === 0 && on.length > 400);
    assert.equal(/fog|unexplored|not yet seen/i.test(on), false, "the GM is told the whole sheet: the fog is the player's");
    A.fog = false;
    [A.seed, c.townId, c.townId + "/" + c.inn.id].forEach(function (z) { assert.equal(atlasReveal(z), null, z + " is whole with the fog off"); });
    assert.equal(atlasMapBlock(), on, "fog off: the same block");
    point(c.p0.name, c.inn.name); atlasFollow(); assert.equal(A.seen[c.townId].at.length, 2, "the record is kept while the fog is off, so switching it on shows what was travelled");
    point(c.p0.name, c.market.name); atlasFollow();
    delete A.fog; assert.equal(atlasReveal(c.townId).paths.length, 1);
    held = A.seen; A.seen = keyedDict(); assert.equal(atlasMapBlock(), on, "no record: the same block"); A.seen = held;
    assert.equal(atlasMapBlock(), on);
    /* the region's sheet is served to the GM unfogged too */
    point(c.p1.name); atlasFollow(); on = atlasMapBlock(); A.fog = false; assert.equal(atlasMapBlock(), on);
  });

  test("#717 a tap on unexplored ground says nothing: open country has a card only where the sheet shows it, and the sea is not told through the fog", function () {
    var A = fresh(), c = cast(A), far, nearCard;
    point(c.p0.name); atlasFollow();
    assert.equal(atlasFogShows(A.seed, c.p0.x + 6, c.p0.y + 4), true, "a few km from the town: inside the revealed ground");
    nearCard = atlasCard(A.seed, { x: c.p0.x + 6, y: c.p0.y + 4 }); assert(nearCard && nearCard.title === "Open country", JSON.stringify(nearCard));
    far = shorePoint(c.reg); assert(far, "the fixture realm has open water");
    assert.equal(atlasFogShows(A.seed, far[0], far[1]), false, "the far shore is unexplored");
    assert.equal(atlasCard(A.seed, { x: far[0], y: far[1] }), null, "no card through the fog — not even 'that point lies in the sea'");
    A.fog = false; assert.equal(atlasFogShows(A.seed, far[0], far[1]), true); assert(atlasCard(A.seed, { x: far[0], y: far[1] }).refused, "with the fog off the sea says why it cannot be stood on, as before");
    delete A.fog;
    /* the edge of the radius, measured by the sheet's own scale */
    var u = ATLAS_FOG.region.radiusM / (c.reg.frame.kmPerUnit * 1000);
    assert.equal(atlasFogShows(A.seed, c.p0.x + u - 0.01, c.p0.y), true); assert.equal(atlasFogShows(A.seed, c.p0.x + u + 0.01, c.p0.y), false);
    assert.equal(atlasFogShows("no-such-zone", 1, 1), false);
  });

  test("#717 an addition the player's tap puts away takes its record with it: no stand points at a thing that is gone, and the sheet behind it is forgotten", function () {
    var S = start(), T = S.T, A = S.A, c = S.c, spur, id, r, rooms;
    turn("[SUBLOCATION:" + c.market.name + "] The square."); turn("[SUBLOCATION:The Gilded Spur] A tavern the story knows."); spur = A.at; id = A.zones[spur].via;
    assert.equal(A.zones[spur].kind, "interior"); assert(A.seen[c.townId].at.indexOf("t:" + id) >= 0, "the added tavern is a stand on the town");
    assert(A.seen[c.townId].legs.some(function (l) { return l.indexOf("t:" + id) >= 0; }), "and the walk to it from the market is a leg");
    rooms = atlasDoc(spur).rooms.filter(function (q) { return atlasDoc(spur).rooms.filter(function (x) { return atlasNameKey(x.name) === atlasNameKey(q.name); }).length === 1 && !/^(passage|stair)/.test(q.id); }).slice(0, 2);
    rooms.forEach(function (q) { turn("[SUBLOCATION:" + q.name + "] Through."); }); assert(rooms.length === 2 && recOf(A, spur) && recOf(A, spur).at.length === 2, "the tavern has a record of its own: two rooms stood in — " + JSON.stringify(recOf(A, spur)));
    turn("[SUBLOCATION:The Gilded Spur] Back to the taproom door."); assert.equal(sub(), "The Gilded Spur");
    r = atlasPlace(c.townId, { id: c.inn.id }); assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(A.zones[spur], undefined, "the addition and its sheet are gone");
    assert.equal(A.seen[spur], undefined, "the sheet's record went with it");
    assert.equal(JSON.stringify(A.seen).indexOf("t:" + id + "\""), -1, "no stand or leg names the thing that is gone: " + JSON.stringify(A.seen[c.townId]));
    assert(A.seen[c.townId].at.indexOf("t:" + c.market.id) >= 0 && A.seen[c.townId].at.indexOf("t:" + c.inn.id) >= 0, "the market and the inn the player named are kept");
    TnDMaps.scene.fog.spec(atlasReveal(c.townId));
  });

  /* ── #717, the independent review of ab55473b (audits/AUDIT_2026-11-09_717_review.md) ──────────────────────────── */
  test("#717 review: a walk made wholly inside a zone is no walk on the sheet above (finding 1): down one grate and along the sewer to another, the town gains no stand and no leg, with or without a chamber between; the marker's ground is still shown; coming up, the walk runs from the way the party came up", function () {
    var A = fresh(), c = cast(A), g0, g1, sewer, sdoc, deep, before, r;
    point(c.p0.name); atlasFollow(); townCast(A, c); g0 = c.grates[0]; g1 = c.grates[1];
    point(c.p0.name, c.market.name); atlasFollow(); point(c.p0.name, g0.name); atlasFollow(); sewer = A.at; sdoc = atlasDoc(sewer);
    assert.equal(A.zones[sewer].kind, "dungeon"); before = JSON.stringify(recOf(A, c.townId));
    assert.deepEqual(recOf(A, c.townId), { at: ["t:" + c.market.id, "t:" + g0.id], legs: [leg("t:" + c.market.id, "t:" + g0.id)] }, "from the market to the grate, on the street: a leg");
    point(c.p0.name, g1.name); atlasFollow(); assert.equal(A.at, sewer, "still below"); assert.equal(A.spot, g1.id, "at the foot of the second grate");
    assert.equal(atlasPartyIn(c.townId).key, "t:" + g1.id, "the town's sheet shows the party at the grate it stands under");
    assert.equal(JSON.stringify(recOf(A, c.townId)), before, "the town's record is as it was: the story never put the party on a street between the two grates");
    assert.deepEqual(recOf(A, sewer).legs, [leg("t:" + g0.id, "t:" + g1.id)], "the walk is the sewer's own");
    r = atlasReveal(c.townId); assert.equal(r.paths.length, 1, "one way on the town: market to the first grate");
    assert(r.points.some(function (p) { return p[0] === g1.x && p[1] === g1.y; }), "the marker never sits on blank paper: the ground under it is shown while it stands there");
    /* with a chamber between (the reviewer's weaker sibling: the far grate was recorded as a stand of the town from below) */
    deep = sdoc.rooms.filter(function (q) { return !sdoc.portals.some(function (p) { return p.id === q.id; }) && sdoc.rooms.filter(function (x) { return atlasNameKey(x.name) === atlasNameKey(q.name); }).length === 1 && !atlasFind(c.town, q.name); })[0];
    point(c.p0.name, deep.name); atlasFollow(); assert.equal(A.spot, deep.id); point(c.p0.name, g0.name); atlasFollow(); assert.equal(A.at, sewer); point(c.p0.name, deep.name); atlasFollow(); point(c.p0.name, g1.name); atlasFollow();
    assert.equal(JSON.stringify(recOf(A, c.townId)), before, "through a chamber and back to either grate: still nothing on the town");
    /* surfacing: the party climbs out (the pointer leaves the sewer) and walks to the inn — from the grate it came up, never the one it went down */
    point(c.p0.name); atlasFollow(); assert.equal(A.at, c.townId); assert.equal(A.spot, null);
    assert.equal(JSON.stringify(recOf(A, c.townId)), before, "somewhere in the town: nothing recorded");
    point(c.p0.name, c.inn.name); atlasFollow();
    assert(recOf(A, c.townId).legs.some(function (l) { return l.join() === leg("t:" + g1.id, "t:" + c.inn.id).join(); }), "the walk to the inn starts at the second grate: " + JSON.stringify(recOf(A, c.townId).legs));
    assert(!recOf(A, c.townId).legs.some(function (l) { return l.join() === leg("t:" + g0.id, "t:" + g1.id).join(); }), "and no leg ever joined the two grates on the street");
    assert(!recOf(A, c.townId).legs.some(function (l) { return l.join() === leg("t:" + g0.id, "t:" + c.inn.id).join(); }));
  });

  test("#717 review: the path of ruling 2 holds across a [SUBLOCATION_LEAVE] (finding 3): on a sheet the party has not left, a walk runs from the LAST place it was known to stand; it never bridges a place off the map, a sheet left and re-entered, or a first arrival by name", function () {
    var S = start(false), A = S.A, c = S.c, other;
    turn("[SUBLOCATION:" + c.inn.name + "] In."); turn("[SUBLOCATION_LEAVE] Out to the street."); assert.equal(sub(), null); assert.equal(A.at, c.townId); assert.equal(A.spot, null, "somewhere in the town");
    assert.deepEqual(recOf(A, c.townId), { at: ["t:" + c.inn.id], legs: [] }); assert.equal(A.seen[c.townId].last, "t:" + c.inn.id, "the sheet remembers where the party last stood");
    turn("[SUBLOCATION:" + c.market.name + "] To the market.");
    assert.deepEqual(recOf(A, c.townId), { at: ["t:" + c.inn.id, "t:" + c.market.id], legs: [leg("t:" + c.inn.id, "t:" + c.market.id)] }, "inn, out, market: the streets between are the path to it from the previous location");
    /* a place off the map in between: the ground between is not known */
    turn("[SUBLOCATION:The Rusty Flagon] A tavern the map does not have."); assert(A.off && A.off.within === c.townId, "off the map, in the town: " + JSON.stringify(A.off)); assert.equal(A.seen[c.townId].last, undefined, "the thread is cut");
    other = c.town.establishments.filter(function (e) { return e.id !== c.inn.id && c.town.establishments.filter(function (q) { return atlasNameKey(q.name) === atlasNameKey(e.name); }).length === 1; })[0];
    turn("[SUBLOCATION:" + other.name + "] On."); assert(recOf(A, c.townId).at.indexOf("t:" + other.id) >= 0);
    assert(!recOf(A, c.townId).legs.some(function (l) { return l.indexOf("t:" + other.id) >= 0; }), "no leg bridges the place the map does not know: " + JSON.stringify(recOf(A, c.townId).legs));
    /* the sheet left and re-entered by name: the walk does not run from the stand before the journey */
    turn("[LOCATION:" + c.p1.name + "] Away."); assert.equal(A.seen[c.townId].last, undefined, "leaving the town cuts its thread");
    turn("[LOCATION:" + c.p0.name + "] Back."); turn("[SUBLOCATION:" + c.market.name + "] The market again.");
    assert.equal(recOf(A, c.townId).legs.length, 1, "back by name, then the market: no leg from the place the party stood at before it left — " + JSON.stringify(recOf(A, c.townId).legs));
    assert.equal(A.seen[c.townId].last, "t:" + c.market.id);
    /* a first arrival by name: nothing to walk from */
    assert.deepEqual(recOf(A, A.seed + "/" + c.p1.id), undefined, "the other town was entered by name and left: nothing recorded");
  });

  test("#717 review: a door the map knows shows the room it opens into (finding 7), and 'somewhere here' shows no room at all — not the one under the sheet's middle (MU3)", function () {
    var A = fresh(), c = cast(A), houses, one, mid, d, into, z, ids, cx;
    point(c.p0.name); atlasFollow(); townCast(A, c);
    houses = c.town.portals.filter(function (p) { return p.to && p.to.generator === "interior"; }).map(function (p) { var doc = TnDMaps.generate("interior", TnDMaps.interior.fromTown(c.town, p.id)), outs = doc.portals.filter(function (q) { return q.way === "out"; }); return { p: p, doc: doc, outs: outs }; });
    /* a house with ONE door, where the door's own point lies on the wall (no room under it) */
    one = houses.filter(function (h) { return h.outs.length === 1 && TnDMaps.interior.locate(h.doc, [h.outs[0].x, h.outs[0].y]) == null; })[0];
    assert(one, "fixture: the capital has a one-door house whose door lies on the wall");
    d = one.doc.doors.filter(function (q) { return q.x === one.outs[0].x && q.y === one.outs[0].y; })[0]; into = d && d.into; assert(into, "the library says which room that door opens into");
    point(c.p0.name, one.p.name); atlasFollow(); z = A.at; assert.equal(A.zones[z].kind, "interior"); assert.equal(A.spot, one.outs[0].id, "through its one door: the party stands at it, exactly");
    assert.deepEqual(atlasReveal(z), [into], "the room the door opens into is shown: a marker never sits on a blank sheet");
    /* a sheet whose middle lies in a room, entered where the map does not know the spot */
    mid = houses.filter(function (h) { cx = atlasCentre(h.doc); return h.outs.length > 1 && TnDMaps.interior.locate(h.doc, cx) != null; })[0];
    assert(mid, "fixture: the capital has a two-door house whose middle lies in a room");
    point(c.p0.name, mid.p.name); atlasFollow(); z = A.at; assert.equal(A.spot, null, "two doors: somewhere inside"); ids = atlasReveal(z);
    assert.deepEqual(ids, [], "somewhere here: the outline alone — the room under the marker is not known to be where the party is (" + TnDMaps.interior.locate(mid.doc, atlasCentre(mid.doc)) + ")");
  });

  test("#717 review: a thing that bears the player's note is always shown (finding 4) — on a drawn sheet, in a building, and a noted way down shows its foot below (finding 2: a way up is drawn when the sheet above shows it)", function () {
    var A = fresh(), c = cast(A), far, g1, sewer, sdoc, innZone, idoc, room;
    point(c.p0.name); atlasFollow(); townCast(A, c);
    far = c.town.establishments.map(function (e) { return { e: e, d: Math.sqrt(Math.pow(e.x - atlasCentre(c.town)[0], 2) + Math.pow(e.y - atlasCentre(c.town)[1], 2)) }; }).sort(function (a, b) { return b.d - a.d; })[0].e;
    assert.equal(atlasFogShows(c.townId, far.x, far.y), false, "fixture: a house far from the party is under the fog");
    assert.equal(atlasNoteSet(c.townId, far.id, "Ask here about the missing ledger.").ok, true);
    assert.equal(atlasFogShows(c.townId, far.x, far.y), true, "a noted place is shown: the player's own words stay within reach");
    assert(atlasReveal(c.townId).points.some(function (p) { return p[0] === far.x && p[1] === far.y; }));
    assert.equal(recOf(A, c.townId), undefined, "a note is no stand: nothing is written to the record");
    atlasNoteSet(c.townId, far.id, ""); assert.equal(atlasFogShows(c.townId, far.x, far.y), false, "the note removed, the fog closes again");
    /* the realm, for a campaign mapped before the fog (ruling 4): a note on a town the party is not in */
    atlasNoteSet(A.seed, c.p1.id, "Owed a favour here."); assert.equal(atlasFogShows(A.seed, c.p1.x, c.p1.y), true); TnDMaps.scene.fog.spec(atlasReveal(A.seed));
    /* a way down the town's sheet shows is a way up the sewer's sheet shows — and only then */
    point(c.p0.name, c.grates[0].name); atlasFollow(); sewer = A.at; sdoc = atlasDoc(sewer);
    /* the way up the town's sheet HIDES (in the fixture capital the two grates lie 36 m apart; the outfall is beyond the wall) */
    g1 = sdoc.portals.filter(function (p) { var t = p.way === "up" && p.to ? atlasThingById(c.town, p.to.id) : null; return !!t && !atlasFogShows(c.townId, t.x, t.y); }).map(function (p) { return atlasThingById(c.town, p.to.id); })[0];
    assert(g1, "fixture: one way up of the sewer lies under the town's fog"); assert.equal(atlasReveal(sewer).indexOf(g1.id), -1, "so its foot is not drawn below");
    atlasNoteSet(c.townId, g1.id, "A way down."); assert.equal(atlasFogShows(c.townId, g1.x, g1.y), true); assert(atlasReveal(sewer).indexOf(g1.id) >= 0, "noted on the town, it is shown there — and so is its foot below");
    atlasNoteSet(c.townId, g1.id, ""); assert.equal(atlasReveal(sewer).indexOf(g1.id), -1);
    /* a building: a noted room is in the list */
    point(c.p0.name, c.inn.name); atlasFollow(); innZone = A.at; idoc = atlasDoc(innZone); room = idoc.rooms.filter(function (q) { return !/^(passage|stair)/.test(q.id); })[0];
    assert.deepEqual(atlasReveal(innZone), []); atlasNoteSet(innZone, room.id, "The loose board."); assert.deepEqual(atlasReveal(innZone), [room.id], "a noted room is drawn");
    TnDMaps.scene.build(idoc, "ink", { reveal: atlasReveal(innZone) });
    var s = JSON.stringify(A.seen); atlasReveal(innZone); atlasReveal(c.townId); assert.equal(JSON.stringify(A.seen), s);
  });

  test("#717 review: open country is a stand of the realm by its zone, read back after the party leaves, with the walk to a town; the wild sheet itself is fogged, and a walk between two of its things follows its track (MU4, MU5, MU13)", function () {
    var A = fresh(), c = cast(A), z, wz, wdoc, things, r, key, w;
    point("Open country"); atlasFollow(); assert.equal(atlasPlace(A.seed, { x: c.p0.x + 6, y: c.p0.y + 4 }).ok, true); wz = A.at; assert.equal(A.zones[wz].kind, "wild");
    z = TnDMaps.wild.zoneAt(c.reg, [c.p0.x + 6, c.p0.y + 4]); key = "p:wild:" + z.id;
    assert.deepEqual(recOf(A, A.seed), { at: [key], legs: [] }, "the realm records the stretch of country by its zone — a key no thing of the sheet bears");
    wdoc = atlasDoc(wz); r = atlasReveal(wz);
    assert.deepEqual(r, { points: [atlasCentre(wdoc)], paths: [], radiusM: ATLAS_FOG.wild.radiusM }, "the wild sheet is fogged like any drawn sheet: the ground under the marker");
    things = (wdoc.features || []).filter(function (t) { return wdoc.features.filter(function (q) { return atlasNameKey(q.name) === atlasNameKey(t.name); }).length === 1 && !atlasFind(c.reg, t.name); }).slice(0, 2);
    assert.equal(things.length, 2, "fixture: the wild zone has two once-named things");
    point("Open country", things[0].name); atlasFollow(); assert.equal(A.spot, things[0].id); point("Open country", things[1].name); atlasFollow(); assert.equal(A.spot, things[1].id);
    r = atlasReveal(wz); w = TnDMaps.route(wdoc, [things[0].x, things[0].y], [things[1].x, things[1].y]);
    assert.deepEqual(recOf(A, wz).legs, [leg("t:" + things[0].id, "t:" + things[1].id)]); assert.equal(r.radiusM, 100); assert.equal(r.paths.length, w.paths.length); TnDMaps.scene.fog.spec(r); TnDMaps.scene.build(wdoc, "ink", { reveal: r });
    /* on to the town: the realm keeps the open country, and the walk from it */
    point(c.p0.name); atlasFollow(); assert.equal(A.at, c.townId);
    assert.deepEqual(recOf(A, A.seed), { at: [key, "t:" + c.p0.id], legs: [leg(key, "t:" + c.p0.id)] });
    r = atlasReveal(A.seed); assert.deepEqual(r.points, [[z.cx, z.cy], [c.p0.x, c.p0.y]], "read back from the key after the party has left: the zone's own middle"); assert.equal(r.paths.length >= 1, true);
    assert.equal(atlasFogShows(A.seed, z.cx, z.cy), true); TnDMaps.scene.fog.spec(r); TnDMaps.scene.build(c.reg, "ink", { reveal: r });
  });

  test("#717 review: a tap on the road the party walked has a card far from both towns, and a tap off it has none (MU6, MU16: the judgment reads the ways, and only the shown ground)", function () {
    var A = fresh(), c = cast(A), road, mid, off = null, u, i, k, best = null, d, cand;
    function seg(p, a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0; return Math.sqrt(Math.pow(p[0] - a[0] - t * dx, 2) + Math.pow(p[1] - a[1] - t * dy, 2)); }
    function toRoad(p) { var m = Infinity, j; for (j = 1; j < road.points.length; j++) m = Math.min(m, seg(p, road.points[j - 1], road.points[j])); return m; }
    point(c.p0.name); atlasFollow(); point(c.p1.name); atlasFollow();
    road = legRoute(c.reg, A.seen[A.seed].legs[0]); assert.equal(road.via, "road"); u = ATLAS_FOG.region.radiusM / (c.reg.frame.kmPerUnit * 1000);
    for (i = 0; i < road.points.length; i++) { d = Math.min(dist(road.points[i], [c.p0.x, c.p0.y]), dist(road.points[i], [c.p1.x, c.p1.y])); if (!best || d > best.d) best = { p: road.points[i], d: d }; }
    mid = best.p; assert(best.d > 3 * u, "fixture: a point of the road lies well beyond the radius from both towns (" + Math.round(best.d / u) + " radii)");
    assert.equal(atlasFogShows(A.seed, mid[0], mid[1]), true, "the road walked is shown ground");
    for (k = 0; k < 16 && !off; k++) { cand = [mid[0] + 3 * u * Math.cos(k * Math.PI / 8), mid[1] + 3 * u * Math.sin(k * Math.PI / 8)]; if (toRoad(cand) > 2 * u && cand[0] > 0 && cand[1] > 0 && cand[0] < c.reg.frame.width && cand[1] < c.reg.frame.height) off = cand; }
    assert(off, "fixture: a point two radii clear of every stretch of the road");
    assert.equal(atlasFogShows(A.seed, off[0], off[1]), false, "beside the road, beyond the radius: not shown, though two stands and a way are on record");
    assert.equal(atlasCard(A.seed, { x: off[0], y: off[1] }), null);
  });

  test("#717 review: a house the engine redraws larger drops its own record (finding 11): the rooms are renumbered, so a key made before the growth would name another room", function () {
    var S = start(), A = S.A, c = S.c, spur, ed, gens, i, grew = 0, before;
    turn("[SUBLOCATION:" + c.market.name + "] The square."); turn("[SUBLOCATION:The Gilded Spur] In."); spur = A.at;
    ed = edits(A, c.townId).filter(function (e) { return e.name === "The Gilded Spur"; })[0]; assert(ed && ed.footprint !== "large", "the added house starts below large");
    gens = atlasDoc(spur).rooms.filter(function (q) { return atlasDoc(spur).rooms.filter(function (x) { return atlasNameKey(x.name) === atlasNameKey(q.name); }).length === 1 && !/^(passage|stair)/.test(q.id); }).slice(0, 2);
    gens.forEach(function (g) { turn("[SUBLOCATION:" + g.name + "] A room of the house."); }); before = recOf(A, spur); assert(before && before.at.length === 2, "two rooms on record before the growth");
    for (i = 1; i <= 12 && !grew; i++) { turn("[SUBLOCATION:Store Room " + i + "][LOCATION_DESC:Shelves.] A store."); if (ed.footprint === "large") grew = i; }
    assert(grew, "fixture: an invented room the medium house could not hold made it grow");
    before.at.forEach(function (k) { assert.equal((recOf(A, spur) || { at: [] }).at.indexOf(k) >= 0 && k !== "t:" + A.spot, false, k + " was recorded before the growth and must not be read against the redrawn rooms"); });
    assert(atlasReveal(spur).indexOf(A.spot) >= 0, "the room the party stands in is shown"); TnDMaps.scene.build(atlasDoc(spur), "ink", { reveal: atlasReveal(spur) });
    assert(A.seen[c.townId].at.indexOf("t:" + ed.id) >= 0, "the town's record of the house itself is kept: its id did not change");
  });

  test("#717 review: a sheet's ways are found once (finding 6): a second read asks the library for no route, a new leg asks for one, and a way that could not be found is asked for again", function () {
    var A = fresh(), c = cast(A), real = TnDMaps.route, calls = 0, r1, r2, other;
    point(c.p0.name); atlasFollow(); townCast(A, c); point(c.p0.name, c.inn.name); atlasFollow(); point(c.p0.name, c.market.name); atlasFollow();
    TnDMaps.route = function () { calls++; return real.apply(TnDMaps, arguments); };
    try {
      r1 = atlasReveal(c.townId); assert.equal(calls, 1, "one leg, one route"); r2 = atlasReveal(c.townId); assert.equal(calls, 1, "the second read routes nothing"); assert.deepEqual(r2, r1);
      atlasFogShows(c.townId, 1, 1); atlasFogShows(c.townId, 2, 2); assert.equal(calls, 1, "nor does a tap");
      var kept = JSON.stringify(r1); r2.paths[0][0][0] = -999; assert.equal(JSON.stringify(atlasReveal(c.townId)), kept, "a caller cannot write into the kept way (read as text: the two reads would share a written array)");
      other = c.town.establishments.filter(function (e) { return e.id !== c.inn.id && c.town.establishments.filter(function (q) { return atlasNameKey(q.name) === atlasNameKey(e.name); }).length === 1; })[0];
      point(c.p0.name, other.name); atlasFollow(); assert.equal(A.seen[c.townId].legs.length, 2); atlasReveal(c.townId); assert.equal(calls, 2, "a new leg is one more route");
      atlasForget(); atlasReveal(c.townId); assert.equal(calls, 4, "a redrawn sheet finds its ways again");
    } finally { TnDMaps.route = real; }
    /* a failure is not kept: the next read asks again */
    atlasForget(); calls = 0; quiet();
    TnDMaps.route = function () { calls++; throw new Error("TnDMaps: no network today"); };
    try { atlasReveal(c.townId); atlasReveal(c.townId); assert.equal(calls, 4, "two legs asked for at each read while the library refuses"); } finally { TnDMaps.route = real; }
    assert.equal(atlasReveal(c.townId).paths.length >= 2, true);
  });

  test("THE FIXTURE GATE: this library draws the fixture realm exactly as the pinned table says (region, town, interior, sewer, cave, wild)", function () {
    var A = fresh(), c = cast(A), got = {};
    point(c.p0.name); atlasFollow(); townCast(A, c);
    point(c.p0.name, c.inn.name); atlasFollow(); point(c.p0.name, c.grates[0].name); atlasFollow(); point(c.reg.caves[0].name); atlasFollow();
    point("Open country"); atlasFollow(); atlasPlace(A.seed, { x: c.p0.x + 6, y: c.p0.y + 4 });
    Object.keys(A.zones).forEach(function (id) { got[id] = A.zones[id].kind + " " + atlasFingerprint(atlasDoc(id), ATLAS_FIXTURES_STAMP); });
    if (process.env.ATLAS_FIXTURES === "print") console.log(JSON.stringify(got, null, 2));
    assert.deepEqual(got, ATLAS_FIXTURES, "the vendored library REDRAWS the fixture realm — every saved campaign's maps would change under it. Accept on purpose (ATLAS_FIXTURES=print), or fix the library.");
  });

  test("the turn's commit follows the committed pointer (a [LOCATION:] to a map name enters its town), and a campaign without an atlas commits as before", function () {
    var values = Object.create(null);
    global.store = { get: function (k) { return Object.prototype.hasOwnProperty.call(values, k) ? values[k] : null; }, set: function (k, v) { values[k] = String(v); }, del: function (k) { delete values[k]; } };
    global.syncUI = function () { }; global.addMsg = function () { }; global.generateActions = function () { };/* the buttons are DOM work */ global.storageAdapter = { syncToServer: function () { }, resetSyncState: function () { } };
    var A = fresh(), c = cast(A);
    commitGmTurn("The road ends at the gate. [LOCATION:" + c.p0.name + "]", { userMsg: "x", playerTxt: "I ride for the city." });
    assert.equal(worldState.world.location, c.p0.name); assert.equal(A.at, c.townId, "the commit entered the town");
    assert.equal(A.zones[c.townId].turn, worldState.turn, "stamped with the turn it was entered");
    engine.makeTestWorld(); atlasForget();
    assert.doesNotThrow(function () { commitGmTurn("The road goes on. [LOCATION:Nowhere]", { userMsg: "x", playerTxt: "on" }); });
    assert.equal(worldState.atlas, undefined, "no atlas is ever created by a turn");
    var game = src("game.js"), at = game.indexOf("function commitGmTurn("), body = game.slice(at, game.indexOf("\nfunction ", at + 10));
    assert(body.indexOf("atlasFollow()") > body.indexOf("applyMuts(resp"), "commitGmTurn follows AFTER the parser committed");
    assert(!/atlas(?:Follow|Doc|Adopt|KnowledgeCommit|PublicEnable)\s*\(/.test(src("tag_table.js")), "the parser never draws or publishes map state"); assert.equal(src("api.js").indexOf("atlasFollow"), -1, "nothing in api.js writes the atlas");
  });

  test("the load door heals the atlas (migrateWorldState), and the load order, the shell and the manifest carry atlas.js after identity.js and tndmaps.js", function () {
    var A = fresh();
    worldState.atlas = { v: 1, seed: "campaign-1", zones: {} }; quiet();
    migrateWorldState();
    assert.equal(worldState.atlas, undefined); assert(worldState.atlasJunk && /region recipe/.test(worldState.atlasJunk.why), "the load door set the unreadable store aside");
    var idx = src("index.html"), sw = src("sw.js"), man = require("./engine-manifest.js").map(function (e) { return e.file; });
    function at(f) { var i = idx.indexOf("<script src=\"" + f + "\">"); assert(i >= 0, f + " is not loaded by index.html"); return i; }
    assert(at("tndmaps.js") < at("atlas.js") && at("identity.js") < at("atlas.js") && at("atlas.js") < at("api.js") && at("atlas.js") < at("game.js"), "index.html order");
    var shell = sw.slice(sw.indexOf("var APP_SHELL = ["), sw.indexOf("];", sw.indexOf("var APP_SHELL = [")));
    assert(shell.indexOf("\"/atlas.js\"") >= 0, "atlas.js missing from APP_SHELL");
    assert(man.indexOf("atlas.js") > man.indexOf("identity.js") && man.indexOf("atlas.js") > man.indexOf("tndmaps.js"), "engine manifest order");
    assert(KEYED_STORE_PATHS.world.indexOf("atlas.zones") >= 0 && KEYED_STORE_PATHS.world.indexOf("atlas.names") >= 0, "the atlas's dictionaries are registered keyed stores");
  });

  /* ── #708 (owner 2026-11-07, design 3 of three): the START'S KIND is asked of the story. The Boundary Clearing — a split seam
     between wood and marsh in its blueprint — was adopted as a VILLAGE with an inn, a baker and a temple, because every world
     place added at the region level was drawn as a settlement. Now Begin marks the start's kind PENDING (A.kinds), the opening
     asks the model ONE line of JSON over the blueprint's description and the premise, and the adoption draws what the story
     says: a settlement at its size, OPEN country (a wild zone tied to the story's name, no edit), or a place INSIDE a named
     settlement (the settlement added, the place added within it, the name tied to that building). Nothing known = refused with
     the reason, never a guessed village. Design record: DOC/DESIGN_684_atlas.md ▸ "The start's kind is asked of the story". */
  function kindsOf(A) { return A.kinds || {}; }
  function wildPointsOf(reg, cap) { return atlasRegionPoints(reg, [cap.x, cap.y]).map(function (xy) { return TnDMaps.wild.zoneAt(reg, xy).id; }); }

  test("#708 the start's kind is asked of the story: the ask carries the name, the region, the blueprint's description and the premise and names the three kinds and the three sizes; the answer is one JSON line of kind, size and settlement — anything else is unreadable, never a guess", function () {
    var ask = atlasStartAsk({ name: "The Boundary Clearing", region: "The Tanglewood Borderlands", description: "A split seam where deep wood meets stagnant water.", premise: "Prince Auden is missing." }), p, long = "", i;
    assert(ask && typeof ask.system === "string" && typeof ask.user === "string", "an ask is {system, user}");
    ["settlement", "open", "inside", "city", "town", "village", "JSON"].forEach(function (w) { assert(ask.system.indexOf(w) >= 0, "the system names " + w); });
    ["The Boundary Clearing", "The Tanglewood Borderlands", "A split seam where deep wood meets stagnant water.", "Prince Auden is missing."].forEach(function (w) { assert(ask.user.indexOf(w) >= 0, "the user text carries " + w); });
    assert(/never invent/i.test(ask.system), "the model is told never to invent a settlement name");
    p = atlasStartAsk({ name: "Harrowmere", region: "", description: "", premise: "" }); assert(/no description/i.test(p.user), "no description is said, not left blank: " + p.user);
    for (i = 0; i < 300; i++) long += "words of a long description "; p = atlasStartAsk({ name: "X", region: "", description: long, premise: long });
    assert(p.user.length < 2400, "a long description and premise are cut for the ask: " + p.user.length);
    assert.deepEqual(atlasStartParse('{"kind":"open","size":null,"settlement":null}'), { kind: "open", size: null, settlement: null , ground: null });
    assert.deepEqual(atlasStartParse('Sure! {"kind":"settlement","size":"town"} — done'), { kind: "settlement", size: "town", settlement: null , ground: null }, "the JSON is read out of chatter");
    assert.deepEqual(atlasStartParse('{"kind":"settlement"}'), { kind: "settlement", size: "village", settlement: null , ground: null }, "a settlement without a size is a village");
    assert.deepEqual(atlasStartParse('{"kind":"settlement","size":"metropolis"}'), { kind: "settlement", size: "village", settlement: null , ground: null }, "a size the map cannot draw falls to village");
    assert.deepEqual(atlasStartParse('{"kind":"inside","size":"city","settlement":"  Sigil "}'), { kind: "inside", size: "city", settlement: "Sigil" , ground: null });
    assert.deepEqual(atlasStartParse('{"kind":"inside","settlement":"Sigil"}'), { kind: "inside", size: "town", settlement: "Sigil" , ground: null }, "a place inside a settlement of no stated size: a town");
    assert.deepEqual(atlasStartParse('{"kind":"inside","settlement":null}'), { kind: "inside", size: "town", settlement: null , ground: null }, "inside with no name is kept as such — the adoption refuses it, the parse does not invent");
    assert.deepEqual(atlasStartParse('{"kind":"open","size":"town","settlement":"Sigil"}'), { kind: "open", size: null, settlement: null , ground: null }, "open country has no size and no settlement");
    assert.equal(atlasStartParse('{"kind":"inside","settlement":12}').settlement, null, "a settlement that is not a string is none");
    assert.equal(atlasStartParse('{"kind":"inside","settlement":"' + long + '"}').settlement.length, 80, "a settlement name is cut at 80");
    [null, undefined, "", "I think it is a village", '{"kind":"castle"}', '{"size":"town"}', "[1,2]", "{kind:open}"].forEach(function (bad) { assert.equal(atlasStartParse(bad), null, "unreadable: " + JSON.stringify(bad)); });
  });

  test("#708 open country: a start the story calls open country is tied to open ground beside the capital — no village is drawn, the region's recipe gains no edit, the party stands in the wild zone, the GM is told the land is not a settlement, and the player's tap still wins", function () {
    stubs(); engine.makeTestWorld(); atlasForget(); quiet();
    var A = atlasCreate("campaign-1"), reg = atlasDoc(A.seed), cap = reg.places[0], n = reg.places.length, key, tie, r, told, sig;
    point("The Boundary Clearing"); key = atlasWorldKey(atlasPointer());
    atlasKindSet(A, key, { kind: "open", size: null, settlement: null, by: "model" });
    r = atlasFollow();
    assert.equal(edits(A, A.seed).length, 0, "no edit on the region: " + JSON.stringify(edits(A, A.seed))); assert.equal(atlasDoc(A.seed).places.length, n, "no settlement drawn"); assert.deepEqual(adds(A), [], "nothing is an addition");
    tie = A.names[key]; assert(tie && tie.id === null && tie.by === "story", "the story's name is tied to a zone, by the story: " + JSON.stringify(tie));
    assert.equal(A.zones[tie.zone].kind, "wild", "the zone is open country"); assert(wildPointsOf(reg, cap).indexOf(A.zones[tie.zone].via) >= 0, "beside the capital — one of the open-ground candidates around it");
    assert.equal(A.at, tie.zone, "the party stands in it"); assert.equal(A.off, null); assert(r && r.changed);
    assert(atlasWhere().text.indexOf("The party is in ") === 0 && /The story's "The Boundary Clearing" is at .* on this map: the story's own description placed it there\./.test(atlasWhere().text), atlasWhere().text);
    told = atlasToldLines(A); assert(told.some(function (t) { return /The story's The Boundary Clearing is open country on this map/.test(t) && /not a settlement/.test(t); }), "the GM is told: " + JSON.stringify(told));
    assert(atlasMapBlock().indexOf("is open country on this map") > 0, "on the MAP block"); assert(toasts.some(function (t) { return /open country/.test(t); }), "and the player sees it: " + toasts.join(" | "));
    assert(!toasts.some(function (t) { return /could not be added|village/.test(t); }), toasts.join(" | "));
    assert.equal(kindsOf(A)[key].kind, "open", "the answer is kept"); assert.equal(JSON.parse(JSON.stringify(A)).kinds[key].kind, "open", "and survives the save round trip");
    sig = JSON.stringify([A.at, A.spot, A.off, A.names]); quiet(); atlasFollow(); assert.equal(JSON.stringify([A.at, A.spot, A.off, A.names]), sig, "idempotent"); assert.deepEqual(toasts, []);
    /* the pane's marker: somewhere in the zone, never an exact point */
    var m = atlasMarkers(tie.zone); assert(m.length === 1 && /somewhere here/.test(m[0].label), "the party is somewhere in the open country: " + JSON.stringify(m));
    /* the player's tap is still the correction */
    r = atlasPlace(A.seed, { id: cap.id }, { level: "world", name: "The Boundary Clearing" }); assert(r.ok, JSON.stringify(r));
    assert(A.names[key].id === cap.id && !A.names[key].by, "the tap's tie replaces the story's"); assert.equal(A.zones[A.at].via, cap.id, "the party is in the capital's own sheet");
  });

  test("#708 a settlement at the story's size: a start the story calls a town or a city is drawn as one, not always a village; a settlement of no size is a village; a world place the GM names later, with no kind asked, is a village as before", function () {
    var A, reg, cap, key;
    ["town", "city", "village"].forEach(function (size) {
      stubs(); engine.makeTestWorld(); atlasForget(); quiet();
      A = atlasCreate("campaign-1"); reg = atlasDoc(A.seed); cap = reg.places[0];
      point("Harrowmere"); key = atlasWorldKey(atlasPointer()); atlasKindSet(A, key, { kind: "settlement", size: size, settlement: null, by: "model" }); atlasFollow();
      assert.equal(edits(A, A.seed).length, 1, size); assert.equal(edits(A, A.seed)[0].kind, size, "drawn at the story's size"); assert.equal(edits(A, A.seed)[0].name, "Harrowmere");
      assert.equal(A.off, null); assert.equal(A.zones[A.at].kind, "town", "the party stands in it");
      assert(atlasToldLines(A).some(function (t) { return t.indexOf("Harrowmere was added to the map of") >= 0 && t.indexOf(", as a " + size) > 0; }), "the GM is told the size: " + JSON.stringify(atlasToldLines(A)));
      assert.equal(atlasDoc(A.seed).places.filter(function (p) { return p.authored; })[0].kind, size, "the region draws it at that size");
    });
    /* later, a place the GM names: no kind was asked — a village, as #702 built it */
    quiet(); point(cap.name); atlasFollow(); point("Bleakford"); atlasFollow();
    assert.equal(edits(A, A.seed).length, 2); assert.equal(edits(A, A.seed)[1].kind, "village"); assert.equal(edits(A, A.seed)[1].name, "Bleakford"); assert(!kindsOf(A)[atlasWorldKey(atlasPointer())], "no hint was written for it");
  });

  test("#708 inside a named settlement: the settlement is added to the region at its size, the start place is added inside it, the story's name is tied to that building, the party stands in it and a room the GM names after files under it", function () {
    stubs(); engine.makeTestWorld(); atlasForget(); quiet();
    var A = atlasCreate("campaign-1"), reg = atlasDoc(A.seed), n = reg.places.length, key, tie, town, townDoc, f, told, chain;
    point("The Mortuary"); key = atlasWorldKey(atlasPointer());
    atlasKindSet(A, key, { kind: "inside", size: "city", settlement: "Sigil", by: "model" });
    atlasFollow();
    assert.equal(edits(A, A.seed).length, 1, "one edit on the region: " + JSON.stringify(edits(A, A.seed))); assert.equal(edits(A, A.seed)[0].name, "Sigil"); assert.equal(edits(A, A.seed)[0].kind, "city");
    assert.equal(atlasDoc(A.seed).places.length, n + 1, "Sigil is on the region"); assert(!atlasFind(atlasDoc(A.seed), "The Mortuary"), "The Mortuary is NOT a settlement of the realm");
    tie = A.names[key]; assert(tie && tie.id != null && tie.by === "story", "the story's name is tied to a thing, by the story: " + JSON.stringify(tie));
    town = A.zones[tie.zone]; assert(town && town.kind === "town" && town.via === edits(A, A.seed)[0].id, "…a thing on Sigil's own sheet: " + JSON.stringify(town));
    townDoc = atlasDoc(tie.zone); f = atlasFind(townDoc, "The Mortuary"); assert(f && f.thing && f.thing.id === tie.id, "Sigil's sheet bears The Mortuary once, the tied thing");
    assert(edits(A, tie.zone).some(function (e) { return e.name === "The Mortuary"; }), "added to Sigil's recipe");
    assert.equal(A.off, null, "the party is on the map"); chain = atlasChainUp(A, A.at, null); assert(chain.indexOf(tie.zone) >= 0, "the party stands in Sigil, at or inside The Mortuary: " + chain.join(" < "));
    assert(atlasWhere().text.indexOf("The party is in The Mortuary") === 0, "the party is in the building drawn for the start: " + atlasWhere().text);
    told = atlasToldLines(A);
    assert(told.some(function (t) { return /Sigil was added to the map of .*, as a city/.test(t); }), "the GM is told of Sigil: " + JSON.stringify(told));
    assert(told.some(function (t) { return /The Mortuary was added to the map of Sigil/.test(t); }), "and of The Mortuary inside it: " + JSON.stringify(told));
    assert(adds(A).indexOf(key) >= 0 && A.adds[key].zone === tie.zone && A.adds[key].id === tie.id, "the building is indexed as the engine's addition for the start");
    /* a room named after is the Mortuary's room, not a thing of Sigil's streets and not a settlement */
    quiet(); turn("[SUBLOCATION:Embalming Room] Cold slabs.");
    assert.equal(edits(A, A.seed).length, 1, "no new settlement"); assert(!edits(A, tie.zone).some(function (e) { return e.name === "Embalming Room"; }), "not added on Sigil's streets");
    assert(A.off === null || !A.off.absent, "the room is on the map or honestly refused, never pending: " + JSON.stringify(A.off)); chain = atlasChainUp(A, A.at, null); assert(chain.indexOf(tie.zone) >= 0, "the party is still inside Sigil: " + chain.join(" < "));
    /* the tap on the building the engine added has nothing to place */
    var r = atlasPlace(tie.zone, { id: tie.id }, { level: "sub", name: "Embalming Room" }); assert(!r.ok, JSON.stringify(r));
  });

  test("#708 honest when the kind is not known: a pending start is left off the map quietly, an unreadable answer or a failed ask is refused with the reason and no village is drawn, a start inside a settlement the story does not name is refused, and a load turns a pending mark into that refusal", function () {
    stubs(); engine.makeTestWorld(); atlasForget(); quiet();
    var A = atlasCreate("campaign-1"), key, r;
    point("The Boundary Clearing"); key = atlasWorldKey(atlasPointer());
    assert.equal(atlasStartMark(), key, "Begin marks the pointer's world place"); assert.equal(kindsOf(A)[key].kind, "pending");
    r = atlasFollow();
    assert.equal(edits(A, A.seed).length, 0, "nothing drawn while pending"); assert(A.off && A.off.absent && /asking the story/.test(A.off.why), JSON.stringify(A.off)); assert.deepEqual(adds(A), []);
    assert.deepEqual(toasts, [], "pending is quiet: " + toasts.join(" | ")); assert.deepEqual(warns, []);
    assert(/not on the map yet/.test(atlasWhere().text) && /asking the story/.test(atlasWhere().text), atlasWhere().text);
    /* the switch off: no mark */
    A.adopt = false; delete A.kinds[key]; assert.equal(atlasStartMark(), null, "the player's switch off asks nothing"); assert(!kindsOf(A)[key]); A.adopt = true;
    /* unknown: refused, said once */
    atlasKindSet(A, key, { kind: "unknown", why: "the model's answer could not be read (I think it is a village)", by: "model" }); A.ptr = null; quiet(); atlasFollow();
    assert.equal(edits(A, A.seed).length, 0, "no guessed village"); assert(A.off && /could not be learned/.test(A.off.why) && /could not be read/.test(A.off.why) && /tap/.test(A.off.why), JSON.stringify(A.off));
    assert(toasts.some(function (t) { return /could not be added/.test(t) && /could not be read/.test(t); }), "said to the player: " + toasts.join(" | "));
    quiet(); atlasFollow(); assert.deepEqual(toasts, [], "said once"); assert(atlasMapBlock().indexOf("could not be learned") > 0, "the GM reads the reason");
    /* inside, unnamed: refused */
    atlasKindSet(A, key, { kind: "inside", size: "town", settlement: null, by: "model" }); A.ptr = null; quiet(); atlasFollow();
    assert.equal(edits(A, A.seed).length, 0); assert(A.off && /does not name/.test(A.off.why), JSON.stringify(A.off)); assert(toasts.some(function (t) { return /does not name/.test(t); }), toasts.join(" | "));
    /* a load: pending becomes a refusal with the reason, a store without kinds gains the dictionary, a kinds that is not an object is replaced */
    atlasKindSet(A, key, { kind: "pending", by: "model" }); assert.equal(atlasHeal(), true); assert.equal(kindsOf(A)[key].kind, "unknown"); assert(/closed before/.test(kindsOf(A)[key].why), kindsOf(A)[key].why);
    delete A.kinds; assert.equal(atlasHeal(), true); assert(A.kinds && typeof A.kinds === "object" && Object.keys(A.kinds).length === 0);
    A.kinds = "junk"; assert.equal(atlasHeal(), true); assert.equal(typeof A.kinds, "object");
    assert.equal(atlasHeal(), false, "a settled store is left alone");
    assert(KEYED_STORE_PATHS.world.indexOf("atlas.kinds") >= 0, "the kinds are a registered keyed store");
    /* the player's tap places a pending or refused start as ever */
    atlasKindSet(A, key, { kind: "pending" }); A.ptr = null; atlasFollow(); r = atlasPlace(A.seed, { id: atlasDoc(A.seed).places[1].id }, { level: "world", name: "The Boundary Clearing" }); assert(r.ok, JSON.stringify(r)); assert.equal(A.off, null);
  });

  await atest("#708 the door: Begin marks the start pending and the opening asks the story before it is written — the answer is written to the atlas and the follow runs, so the opening's MAP block already shows the start; a start on the map by its own name asks nothing; a failed or unreadable ask is said and refused, never a guessed village", async function () {
    stubs(); engine.makeTestWorld(); atlasForget(); quiet();
    var A = atlasCreate("campaign-1"), reg = atlasDoc(A.seed), cap = reg.places[0], key, calls = [], real = global.callGM, r, src, i, j, body;
    point("The Boundary Clearing"); key = atlasWorldKey(atlasPointer());
    memory.map.nodes[key] = newMapNode(null, null, { description: "A split seam where deep wood meets stagnant water; boundary stones since the First Pact." });
    worldState.skeleton = { premise: "Prince Auden is missing and the birds have begun to fall silent.", acts: [] };
    try {
      global.callGM = function (msg, sys, max, model, opts) { calls.push({ msg: msg, sys: sys, max: max, model: model, opts: opts }); return Promise.resolve('{"kind":"open","size":null,"settlement":null}'); };
      assert.equal(await atlasClassifyStart(), null, "nothing pending: nothing asked"); assert.equal(calls.length, 0);
      atlasStartMark(); atlasFollow(); assert(A.off && A.off.absent, "off the map, pending");
      r = await atlasClassifyStart();
      assert.equal(calls.length, 1, "one call"); assert(calls[0].opts && calls[0].opts.noHistory === true && calls[0].opts.kind === "atlas", JSON.stringify(calls[0].opts)); assert(calls[0].max <= 200, "a short answer: " + calls[0].max); assert.equal(calls[0].model, null, "the session's model");
      assert(calls[0].sys.indexOf("settlement") >= 0 && calls[0].msg.indexOf("The Boundary Clearing") >= 0 && calls[0].msg.indexOf("boundary stones since the First Pact") >= 0 && calls[0].msg.indexOf("Prince Auden is missing") >= 0, "asked over the blueprint's description and the premise: " + calls[0].msg);
      assert(r && r.kind === "open" && r.by === "model", JSON.stringify(r)); assert.equal(kindsOf(A)[key].kind, "open");
      assert.equal(A.off, null, "followed"); assert.equal(A.zones[A.at].kind, "wild", "the party stands in open country"); assert(atlasMapBlock().indexOf("is open country on this map") > 0, "the opening's MAP block shows it");
      assert.equal(await atlasClassifyStart(), null, "settled: asked once"); assert.equal(calls.length, 1);
      /* on the map by its own name: nothing to ask, the mark is dropped */
      stubs(); engine.makeTestWorld(); atlasForget(); quiet(); A = atlasCreate("campaign-1"); point(cap.name); key = atlasWorldKey(atlasPointer());
      atlasStartMark(); atlasFollow(); assert.equal(A.off, null); assert.equal(await atlasClassifyStart(), null); assert.equal(calls.length, 1, "no call"); assert(!kindsOf(A)[key], "the pending mark is dropped");
      /* a failed ask */
      stubs(); engine.makeTestWorld(); atlasForget(); quiet(); A = atlasCreate("campaign-1"); point("The Boundary Clearing"); key = atlasWorldKey(atlasPointer());
      global.callGM = function () { return Promise.reject(new Error("Network: Load failed")); };
      atlasStartMark(); atlasFollow(); r = await atlasClassifyStart();
      assert(r && r.kind === "unknown" && /Load failed/.test(r.why), JSON.stringify(r)); assert.equal(edits(A, A.seed).length, 0, "no guessed village"); assert(A.off && /could not be learned/.test(A.off.why) && /Load failed/.test(A.off.why), JSON.stringify(A.off));
      assert(toasts.some(function (t) { return /Load failed/.test(t); }), "said: " + toasts.join(" | "));
      /* an unreadable answer */
      stubs(); engine.makeTestWorld(); atlasForget(); quiet(); A = atlasCreate("campaign-1"); point("The Boundary Clearing"); key = atlasWorldKey(atlasPointer());
      global.callGM = function () { return Promise.resolve("It is probably a village, I think."); };
      atlasStartMark(); atlasFollow(); r = await atlasClassifyStart();
      assert(r && r.kind === "unknown" && /could not be read/.test(r.why) && /probably a village/.test(r.why), JSON.stringify(r)); assert.equal(edits(A, A.seed).length, 0);
      /* a thrower inside never escapes the opening */
      stubs(); engine.makeTestWorld(); atlasForget(); quiet(); A = atlasCreate("campaign-1"); point("The Boundary Clearing"); key = atlasWorldKey(atlasPointer());
      global.callGM = function () { throw new Error("sync boom"); }; atlasStartMark(); atlasFollow(); r = await atlasClassifyStart(); assert(r && r.kind === "unknown" && /sync boom/.test(r.why), JSON.stringify(r));
      /* without an atlas */
      delete worldState.atlas; assert.equal(await atlasClassifyStart(), null);
    } finally { global.callGM = real; }
    /* the wiring, derived from game.js: Begin marks right after the realm is drawn and before the first follow; the opening awaits the ask before the GM is called */
    src = fs.readFileSync(path.join(ROOT, "game.js"), "utf8");
    assert(src.indexOf("atlasCreate();atlasStartMark();atlasFollow();") >= 0, "startGame: create, mark, follow");
    i = src.indexOf("async function beginAdventure("); body = src.slice(i, src.indexOf("\n}\n", i));
    j = body.indexOf("await atlasClassifyStart("); assert(j > 0 && j < body.indexOf("await callGM(intro)"), "beginAdventure asks the story before the opening is written");
    assert(body.indexOf("await atlasClassifyStart(function(tx){setThinking(th,") === j, "the wait is said on the thinking marker through the status callback");
  });

  /* ── #710 (owner 2026-11-07, "go through all the starting points; make sure they're supported by our mapping system"): the ten
     wizard starts. A shipwreck is a shore, a clearing is a forest, a dungeon's mouth is a cave of the realm, a tavern or a guild
     hall is INSIDE a settlement the text does not name — so the classifier answers the GROUND of an open start and chooses the
     settlement from the map's own list, and the adoption lands the start on that ground (the library's own reading of the wild
     sheet's site), ties a cave start to the realm's nearest cave, refuses water and a ground the realm lacks with the reason, and
     puts an inside start into a settlement the realm already has without laying another. */
  function siteOf(A, zoneId) { return TnDMaps.wild.fromRegion(atlasDoc(A.seed), A.zones[zoneId].via).site; }
  function distOf(A, zoneId, p) { var z = TnDMaps.wild.zoneAt(atlasDoc(A.seed), A.zones[zoneId].via); return Math.sqrt(Math.pow(z.cx - p.x, 2) + Math.pow(z.cy - p.y, 2)); }

  test("#710 the ground is asked and read: the ask names every ground and lists the map's own settlements; the parse reads a ground for open country only, and a ground the map cannot stand on is none", function () {
    var ask = atlasStartAsk({ name: "A shipwreck on the Blighted Coast", region: "", description: "", premise: "", settlements: ["Great Brem (city)", "Wrei (town)"] });
    Object.keys(ATLAS_OPEN_GROUNDS).forEach(function (k) { var row = ATLAS_OPEN_GROUNDS[k]; assert(row.word && (row.points || row.biome || row.thing || row.refuse), "row " + k + " is whole"); assert(ask.system.indexOf('"' + k + '"') >= 0, "the system names the ground " + k); });
    assert(ask.system.indexOf('"ground"') >= 0 && /choose the settlement from the map's own list/.test(ask.system), "the answer carries the ground; an inside place the text leaves unnamed is put in one of the map's settlements");
    assert(ask.user.indexOf("Great Brem (city), Wrei (town)") >= 0, "the user text lists the settlements: " + ask.user);
    assert(/none drawn/.test(atlasStartAsk({ name: "X" }).user), "no settlements is said, not left blank");
    assert.deepEqual(atlasStartParse('{"kind":"open","size":null,"settlement":null,"ground":"coast"}'), { kind: "open", size: null, settlement: null, ground: "coast" });
    assert.deepEqual(atlasStartParse('{"kind":"open","ground":" Forest "}'), { kind: "open", size: null, settlement: null, ground: "forest" });
    assert.deepEqual(atlasStartParse('{"kind":"open","ground":"volcano"}'), { kind: "open", size: null, settlement: null, ground: null }, "a ground the table lacks is none, never a guess");
    assert.deepEqual(atlasStartParse('{"kind":"open","ground":12}'), { kind: "open", size: null, settlement: null, ground: null });
    assert.deepEqual(atlasStartParse('{"kind":"settlement","size":"town","ground":"coast"}'), { kind: "settlement", size: "town", settlement: null, ground: null }, "a settlement has no ground");
    assert.deepEqual(atlasStartParse('{"kind":"inside","settlement":"Wrei","ground":"forest"}'), { kind: "inside", size: "town", settlement: "Wrei", ground: null });
    /* the context carries the realm's settlements */
    stubs(); engine.makeTestWorld(); atlasForget(); quiet(); var A = atlasCreate("campaign-1"), reg = atlasDoc(A.seed), ctx = atlasStartContext();
    assert.deepEqual(ctx.settlements, reg.places.map(function (p) { return p.name + " (" + p.kind + ")"; }), JSON.stringify(ctx.settlements));
    delete worldState.atlas; assert.deepEqual(atlasStartContext().settlements, [], "no atlas: none");
  });

  test("#710 a shore: a shipwreck start lands on the coast — the wild sheet the party stands in reads the sea beside it, the GM is told the shore and the sea's side, no village is drawn; without a ground the start lands on the nearest open ground as before", function () {
    stubs(); engine.makeTestWorld(); atlasForget(); quiet();
    var A = atlasCreate("campaign-1"), reg = atlasDoc(A.seed), n = reg.places.length, key, tie, site, told;
    point("A shipwreck on the Blighted Coast"); key = atlasWorldKey(atlasPointer());
    atlasKindSet(A, key, { kind: "open", size: null, settlement: null, ground: "coast", by: "model" });
    atlasFollow();
    assert.equal(A.off, null, "on the map: " + JSON.stringify(A.off)); assert.equal(edits(A, A.seed).length, 0, "nothing drawn"); assert.equal(atlasDoc(A.seed).places.length, n);
    tie = A.names[key]; assert(tie && tie.id === null && tie.by === "story" && A.zones[tie.zone].kind === "wild", JSON.stringify(tie)); assert.equal(A.at, tie.zone, "the party stands in it");
    site = siteOf(A, tie.zone); assert(site.coast && site.coast.bearing, "the sheet reads the sea beside it: " + JSON.stringify(site.coast));
    told = atlasToldLines(A); assert(told.some(function (t) { return /is open country on this map, on a shore \d+ km from /.test(t) && /the sea to the [NESW]+/.test(t) && /not a settlement/.test(t); }), JSON.stringify(told));
    assert(toasts.some(function (t) { return /open country on a shore/.test(t); }), toasts.join(" | ")); assert(!warns.length, warns.join(" | "));
    assert(/the story's own description placed it there/.test(atlasWhere().text), atlasWhere().text);
    /* no ground: the nearest open ground, which on this realm is inland plain */
    stubs(); engine.makeTestWorld(); atlasForget(); quiet(); A = atlasCreate("campaign-1"); point("A shipwreck on the Blighted Coast"); key = atlasWorldKey(atlasPointer());
    atlasKindSet(A, key, { kind: "open", size: null, settlement: null, ground: null, by: "model" }); atlasFollow();
    assert.equal(A.off, null); site = siteOf(A, A.names[key].zone); assert(!site.coast, "the generic landing is not on the shore here: " + JSON.stringify(site.coast));
    /* the fit is the library's own reading of the sheet, not the candidate list's promise: a list that opens with that inland ground is passed over until a sheet reads the sea */
    var realPts = ATLAS_OPEN_GROUNDS.coast.points, inland = TnDMaps.wild.zoneAt(reg, A.zones[A.names[key].zone].via);
    ATLAS_OPEN_GROUNDS.coast.points = function (doc, c) { return [[inland.cx, inland.cy]].concat(realPts(doc, c)); };
    try {
      stubs(); engine.makeTestWorld(); atlasForget(); quiet(); A = atlasCreate("campaign-1"); point("A shipwreck on the Blighted Coast"); key = atlasWorldKey(atlasPointer());
      atlasKindSet(A, key, { kind: "open", size: null, settlement: null, ground: "coast", by: "model" }); atlasFollow();
      assert.equal(A.off, null, JSON.stringify(A.off)); site = siteOf(A, A.names[key].zone); assert(site.coast && site.coast.bearing, "the inland candidate was passed over for a sheet that reads the sea: " + JSON.stringify(site.coast));
    } finally { ATLAS_OPEN_GROUNDS.coast.points = realPts; }
  });

  test("#710 a forest, a riverbank, the hills, the mountains and the plain: a start on a named ground lands on a sheet of that ground — the library's own reading of its site — the nearest to the capital", function () {
    ["forest", "river", "hills", "mountain", "plain"].forEach(function (g) {
      stubs(); engine.makeTestWorld(); atlasForget(); quiet();
      var A = atlasCreate("campaign-1"), cap = atlasDoc(A.seed).places[0], key, tie, site, row = ATLAS_OPEN_GROUNDS[g];
      point("A forest clearing near ancient ruins"); key = atlasWorldKey(atlasPointer());
      atlasKindSet(A, key, { kind: "open", size: null, settlement: null, ground: g, by: "model" }); atlasFollow();
      assert.equal(A.off, null, g + ": " + JSON.stringify(A.off)); tie = A.names[key]; site = siteOf(A, tie.zone);
      assert(row.fits ? row.fits(site) : site.biome === row.biome, g + ": the sheet's site is that ground: " + JSON.stringify({ biome: site.biome, river: site.river, rivers: site.rivers && site.rivers.length }));
      assert(distOf(A, tie.zone, cap) < 320, g + ": near the capital, not across the realm: " + Math.round(distOf(A, tie.zone, cap)) + " px");
      assert(atlasToldLines(A).some(function (t) { return t.indexOf("on " + row.word) > 0; }), g + ": told " + JSON.stringify(atlasToldLines(A)));
      assert.equal(edits(A, A.seed).length, 0, g + ": nothing drawn"); assert(!warns.length, g + ": " + warns.join(" | "));
    });
  });

  test("#710 a cave: a dungeon's mouth is the realm's nearest cave no name holds — the story's name is tied to it by the story, the party stands at its mouth, and a second cave start takes the next cave", function () {
    stubs(); engine.makeTestWorld(); atlasForget(); quiet();
    var A = atlasCreate("campaign-1"), reg = atlasDoc(A.seed), cap = reg.places[0], caves = reg.caves.slice().sort(function (a, b) { return Math.pow(a.x - cap.x, 2) + Math.pow(a.y - cap.y, 2) - Math.pow(b.x - cap.x, 2) - Math.pow(b.y - cap.y, 2); }), key, tie, told;
    assert(caves.length >= 2, "the fixture realm has caves");
    point("The mouth of an ancient dungeon"); key = atlasWorldKey(atlasPointer());
    atlasKindSet(A, key, { kind: "open", size: null, settlement: null, ground: "cave", by: "model" }); atlasFollow();
    tie = A.names[key]; assert(tie && tie.zone === A.seed && tie.id === caves[0].id && tie.by === "story", "tied to the nearest cave: " + JSON.stringify(tie) + " vs " + caves[0].id);
    assert.equal(A.off, null, JSON.stringify(A.off)); assert.equal(edits(A, A.seed).length, 0, "nothing drawn");
    told = atlasToldLines(A); assert(told.some(function (t) { return t.indexOf("is " + caves[0].name + " on this map") > 0 && /a cave \d+ km from /.test(t); }), JSON.stringify(told));
    assert(/is at .* on this map: the story's own description placed it there\./.test(atlasWhere().text), atlasWhere().text);
    assert(A.at === A.seed ? A.spot === caves[0].id : A.zones[A.at].kind === "dungeon" && A.zones[A.at].via === caves[0].id, "the party stands at the cave, or at its mouth inside: " + JSON.stringify([A.at, A.spot, A.zones[A.at]]));
    assert(toasts.some(function (t) { return t.indexOf("is " + caves[0].name) > 0; }), toasts.join(" | "));
    /* the next cave start takes the next cave */
    quiet(); point("The Barrow of Kings"); key = atlasWorldKey(atlasPointer()); atlasKindSet(A, key, { kind: "open", size: null, settlement: null, ground: "cave", by: "model" }); atlasFollow();
    assert.equal(A.names[key] && A.names[key].id, caves[1].id, "the next cave: " + JSON.stringify(A.names[key]));
  });

  test("#710 refused with the reason: a start on the water, and a ground this realm lacks — never the nearest heath; the tap is offered and places it", function () {
    stubs(); engine.makeTestWorld(); atlasForget(); quiet();
    var A = atlasCreate("campaign-1"), key, was, r;
    point("Aboard the Sea Hag"); key = atlasWorldKey(atlasPointer());
    atlasKindSet(A, key, { kind: "open", size: null, settlement: null, ground: "water", by: "model" }); atlasFollow();
    assert(A.off && A.off.absent && /on the water/.test(A.off.why) && /tap the shore/.test(A.off.why), JSON.stringify(A.off)); assert.equal(edits(A, A.seed).length, 0); assert(!A.names[key], "no tie");
    assert(toasts.some(function (t) { return /on the water/.test(t); }), toasts.join(" | ")); assert(atlasMapBlock().indexOf("on the water") > 0, "the GM reads it");
    quiet(); atlasFollow(); assert.deepEqual(toasts, [], "said once");
    /* a ground no cell of this realm holds */
    was = ATLAS_OPEN_GROUNDS.marsh.biome; ATLAS_OPEN_GROUNDS.marsh.biome = "glass";
    try { atlasKindSet(A, key, { kind: "open", size: null, settlement: null, ground: "marsh", by: "model" }); A.ptr = null; quiet(); atlasFollow(); } finally { ATLAS_OPEN_GROUNDS.marsh.biome = was; }
    assert(A.off && A.off.absent && /no marsh was found on this map/.test(A.off.why) && /tap/.test(A.off.why), JSON.stringify(A.off)); assert.equal(edits(A, A.seed).length, 0, "no guessed landing"); assert(!A.names[key], "no tie");
    assert(toasts.some(function (t) { return /no marsh was found/.test(t); }), toasts.join(" | "));
    /* the tap places it */
    r = atlasPlace(A.seed, { id: atlasDoc(A.seed).places[1].id }, { level: "world", name: "Aboard the Sea Hag" }); assert(r.ok, JSON.stringify(r)); assert.equal(A.off, null);
  });

  test("#710 inside a settlement the realm already has: the story put the tavern in a town of the map's own list — no settlement is laid, the town's sheet is opened, the tavern is added on it and the story's name tied to that building; a settlement name a cave bears is refused", function () {
    stubs(); engine.makeTestWorld(); atlasForget(); quiet();
    var A = atlasCreate("campaign-1"), reg = atlasDoc(A.seed), town = reg.places.filter(function (p) { return p.kind === "town"; })[0], cave = reg.caves[0], key, tie, told;
    point("The Salted Wound Tavern"); key = atlasWorldKey(atlasPointer());
    atlasKindSet(A, key, { kind: "inside", size: "town", settlement: town.name, ground: null, by: "model" }); atlasFollow();
    assert.equal(edits(A, A.seed).length, 0, "no settlement laid: " + JSON.stringify(edits(A, A.seed))); assert.equal(atlasDoc(A.seed).places.length, reg.places.length);
    tie = A.names[key]; assert(tie && tie.id != null && tie.by === "story", JSON.stringify(tie)); assert(A.zones[tie.zone] && A.zones[tie.zone].kind === "town" && A.zones[tie.zone].via === town.id, "a thing on " + town.name + "'s own sheet: " + JSON.stringify(A.zones[tie.zone]));
    assert(atlasFind(atlasDoc(tie.zone), "The Salted Wound Tavern").thing.id === tie.id, "the tavern is on the sheet, once, the tied thing");
    assert.equal(A.off, null, JSON.stringify(A.off)); assert(atlasWhere().text.indexOf("The party is in The Salted Wound Tavern") === 0, atlasWhere().text);
    told = atlasToldLines(A); assert(told.some(function (t) { return t.indexOf("is in " + town.name + " on this map") > 0; }), JSON.stringify(told)); assert(told.some(function (t) { return /The Salted Wound Tavern was added to the map of/.test(t); }), JSON.stringify(told));
    assert(toasts.some(function (t) { return t.indexOf("is in " + town.name) > 0; }), toasts.join(" | ")); assert(adds(A).indexOf(key) >= 0 && A.adds[key].zone === tie.zone, "indexed as the engine's addition");
    /* a settlement name that is a cave's: not a settlement */
    stubs(); engine.makeTestWorld(); atlasForget(); quiet(); A = atlasCreate("campaign-1"); point("The Guild Hall of your order"); key = atlasWorldKey(atlasPointer());
    atlasKindSet(A, key, { kind: "inside", size: "city", settlement: cave.name, ground: null, by: "model" }); atlasFollow();
    assert(A.off && A.off.absent && /not a settlement/.test(A.off.why), JSON.stringify(A.off)); assert.equal(edits(A, A.seed).length, 0); assert(!A.names[key]);
  });

  /* #697 (the library audit's A11 class, applied to the game): a table keyed by a kind is a plain object, so a kind
     named like an Object method found a function; and the load check took any string as a zone's kind. */
  test("#697 a table answers only to its own rows: an inherited name finds nothing, and no table is read by a bare bracket", function () {
    var text = src("atlas.js"), tables = [], m, re = /^var (ATLAS_[A-Z_]+)=\{/gm, bare, names = ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"];
    while ((m = re.exec(text))) tables.push(m[1]);
    assert(tables.length >= 9, "the tables are found: " + tables.join(" "));
    assert.equal(typeof atlasRow, "function", "the one lookup");
    tables.forEach(function (t) {
      var table = (0, eval)(t);
      names.forEach(function (n) { assert.strictEqual(atlasRow(table, n), undefined, t + " answers to " + n); });
      Object.keys(table).forEach(function (k) { assert.strictEqual(atlasRow(table, k), table[k], t + " loses its own row " + k); });
    });
    assert.strictEqual(atlasRow(ATLAS_THINGS, null), undefined); assert.strictEqual(atlasRow(null, "town"), undefined);
    bare = text.match(new RegExp("\\b(" + tables.join("|") + ")\\[", "g")) || [];
    assert.deepEqual(bare, [], "every read of a table goes through atlasRow");
  });
  test("#697 a new builder row needs a new ATLAS_VER: the rows are pinned to the store version (an older build sets aside a zone it cannot build)", function () {
    /* independent review 2026-11-12, finding 1: the load check discards a v1 store holding a zone no row builds, so a build that adds a
       row and keeps ATLAS_VER writes stores every older cached build throws away. Adding a row: bump ATLAS_VER (older builds then
       leave the store alone) and add the new version's list here. */
    var ROWS = { 1: ["dungeon>dungeon", "interior>dungeon", "region>dungeon", "region>town", "region>wild", "town>dungeon", "town>interior"] };
    ROWS[2]=ROWS[1].slice();/* Public knowledge changes the store version, not the private nesting catalogue. */
    assert(ROWS[ATLAS_VER], "ATLAS_VER " + ATLAS_VER + " has no pinned builder rows — add its list");
    assert.deepEqual(Object.keys(ATLAS_BUILDERS).sort(), ROWS[ATLAS_VER], "a builder row changed under ATLAS_VER " + ATLAS_VER + " — bump the version with it");
  });
  test("#697 a zone of a kind no builder makes is set aside at load, with the zone and the kind said", function () {
    var A = fresh(), c = cast(A), s;
    point(c.p0.name); atlasFollow(); s = JSON.stringify(worldState.atlas);
    assert.equal(atlasShapeProblem(A), null, "a store the engine made passes"); assert.equal(atlasHeal(), false); assert.equal(JSON.stringify(worldState.atlas), s, "and is untouched");
    A.zones["campaign-1/odd"] = { kind: "constructor", parent: A.seed, via: "p1", params: null }; quiet();
    assert.equal(atlasHeal(), true); assert.equal(worldState.atlas, undefined);
    assert(/zone 'campaign-1\/odd' is a constructor under a region, which nothing builds/.test(worldState.atlasJunk.why), worldState.atlasJunk.why);
    assert(toasts.some(function (t) { return /set aside/.test(t); }), toasts.join(" | "));
    /* a kind the library has, under a parent that never holds it */
    A = fresh(); c = cast(A); point(c.p0.name); atlasFollow();
    A.zones["campaign-1/p0/odd"] = { kind: "town", parent: "campaign-1/p0", via: "x", params: null }; quiet();
    assert.equal(atlasHeal(), true); assert(/is a town under a town, which nothing builds/.test(worldState.atlasJunk.why), worldState.atlasJunk.why);
    /* a newer build's store may hold kinds this build does not know: left alone as before */
    A = fresh(); A.v = 99; A.zones["campaign-1/new"] = { kind: "orbit", parent: A.seed, via: "o1", params: null }; quiet();
    assert.equal(atlasHeal(), false); assert(worldState.atlas && worldState.atlas.zones["campaign-1/new"], "a newer store is untouched");
  });

  console.warn = realWarn; console.info = realInfo;
  if (ONLY !== null && !matched) { process.exitCode = 1; console.error("--only \"" + ONLY + "\" matched 0 tests — NOTHING ran (a group is named by a substring of its name)"); }
  console.log((process.exitCode ? "FAILED" : "ALL GREEN") + " — " + passed + " atlas engine groups (#684)" + (ONLY !== null ? " (--only: " + matched + " of the file's groups ran)" : ""));
})();
