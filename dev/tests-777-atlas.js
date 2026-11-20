// dev/tests-777-atlas.js — audit 2026-11-19 (TODO #777), section A, the rows first left for the map pane:
//   A1 a note on a way out or a place inside is kept by its sheet and shown again · A2 an old pair of same-named features
//   does not freeze a place's map · A4 a read validates the store once per revision (the store's size is NOT bounded: see the row) ·
//   A5 the directions ask gives up on a feature the model will not place · A6 the region never sets a place on a kept
//   spot · A7 a way past the sixteenth is listed, and a cut list says so · A8 the place cap is said once, never mailed.
// Each case builds a fresh public-map campaign and runs the REAL engine. Nothing here looks at the drawn pane.
//   node dev/tests-777-atlas.js             every case
//   node dev/tests-777-atlas.js --only A2   the cases whose name contains the text
var assert = require("assert"), fs = require("fs"), path = require("path");
var LE = require("./load-engine.js");
var realLog = console.log, realErr = console.error;
var said = { warns: [], toasts: [], reports: [] };
console.warn = function () { said.warns.push([].join.call(arguments, " ")); };
console.info = function () {}; console.log = function () {}; console.debug = function () {};
LE.loadEngine("game.js");
showToast = function (m) { said.toasts.push(String(m)); }; syncUI = function () {}; saveAll = function () { return true; };
reportError = function (ctx, msg) { said.reports.push(ctx + ": " + msg); };
var ROOT = path.join(__dirname, "..");
function src(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }
var MIRE = "Petrified Mire", WOOD = "Gloomwood Forest", FIELDS = "The Ashen Fields";
function start(place, seed) {
  LE.makeTestWorld(); atlasForget(); worldState.world.location = place; worldState.world.sublocation = null; worldState.turn = 1;
  worldState.atlas = { v: ATLAS_VER, seed: seed || "k777", knowledge: 1 }; memory.map.nodes[place] = newMapNode(0, null); memory.map.nodes[place].visits = 1;
  memory.map.edges = []; memory.map.geography = MapKnowledge.create(); atlasFollow();
  said.warns.length = 0; said.toasts.length = 0; said.reports.length = 0;
  return worldState.atlas.at;
}
function go(world) {
  var from = worldState.world.location; worldState.turn++; worldState.world.location = world; worldState.world.sublocation = null;
  if (!memory.map.nodes[world]) memory.map.nodes[world] = newMapNode(worldState.turn, null);
  memory.map.nodes[world].visits++; memory.map.edges.push({ from: from, to: world, turn: worldState.turn }); atlasFollow(); return worldState.atlas.at;
}
function turn(text) { worldState.turn++; var muts = applyMuts(text, { deferSave: true }); var r = atlasKnowledgeCommitResult(text, muts && muts.mapReveals); atlasFollow(); return r; }
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms || 5); }); }
var CASES = [];
function kase(name, fn) { CASES.push({ name: name, fn: fn }); }

