// dev/tests-777-memory.js — audit 2026-11-19 (TODO #777), section M: the memory tiers. M1 distinct facts under a shared
// name are not folded · M2 an extraction that was applied is not filed again by its retry · M3 a superseded-fact needle ·
// M4 a deferred scene fact stays a scene fact · M5 a failing era compile backs off and is on the health readout · M6 map
// edges compare resolved places · M7 a companion's queued wants are deduped and bounded.
// Each case builds a fresh world and runs the REAL engine; a case name opens with its audit row.
//   node dev/tests-777-memory.js             every case
//   node dev/tests-777-memory.js --only M2   the cases whose name contains the text
// ES5 throughout, matching the engine.
var assert = require("assert"), fs = require("fs"), path = require("path");
var LE = require("./load-engine.js");
var realLog = console.log, realErr = console.error;
var said = { warns: [], toasts: [], errors: [], infos: [], msgs: [] };
console.warn = function () { said.warns.push([].join.call(arguments, " ")); };
console.info = function () { said.infos.push([].join.call(arguments, " ")); };
console.log = function () {}; console.debug = function () {};
LE.loadEngine();
console.error = function () { said.errors.push([].join.call(arguments, " ")); };
addMsg = function (role, text) { said.msgs.push(String(text)); return { appendChild: function () {}, style: {}, remove: function () {}, textContent: "", innerHTML: "", className: "" }; };
showToast = function (m) { said.toasts.push(String(m)); };
syncUI = function () {}; updateAbPanel = function () {}; updateSpPanel = function () {}; reportError = function () {};
if (typeof storageAdapter === "undefined") storageAdapter = { syncToServer: function () {}, syncNow: function () {} };
var REAL = { saveLocal: saveLocal, saveCore: saveCore, saveMem: saveMem, saveAll: saveAll, callGM: (typeof callGM === "function") ? callGM : null, retain: retainSessionTail, eraNext: eraNextSources };

function fresh(o) {
  saveLocal = function () { return true; }; saveCore = function () { return true; }; saveMem = function () { return true; }; saveAll = function () { return true; };
  retainSessionTail = REAL.retain; eraNextSources = REAL.eraNext;
  var ws = LE.makeTestWorld(o || {});
  migrateWorldState(ws); worldState = ws;
  said.warns.length = 0; said.toasts.length = 0; said.errors.length = 0; said.infos.length = 0; said.msgs.length = 0;
  return ws;
}
function npc(name, extra, mem) { var n = { name: name, status: "calm", rel: "ally", met: 1, statusTurn: 1, aliases: [] }, k; for (k in (extra || {})) n[k] = extra[k]; worldState.npcs.push(n); memory.npcs[name] = { attitude: "", knowledge: [], events: [], aliases: [] }; for (k in (mem || {})) memory.npcs[name][k] = mem[k]; return n; }
var CASES = [];
function kase(name, fn) { CASES.push({ name: name, fn: fn }); }

