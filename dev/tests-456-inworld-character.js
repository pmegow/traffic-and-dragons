// tests-456-inworld-character.js — #456 (owner 2026-09-25): the character sheet offers an Inworld voice slot beside the
// Speechify and Piper ones, and ONE delivery direction per character that rides Inworld's per-request instruction.
// The real csVoiceControlHtml / csWireVoice run against a recording DOM stub (the tests-453 pattern). DEV TOOL,
// node-only, registered in dev/run-standalone-suites.js.
//   node dev/tests-456-inworld-character.js

var fs = require("fs"), path = require("path"), assert = require("assert"), loader = require("./load-engine.js");
var ROOT = path.join(__dirname, "..");

loader.loadEngine();
loader.makeTestWorld({ kind: "adventure" });

var __els = {}, __saves = 0, __toasts = [];
function el(id) {
  if (__els[id]) return __els[id];
  var e = { id: id, style: {}, innerHTML: "", textContent: "", className: "", value: "", selectedIndex: 0, options: [{ textContent: "Chosen actor" }], _h: {},
    classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
    appendChild: function () {}, remove: function () {}, setAttribute: function () {}, getAttribute: function () { return null; },
    querySelector: function () { return null; }, querySelectorAll: function () { return []; }, focus: function () {}, isConnected: true,
    addEventListener: function (ev, fn) { (e._h[ev] = e._h[ev] || []).push(fn); } };
  __els[id] = e; return e;
}
global.window = global;
global.navigator = { userAgent: "node" };
global.document = { getElementById: function (id) { return el(id); }, querySelector: function () { return null; },
  querySelectorAll: function () { return []; }, createElement: function () { return el("_anon" + Math.random()); },
  body: { appendChild: function () {}, classList: { add: function () {}, remove: function () {}, toggle: function () {} } }, activeElement: null };

var geval = eval;
["ui-shell.js", "ui-panels.js", "ui-sheets.js"].forEach(function (f) { geval(fs.readFileSync(path.join(ROOT, f), "utf8")); });
showToast = function (m) { __toasts.push(String(m)); }; saveAll = function () { __saves++; }; saveCore = function () {}; saveMem = function () {};

function fresh() { __els = {}; __saves = 0; __toasts.length = 0; }
function fire(id, ev, value) { var e = el(id); e.value = value; (e._h[ev] || []).forEach(function (fn) { fn({ target: e }); }); }

var failed = 0;
function test(name, fn) {
  try { fn(); console.log("PASS #456 " + name); }
  catch (e) { failed++; console.error("FAIL #456 " + name + " — " + (e && e.message)); }
}

test("the sheet renders three voice slots — Speechify, Inworld, Piper backup — and one delivery direction, the saved text escaped", function () {
  fresh();
  var h = csVoiceControlHtml({ name: "Ash Yarwick", gender: "M", voiceDirection: "low & <slow>" });
  ["cs-primary-voice-sel", "cs-inworld-voice-sel", "cs-voice-sel", "cs-voice-direction"].forEach(function (id) { assert.ok(h.indexOf("id='" + id + "'") >= 0, "missing control " + id); });
  assert.ok(h.indexOf("Speechify voice") >= 0 && h.indexOf("Inworld voice") >= 0, "slot labels: " + h.slice(0, 200));
  assert.ok(h.indexOf("low &amp; &lt;slow&gt;") >= 0, "the saved direction is not rendered escaped");
  assert.ok(h.indexOf("low & <slow>") < 0, "the saved direction reached the markup raw");
});

test("choosing an Inworld voice saves inworldVoiceId on the character at once; clearing it deletes the field", function () {
  fresh(); var c = { name: "Ash Yarwick", gender: "M" };
  csWireVoice(c);
  fire("cs-inworld-voice-sel", "change", "iw_x");
  assert.equal(c.inworldVoiceId, "iw_x", "the Inworld pin did not land");
  assert.equal(__saves, 1, "the pin was not saved");
  fire("cs-inworld-voice-sel", "change", "");
  assert.ok(!("inworldVoiceId" in c), "clearing the pin must delete the field");
});

test("the delivery direction saves trimmed on change, clears when emptied, and toasts either way", function () {
  fresh(); var c = { name: "Mother Vane", gender: "F" };
  csWireVoice(c);
  fire("cs-voice-direction", "change", "  gruff and unhurried  ");
  assert.equal(c.voiceDirection, "gruff and unhurried");
  assert.equal(__saves, 1, "the direction was not saved");
  assert.ok(__toasts.some(function (m) { return /direction saved/i.test(m); }), "no save toast: " + JSON.stringify(__toasts));
  fire("cs-voice-direction", "change", "   ");
  assert.ok(!("voiceDirection" in c), "an emptied direction must delete the field");
  assert.ok(__toasts.some(function (m) { return /direction cleared/i.test(m); }), "no clear toast");
});

test("source: the sheet no longer names providers in a literal options map — the slot registry decides", function () {
  var s = fs.readFileSync(path.join(ROOT, "ui-sheets.js"), "utf8");
  assert.ok(s.indexOf("{speechify:csPrimaryVoiceOptions,piper:csBackupVoiceOptions}") < 0, "the provider-literal options map is still there");
});

if (failed) { console.error("#456 inworld character: " + failed + " FAILED"); process.exit(1); }
console.log("ALL GREEN — #456 inworld character (4 groups)");
