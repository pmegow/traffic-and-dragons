// _tests_dedupA.js — TODO #54 companion dedup pass, lane A (UA21 ① ② + AUDIT_FABLE_07_16 #15 ② ③):
// tests for the PURE pieces of the lane-A consolidations —
//   • csInitials (moved verbatim ui-sheets.js → helpers.js; now THE initials derivation for
//     all 5 former inline copies, incl. the ui-browsers import-preview copy that lacked the
//     w[0] guard — the sanctioned fix)
//   • loadCampaignCharacter (ui-browsers.js; the ONE campaign-character loader that replaced
//     showCharacterBrowser's getCharFromCampaign and showCompanionBrowser's inner getChar) —
//     local fallback chain + key-string construction + caller-parameterized error strings.
//     The server leg rides storageAdapter.getCampaignState, already battery-tested in
//     dev/tests-b9-transport.js — not re-tested here.
// The DOM-side consolidations (cbrSegControl/cbrSegBtnStd/cbrSegBtnWide, generatePortraitImage)
// are coordinator-smoked in the browser — deliberately NOT fake-tested headlessly.
//
// Standalone battery — not loaded by run-tests.js or test.html. Run directly:
//   node dev/tests-dedup-a.js
//
// Engine-tests style (section/t/eq, same reporter shape as dev/run-tests.js). ES5 throughout.

var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
// The manifest is the engine load-order authority. ui-browsers.js is the suite-specific append:
// its top level is function declarations only, and the local paths under test never touch DOM.
var files = require("./engine-manifest.js").map(function (entry) { return entry.file; });
files.push("ui-browsers.js");
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

// ── csInitials (#15③ — canonical copy, now in helpers.js) ────────────────────
section("dedupA › csInitials");

t("lives in helpers.js scope (moved, not duplicated)", function () {
  return eq(typeof csInitials, "function");
});
t("normal two-word name", function () { return eq(csInitials("Morwen Nightbriar"), "MN"); });
t("single word takes first two letters? no — first initial only", function () {
  // Single word ⇒ one initial (split on space yields one token; slice(0,2) caps at 2 chars).
  return eq(csInitials("Ammut"), "A");
});
t("three-word name caps at two initials", function () { return eq(csInitials("Sheriff Belor Hemlock"), "SB"); });
t("lowercase input uppercased", function () { return eq(csInitials("morwen nightbriar"), "MN"); });
t("double-space name — THE former import-preview bug class (no 'undefined', no empty)", function () {
  return eq(csInitials("Ammut  Kel"), "AK");
});
t("empty string falls back to ?", function () { return eq(csInitials(""), "?"); });
t("undefined falls back to ?", function () { return eq(csInitials(undefined), "?"); });
t("whitespace-only name falls back to ? (canonical; the guard-less copies returned '')", function () {
  return eq(csInitials(" "), "?");
});

// ── loadCampaignCharacter (#15② — local chain; server leg is B9-tested) ──────
section("dedupA › loadCampaignCharacter");

var MSGS_CHAR = { offline: "Not available locally and not connected to server.", missing: "No character data on server." };
var MSGS_COMP = { offline: "Not available locally.", missing: "No character data." };

// store wraps localStorage with the in-memory _m fallback — headless node uses _m, so tests
// can seed campaign snapshots directly. Synchronous for every local path ⇒ sync asserts.
function callSync(id, msgs) {
  var out = { called: false, err: null, ch: null };
  loadCampaignCharacter(id, function (err, ch) { out.called = true; out.err = err; out.ch = ch || null; }, msgs);
  return out;
}

t("snapshot key construction: reads tnd_camp_<id>_ws", function () {
  store.set("tnd_camp_CAMP1_ws", JSON.stringify({ character: { name: "Snapshot Sara" } }));
  var r = callSync("CAMP1", MSGS_CHAR);
  if (!r.called) return "cb never fired";
  if (r.err) return "unexpected err " + JSON.stringify(r.err);
  return eq(r.ch && r.ch.name, "Snapshot Sara");
});
t("active campaign prefers live WSK state over its snapshot", function () {
  setActiveCampId("CAMP1");
  store.set(WSK, JSON.stringify({ character: { name: "Live Lena" } }));
  var r = callSync("CAMP1", MSGS_CHAR);
  setActiveCampId(null); store.del(WSK); // clean up before later tests
  if (r.err) return "unexpected err " + JSON.stringify(r.err);
  return eq(r.ch && r.ch.name, "Live Lena");
});
t("non-active campaign ignores live WSK (snapshot wins)", function () {
  setActiveCampId("OTHER");
  store.set(WSK, JSON.stringify({ character: { name: "Live Lena" } }));
  var r = callSync("CAMP1", MSGS_CHAR);
  setActiveCampId(null); store.del(WSK);
  return eq(r.ch && r.ch.name, "Snapshot Sara");
});
t("offline + nothing local → caller's offline string (character browser wording)", function () {
  var r = callSync("NOPE", MSGS_CHAR);
  return eq(r.err, MSGS_CHAR.offline);
});
t("offline + nothing local → caller's offline string (companion browser wording)", function () {
  var r = callSync("NOPE", MSGS_COMP);
  return eq(r.err, MSGS_COMP.offline);
});
t("malformed snapshot JSON falls through the chain (to offline here), never throws", function () {
  store.set("tnd_camp_BAD_ws", "{not json");
  var r = callSync("BAD", MSGS_COMP);
  store.del("tnd_camp_BAD_ws");
  return eq(r.err, MSGS_COMP.offline);
});
t("snapshot without a character field falls through (not a false hit)", function () {
  store.set("tnd_camp_NOCHAR_ws", JSON.stringify({ world: {} }));
  var r = callSync("NOCHAR", MSGS_CHAR);
  store.del("tnd_camp_NOCHAR_ws");
  return eq(r.err, MSGS_CHAR.offline);
});

// ── Report ───────────────────────────────────────────────────────────────────
console.log("");
if (fails.length) {
  console.log("FAIL — " + pass + " passed, " + fails.length + " failed:");
  for (var f = 0; f < fails.length; f++) console.log("  ✗ " + fails[f]);
  process.exit(1);
} else {
  console.log("ALL GREEN — " + pass + " tests passed (dedupA fragment).");
}
