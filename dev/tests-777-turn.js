// dev/tests-777-turn.js — audit 2026-11-19 (TODO #777), batch 7: the turn's edges. U1 what a commit schedules runs once the
// turn has let go · U2 the Rest button · U3 a refusal's replacement is committed · U6/U11 where a notice goes · U8 a check
// lapses only to a story action · U12 the folder banner · U13 a null faction · V1 Car Mode's retry arm · C3 a check's
// modifier · C4 a long item name is filed under its own key.
// Each case builds a fresh world and runs the REAL engine; the DOM shells are pinned by their source.
//   node dev/tests-777-turn.js             every case
//   node dev/tests-777-turn.js --only U1   the cases whose name contains the text
// ES5 throughout, matching the engine.
var assert = require("assert"), fs = require("fs"), path = require("path");
var LE = require("./load-engine.js");
var realLog = console.log, realErr = console.error;
var said = { warns: [], toasts: [], errors: [], msgs: [] };
console.warn = function () { said.warns.push([].join.call(arguments, " ")); };
console.info = function () {}; console.log = function () {}; console.debug = function () {};
LE.loadEngine();
console.error = function () { said.errors.push([].join.call(arguments, " ")); };
var ROOT = path.join(__dirname, "..");
function el() { return { style: {}, className: "", innerHTML: "", textContent: "", value: "", disabled: false, children: [], parentNode: null, appendChild: function (c) { c.parentNode = this; this.children.push(c); return c; }, removeChild: function () {}, remove: function () {}, addEventListener: function () {}, setAttribute: function () {}, getAttribute: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, focus: function () {}, insertAdjacentHTML: function () {} }; }
global.document = { getElementById: function () { return el(); }, querySelector: function () { return null; }, querySelectorAll: function () { return []; }, createElement: function () { return el(); }, body: el(), addEventListener: function () {}, hidden: false };
addMsg = function (type, html) { said.msgs.push(type + ": " + String(html)); return el(); };
showToast = function (m) { said.toasts.push(String(m)); };
syncUI = function () {}; updateAbPanel = function () {}; updateSpPanel = function () {}; reportError = function () {};
saveAll = function () { return true; }; saveCore = function () { return true; }; saveMem = function () { return true; }; saveLocal = function () { return true; };
speakNarration = function () {}; generateActions = function () {}; narrateWithSpeakers = function () {}; processPendingCompanionSheets = function () {};
if (typeof storageAdapter === "undefined") storageAdapter = { syncToServer: function () {}, syncNow: function () {} };
var REAL = { sendAction: sendAction, restSpells: restSpells, callGM: (typeof callGM === "function") ? callGM : null, maxMs: AFTER_TURN_MAX_MS };
function src(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }
function fresh(o) {
  var ws = LE.makeTestWorld(o || {}); migrateWorldState(ws); worldState = ws; busy = false;
  sendAction = REAL.sendAction; restSpells = REAL.restSpells; AFTER_TURN_MAX_MS = REAL.maxMs;
  said.warns.length = 0; said.toasts.length = 0; said.errors.length = 0; said.msgs.length = 0;
  return ws;
}
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
var CASES = [];
function kase(name, fn) { CASES.push({ name: name, fn: fn }); }

