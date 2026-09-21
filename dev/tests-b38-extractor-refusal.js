// tests-b38-extractor-refusal.js — B38 (DOC/BUGS.md): a NAMED provider block on the chapter extractor is never
// replayed unchanged. Drives the REAL async summarize() against a stubbed provider — the flow the engine suite
// cannot await (#183③ called this branch headless-untestable; a stubbed callGM + stubbed DOM chain makes it
// testable without a live model, which is exactly the gap this file closes).
//   • a modelRefusal on the normal shape → ONE same-turn retry in the reframed, shortened shape; success files the
//     chapter, counts no strike, says so in the system line
//   • both shapes refused → exactly two calls, strike 1 carries refusal:true, the window is kept
//   • with a refusal strike standing, the NEXT summarize goes reframed FIRST (one call); success clears the strike
//   • a transient empty (emptyTransient) gets no reframed retry — one call, strike 1, no refusal flag, next turn normal
//   • strike 3 stays the terminal raw archive
//   node dev/tests-b38-extractor-refusal.js
var engine = require("./load-engine.js");
engine.loadEngine();

// ── stubs for the DOM/network chain summarize() touches ─────────────────────
var msgs = [], reports = 0, calls = [];
addMsg = function (k, t) { msgs.push(String(t || "")); return { remove: function () {} }; };
showToast = function () {};
reportError = function () { reports++; };
saveLocal = function () { return true; };
saveCore = function () { return true; };
saveMem = function () { return true; };
sceneRefsSummaryFailure = function () {};
compileEraIfDue = function () {};
function refusal() { var e = new Error("Empty response — gemini prompt blocked: PROHIBITED_CONTENT"); e.finish = "PROHIBITED_CONTENT"; e.modelRefusal = true; e.emptyTransient = false; return e; }
function transient() { var e = new Error("Empty response — gemini no candidates"); e.finish = null; e.modelRefusal = false; e.emptyTransient = true; return e; }
var GOOD = JSON.stringify({ chapterSummary: "Ammut and Morwen crossed the marsh and found the crawler jammed against a fallen spire.", npcUpdates: [], lore: ["The crawler runs on an exposed astral engine."], decisions: [], futureEvents: [], resolvedEvents: [] });
function stubGM(seq) {
  calls = [];
  callGM = function (msg, sys, max, model, opts) {
    calls.push({ msg: String(msg), sys: String(sys || ""), opts: opts || {} });
    var s = seq.shift();
    if (s === "REFUSE") return Promise.reject(refusal());
    if (s === "EMPTY") return Promise.reject(transient());
    if (s === undefined) return Promise.reject(new Error("stub exhausted — an unexpected extra call"));
    return Promise.resolve(s);
  };
}
function seed() {
  worldState = engine.makeTestWorld(); memory = blankMemory(); sessionLog = []; msgs = []; reports = 0;
  worldState.turn = 20; delete worldState.summaryFailure; delete worldState.sessKept; worldState.identityConflicts = [];
  var big = ""; var i; for (i = 0; i < 400; i++) big += "The marsh mist thickened around the crawler as Morwen read the glyphs aloud. ";
  for (i = 0; i < 4; i++) { sessionLog.push({ role: "user", content: "[ENGINE NOTE — MOOD CHECK (not a player action): x]\n\nWe push on through the mire, exchange " + i + "." }, { role: "assistant", content: "EXCHANGE-" + i + " " + big }); }
  if (sessionTokens() < SUMMARIZE_AT) throw new Error("fixture too small: " + sessionTokens() + " < " + SUMMARIZE_AT);
}
var framing = extractRefusalFraming();
function isReframed(c) { return c.msg.indexOf(framing) === 0; }

// ── reporter ────────────────────────────────────────────────────────────────
var pass = 0, fails = [], chain = Promise.resolve();
function tAsync(name, fn) {
  chain = chain.then(function () {
    return Promise.resolve().then(fn).then(
      function (r) { if (r === true || r === undefined) { pass++; console.log("PASS " + name); } else fails.push(name + " — " + r); },
      function (e) { fails.push(name + " — threw: " + (e && e.stack || e)); });
  });
}

