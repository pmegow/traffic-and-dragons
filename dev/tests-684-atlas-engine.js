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
//   • THE FIXTURE GATE: a re-vendored library that redraws the fixture realm fails here until accepted on purpose
//   • the turn's commit and the load door call the atlas; the load order carries atlas.js
//   node dev/tests-684-atlas-engine.js
var assert = require("assert/strict"), fs = require("fs"), path = require("path");
var engine = require("./load-engine.js");
engine.loadEngine();
var ROOT = path.join(__dirname, "..");
function src(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }
var passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS #684 " + name); } catch (e) { process.exitCode = 1; console.error("FAIL #684 " + name + " — " + e.stack); } }

/* THE FIXTURE GATE's table — what the vendored library draws for the fixture realm (seed campaign-1). A document carries
   the version of the library that drew it, so every line is read under ONE fixed stamp (ATLAS_FIXTURES_STAMP, the
   version that first pinned the table): a re-vendor that draws the same realm passes untouched, and one that changes a
   line redraws maps under saved campaigns. Accept that on purpose (re-run with ATLAS_FIXTURES=print and paste), say so
   in the commit and the release note, and name the redrawn zones in a table like ATLAS_REDRAWN_BY_0_13 below.
   Accepted so far: 0.13.0 redrew the wild zone (every wild zone made from a region; nothing else). */
var ATLAS_FIXTURES_STAMP = "0.12.0";
var ATLAS_FIXTURES = {
  "campaign-1": "region 89d812b3-5vq5",
  "campaign-1/p0": "town ad9ad4eb-2y0f",
  "campaign-1/p0/inn-1": "interior dafa5fef-al3",
  "campaign-1/p0/sewer": "dungeon 244e0f70-tpf",
  "campaign-1/c0": "dungeon a7204fce-60w",
  "campaign-1/z202_178": "wild a9b5192a-e19"
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

(function () {
  var toasts = [], warns = [], infos = [], reports = [];
  global.showToast = function (m) { toasts.push(String(m)); };
  global.reportError = function (ctx, msg) { reports.push(ctx + ": " + msg); };
  var realWarn = console.warn, realInfo = console.info;
  console.warn = function () { warns.push([].slice.call(arguments).join(" ")); };
  console.info = function () { infos.push([].slice.call(arguments).join(" ")); };
  function quiet() { toasts.length = 0; warns.length = 0; infos.length = 0; reports.length = 0; }
  function fresh(seed) { engine.makeTestWorld(); atlasForget(); quiet(); return atlasCreate(seed || "campaign-1"); }
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
    assert.equal(A.at, c.townId); assert.deepEqual(plain(A.off), { name: "The Rusty Flagon", why: "no place on the map has that name", within: c.townId }); assert.equal(zoneCount(), 2);
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
    Object.keys(A.zones).forEach(function (id) { A.zones[id].fp = ATLAS_RECORDS_0_12[id]; A.zones[id].lib = "0.12.0"; });
    atlasForget(); quiet(); worldState.turn = 44;
    Object.keys(A.zones).forEach(function (id) { atlasDoc(id); atlasSettleChain(A, id); });
    said = Object.keys(A.zones).filter(function (id) { return A.zones[id].redrawn; });
    assert.deepEqual(said, ATLAS_REDRAWN_BY_0_13, "exactly the zones library 0.13.0 redrew are recorded as redrawn — every other sheet is the one the campaign was mapped on");
    assert.equal(A.zones[said[0]].redrawn.from, "0.12.0"); assert.equal(A.zones[said[0]].redrawn.was, ATLAS_RECORDS_0_12[said[0]]);
    assert.equal(toasts.length, 1, "one notice, for the one zone: " + toasts.join(" | ")); assert(/redrawn by a newer map library \(0\.12\.0 → /.test(toasts[0]), toasts[0]);
    Object.keys(A.zones).forEach(function (id) { assert.equal(A.zones[id].lib, TnDMaps.VERSION, id + " is re-stamped"); assert.equal(A.zones[id].fp, atlasFingerprint(atlasDoc(id)), id); });
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

  test("the fog of war: a dungeon shows its ways up and the chamber the party stands in, nothing else; every other sheet is whole", function () {
    var A = fresh(), c = cast(A), sewer, ids, doc, ups, deep;
    point(c.p0.name); atlasFollow(); townCast(A, c); sewer = c.townId + "/sewer";
    assert.equal(atlasReveal(A.seed), null); assert.equal(atlasReveal(c.townId), null);
    point(c.p0.name, c.inn.name); atlasFollow(); assert.equal(atlasReveal(A.at), null, "a building is read whole, like a published plan");
    point(c.p0.name, c.grates[0].name); atlasFollow(); doc = atlasDoc(sewer); ids = atlasReveal(sewer);
    ups = doc.portals.filter(function (p) { return p.way === "up"; }).map(function (p) { return p.id; });
    assert.deepEqual(ids.slice().sort(), ups.slice().sort(), "the ways up — the party stands at one of them");
    assert(ids.length < doc.rooms.length, "the rest of the sewer is not shown");
    deep = doc.rooms.filter(function (r) { return ids.indexOf(r.id) < 0 && doc.rooms.filter(function (q) { return atlasNameKey(q.name) === atlasNameKey(r.name); }).length === 1 && !atlasFind(c.town, r.name); })[0];
    assert(deep, "the fixture sewer has a chamber with a name of its own");
    point(c.p0.name, deep.name); atlasFollow();
    assert.equal(A.at, sewer, "a chamber's name is found on the entered sheet beneath the town"); assert.equal(A.spot, deep.id);
    assert.deepEqual(atlasReveal(sewer).slice().sort(), ids.concat([deep.id]).sort(), "the chamber the party stands in is shown, and only it");
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
    assert.equal(api.slice(api.indexOf("function buildGeoBlock("), api.indexOf("return\"GEOGRAPHY (strict continuity")).indexOf("atlas"), -1, "buildGeoBlock itself knows nothing of the atlas");
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
  function start() { stubs(); var A = fresh(), c = cast(A); turn("At the gate. [LOCATION:" + c.p0.name + "]"); townCast(A, c); return { A: A, c: c, T: c.p0.name, r: roomCast(c) }; }

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
    assert.equal(sub(), r.a + SEP + "Back Room", "ruling 2: a place the sheet lacks is filed under the building"); assert.equal(A.at, bz(S, r.a)); assert(A.off && A.off.within === A.at, "the map says it does not know the room, inside the building: " + JSON.stringify(A.off));
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
    turn("Round the back, into the kitchen. [SUBLOCATION:" + r.room + "]"); assert.equal(sub(), r.room); assert(node(T + "|" + r.room), "bare, as in every unmapped campaign"); assert.equal(A.at, S.c.townId); assert(A.off && A.off.within === S.c.townId);
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
    turn("[SUBLOCATION:Widow Hale's House] A narrow house."); assert.equal(sub(), "Widow Hale's House"); assert(A.off && A.off.within === c.townId);
    res = atlasPlace(c.townId, { id: c.inn.id }); assert.equal(res.ok, true); assert.equal(res.level, "sub"); assert.equal(A.at, c.townId + "/" + c.inn.id);
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
    S = start();
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
    assert.equal(src("tag_table.js").indexOf("atlas"), -1, "the tag parser never calls the atlas"); assert.equal(src("api.js").indexOf("atlasFollow"), -1, "nothing in api.js writes the atlas");
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

  console.warn = realWarn; console.info = realInfo;
  console.log((process.exitCode ? "FAILED" : "ALL GREEN") + " — " + passed + " atlas engine groups (#684)");
})();
