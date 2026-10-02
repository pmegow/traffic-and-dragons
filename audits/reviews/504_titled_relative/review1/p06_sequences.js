// p06 — multi-tag sequences around an open title question. Scene refs active. PROBE_TREE=pre|mid|head
require("./base.js");
function line(l, v) { console.log("   " + l + ": " + v); }
var K = PK("Queen Underbough", 85);
function open() { fresh(); person("Wilhelmina Underbough", "she/her"); run("[NPC:Queen Underbough|furious|hostile] [NPC_PRONOUN:Queen Underbough|she/her]"); worldState.turn = 86; }
function step(text) { var r = run(text); console.log(" > " + text); line("rows", rows()); line("mem", mems()); line("muts", JSON.stringify(r.muts)); if ((worldState.pendingMergeHints || []).length) line("hints", JSON.stringify(worldState.pendingMergeHints)); return r; }
function notes() { worldState.turn += 1; var a = quiet(function () { return buildMergeConfirmNudge(); }).r, b = quiet(function () { return buildProvisionalNudge(); }).r; line("next turn notes", "confirm=" + (a ? "YES " + a.slice(60, 200) : "no") + " | collision=" + (b ? "YES" : "no")); }

hdr("1. the GM names her with NPC_ALIAS on the called name while the question is open");
open(); step("[NPC_ALIAS:Queen Underbough|Queen Isolde]");
line("resolve('Queen Underbough')", resolveNpcName("Queen Underbough")); line("resolve('Queen Isolde')", resolveNpcName("Queen Isolde"));
worldState.turn = 87; step("[NPC:Queen Underbough|cold|hostile] [NPC_NOTE:Queen Isolde|plans to exile the hero]");
notes();

hdr("2. the ° key re-emitted by the GM AFTER the answer landed (stale context)");
open(); step("[NPC_MERGE:Wilhelmina Underbough|" + K + "]"); worldState.turn = 87;
step("[NPC:" + K + "|pacing|hostile]");
line("npcIsProvisional(key) / stamp", npcIsProvisional(K) + " / " + JSON.stringify(memory.npcs[K] && memory.npcs[K].provisional));
notes();
open(); step("[MERGE:npc|Queen Isolde Underbough|" + K + "]"); worldState.turn = 87;
step("[NPC:" + K + "|pacing|hostile]");

hdr("3. a companion: [NPC:Mother Vane] beside the party member Daeris Vane, then SAME by her given name");
fresh(); var d = person("Daeris Vane", "she/her", { partyMember: true, charSheet: { name: "Daeris Vane", inventory: [], relationships: [] } });
step("[NPC:Mother Vane|stern|acquaintance]"); worldState.turn = 86;
step("It is Daeris they mean. [NPC_MERGE:Daeris|" + PK("Mother Vane", 85) + "]");
worldState.turn = 87; step("[NPC:Daeris|laughing|companion]");
line("party rows", worldState.npcs.filter(function (n) { return n.partyMember; }).map(function (n) { return n.name + " [" + n.status + "]"; }).join("; "));

hdr("4. a couple introduced in ONE reply, each with stated pronouns");
fresh(); step("[NPC:Aldric Varn|grim|neutral] [NPC_PRONOUN:Aldric Varn|he/him] [NPC:Lady Varn|cold|neutral] [NPC_PRONOUN:Lady Varn|she/her]");
fresh(); step("[NPC:Wilhelmina Underbough|smiling|ally] [NPC:Queen Underbough|furious|hostile]");

hdr("5. the answer and a re-tag in ONE reply; the introduction and the answer in ONE reply");
open(); step("[NPC_MERGE:Wilhelmina Underbough|Queen Underbough] [NPC:Queen Underbough|calm|ally]");
fresh(); person("Wilhelmina Underbough", "she/her"); step("[NPC:Queen Underbough|furious|hostile] [NPC_MERGE:Wilhelmina Underbough|Queen Underbough]"); notes();
fresh(); person("Wilhelmina Underbough", "she/her"); step("[NPC:Queen Underbough|furious|hostile] [MERGE:npc|Queen Isolde Underbough|Queen Underbough]"); notes();

hdr("6. two answers in one reply (contradictory)");
open(); step("[NPC_MERGE:Wilhelmina Underbough|" + K + "] [MERGE:npc|Queen Isolde Underbough|" + K + "]");
open(); step("[MERGE:npc|Queen Isolde Underbough|" + K + "] [NPC_MERGE:Wilhelmina Underbough|Queen Underbough]");

hdr("7. the provisional dies while open, then SAME lands");
open(); worldState.sceneRefs = null; delete worldState.sceneRefs; step("[NPC:Queen Underbough|dead|hostile]"); sceneRefsEnsure(); worldState.turn = 87;
step("[NPC_MERGE:Wilhelmina Underbough|Queen Underbough]");
