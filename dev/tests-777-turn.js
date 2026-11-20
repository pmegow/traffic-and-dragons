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
var realGenerateActions = generateActions;
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

// ── U3 (designed build) ────────────────────────────────────────────────────────────────────────────────────────────
var REFUSED = "I cannot continue generating content for this scene.";
function u3World() {
  fresh(); var ws = worldState; ws.turn = 9; ws.character.coin = 1000; ws.transcript = []; sessionLog = []; activeChatTab = "story";
  if (typeof lastActions !== "undefined") lastActions = null;
  return ws;
}
function gmSays(list, seen) { var i = 0; callGM = function (msg) { if (seen) seen.push({ msg: String(msg), log: JSON.stringify(sessionLog) }); var r = list[Math.min(i, list.length - 1)]; i++; return typeof r === "function" ? r() : Promise.resolve(r); }; }
function refuseATurn(text, opts) {
  assert.strictEqual(detectModelRefusal(REFUSED), true, "fixture: the refusal text is not read as a refusal");
  gmSays([REFUSED]);
  return sendAction(text, opts).then(function () {
    var tr = worldState.transcript, last = tr[tr.length - 1];
    assert.ok(last && last.r === "gm" && last.rf === 1, "fixture: the turn was not committed as a refusal: " + JSON.stringify(tr));
    assert.strictEqual(worldState.turn, 10, "fixture: the refused turn was not counted");
    assert.strictEqual(worldState.character.coin, 1000);
  });
}
kase("U3: re-rolling a refused turn sends the action again — tags applied once, the turn not counted again, the refusal replaced in the book", function () {
  u3World(); var seen = [];
  return refuseATurn("I open the door.").then(function () {
    assert.ok(worldState.unappliedRefusal && worldState.unappliedRefusal.turn === 10 && worldState.unappliedRefusal.txt === "I open the door.", "nothing on the save says this turn's tags were never applied: " + JSON.stringify(worldState.unappliedRefusal));
    assert.strictEqual(worldState.transcript.length, 2);
    said.msgs.length = 0;
    gmSays(["The door swings wide and a purse lies on the sill. [GOLD:+3]"], seen);
    REAL.notes = buildEngineNotes; buildEngineNotes = function () { return "[ENGINE NOTE — built for this request]"; };
    return rerollLast();
  }).then(function () {
    buildEngineNotes = REAL.notes;
    var asked = seen.filter(function (c) { return c.msg.indexOf("I open the door.") >= 0; });   /* the turn's own request; the settle steps after a commit make their small requests too */
    assert.strictEqual(asked.length, 1, "the replacement was not asked for once: " + JSON.stringify(seen.map(function (c) { return c.msg.slice(0, 60); })));
    assert.ok(seen.length > asked.length, "the steps that follow an ordinary commit did not run for the replacement (a re-roll's prose-only path was taken): " + seen.length);
    seen = asked;
    assert.ok(seen[0].log.indexOf("cannot continue") < 0, "the model was shown its own refusal as history");
    assert.ok(seen[0].msg.indexOf("I open the door.") >= 0, "the player's action was not sent again");
    assert.ok(seen[0].msg.indexOf("[ENGINE NOTE — built for this request]") === 0, "the replacement went out without freshly built engine notes: " + seen[0].msg.slice(0, 80));
    assert.ok(!/PROSE REROLL|prose only/i.test(seen[0].msg), "the replacement was asked for prose only (the note of a real re-roll)");
    assert.strictEqual(worldState.character.coin, 1300, "the replacement's tags were never applied: " + worldState.character.coin);
    assert.strictEqual(worldState.turn, 10, "the turn was counted a second time: " + worldState.turn);
    var tr = worldState.transcript;
    assert.strictEqual(tr.length, 2, "the book gained or lost an entry: " + JSON.stringify(tr.map(function (e) { return [e.t, e.r, e.rf || 0]; })));
    assert.ok(tr[0].r === "player" && tr[0].x === "I open the door.", "the player's line changed");
    assert.ok(tr[1].r === "gm" && tr[1].t === 10 && !tr[1].rf && /purse lies/.test(tr[1].x) && tr[1].x.indexOf("GOLD") < 0, "the refusal is still what the book holds for this turn: " + JSON.stringify(tr[1]));
    assert.strictEqual(sessionLog.length, 2, "the session log changed length: " + sessionLog.length);
    assert.ok(/purse lies/.test(sessionLog[1].content) && sessionLog[0].content.indexOf("I open the door.") >= 0);
    assert.ok(!worldState.unappliedRefusal, "the turn is still marked as never applied");
    assert.strictEqual(said.msgs.filter(function (m) { return /^player:/.test(m); }).length, 0, "the player's line was shown a second time");
    assert.strictEqual(busy, false, "the turn was left locked");
    gmSays(["The door swings wide again. [GOLD:+3]"]);
    return rerollLast();
  }).then(function () {
    assert.strictEqual(worldState.character.coin, 1300, "re-rolling real narration applied its tags a second time");
    assert.strictEqual(worldState.turn, 10); assert.strictEqual(worldState.transcript.length, 2);
  });
});
kase("U3: a turn whose tags DID land, re-rolled into a refusal and then into narration, applies nothing twice", function () {
  u3World();
  gmSays(["A purse lies on the sill. [GOLD:+3]"]);
  return sendAction("I open the door.").then(function () {
    assert.strictEqual(worldState.character.coin, 1300, "fixture: the first turn's tags did not land");
    gmSays([REFUSED]); return rerollLast();
  }).then(function () {
    var last = worldState.transcript[worldState.transcript.length - 1];
    assert.strictEqual(last.rf, 1, "fixture: the re-roll did not turn the entry into a refusal");
    assert.ok(!worldState.unappliedRefusal, "a turn whose tags landed is marked as never applied");
    gmSays(["A heavier purse lies on the sill. [GOLD:+3]"]); return rerollLast();
  }).then(function () {
    assert.strictEqual(worldState.character.coin, 1300, "the tags of one turn were applied twice: " + worldState.character.coin);
    assert.strictEqual(worldState.turn, 10);
  });
});
kase("U3: a replacement that is refused again changes nothing and can be re-rolled again; a failed request puts the refusal back", function () {
  u3World();
  return refuseATurn("I open the door.").then(function () {
    gmSays([REFUSED]); return rerollLast();
  }).then(function () {
    var tr = worldState.transcript;
    assert.strictEqual(worldState.turn, 10, "a refused replacement counted the turn again"); assert.strictEqual(tr.length, 2, "a refused replacement added to the book");
    assert.strictEqual(tr[1].rf, 1); assert.strictEqual(worldState.character.coin, 1000);
    assert.ok(worldState.unappliedRefusal && worldState.unappliedRefusal.turn === 10, "the turn is no longer marked as never applied");
    assert.strictEqual(sessionLog.length, 2);
    gmSays([function () { return Promise.reject(new Error("503 from the provider")); }]);
    said.msgs.length = 0; clearPendingAction();
    return rerollLast();
  }).then(function () {
    assert.strictEqual(sessionLog.length, 2, "a failed request lost the turn's exchange: " + sessionLog.length);
    assert.ok(sessionLog[1].content.indexOf("cannot continue") >= 0, "the refusal was not put back");
    assert.strictEqual(worldState.transcript.length, 2); assert.strictEqual(worldState.transcript[1].rf, 1);
    assert.ok(worldState.unappliedRefusal && worldState.unappliedRefusal.turn === 10, "a failed request spent the mark");
    assert.ok(said.msgs.some(function (m) { return /503 from the provider/.test(m); }), "the failure was not said: " + JSON.stringify(said.msgs));
    assert.ok(!store.get(PENDING_ACT_K), "a failed replacement left the action queued to be sent as a NEW turn after a reload");
    assert.strictEqual(busy, false);
    gmSays(["The door swings wide. [GOLD:+3]"]); return rerollLast();
  }).then(function () {
    assert.strictEqual(worldState.character.coin, 1300, "after a refusal and a failure the replacement's tags did not land once: " + worldState.character.coin);
    assert.strictEqual(worldState.turn, 10); assert.strictEqual(worldState.transcript.length, 2);
  });
});
kase("U3: a display failure after the replacement's tags landed spends the mark — no later re-roll applies them again", function () {
  u3World(); var realAdd = addMsg;
  return refuseATurn("I open the door.").then(function () {
    gmSays(["The door swings wide. [GOLD:+3]"]);
    addMsg = function (type, html) { if (type === "narrator") throw new Error("the story pane is gone"); return realAdd(type, html); };
    return rerollLast();
  }).then(function () {
    addMsg = realAdd;
    assert.strictEqual(worldState.character.coin, 1300, "fixture: the tags did not land before the display failed");
    assert.ok(!worldState.unappliedRefusal, "the turn is still marked as never applied after its tags landed");
    assert.strictEqual(sessionLog.length, 2, "after a display failure the session log holds " + sessionLog.length + " lines");
    assert.ok(/swings wide/.test(sessionLog[1].content), "the refusal was put back over an exchange that was already logged");
    gmSays(["The door swings wide once more. [GOLD:+3]"]); return rerollLast();
  }).then(function () {
    assert.strictEqual(worldState.character.coin, 1300, "a re-roll after a display failure applied the tags a second time");
  }, function (e) { addMsg = realAdd; throw e; });
});
kase("U3: the mark belongs to its turn — a later turn, an engine continuation and a death scene are re-rolled as prose", function () {
  u3World();
  return refuseATurn("I open the door.").then(function () {
    gmSays(["You step through. [GOLD:+1]"]); return sendAction("I walk on.");
  }).then(function () {
    assert.strictEqual(worldState.turn, 11); assert.strictEqual(worldState.character.coin, 1100);
    assert.ok(!worldState.unappliedRefusal, "a later turn left the old mark on the save");
    gmSays(["You step through again. [GOLD:+1]"]); return rerollLast();
  }).then(function () {
    assert.strictEqual(worldState.character.coin, 1100, "a real turn's re-roll applied tags"); assert.strictEqual(worldState.turn, 11);
    // an engine continuation that is refused is sent again as the continuation it was: no player line
    u3World(); return refuseATurn("[ENGINE NOTE — continue the scene]", { silent: true });
  }).then(function () {
    assert.ok(worldState.unappliedRefusal && worldState.unappliedRefusal.silent === true, "a refused continuation is not marked as one");
    assert.strictEqual(worldState.transcript.filter(function (e) { return e.r === "player"; }).length, 0);
    var seen = []; u3World.seen = seen; gmSays(["The scene goes on. [GOLD:+2]"], seen);
    REAL.notes = buildEngineNotes; buildEngineNotes = function () { return "[ENGINE NOTE — for the player's own turns]"; };
    return rerollLast();
  }).then(function () {
    buildEngineNotes = REAL.notes;
    assert.strictEqual(u3World.seen[0].msg, "[ENGINE NOTE — continue the scene]", "a refused continuation was sent again as the player's own words (notes built for it): " + u3World.seen[0].msg.slice(0, 90));
    assert.strictEqual(worldState.character.coin, 1200, "a refused continuation's replacement applied no tags");
    assert.strictEqual(worldState.transcript.filter(function (e) { return e.r === "player"; }).length, 0, "the engine's note was logged as the player's line");
    assert.strictEqual(worldState.turn, 10);
    // a mark that is not this turn's, or whose turn the book no longer shows as refused, sends nothing again
    u3World(); gmSays(["A purse lies on the sill. [GOLD:+3]"]); return sendAction("I open the door.");
  }).then(function () {
    worldState.unappliedRefusal = { turn: 10, txt: "I open the door." };
    gmSays(["A purse lies there yet. [GOLD:+3]"]); return rerollLast();
  }).then(function () {
    assert.strictEqual(worldState.character.coin, 1300, "a turn the book holds as narration was sent again on the mark's word alone");
    // …and with the book showing a refusal for this turn (a landed turn re-rolled into one), a mark of ANOTHER turn is not this turn's
    delete worldState.unappliedRefusal; gmSays([REFUSED]); return rerollLast();
  }).then(function () {
    assert.strictEqual(worldState.transcript[worldState.transcript.length - 1].rf, 1, "fixture: the landed turn was not re-rolled into a refusal");
    worldState.unappliedRefusal = { turn: 9, txt: "I open the door." };
    gmSays(["A purse lies there still. [GOLD:+3]"]); return rerollLast();
  }).then(function () {
    assert.strictEqual(worldState.character.coin, 1300, "a mark left by another turn sent the action again over a turn whose tags had landed: " + worldState.character.coin);
    // inside a death scene the old prose-only re-roll stands (Death's lines carry no tags, and the scene's stage has moved on)
    u3World(); return refuseATurn("I open the door.");
  }).then(function () {
    worldState.deathScene = { stage: "ask", walk: 1 };
    gmSays(["Death waits. [GOLD:+3]"]); return rerollLast();
  }).then(function () {
    assert.strictEqual(worldState.character.coin, 1000, "a death scene's re-roll applied tags");
    assert.strictEqual(worldState.transcript.length, 2);
  });
});