// ── U1 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
kase("U1: Death's arrival waits for the turn that is still running, then is sent once", function () {
  fresh(); var sent = [];
  sendAction = function (t, o) { sent.push({ t: t, o: o, busy: busy }); };
  busy = true;                                                 // the commit that kills the hero is inside a turn
  deathSceneBegin("slain");
  return wait(120).then(function () {
    assert.deepStrictEqual(sent, [], "the arrival was sent into a running turn (where it is dropped)");
    busy = false;
    return wait(200);
  }).then(function () {
    assert.strictEqual(sent.length, 1, "Death never arrived after the turn let go: " + sent.length);
    assert.strictEqual(sent[0].t, deathArrivalDirective()); assert.ok(sent[0].o && sent[0].o.silent && sent[0].o.deathArrival); assert.strictEqual(sent[0].busy, false);
    assert.strictEqual(worldState.deathScene.arrivalOwed, true, "the arrival is not owed on the save until it commits");
    return wait(150);
  }).then(function () {
    assert.strictEqual(sent.length, 1, "the arrival was sent twice");
    // a reload before the arrival committed: the load re-arms it; once it is in the book it is owed no more
    sent.length = 0; deathArrivalRearm();
    return wait(200);
  }).then(function () {
    assert.strictEqual(sent.length, 1, "an arrival still owed at load was not sent");
    delete worldState.deathScene.arrivalOwed; sent.length = 0; deathArrivalRearm();
    return wait(200);
  }).then(function () {
    assert.deepStrictEqual(sent, [], "an arrival already in the book was sent again at load");
    // two steps armed for ONE arrival (the commit's and a load's): the first puts it in the book, the second finds nothing owed
    worldState.deathScene.arrivalOwed = true; sent.length = 0;
    sendAction = function (t, o) { sent.push(t); delete worldState.deathScene.arrivalOwed; };
    deathArrivalRearm(); deathArrivalRearm();
    return wait(200);
  }).then(function () {
    assert.strictEqual(sent.length, 1, "one arrival owed was sent " + sent.length + " times");
    deathArrivalRearm();
    assert.strictEqual(turnSettleOwed(), false, "a load with nothing owed holds the player's send back");
    assert.ok(/if\(typeof deathArrivalRearm==="function"\)deathArrivalRearm\(\);/.test(src("ui-boot.js")), "the load does not re-arm an owed arrival");
    assert.ok(/if\(opts&&opts\.deathArrival&&worldState\.deathScene\)delete worldState\.deathScene\.arrivalOwed;/.test(src("game.js")), "the arrival's commit does not settle the debt");
  });
});
kase("U1: while a step is owed the player's own send waits, and the give-up is counted in polls run, not in wall-clock time", function () {
  fresh(); var ran = 0, realNow = Date.now;
  busy = true; whenTurnSettles("a test step", function () { ran++; });
  assert.strictEqual(turnSettleOwed(), true, "nothing says a step is owed");
  Date.now = function () { return realNow() + 6 * 60 * 1000; };              // the phone slept: six minutes "passed" in one poll
  return wait(AFTER_TURN_POLL_MS * 2 + 60).then(function () {                 // polls run while the turn still holds, under the jumped clock
    assert.strictEqual(turnSettleOwed(), true, "the step was given up on a clock jump, not on polls run");
    busy = false;
    return wait(AFTER_TURN_POLL_MS * 2 + 60);
  }).then(function () {
    Date.now = realNow;
    assert.strictEqual(ran, 1, "a step about to run was dropped because the clock had jumped");
    assert.strictEqual(turnSettleOwed(), false, "the debt outlived its step");
    var g = src("game.js"), at = g.indexOf("async function sendAction("), head = g.slice(at, at + 1200);
    assert.ok(/if\(!\(opts&&opts\.silent\)&&typeof turnSettleOwed==="function"&&turnSettleOwed\(\)\)\{/.test(head), "a line sent before the owed step ran is not held back");
  }, function (e) { Date.now = realNow; throw e; });
});
kase("U1: what a commit schedules is dropped out loud when another campaign is opened first, and said when the turn never lets go", function () {
  fresh(); var ran = 0;
  busy = true; whenTurnSettles("a test step", function () { ran++; });
  campaignEpochBump(); busy = false;
  return wait(200).then(function () {
    assert.strictEqual(ran, 0, "a step scheduled in one campaign ran in another");
    fresh(); AFTER_TURN_MAX_MS = 150; busy = true; said.errors.length = 0; said.toasts.length = 0;
    whenTurnSettles("the ending", function () { ran++; });
    return wait(500);
  }).then(function () {
    assert.strictEqual(ran, 0);
    assert.ok(said.errors.some(function (e) { return /the ending/.test(e) && /never/.test(e); }), "a step that never ran was dropped in silence: " + JSON.stringify(said.errors));
    assert.ok(said.toasts.some(function (t) { return /the ending/.test(t); }), "the player was told nothing");
    busy = false;
    var g = src("game.js");
    assert.ok(g.indexOf("setTimeout(campaignDenouement,0)") < 0, "the denouement is still scheduled by a bare timer (dropped while a post-turn request runs)");
    assert.ok(g.indexOf("setTimeout(function(){sendAction(deathArrivalDirective()") < 0, "Death's arrival is still scheduled by a bare timer");
    assert.strictEqual((g.match(/whenTurnSettles\("the campaign's ending",campaignDenouement\)/g) || []).length, 4, "not every denouement site waits for the turn");
  });
});

// ── U2 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
kase("U2: the Rest button does nothing while a turn is in flight, and says so; the reply's own rest is untouched", function () {
  fresh(); var rests = 0; restSpells = function () { rests++; return 0; };
  busy = true; restFromButton();
  assert.strictEqual(rests, 0, "the button rested the party in the middle of a turn");
  assert.ok(said.toasts.some(function (t) { return /turn/i.test(t); }), "the button said nothing");
  busy = false; restFromButton();
  assert.strictEqual(rests, 1, "the button no longer rests");
  assert.ok(/onclick='restFromButton\(\)'/.test(src("ui-panels.js")) && src("ui-panels.js").indexOf("onclick='restSpells()'") < 0, "the panel's button calls the rest directly");
});

// ── U6, U11 ────────────────────────────────────────────────────────────────────────────────────────────────────────
kase("U6, U11: a notice raised under an open modal pops up; in Car Mode a notice fades by itself", function () {
  assert.strictEqual(toastLifeMs(undefined, false), 0, "an ordinary notice no longer stays until tapped");
  assert.strictEqual(toastLifeMs(6000, false), 6000); assert.strictEqual(toastLifeMs(6000, true), 6000);
  assert.strictEqual(toastLifeMs(undefined, true), CAR_TOAST_MS, "a Car Mode notice stays on the car screen until tapped");
  assert.strictEqual(toastLifeMs(0, true), CAR_TOAST_MS); assert.strictEqual(CAR_TOAST_MS, 8000);
  var sh = src("ui-shell.js"), at = sh.indexOf("function consoleDoorOpen()"), body = sh.slice(at, sh.indexOf("\n}", at));
  assert.ok(/if\(typeof modalTopOpen==="function"&&modalTopOpen\(\)&&!document\.getElementById\("console-modal"\)\)return false;/.test(body), "U6: the console's door reads as open under a modal — the modal's own refusal is only collected (the Console itself is the one modal a line lands in)");
  var n0 = consoleNewCount(), e = consolePush("Saved", "notice", true, true);
  assert.strictEqual(e.popped, true, "the record says a popped line did not pop");
  assert.strictEqual(consoleNewCount(), n0 + 1, "U11: a notice that faded unread is not counted as new in the Console");
  consolePush("Saved", "notice", true); assert.strictEqual(consoleNewCount(), n0 + 1, "an ordinary popped line counts as new");
  assert.ok(/var _carFades=_pops&&typeof carMode!=="undefined"&&!!carMode;/.test(sh) && /consolePush\(msg,_kind,_pops,_carFades\);/.test(sh) && /if\(_carFades\)consoleDotPaint\(\);/.test(sh), "U11: a Car Mode notice is not handed to the Console as unread");
  assert.ok(/var _life=toastLifeMs\(ms,typeof carMode!=="undefined"&&carMode\);/.test(sh) && /if\(_life>0\)setTimeout\(dismiss,_life\);/.test(sh), "U11: the toast does not take its life from toastLifeMs");
});

// ── U8, U12, V1 ────────────────────────────────────────────────────────────────────────────────────────────────────
kase("U8, U12, V1: a check lapses only to a story action; the folder banner is one; a committed turn arms no Car Mode retry", function () {
  var g = src("game.js"), at = g.indexOf("async function sendAction("), body = g.slice(at, g.indexOf("\nfunction ", at + 10));
  var lapse = body.indexOf("checkLapseToAction(txt)"), read = body.indexOf("var txt=override!==null?override:inp.value.trim();if(!txt)return;"), tt = body.indexOf("var isTT=");
  assert.ok(lapse > 0 && read > 0 && tt > 0, "fixture: sendAction's lines were not found");
  assert.ok(lapse > read && lapse > tt, "U8: the check lapses before the action is read (an empty Send or a Table Talk question loses the roll)");
  assert.ok(/if\(!isTT&&worldState\.pendingCheck&&!\(opts&&opts\.silent\)\)checkLapseToAction\(txt\);/.test(body), "U8: a Table Talk question lapses the check");
  assert.ok(/carNotify\("say","The opening could not be shown\. Reload to continue\."\)/.test(g), "V1: a committed opening arms tap-to-retry, or says nothing aloud");
  assert.ok(/carNotify\("say","The turn was applied, but it could not be shown\."\)/.test(g), "V1: a turn that committed arms tap-to-retry in the car — the tap sends the action again");
  assert.ok(/carNotify\(isTT\?"warn":"error",isTT\?"Question failed":"Turn failed — tap to retry"\)/.test(g), "V1: a failed Table Talk question arms a retry of the last STORY action");
  var b0 = g.indexOf("function _promptCampaignFolder()"), bb = g.slice(b0, g.indexOf("\n}", b0));
  assert.ok(/if\(document\.getElementById\("folder-banner"\)\)return;/.test(bb) && /banner\.id="folder-banner";/.test(bb), "U12: the folder banner can be added twice");
});

// ── U13 ────────────────────────────────────────────────────────────────────────────────────────────────────────────
kase("U13: the World State panel survives a null faction entry", function () {
  fresh(); var rows;
  assert.doesNotThrow(function () { rows = worldStateNpcRows([{ name: "Bram", status: "calm", rel: "ally", met: 1 }], { Bram: {} }, { Bram: [null, { faction: "The Watch", role: "sergeant" }, "junk"] }); });
  assert.strictEqual(rows[0].faction, "The Watch [sergeant]");
});

// ── C3 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
kase("C3: a check's modifier is the field's leading signed number — text in the field is never glued into one", function () {
  var c = parseCheckTag("Attack|+5 vs DC 15");
  assert.strictEqual(c.mod, 5, "the digits were glued: " + c.mod); assert.strictEqual(c.dc, 15);
  c = parseCheckTag("Stealth|DC 14");
  assert.strictEqual(c.mod, 0, "a DC in the modifier's place became the modifier: " + c.mod); assert.strictEqual(c.dc, 14);
  assert.strictEqual(parseCheckTag("Climb|+3|DC 12").mod, 3); assert.strictEqual(parseCheckTag("Climb|-2|DC 12").mod, -2); assert.strictEqual(parseCheckTag("Climb|4|DC 12").mod, 4);
  assert.strictEqual(parseCheckTag("Climb|+ 3|DC 12").mod, 3);
  assert.strictEqual(parseCheckTag("Climb|strength|DC 12").mod, 0);
  assert.strictEqual(parseCheckTag("Athletics|\u22122|DC 15").mod, -2, "the engine's own minus sign is not read");
  [["STR +3", 3], ["Athletics +3", 3], ["(+3)", 3], ["modifier: +3", 3], ["mod -1", -1], ["d20+5", 5], ["1d20+5", 5], ["d20", 0]].forEach(function (c) { assert.strictEqual(parseCheckTag("Climb|" + c[0] + "|DC 12").mod, c[1], JSON.stringify(c[0]) + " reads as " + parseCheckTag("Climb|" + c[0] + "|DC 12").mod); });
  assert.strictEqual(parseCheckTag("Climb|+515|DC 12").mod, CHECK_MOD_MAX, "an absurd modifier is not clamped");
  assert.strictEqual(parseCheckTag("Climb|-999|DC 12").mod, -CHECK_MOD_MAX);
  var d = parseCheckTag("Draconic Breath|2d6");
  assert.ok(d.dmgOnly && d.mod === 0, "a damage-only roll changed: " + JSON.stringify(d));
  assert.strictEqual(parseCheckTag("Longsword attack|+5|DC 14|1d8+3").mod, 5);
});

// ── C4 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
kase("C4: an item with a very long name is filed under its own key — asked once, announced once", function () {
  fresh(); var long = "Ceremonial Greatsword of the " + new Array(14).join("Seven-Times-Forsworn ") + "Line";
  assert.ok(long.length > ITEM_KIND_NAME_MAX, "fixture: the name is not long enough");
  worldState.character.inventory = [{ name: long, qty: 1 }];
  var calls = 0; callGM = function () { calls++; return Promise.resolve(JSON.stringify({ kinds: [INVENTORY_CATEGORY_REGISTRY[0].id] })); };
  return itemKindsSettle().then(function (filed) {
    assert.strictEqual(calls, 1);
    assert.ok(filed && filed.length === 1 && filed[0].key === itemBaseName(long), "the answer was filed under another key: " + JSON.stringify(filed && filed[0] && filed[0].key).slice(0, 90));
    assert.deepStrictEqual(itemKindsOwed(worldState), [], "the item is still owed — it would be asked, and billed, every turn");
    said.toasts.length = 0;
    return itemKindsSettle();
  }).then(function () {
    assert.strictEqual(calls, 1, "the item was asked again");
    assert.deepStrictEqual(said.toasts, [], "the item was announced as sorted again");
    fresh(); worldState.character.inventory = [{ name: "Hide armor", qty: 1 }];
    worldState.itemKinds = { "hide armor": { kind: INVENTORY_CATEGORY_REGISTRY[0].id, turn: 1 } };
    assert.strictEqual(itemKindsSaidFiled([]), "", "nothing filed is announced as something");
    fresh(); worldState.character.inventory = [{ name: "Hide armor", qty: 1 }, { name: "Odd brass thing", qty: 1 }];
    callGM = function () { worldState.itemKinds = { "odd brass thing": { kind: ITEM_KIND_UNCLEAR, turn: 1 } };   // settled elsewhere while this request was out
      return Promise.resolve(JSON.stringify({ kinds: [INVENTORY_CATEGORY_REGISTRY[0].id, INVENTORY_CATEGORY_REGISTRY[0].id] })); };
    said.toasts.length = 0;
    return itemKindsSettle();
  }).then(function () {
    assert.ok(said.toasts.length === 1 && /Hide armor/.test(said.toasts[0]) && !/Odd brass thing/.test(said.toasts[0]), "the line announced what was asked, not what was filed: " + JSON.stringify(said.toasts));
  });
});

// ── runner ─────────────────────────────────────────────────────────────────────────────────────────────────────────
var argv = process.argv.slice(2), only = argv.indexOf("--only") >= 0 ? argv[argv.indexOf("--only") + 1] : "", passed = 0, failed = 0;
var todo = CASES.filter(function (c) { return !only || c.name.indexOf(only) >= 0; });
if (!todo.length) { realErr.call(console, "--only \"" + only + "\" matched 0 tests — NOTHING ran"); process.exit(1); }
function next(i) {
  if (i >= todo.length) {
    if (failed) { realErr.call(console, "#777 turn: " + failed + " FAILED, " + passed + " passed"); process.exit(1); }
    realLog.call(console, "ALL GREEN — " + passed + " #777 turn cases"); process.exit(0);
  }
  var c = todo[i];
  function ok() { passed++; realLog.call(console, "PASS #777 " + c.name); if (REAL.callGM) callGM = REAL.callGM; next(i + 1); }
  function bad(e) { failed++; realErr.call(console, "FAIL #777 " + c.name + " — " + String((e && e.stack) || e).split("\n").slice(0, 4).join("\n    ")); if (REAL.callGM) callGM = REAL.callGM; busy = false; next(i + 1); }
  try { var r = c.fn(); if (r && typeof r.then === "function") r.then(ok, bad); else ok(); } catch (e) { bad(e); }
}
next(0);