kase("A1: a note on a way out is kept by ITS sheet and shown on its card — never shared with another sheet's way", function () {
  var mire = start(MIRE), wood = go(WOOD), A = worldState.atlas, c, r;
  assert.ok(atlasSheetDrawn(atlasDoc(mire)) && atlasSheetDrawn(atlasDoc(wood)), "fixture: the two sheets are not drawn");
  c = atlasCard(wood, { id: "way-1" }); assert.ok(c && /Petrified Mire/.test(c.title), "fixture: the wood has no way back to the mire: " + JSON.stringify(c));
  r = atlasNoteSet(wood, "way-1", "Watch for bandits on the way back.");
  assert.ok(r && r.ok, "the note was refused: " + JSON.stringify(r));
  c = atlasCard(wood, { id: "way-1" });
  assert.strictEqual(c.note, "Watch for bandits on the way back.", "a note saved on a way is never shown again");
  assert.strictEqual(atlasNote(mire, "way-1"), "", "the note is shared by the OTHER sheet's way-1");
  assert.ok(!atlasCard(mire, { id: "way-1" }).note, "the other sheet's way card shows this sheet's note");
  assert.ok(!Object.prototype.hasOwnProperty.call(A.publicNotes, "way-1"), "the note is stored under the bare positional id: " + JSON.stringify(A.publicNotes));
  // a second way out of the same sheet has a note of its own
  go(FIELDS); go(WOOD);
  c = atlasCard(wood, { id: "way-2" }); assert.ok(c && /Ashen Fields/.test(c.title), "fixture: the wood has no second way: " + JSON.stringify(c));
  assert.ok(!c.note, "a second way of the sheet shows the first way's note: " + c.note);
  assert.ok(atlasNoteSet(wood, "way-2", "Open ground.").ok);
  assert.strictEqual(atlasCard(wood, { id: "way-1" }).note, "Watch for bandits on the way back.", "a note on one way replaced the note on another way of the same sheet");
  assert.strictEqual(atlasCard(wood, { id: "way-2" }).note, "Open ground.");
  assert.ok(atlasNoteSet(wood, "way-2", "").ok);
  // the same way, once a feature names the place it leads to: one thing, and the note stays with it
  r = turn("The mire lies behind you. [MAP_REVEAL:new|Petrified Mire|N|observed]");
  assert.ok(!r.refusal, "fixture: the feature was refused: " + JSON.stringify(r.refusal));
  var f = atlasKnowledgeProjection(atlasPublicPlace(A, wood).container).features.filter(function (x) { return x.label === "Petrified Mire"; })[0];
  assert.ok(f, "fixture: the feature is not on the wood");
  c = atlasCard(wood, { id: f.id });
  assert.ok(c, "fixture: the way's feature has no card");
  assert.strictEqual(c.note, "Watch for bandits on the way back.", "the note was lost when a feature took the way's place");
  r = atlasNoteSet(wood, f.id, "Bandits gone."); assert.ok(r.ok, JSON.stringify(r));
  assert.strictEqual(atlasCard(wood, { id: f.id }).note, "Bandits gone.");
  assert.strictEqual(Object.keys(A.publicNotes).length, 1, "the old note was left behind beside the new one: " + JSON.stringify(A.publicNotes));
  r = atlasNoteSet(wood, f.id, ""); assert.ok(r.ok && r.removed); assert.strictEqual(Object.keys(A.publicNotes).length, 0, "an emptied note is still stored: " + JSON.stringify(A.publicNotes));
});
kase("A1: a note on a place inside is kept and shown; a note saved before this build is shown until it is emptied; a thing not on the sheet is refused", function () {
  var mire = start(MIRE), A = worldState.atlas, c, r;
  worldState.turn++; worldState.world.sublocation = "Sunken Hut"; memory.map.nodes[MIRE + "|Sunken Hut"] = newMapNode(worldState.turn, MIRE); memory.map.nodes[MIRE + "|Sunken Hut"].visits = 1; atlasFollow();
  worldState.turn++; worldState.world.sublocation = null; atlasFollow();
  c = atlasCard(mire, { id: "in-1" });
  assert.ok(c && c.title === "Sunken Hut", "fixture: the place inside has no card: " + JSON.stringify(c));
  r = atlasNoteSet(mire, "in-1", "The floor is rotten."); assert.ok(r && r.ok, "a note on a place inside was refused: " + JSON.stringify(r));
  assert.strictEqual(atlasCard(mire, { id: "in-1" }).note, "The floor is rotten.", "a note saved on a place inside is never shown again");
  assert.ok(!Object.prototype.hasOwnProperty.call(A.publicNotes, "in-1"), "stored under the bare positional id: " + JSON.stringify(A.publicNotes));
  r = atlasNoteSet(mire, "in-9", "nothing"); assert.ok(r && !r.ok, "a note was saved for a thing that is not on the sheet");
  r = atlasNoteSet(mire, "way-9", "nothing"); assert.ok(r && !r.ok, "a note was saved for a way that is not on the sheet");
  // a note the old build stored under the bare id (shared by every sheet): shown, and it moves to its sheet when saved
  var wood = go(WOOD);
  A.publicNotes["way-1"] = "an old note";
  assert.strictEqual(atlasCard(wood, { id: "way-1" }).note, "an old note", "a note saved before this build can still not be seen");
  assert.strictEqual(atlasCard(mire, { id: "way-1" }).note, "an old note", "fixture: the other sheet's way-1 does not show the shared old note");
  r = atlasNoteSet(wood, "way-1", "an old note, kept here"); assert.ok(r.ok);
  assert.strictEqual(atlasCard(wood, { id: "way-1" }).note, "an old note, kept here");
  assert.strictEqual(atlasCard(mire, { id: "way-1" }).note, "an old note", "saving a note on one sheet removed the old note from another sheet, where it was the only copy");
  assert.ok(atlasNoteSet(wood, "way-1", "").removed);
  assert.strictEqual(A.publicNotes["way-1"], "an old note", "emptying a thing's own note removed the shared old note too");
  assert.ok(atlasNoteSet(wood, "way-1", "an old note, kept here").ok);
  assert.ok(atlasNoteSet(mire, "way-1", "").removed, "fixture");
  assert.ok(!Object.prototype.hasOwnProperty.call(A.publicNotes, "way-1"), "emptying the card that showed the old note did not remove it");
  assert.strictEqual(atlasCard(wood, { id: "way-1" }).note, "an old note, kept here", "emptying the old note removed another sheet's own note");
  // a feature's note keeps its place (its id is the campaign's own)
  turn("A dead oak. [MAP_REVEAL:new|dead oak|E|observed]");
  var f = atlasKnowledgeProjection(atlasPublicPlace(A, wood).container).features.filter(function (x) { return x.label === "dead oak"; })[0];
  assert.ok(atlasNoteSet(wood, f.id, "Owls.").ok); assert.strictEqual(A.publicNotes[f.id], "Owls.", "a feature's note moved to another key — notes saved before this build would be lost");
  assert.strictEqual(atlasCard(wood, { id: f.id }).note, "Owls.");
});