kase("U3 door: after a refused turn the story offers ONE engine button, and choosing it re-rolls the turn — it is never sent as an action", function () {
  u3World(); var html = "", seen = [];
  return refuseATurn("I open the door.").then(function () {
    gmSays(["should never be asked for suggestions"], seen);
    return realGenerateActions({ insertAdjacentHTML: function (where, h) { html += h; }, appendChild: function () {} });
  }).then(function () {
    assert.deepStrictEqual(seen, [], "the model was asked to suggest actions over a refusal's text");
    assert.deepStrictEqual(worldState.lastActions, [REFUSAL_AGAIN], "the one button is not what the save holds for a reload: " + JSON.stringify(worldState.lastActions));
    assert.ok(html.indexOf("Ask the GM again") >= 0 && html.split("<button").length === 2, "the story does not offer exactly the one button: " + html);
    var clicked = toFirstPerson(punctuateAction(REFUSAL_AGAIN));
    [clicked, "Ask the GM again", "ask the gm again!", "I ask the GM again.", "  Ask the GM again.  "].forEach(function (t) { assert.strictEqual(refusalAgainChosen(t), true, JSON.stringify(t) + " is not read as the choice"); });
    ["Ask the GM again about the door", "I ask the innkeeper again", "Ask again", "", null].forEach(function (t) { assert.strictEqual(refusalAgainChosen(t), false, JSON.stringify(t) + " is read as the choice"); });
    gmSays(["The door swings wide. [GOLD:+3]"], seen);
    return sendAction(clicked);
  }).then(function () {
    var own = seen.filter(function (c) { return c.msg.indexOf("I open the door.") >= 0; });
    assert.strictEqual(own.length, 1, "choosing the button did not send the refused action again: " + JSON.stringify(seen.map(function (c) { return c.msg.slice(0, 50); })));
    assert.ok(!seen.some(function (c) { return /ask the gm again/i.test(c.msg); }), "the button's own words were sent to the model as an action");
    assert.strictEqual(worldState.character.coin, 1300); assert.strictEqual(worldState.turn, 10); assert.strictEqual(worldState.transcript.length, 2);
    assert.ok(!worldState.transcript.some(function (e) { return /ask the gm again/i.test(e.x); }), "the button's words are in the book as the player's line");
    // with no refusal waiting the same words are an ordinary action
    seen.length = 0; gmSays(["The GM considers. [GOLD:+1]"], seen);
    return sendAction("Ask the GM again");
  }).then(function () {
    assert.ok(seen.some(function (c) { return /Ask the GM again/.test(c.msg); }), "with no refusal waiting, the words were swallowed as a re-roll");
    assert.strictEqual(worldState.turn, 11); assert.strictEqual(worldState.character.coin, 1400);
    // a turn whose tags landed offers ordinary suggestions (the model is asked), never the button
    seen.length = 0; gmSays(["Look around | Walk on | Wait"], seen);
    return realGenerateActions({ insertAdjacentHTML: function () {}, appendChild: function () {} });
  }).then(function () {
    assert.ok(JSON.stringify(worldState.lastActions || []).indexOf(REFUSAL_AGAIN) < 0, "the button is offered after a turn that was not refused");
  });
});
kase("U3 retry: a failed replacement is retried as the replacement; another action that failed is retried as itself; the log marker and the page follow", function () {
  u3World(); var removed = 0, realRemove = lastNarratorRemove, realAccept = atlasDiscoveryAccept;
  lastNarratorRemove = function () { removed++; return true; };
  function done(v) { lastNarratorRemove = realRemove; atlasDiscoveryAccept = realAccept; return v; }
  return refuseATurn("I open the door.").then(function () {
    // the refused exchange was already filed to memory (a summarize ran over it): the replacement must not land inside the filed part
    worldState.sessKept = sessionLog.length;
    gmSays([function () { return Promise.reject(new Error("503 from the provider")); }]);
    return rerollLast();
  }).then(function () {
    assert.strictEqual(removed, 0, "the refusal was taken off the page though its replacement never arrived");
    assert.strictEqual(lastAction, "I open the door.");
    gmSays(["The door swings wide. [GOLD:+3]"]);
    retryLast(); return wait(150);
  }).then(function () {
    assert.strictEqual(worldState.turn, 10, "Retry sent the failed replacement as a NEW turn: turn " + worldState.turn);
    assert.strictEqual(worldState.transcript.length, 2, "Retry left the refusal in the book beside a new exchange: " + JSON.stringify(worldState.transcript.map(function (e) { return [e.t, e.r, e.rf || 0]; })));
    assert.strictEqual(worldState.character.coin, 1300);
    assert.strictEqual(removed, 1, "the refusal was not taken off the page when its replacement was logged (" + removed + ")");
    assert.ok(typeof worldState.sessKept !== "number" || worldState.sessKept <= sessionLog.length - 2, "the replacement lies inside the part of the session log already filed to memory (marker " + worldState.sessKept + " of " + sessionLog.length + ") — it would never be extracted");
    // a commit that refuses the replacement before anything is logged leaves the refusal on the page
    u3World(); removed = 0; return refuseATurn("I open the door.");
  }).then(function () {
    atlasDiscoveryAccept = function () { throw new Error("the map request went stale"); };
    gmSays(["The door swings wide. [GOLD:+3]"]);
    return rerollLast();
  }).then(function () {
    atlasDiscoveryAccept = realAccept;
    assert.strictEqual(removed, 0, "the refusal left the page before a commit that then refused the replacement");
    assert.strictEqual(sessionLog.length, 2); assert.ok(sessionLog[1].content.indexOf("cannot continue") >= 0);
    assert.ok(worldState.unappliedRefusal && worldState.character.coin === 1000);
    // the player rephrases instead and THAT request fails: Retry sends the new action, as a new turn — never the old one again
    gmSays([function () { return Promise.reject(new Error("503 again")); }]);
    return sendAction("I knock instead.");
  }).then(function () {
    var seen = []; gmSays(["A voice answers. [GOLD:+1]"], seen);
    retryLast(); return wait(150).then(function () { return seen; });
  }).then(function (seen) {
    assert.ok(seen.some(function (c) { return c.msg.indexOf("I knock instead.") >= 0; }) && !seen.some(function (c) { return c.msg.indexOf("I open the door.") >= 0; }), "Retry re-rolled the refused turn instead of sending the action that failed: " + JSON.stringify(seen.map(function (c) { return c.msg.slice(0, 40); })));
    assert.strictEqual(worldState.turn, 11);
    return done();
  }, function (e) { done(); throw e; });
});

