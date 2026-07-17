// _tests_C.js — audit rows #13 + #16 (AUDIT_FABLE_07_16_2026): tests for the shared
// storage-adapter JSON transport (_apiJson, exercised through the public library wrappers)
// and the single-source blank wizard-state factory (blankWizardState).
//
// UNWIRED fragment — not loaded by run-tests.js or test.html. Run standalone:
//   node dev/_tests_C.js
//
// Engine-tests style (section/t/eq, same reporter shape as dev/run-tests.js; loader copied
// from dev/tests-b9-transport.js). _apiJson is private to the storageAdapter closure, so the
// seam is global.fetch beneath _tFetch — request-shape asserts are synchronous (fetch fires
// inside the wrapper call); cb asserts ride a sequential promise chain. ES5 throughout.

var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
// Same ordered list as dev/run-tests.js:9 — the engine's `var`s become globals via indirect eval.
var files = ["globals.js", "compress.js", "data.js", "capability_bible.js", "helpers.js", "state.js", "storage-adapter.js", "memory.js", "tag_table.js", "api.js", "campaign_generator.js", "game.js", "tts.js"];
var geval = eval;
for (var i = 0; i < files.length; i++) {
  try { geval(fs.readFileSync(path.join(root, files[i]), "utf8")); }
  catch (e) { console.error("ENGINE LOAD FAILED in " + files[i] + ": " + e.message); process.exit(1); }
}

// ── Reporter (mirrors run-tests.js) ──────────────────────────────────────────
var pass = 0, fails = [], curSection = "";
function section(name) { curSection = name; }
function eq(got, want, label) { if (got === want) return true; return (label || "") + " expected " + JSON.stringify(want) + " got " + JSON.stringify(got); }
function t(name, fn) {
  var label = curSection + " › " + name;
  try {
    var r = fn();
    if (r === true || r === undefined) pass++;
    else fails.push(label + " — " + r);
  } catch (e) { fails.push(label + " — threw: " + e.message); }
}
var chain = Promise.resolve();
function tAsync(name, fn) {
  var label = curSection + " › " + name;
  chain = chain.then(function () {
    return Promise.resolve().then(fn).then(
      function (r) { if (r === true || r === undefined) pass++; else fails.push(label + " — " + r); },
      function (e) { fails.push(label + " — threw: " + e.message); }
    );
  });
}

// ── fetch stub: capture every request; respond per the queued script ─────────
var calls = [];          // [{url, opts}]
var nextResponse = null; // function() → Promise (per-test); default = 200 {}
global.fetch = function (url, opts) {
  calls.push({ url: url, opts: opts || {} });
  return nextResponse ? nextResponse() : Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } });
};
function okJson(data) { return function () { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(data); } }); }; }
function httpErr(status) { return function () { return Promise.resolve({ ok: false, status: status, json: function () { return Promise.resolve({}); } }); }; }
function lastCall() { return calls[calls.length - 1]; }

// Arm server mode (same path as tests-b9-transport.js — localStorage write is try/caught).
storageAdapter.setServer("https://unit.test", "TOK_C13");

// ── #13 (a) request shape: one GET, one POST, one DELETE wrapper ─────────────
section("#13 _apiJson — request shape");