// ── M1: distinct facts that restate one name ───────────────────────────────────────────────────────────────────────
kase("M1: three distinct lore lines about a place with a two-word name are all kept; a rewording of one still folds", function () {
  fresh();
  fileLore("The Glass Spire hums at night."); fileLore("The Glass Spire was raised by giants."); fileLore("The Glass Spire drinks moonlight.");
  assert.strictEqual(memory.lore.length, 3, "distinct facts were folded into one: " + JSON.stringify(memory.lore));
  fileLore("The Glass Spire hums softly at night, the fishers say.");
  assert.strictEqual(memory.lore.length, 3, "a rewording of a fact on file was kept as a twin: " + JSON.stringify(memory.lore));
  assert.ok(memory.lore.some(function (l) { return /fishers say/.test(l); }), "the richer rewording did not win");
  fileLore("Smoke rises from the Glass Spire."); fileLore("Smoke rises daily from the Glass Spire.");
  assert.strictEqual(memory.lore.length, 4, "the first word of a sentence was read as a name, so a rewording was kept as a twin: " + JSON.stringify(memory.lore));
  var nt = Object.keys(feNameTokens("The spire hums. Smoke rises from the tower. At dawn, Mara left! However, Voss stayed.\nSecond line here"));
  assert.deepStrictEqual(nt.sort(), ["mara", "vos"], "the first word of a later sentence is read as a name: " + JSON.stringify(nt));
  fresh();
  fileLore("The Baron taxes the Guild."); fileLore("The Baron taxes the Guild heavily.");
  fileLore("Old Tom's Tavern serves Black Ale."); fileLore("Black Ale is served at Old Tom's Tavern.");
  assert.strictEqual(memory.lore.length, 2, "a plain restatement is kept as a twin: " + JSON.stringify(memory.lore));
});
kase("M1: two distinct facts about a person with a two-word name are both kept; a rewording of one still folds", function () {
  fresh(); npc("Mara Voss");
  fileNpcKnowledge("Mara Voss", "Mara Voss is the harbor master", 1);
  fileNpcKnowledge("Mara Voss", "Mara Voss lost her left eye in the war", 2);
  assert.strictEqual(memory.npcs["Mara Voss"].knowledge.length, 2, "one fact absorbed the other: " + JSON.stringify(memory.npcs["Mara Voss"].knowledge));
  fileNpcKnowledge("Mara Voss", "Mara Voss serves as harbor master of Ashfen these ten years", 3);
  assert.strictEqual(memory.npcs["Mara Voss"].knowledge.length, 2, "a rewording was kept as a twin: " + JSON.stringify(memory.npcs["Mara Voss"].knowledge));
  fresh(); npc("Mara Voss", null, { aliases: ["Captain Voss"] });
  fileNpcKnowledge("Mara Voss", "captain voss commands the harbor watch", 1);
  fileNpcKnowledge("Mara Voss", "captain voss owes the spire a favor", 2);
  assert.strictEqual(memory.npcs["Mara Voss"].knowledge.length, 2, "two facts that share only an alias were folded");
});
kase("M1: pending events still fold a re-minted goal that shares its name (the fingerprint itself is unchanged)", function () {
  fresh();
  assert.strictEqual(feNearDup("Find Shalelu Andosana in the woods", "Locate Shalelu Andosana near the woods"), true);
  assert.strictEqual(feNearDup("Mara Voss is the harbor master", "Mara Voss lost her left eye in the war"), true, "the shared fingerprint changed for every caller");
});

