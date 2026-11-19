// dev/tests-777-campaign.js — audit 2026-11-19 (TODO #777), section X: a model call that outlives its campaign writes
// nothing. Side calls the turn does not await (the era compile, the story-so-far recap, a companion's sheet, the suggestion
// buttons) come back later; each used to write into whichever campaign was open by then. state.js campaignMark /
// campaignStill / campaignEpochBump hold the mechanism; dev/class-guards.js derives the two rules.
// Every case runs the REAL engine in a process of its own. The campaign is switched through the real doors
// (switchToCampaign, loadState, importSaveData, checkpointRestore, the cloud adopt), never by swapping a global by hand.
//   node dev/tests-777-campaign.js             every case
//   node dev/tests-777-campaign.js --only X1   the cases whose name contains the text
// ES5 throughout, matching the engine.
var path = require("path"), cp = require("child_process"), fs = require("fs"), assert = require("assert");
var CASES = [];
function kase(name, fn) { CASES.push({ name: name, fn: fn }); }
function tick(ms) { return new Promise(function (r) { setTimeout(r, ms || 15); }); }

function boot() {
  var L = require("./load-engine.js");
  L.loadEngine();
  var said = { toasts: [], warns: [], errors: [], infos: [] };
  showToast = function (m) { said.toasts.push(String(m)); };
  console.warn = function () { said.warns.push([].join.call(arguments, " ")); };
  console.info = function () { said.infos.push([].join.call(arguments, " ")); };
  console.error = function () { said.errors.push([].join.call(arguments, " ")); };
  syncUI = function () {}; addMsg = function () { return el(); }; reportError = function () {};
  document = { createElement: function () { return el(); }, getElementById: function () { return null; }, querySelector: function () { return null; }, addEventListener: function () {} };
  return { L: L, said: said };
}
function el() {
  return { className: "", textContent: "", innerHTML: "", disabled: false, style: {}, parentNode: null, children: [],
    appendChild: function (c) { c.parentNode = this; this.children.push(c); return c; }, removeChild: function (c) { c.parentNode = null; },
    insertAdjacentHTML: function () {}, setAttribute: function () {}, removeAttribute: function () {}, remove: function () {} };
}
// the model, held until the test lets it answer
function heldModel() {
  var h = { calls: 0, release: null };
  callGM = function () { h.calls++; return new Promise(function (res, rej) { h.release = res; h.fail = rej; }); };
  return h;
}
// campaign A live and active, campaign B in its slot — both on this device, no server
function campaigns(E, prepA, prepB) {
  var B = E.L.makeTestWorld({ campId: "campB", campName: "Beta", turn: 7 });
  var memB = blankMemory(); memB.campId = "campB";
  if (prepB) prepB(B, memB);
  store.set(campSlotKey("campB", "ws"), serializeWorldState(B)); store.set(campSlotKey("campB", "sl"), "[]"); store.set(campSlotKey("campB", "mem"), JSON.stringify(memB));
  var A = E.L.makeTestWorld({ campId: "campA", campName: "Alpha", turn: 300 });
  memory.campId = "campA";
  if (prepA) prepA(A, memory);
  setActiveCampId("campA"); store.set(WSK, serializeWorldState(A)); store.set(SLK, "[]"); store.set(MEM_KEY, JSON.stringify(memory));
  setCampMeta([{ id: "campA", campName: "Alpha" }, { id: "campB", campName: "Beta" }]);
  assert.strictEqual(loadState(), true, "campaign A did not load");
}
function eraDue(ws, mem) { var a = mem.archive || (mem.archive = blankArchive()), i; for (i = 1; i <= 22; i++) a.chapters.push({ turn: i * 10, summary: "Alpha chapter " + i + ": Korrag fought in Ashfen." }); }
var ALPHA_ERA = '{"summary":"Alpha era: Korrag fought in Ashfen across twenty chapters."}';

