// What a GM would naturally write as the "DIFFERENT person" answer, and whether it lands (head; TREE=before for comparison).
require("./b.js");
hdr("natural proper names for the unnamed queen: [MERGE:npc|<name>|<provisional>]");
["Queen Underbough", "Queen Maeve Underbough", "Maeve Underbough", "Maeve", "The Queen", "Queen Mother Underbough", "The Queen Mother", "Old Queen Underbough", "Queen Underbough the Elder", "Dowager Queen Underbough",
  "Lady Underbough", "Mother Underbough", "Her Majesty Queen Underbough", "Wilhelmina's mother", "Queen Underbough (Wilhelmina's mother)", "Queen of the Underboughs", "Underbough"].forEach(function (n) {
  q(); var r = run("[MERGE:npc|" + n + "|" + K + "]");
  var landed = !memory.npcs[K], where = landed ? Object.keys(memory.npcs).filter(function (k) { return (memory.npcs[k].aliases || []).indexOf("Queen Underbough") >= 0 || k === n; }).join(", ") : "";
  console.log("  " + (landed ? "LANDS  " : "refused") + " " + JSON.stringify(n) + (landed ? " -> record(s): " + where : "") + (r.warns.length ? "   [" + r.warns[0].replace(/^W \[identity\] /, "").slice(0, 110) + "]" : "") + (r.muts.length ? "   muts=" + JSON.stringify(r.muts) : ""));
});
hdr("the refused answer, repeated every time the note asks (refs on): what the GM and the player are told");
q(); var i;
for (i = 0; i < 3; i++) {
  worldState.turn += PROVISIONAL_NUDGE_COOLDOWN; var note = quiet(function () { return buildProvisionalNudge(); }).r; worldState.turn++;
  var r = run("Her mother. [MERGE:npc|Queen Mother Underbough|" + K + "]");
  console.log("  t" + worldState.turn + " note " + (note ? "asked (" + note.length + " chars, " + (/Queen Mother|refused|last answer/i.test(note) ? "mentions the refused answer" : "same words as before, no word about the refused answer") + ")" : "NOT asked") + " | muts=" + JSON.stringify(r.muts) + " | provisional still open: " + !!memory.npcs[K]);
}
hdr("the proper name was introduced FIRST by its own [NPC:] tag, the answer comes a turn later");
q(); go("[NPC:Maeve Underbough|furious|hostile]"); worldState.turn++;
go("She is the queen. [MERGE:npc|Maeve Underbough|" + K + "]"); show("  queued", JSON.stringify(worldState.pendingMergeHints || []));
var cn = quiet(function () { return buildMergeConfirmNudge(); }).r; console.log("  CONFIRM NOTE (one-shot): " + (cn ? cn.slice(0, 230) + "…" : "(none)"));
worldState.turn++; go("(the GM narrates on; no tag this turn)");
for (i = 0; i < 2; i++) { worldState.turn += PROVISIONAL_NUDGE_COOLDOWN; quiet(function () { buildMergeConfirmNudge(); buildProvisionalNudge(); }); worldState.turn++;
  var r2 = go("[MERGE:npc|Maeve Underbough|" + K + "]"); console.log("     provisional still open: " + !!memory.npcs[K] + " | queued: " + JSON.stringify(worldState.pendingMergeHints || []) + " | latch: " + JSON.stringify(worldState.mergeHintNudged || {})); }
dump();
