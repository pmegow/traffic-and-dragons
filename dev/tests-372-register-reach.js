// tests-372-register-reach.js — #372 ①: the chapter re-ask, driven through the REAL async chapterRegisterGuard
// and the REAL summarize() against a stubbed provider (the tests-b38 pattern — the engine suite cannot await).
//   • a chapter summary carrying a register word → exactly ONE extra call (the rewrite), the clean rewrite is the
//     chapter that files, the census entry reads reasked+cleaned, no strike
//   • a rewrite that still carries the word → the ORIGINAL files, the census entry reads cleaned:false, no strike
//   • the rewrite call throws → the original files, no strike (the chapter has no reader waiting; a failed retry
//     is not a failed extraction)
//   • a clean summary → one call only, nothing filed on the chapter channel
//   node dev/tests-372-register-reach.js
var engine = require("./load-engine.js");
engine.loadEngine();

var msgs = [], calls = [];
addMsg = function (k, t) { msgs.push(String(t || "")); return { remove: function () {} }; };
showToast = function () {};
reportError = function () {};
saveLocal = function () { return true; };
saveCore = function () { return true; };
saveMem = function () { return true; };
sceneRefsSummaryFailure = function () {};
compileEraIfDue = function () {};
function extraction(summary) { return JSON.stringify({ chapterSummary: summary, npcUpdates: [], lore: [], decisions: [], futureEvents: [], resolvedEvents: [] }); }
var DIRTY = "Ammut read the ledger of the dead while Morwen filed the invoice of her grief.";
var CLEAN = "Ammut read the names of the dead while Morwen counted her griefs aloud.";
function stubGM(seq) {
  calls = [];
  callGM = function (msg, sys, max, model, opts) {
    calls.push({ msg: String(msg), sys: String(sys || ""), max: max, opts: opts || {} });
    var s = seq.shift();
    if (s === "THROW") return Promise.reject(new Error("rewrite transport failed"));
    if (s === undefined) return Promise.reject(new Error("stub exhausted — an unexpected extra call"));
    return Promise.resolve(s);
  };
}
function seed() {
  worldState = engine.makeTestWorld(); memory = blankMemory(); sessionLog = []; msgs = [];
  worldState.turn = 20; delete worldState.summaryFailure; delete worldState.sessKept; delete worldState.registerCensus; worldState.identityConflicts = [];
  var big = ""; var i; for (i = 0; i < 400; i++) big += "The marsh mist thickened around the crawler as Morwen read the glyphs aloud. ";
  for (i = 0; i < 4; i++) { sessionLog.push({ role: "user", content: "We push on through the mire, exchange " + i + "." }, { role: "assistant", content: "EXCHANGE-" + i + " " + big }); }
  if (sessionTokens() < SUMMARIZE_AT) throw new Error("fixture too small: " + sessionTokens() + " < " + SUMMARIZE_AT);
}
function lastChapter() { return memory.chapters.length ? memory.chapters[memory.chapters.length - 1].summary : null; }
function chapterEntries() { return (worldState.registerCensus && worldState.registerCensus.chapter) || []; }

var pass = 0, fails = [], chain = Promise.resolve();
function tAsync(name, fn) {
  chain = chain.then(function () {
    return Promise.resolve().then(fn).then(
      function (r) { if (r === true || r === undefined) { pass++; console.log("PASS " + name); } else fails.push(name + " — " + r); },
      function (e) { fails.push(name + " — threw: " + (e && e.stack || e)); });
  });
}