tAsync("A refused normal shape → one same-turn reframed, shortened retry; success files the chapter, no strike, the system line says so", async function () {
  seed(); stubGM(["REFUSE", GOOD]); var before = sessionLog.length;
  await summarize();
  if (calls.length !== 2) return "expected 2 calls, got " + calls.length;
  if (isReframed(calls[0])) return "the first call must be the normal shape";
  if (!isReframed(calls[1])) return "the retry must carry the framing preface";
  if (calls[1].msg.length >= calls[0].msg.length) return "the retry must be shorter (" + calls[1].msg.length + " vs " + calls[0].msg.length + ")";
  if (calls[0].msg === calls[1].msg) return "the identical payload was replayed";
  if (calls[1].opts.kind !== "summarize" || !calls[1].opts.noHistory) return "the retry lost the summarize bucket / noHistory";
  if (!memory.chapters.length || !/crossed the marsh/.test(memory.chapters[0].summary)) return "the chapter was not filed: " + JSON.stringify(memory.chapters);
  if (worldState.summaryFailure) return "a recovered refusal must count no strike: " + JSON.stringify(worldState.summaryFailure);
  if (!msgs.some(function (m) { return /Memory updated/.test(m) && /reframed/i.test(m); })) return "the system line must say the extraction was reframed: " + JSON.stringify(msgs);
  if (sessionLog.length >= before) return "the window did not shrink after a successful filing";
  if (reports) return "a recovered refusal must not file a crash report";
  return true;
});
/* (scenario B — "both shapes refused → exactly two calls" — was superseded when both refusals began to reach the
   elision ladder; its assertions live in G below.) */
tAsync("C a standing refusal strike → the next summarize goes reframed FIRST (one call); success clears the strike", async function () {
  seed(); worldState.summaryFailure = { count: 1, firstTurn: 19, lastTurn: 19, kind: "extraction", reason: "gemini prompt blocked: PROHIBITED_CONTENT", refusal: true };
  stubGM([GOOD]);
  await summarize();
  if (calls.length !== 1) return "expected 1 call, got " + calls.length;
  if (!isReframed(calls[0])) return "the first call must already be the reframed shape";
  if (worldState.summaryFailure) return "success must clear the strike";
  if (!memory.chapters.length) return "the chapter was not filed";
  return true;
});
tAsync("D a transient empty gets NO reframed retry — one call, strike 1 without the flag; the next turn stays normal", async function () {
  seed(); stubGM(["EMPTY"]);
  await summarize();
  if (calls.length !== 1) return "a transient must not trigger the reframed retry (calls: " + calls.length + ")";
  var sf = worldState.summaryFailure; if (!sf || sf.count !== 1 || sf.refusal) return "strike 1 without refusal expected: " + JSON.stringify(sf);
  stubGM([GOOD]); await summarize();
  if (calls.length !== 1 || isReframed(calls[0])) return "after a transient the next attempt must be the normal shape";
  if (worldState.summaryFailure) return "success must clear the strike";
  return true;
});
tAsync("E strike 3 stays the terminal raw archive when the reframed shape is refused a third time and the ladder has already been tried", async function () {
  seed(); worldState.summaryFailure = { count: 2, firstTurn: 18, lastTurn: 19, kind: "extraction", reason: "gemini prompt blocked: PROHIBITED_CONTENT", refusal: true, ladderTried: true };
  stubGM(["REFUSE"]); var before = sessionLog.length;
  await summarize();
  if (calls.length !== 1) return "expected 1 call (reframed first, ladder already tried), got " + calls.length;
  if (!memory.chapters.length || memory.chapters[memory.chapters.length - 1].summary.indexOf("(summary failed; raw excerpt)") !== 0) return "the raw archive was not filed: " + JSON.stringify(memory.chapters);
  if (sessionLog.length >= before) return "the window must shrink after the archive";
  if (worldState.summaryFailure) return "the archive must clear the strikes";
  if (!msgs.some(function (m) { return /Memory saved \(raw\)/.test(m); })) return "the raw-archive line is missing";
  return true;
});

