// The #156 collision ("a new Savah was introduced"): the DIFFERENT-person answer, where the proper name the GM gives the new
// person still holds the shared name. The note: "If they are a DIFFERENT person, give them their own name and emit
// [MERGE:npc|<Their Proper Name>|Savah °t140] — pick a name not already in KNOWN NPCs."
require("./b.js");
var D = "\u00b0", P = "Savah " + D + "t140";
function setup(refs) { fresh({ refs: refs }); person("Savah", "she/her"); memory.npcs["Savah"].events.push({ turn: 12, note: "sold the hero a healing draught" }); worldState.turn = 140;
  quiet(function () { applyMuts("[NPC:Savah|counting vials|unknown, not yet met] [NPC_NOTE:" + P + "|a fishwife from Riddleport, no relation]"); }); worldState.turn = 141; }
setup(true); console.log("NOTE: " + quiet(function () { worldState.turn += 5; var n = buildProvisionalNudge(); worldState.turn -= 5; return n; }).r);
hdr("the DIFFERENT answer: [MERGE:npc|<name>|" + P + "]  (scene refs on)");
["Vessa Thorn", "Savah Dunmere", "Savah the Younger", "Young Savah", "Savah of Riddleport", "Savah (the fishwife)", "Savah II", "Old Savah", "Savah the Fishwife", "Sister Savah", "Savah Two"].forEach(function (n) {
  setup(true); var r = run("A different woman entirely. [MERGE:npc|" + n + "|" + P + "]");
  var est = memory.npcs["Savah"], fused = est && (est.events || []).some(function (e) { return /fishwife/.test(e.note); });
  console.log("  " + JSON.stringify(n) + ": muts=" + JSON.stringify(r.muts) + (r.warns.length ? " warn=" + JSON.stringify(r.warns[0].slice(0, 90)) : "") + "\n      -> " + (memory.npcs[P] ? "provisional still open" : fused ? "FUSED into the established Savah (her record now holds the newcomer's note)" : "a record of her own: " + Object.keys(memory.npcs).filter(function (k) { return k !== "Savah"; }).join(", ")) + " | rows: " + worldState.npcs.map(function (x) { return x.name; }).join(", "));
});
hdr("the same, title case: the relative is given the family's own given name");
["Wilhelmina Underbough the Elder", "Queen Wilhelmina Underbough", "Wilhelmina Underbough (her mother)", "Old Wilhelmina Underbough"].forEach(function (n) {
  q(); var r = run("[MERGE:npc|" + n + "|" + K + "]");
  console.log("  " + JSON.stringify(n) + ": muts=" + JSON.stringify(r.muts) + " -> records: " + Object.keys(memory.npcs).join(", "));
});