t("listCharacterLibrary → GET /api/characters, bearer auth, method UNSET, no body", function () {
  calls.length = 0; nextResponse = okJson([]);
  storageAdapter.listCharacterLibrary(function () {});
  var c = lastCall(); if (!c) return "no fetch fired";
  if (c.url !== "https://unit.test/api/characters") return "url " + c.url;
  if (c.opts.method) return "method should be GET (unset), got " + c.opts.method;
  if ("body" in c.opts) return "GET carried a body";
  if (c.opts.headers["Content-Type"]) return "GET carried Content-Type";
  return eq(c.opts.headers["Authorization"], "Bearer TOK_C13", "auth header");
});
t("saveCharacterToLibrary → POST /api/characters, JSON content-type, {character:...} body", function () {
  calls.length = 0; nextResponse = okJson({});
  storageAdapter.saveCharacterToLibrary({ name: "Ammut", level: 3 }, function () {});
  var c = lastCall(); if (!c) return "no fetch fired";
  if (c.url !== "https://unit.test/api/characters") return "url " + c.url;
  if (c.opts.method !== "POST") return "method " + c.opts.method;
  if (c.opts.headers["Content-Type"] !== "application/json") return "content-type " + c.opts.headers["Content-Type"];
  if (c.opts.headers["Authorization"] !== "Bearer TOK_C13") return "auth header missing";
  return eq(c.opts.body, JSON.stringify({ character: { name: "Ammut", level: 3 } }), "body");
});
t("deleteCharacterFromLibrary → DELETE /api/characters/:slug (URI-encoded), no body", function () {
  calls.length = 0; nextResponse = okJson({});
  storageAdapter.deleteCharacterFromLibrary("am mut", function () {});
  var c = lastCall(); if (!c) return "no fetch fired";
  if (c.url !== "https://unit.test/api/characters/am%20mut") return "url " + c.url;
  if (c.opts.method !== "DELETE") return "method " + c.opts.method;
  if ("body" in c.opts) return "DELETE carried a body";
  return eq(c.opts.headers["Authorization"], "Bearer TOK_C13", "auth header");
});
t("saveBlueprintToLibrary wraps as {blueprint:...} (the sibling POST keeps its own key)", function () {
  calls.length = 0; nextResponse = okJson({});
  storageAdapter.saveBlueprintToLibrary({ nm: "BP" }, function () {});
  var c = lastCall(); if (!c) return "no fetch fired";
  if (c.url !== "https://unit.test/api/blueprints") return "url " + c.url;
  return eq(c.opts.body, JSON.stringify({ blueprint: { nm: "BP" } }), "body");
});
t("all wrappers ride _tFetch — abort signal armed on each request (the #24 timeout)", function () {
  calls.length = 0; nextResponse = okJson({});
  storageAdapter.listCharacterLibrary(function () {});
  storageAdapter.saveBlueprintToLibrary({ nm: "BP" }, function () {});
  storageAdapter.deleteCampaignFromServer("campX", function () {});
  if (calls.length !== 3) return "expected 3 captured requests, got " + calls.length;
  for (var k = 0; k < calls.length; k++) { if (!calls[k].opts.signal) return "request " + k + " (" + calls[k].url + ") has no abort signal — bypassed _tFetch"; }
  return true;
});

// ── #13 (a) error-string parity ──────────────────────────────────────────────
section("#13 _apiJson — error-string parity");

tAsync("cb(null, data) on 200", function () {
  nextResponse = okJson([{ name: "Ammut" }]);
  return new Promise(function (res) { storageAdapter.listCharacterLibrary(function (err, d) { res(err === null && d && d[0] && d[0].name === "Ammut" ? true : "err=" + err + " d=" + JSON.stringify(d)); }); });
});
tAsync("cb('HTTP 404') on a failed response (exact pre-#13 string)", function () {
  nextResponse = httpErr(404);
  return new Promise(function (res) { storageAdapter.deleteBlueprintFromLibrary("nope", function (err) { res(eq(err, "HTTP 404")); }); });
});
tAsync("deleteCampaignFromServer keeps its console.warn on failure + cb('HTTP 500')", function () {
  nextResponse = httpErr(500);
  var warned = null, origWarn = console.warn;
  console.warn = function () { warned = Array.prototype.slice.call(arguments); };
  return new Promise(function (res) {
    storageAdapter.deleteCampaignFromServer("campX", function (err) {
      console.warn = origWarn;
      if (err !== "HTTP 500") return res("err " + JSON.stringify(err));
      if (!warned) return res("console.warn not emitted");
      if (warned[0] !== "[storage] campaign delete failed:" || warned[1] !== "HTTP 500") return res("warn args " + JSON.stringify(warned));
      res(true);
    });
  });
});
tAsync("disconnected → cb('Not connected') synchronously, fetch untouched", function () {
  storageAdapter.setServer(null, null);
  calls.length = 0;
  var got = [];
  storageAdapter.listCharacterLibrary(function (e) { got.push(e); });
  storageAdapter.saveCharacterToLibrary({}, function (e) { got.push(e); });
  storageAdapter.deleteCharacterFromLibrary("x", function (e) { got.push(e); });
  if (calls.length) return "fetch fired while disconnected";
  return got.length === 3 && got.every(function (e) { return e === "Not connected"; }) ? true : "got " + JSON.stringify(got);
});
tAsync("deleteCampaignFromServer disconnected: cb('Not connected') WITHOUT the warn (pre-#13 parity)", function () {
  var warned = false, origWarn = console.warn;
  console.warn = function () { warned = true; };
  var got = null;
  storageAdapter.deleteCampaignFromServer("campX", function (e) { got = e; });
  console.warn = origWarn;
  if (got !== "Not connected") return "got " + JSON.stringify(got);
  return warned ? "warned on the not-connected path (pre-#13 code did not)" : true;
});