// ── M2: an applied extraction and its retry ────────────────────────────────────────────────────────────────────────
var EXTRACT = JSON.stringify({ chapterSummary: "Tess crossed the Ashfen causeway and met the ferryman.", npcUpdates: [], loreDiscovered: ["The causeway floods at the new moon."], decisionsMade: ["Tess paid the ferryman in iron."], futureEvents: [], resolvedEvents: [], supersededFacts: [] });
function longSession(n) { var i; sessionLog = []; for (i = 0; i < n; i++) { sessionLog.push({ role: "user", content: "I walk on, step " + i + ". " + new Array(60).join("word ") }); sessionLog.push({ role: "assistant", content: "You walk on, step " + i + ". " + new Array(260).join("word ") }); } }
kase("M2: when the save fails after an extraction was applied, the retry files nothing twice and asks the model nothing", function () {
  fresh(); longSession(12);
  var calls = 0, memSaves = 0; callGM = function () { calls++; return Promise.resolve(EXTRACT); };
  saveLocal = function () { return false; };                                   // storage full
  return summarize().then(function () {
    assert.strictEqual(calls, 1, "fixture: the extractor was not called once");
    assert.strictEqual(memory.chapters.length, 1, "fixture: the extraction was not applied");
    assert.strictEqual(sessionLog.length, 24, "the session log was trimmed although nothing was saved");
    sessionLog.push({ role: "user", content: "I rest." }, { role: "assistant", content: "You rest by the water." });
    saveLocal = function () { return true; }; saveMem = function () { memSaves++; return true; };
    return summarize();
  }).then(function () {
    assert.ok(memSaves >= 1, "the marker's removal was never saved — a reload would find it again");
    assert.strictEqual(calls, 1, "the same window was sent to the extractor again");
    assert.strictEqual(memory.chapters.length, 1, "the chapter was filed twice: " + memory.chapters.length);
    assert.strictEqual(memory.keyDecisions.filter(function (d) { return /ferryman in iron/.test(d.desc); }).length, 1, "the decision was filed twice");
    assert.ok(sessionLog.length < 24, "the session log was never trimmed after the save succeeded");
    assert.strictEqual(sessionLog[sessionLog.length - 1].content, "You rest by the water.", "the exchange played after the failed save was lost");
    assert.strictEqual(sessKeptStart(), sessionLog.length - 2, "the exchange played after the failed save is marked as already filed (" + sessKeptStart() + " of " + sessionLog.length + ")");
    assert.ok(!memory.summaryApplied, "the marker outlived its commit");
    var w2 = LE.makeTestWorld({ campId: "imp777", campName: "Imported" }), m2 = blankMemory(); m2.summaryApplied = { upTo: 4, kept: 0, sig: "s", turn: 2 };
    snapshotActiveCamp = function () { return true; };
    importSaveData(JSON.parse(JSON.stringify({ worldState: w2, memory: m2, sessionLog: [] })));
    assert.deepStrictEqual(memory.summaryApplied, { upTo: 4, kept: 0, sig: "s", turn: 2 }, "a .tnd import drops the marker — the window it describes is extracted again");
    fresh(); longSession(12); calls = 0; memSaves = 0;
    saveLocal = function () { return false; };
    return summarize();
  }).then(function () {
    saveLocal = function () { return true; }; saveCore = function () { return false; }; saveMem = function () { memSaves++; return true; };   // the trim cannot be written
    return summarize();
  }).then(function () {
    assert.strictEqual(memSaves, 0, "the marker's removal was saved although the trim was not — a reload extracts the untrimmed log again");
  });
});
kase("M2: a throw after the extraction was applied and saved does not file the window again", function () {
  fresh(); longSession(12);
  var calls = 0, boom = true; callGM = function () { calls++; return Promise.resolve(EXTRACT); };
  retainSessionTail = function () { if (boom) throw new Error("boom in the trim"); return REAL.retain.apply(null, arguments); };
  return summarize().then(function () {
    assert.strictEqual(memory.chapters.length, 1, "fixture: the extraction was not applied");
    assert.ok(!worldState.summaryFailure, "a strike was counted against an extraction that succeeded: " + JSON.stringify(worldState.summaryFailure));
    return summarize();                                            // the trim throws a second time
  }).then(function () {
    assert.strictEqual(memory.chapters.length, 1, "a second throw filed the window again");
    assert.ok(said.msgs.some(function (m) { return /tried again next turn/.test(m); }), "the player was told nothing: " + JSON.stringify(said.msgs));
    boom = false;
    return summarize();
  }).then(function () {
    assert.strictEqual(calls, 1, "the window was extracted again after the throw");
    assert.strictEqual(memory.chapters.length, 1, "the chapter was filed twice");
    assert.ok(sessionLog.length < 24, "the log was never trimmed");
  });
});
kase("M2: every exchange played between a failed save and its retry is kept for the next extraction", function () {
  fresh(); longSession(12);
  callGM = function () { return Promise.resolve(EXTRACT); };
  saveLocal = function () { return false; };
  return summarize().then(function () {
    var i; for (i = 0; i < 5; i++) sessionLog.push({ role: "user", content: "Later step " + i + "." }, { role: "assistant", content: "Later reply " + i + ". " + new Array(200).join("word ") });
    saveLocal = function () { return true; };
    return summarize();
  }).then(function () {
    var later = sessionLog.filter(function (m) { return /^Later reply/.test(m.content); }).length;
    assert.strictEqual(later, 5, "exchanges the extraction never read were trimmed away: " + later + " of 5 kept");
    assert.strictEqual(sessionLog.length - sessKeptStart(), 10, "they are not all waiting for the next extraction (" + sessKeptStart() + " of " + sessionLog.length + " marked filed)");
  });
});
kase("M2: with nothing failing, one summarize files once, trims, and leaves no marker", function () {
  fresh(); longSession(12);
  var calls = 0; callGM = function () { calls++; return Promise.resolve(EXTRACT); };
  return summarize().then(function () {
    assert.strictEqual(calls, 1); assert.strictEqual(memory.chapters.length, 1);
    assert.ok(sessionLog.length < 24 && sessKeptStart() === sessionLog.length, "the whole kept tail is not marked as filed");
    assert.ok(!memory.summaryApplied);
  });
});
kase("M2: a marker that does not describe the session log on hand is ignored — the window is extracted", function () {
  fresh(); longSession(12);
  memory.summaryApplied = { upTo: 24, kept: 0, sig: "not this log", turn: 3 };
  var calls = 0; callGM = function () { calls++; return Promise.resolve(EXTRACT); };
  return summarize().then(function () {
    assert.strictEqual(calls, 1, "a stale marker stopped a window from being extracted — its events would never reach memory");
    assert.strictEqual(memory.chapters.length, 1);
    fresh(); longSession(12); calls = 0; worldState.sessKept = 4;
    memory.summaryApplied = { upTo: 24, kept: 0, sig: summarySig(sessionLog[23], sessionLog[22]), turn: 3 };   // right last exchange, another window start
    return summarize();
  }).then(function () {
    assert.strictEqual(calls, 1, "a marker for a window that began elsewhere was honoured");
    fresh(); longSession(12); calls = 0;
    memory.summaryApplied = { upTo: 24, kept: 0, sig: summarySig(sessionLog[23], { content: "another question" }), turn: 3 };   // the same reply after another action
    return summarize();
  }).then(function () {
    assert.strictEqual(calls, 1, "a marker was honoured on the reply alone — two windows ending in the same words would skip the second");
  });
});