tAsync("the guard alone: a hit → one rewrite call with the paragraph-only system prompt; a clean rewrite replaces the summary and files reasked+cleaned", async function () {
  seed(); stubGM([CLEAN]);
  var ex = { chapterSummary: DIRTY };
  var r = await chapterRegisterGuard(ex, 20);
  if (calls.length !== 1) return "expected exactly one rewrite call, got " + calls.length;
  if (calls[0].msg.indexOf(DIRTY) < 0 || calls[0].msg.indexOf("'ledger'") < 0) return "the rewrite prompt must carry the summary and name the words";
  if (/ONLY valid JSON/.test(calls[0].sys)) return "the rewrite must not ride the extractor's JSON-only system prompt (it would come back as JSON)";
  if (!calls[0].opts.noHistory) return "the rewrite must not drag the session log along";
  if (ex.chapterSummary !== CLEAN) return "the clean rewrite must replace the summary: " + ex.chapterSummary;
  if (!r || !r.reasked || !r.cleaned) return "result: " + JSON.stringify(r);
  var e = chapterEntries(); if (e.length !== 2 || e[0].word !== "ledger" || e[1].word !== "invoice" || !e[0].reasked || !e[0].cleaned) return "census: " + JSON.stringify(e);
  return true;
});
tAsync("the guard alone: a clean summary → no call, nothing filed", async function () {
  seed(); stubGM([]);
  var ex = { chapterSummary: CLEAN };
  var r = await chapterRegisterGuard(ex, 20);
  if (calls.length) return "a clean summary must not be re-asked";
  if (ex.chapterSummary !== CLEAN || (r && r.reasked)) return "untouched: " + JSON.stringify(r);
  if (chapterEntries().length) return "nothing to file";
  return true;
});
tAsync("summarize(): a dirty chapter costs exactly two calls (extract + rewrite); the CLEAN rewrite is the chapter on file; no strike; the system line still reads as a normal filing", async function () {
  seed(); stubGM([extraction(DIRTY), CLEAN]);
  await summarize();
  if (calls.length !== 2) return "calls: " + calls.length;
  if (lastChapter() !== CLEAN) return "chapter on file: " + lastChapter();
  if (worldState.summaryFailure && worldState.summaryFailure.count) return "a rewrite must never count as a strike";
  if (!msgs.some(function (m) { return /^Memory updated/.test(m); })) return "the filing line: " + JSON.stringify(msgs);
  var e = chapterEntries(); if (e.length !== 2 || !e[0].cleaned) return "census: " + JSON.stringify(e);
  return true;
});
tAsync("summarize(): a rewrite that still carries the word → the ORIGINAL extraction files (verified text beats an unverified rewrite), census reads cleaned:false, no strike", async function () {
  seed(); stubGM([extraction(DIRTY), "Ammut read the ledger of the dead again, and that was that."]);
  await summarize();
  if (calls.length !== 2) return "calls: " + calls.length;
  if (lastChapter() !== DIRTY) return "the original must file when the rewrite is still dirty: " + lastChapter();
  var e = chapterEntries(); if (e.length !== 2 || e[0].cleaned !== false || !e[0].reasked) return "census: " + JSON.stringify(e);
  if (worldState.summaryFailure && worldState.summaryFailure.count) return "no strike";
  return true;
});
tAsync("summarize(): the rewrite call throws → the original files, no strike, the census still counts the words (reasked:false)", async function () {
  seed(); stubGM([extraction(DIRTY), "THROW"]);
  await summarize();
  if (lastChapter() !== DIRTY) return "the original must file when the rewrite fails: " + lastChapter();
  if (worldState.summaryFailure && worldState.summaryFailure.count) return "a failed rewrite is not a failed extraction — no strike";
  var e = chapterEntries(); if (e.length !== 2 || e[0].reasked !== false) return "census: " + JSON.stringify(e);
  return true;
});
tAsync("summarize(): a clean chapter is one call, and the chapter channel stays empty", async function () {
  seed(); stubGM([extraction(CLEAN)]);
  await summarize();
  if (calls.length !== 1) return "calls: " + calls.length;
  if (lastChapter() !== CLEAN) return "chapter: " + lastChapter();
  if (chapterEntries().length) return "nothing filed";
  return true;
});

chain.then(function () {
  console.log("#372 REGISTER REACH: " + fails.length + " failed, " + pass + " passed");
  fails.forEach(function (f) { console.error("FAIL " + f); });
  process.exit(fails.length ? 1 : 0);
});