// ── the elision ladder (the owner's live bisect: t34 and t38 blocked on their own, seven pass) ──
var probeSys = EXTRACT_PROBE_SYS;
function probes(c) { return c.filter(function (x) { return x.sys === probeSys; }); }
tAsync("F both shapes refused → every exchange probed once (in parallel, the probe system prompt), the blocked ones elided from BOTH halves, the rest extracted; the chapter and the system line say the share withheld; no strike", async function () {
  seed(); stubGM(["REFUSE", "REFUSE", "OK", "REFUSE", "OK", "REFUSE", GOOD]); var before = sessionLog.length;
  await summarize();
  if (calls.length !== 7) return "expected 2 shapes + 4 probes + 1 extraction = 7 calls, got " + calls.length;
  var pr = probes(calls); if (pr.length !== 4) return "4 probes expected, got " + pr.length;
  if (pr[1].msg.indexOf("EXCHANGE-1") < 0 || pr[1].msg.indexOf("EXCHANGE-0") >= 0) return "each probe carries exactly its own exchange";
  if (pr[0].opts.kind !== "summarize" || !pr[0].opts.noHistory) return "probes must bill the summarize bucket with no history";
  var fin = calls[6]; if (fin.sys !== EXTRACT_SYS || !isReframed(fin)) return "the final extraction must be the reframed extractor shape";
  if (fin.msg.indexOf("EXCHANGE-1") >= 0 || fin.msg.indexOf("EXCHANGE-3") >= 0) return "a blocked exchange's text reached the final extraction";
  if (fin.msg.indexOf("EXCHANGE-0") < 0 || fin.msg.indexOf("EXCHANGE-2") < 0) return "a passing exchange was dropped";
  if (fin.msg.indexOf("exchange 1.") >= 0 || fin.msg.indexOf("exchange 3.") >= 0) return "the blocked exchange's PLAYER half must be withheld too";
  if (fin.msg.split(EXTRACT_WITHHELD).length - 1 < 4) return "both halves of both blocked exchanges must carry the marker";
  if (!memory.chapters.length || !/crossed the marsh/.test(memory.chapters[0].summary) || !/2 of 4 exchanges/.test(memory.chapters[0].summary)) return "the chapter must carry the extraction AND the withheld share: " + JSON.stringify(memory.chapters);
  if (worldState.summaryFailure) return "a recovered window counts no strike: " + JSON.stringify(worldState.summaryFailure);
  if (!msgs.some(function (m) { return /Memory updated/.test(m) && /2 of 4 exchanges withheld/.test(m); })) return "the system line must name the share withheld: " + JSON.stringify(msgs);
  if (sessionLog.length >= before) return "the window did not shrink after the filing";
  if (reports) return "a recovered window must not file a crash report";
  return true;
});
tAsync("G both shapes refused but no exchange is blocked on its own → the ladder yields nothing, strike 1 with refusal and ladderTried, no extra extraction call, the window kept, a failure line, one crash report", async function () {
  seed(); stubGM(["REFUSE", "REFUSE", "OK", "OK", "OK", "OK"]); var before = sessionLog.length;
  await summarize();
  if (calls.length !== 6) return "expected 2 + 4 probes = 6 calls, got " + calls.length;
  var sf = worldState.summaryFailure; if (!sf || sf.count !== 1 || sf.refusal !== true || sf.ladderTried !== true) return "strike 1 with refusal+ladderTried expected: " + JSON.stringify(sf);
  if (memory.chapters.length) return "no chapter on a failed window";
  if (sessionLog.length !== before) return "the window must be kept for next turn";
  if (!msgs.some(function (m) { return /retry 1 of 3/.test(m); })) return "the failure line is missing: " + JSON.stringify(msgs);
  if (reports !== 1) return "exactly one crash report for the failed window, got " + reports;
  return true;
});
tAsync("H the elided extraction is refused too → strike 1 with ladderTried; the window is kept", async function () {
  seed(); stubGM(["REFUSE", "REFUSE", "OK", "REFUSE", "OK", "OK", "REFUSE"]); var before = sessionLog.length;
  await summarize();
  if (calls.length !== 7) return "expected 7 calls, got " + calls.length;
  var sf = worldState.summaryFailure; if (!sf || sf.count !== 1 || sf.ladderTried !== true) return "strike 1 with ladderTried expected: " + JSON.stringify(sf);
  if (sessionLog.length !== before) return "the window must be kept";
  return true;
});
tAsync("I with ladderTried standing, the next turn's reframed-first refusal probes nothing — one call, strike 2", async function () {
  seed(); worldState.summaryFailure = { count: 1, firstTurn: 19, lastTurn: 19, kind: "extraction", reason: "gemini prompt blocked: PROHIBITED_CONTENT", refusal: true, ladderTried: true };
  stubGM(["REFUSE"]);
  await summarize();
  if (calls.length !== 1) return "the ladder must not run twice per window (calls: " + calls.length + ")";
  var sf = worldState.summaryFailure; if (!sf || sf.count !== 2 || sf.ladderTried !== true) return "strike 2 with ladderTried carried: " + JSON.stringify(sf);
  return true;
});
tAsync("J a probe that fails for a non-block reason (transport) counts as NOT blocked — the ladder does not elide on guesswork", async function () {
  seed(); stubGM(["REFUSE", "REFUSE", "EMPTY", "OK", "REFUSE", "OK", GOOD]);
  await summarize();
  var fin = calls[6]; if (fin.msg.indexOf("EXCHANGE-0") < 0) return "a transport-failed probe must leave its exchange in";
  if (fin.msg.indexOf("EXCHANGE-2") >= 0) return "the truly blocked exchange must still be elided";
  return true;
});

chain.then(function () {
  console.log("B38 EXTRACTOR REFUSAL: " + fails.length + " failed, " + pass + " passed");
  fails.forEach(function (f) { console.error("FAIL " + f); });
  process.exit(fails.length ? 1 : 0);
});