// ── the mechanism ──────────────────────────────────────────────────────────────────────────────────────────────────
kase("X: a mark survives the turn's own clone-and-replace, and every door that installs another state ends it", function (E) {
  campaigns(E);
  var m = campaignMark();
  assert.strictEqual(campaignStill(m, null), true);
  worldState = _w2CopyWorldStateDetached(worldState); memory = _w2Copy(memory, "memory");   // what a committed canon claim does mid-turn
  assert.strictEqual(campaignStill(m, null), true, "an ordinary turn's transaction ended the mark — every side call would be dropped");
  assert.strictEqual(loadState(), true);                                                    // the same campaign, loaded again (a pull lands this way)
  assert.strictEqual(campaignStill(m, "a test call"), false, "a reload of the same campaign did not end the mark");
  assert.ok(E.said.warns.some(function (l) { return /a test call was started in campA/.test(l); }), "a refused write was not logged: " + JSON.stringify(E.said.warns));
  m = campaignMark(); assert.strictEqual(switchToCampaign("campB"), true);
  assert.strictEqual(campaignStill(m, null), false, "a campaign switch did not end the mark");
  m = campaignMark(); rehomeCampaign("test");
  assert.strictEqual(campaignStill(m, null), false, "a re-home (a new id) did not end the mark");
  m = campaignMark();
  var snap = checkpointCapture("rest"); assert.ok(snap, "no camp captured");
  assert.strictEqual(checkpointRestore(snap, { cause: "a fall" }).ok, true);
  assert.strictEqual(campaignStill(m, null), false, "a camp restore (an older copy of the same campaign) did not end the mark");
  m = campaignMark();
  importSaveData({ worldState: JSON.parse(JSON.stringify(worldState)), sessionLog: [], memory: blankMemory() });
  assert.strictEqual(campaignStill(m, null), false, "an import did not end the mark");
  m = campaignMark(); removeActiveCampaignLocally(getActiveCampId());
  assert.strictEqual(campaignStill(m, null), false, "removing the open campaign did not end the mark");
  assert.strictEqual(campaignStill(campaignMark(), null), false, "a mark taken with no campaign open must never allow a write");
});
kase("X: the cloud adopt (a newer copy of the SAME campaign) ends the mark", function (E) {
  campaigns(E);
  var server = JSON.parse(JSON.stringify(worldState)); server.turn = 900;
  setCampMeta([{ id: "campA", campName: "Alpha", onServer: true }]);
  global.fetch = function (url, opts) {
    var ok = function (b) { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(b); } }); };
    if (opts && opts.method === "POST") return ok({ ok: true });
    if (/\/api\/campaigns\/campA$/.test(url)) return ok({ campaignId: "campA", worldState: server, sessionLog: [], memory: blankMemory() });
    return ok([]);
  };
  storageAdapter.setServer("https://unit.test", "tok");
  var m = null;
  storageAdapter.load(function () { m = campaignMark(); });   // the mark is taken after the local load, before the reconcile answers
  return tick(60).then(function () {
    assert.strictEqual(worldState.turn, 900, "the cloud copy was not adopted");
    assert.strictEqual(campaignStill(m, null), false, "the adopted cloud copy did not end a mark taken in the local one");
  });
});

// ── X1: the era compile ────────────────────────────────────────────────────────────────────────────────────────────
kase("X1: an era compiled for campaign A is not written into campaign B when the player switches while it compiles", function (E) {
  campaigns(E, eraDue);
  var gm = heldModel(), p = compileEraIfDue();
  assert.strictEqual(gm.calls, 1, "no era was due — the fixture no longer triggers a compile");
  assert.strictEqual(switchToCampaign("campB"), true);
  gm.release(ALPHA_ERA);
  return p.then(function () {
    assert.strictEqual(worldState.campId, "campB");
    assert.deepStrictEqual(memory.eras || [], [], "campaign A's era is in campaign B: " + JSON.stringify(memory.eras));
    assert.ok(String(store.get(MEM_KEY)).indexOf("Alpha era") < 0, "campaign A's era was SAVED into campaign B's memory");
    assert.ok(E.said.warns.some(function (l) { return /the era compile was started in campA/.test(l); }), "the dropped era was not logged: " + JSON.stringify(E.said.warns));
    assert.strictEqual(switchToCampaign("campA"), true);
    var again = heldModel(), q = compileEraIfDue();
    assert.strictEqual(again.calls, 1, "the era lock was left set — campaign A's era can never compile again this session");
    again.release(ALPHA_ERA);
    return q;
  }).then(function () { assert.strictEqual(memEras().length, 1, "back in campaign A the era did not compile"); assert.strictEqual(worldState.campId, "campA"); });
});
kase("X1: with no switch the era is compiled and saved as before", function (E) {
  campaigns(E, eraDue);
  var gm = heldModel(), p = compileEraIfDue();
  gm.release(ALPHA_ERA);
  return p.then(function () {
    assert.strictEqual(memEras().length, 1);
    assert.ok(String(store.get(MEM_KEY)).indexOf("Alpha era") >= 0, "the era was not saved");
  });
});

