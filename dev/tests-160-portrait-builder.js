// tests-160-portrait-builder.js — TODO #160: the ONE shared portrait prompt-writer builder
// (buildPortraitPromptRequest, ui-portrait.js) that consolidated the three drifted copies:
//   ① wizard step 5 ftRenderPortrait (char-creation.js) — was a hand-thinned twin
//   ② portrait modal text-to-image (was buildCharDesc + inline promptReq)
//   ③ portrait modal img2img (was a shorter drifted style line)
// ui-portrait.js and char-creation.js are DOM-wiring files OUTSIDE the engine manifest, so
// this rides the standalone-suite lane (run-standalone-suites.js): the engine manifest is
// loaded for the builder's real dependencies (genderWord in helpers.js, ANCS in data.js,
// worldState in state.js for the decoy test), then ui-portrait.js is appended — its top
// level is declaration-only, same as the ui-browsers.js append in tests-dedup-a.js.
// char-creation.js is deliberately NOT evaluated (DOM at its call sites); its half of the
// consolidation is pinned by the source-contract section reading the file as text.
//
// Standalone battery — not loaded by run-tests.js or test.html. Run directly:
//   node dev/tests-160-portrait-builder.js
//
// Engine-tests style (section/t/eq, same reporter shape as dev/run-tests.js). ES5 throughout.

var fs = require("fs");
var path = require("path");
var root = path.join(__dirname, "..");
var files = require("./engine-manifest.js").map(function (entry) { return entry.file; });
files.push("ui-portrait.js");
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
function has(hay, needle, label) {
  if (hay.indexOf(needle) >= 0) return true;
  return (label || "missing") + ": " + JSON.stringify(needle) + " not found in " + JSON.stringify(hay.slice(0, 220)) + "…";
}
function lacks(hay, needle, label) {
  if (hay.indexOf(needle) < 0) return true;
  return (label || "forbidden") + ": " + JSON.stringify(needle) + " FOUND in output";
}

// Fixtures ────────────────────────────────────────────────────────────────────
// Modal-shaped: a finished sheet — display-name ancestry, full kit.
function fullChar() {
  return {
    name: "Ammut Kel", gender: "F", age: "34", ancestry: "Elf", cls: "Rogue",
    archetypeNm: "Arcane Trickster", appear: "scarred cheek, silver hair",
    mark: "raven tattoo on the neck", inventory: ["Leather armor", "Twin daggers"]
  };
}
// Wizard-shaped: step-5 `cs` — ANCS ID ancestry, no archetype/mark/inventory, empty age.
function sparseChar() {
  return { name: "Korrag", gender: "M", age: "", ancestry: "elf", cls: "Warrior", appear: "" };
}

// ── (a) full modal-shaped char: the rich description survives ────────────────
section("#160 › full char (modal shape)");

t("returns {promptReq, sys}", function () {
  var r = buildPortraitPromptRequest(fullChar(), {});
  if (typeof r !== "object" || !r) return "not an object";
  if (typeof r.promptReq !== "string" || !r.promptReq) return "promptReq missing";
  return eq(r.sys, "You are a portrait image prompt writer for a dark fantasy RPG. Output ONLY the image prompt. No narration, no game tags.", "sys");
});
t("archetype present (the wizard twin used to drop it)", function () {
  return has(buildPortraitPromptRequest(fullChar(), {}).promptReq, "[Arcane Trickster]");
});
t("mark present", function () {
  return has(buildPortraitPromptRequest(fullChar(), {}).promptReq, "raven tattoo on the neck");
});
t("inventory as Visible wardrobe/gear", function () {
  return has(buildPortraitPromptRequest(fullChar(), {}).promptReq, "Visible wardrobe/gear: Leather armor, Twin daggers");
});
t("information parity with the old modal t2i path (every element enumerated)", function () {
  var p = buildPortraitPromptRequest(fullChar(), { details: "wearing a hood" }).promptReq;
  var parts = [
    "Write a detailed image generation prompt for a fantasy character portrait. ",
    "Player overrides — apply these exactly and let them supersede any conflicting character description: wearing a hood. ",
    "Base character description (use where not overridden): ",
    "Ammut Kel", "female", "34", "Elf", "Rogue", "[Arcane Trickster]",
    "scarred cheek, silver hair", "raven tattoo on the neck",
    "Visible wardrobe/gear: Leather armor, Twin daggers",
    "Spell out hair, eyes, skin tone, clothing, and visible gear explicitly. ",
    "Style: dark fantasy portrait, upper body, detailed face, dramatic chiaroscuro lighting, painterly. 2-3 sentences. Output ONLY the prompt, no commentary, no tags."
  ];
  for (var j = 0; j < parts.length; j++) { var r = has(p, parts[j], "parity element " + j); if (r !== true) return r; }
  return true;
});
t("no details → no override clause (the wizard path has no details input)", function () {
  return lacks(buildPortraitPromptRequest(fullChar(), {}).promptReq, "Player overrides");
});

