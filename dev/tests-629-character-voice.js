// tests-629-character-voice.js — #629 (owner 2026-10-13): the character voice control is ONE module, ui-character-voice.js
// (CharacterVoice.html / .wire / .fields), hosted by the character sheet (id prefix "cs-", saves at once) and by the
// wizard's Finishing Touches page (id prefix "ft-", writes the draft; confirmChar carries the fields onto the sheet).
// The real module, ui-sheets.js adapters and char-creation.js run against a recording DOM stub (the tests-456 pattern).
// DEV TOOL, node-only, registered in dev/run-standalone-suites.js.
//   node dev/tests-629-character-voice.js

var fs = require("fs"), path = require("path"), assert = require("assert"), loader = require("./load-engine.js");
var ROOT = path.join(__dirname, "..");

loader.loadEngine();
loader.makeTestWorld({ kind: "adventure" });
/* Inworld as the primary: both per-character rows (direction, speed) render, so every id the control owns is on the page */
store.set("tnd_voice_settings_v1", JSON.stringify({ primary: "inworld" }));

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
["ui-shell.js", "ui-panels.js", "ui-sheets.js", "ui-character-voice.js", "char-creation.js"].forEach(function (f) { geval(fs.readFileSync(path.join(ROOT, f), "utf8")); });
showToast = function (m) { __toasts.push(String(m)); }; saveAll = function () { __saves++; }; saveCore = function () {}; saveMem = function () {};

function fresh() { __els = {}; __saves = 0; __toasts.length = 0; }
function fire(id, ev, value) { var e = el(id); e.value = value; (e._h[ev] || []).forEach(function (fn) { fn({ target: e }); }); }
function idsIn(html) { var out = [], re = /id='([^']+)'/g, m; while ((m = re.exec(html))) out.push(m[1]); return out; }

var failed = 0;
function test(name, fn) {
  try { fn(); console.log("PASS #629 " + name); }
  catch (e) { failed++; console.error("FAIL #629 " + name + " — " + (e && e.message)); }
}

test("one control, two hosts: the wizard prefix puts every id under ft-, the sheet adapter renders the historical cs- ids, and the two renders share no id", function () {
  fresh();
  var c = { name: "Ash Yarwick", gender: "M", voiceDirection: "low", voiceRate: 1.15 };
  var wiz = CharacterVoice.html(c, { prefix: "ft-" }), sheet = csVoiceControlHtml(c);
  assert.ok(wiz.length > 200, "the wizard render is empty");
  ["ft-primary-voice-sel", "ft-inworld-voice-sel", "ft-voice-sel", "ft-primary-voice-test", "ft-inworld-voice-test", "ft-voice-test", "ft-voice-direction", "ft-voice-rate", "ft-voice-rate-value", "ft-voice-rate-reset"]
    .forEach(function (id) { assert.ok(wiz.indexOf("id='" + id + "'") >= 0, "the wizard render lacks " + id); });
  assert.ok(idsIn(wiz).every(function (id) { return id.indexOf("ft-") === 0; }), "an id outside the ft- prefix in the wizard render: " + idsIn(wiz).join(","));
  assert.equal(sheet, CharacterVoice.html(c, { prefix: "cs-" }), "the sheet adapter is not the module's render under cs-");
  ["cs-primary-voice-sel", "cs-inworld-voice-sel", "cs-voice-sel", "cs-voice-direction", "cs-voice-rate"].forEach(function (id) { assert.ok(sheet.indexOf("id='" + id + "'") >= 0, "the sheet lost its historical id " + id); });
  var w = idsIn(wiz), s = idsIn(sheet);
  assert.ok(w.length === s.length && w.every(function (id) { return s.indexOf(id) < 0; }), "the two hosts' ids must be disjoint and parallel: " + w.join(",") + " vs " + s.join(","));
  assert.ok(wiz.indexOf("Speechify voice") >= 0 && wiz.indexOf("Inworld voice") >= 0 && wiz.indexOf("Backup voice") >= 0, "the wizard does not offer the registry's three slots");
});

test("the wizard host writes the draft and never saves; the host hook reports every write; the sheet host saves through that hook", function () {
  fresh(); var d = { name: "Ash Yarwick", gender: "M" }, seen = [];
  CharacterVoice.wire(d, { prefix: "ft-", onChange: function (field, value, who) { seen.push([field, value, who === d]); } });
  fire("ft-inworld-voice-sel", "change", "iw_x");
  assert.equal(d.inworldVoiceId, "iw_x", "the Inworld pin did not land on the draft");
  fire("ft-voice-rate", "change", "1.2");
  assert.equal(d.voiceRate, 1.2, "the speed did not land on the draft");
  fire("ft-voice-direction", "change", "  gruff  ");
  assert.equal(d.voiceDirection, "gruff", "the direction did not land trimmed");
  fire("ft-voice-rate-reset", "click", "");
  assert.ok(!("voiceRate" in d), "the × must delete the draft's speed");
  fire("ft-inworld-voice-sel", "change", "");
  assert.ok(!("inworldVoiceId" in d), "clearing the pin must delete the field");
  assert.equal(__saves, 0, "the wizard host must never save — the draft is confirmed later");
  assert.deepEqual(seen, [["inworldVoiceId", "iw_x", true], ["voiceRate", 1.2, true], ["voiceDirection", "gruff", true], ["voiceRate", null, true], ["inworldVoiceId", "", true]], "the host hook saw: " + JSON.stringify(seen));
  var c = { name: "Mother Vane", gender: "F" };
  csWireVoice(c);
  fire("cs-inworld-voice-sel", "change", "iw_y");
  assert.equal(c.inworldVoiceId, "iw_y");
  assert.equal(__saves, 1, "the sheet host saves at once through the hook");
  assert.ok(!("inworldVoiceId" in d) && d.name === "Ash Yarwick", "a sheet write must not touch the wizard draft");
});

