// dev/tests-684-atlas-engine.js — #684: the atlas ENGINE (atlas.js) over the real game engine (dev/load-engine.js) and
// the real map library. Design record: DOC/DESIGN_684_atlas.md. The library's pin is dev/tests-684-atlas.js.
//   • the store is RECIPES: created once, a few KB, survives the save round trip, redraws every document identically
//   • entry: an exact map name enters the zone behind it, once; a sub-location enters the building; idempotent
//   • THE RULE: the engine never guesses — an unknown or twice-borne name is off the map, with the reason
//   • We are here: the player's tap ties the story's own name to a map place; the world before a sub-location
//   • version drift: a zone that draws differently from its record is said out loud; a read never writes
//   • a failure never escapes a writer; an unreadable store is set aside at load; the party marker is derived
//   • what the pane says (where the party is, what a tap would tie, a thing's card) — and no peeking; the fog of war
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

/* THE FIXTURE GATE's table — what library 0.12.0 draws for the fixture realm (seed campaign-1). A re-vendor that changes
   any line redraws maps under saved campaigns: accept it on purpose (re-run with ATLAS_FIXTURES=print and paste), and say
   so in the commit and the release note. */
var ATLAS_FIXTURES = {
  "campaign-1": "region 89d812b3-5vq5",
  "campaign-1/p0": "town ad9ad4eb-2y0f",
  "campaign-1/p0/inn-1": "interior dafa5fef-al3",
  "campaign-1/p0/sewer": "dungeon 244e0f70-tpf",
  "campaign-1/c0": "dungeon a7204fce-60w",
  "campaign-1/z202_178": "wild e02a63d6-efp"
};

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

  test("the fingerprint ignores the timings and the caches the library hangs on a document it has read", function () {
    var A = fresh(), doc = atlasDoc(A.seed), fp = atlasFingerprint(doc);
    TnDMaps.digest(doc); TnDMaps.wild.fromRegion(doc, [doc.places[0].x, doc.places[0].y]);
    assert(Object.keys(doc).some(function (k) { return k.charAt(0) === "_"; }), "the library wrote a cache onto the document (if it stopped, drop this guard's reason)");
    assert.equal(atlasFingerprint(doc), fp, "a read document must fingerprint like a fresh one");
    var other = plain(doc); other.places[0].name = "Elsewhere"; assert.notEqual(atlasFingerprint(other), fp, "a changed name is a different drawing");
  });

  test("entry by an exact world name: the town is drawn once, its recipe is {kind, parent, via}, the tie is recorded, and following is idempotent", function () {
    var A = fresh(), c = cast(A), r, rec;
    point(c.p0.name); r = atlasFollow();
    assert.equal(r.changed, true); assert.deepEqual(r.entered, [c.townId]); assert.equal(A.at, c.townId); assert.equal(A.spot, null, "which road the party came in by is not on record"); assert.equal(A.off, null);
    rec = A.zones[c.townId];
    assert.deepEqual([rec.kind, rec.parent, rec.via, rec.params], ["town", A.seed, c.p0.id, null]);
    assert.equal(rec.name, c.p0.name); assert.equal(rec.lib, TnDMaps.VERSION); assert.equal(rec.fp, atlasFingerprint(atlasDoc(c.townId)));
    assert.deepEqual(plain(A.names[c.p0.name]), { zone: A.seed, id: c.p0.id });
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
    assert.equal(r.ok, false); assert(/sea/.test(r.reason) && !/\{/.test(r.reason), "the library's reason, without its data: " + r.reason);
    assert.equal(JSON.stringify(worldState.atlas), before, "a refused tap changes nothing"); assert.equal(reports.length, 0, "a library refusal is not a bug report");
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
    assert(card && /sea/.test(card.refused) && !/\{/.test(card.refused) && card.place === null, "open water says why it cannot be stood on: " + JSON.stringify(card));
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

  test("THE FIXTURE GATE: this library draws the fixture realm exactly as the pinned table says (region, town, interior, sewer, cave, wild)", function () {
    var A = fresh(), c = cast(A), got = {};
    point(c.p0.name); atlasFollow(); townCast(A, c);
    point(c.p0.name, c.inn.name); atlasFollow(); point(c.p0.name, c.grates[0].name); atlasFollow(); point(c.reg.caves[0].name); atlasFollow();
    point("Open country"); atlasFollow(); atlasPlace(A.seed, { x: c.p0.x + 6, y: c.p0.y + 4 });
    Object.keys(A.zones).forEach(function (id) { got[id] = A.zones[id].kind + " " + A.zones[id].fp; });
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