// ── #16 blankWizardState ─────────────────────────────────────────────────────
section("#16 blankWizardState");

t("returns the UNION shape — the once-divergent fields exist with their defaults", function () {
  var w = blankWizardState();
  if (!("mark" in w)) return "mark missing (was showChar-only)";
  if (w.mark !== "") return "mark default " + JSON.stringify(w.mark);
  if (!("portraitOffset" in w)) return "portraitOffset missing (was showChar-only)";
  return eq(w.portraitOffset, null, "portraitOffset default");
});
t("full field parity with the pre-#16 showChar literal (the superset copy)", function () {
  var w = blankWizardState();
  // The exact literal showChar() assigned before the factory (ui.js pre-#16):
  var want = { tone: null, author: "", name: "", gender: "M", age: "early twenties", appear: "", mark: "", backstory: "", ancestry: null, fp: [], subrace: null, heritageVariant: null, cls: null, statMode: "roll", bs: { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 }, rolled: false, deityEdited: false, portrait: null, portraitOffset: null, step: 1 };
  var r = eq(JSON.stringify(w), JSON.stringify(want), "shape");
  if (r !== true) return r;
  return eq(Object.keys(w).length, Object.keys(want).length, "key count");
});
t("fresh object each call — no shared reference, nested bs/fp fresh too", function () {
  var a = blankWizardState(), b = blankWizardState();
  if (a === b) return "same object returned twice";
  if (a.bs === b.bs) return "bs shared between calls";
  if (a.fp === b.fp) return "fp shared between calls";
  a.bs.STR = 18; a.fp.push("STR"); a.mark = "scar";
  var c = blankWizardState();
  if (c.bs.STR !== 8 || c.fp.length !== 0 || c.mark !== "") return "mutation leaked into a later blank state";
  return true;
});
t("boot-time cs comes from the factory (globals load) — carries mark + portraitOffset", function () {
  // cs was assigned at engine load (globals.js: var cs=blankWizardState()).
  if (!("mark" in cs)) return "boot cs lacks mark";
  if (!("portraitOffset" in cs)) return "boot cs lacks portraitOffset";
  return eq(cs.portraitOffset, null, "boot portraitOffset");
});
t("no duplicate cs literal survives — both sites assign from blankWizardState (source scan)", function () {
  var g = fs.readFileSync(path.join(root, "globals.js"), "utf8");
  // #54 split: showChar now lives in ui-shell.js; scan ALL ten ui-*.js so a re-introduced
  // inline cs literal anywhere in the ui layer trips this. (ui files aren't loaded headless.)
  var uiFiles = ["ui-shell.js","ui-panels.js","ui-portrait.js","ui-files.js","ui-sheets.js","ui-browsers.js","ui-campaigns.js","ui-carmode.js","ui-modals.js","ui-boot.js"];
  var litRe = /cs\s*=\s*\{tone/, factorySeen = false;
  for (var fi = 0; fi < uiFiles.length; fi++) {
    var src = fs.readFileSync(path.join(root, uiFiles[fi]), "utf8");
    if (litRe.test(src)) return uiFiles[fi] + " carries an inline cs literal";
    if (src.indexOf("cs=blankWizardState()") >= 0) factorySeen = true;
  }
  if (!factorySeen) return "showChar's cs=blankWizardState() call site not found in any ui-*.js";
  if ((g.match(/\{tone:null,author:""/g) || []).length !== 1) return "globals.js should carry exactly ONE blank-state literal (inside the factory)";
  return true;
});

// ── report ────────────────────────────────────────────────────────────────────
chain.then(function () {
  if (fails.length) {
    console.error("FRAGMENT C TESTS FAILED (" + fails.length + " of " + (pass + fails.length) + "):");
    for (var f = 0; f < fails.length; f++) console.error("  ✗ " + fails[f]);
    process.exit(1);
  }
  console.log("ALL GREEN — " + pass + " assertions passed (audit #13/#16 fragment)");
  process.exit(0);
});
