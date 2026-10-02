// READ-ONLY census over EVERY owner save (Campaigns/*/saves/*.tnd). Counts only; names are printed only for anomalies.
//  - sheetless rows carrying pins / a direction or speed
//  - sheets carrying a direction or speed
//  - ORPHANS: a row that has a sheet AND still holds a voice field on the row (slot pin, direction or speed)
//  - NAME MISMATCH: a row whose charSheet.name differs from the row's name (finding 2's precondition)
var fs = require("fs"), path = require("path");
var ROOT = "C:/Projects/traffic-and-dragons/Campaigns";
var SLOTS = ["voiceId", "speechifyVoiceId", "inworldVoiceId"], SET = ["voiceDirection", "voiceRate"];
function any(o, list) { var i; for (i = 0; i < list.length; i++) if (o && o[list[i]]) return true; return false; }
var T = { saves: 0, rows: 0, sheetlessPinned: 0, sheetlessSettings: 0, sheetSettings: 0, orphanSlots: 0, orphanSettings: 0, nameMismatch: 0, gated: 0 }, notes = [];
fs.readdirSync(ROOT).forEach(function (camp) {
  var dir = path.join(ROOT, camp, "saves"); if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).filter(function (f) { return /\.tnd$/.test(f); }).forEach(function (f) {
    var j; try { j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { notes.push(f + ": unreadable"); return; }
    var ws = j.worldState || {}; T.saves++; if (ws.sceneRefs) T.gated++;
    (ws.npcs || []).forEach(function (n) {
      if (!n) return; T.rows++;
      if (!n.charSheet) { if (any(n, SLOTS)) T.sheetlessPinned++; if (any(n, SET)) T.sheetlessSettings++; return; }
      if (any(n.charSheet, SET)) T.sheetSettings++;
      if (any(n, SLOTS)) { T.orphanSlots++; notes.push(f + ": row '" + n.name + "' has a sheet and a slot pin on the row"); }
      if (any(n, SET)) { T.orphanSettings++; notes.push(f + ": row '" + n.name + "' has a sheet and a direction/speed on the row"); }
      if (n.charSheet.name !== n.name) { T.nameMismatch++; notes.push(f + ": row '" + n.name + "' holds a sheet named '" + n.charSheet.name + "'" + (n.partyMember ? " (PARTY)" : "")); }
    });
  });
});
console.log(JSON.stringify(T));
notes.slice(0, 30).forEach(function (x) { console.log("  " + x); });
if (notes.length > 30) console.log("  … " + (notes.length - 30) + " more");