// ── X2: the story so far ───────────────────────────────────────────────────────────────────────────────────────────
var RECAP = JSON.stringify({ about: "A's story: the hero of Alpha slew the A-dragon.", now: "In Alpha's tower" });
kase("X2: the recap written for campaign A is not put in campaign B's journal, and B's own recap can still be written", function (E) {
  campaigns(E);
  var gm = heldModel(), p = refreshSynopsis("spine");
  assert.strictEqual(gm.calls, 1);
  assert.strictEqual(switchToCampaign("campB"), true);
  gm.release(RECAP);
  return p.then(function (ok) {
    assert.strictEqual(ok, false, "the refresh reported success");
    assert.strictEqual(worldState.synopsis, undefined, "campaign A's recap is in campaign B: " + JSON.stringify(worldState.synopsis));
    assert.ok(String(store.get(WSK)).indexOf("A-dragon") < 0, "campaign A's recap was SAVED into campaign B");
    assert.ok(!E.said.toasts.some(function (t) { return /story so far is up to date/.test(t); }), "the player was told B's recap is up to date");
    var again = heldModel(), q = refreshSynopsis("button");
    assert.strictEqual(again.calls, 1, "the recap lock was left set — campaign B's recap cannot be written");
    again.release(JSON.stringify({ about: "B's story.", now: "Here" }));
    return q;
  }).then(function () { assert.strictEqual(worldState.synopsis.about, "B's story."); });
});
kase("X2: with no switch the recap is written as before", function (E) {
  campaigns(E);
  var gm = heldModel(), p = refreshSynopsis("spine");
  gm.release(RECAP);
  return p.then(function (ok) { assert.strictEqual(ok, true); assert.ok(/A-dragon/.test(worldState.synopsis.about)); });
});