kase("A2: after a merge leaves two features with one name, the place's map still accepts what is new — and still refuses a new clash", function () {
  start("Mirefen", "k999"); var r, f;
  function at(world) { worldState.world.location = world; worldState.world.sublocation = null; if (!memory.map.nodes[world]) memory.map.nodes[world] = newMapNode(worldState.turn, null); memory.map.nodes[world].visits++; atlasFollow(); }
  assert.ok(!turn("A stone well stands to the north. [MAP_REVEAL:new|stone well|N|observed]").refusal);
  at("Mire Fen");
  assert.ok(!turn("Another stone well, north. [MAP_REVEAL:new|stone well|N|observed]").refusal);
  assert.ok(!turn("An old gate, west. [MAP_REVEAL:new|old gate|W|observed]").refusal);
  memory.map.identity = memory.map.identity || { entries: keyedDict() }; memory.map.identity.entries = memory.map.identity.entries || keyedDict();
  memory.map.identity.entries["Mire Fen"] = { mergedInto: "Mirefen" };
  at("Mirefen");
  f = atlasKnowledgeProjection("Mirefen").features;
  assert.strictEqual(f.filter(function (x) { return x.label === "stone well"; }).length, 2, "fixture: the merge did not leave two stone wells: " + JSON.stringify(f));
  said.toasts.length = 0;
  r = turn("A broken cart lies to the east. [MAP_REVEAL:new|broken cart|E|observed]");
  assert.strictEqual(r.refusal, null, "a new, distinct feature is refused because of the OLD pair: " + JSON.stringify(r.refusal));
  assert.deepStrictEqual(said.toasts, [], "the player is told to use a handle that cannot help: " + JSON.stringify(said.toasts));
  assert.ok(atlasKnowledgeProjection("Mirefen").features.some(function (x) { return x.label === "broken cart"; }), "the new feature was not filed");
  r = turn("A leaning post to the south. [MAP_REVEAL:new|leaning post|unknown|observed]");
  assert.strictEqual(r.refusal, null); var post = atlasKnowledgeProjection("Mirefen").features.filter(function (x) { return x.label === "leaning post"; })[0];
  r = turn("The post stands south. [MAP_REVEAL:" + post.id + "|leaning post|S|observed]");
  assert.strictEqual(r.refusal, null, "settling a direction by handle is refused because of the old pair: " + JSON.stringify(r.refusal));
  // a clash this turn MAKES is still refused: renaming the cart to the name the gate has (the gate is filed under the merged key)
  var cart = atlasKnowledgeProjection("Mirefen").features.filter(function (x) { return x.label === "broken cart"; })[0], before = JSON.stringify(memory.map.geography);
  r = turn("It is the old gate. [MAP_REVEAL:" + cart.id + "|old gate|E|observed]");
  assert.ok(r.refusal && /already identifies/.test(r.refusal.reason), "a turn that gives a second feature a name already in this place was accepted: " + JSON.stringify(r.refusal));
  assert.strictEqual(JSON.stringify(memory.map.geography), before, "the refused turn changed the store");
});

