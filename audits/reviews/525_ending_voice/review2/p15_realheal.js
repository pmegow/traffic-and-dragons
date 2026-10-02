// Probe 15 (read-only, in memory): every owner save through the real load path (migrateWorldState) three times, with a
// serialize/inflate round trip between passes; endings and all other moments compared.
require("./h.js");
var fs = require("fs"), path = require("path");
var ROOT = "C:/Projects/traffic-and-dragons/Campaigns", total = 0, changed1 = 0, changedLater = 0, otherChanged = 0, files = 0, threw = 0;
function moments() {
  var out = [], sheets = [worldState.character].concat((worldState.npcs || []).map(function (n) { return n && n.charSheet; }));
  sheets.forEach(function (cs, si) { if (!cs || !Array.isArray(cs.coreMemories)) return; cs.coreMemories.forEach(function (m, mi) { if (m) out.push({ k: si + "." + mi, kind: m.kind, text: m.text }); }); });
  return out;
}
fs.readdirSync(ROOT).forEach(function (camp) {
  var sd = path.join(ROOT, camp, "saves"); if (!fs.existsSync(sd)) return;
  fs.readdirSync(sd).filter(function (f) { return /\.tnd$/i.test(f); }).forEach(function (f) {
    var save = JSON.parse(fs.readFileSync(path.join(sd, f), "utf8")); if (!save.worldState || !save.worldState.character) return; files++;
    try {
      quiet(function () {
        worldState = inflateWorldStateSnapshot(save.worldState); memory = save.memory || blankMemory(); sessionLog = save.sessionLog || [];
        var m0 = moments(); migrateWorldState(); var m1 = moments();
        worldState = inflateWorldStateSnapshot(JSON.parse(serializeWorldState())); migrateWorldState(); var m2 = moments();
        worldState = inflateWorldStateSnapshot(JSON.parse(serializeWorldState())); migrateWorldState(); var m3 = moments();
        var i;
        for (i = 0; i < m0.length; i++) {
          if (m0[i].kind === "ending") { total++; if (m1[i].text !== m0[i].text) changed1++; if (m2[i].text !== m1[i].text || m3[i].text !== m2[i].text) changedLater++; }
          else if (m1[i].text !== m0[i].text || m3[i].text !== m0[i].text) otherChanged++;
        }
        if (m1.length !== m0.length || m3.length !== m0.length) otherChanged++;
      });
    } catch (e) { threw++; console.log("THREW on " + f + ": " + e.message); }
  });
});
console.log("saves: " + files + " | ending moments: " + total + " | changed by the first load: " + changed1 + " | changed by a second or third load: " + changedLater + " | non-ending moments changed or lost: " + otherChanged + " | throws: " + threw);