// ── X3: a companion's sheet ────────────────────────────────────────────────────────────────────────────────────────
function bram(ws, mem) { ws.npcs.push({ name: "Bram", partyMember: true, sheetPending: true, charSheet: null, status: "ally" }); mem.npcs.Bram = { attitude: "ally", knowledge: [], events: [] }; }
var BRAM = JSON.stringify({ name: "Bram", cls: "Wizard", level: 3, gender: "M", stats: { STR: 10, DEX: 10, CON: 10, INT: 16, WIS: 10, CHA: 10 }, hp: 12, maxHp: 12, ac: 12, spells: [{ nm: "Gloomshard Lance", lvl: 1, def: { tier: 1, effect: "A shard from campaign Alpha" } }], inventory: [] });
function bramOf() { return worldState.npcs.filter(function (n) { return n.name === "Bram"; })[0]; }
kase("X3: a sheet generated for campaign A's Bram is not attached to campaign B's Bram, and its spell lands nowhere in B", function (E) {
  campaigns(E, bram, bram);
  var gm = heldModel(), p = generateCompanionSheet("Bram");
  assert.strictEqual(gm.calls, 1);
  assert.strictEqual(switchToCampaign("campB"), true);
  gm.release(BRAM);
  return p.then(function () {
    assert.strictEqual(bramOf().charSheet, null, "campaign B's Bram got campaign A's sheet");
    assert.ok(JSON.stringify(worldState).indexOf("Gloomshard") < 0 && JSON.stringify(memory).indexOf("Gloomshard") < 0, "campaign A's spell definition landed in campaign B");
    assert.ok(!E.said.toasts.some(function (t) { return /sheet/.test(t); }), "the player was told a sheet was drawn: " + JSON.stringify(E.said.toasts));
    var again = heldModel(); generateCompanionSheet("Bram");
    assert.strictEqual(again.calls, 1, "the in-flight latch was left set — B's Bram can never get a sheet this session");
  });
});
kase("X3: a failed request for campaign A's Bram does not give campaign B's Bram the stub sheet", function (E) {
  campaigns(E, bram, bram);
  var gm = heldModel(), p = generateCompanionSheet("Bram");
  assert.strictEqual(switchToCampaign("campB"), true);
  gm.fail(new Error("provider down"));
  return p.then(function () { assert.strictEqual(bramOf().charSheet, null, "campaign B's Bram got a stub sheet from campaign A's failed request"); });
});
kase("X3: with no switch the sheet is attached as before", function (E) {
  campaigns(E, bram, bram);
  var gm = heldModel(), p = generateCompanionSheet("Bram");
  gm.release(BRAM);
  return p.then(function () {
    assert.ok(bramOf().charSheet && bramOf().charSheet.name === "Bram" && bramOf().charSheet.stats.INT === 16, "the sheet was not attached");
    assert.ok(E.said.toasts.some(function (t) { return /Bram's sheet drawn up/.test(t); }));
  });
});

// ── X4: the suggestion buttons ─────────────────────────────────────────────────────────────────────────────────────
var ACTS = JSON.stringify({ present: "", actions: ["Search the Alpha vault", "Call for Korrag", "Leave Ashfen"] });
kase("X4: buttons suggested for campaign A are not saved into campaign B at the same turn number", function (E) {
  campaigns(E, null, function (B) { B.turn = 300; });   // the same turn as A: the old guard compared the turn alone
  sessionLog = [{ role: "user", content: "look" }, { role: "assistant", content: "You look around." }];
  var gm = heldModel(), p = generateActions(el());
  assert.strictEqual(gm.calls, 1, "no suggestion call was made (in-band buttons?)");
  assert.strictEqual(switchToCampaign("campB"), true);
  assert.strictEqual(worldState.turn, 300);
  gm.release(ACTS);
  return p.then(function () {
    assert.ok(!worldState.lastActions, "campaign A's buttons are in campaign B: " + JSON.stringify(worldState.lastActions));
    assert.ok(String(store.get(WSK)).indexOf("Alpha vault") < 0, "campaign A's buttons were SAVED into campaign B");
  });
});
kase("X4: with no switch the buttons are kept as before", function (E) {
  campaigns(E);
  sessionLog = [{ role: "user", content: "look" }, { role: "assistant", content: "You look around." }];
  var gm = heldModel(), p = generateActions(el());
  gm.release(ACTS);
  return p.then(function () { assert.ok(worldState.lastActions && worldState.lastActions.length >= 3, "no buttons: " + JSON.stringify(worldState.lastActions)); });
});

// ── X5: the last action ────────────────────────────────────────────────────────────────────────────────────────────
kase("X5: the last action does not survive a campaign load — Retry cannot send campaign A's action into campaign B", function (E) {
  campaigns(E);
  lastAction = "I stab the Alpha king"; lastActionOpts = { silent: true };
  assert.strictEqual(switchToCampaign("campB"), true);
  assert.strictEqual(lastAction, null, "campaign A's last action is still armed in campaign B: " + lastAction);
  assert.strictEqual(lastActionOpts, null);
  var sent = [];
  sendAction = function (t) { sent.push(t); };
  retryLast();
  assert.deepStrictEqual(sent, [], "Retry sent campaign A's action into campaign B");
});

// ── X8: Begin while a portrait is being drawn ──────────────────────────────────────────────────────────────────────
kase("X8: Begin does nothing while a generation holds busy (the review page's portrait), and says so", function (E) {
  (0, eval)(fs.readFileSync(path.join(__dirname, "..", "char-creation.js"), "utf8"));
  var started = 0; startGame = function () { started++; };
  busy = true; E.said.toasts.length = 0;
  confirmChar();
  assert.strictEqual(started, 0, "a game was started under a running generation");
  assert.ok(E.said.toasts.some(function (t) { return /still being generated/.test(t); }), "nothing was said: " + JSON.stringify(E.said.toasts));
  assert.strictEqual(busy, true, "Begin cleared a busy flag it does not own");
});

// ── the two derived rules ──────────────────────────────────────────────────────────────────────────────────────────
kase("X: the class guards — every door bumps the epoch, every model call that writes afterwards checks its campaign; both are derived from the source", function () {
  var cg = require("./class-guards.js"), root = path.join(__dirname, "..");
  assert.deepStrictEqual(cg.campaignDoorProblems(root), []);
  assert.deepStrictEqual(cg.awaitThenWriteProblems(root), []);
  assert.deepStrictEqual(cg.staleCampaignExemptions(root), []);
  assert.ok(String(cg.allProblems).indexOf("campaignDoorProblems(root)") > 0 && String(cg.allProblems).indexOf("awaitThenWriteProblems(root)") > 0, "the two rules are not part of the class guards run-tests calls");
  var none = { doors: [], awaits: [] };
  var door = [{ file: "x.js", text: "var worldState=null;\nfunction adopt(d){\n  worldState=d.world;\n}\nfunction good(d){\n  campaignEpochBump();\n  worldState = d.world;\n}\nfunction reads(){ return worldState==null || worldState.turn===3; }\n" }];
  var found = cg.campaignDoorProblems(root, { sources: door, exempt: [] });
  assert.strictEqual(found.length, 1, JSON.stringify(found)); assert.ok(/x\.js:3 assigns the live worldState in adopt/.test(found[0]), found[0]);
  assert.deepStrictEqual(cg.campaignDoorProblems(root, { sources: door, exempt: [{ file: "x.js", fn: "adopt", why: "t" }] }), []);
  var calls = [{ file: "y.js", text: [
    "async function bad(){ var r=await callGM('x'); worldState.synopsis=r; saveCore(); }",
    "async function pushes(){ var r=await callGM('x'); memory.lore.push(r); }",
    "async function good(){ var m=campaignMark(); var r=await callGM('x'); if(!campaignStill(m,'t'))return; worldState.synopsis=r; saveCore(); }",
    "async function readsOnly(){ var r=await callGM('x'); return worldState.turn+r; }",
    "async function writesBefore(){ worldState.pending=1; var r=await callGM('x'); return r; }",
    "function then(){ callGM('x').then(function(r){ memory.eras[0]=r; saveMem(); }); }"
  ].join("\n") }];
  found = cg.awaitThenWriteProblems(root, { sources: calls, exempt: [] });
  assert.deepStrictEqual(found.map(function (p) { return /y\.js:\d+ (\w+) /.exec(p)[1]; }), ["bad", "pushes", "then"], JSON.stringify(found));
  assert.deepStrictEqual(cg.awaitThenWriteProblems(root, { sources: calls, exempt: [{ file: "y.js", fn: "bad", why: "t" }, { file: "y.js", fn: "pushes", why: "t" }, { file: "y.js", fn: "then", why: "t" }] }), []);
  var stale = cg.staleCampaignExemptions(root, { sources: calls, registry: { doors: [{ file: "y.js", fn: "gone", why: "t" }], awaits: [{ file: "y.js", fn: "good", why: "t" }] } });
  assert.strictEqual(stale.length, 2, "an exemption the source no longer needs must be named: " + JSON.stringify(stale));
  void none;
});

// ── runner ──────────────────────────────────────────────────────────────────────────────────────────────────────────
var argv = process.argv.slice(2), at = argv.indexOf("--case");
if (at >= 0) {
  var one = CASES.filter(function (c) { return c.name === argv[at + 1]; })[0];
  if (!one) { process.stderr.write("no such case: " + argv[at + 1] + "\n"); process.exit(2); }
  var err = console.error, E;
  Promise.resolve().then(function () { E = boot(); return one.fn(E); }).then(function () { process.exit(0); }, function (e) { err.call(console, (e && e.stack) || String(e)); process.exit(1); });
} else {
  var only = argv.indexOf("--only") >= 0 ? argv[argv.indexOf("--only") + 1] : "", passed = 0, failed = 0;
  var run = CASES.filter(function (c) { return !only || c.name.indexOf(only) >= 0; });
  if (!run.length) { console.error("--only \"" + only + "\" matched 0 tests — NOTHING ran"); process.exit(1); }
  run.forEach(function (c) {
    var r = cp.spawnSync(process.execPath, [__filename, "--case", c.name], { cwd: path.join(__dirname, ".."), encoding: "utf8", timeout: 60000 });
    if (r.status === 0) { passed++; console.log("PASS #777 " + c.name); }
    else { failed++; console.error("FAIL #777 " + c.name + " — " + (String(r.stderr || "") + String(r.stdout || "")).trim().split(/\r?\n/).slice(0, 6).join("\n    ") + (r.error ? " [" + r.error.message + "]" : "")); }
  });
  if (failed) { console.error("#777 campaign: " + failed + " FAILED, " + passed + " passed"); process.exit(1); }
  console.log("ALL GREEN — " + passed + " #777 campaign cases");
}
