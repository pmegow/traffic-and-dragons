// TODO #19 fourth pass (owner ruling 2026-09-23): Car Mode's ENTRY read is the scene brief — where you are plus the
// tail of the last narration — not the full recap. Pure helper against a hand-built worldState (the tests-287 loader).
var assert = require("assert/strict"), fs = require("fs"), path = require("path");
var root = path.join(__dirname, "..");
var geval = eval;
global.window = global; global.document = { getElementById: function() { return null; } };
["globals.js", "data.js", "helpers.js"].forEach(function(f) {
  try { geval(fs.readFileSync(path.join(root, f), "utf8")); }
  catch (e) { console.error("ENGINE LOAD FAILED in " + f + ": " + e.message); process.exit(1); }
});
var passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("PASS #19c " + name); }
  catch (e) { process.exitCode = 1; console.error("FAIL #19c " + name + " — " + e.stack); }
}
function ws(entries, world) { return { world: world || { location: "Sandpoint", sublocation: "the Rusty Dragon" }, transcript: entries || [] }; }
test("no narration yet reads only the place", function() {
  assert.equal(carSceneBrief(ws([])), "You are at the Rusty Dragon.");
  assert.equal(carSceneBrief(ws([], { location: "Sandpoint", sublocation: null })), "You are at Sandpoint.");
  assert.equal(carSceneBrief(ws([], { location: "", sublocation: null })), "");
});
test("the brief is the place plus the last two sentences of the last GM entry", function() {
  var e = [{ t: 1, r: "player", x: "I look around." }, { t: 1, r: "gm", x: "One. Two! Three? \"Four,\" she says. Five." }];
  assert.equal(carSceneBrief(ws(e)), "You are at the Rusty Dragon. \"Four,\" she says. Five.");
});
test("bookkeeping, refusal and player entries are skipped; whitespace is folded", function() {
  var e = [{ t: 1, r: "gm", x: "Real scene.   Second\nsentence." }, { t: 2, r: "gm", x: "Ledger.", bk: 1 }, { t: 2, r: "gm", x: "I cannot.", rf: 1 }, { t: 2, r: "player", x: "go" }];
  assert.equal(carSceneBrief(ws(e)), "You are at the Rusty Dragon. Real scene. Second sentence.");
});
test("an over-long tail is capped at whole words from the end", function() {
  var long = "Word ".repeat(200).trim() + ". End here.";
  var out = carSceneBrief(ws([{ t: 1, r: "gm", x: long }]));
  assert(out.length <= "You are at the Rusty Dragon. ".length + CAR_BRIEF_MAX_CHARS + 1, "over cap: " + out.length);
  assert(/\. End here\.$/.test(out)); assert(!/ W\b/.test(out.replace(/Word/g, "")), "a partial leading word survived");
});
test("a single unpunctuated narration is read whole", function() {
  assert.equal(carSceneBrief(ws([{ t: 1, r: "gm", x: "The road bends north" }], { location: "The Road" })), "You are at The Road. The road bends north");
});
console.log((process.exitCode ? "FAILED" : "ALL GREEN") + " — " + passed + " scene-brief groups");
