// tests-481-f11-start-refused.js — #481 F11 (audit 2026-09-29, Fable-approved): "Start" ignored a refused campaign creation.
// With storage full, homeHandoffChoose("start") called campNew — which refused (the current campaign could not be
// snapshotted) — and then consumed the Home pick anyway: "Blueprint loaded", the old campaign still on screen, and the pick
// gone from storage. The quick start consumed its payload BEFORE its own busy / storage guards, so a refusal lost the pick too.
// Now campNew returns whether it reset, the chooser checks it before the payload is touched, and the quick start's transient
// guards run before it consumes. Real ui-campaigns.js + ui-browsers.js over the engine, with DOM and localStorage fakes.
//   node dev/tests-481-f11-start-refused.js
var fs = require("fs"), path = require("path"), loader = require("./load-engine.js");
var ROOT = path.join(__dirname, "..");
loader.loadEngine(); loader.makeTestWorld(); worldState.campName = "The campaign on screen";
var mem = {};
global.localStorage = { getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; } };
function stubEl() { return { appendChild: function () {}, style: {}, remove: function () {}, textContent: "", innerHTML: "", className: "", value: "",
  classList: { add: function () {}, remove: function () {}, toggle: function () {} }, addEventListener: function () {}, setAttribute: function () {}, focus: function () {},
  querySelector: function () { return null; }, querySelectorAll: function () { return []; } }; }
global.window = global; global.navigator = { userAgent: "node" };
global.document = { getElementById: function () { return stubEl(); }, querySelector: function () { return null; }, querySelectorAll: function () { return []; },
  createElement: function () { return stubEl(); }, body: stubEl(), addEventListener: function () {} };
var geval = eval;
["ui-shell.js", "ui-campaigns.js", "ui-browsers.js"].forEach(function (f) { geval(fs.readFileSync(path.join(ROOT, f), "utf8")); });
var toasts = [], started = [];
showToast = function (m) { toasts.push(String(m)); };
showChar = function () {}; goStep = function () {};
startGame = function (c) { started.push(c && c.name); };
var realSnapshot = snapshotActiveCamp, full = false;
snapshotActiveCamp = function () { if (full) { showToast("⚠ Storage full — the current campaign could not be saved"); return false; } return true; };
var BP = JSON.parse(fs.readFileSync(path.join(ROOT, "samples/the_iron_meridian.blueprint"), "utf8"));   /* a real, valid curated blueprint */
if (validateBlueprint(BP)) throw new Error("fixture: the sample blueprint must validate — " + validateBlueprint(BP));
function fresh() { mem = {}; toasts.length = 0; started.length = 0; busy = false; full = false; }
var failed = 0, passed = 0;
function test(name, fn) { try { var r = fn(); if (r === true || r === undefined) { passed++; console.log("PASS #481 F11 " + name); } else { failed++; console.error("FAIL #481 F11 " + name + " — " + r); } } catch (e) { failed++; console.error("FAIL #481 F11 " + name + " — threw " + (e && e.stack || e)); } }

test("the repro: Start with a blueprint while storage is full keeps the campaign on screen AND the pick", function () {
  fresh(); full = true; var ws = worldState;
  mem[HOME_PENDING_BP_K] = JSON.stringify({ bp: BP, at: Date.now() });
  var r = homeHandoffChoose("start");
  if (r !== "failed") return "the chooser reported " + r + " for a refused reset";
  if (!mem[HOME_PENDING_BP_K]) return "the Home pick was consumed although nothing started";
  if (toasts.some(function (t) { return /Blueprint loaded/.test(t); })) return "it said the blueprint loaded: " + JSON.stringify(toasts);
  return worldState === ws ? true : "the campaign on screen was replaced";
});
test("campNew says whether it reset: false when refused (a turn in flight, storage full), true when it did", function () {
  fresh(); busy = true; if (campNew() !== false) return "a busy refusal must return false";
  fresh(); full = true; if (campNew() !== false) return "a storage refusal must return false";
  fresh(); var ok = campNew(); loader.makeTestWorld(); worldState.campName = "The campaign on screen";
  return ok === true ? true : "a reset must return true, got " + ok;
});
test("a quick start refused by a turn in flight or full storage keeps its payload for the next try", function () {
  fresh(); busy = true; var hero = JSON.parse(fs.readFileSync(path.join(ROOT, "samples/characters/maud_ashcombe.char"), "utf8")).character;   /* a real pre-made hero */
  var qs = JSON.stringify({ char: hero, bp: BP, at: Date.now() });
  if (quickStartPayloadValid(JSON.parse(qs))) return "fixture: the payload must be valid — " + quickStartPayloadValid(JSON.parse(qs));
  mem[HOME_PENDING_QS_K] = qs;
  if (consumeHomeQuickStart() !== false) return "a busy quick start must refuse";
  if (mem[HOME_PENDING_QS_K] !== qs) return "a turn in flight consumed the quick start";
  busy = false; full = true;
  if (consumeHomeQuickStart() !== false) return "a storage refusal must refuse";
  if (mem[HOME_PENDING_QS_K] !== qs) return "full storage consumed the quick start";
  return started.length ? "something started: " + started.join(",") : true;
});
test("a malformed quick start is still dropped, loudly", function () {
  fresh(); mem[HOME_PENDING_QS_K] = JSON.stringify({ char: null, bp: BP, at: Date.now() });
  if (consumeHomeQuickStart() !== false) return "a malformed payload must refuse";
  if (mem[HOME_PENDING_QS_K]) return "a malformed payload must be consumed (it can never start)";
  return toasts.some(function (t) { return /Quick start could not begin/.test(t); }) ? true : "the drop was silent: " + JSON.stringify(toasts);
});
snapshotActiveCamp = realSnapshot;
console.log("#481 F11 START REFUSED: " + failed + " failed, " + passed + " passed");
process.exit(failed ? 1 : 0);
