// p17 — the stale ° key after a landed DIFFERENT answer: same reply and the next reply, #156 shape. PROBE_TREE=pre|mid|head
require("./base.js");
function line(l, v) { console.log("   " + l + ": " + v); }
var K = PK("Savah", 140);
function open() { fresh({ turn: 140 }); person("Savah", "she/her"); run("[NPC:Savah|counting vials|unknown, not yet met]"); worldState.turn = 141; }
function show(title) { line(title + " rows", rows()); }
hdr("same reply: the rename, then the new person's mood by the ° key (no pronoun stated)");
open(); var r = run("A different woman. [MERGE:npc|Vessa Thorn|" + K + "] [NPC:" + K + "|grinning|rival]");
show("after"); line("muts", JSON.stringify(r.muts));
hdr("next reply: the rename landed at t141; at t142 the GM still writes the ° key");
open(); run("[MERGE:npc|Vessa Thorn|" + K + "]"); worldState.turn = 142;
r = run("[NPC:" + K + "|grinning|rival] [NPC_NOTE:" + K + "|is a spy for the Sczarni] [SAY:" + K + "|Well met.]");
show("after"); line("muts", JSON.stringify(r.muts)); line("Savah events", JSON.stringify(memory.npcs["Savah"].events)); line("Vessa Thorn events", JSON.stringify((memory.npcs["Vessa Thorn"] || {}).events));
hdr("control: the same tags while the question is still open (no answer yet)");
open(); r = run("[NPC:" + K + "|grinning|rival] [NPC_NOTE:" + K + "|is a spy for the Sczarni]");
show("after"); line("Savah events", JSON.stringify(memory.npcs["Savah"].events));