// ── M3: the superseded-fact needle ─────────────────────────────────────────────────────────────────────────────────
kase("M3: a superseded-fact needle of a space, or a fragment of a word, retires nothing", function () {
  fresh(); npc("Bram"); memory.npcs.Bram.knowledge = ["Bram is a smith in Ashfen", "Bram hates the baron"];
  memory.npcs.Bram.authored = [{ source: "blueprint", field: "notes", text: "A smith of Ashfen, loyal to no lord." }];
  applySummaryExtract({ chapterSummary: "c", supersededFacts: [{ name: "Bram", old: " ", "new": "Bram is dead" }] }, null, null);
  assert.deepStrictEqual(memory.npcs.Bram.knowledge, ["Bram is a smith in Ashfen", "Bram hates the baron"], "a one-space needle retired a live fact");
  applySummaryExtract({ chapterSummary: "c", supersededFacts: [{ name: "Bram", old: "a", "new": "Bram is dead" }, { name: "Bram", old: "smit", "new": "Bram is dead" }, { name: "Bram", old: "hates the bar", "new": "Bram is dead" }] }, null, null);
  assert.deepStrictEqual(memory.npcs.Bram.knowledge, ["Bram is a smith in Ashfen", "Bram hates the baron"], "a fragment retired a live fact: " + JSON.stringify(memory.npcs.Bram.knowledge));
});
kase("M3: an exact fact, and a whole phrase of one, are retired as before", function () {
  fresh(); npc("Bram"); memory.npcs.Bram.knowledge = ["Bram is a smith in Ashfen", "Bram hates the baron"];
  var st = applySummaryExtract({ chapterSummary: "c", supersededFacts: [{ name: "Bram", old: "  Bram hates the baron ", "new": "Bram serves the baron now" }] }, null, null);
  assert.strictEqual(st.superseded, 1, "an exact fact (with stray spaces) was not retired");
  assert.ok(memory.npcs.Bram.knowledge.indexOf("Bram hates the baron") < 0 && memory.npcs.Bram.knowledge.indexOf("Bram serves the baron now") >= 0, JSON.stringify(memory.npcs.Bram.knowledge));
  st = applySummaryExtract({ chapterSummary: "c", supersededFacts: [{ name: "Bram", old: "a smith in Ashfen", "new": "Bram is a soldier now" }] }, null, null);
  assert.strictEqual(st.superseded, 1, "a whole phrase of an on-file fact was not retired");
});

