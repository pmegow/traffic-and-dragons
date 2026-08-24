// repair-t2231-spine.js — re-open the SKELETON layer of the t2101 false completion.
// The t2101 incident closed the final-act quest off a bracelet errand; repair-t2101-pinnacle
// re-opened the QUEST, but the skeleton ARC "The Pinnacle of Avarice" (and with it Act 3,
// "Spires of Xin-Shalast") stayed completed. Result, measured on the live t2231 save: the
// spine block showed every act COMPLETED while instructing the GM to steer toward "the
// CURRENT arc" — which did not exist — and ~130 turns of Xin-Shalast play ran spineless
// (the improvised beacon/watcher/bell/warden chain the owner read as "utterly disjointed").
// The quest layer and the skeleton layer disagreed about whether the finale had happened;
// this makes them agree the way the quest repair decided: it has not happened yet.
//
// Changes: act 3 status completed -> active; arc "The Pinnacle of Avarice" completed ->
// active with startTurn re-stamped to the save's turn (the #23 per-arc pacing budget measures
// from startTurn — the 1977-era stamp would trip the stall nudge on the first turn back);
// worldState.actStartTurn re-stamped for the same reason at act scale; receipt appended to
// worldState.repairLog (the established forensic channel on this very save).
// "The Road to Xin-Shalast" stays completed — the party genuinely crossed it.
//
// Usage: node dev/repair-t2231-spine.js <save.tnd>   → writes <save>_REPAIRED.tnd
var fs = require("fs");
var path = process.argv[2];
if (!path) { console.error("usage: node dev/repair-t2231-spine.js <save.tnd>"); process.exit(1); }
var raw = JSON.parse(fs.readFileSync(path, "utf8"));
var ws = raw.worldState || raw;

var ACT = "Spires of Xin-Shalast";
var ARC = "The Pinnacle of Avarice";

if (!ws.skeleton || !ws.skeleton.acts) { console.error("REFUSE: no skeleton on this save"); process.exit(1); }
var act = null, i;
for (i = 0; i < ws.skeleton.acts.length; i++) if (ws.skeleton.acts[i].title === ACT) { act = ws.skeleton.acts[i]; break; }
if (!act) { console.error("REFUSE: act \"" + ACT + "\" not found (wrong save?)"); process.exit(1); }
if (act.status === "active") { console.error("REFUSE: act already active (repair already applied?)"); process.exit(1); }
if (act.status !== "completed") { console.error("REFUSE: act status is \"" + act.status + "\", expected completed"); process.exit(1); }
var arc = null;
for (i = 0; i < act.arcs.length; i++) if (act.arcs[i].title === ARC) { arc = act.arcs[i]; break; }
if (!arc) { console.error("REFUSE: arc \"" + ARC + "\" not found in the act"); process.exit(1); }
if (arc.status !== "completed") { console.error("REFUSE: arc status is \"" + arc.status + "\", expected completed"); process.exit(1); }
var quest = (ws.questLog || []).filter(function (q) { return q.title === ARC; })[0];
if (!quest || quest.status !== "active") {
  console.error("REFUSE: quest \"" + ARC + "\" is not active in the questLog — run repair-t2101-pinnacle first (this tool closes the layer gap it left)"); process.exit(1);
}

var was = { act: act.status, arc: arc.status, arcStart: arc.startTurn, actStart: ws.actStartTurn };
act.status = "active";
arc.status = "active";
arc.startTurn = ws.turn;      // #23 pacing budget measures from here; age 0 on resume
ws.actStartTurn = ws.turn;    // same at act scale

if (!ws.repairLog) ws.repairLog = [];
ws.repairLog.push({
  at: "t" + ws.turn,
  via: "repair-t2231-spine (the t2101 skeleton-layer gap)",
  changes: [
    "act \"" + ACT + "\" " + was.act + " -> active",
    "arc \"" + ARC + "\" " + was.arc + " -> active (startTurn " + was.arcStart + " -> " + ws.turn + ")",
    "actStartTurn " + was.actStart + " -> " + ws.turn
  ]
});

var out = path.replace(/\.tnd$/i, "") + "_REPAIRED.tnd";
fs.writeFileSync(out, JSON.stringify(raw));
console.log("OK: act \"" + ACT + "\" and arc \"" + ARC + "\" re-opened; pacing clocks re-stamped to t" + ws.turn + ".");
console.log("Wrote " + out);
