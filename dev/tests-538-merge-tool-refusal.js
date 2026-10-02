// tests-538-merge-tool-refusal.js — #538 review (finding 12): the offline merge tool (dev/npc-merge-core.js, used by
// dev/npc-merge-tool.js and dev/npc-merge-studio.html) drives the SHIPPING NPC_MERGE handler and must stop before its residue
// surgery when the handler did not merge. It used to stop only when the handler reported nothing at all; a refusal (the
// player's name, #538) and an ignored self-merge (#537) both leave a warning line, so the surgery ran on a merge that never
// happened. Loads the engine the way the tool does (through tag_table.js).
//   node dev/tests-538-merge-tool-refusal.js
var fs = require("fs"), path = require("path"), engine = require("./load-engine.js");
var w0 = console.warn, i0 = console.info; console.warn = function () {}; console.info = function () {};
engine.loadEngine("tag_table.js");
var geval = eval; geval(fs.readFileSync(path.join(__dirname, "npc-merge-core.js"), "utf8"));
console.warn = w0; console.info = i0;
var failed = 0, passed = 0;
function test(name, fn) { var r; try { r = fn(); } catch (e) { r = "threw: " + (e && e.message); } if (r === true) { passed++; console.log("PASS #538 merge tool: " + name); } else { failed++; console.error("FAIL #538 merge tool: " + name + " — " + r); } }
function quiet(fn) { var a = console.warn, b = console.info; console.warn = function () {}; console.info = function () {}; try { return fn(); } finally { console.warn = a; console.info = b; } }
function world() {
  engine.makeTestWorld(); worldState.turn = 9; delete worldState.sceneRefs;
  worldState.npcs = [{ name: "Bram", status: "calm", rel: "ally", met: 1, partyMember: false, portrait: null, aliases: [] }, { name: "Bram the smith", status: "calm", rel: "ally", met: 2, partyMember: false, portrait: null, aliases: [] }];
  memory.npcs = { "Bram": { attitude: "", knowledge: ["owes the miller"], events: [{ turn: 2, note: "sold nails" }], aliases: [] }, "Bram the smith": { attitude: "", knowledge: [], events: [{ turn: 3, note: "shod a mare" }], aliases: [] } };
  memory.map = { nodes: { "Ashfen": { firstVisit: 1, visits: 3, description: null, parent: null, npcs: ["Bram", "Bram the smith"], items: [], size: "small", travelMins: null } }, edges: [], lastArrivalFrom: null };
  return worldState.character.name;
}
function snapshot() { return JSON.stringify([memory.npcs, worldState.npcs, memory.map.nodes]); }
function attempt(canonical, dupe) { var lines = [], threw = ""; try { quiet(function () { nmcMergePair(canonical, dupe, function (lv, tx) { lines.push(lv + ": " + tx); }); }); } catch (e) { threw = String(e && e.message); } return { threw: threw, lines: lines }; }

test("the control: an ordinary pair merges and the tool reports the handler's own line", function () {
  world(); var r = attempt("Bram the smith", "Bram");
  if (r.threw) return "an ordinary merge was stopped: " + r.threw;
  return !memory.npcs["Bram"] && memory.npcs["Bram the smith"].events.length === 2 && r.lines.some(function (l) { return l.indexOf("Merged: Bram -> Bram the smith") >= 0; }) ? true : "the merge did not land: " + JSON.stringify(r.lines);
});
test("a merge the handler REFUSES (the survivor is the player) stops the tool before anything is rewritten", function () {
  var hero = world(), before = snapshot(), r = attempt(hero, "Bram");
  if (!r.threw) return "the tool went on after a refusal: " + JSON.stringify(r.lines);
  if (r.threw.indexOf("refused (player)") < 0) return "the stop must carry the handler's own reason: " + r.threw;
  return snapshot() === before ? true : "the tool rewrote state for a merge that never happened";
});
test("a merge the handler IGNORES (one name on both sides) stops the tool the same way", function () {
  world(); var before = snapshot(), r = attempt("Bram", "Bram");
  if (!r.threw) return "the tool went on after an ignored merge: " + JSON.stringify(r.lines);
  return r.threw.indexOf("into itself") >= 0 && snapshot() === before ? true : "the stop must carry the handler's own reason and change nothing: " + r.threw;
});
console.log((failed ? "FAILED" : "ALL GREEN") + " — " + passed + " merge-tool refusal assertions");
process.exit(failed ? 1 : 0);