// ── M4: a deferred scene fact ──────────────────────────────────────────────────────────────────────────────────────
kase("M4: a scene-only fact deferred past the re-ask cap comes back as a scene fact, not as standing knowledge", function () {
  fresh(); npc("Bram");
  var ups = [], i;
  for (i = 0; i <= RECORD_REGISTER_REASK_MAX; i++) ups.push({ name: "Bram", knowledgeGained: { fact: "Bram keeps a ledger of slights, number " + i, kind: "scene" } });
  var call = function (p) { return Promise.resolve("Bram remembers every slight"); };
  return recordRegisterGuard({ npcUpdates: ups, loreDiscovered: [] }, 10, call).then(function (out) {
    assert.strictEqual(out.deferred, 1, "fixture: nothing was deferred: " + JSON.stringify(out));
    var next = { npcUpdates: [], loreDiscovered: [] };
    return recordRegisterGuard(next, 11, call).then(function () { return next; });
  }).then(function (next) {
    assert.strictEqual(next.npcUpdates.length, 1, "the deferred line did not come back");
    var kg = next.npcUpdates[0].knowledgeGained;
    assert.ok(kg && typeof kg === "object" && String(kg.kind).toLowerCase() === "scene", "the deferred scene fact came back as standing knowledge: " + JSON.stringify(kg));
    applySummaryExtract({ chapterSummary: "c", npcUpdates: next.npcUpdates }, null, null);
    assert.deepStrictEqual(memory.npcs.Bram.knowledge, [], "a fact true only in its scene was filed as permanent knowledge: " + JSON.stringify(memory.npcs.Bram.knowledge));
    // a deferred knowledge line with no character is not lore
    fresh(); worldState.recordDeferred = [{ kind: "knowledge", name: null, text: "A plain line about nobody", turn: 5 }];
    var orphan = { npcUpdates: [], loreDiscovered: [] };
    return recordRegisterGuard(orphan, 6, call).then(function () { assert.deepStrictEqual(orphan.loreDiscovered, [], "a knowledge line with no character came back as lore"); assert.deepStrictEqual(orphan.npcUpdates, []); });
  }).then(function () {
    // deferred TWICE: more lines wait than one window re-asks
    fresh(); npc("Bram"); var many = [], j;
    for (j = 0; j < RECORD_REGISTER_REASK_MAX * 2 + 2; j++) many.push({ name: "Bram", knowledgeGained: { fact: "Bram keeps a ledger of slights, number " + j, kind: "scene" } });
    return recordRegisterGuard({ npcUpdates: many, loreDiscovered: [] }, 10, call).then(function () { return recordRegisterGuard({ npcUpdates: [], loreDiscovered: [] }, 11, call); });
  }).then(function () {
    var q = worldState.recordDeferred || [];
    assert.ok(q.length >= 1, "fixture: nothing was deferred a second time");
    assert.ok(q.every(function (r) { return r.scene === true; }), "a line deferred twice lost its scene mark: " + JSON.stringify(q));
  });
});

// ── M5: a failing era compile ──────────────────────────────────────────────────────────────────────────────────────
kase("M5: an era compile that keeps failing stops being asked for, and is on the health readout", function () {
  fresh(); worldState.turn = 300;
  eraNextSources = function () { return { sources: [{ turn: 10, summary: "An old chapter." }] }; };
  var calls = 0; callGM = function () { calls++; return Promise.reject(new Error("provider down")); };
  function once() { return compileEraIfDue(); }
  return once().then(once).then(once).then(function () {
    assert.strictEqual(calls, 3, "fixture: three failures were not three calls");
    assert.ok(worldState.eraFailure && worldState.eraFailure.count === 3, "the failures are not on record: " + JSON.stringify(worldState.eraFailure));
    return once().then(once);
  }).then(function () {
    assert.strictEqual(calls, 3, "a compile that failed three times running is still billed at every summarize");
    var h = healthIndicators(worldState, memory).items, an = h.filter(function (x) { return x.id === "anomaly"; })[0];
    assert.ok(an && /era/i.test(an.detail) && /provider down/.test(an.detail), "the failing compile is not on the health readout: " + JSON.stringify(an));
    worldState.turn += ERA_FAIL_COOLDOWN_TURNS + 1;
    callGM = function () { calls++; return Promise.resolve(JSON.stringify({ summary: "The early days at Ashfen." })); };
    return once();
  }).then(function () {
    assert.strictEqual(calls, 4, "after the pause the compile was never tried again");
    assert.ok(!worldState.eraFailure, "a compile that succeeded left its failure on record");
  });
});