kase("A4: a read validates the store once per revision; a writer still validates every time, and a store that was not checked is never read", function () {
  start(MIRE); var s, n, i, bad;
  assert.ok(!turn("A frozen trail. [MAP_REVEAL:new|frozen trail|N|observed]").refusal);
  s = memory.map.geography;
  assert.strictEqual(typeof MapKnowledge.checks, "function", "the core does not say how often it validates");
  MapKnowledge.project(s, MIRE, "player"); n = MapKnowledge.checks();
  for (i = 0; i < 6; i++) MapKnowledge.project(s, MIRE, "player");
  assert.strictEqual(MapKnowledge.checks(), n, "every read validates the whole store again: " + (MapKnowledge.checks() - n) + " full checks for 6 reads of one revision");
  assert.ok(!turn("A sunken pool. [MAP_REVEAL:new|sunken pool|E|observed]").refusal);
  n = MapKnowledge.checks(); MapKnowledge.project(memory.map.geography, MIRE, "player");
  assert.strictEqual(MapKnowledge.checks(), n + 1, "a new revision was read without being validated");
  bad = JSON.parse(JSON.stringify(memory.map.geography)); bad.features.f1.label = 5;      // another object: what a load or an import hands over
  assert.throws(function () { MapKnowledge.project(bad, MIRE, "player"); }, /MapKnowledge/, "a store that was never checked was read");
  assert.throws(function () { MapKnowledge.project(bad, MIRE, "player"); }, /MapKnowledge/, "a store that failed its check was read the second time it was asked for");
  s = JSON.parse(JSON.stringify(memory.map.geography)); MapKnowledge.project(s, MIRE, "player"); s.features.f1.bearing = "UP"; s.revision++;
  assert.throws(function () { MapKnowledge.project(s, MIRE, "player"); }, /MapKnowledge/, "a new revision of a store that passed before was read unchecked");
  bad = JSON.parse(JSON.stringify(memory.map.geography)); bad.features.f1.bearing = "UP";
  assert.ok(MapKnowledge.problem(bad), "the full check no longer finds a bad bearing");
  s = memory.map.geography; MapKnowledge.project(s, MIRE, "player"); s.features.f1.bearing = "UP";   // changed in place, which no writer does
  assert.ok(MapKnowledge.problem(s), "the writers' check trusts a store it validated before");
  assert.ok(!MapKnowledge.prepare(s, [], { channel: "gm", commit: "t:1", turn: 9, container: MIRE, text: "" }).ok, "a writer accepted a store changed in place");
});

kase("A5: the directions ask gives up on a feature the model will not place — three paid asks, then none; a failed request is not counted", function () {
  start(MIRE); var calls = [], realGM = callGM, reply = "{\"directions\":[]}";
  assert.ok(!turn("A frozen trail somewhere. [MAP_REVEAL:new|frozen trail|unknown|observed]").refusal);
  callGM = function (user) { calls.push(String(user)); return typeof reply === "function" ? reply() : Promise.resolve(reply); };
  function ask() { worldState.turn++; return atlasDirectionsSettle("You look about the mire.", "I look around."); }
  assert.strictEqual(typeof ATLAS_DIRECTIONS_TRIES, "number", "no limit is declared");
  var p = Promise.resolve(), i;
  reply = function () { return Promise.reject(new Error("offline")); };
  for (i = 0; i < 4; i++) p = p.then(ask);
  return p.then(function () {
    assert.strictEqual(calls.length, 4, "fixture: the failed requests were not made");
    calls.length = 0; reply = "{\"directions\":[]}"; var q = Promise.resolve();
    for (i = 0; i < ATLAS_DIRECTIONS_TRIES + 3; i++) q = q.then(ask);
    return q;
  }).then(function () {
    assert.strictEqual(calls.length, ATLAS_DIRECTIONS_TRIES, "the model was asked " + calls.length + " times for a feature it declines to place (a paid call every turn)");
    assert.strictEqual(said.toasts.filter(function (t) { return /no direction could be settled for frozen trail/.test(t); }).length, 1, "giving up on a feature is not said, or said more than once: " + JSON.stringify(said.toasts));
    // a feature disclosed now is asked in its own right; the one given up on is not sent with it
    assert.ok(!turn("A sunken pool somewhere. [MAP_REVEAL:new|sunken pool|unknown|observed]").refusal);
    calls.length = 0; var f = atlasKnowledgeProjection(MIRE).features.filter(function (x) { return x.label === "sunken pool"; })[0];
    reply = "{\"directions\":[{\"id\":\"" + f.id + "\",\"bearing\":\"E\"}]}";
    return ask();
  }).then(function (placed) {
    assert.strictEqual(calls.length, 1, "a newly owed feature was not asked");
    assert.ok(!/frozen trail/.test(JSON.parse(calls[0]).owed.map(function (x) { return x.label; }).join()), "the feature given up on is still sent: " + calls[0]);
    assert.ok(placed && placed.length === 1 && placed[0].bearing === "E", "the answer was not filed: " + JSON.stringify(placed));
    // the GM is still told the direction is owed: giving up is the backstop's, not the rule's
    assert.ok(/frozen trail/.test(atlasKnowledgePlayerBlock()), "the feature left the GM's brief");
    callGM = realGM;
  }, function (e) { callGM = realGM; throw e; });
});

