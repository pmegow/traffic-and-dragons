// "Each refusal … before any write": for every refusing shape, the whole state (worldState + memory) before and after the reply, as JSON.
// Keys that the tag boundary itself writes on every reply (the provenance ring and its neighbours) are listed, not hidden.
require("./common.js");
P("version", ver());
var SHAPES = ["[NPC_NOTE:H|x]", "[NPC_SUPERSEDE:H|old|new]", "[NPC_PRONOUN:H|she/her]", "[PARTY_MEMBER:H|true]", "[PARTY_MEMBER:H|false]", "[NPC_MERGE:H|Bram]", "[NPC_MERGE:Bram|H]", "[MERGE:npc|H|Bram]", "[MERGE:npc|Bram|H]", "[NPC_ALIAS:Bram|H]", "[ALIAS:npc|Bram|H]", "[NPC_ALIAS:Frizwick|H]",
  "[NPC_ALIAS:HERO|Bram]", "[NPC_ALIAS:player|the smith]", "[NPC_ALIAS:HERO|Frizwick]"];
var SPELL = [["sheet", null], ["player", "player"], ["epithet", "the Butcher"], ["UPPER", "TESS"]];
function diffKeys(a, b, pre) { var out = [], ks = {}, k; for (k in a) ks[k] = 1; for (k in b) ks[k] = 1; for (k in ks) { if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(pre + k); } return out; }
var total = 0, dirty = 0, changed = {};
// control: what a reply with NO tag changes (the boundary writes these on every reply)
var BASE = (function () { var h = world(); if (!memory.map) memory.map = { nodes: {}, edges: [], lastArrivalFrom: null }; var w0 = JSON.parse(JSON.stringify(worldState)), m0 = JSON.parse(JSON.stringify(memory)); run("It happens."); return diffKeys(w0, JSON.parse(JSON.stringify(worldState)), "worldState.").concat(diffKeys(m0, JSON.parse(JSON.stringify(memory)), "memory.")); })();
console.log("a reply with no tag changes: " + JSON.stringify(BASE));
SHAPES.forEach(function (sh) { SPELL.forEach(function (sp) {
  var h = world(); worldState.character.aliases = ["the Butcher"]; memory.npcs["Bram"].aliases.push("the smith"); wsNpcByName("Bram").aliases.push("the smith");
  if (!memory.map) memory.map = { nodes: {}, edges: [], lastArrivalFrom: null };
  var tag = sh.split("HERO").join(h).split(":H|").join(":" + (sp[1] || h) + "|").split("|H]").join("|" + (sp[1] || h) + "]").split("|H|").join("|" + (sp[1] || h) + "|");
  var w0 = JSON.parse(JSON.stringify(worldState)), m0 = JSON.parse(JSON.stringify(memory));
  var r = run("It happens. " + tag); total++;
  var refused = r.muts.length && r.muts.every(function (m) { return /refused/.test(m); });
  var d = diffKeys(w0, JSON.parse(JSON.stringify(worldState)), "worldState.").concat(diffKeys(m0, JSON.parse(JSON.stringify(memory)), "memory."));
  d.forEach(function (k) { changed[k] = (changed[k] || 0) + 1; });
  var real = d.filter(function (k) { return BASE.indexOf(k) < 0 && k !== "worldState.tagLog"; });
  if (!refused) { console.log("   not a pure refusal: " + tag + " -> " + JSON.stringify(r.muts)); return; }
  if (real.length) { dirty++; console.log("!! " + tag + " refused but changed " + real.join(", ")); }
}); });
console.log(total + " replies; refusals that changed state beyond the provenance ring: " + dirty + "; keys touched across all runs: " + JSON.stringify(changed));