kase("M5: a compile that fails after another campaign was opened is not recorded against that campaign", function () {
  fresh(); worldState.turn = 300;
  eraNextSources = function () { return { sources: [{ turn: 10, summary: "An old chapter." }] }; };
  var fail; callGM = function () { return new Promise(function (res, rej) { fail = rej; }); };
  var p = compileEraIfDue();
  campaignEpochBump();                                             // another state was installed while the call was out
  fail(new Error("provider down"));
  return p.then(function () { assert.ok(!worldState.eraFailure, "the old campaign's failure is on the open one: " + JSON.stringify(worldState.eraFailure)); });
});

// ── M6: map edges ──────────────────────────────────────────────────────────────────────────────────────────────────
kase("M6: a pointer that holds an alias of a place records no second edge for the same pair, and no edge to itself", function () {
  fresh(); memory.map = { nodes: {}, edges: [], lastArrivalFrom: null };
  fileLocation("Sandpoint", null, 1, "Sandpoint"); fileLocation("Magnimar", null, 2, "Sandpoint");
  assert.strictEqual(memory.map.edges.length, 1, "fixture: " + JSON.stringify(memory.map.edges));
  memory.map.identity = { entries: { "Sandpoint, Varisia": { mergedInto: "Sandpoint" } } };
  fileLocation("Magnimar", null, 3, "Sandpoint, Varisia");
  assert.strictEqual(memory.map.edges.length, 1, "the alias recorded a second edge for the same pair: " + JSON.stringify(memory.map.edges));
  fileLocation("Sandpoint", null, 4, "Sandpoint, Varisia");
  assert.strictEqual(memory.map.edges.length, 1, "a place was joined to itself under its alias: " + JSON.stringify(memory.map.edges));
  memory.map.edges.push({ from: "Sandpoint, Varisia", to: "Korvosa", turn: 1 });   // stored before the two names were merged
  fileLocation("Korvosa", null, 5, "Sandpoint");
  assert.strictEqual(memory.map.edges.length, 2, "an edge stored under the alias was not recognised: " + JSON.stringify(memory.map.edges));
  fileLocation("Riddleport", null, 5, "Sandpoint, Varisia");
  assert.deepStrictEqual([memory.map.edges[2].from, memory.map.edges[2].to], ["Sandpoint", "Riddleport"], "a new edge was stored under the alias");
  assert.strictEqual(mapEdgeAdd("Sandpoint, Varisia", "Magnimar", 9), false); assert.strictEqual(mapEdgeAdd("Sandpoint, Varisia", "Sandpoint", 9), false); assert.strictEqual(memory.map.edges.length, 3);
  var tagSrc = fs.readFileSync(path.join(__dirname, "..", "tag_table.js"), "utf8");
  assert.ok(/if\(psPrev&&psPrev!==psArg\)mapEdgeAdd\(psPrev,psArg,R\.turn\);/.test(tagSrc) && tagSrc.indexOf("psE.from===psPrev") < 0, "a companion's split still writes its edge by its own raw comparison");
});