kase("A6: the region never sets a place down on a spot another place already keeps", function () {
  start(MIRE, "k771"); go(FIELDS); go(WOOD);
  var A = worldState.atlas, r = atlasRegionSpots(A), p1, pts;
  assert.strictEqual(r.fresh.length, 3, "fixture: the three places were not set down: " + JSON.stringify(r.fresh));
  p1 = r.fresh[0].at;
  A.spots = keyedDict(); A.spots[WOOD] = { at: p1.slice(), turn: 3 };      // the LAST place keeps the point the FIRST would be set at
  r = atlasRegionSpots(A);
  pts = Object.keys(r.spots).map(function (k) { return JSON.stringify(r.spots[k]); });
  assert.deepStrictEqual(r.spots[WOOD], p1, "a kept spot moved");
  assert.strictEqual(pts.filter(function (x, i) { return pts.indexOf(x) === i; }).length, 3, "two places stand on one point: " + JSON.stringify(r.spots));
  // the ordinary case draws as before: nothing kept later in the order, so nothing new to avoid
  start(MIRE, "k771"); go(FIELDS); go(WOOD);
  var plain = atlasRegionSpots(worldState.atlas);
  assert.deepStrictEqual(plain.fresh[0].at, p1, "the first place is set down somewhere else than before");
});

kase("A7: a way past the sixteenth is listed, not dropped; a list that is cut says how many it leaves out", function () {
  var hub = start(MIRE), i, names = [], d, listed, c, A;
  for (i = 0; i < 20; i++) { names.push("Stonefield " + (i + 1)); go(names[i]); go(MIRE); }
  A = worldState.atlas; d = atlasDoc(hub);
  assert.ok(atlasSheetDrawn(d), "fixture: the hub is not drawn");
  assert.strictEqual((d.portals || []).length, ATLAS_SHEET_EXIT_CAP, "fixture: the sheet does not draw sixteen ways");
  listed = (d.site.unplaced || []).map(function (u) { return u.name; });
  for (i = 16; i < 20; i++) assert.ok(listed.indexOf("The way to " + names[i]) >= 0, "the way to " + names[i] + " is neither drawn nor listed: " + JSON.stringify(listed));
  c = atlasCard(hub, { id: "way-17" });
  assert.ok(c && /Stonefield 17/.test(c.title) && c.opens, "a listed way has no card that opens where it leads: " + JSON.stringify(c));
  // more things without a position than the list holds: the last row says so
  var text = ""; for (i = 0; i < 16; i++) text += " [MAP_REVEAL:new|rumoured cairn " + (i + 1) + "|unknown|reported]";
  for (i = 0; i < 5; i++) { assert.ok(!turn("Talk of cairns." + text.replace(/cairn (\d+)/g, function (m, n) { return "cairn " + (i * 16 + Number(n)); })).refusal); }
  d = atlasDoc(hub); listed = d.site.unplaced || [];
  assert.strictEqual(listed.length, ATLAS_SHEET_LIST_CAP, "fixture: the list is not full: " + listed.length);
  var total = 80 + 4, last = listed[listed.length - 1];
  assert.ok(/more/.test(last.name) && new RegExp("\\b" + (total - (ATLAS_SHEET_LIST_CAP - 1)) + "\\b").test(last.name), "a cut list does not say how many it leaves out: " + JSON.stringify(last));
  assert.strictEqual(atlasCard(hub, { id: last.id }), null, "the row that only counts is offered as a thing");
});

