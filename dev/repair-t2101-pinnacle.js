// repair-t2101-pinnacle.js — re-open "The Pinnacle of Avarice" (falsely completed at t2101).
// The GM completed the final-act quest when only its first objective (collect the
// cold-warded bracelets in Magnimar) was done; Karzoug was never confronted.
// No rewards were paid at the completion (no paid{} on the archive record, no XP/GOLD
// in the t2101 tagLog entry), so re-opening is clean — no payout rollback needed.
// Usage: node dev/repair-t2101-pinnacle.js <save.tnd>   → writes <save>_REPAIRED.tnd
var fs = require("fs");
var path = process.argv[2];
if (!path) { console.error("usage: node dev/repair-t2101-pinnacle.js <save.tnd>"); process.exit(1); }
var raw = JSON.parse(fs.readFileSync(path, "utf8"));
var ws = raw.worldState || raw;
var mem = raw.memory;
var TITLE = "The Pinnacle of Avarice";

var arch = mem && mem.quests && mem.quests[TITLE];
if (!arch) { console.error("REFUSE: archive record for \"" + TITLE + "\" not found"); process.exit(1); }
if (arch.status !== "completed") { console.error("REFUSE: archive status is \"" + arch.status + "\", expected completed"); process.exit(1); }
if (arch.turn !== 2101) { console.error("REFUSE: archive turn is " + arch.turn + ", expected 2101 (wrong save?)"); process.exit(1); }
ws.questLog = ws.questLog || [];
if (ws.questLog.some(function (q) { return q.title === TITLE; })) {
  console.error("REFUSE: \"" + TITLE + "\" already in the live questLog (repair already applied?)"); process.exit(1);
}

// The root gap: the quest's actual completion condition lived only in the desc —
// the objective list held just the bracelet errand, so "all objectives complete"
// was literally true. Re-open WITH the real goal as an unchecked objective.
var objectives = arch.objectives.concat([{
  text: "Reach the heart of Xin-Shalast and confront the Runelord of Greed atop his mountain sanctum",
  done: false
}]);
ws.questLog.push({
  title: TITLE,
  status: "active",
  desc: arch.desc,
  objectives: objectives, // bracelet objective stays done — it genuinely happened
  started: arch.started,
  lastTouch: 2101,
  repairNote: "reopened by dev/repair-t2101-pinnacle.js — false [QUEST:|completed] at t2101 (bracelet errand mistaken for the quest; confrontation objective added from the desc)"
});
delete mem.quests[TITLE];

var out = path.replace(/\.tnd$/i, "") + "_REPAIRED.tnd";
fs.writeFileSync(out, JSON.stringify(raw));
console.log("OK: \"" + TITLE + "\" re-opened as active (objectives preserved, archive entry removed).");
console.log("Wrote " + out);