test("fields(): the registry's slot fields plus direction and speed — never a hand list; a blank wizard draft carries none of them", function () {
  var f = CharacterVoice.fields(), reg = TTS.characterVoiceSlots().map(function (s) { return s.field; });
  assert.deepEqual(f, reg.concat(["voiceDirection", "voiceRate"]), "fields(): " + JSON.stringify(f));
  ["speechifyVoiceId", "inworldVoiceId", "voiceId", "voiceDirection", "voiceRate"].forEach(function (k) { assert.ok(f.indexOf(k) >= 0, "fields() lacks " + k); });
  var blank = blankWizardState();
  f.forEach(function (k) { assert.ok(!(k in blank), "a blank draft must not carry " + k + " (absent = Automatic)"); });
});

test("the carry: confirmChar takes exactly the control's set values from the draft onto the sheet — empty and null stay off, other draft fields stay behind", function () {
  var out = wizardVoiceCarry({ speechifyVoiceId: "a", inworldVoiceId: "", voiceId: null, voiceDirection: "", voiceRate: 1.2, trait: "reckless", name: "Ash" }, {});
  assert.deepEqual(out, { speechifyVoiceId: "a", voiceRate: 1.2 }, "carried: " + JSON.stringify(out));
  var src = fs.readFileSync(path.join(ROOT, "char-creation.js"), "utf8"), lit = src.indexOf("var char={name:cs.name"), carry = src.indexOf("wizardVoiceCarry(cs,char);"), xp = src.indexOf("char.xp=startXp;");
  assert.ok(lit > 0 && carry > lit && xp > carry, "confirmChar must carry the voices right after the sheet literal, before anything reads the sheet (literal " + lit + ", carry " + carry + ", xp " + xp + ")");
});

test("the Finishing Touches page renders the control into its box under the wizard prefix, wires it to the draft, and hides the box when there is no control", function () {
  fresh(); cs = blankWizardState(); cs.gender = "F";
  buildFinishingTouches();
  var box = el("ft-voice"), wrap = el("ft-voice-box");
  assert.ok(box.innerHTML.indexOf("id='ft-inworld-voice-sel'") >= 0 && box.innerHTML.indexOf("id='ft-voice-sel'") >= 0, "the box does not hold the control under ft-: " + box.innerHTML.slice(0, 160));
  assert.ok(idsIn(box.innerHTML).every(function (id) { return id.indexOf("ft-") === 0; }), "a sheet id leaked into the wizard page: " + idsIn(box.innerHTML).join(","));
  assert.equal(wrap.style.display, "", "the box must show when the control rendered");
  fire("ft-voice-sel", "change", "en_GB-alba-medium");
  assert.equal(cs.voiceId, "en_GB-alba-medium", "the page's control is not wired to the draft");
  assert.equal(__saves, 0, "the wizard never saves");
  var realTTS = TTS; TTS = undefined;
  try { fresh(); buildFinishingTouches(); assert.equal(el("ft-voice").innerHTML, "", "no control, nothing rendered"); assert.equal(el("ft-voice-box").style.display, "none", "no control, the box hides"); }
  finally { TTS = realTTS; }
});

test("source: a new wizard clears Trait, Flaw and Motivation with the other persona boxes (ft-next reads the boxes — the last character's lines rode into the next one)", function () {
  var s = fs.readFileSync(path.join(ROOT, "ui-shell.js"), "utf8"), fn = s.slice(s.indexOf("function showChar(){"), s.indexOf("\nfunction ", s.indexOf("function showChar(){") + 10));
  var m = /\[("[^\]]+)\]\.forEach\(function\(id\)\{var el=document\.getElementById\(id\);if\(el\)el\.value="";\}\);/.exec(fn);
  assert.ok(m, "the reset list is gone from showChar");
  ["char-trait", "char-flaw", "char-motivation", "char-appear", "char-backstory"].forEach(function (id) { assert.ok(m[1].indexOf('"' + id + '"') >= 0, "the reset list lacks " + id + ": " + m[1]); });
});

test("the registry's keys reproduce the sheet's historical ids under the default prefix", function () {
  var want = { speechifyVoiceId: "cs-primary-voice-sel", inworldVoiceId: "cs-inworld-voice-sel", voiceId: "cs-voice-sel" };
  TTS.characterVoiceSlots().forEach(function (slot) {
    assert.ok(typeof slot.key === "string" && slot.key, "slot " + slot.field + " has no key");
    var id = CharacterVoice.ids(slot);
    assert.equal(id.select, want[slot.field], "slot " + slot.field + " select id");
    assert.equal(id.test, want[slot.field].replace(/-sel$/, "-test"), "slot " + slot.field + " test id");
  });
});

if (failed) { console.error("#629 character voice: " + failed + " FAILED"); process.exit(1); }
console.log("ALL GREEN — #629 character voice (7 groups)");