// ── (b) sparse wizard-shaped char: degrades with no empty-field artifacts ────
section("#160 › sparse char (wizard cs shape)");

t("ANCS id resolves to the display name", function () {
  var p = buildPortraitPromptRequest(sparseChar(), {}).promptReq;
  var r = has(p, "a male Elf Warrior"); if (r !== true) return r;
  return lacks(p, " elf ", "raw id leaked");
});
t("Half-Blood id resolves too (hyphenated display name)", function () {
  var c = sparseChar(); c.ancestry = "halfblood";
  return has(buildPortraitPromptRequest(c, {}).promptReq, "Half-Blood");
});
t("finished-sheet display name passes through untouched", function () {
  var c = sparseChar(); c.ancestry = "Hollow-Born";
  return has(buildPortraitPromptRequest(c, {}).promptReq, "Hollow-Born");
});
t("no 'undefined' in output", function () {
  return lacks(buildPortraitPromptRequest(sparseChar(), {}).promptReq, "undefined");
});
t("no double space (the old wizard's empty-age artifact: 'a male  Elf')", function () {
  return lacks(buildPortraitPromptRequest(sparseChar(), {}).promptReq, "  ");
});
t("no dangling comma artifacts", function () {
  var p = buildPortraitPromptRequest(sparseChar(), {}).promptReq;
  var r = lacks(p, ", ,"); if (r !== true) return r;
  r = lacks(p, ", ."); if (r !== true) return r;
  return lacks(p, ",,");
});
t("nameless in-progress char falls back to 'A character' (wizard behavior kept)", function () {
  var c = sparseChar(); c.name = "";
  return has(buildPortraitPromptRequest(c, {}).promptReq, "A character, a male Elf Warrior");
});
t("empty appear leaves no trace", function () {
  return has(buildPortraitPromptRequest(sparseChar(), {}).promptReq, "Korrag, a male Elf Warrior. Spell out");
});

// ── (c) img2img vs text-to-image instruction switch ──────────────────────────
section("#160 › img2img switch");

t("img2img:true → likeness-from-reference instruction", function () {
  var p = buildPortraitPromptRequest(fullChar(), { img2img: true }).promptReq;
  var r = has(p, "Write an image generation prompt to update a fantasy character portrait using a reference photo. "); if (r !== true) return r;
  r = has(p, "Maintain the person's likeness from the reference but render them as: "); if (r !== true) return r;
  return lacks(p, "Write a detailed image generation prompt", "t2i opener leaked into img2img");
});
t("img2img:false → from-scratch instruction, no likeness clause", function () {
  var p = buildPortraitPromptRequest(fullChar(), { img2img: false }).promptReq;
  var r = has(p, "Write a detailed image generation prompt for a fantasy character portrait. "); if (r !== true) return r;
  return lacks(p, "likeness", "img2img clause leaked into t2i");
});
t("img2img carries the details override clause too", function () {
  return has(buildPortraitPromptRequest(fullChar(), { img2img: true, details: "older, battle-worn" }).promptReq,
    "Player overrides — apply these exactly and let them supersede any conflicting character description: older, battle-worn. ");
});
t("BOTH paths carry the unified RICHER style line (the ③ drift is dead)", function () {
  var style = "Style: dark fantasy portrait, upper body, detailed face, dramatic chiaroscuro lighting, painterly.";
  var r = has(buildPortraitPromptRequest(fullChar(), { img2img: true }).promptReq, style, "img2img"); if (r !== true) return r;
  return has(buildPortraitPromptRequest(fullChar(), { img2img: false }).promptReq, style, "t2i");
});
t("the old shorter img2img style line is gone from output", function () {
  return lacks(buildPortraitPromptRequest(fullChar(), { img2img: true }).promptReq,
    "Dark fantasy painterly style, dramatic lighting, upper body portrait");
});