kase("A8: at the place limit the map says so once and mails nothing; the sheets it has are kept", function () {
  var realCap = ATLAS_PUBLIC_PLACE_CAP, first = start(MIRE), second, A;
  second = go(WOOD); A = worldState.atlas;
  ATLAS_PUBLIC_PLACE_CAP = 2;
  try {
    said.toasts.length = 0; said.reports.length = 0;
    go(FIELDS);
    assert.strictEqual(said.toasts.filter(function (t) { return /place limit/.test(t); }).length, 1, "the follow that meets the limit does not say so: " + JSON.stringify(said.toasts));
    go(MIRE); go(FIELDS); atlasFollow(); atlasFollow();
    assert.deepStrictEqual(said.reports, [], "the limit is mailed as an error: " + JSON.stringify(said.reports));
    var caps = said.toasts.filter(function (t) { return /place limit/.test(t); });
    assert.strictEqual(caps.length, 1, "the limit is said " + caps.length + " times (every follow): " + JSON.stringify(said.toasts));
    assert.strictEqual(Object.keys(A.publicPlaces.places).length, 2, "a sheet was lost or added at the limit");
    assert.ok(atlasDoc(first) && atlasDoc(second), "an existing sheet can no longer be drawn");
    // any OTHER failure of the follow is still mailed
    var realFollow = atlasPublicPlacesFollow; atlasPublicPlacesFollow = function () { throw new Error("something else broke"); };
    atlasFollow(); atlasPublicPlacesFollow = realFollow;
    assert.strictEqual(said.reports.length, 1, "an unexpected failure of the follow is no longer reported");
  } finally { ATLAS_PUBLIC_PLACE_CAP = realCap; }
});