// ── M7: a companion's queued wants ─────────────────────────────────────────────────────────────────────────────────
kase("M7: a want that is already active or waiting is not queued again, the queue is bounded, and each refusal is said", function () {
  fresh(); var cs = { name: "Bram" }, i;
  assert.strictEqual(agendaFile(cs, "   ", "", "gm", 1), null, "a blank want was filed"); assert.ok(!cs.agenda);
  assert.strictEqual(agendaFile(cs, "Find his sister", "", "gm", 1), "active");
  assert.strictEqual(agendaFile(cs, "find his sister ", "", "gm", 2), "known", "the active want was queued behind itself");
  assert.strictEqual(agendaFile(cs, "Buy a horse", "", "gm", 3), "silent");
  assert.strictEqual(agendaFile(cs, "BUY A HORSE", "", "gm", 4), "known", "a waiting want was queued twice");
  assert.strictEqual(cs.agendaQueue.length, 1);
  for (i = 0; i < AGENDA_QUEUE_MAX + 4; i++) agendaFile(cs, "Errand " + i, "", "gm", 5);
  assert.strictEqual(cs.agendaQueue.length, AGENDA_QUEUE_MAX, "the queue is unbounded: " + cs.agendaQueue.length);
  assert.strictEqual(agendaFile(cs, "One more errand", "", "gm", 6), "full");
  fresh(); npc("Bram", { partyMember: true, charSheet: { name: "Bram", hp: 10, maxHp: 10, cls: "Warrior", level: 1, xp: 0, inventory: [], conditions: [], abilities: [], spells: [], stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 } } });
  applyMuts("[COMPANION_AGENDA:Bram|Find his sister]");
  var r = applyMuts("[COMPANION_AGENDA:Bram|Find his sister]");
  assert.ok((r.muts || []).some(function (m) { return /already/.test(m); }), "a repeated want was not said: " + JSON.stringify(r.muts));
  for (i = 0; i < AGENDA_QUEUE_MAX; i++) applyMuts("[COMPANION_AGENDA:Bram|Errand " + i + "]");
  r = applyMuts("[COMPANION_AGENDA:Bram|One errand too many]");
  assert.ok((r.muts || []).some(function (m) { return /already waiting/.test(m) && /One errand too many/.test(m); }), "a want refused at the bound was not said: " + JSON.stringify(r.muts));
  assert.ok(!said.toasts.some(function (t) { return /\(later\): One errand too many/.test(t); }), "a want that was refused was toasted as queued: " + JSON.stringify(said.toasts));
  assert.ok(said.toasts.some(function (t) { return /already waiting/.test(t); }), "the refusal has no toast");
  said.toasts.length = 0; applyMuts("[COMPANION_AGENDA:Bram|Find his sister]");
  assert.deepStrictEqual(said.toasts.filter(function (t) { return /Find his sister/.test(t); }), [], "a want already on file was toasted as queued again");
});
kase("M7: an old save's duplicate of a want that completes is not promoted as the next want", function () {
  fresh(); var cs = { name: "Bram", agenda: { want: "Find his sister", kind: "personal", source: "gm", born: 1, since: 1 }, agendaQueue: [{ want: "Find his sister", kind: "personal", source: "gm", born: 2 }, { want: "Buy a horse", kind: "personal", source: "gm", born: 3 }] };
  var out = agendaComplete(cs, "", 9, "fulfilled");
  assert.strictEqual(out.promoted, "Buy a horse", "the completed want's duplicate was promoted: " + JSON.stringify(out));
  assert.strictEqual(cs.agendaQueue.length, 0);
  var c2 = { name: "Bram", agenda: { want: "Guard the gate", kind: "personal", source: "gm", born: 1, since: 1 }, agendaQueue: [{ want: "Find his sister", kind: "personal" }, { want: "find his sister ", kind: "personal" }, { want: "Buy a horse", kind: "personal" }] };
  agendaComplete(c2, "sister", 9, "found");
  assert.deepStrictEqual(c2.agendaQueue.map(function (q) { return q.want; }), ["Buy a horse"], "a duplicate of a want resolved early still waits to be promoted");
});

// ── runner ─────────────────────────────────────────────────────────────────────────────────────────────────────────
var argv = process.argv.slice(2), only = argv.indexOf("--only") >= 0 ? argv[argv.indexOf("--only") + 1] : "", passed = 0, failed = 0;
var todo = CASES.filter(function (c) { return !only || c.name.indexOf(only) >= 0; });
if (!todo.length) { realErr.call(console, "--only \"" + only + "\" matched 0 tests — NOTHING ran"); process.exit(1); }
function restore() { if (REAL.callGM) callGM = REAL.callGM; }
function next(i) {
  if (i >= todo.length) {
    if (failed) { realErr.call(console, "#777 memory: " + failed + " FAILED, " + passed + " passed"); process.exit(1); }
    realLog.call(console, "ALL GREEN — " + passed + " #777 memory cases"); return;
  }
  var c = todo[i];
  function ok() { passed++; realLog.call(console, "PASS #777 " + c.name); restore(); next(i + 1); }
  function bad(e) { failed++; realErr.call(console, "FAIL #777 " + c.name + " — " + String((e && e.stack) || e).split("\n").slice(0, 4).join("\n    ")); restore(); next(i + 1); }
  try { var r = c.fn(); if (r && typeof r.then === "function") r.then(ok, bad); else ok(); } catch (e) { bad(e); }
}
next(0);