// ── (d) gender routing incl. the #11③ unset→androgynous divergence ───────────
section("#160 › gender (#11③)");

t("unset gender yields 'androgynous' (the preserved portrait-path divergence)", function () {
  var c = sparseChar(); delete c.gender;
  // "a androgynous" is the shipped article form (buildCharDesc wrote ", a "+gw verbatim) — parity kept.
  return has(buildPortraitPromptRequest(c, {}).promptReq, "a androgynous Elf Warrior");
});
t("empty-string gender yields 'androgynous' too", function () {
  var c = sparseChar(); c.gender = "";
  return has(buildPortraitPromptRequest(c, {}).promptReq, "androgynous");
});
t("F → female", function () {
  return has(buildPortraitPromptRequest(fullChar(), {}).promptReq, "a female");
});
t("NB → androgynous", function () {
  var c = fullChar(); c.gender = "NB";
  return has(buildPortraitPromptRequest(c, {}).promptReq, "a androgynous");
});

// ── (e) reads ONLY the char argument — never worldState.character ────────────
section("#160 › argument-only (companion seam)");

t("companion char wins over a decoy worldState.character", function () {
  var wsBefore = worldState; // headless worldState may still be null pre-loadState
  worldState = { character: { name: "DECOY McPlayer", gender: "M", ancestry: "Human", cls: "Warrior",
    appear: "decoy appearance", mark: "decoy mark", inventory: ["Decoy Sword"] } };
  var comp = { name: "Frizwick", gender: "F", ancestry: "Gnome", cls: "Sorcerer",
    appear: "wild copper curls", inventory: ["Patched robe"] };
  var p = buildPortraitPromptRequest(comp, { img2img: true }).promptReq;
  worldState = wsBefore;
  var r = has(p, "Frizwick"); if (r !== true) return r;
  r = has(p, "wild copper curls"); if (r !== true) return r;
  r = lacks(p, "DECOY", "player name leaked"); if (r !== true) return r;
  return lacks(p, "Decoy Sword", "player inventory leaked");
});

// ── Source contract: the duplicates are actually GONE from both files ────────
section("#160 › source contract (dedup pinned)");

var srcPortrait = fs.readFileSync(path.join(root, "ui-portrait.js"), "utf8");
var srcWizard = fs.readFileSync(path.join(root, "char-creation.js"), "utf8");
function count(hay, needle) {
  var n = 0, at = hay.indexOf(needle);
  while (at >= 0) { n++; at = hay.indexOf(needle, at + 1); }
  return n;
}

t("the Claude sys prompt exists exactly ONCE across both files (in the builder)", function () {
  var lit = "You are a portrait image prompt writer";
  if (count(srcWizard, lit) !== 0) return "char-creation.js still carries its copy";
  return eq(count(srcPortrait, lit), 1, "ui-portrait.js occurrences");
});
t("char-creation.js no longer hand-builds the prompt", function () {
  var r = lacks(srcWizard, "Write a detailed image generation prompt", "wizard prompt copy"); if (r !== true) return r;
  return lacks(srcWizard, "Style: dark fantasy portrait", "wizard style-line copy");
});
t("ftRenderPortrait routes through buildPortraitPromptRequest", function () {
  return srcWizard.indexOf("buildPortraitPromptRequest(") >= 0 ? true : "no call in char-creation.js";
});
t("the t2i opener exists exactly once in ui-portrait.js (the builder, not runGenerate)", function () {
  return eq(count(srcPortrait, "Write a detailed image generation prompt"), 1);
});
t("the drifted shorter img2img style line is gone from the sources", function () {
  var r = lacks(srcPortrait, "Dark fantasy painterly style, dramatic lighting"); if (r !== true) return r;
  return lacks(srcWizard, "Dark fantasy painterly style, dramatic lighting");
});
t("buildCharDesc (the modal-local twin) is deleted", function () {
  return lacks(srcPortrait, "function buildCharDesc", "twin survived");
});

// ── Report ───────────────────────────────────────────────────────────────────
console.log("");
if (fails.length) {
  console.log("FAIL — " + pass + " passed, " + fails.length + " failed:");
  for (var f = 0; f < fails.length; f++) console.log("  ✗ " + fails[f]);
  process.exit(1);
} else {
  console.log("ALL GREEN — " + pass + " tests passed (#160 portrait-builder fragment).");
}
