// tests-516-deferred-queue.js — #516: a memory line deferred to the next window (#481 C7) is not lost when that window's
// extraction fails. recordRegisterGuard empties the queue into the extraction BEFORE it is validated; a W6 failure then
// discards the extraction, and the line was neither filed nor queued any more. Driven through the REAL summarize()
// against a stubbed provider (the tests-372 pattern — the engine suite cannot await).
//   • a line queued last window survives a failed extraction and files on the passing retry
//   • lines a FAILED attempt deferred are not kept (the retry's own extraction re-reads them; a quarantined extraction
//     leaks nothing into the next window), and the queue holds exactly what it held before the attempt
//   node dev/tests-516-deferred-queue.js
var engine = require("./load-engine.js");
engine.loadEngine();

var calls = [];
addMsg = function () { return { remove: function () {} }; };
showToast = function () {};
reportError = function () {};
saveLocal = function () { return true; };
saveCore = function () { return true; };
saveMem = function () { return true; };
sceneRefsSummaryFailure = function () {};
compileEraIfDue = function () {};
var quietWarn = console.warn, quietInfo = console.info;
function hush() { console.warn = function () {}; console.info = function () {}; }
function loud() { console.warn = quietWarn; console.info = quietInfo; }

function isExtract(sys) { return /data extraction system/.test(String(sys || "")); }
function stubGM(onExtract, onRewrite) {
  calls = [];
  callGM = function (msg, sys) { calls.push({ msg: String(msg), sys: String(sys || "") }); return Promise.resolve(isExtract(sys) ? onExtract() : onRewrite(String(msg))); };
}
function extraction(summary, lore) { return JSON.stringify({ chapterSummary: summary, npcUpdates: [], loreDiscovered: lore || [], decisionsMade: [], futureEvents: [], resolvedEvents: [], npcDeaths: [] }); }
// Daeris is she/her on the roster, so "He struck" is a W6 identity failure inside the extraction's validation
var BAD = "Daeris drew the blade. He struck the gate twice.", GOOD = "Daeris drew the blade. She struck the gate twice.";
function seed() {
  worldState = engine.makeTestWorld(); memory = blankMemory(); sessionLog = [];
  worldState.turn = 60; delete worldState.summaryFailure; delete worldState.sessKept; delete worldState.registerCensus; delete worldState.recordDeferred; worldState.identityConflicts = [];
  worldState.npcs.push({ name: "Daeris", status: "ally", rel: "companion", partyMember: true, pronouns: "she/her", charSheet: { name: "Daeris", gender: "F", inventory: [], abilities: [], hp: 8, maxHp: 8 } });
  memory.npcs.Daeris = { attitude: "ally", knowledge: [], events: [], aliases: [], pronouns: "she/her" };
  var big = "", i; for (i = 0; i < 400; i++) big += "The hero and Daeris walked the long road and spoke of small things. ";
  for (i = 0; i < 4; i++) sessionLog.push({ role: "user", content: "I walk on with Daeris, exchange " + i + "." }, { role: "assistant", content: "EXCHANGE-" + i + " " + big });
  if (sessionTokens() < SUMMARIZE_AT) throw new Error("fixture too small: " + sessionTokens() + " < " + SUMMARIZE_AT);
}
function loreText() { return memory.lore.map(function (l) { return typeof l === "string" ? l : (l && (l.fact || l.text)) || JSON.stringify(l); }); }

var pass = 0, fails = [], chain = Promise.resolve();
function tAsync(name, fn) {
  chain = chain.then(function () {
    hush();
    return Promise.resolve().then(fn).then(
      function (r) { loud(); if (r === true || r === undefined) { pass++; console.log("PASS " + name); } else fails.push(name + " — " + r); },
      function (e) { loud(); fails.push(name + " — threw: " + (e && e.stack || e)); });
  });
}

tAsync("#516 the repro: a line queued last window survives a failed extraction and files on the passing retry", async function () {
  seed();
  worldState.recordDeferred = [{ kind: "lore", name: null, text: "The village keeps an invoice of the hunt in the old mill.", turn: 40 }];
  stubGM(function () { return extraction(BAD, ["The road north is washed out."]); }, function () { return "The village remembers the hunt at the old mill."; });
  await summarize();
  if (!worldState.summaryFailure) return "fixture: the first extraction must fail validation";
  if (loreText().length) return "a failed extraction filed lore: " + JSON.stringify(loreText());
  var q = (worldState.recordDeferred || []).map(function (x) { return x.text; });
  if (q.length !== 1 || !/old mill/.test(q[0])) return "the queued line is gone after the failed attempt: " + JSON.stringify(q);
  stubGM(function () { return extraction(GOOD, ["The road north is washed out."]); }, function () { return "The village remembers the hunt at the old mill."; });
  await summarize();
  if (worldState.summaryFailure) return "fixture: the retry must pass";
  return loreText().some(function (l) { return /old mill/.test(l); }) ? true : "the deferred line never filed: " + JSON.stringify(loreText());
});

tAsync("#516 a failed attempt's own deferrals are not kept: the queue holds exactly what it held before the attempt", async function () {
  seed();
  var dirty = [], i; for (i = 0; i < 8; i++) dirty.push("Fact " + i + ": the reeve keeps an invoice of the hunt.");
  stubGM(function () { return extraction(BAD, dirty); }, function (msg) { var m = msg.match(/(Fact \d+)/); return (m ? m[1] : "Fact ?") + ": the reeve remembers the hunt."; });
  await summarize();
  if (!worldState.summaryFailure) return "fixture: the extraction must fail validation";
  if (calls.length < 2) return "fixture: the guard must have run (rewrites) before the failure: " + calls.length + " calls";
  return (worldState.recordDeferred === undefined || !worldState.recordDeferred.length) ? true : "a failed attempt left its deferrals queued for the next window: " + JSON.stringify(worldState.recordDeferred.map(function (x) { return x.text; }));
});

chain.then(function () {
  if (fails.length) { console.error("#516 deferred queue: " + fails.length + " FAILED\n  " + fails.join("\n  ")); process.exit(1); }
  console.log("#516 deferred queue: all green (" + pass + ")");
});
