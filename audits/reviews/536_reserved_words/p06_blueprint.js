// REVIEW PROBE p06: the blueprint and skeleton door. argv: <tree>
var L = require("./lib.js"), fs = require("fs"), path = require("path");
var TREE = process.argv[2], MAIN = "C:/Projects/traffic-and-dragons";
function walkDir(dir, exts, out, depth) { if (depth > 6) return out; var es; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; } es.forEach(function (e) { var p = path.join(dir, e.name); if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== ".git") walkDir(p, exts, out, depth + 1); } else if (exts.some(function (x) { return e.name.toLowerCase().slice(-x.length) === x; })) out.push(p); }); return out; }
console.log("tree: " + L.TREE);
// ---- 1. every real blueprint: does validation still accept it?
var files = walkDir(TREE + "/samples", [".blueprint"], [], 0).concat(walkDir(TREE + "/dev/fixtures", [".blueprint"], [], 0), walkDir(MAIN + "/Campaigns", [".blueprint"], [], 0), walkDir(MAIN + "/testRuns", [".blueprint"], [], 0));
var verdicts = [];
files.forEach(function (f) {
  var bp; try { bp = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { verdicts.push(path.basename(f) + ": unreadable"); return; }
  var raw = "", norm = "";
  try { raw = validateBlueprint(JSON.parse(JSON.stringify(bp))) || "ok"; } catch (e1) { raw = "THREW " + e1.message; }
  try { norm = validateBlueprint(normalizeBlueprint(JSON.parse(JSON.stringify(bp)))) || "ok"; } catch (e2) { norm = "THREW " + e2.message; }
  verdicts.push(path.basename(f) + ": as-is=" + raw.slice(0, 70) + " | normalised=" + norm.slice(0, 70));
});
// catalog entries
try { var cat = JSON.parse(fs.readFileSync(TREE + "/samples/catalog.json", "utf8")); (Array.isArray(cat) ? cat : (cat.campaigns || cat.entries || [])).forEach(function (c, i) { if (c && c.blueprint && typeof c.blueprint === "object") { var v = validateBlueprint(normalizeBlueprint(JSON.parse(JSON.stringify(c.blueprint)))) || "ok"; verdicts.push("catalog[" + i + "] " + (c.name || c.id) + ": " + v.slice(0, 70)); } }); } catch (e3) { verdicts.push("catalog.json: " + e3.message.slice(0, 60)); }
console.log("--- 1. real blueprint files (" + files.length + ")"); verdicts.forEach(function (v) { console.log("   " + v); });
// saved skeletons in the owner's saves
var saves = walkDir(MAIN + "/Campaigns", [".tnd"], [], 0), sk = 0, skBad = [];
saves.forEach(function (f) { var s; try { s = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return; } var ws = s.worldState || {}; if (ws.skeleton) { sk++; var r = (typeof reservedWordIn === "function") ? reservedWordIn(ws.skeleton, "") : null; if (r) skBad.push(path.basename(f) + " " + JSON.stringify(r)); } });
console.log("   saved skeletons in owner saves: " + sk + "; carrying a reserved word: " + skBad.length + (skBad.length ? " " + skBad.join("; ") : ""));

var src = fs.readFileSync(TREE + "/samples/modeltestcampaign.blueprint", "utf8");
function startFrom(bp, validate) {
  var v = "";
  if (validate) { try { v = validateBlueprint(bp) || ""; } catch (e) { v = "validate THREW " + e.message; } if (v) return { refused: v }; }
  makeWorld(); delete worldState.kind; worldState.turn = 0;
  var err = ""; try { quiet(function () { applyBlueprint(bp); }); } catch (e2) { err = String(e2 && e2.message || e2); }
  return { refused: "", applyErr: err, poison: L.poison() };
}
function promptState() { var t = ""; try { quiet(function () { buildSysPrompt(); }); t = "builds"; } catch (e) { t = "THROWS " + e.message; } var p = L.poison(); return t + (p.length ? " (wrote on built-ins: " + p.join(", ").slice(0, 120) + ")" : ""); }
// ---- 2. an arc title that only becomes the word after the engine's own title key ("Arc 1: " is display numbering, #481 C4)
console.log("--- 2. arc title 'Arc 1: Constructor' (skeletonTitleKey strips the numbering and lower-cases)");
["Constructor", "Construqtor"].forEach(function (w) {
  var bp = normalizeBlueprint(JSON.parse(src)), title = "Arc 1: " + w; bp.acts[0].arcs[0].title = title;
  var s = startFrom(bp, true);
  if (s.refused) { console.log("   '" + title + "' -> refused at validation: " + s.refused.slice(0, 120)); return; }
  worldState.turn = 5;
  var r = run("The matter is settled. [ARC_COMPLETE:" + title + "]"), a0 = worldState.skeleton.acts[0].arcs[0], a1 = worldState.skeleton.acts[0].arcs[1];
  console.log("   '" + title + "' -> validation: accepted | key=" + JSON.stringify(skeletonTitleKey(title)) + " | [ARC_COMPLETE:" + title + "] summary: " + JSON.stringify(r.muts) + " | console lines: " + r.warns.length + " | arc 1 now: " + a0.status + (a1 ? " | arc 2 now: " + a1.status : ""));
});
// the skeleton validator (generated campaigns) with the same title
(function () { var sk2 = { premise: "Story", acts: [{ title: "One", goal: "g", arcs: [{ title: "Arc 1: Constructor", objective: "o" }] }, { title: "Two", goal: "g", arcs: [{ title: "b", objective: "o" }] }, { title: "Three", goal: "g", arcs: [{ title: "c", objective: "o" }] }] }, m = "accepted"; try { validateSkeletonStructure(sk2); } catch (e) { m = "THROWS " + e.message; } console.log("   validateSkeletonStructure with that title: " + m); })();
// ---- 3. a blueprint that reaches the wizard WITHOUT validateBlueprint (the My Library list: ui-browsers.js showPreview(normalizeBlueprint(list[idx].blueprint)))
console.log("--- 3. the same file through a path that normalises but does not validate (My Library)");
["constructor", "__proto__"].forEach(function (w) {
  var bp = normalizeBlueprint(JSON.parse(src)); bp.startingLocation = w;
  var s = startFrom(bp, false);
  console.log("   startingLocation=" + w + " -> apply: " + (s.applyErr || "ok") + (s.poison.length ? " | wrote on built-ins: " + s.poison.join(", ").slice(0, 160) : "") + " | location now " + JSON.stringify(worldState.world.location) + " | next prompt: " + promptState());
  var bp2 = normalizeBlueprint(JSON.parse(src)); bp2.npcs[0].name = w;
  var s2 = startFrom(bp2, false);
  console.log("   npcs[0].name=" + w + " -> apply: " + (s2.applyErr || "ok") + (s2.poison.length ? " | wrote on built-ins: " + s2.poison.join(", ").slice(0, 160) : "") + " | ({}).knowledge=" + JSON.stringify(({}).knowledge) + " | next prompt: " + promptState());
  L.poison();
});
// ---- 4. what validateBlueprint says about shapes around the word
console.log("--- 4. validateBlueprint verdicts");
[["npc name as a one-element list", function (b) { b.npcs[0].name = ["__proto__"]; }],
 ["location name 'The Constructor'", function (b) { b.locations[0].name = "The Constructor"; }],
 ["npc role exactly 'Constructor' (not a name)", function (b) { b.npcs[0].role = "Constructor"; }],
 ["a rule that is the one word", function (b) { b.rules = ["constructor"]; }],
 ["npc notes that list the word between commas", function (b) { b.npcs[0].notes = "A mason, constructor, and father of three."; }],
 ["creature kind 'constructor'", function (b) { b.creatures = [{ name: "Brass hound", kind: "constructor", notes: "built, not born" }]; }]
].forEach(function (c) { var b = normalizeBlueprint(JSON.parse(src)); c[1](b); var v = ""; try { v = validateBlueprint(b) || "accepted"; } catch (e) { v = "THREW " + e.message; } console.log("   " + c[0] + " -> " + v.slice(0, 150)); });
