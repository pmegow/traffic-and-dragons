// tests-481-f10-signed-out.js — #481 F10 (audit 2026-09-29, Fable-approved), the village half: a signed-out device entering a
// village campaign skipped its refresh from the character library with only a console line, so the residents silently
// stayed at whatever the save held. Now ONE toast per page load says so. The real villageRefreshOnEntry (ui-browsers.js)
// runs over the real engine with DOM stubs. (The editor half — the signed-out hint — is dev/tests-481-f10-editor-browser.js.)
//   node dev/tests-481-f10-signed-out.js
var fs = require("fs"), path = require("path"), assert = require("assert"), loader = require("./load-engine.js");
var ROOT = path.join(__dirname, "..");
loader.loadEngine();
loader.makeTestWorld({ kind: "village" });
function stubEl() { return { appendChild: function () {}, style: {}, remove: function () {}, textContent: "", innerHTML: "", className: "", value: "",
  classList: { add: function () {}, remove: function () {}, toggle: function () {} }, addEventListener: function () {}, setAttribute: function () {},
  querySelector: function () { return null; }, querySelectorAll: function () { return []; } }; }
global.window = global; global.navigator = { userAgent: "node" };
global.document = { getElementById: function () { return stubEl(); }, querySelector: function () { return null; }, querySelectorAll: function () { return []; },
  createElement: function () { return stubEl(); }, body: stubEl(), addEventListener: function () {} };
var geval = eval;
["ui-shell.js", "ui-browsers.js"].forEach(function (f) { geval(fs.readFileSync(path.join(ROOT, f), "utf8")); });
var toasts = [], infos = [];
showToast = function (m) { toasts.push(String(m)); };
var failed = 0, passed = 0;
function test(name, fn) { try { fn(); passed++; console.log("PASS #481 F10 " + name); } catch (e) { failed++; console.error("FAIL #481 F10 " + name + " — " + (e && e.message)); } }

test("the repro: signed out, entering the village says once per load that the library refresh was skipped", function () {
  assert.ok(kindDef().populateFromLibrary, "fixture: the village populates from the library");
  var ci = console.info; console.info = function (m) { infos.push(String(m)); };
  var sa = storageAdapter.isServerMode; storageAdapter.isServerMode = function () { return false; };
  try { villageRefreshOnEntry(); villageRefreshOnEntry(); }
  finally { console.info = ci; storageAdapter.isServerMode = sa; }
  var said = toasts.filter(function (t) { return /signed out/i.test(t) && /not refreshed/i.test(t); });
  assert.equal(said.length, 1, "expected ONE signed-out toast for two entries, got " + JSON.stringify(toasts));
  assert.ok(infos.some(function (m) { return /skipped — not signed in/.test(m); }), "the console line stays");
});
test("a non-village kind says nothing (it never refreshes from the library)", function () {
  toasts.length = 0; delete worldState.kind;
  var sa = storageAdapter.isServerMode; storageAdapter.isServerMode = function () { return false; };
  try { villageRefreshOnEntry(); } finally { storageAdapter.isServerMode = sa; worldState.kind = "village"; }
  assert.equal(toasts.length, 0, "an adventure toasted about a village refresh: " + JSON.stringify(toasts));
});
console.log("#481 F10 SIGNED OUT: " + failed + " failed, " + passed + " passed");
process.exit(failed ? 1 : 0);
