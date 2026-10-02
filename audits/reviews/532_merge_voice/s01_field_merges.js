// READ-ONLY census over the owner's saves (the newest save per campaign folder): every npc identity merge on record
// (memory.archive.identityMerges pre-images), whether the duplicate's roster row carried voice pins, and what the survivor
// holds now. Also counts sceneRefs (the W2 gate is live whenever worldState.sceneRefs exists).
var fs = require("fs"), path = require("path");
var ROOT = "C:/Projects/traffic-and-dragons/Campaigns";
var F = ["voiceId", "speechifyVoiceId", "inworldVoiceId", "voiceDirection", "voiceRate"];
function pins(o) { var r = {}, i; if (!o) return null; for (i = 0; i < F.length; i++) if (o[F[i]]) r[F[i]] = o[F[i]]; return r; }
var total = 0, withPins = 0, gated = 0, saves = 0;
fs.readdirSync(ROOT).forEach(function (camp) {
  var dir = path.join(ROOT, camp, "saves"); if (!fs.existsSync(dir)) return;
  var files = fs.readdirSync(dir).filter(function (f) { return /\.tnd$/.test(f); }).map(function (f) { return { f: f, t: fs.statSync(path.join(dir, f)).mtimeMs }; }).sort(function (a, b) { return b.t - a.t; });
  if (!files.length) return;
  var j; try { j = JSON.parse(fs.readFileSync(path.join(dir, files[0].f), "utf8")); } catch (e) { console.log(camp + ": unreadable (" + e.message + ")"); return; }
  var ws = j.worldState || {}, mem = j.memory || {}, im = (mem.archive && mem.archive.identityMerges) || [];
  saves++; if (ws.sceneRefs) gated++;
  var npcM = im.filter(function (m) { return m.domain === "npc"; });
  console.log(camp + " | " + files[0].f + " | turn " + ws.turn + " | sceneRefs " + !!ws.sceneRefs + " | npc merges on record " + npcM.length);
  npcM.forEach(function (m) {
    total++;
    var dp = m.records && m.records.ws ? pins(m.records.ws) : null, ds = m.records && m.records.ws && m.records.ws.charSheet ? pins(m.records.ws.charSheet) : null;
    var surv = (ws.npcs || []).filter(function (n) { return n.name === m.canonical; })[0];
    var any = (dp && Object.keys(dp).length) || (ds && Object.keys(ds).length);
    if (any) withPins++;
    console.log("   t" + m.turn + " " + JSON.stringify(m.duplicate) + " -> " + JSON.stringify(m.canonical) + " | dupRow " + (m.records && m.records.ws ? "yes" : "none") + " dupRowPins " + JSON.stringify(dp) + " dupSheetPins " + JSON.stringify(ds) + " | survivor now: row " + JSON.stringify(pins(surv)) + " sheet " + JSON.stringify(surv && surv.charSheet ? pins(surv.charSheet) : null) + (surv ? "" : " (no survivor row)"));
  });
});
console.log("TOTAL: " + saves + " campaigns (newest save each), " + gated + " with sceneRefs (W2 merge gate live), " + total + " npc merges on record, " + withPins + " whose duplicate carried a voice pin");
