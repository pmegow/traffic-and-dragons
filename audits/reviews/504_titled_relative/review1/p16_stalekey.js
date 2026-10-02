// p16 — #156-shaped provisional ("Savah °t140"): the DIFFERENT answer (lands since #530) with another tag in the same reply
// that names the new person by the roster's ° key. PROBE_TREE=pre|mid|head
require("./base.js");
function line(l, v) { console.log("   " + l + ": " + v); }
var K = PK("Savah", 140);
function open() { fresh({ turn: 140 }); person("Savah", "she/her"); memory.npcs["Savah"].events.push({ turn: 100, note: "sold the hero a healing draught" }); run("[NPC:Savah|counting vials|unknown, not yet met]"); worldState.turn = 141; }
open(); var p = quiet(function () { return buildSysPrompt(); }).r, ls = (String(p.stable || "") + "\n" + String(p.volatile || "")).split("\n").filter(function (l) { return /Savah/.test(l) && /NPCs:/.test(l); });
hdr("the roster the GM sees while the question is open"); ls.slice(0, 3).forEach(function (l) { line("prompt", l.slice(0, 260)); });
[["DIFFERENT + [NPC:] by the ° key", "A different woman. [MERGE:npc|Vessa Thorn|" + K + "] [NPC:" + K + "|grinning|rival] [NPC_PRONOUN:" + K + "|he/him]"],
 ["DIFFERENT + a death by the ° key", "[MERGE:npc|Vessa Thorn|" + K + "] [NPC_DEATH_REPORTED:" + K + "|a rider]"],
 ["DIFFERENT + a note by the ° key", "[MERGE:npc|Vessa Thorn|" + K + "] [NPC_NOTE:" + K + "|is a spy for the Sczarni]"]].forEach(function (c) {
  open(); var r = run(c[1]); hdr(c[0] + ": " + c[1]); line("rows", rows()); line("mem", mems()); line("muts", JSON.stringify(r.muts));
  line("the established Savah's events", JSON.stringify((memory.npcs["Savah"] || {}).events));
});
