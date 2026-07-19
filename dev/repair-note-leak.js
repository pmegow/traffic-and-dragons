// dev/repair-note-leak.js — one-shot data repair for the #60b engine-note prose leak. DEV TOOL, node-only.
//
// WHAT IT REPAIRS: between turns 793 and 868 the GM answered CONSUMABLE CHECK / RELATIONSHIP
// AUDIT engine notes in the STORY TEXT ("No blasting charge spent in that beat, nothing to tag
// there."), because the notes' negative branch offered no tag to emit and thinking is disabled.
// cleanTxt does not strip prose, so those sentences were written into worldState.transcript.
// v1.384 closed the source (the [ITEM_KEPT:] channel); this removes what already landed.
//
// WHY IT MATTERS beyond tidiness: the transcript is the RAG corpus and the narrative record.
// Left in place these lines (a) keep re-arming detectGhostConsumables through their head nouns,
// (b) are retrievable as "past scene excerpts", and (c) show the GM its own bookkeeping as
// house style through the retained tail.
//
// ⛨ THE TRANSCRIPT IS SACRED (standing decree): this tool NEVER trims, caps, reorders or drops
// an entry. It removes leaked SENTENCES from within an entry's text and leaves everything else
// byte-identical. An entry that would end up empty is left untouched and reported instead — a
// disappearing turn is worse than a leaked line.
//
// USAGE:  node dev/repair-note-leak.js <in.tnd> [out.tnd]
//         With no out path it runs a DRY RUN and prints what it would change. Always dry-run
//         first, read the diff, then write. The input file is never modified in place.

var fs = require("fs");

// A leaked sentence is bookkeeping ABOUT the sheet/tags, not narration. Anchored to the observed
// field forms; deliberately narrow — a false positive deletes real prose, which is unrecoverable.
var LEAK_PATTERNS = [
  /(?:^|(?<=[.!?"”]\s))No [a-z' ]{0,40}(?:consumed|spent|used|burned)[^.!?]*\.\s*/g,
  /(?:^|(?<=[.!?"”]\s))Nothing (?:consumed|spent)[^.!?]*\.\s*/g,
  /(?:^|(?<=[.!?"”]\s))(?:Leaving|Left) the sheet[^.!?]*\.\s*/g,
  /(?:^|(?<=[.!?"”]\s))(?:The )?[Ss]heet stays as is[^.!?]*\.\s*/g,
  /(?:^|(?<=[.!?"”]\s))Bonds all still read true[^.!?]*\.\s*/g,
  /(?:^|(?<=[.!?"”]\s))No (?:tags?|item.?loss) (?:needed|to tag)[^.!?]*\.\s*/g
];

function scrub(text) {
  var out = String(text || ""), i;
  for (i = 0; i < LEAK_PATTERNS.length; i++) out = out.replace(LEAK_PATTERNS[i], "");
  return out.replace(/^\s+/, "").replace(/\n{3,}/g, "\n\n");
}

var inPath = process.argv[2], outPath = process.argv[3];
if (!inPath) { console.error("usage: node dev/repair-note-leak.js <in.tnd> [out.tnd]"); process.exit(1); }

var save = JSON.parse(fs.readFileSync(inPath, "utf8"));
var tr = (save.worldState && save.worldState.transcript) || [];
var changed = 0, skipped = 0;

tr.forEach(function (e) {
  if (e.r !== "gm" || typeof e.x !== "string") return;
  var next = scrub(e.x);
  if (next === e.x) return;
  if (!next.trim()) {
    // the whole entry was bookkeeping — refuse to empty it, report for a human call
    console.log("  SKIPPED t" + e.t + " (entry would be emptied): " + JSON.stringify(e.x.slice(0, 120)));
    skipped++;
    return;
  }
  console.log("--- t" + e.t);
  console.log("  - " + JSON.stringify(e.x.slice(0, 160)));
  console.log("  + " + JSON.stringify(next.slice(0, 160)));
  if (outPath) e.x = next;
  changed++;
});

console.log("");
console.log((outPath ? "REPAIRED " : "WOULD REPAIR ") + changed + " transcript entr" + (changed === 1 ? "y" : "ies")
  + (skipped ? "; " + skipped + " skipped (would empty the entry — handle by hand)" : ""));

if (outPath) {
  fs.writeFileSync(outPath, JSON.stringify(save));
  console.log("wrote " + outPath + " (input left untouched)");
} else {
  console.log("DRY RUN — pass an output path to write the repaired save.");
}