kase("U3: in the book only this turn's refused entry is ever replaced, and a retcon in the replacement corrects the scene before it", function () {
  u3World(); var ws = worldState; ws.turn = 10;
  function book(last) { ws.transcript = [{ t: 9, r: "gm", x: "The vault stands open." }, { t: 9, r: "player", x: "I look inside." }].concat(last ? [last] : []); said.warns.length = 0; }
  [null, { t: 10, r: "gm", x: "Real narration." }, { t: 8, r: "gm", x: "An old refusal.", rf: 1 }, { t: 10, r: "player", x: "A line.", rf: 1 }].forEach(function (last) {
    book(last); var n = ws.transcript.length;
    logTranscript("gm", "The replacement.", "The replacement.", 0, { replaceRefusal: true });
    assert.strictEqual(ws.transcript.length, n + 1, "an entry that is not this turn's refusal was overwritten: " + JSON.stringify(last));
    assert.ok(said.warns.some(function (w) { return /no refused entry/.test(w); }), "an appended replacement was not said");
  });
  book({ t: 10, r: "gm", x: "I cannot continue.", rf: 1, e: ["stale"], m: "old-model", den: 1 });
  var entry = ws.transcript[2];
  logTranscript("gm", "The vault was shut all along.", "[RETCON:the vault was never opened] The vault was shut all along.", 5, { replaceRefusal: true });
  assert.strictEqual(ws.transcript.length, 3); assert.strictEqual(ws.transcript[2], entry, "the entry was swapped for another object (the memo and the speaker stamp hold the old one)");
  assert.ok(entry.x === "The vault was shut all along." && !entry.rf && entry.t === 10 && entry.ta === 5 && JSON.stringify(entry.e) !== '["stale"]' && entry.m !== "old-model" && !("den" in entry), "the refused entry's fields outlived it: " + JSON.stringify(entry));
  assert.strictEqual(ws.transcript[0].rc, 1, "the retcon marked the refusal it replaced, not the scene before it");
  // a replacement with tags and no narration puts nothing in the book — and that is said
  book({ t: 10, r: "gm", x: "I cannot continue.", rf: 1 }); said.warns.length = 0;
  logTranscript("gm", "", "[GOLD:+1]", 0, { replaceRefusal: true });
  assert.ok(ws.transcript.length === 3 && ws.transcript[2].rf === 1, "an empty replacement changed the book");
  assert.ok(said.warns.some(function (w) { return /no narration to put in the book/.test(w); }), "a refusal left as the record of a turn whose tags landed was not said");
  assert.strictEqual(entry.rc, 1);
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

// ── batch 2 (2026-11-20): U7 a failed roll survives a reload · U9 a commit that throws leaves no half-turn · U10 the sheet's
//    Define and Sync say why they wait ──────────────────────────────────────────────────────────────────────────────
kase("U7: a roll whose send fails is kept across a reload — offered again as the roll it was, never put in the box as an action", function () {
  u3World(); var ws = worldState, rec, sent = [];
  ws.pendingCheck = { label: "Climb the wall", mod: 2, dc: 12 };
  gmSays([function () { return Promise.reject(new Error("offline")); }]);
  clearPendingAction();
  rollPendingCheck();
  return wait(80).then(function () {
    assert.strictEqual(ws.pendingCheck, undefined, "fixture: the check was not rolled");
    assert.strictEqual(busy, false, "fixture: the failed send never let go");
    rec = restorePendingRoll();
    assert.ok(rec && rec.txt && rec.rollTag, "a roll whose send failed is not kept anywhere a reload can find it: " + JSON.stringify(rec) + " / " + store.get(PENDING_ACT_K));
    assert.ok(/\[DICE:/.test(rec.rollTag), "the kept roll has no dice record: " + rec.rollTag);
    assert.strictEqual(restorePendingAction(), null, "the roll's engine note would be put back into the story box as the player's own action");
    var id = ws.campId; ws.campId = "another-campaign";
    assert.strictEqual(restorePendingRoll(), null, "another campaign is offered this campaign's roll"); ws.campId = id;
    ws.turn++; assert.strictEqual(restorePendingRoll(), null, "a roll is offered again after the story moved on a turn"); ws.turn--;
    ws.pendingCheck = { label: "x", mod: 0, dc: 10 }; assert.strictEqual(restorePendingRoll(), null, "a roll is offered while a newer check waits"); delete ws.pendingCheck;
    // the reload: the page offers it
    said.msgs.length = 0; said.toasts.length = 0;
    sendAction = function (t, o) { sent.push({ t: t, o: o }); };
    assert.strictEqual(pendingRollOffer(), true, "the load does not offer the roll");
    assert.ok(said.msgs.some(function (m) { return /^system: /.test(m) && /roll/i.test(m) && /pendingRollSend\(/.test(m); }), "nothing on the page offers to send the roll: " + JSON.stringify(said.msgs));
    busy = true; pendingRollSend(); busy = false;
    assert.deepStrictEqual(sent, [], "the roll was sent into a running turn");
    assert.ok(said.toasts.some(function (t) { return /turn/i.test(t); }), "nothing said why the roll waits");
    pendingRollSend();
    assert.strictEqual(sent.length, 1, "the offered roll was not sent");
    assert.strictEqual(sent[0].t, rec.txt); assert.ok(sent[0].o && sent[0].o.silent === true && sent[0].o.rollTag === rec.rollTag && sent[0].o.mpBypass === true, "the roll was not sent as the silent continuation it was: " + JSON.stringify(sent[0].o));
    // delivered: nothing is owed any more
    sendAction = REAL.sendAction; gmSays(["You haul yourself over the wall."]);
    return sendAction(rec.txt, { mpBypass: true, silent: true, rollTag: rec.rollTag });
  }).then(function () {
    assert.strictEqual(restorePendingRoll(), null, "a delivered roll is still offered");
    assert.strictEqual(pendingRollOffer(), false);
    said.toasts.length = 0; sent.length = 0; sendAction = function (t, o) { sent.push(t); }; pendingRollSend();
    assert.deepStrictEqual(sent, [], "a roll that is no longer waiting was sent again"); assert.ok(said.toasts.length === 1, "nothing said the roll is no longer waiting");
    // an ordinary failed action still comes back as before, and a typed action that fails replaces the roll
    sendAction = REAL.sendAction; savePendingRoll("note", "[DICE:x|d20 = 4|fail]"); savePendingAction("I try the door instead");
    assert.strictEqual(restorePendingAction(), "I try the door instead"); assert.strictEqual(restorePendingRoll(), null);
    clearPendingAction();
    var boot = src("ui-boot.js"), at = boot.indexOf("restorePendingAction()");
    assert.ok(at >= 0 && boot.indexOf("pendingRollOffer()", at) > at && boot.indexOf("pendingRollOffer()", at) - at < 900, "the load never offers a kept roll (ui-boot.js does not call pendingRollOffer beside the pending action)");
  });
});
kase("U9: a commit that throws before its tags land leaves no half-turn — the player's line and the turn count are put back, so Retry counts once", function () {
  u3World(); var ws = worldState, realMuts = applyMuts, mutated = 0, idx;
  if (typeof memory.nameIdx !== "number") memory.nameIdx = 0; idx = memory.nameIdx;
  applyMuts = function () { throw new Error("the tag pass threw"); };
  assert.throws(function () { commitGmTurn("The door opens. [GOLD:+3]", { playerTxt: "I open the door.", logPlayer: true, onMutated: function () { mutated++; } }); }, /the tag pass threw/);
  applyMuts = realMuts;
  assert.strictEqual(ws.turn, 9, "the turn was counted for a commit that applied nothing");
  assert.strictEqual(ws.transcript.length, 0, "the player's line is in the book for a turn that never committed: " + JSON.stringify(ws.transcript));
  assert.strictEqual(memory.nameIdx, idx, "the name window moved for a commit that applied nothing");
  assert.strictEqual(mutated, 0, "the caller was told state had landed");
  commitGmTurn("The door opens. [GOLD:+3]", { playerTxt: "I open the door.", logPlayer: true, onMutated: function () { mutated++; } });   // the Retry
  assert.strictEqual(ws.turn, 10); assert.strictEqual(mutated, 1);
  assert.deepStrictEqual(ws.transcript.map(function (e) { return e.r + "@" + e.t; }), ["player@9", "gm@10"], "the retried turn is not in the book exactly once");
  assert.strictEqual(ws.character.coin, 1300);
  // a silent commit (no player line) that throws: nothing of an earlier turn is taken out of the book
  var before = ws.transcript.length; applyMuts = function () { throw new Error("the tag pass threw"); };
  assert.throws(function () { commitGmTurn("x", { playerTxt: "note", logPlayer: false }); }, /the tag pass threw/);
  applyMuts = realMuts;
  assert.strictEqual(ws.transcript.length, before, "a commit that logged no player line took an entry out of the book"); assert.strictEqual(ws.turn, 10);
  // a throw AFTER the tags landed: nothing is undone, and the caller is told state landed (no re-applying Retry)
  var realCommit = noteLogCommit; mutated = 0;
  noteLogCommit = function () { throw new Error("the notes ring threw"); };
  assert.throws(function () { commitGmTurn("A purse. [GOLD:+2]", { playerTxt: "I look.", logPlayer: true, latchSnap: {}, onMutated: function () { mutated++; } }); }, /the notes ring threw/);
  noteLogCommit = realCommit;
  assert.strictEqual(ws.character.coin, 1500, "fixture: the second turn's tags did not land");
  assert.strictEqual(ws.turn, 11, "a turn whose tags landed was un-counted");
  assert.ok(ws.transcript.some(function (e) { return e.r === "player" && e.x === "I look."; }), "the player's line of a turn whose tags landed was taken out of the book");
  assert.strictEqual(mutated, 1, "after the tags landed the caller was not told — it would offer a Retry that applies them twice");
});
kase("U10: the sheet's Define and Sync say why they wait while a turn is in flight", function () {
  fresh(); busy = true; said.toasts.length = 0;
  var called = 0, realGM = callGM; callGM = function () { called++; return Promise.resolve("{}"); };
  return Promise.resolve(defineItemFromStory("a strange key")).then(function () {
    assert.ok(said.toasts.some(function (t) { return /Wait for the turn to finish/.test(t); }), "Define did nothing and said nothing: " + JSON.stringify(said.toasts));
    said.toasts.length = 0;
    return syncCharSheet();
  }).then(function () {
    assert.ok(said.toasts.some(function (t) { return /Wait for the turn to finish/.test(t); }), "Sync did nothing and said nothing: " + JSON.stringify(said.toasts));
    assert.strictEqual(called, 0, "a model call was made while a turn is in flight"); assert.strictEqual(busy, true);
    callGM = realGM; busy = false;
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