// ── the independent review of the map batch (2026-11-20): what it reproduced, as cases ─────────────────────────────
function mergeInto(dup, canon) { memory.map.identity = memory.map.identity || { entries: keyedDict() }; memory.map.identity.entries = memory.map.identity.entries || keyedDict(); memory.map.identity.entries[dup] = { mergedInto: canon }; atlasForget(); }
kase("A1 review: a note on a place inside stays with it when a feature comes to name that place", function () {
  var mire = start(MIRE), A = worldState.atlas, f;
  worldState.turn++; worldState.world.sublocation = "Sunken Hut"; memory.map.nodes[MIRE + "|Sunken Hut"] = newMapNode(worldState.turn, MIRE); memory.map.nodes[MIRE + "|Sunken Hut"].visits = 1; atlasFollow();
  worldState.turn++; worldState.world.sublocation = null; atlasFollow();
  assert.ok(atlasNoteSet(mire, "in-1", "Rotten floor.").ok);
  assert.ok(!turn("The hut squats to the north. [MAP_REVEAL:new|Sunken Hut|N|observed]").refusal);
  f = atlasKnowledgeProjection(MIRE).features.filter(function (x) { return x.label === "Sunken Hut"; })[0];
  assert.strictEqual(atlasCard(mire, { id: "in-1" }), null, "fixture: the place inside is still listed beside the feature that names it");
  assert.strictEqual(atlasCard(mire, { id: f.id }).note, "Rotten floor.", "the note was lost when a feature took the place's place on the sheet: " + JSON.stringify(A.publicNotes));
  assert.ok(atlasNoteSet(mire, f.id, "Rotten floor, mind the well.").ok);
  assert.strictEqual(Object.keys(A.publicNotes).length, 1, "the old note was left beside the new one: " + JSON.stringify(A.publicNotes));
});
kase("A1 review: a way's note survives a merge of the place it leads to, and a merge of the place it was written in", function () {
  var wood = start(WOOD), fen = go("Mire Fen"), A; go(WOOD); A = worldState.atlas;
  assert.ok(atlasNoteSet(wood, "way-1", "The fen road floods.").ok, "fixture");
  assert.strictEqual(atlasCard(wood, { id: "way-1" }).note, "The fen road floods.");
  memory.map.nodes["Mirefen"] = newMapNode(1, null); mergeInto("Mire Fen", "Mirefen");
  var c = atlasCard(wood, { id: "way-1" });
  assert.ok(c && /Mirefen/.test(c.title), "fixture: the way does not lead to the merged place: " + JSON.stringify(c && c.title));
  assert.strictEqual(c.note, "The fen road floods.", "the note became unreachable when the place the way leads to was merged: " + JSON.stringify(A.publicNotes));
  assert.ok(atlasNoteSet(wood, "way-1", "The fen road floods in spring.").ok);
  assert.strictEqual(Object.keys(A.publicNotes).length, 1, "the note is now stored twice, once under each name: " + JSON.stringify(A.publicNotes));
  // the place the note was written IN is folded into another
  var black = start("Black Fen"), w2 = go(WOOD); go("Black Fen"); A = worldState.atlas;
  assert.ok(atlasNoteSet(black, "way-1", "Wolves on this road.").ok, "fixture");
  go("Dark Fen"); go(WOOD); mergeInto("Black Fen", "Dark Fen"); atlasFollow();
  var rows = atlasPublicPlacesList(A).filter(function (r) { return r.container === "Dark Fen"; });
  assert.strictEqual(rows.length, 1, "fixture: the two fens are not one place");
  var ways = [1, 2, 3].map(function (n) { return atlasCard(rows[0].id, { id: "way-" + n }); }).filter(function (x) { return x && /Gloomwood/.test(x.title); });
  assert.ok(ways.length === 1, "fixture: the surviving sheet has no way to the wood");
  assert.strictEqual(ways[0].note, "Wolves on this road.", "the note became unreachable when the place it was written in was merged: " + JSON.stringify(A.publicNotes));
});
kase("A5 review: three answers that cannot be used end the asking too — and the map says so instead of promising another ask", function () {
  start(MIRE); var calls = 0, realGM = callGM;
  assert.ok(!turn("A frozen trail somewhere. [MAP_REVEAL:new|frozen trail|unknown|observed]").refusal);
  callGM = function () { calls++; return Promise.resolve("I cannot tell."); };
  function ask() { worldState.turn++; return atlasDirectionsSettle("You look about.", "I look."); }
  var p = Promise.resolve(), i; for (i = 0; i < ATLAS_DIRECTIONS_TRIES + 2; i++) p = p.then(ask);
  return p.then(function () {
    callGM = realGM;
    assert.strictEqual(calls, ATLAS_DIRECTIONS_TRIES, "an answer that cannot be read is asked for again every turn: " + calls);
    var last = said.toasts.filter(function (t) { return /directions could not be settled/.test(t); });
    assert.strictEqual(last.length, ATLAS_DIRECTIONS_TRIES);
    assert.ok(/asked again next turn/.test(last[0]) && !/stops asking/.test(last[0]), "the first failure does not say it will be asked again: " + last[0]);
    assert.ok(/stops asking for frozen trail/.test(last[last.length - 1]) && !/asked again next turn/.test(last[last.length - 1]), "the last failure promises an ask that never comes: " + last[last.length - 1]);
  }, function (e) { callGM = realGM; throw e; });
});
kase("A7 review: past the sixteenth way a feature that names the way keeps its pin; the row that only counts is no thing", function () {
  var hub = start(MIRE), i, names = [], d, f;
  for (i = 0; i < 18; i++) { names.push("Stonefield " + (i + 1)); go(names[i]); go(MIRE); }
  assert.ok(!turn("Stonefield 17 lies to the north-east. [MAP_REVEAL:new|Stonefield 17|NE|observed]").refusal);
  assert.ok(!turn("Stonefield 2 lies west. [MAP_REVEAL:new|Stonefield 2|W|observed]").refusal);
  d = atlasDoc(hub);
  f = atlasKnowledgeProjection(MIRE).features.filter(function (x) { return x.label === "Stonefield 17"; })[0];
  assert.ok((d.features || []).some(function (x) { return x.id === f.id; }), "a feature with a stated direction lost its pin because it names a way past the sixteenth");
  assert.ok(!(d.site.unplaced || []).some(function (u) { return u.id === f.id; }), "it is drawn AND listed");
  var c = atlasCard(hub, { id: f.id }); assert.ok(c && c.opens, "its card no longer opens where the way leads");
  var f2 = atlasKnowledgeProjection(MIRE).features.filter(function (x) { return x.label === "Stonefield 2"; })[0];
  assert.ok((d.portals || []).some(function (x) { return x.id === f2.id; }) && !(d.features || []).some(function (x) { return x.id === f2.id; }), "a feature that names a DRAWN way is no longer that way");
  var cave = start("Echo Caverns"), seen;
  for (i = 0; i < 18; i++) { go(names[i]); go("Echo Caverns"); }
  assert.ok(!turn("A passage toward Stonefield 17. [MAP_REVEAL:new|Stonefield 17|NE|observed]").refusal);
  d = atlasDoc(cave);
  assert.ok(atlasSheetDrawn(d) && d.generator.name !== "wild", "fixture: the caverns are not drawn as a site (" + (d.generator && d.generator.name) + ")");
  f = atlasKnowledgeProjection("Echo Caverns").features.filter(function (x) { return x.label === "Stonefield 17"; })[0];
  seen = (d.features || []).concat(d.unplaced || []).filter(function (x) { return x.id === f.id; }).length;
  assert.strictEqual(seen, 1, "on a site, a feature that names a way past the sixteenth is on the sheet " + seen + " times");
  hub = start(MIRE); for (i = 0; i < 18; i++) { go(names[i]); go(MIRE); }
  var text = ""; for (i = 0; i < 80; i++) text += " [MAP_REVEAL:new|rumoured cairn " + (i + 1) + "|unknown|reported]";
  for (i = 0; i < 5; i++) assert.ok(!turn("Talk." + text.split(" [MAP").slice(1 + i * 16, 17 + i * 16).map(function (x) { return " [MAP" + x; }).join("")).refusal);
  d = atlasDoc(hub);
  assert.ok((d.site.unplaced || []).some(function (u) { return u.id === ATLAS_SHEET_MORE_ID; }), "fixture: the list is not cut");
  assert.ok(atlasThings(d).length > 60, "fixture: the sheet's things were not read");
  assert.ok(!atlasThings(d).some(function (t) { return t.id === ATLAS_SHEET_MORE_ID; }), "the row that only counts is handed out as a thing (a stop of the keyboard walk with no card)");
});
kase("A8 review: at the place limit the party is still followed back to a place that has a sheet", function () {
  var realCap = ATLAS_PUBLIC_PLACE_CAP, first = start(MIRE), second, A;
  second = go(WOOD); A = worldState.atlas; ATLAS_PUBLIC_PLACE_CAP = 2;
  try {
    memory.map.nodes["Old Vale"] = newMapNode(1, null); memory.map.nodes["Old Vale"].visits = 1;   // visited once, never given a sheet
    said.toasts.length = 0; atlasFollow();
    assert.strictEqual(A.at, second, "a place that cannot be recovered stopped the follow of the place the party stands in");
    assert.strictEqual(said.toasts.filter(function (t) { return /place limit/.test(t); }).length, 1, "the limit, first met while recovering a place, is not said: " + JSON.stringify(said.toasts));
    go(FIELDS); assert.strictEqual(A.at, second, "fixture: the party was not left where the limit stopped it");
    said.reports.length = 0;
    go(MIRE);
    assert.strictEqual(A.at, first, "back in a place that HAS a sheet, the map still shows the party elsewhere");
    go(WOOD); assert.strictEqual(A.at, second);
    assert.deepStrictEqual(said.reports, []); assert.ok(said.toasts.filter(function (t) { return /place limit/.test(t); }).length <= 1, "the limit is said on every follow");
  } finally { ATLAS_PUBLIC_PLACE_CAP = realCap; }
});

var argv = process.argv.slice(2), only = argv.indexOf("--only") >= 0 ? argv[argv.indexOf("--only") + 1] : "", passed = 0, failed = 0;
var todo = CASES.filter(function (c) { return !only || c.name.indexOf(only) >= 0; });
if (!todo.length) { realErr.call(console, "--only \"" + only + "\" matched 0 tests — NOTHING ran"); process.exit(1); }
function next(i) {
  if (i >= todo.length) {
    if (failed) { realErr.call(console, "#777 atlas: " + failed + " FAILED, " + passed + " passed"); process.exit(1); }
    realLog.call(console, "ALL GREEN — " + passed + " #777 atlas cases"); process.exit(0);
  }
  var c = todo[i];
  function ok() { passed++; realLog.call(console, "PASS #777 " + c.name); next(i + 1); }
  function bad(e) { failed++; realErr.call(console, "FAIL #777 " + c.name + " — " + String((e && e.stack) || e).split("\n").slice(0, 5).join("\n    ")); next(i + 1); }
  try { var r = c.fn(); if (r && typeof r.then === "function") r.then(ok, bad); else ok(); } catch (e) { bad(e); }
}
next(0);
