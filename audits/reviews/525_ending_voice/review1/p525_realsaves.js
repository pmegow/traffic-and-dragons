require("./h.js");
// READ-ONLY scan of the owner's saves: every kind:"ending" core memory on every sheet, before and after healEndingMoments
// (in memory only), plus a second pass to check idempotence on real data.
var fs = require("fs"), path = require("path");
var ROOT = "C:/Projects/traffic-and-dragons/Campaigns";
var only = process.argv[2] || "";
fs.readdirSync(ROOT).forEach(function (camp) {
  var sd = path.join(ROOT, camp, "saves"); if (!fs.existsSync(sd)) return;
  var files = fs.readdirSync(sd).filter(function (f) { return /\.tnd$/i.test(f); }).map(function (f) { return { f: f, m: fs.statSync(path.join(sd, f)).mtimeMs }; }).sort(function (a, b) { return b.m - a.m; });
  if (!files.length) return;
  if (only && camp.indexOf(only) < 0) return;
  var f = files[0].f, save;
  try { save = JSON.parse(fs.readFileSync(path.join(sd, f), "utf8")); } catch (e) { console.log(camp + ": cannot parse " + f + " — " + e.message); return; }
  try { worldState = inflateWorldStateSnapshot(save.worldState); memory = save.memory || blankMemory(); } catch (e2) { console.log(camp + ": inflate failed " + e2.message); return; }
  var sheets = [{ who: "HERO " + worldState.character.name, cs: worldState.character }];
  (worldState.npcs || []).forEach(function (n) { if (n && n.charSheet) sheets.push({ who: (n.partyMember ? "party " : n.resident ? "resident " : "npc ") + n.name, cs: n.charSheet }); });
  var before = [];
  sheets.forEach(function (s) { (s.cs.coreMemories || []).forEach(function (m, i) { if (m && m.kind === "ending") before.push({ sheet: s.who, i: i, who: m.who, camp: m.camp, turn: m.turn, text: m.text, ref: m }); }); });
  console.log("\n##### " + camp + " / " + f + "  (kind " + (worldState.kind || "adventure") + ", turn " + worldState.turn + ", ended " + J(worldState.ended && worldState.ended.cause) + ", hero " + worldState.character.name + ", sheets " + sheets.length + ")");
  if (!before.length) { console.log("   no ending moments"); return; }
  var snap = before.map(function (b) { return b.text; });
  var n1 = healEndingMoments(worldState), n2 = healEndingMoments(worldState);
  console.log("   endings: " + before.length + " | heal pass 1 changed " + n1 + " | pass 2 changed " + n2 + (n2 ? "   <-- NOT IDEMPOTENT" : ""));
  before.forEach(function (b, k) {
    console.log("   - [" + b.sheet + "] who=" + J(b.who) + " camp=" + J(b.camp) + " t" + b.turn + "\n       before: " + J(snap[k]) + (b.ref.text !== snap[k] ? "\n       after : " + J(b.ref.text) : "\n       (unchanged)"));
  });
});
