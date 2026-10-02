// Probe 6: capture buildSysPrompt (both halves) + buildCoreMemoryBlock for every owner save's latest file, per engine tree.
// usage: ER=<tree> node p6_capture.js <outdir> [migrate]
require("./h.js");
var fs = require("fs"), path = require("path"), crypto = require("crypto");
var out = process.argv[2], doMig = process.argv[3] === "migrate";
var ROOT = "C:/Projects/traffic-and-dragons/Campaigns";
fs.mkdirSync(out, { recursive: true });
var seedv = 12345; Math.random = function () { seedv = (seedv * 1103515245 + 12345) & 0x7fffffff; return seedv / 0x7fffffff; };
fs.readdirSync(ROOT).forEach(function (camp) {
  var sd = path.join(ROOT, camp, "saves"); if (!fs.existsSync(sd)) return;
  var files = fs.readdirSync(sd).filter(function (f) { return /\.tnd$/i.test(f); });
  files.forEach(function (f) {
    var save; try { save = JSON.parse(fs.readFileSync(path.join(sd, f), "utf8")); } catch (e) { console.log("cannot parse " + f); return; }
    if (!save.worldState || !save.worldState.character) return;
    seedv = 12345;
    var q = quiet(function () {
      worldState = inflateWorldStateSnapshot(save.worldState); memory = save.memory || blankMemory(); sessionLog = save.sessionLog || [];
      if (doMig) migrateWorldState();
      lastAction = "I look around.";
      var cm = buildCoreMemoryBlock();
      var sys = buildSysPrompt();
      return { cm: cm, sys: sys };
    });
    var r = q.r, text = "##### CORE MEMORY BLOCK\n" + r.cm + "\n##### STABLE\n" + r.sys.stable + "\n##### VOLATILE\n" + r.sys.volatile;
    fs.writeFileSync(path.join(out, f.replace(/\.tnd$/i, ".txt")), text, "utf8");
    var endings = 0; [worldState.character].concat((worldState.npcs || []).map(function (n) { return n && n.charSheet; })).forEach(function (cs) { if (cs && Array.isArray(cs.coreMemories)) cs.coreMemories.forEach(function (m) { if (m && m.kind === "ending") endings++; }); });
    console.log(f + "  kind=" + (worldState.kind || "adventure") + " turn=" + worldState.turn + " endings=" + endings + " sha=" + crypto.createHash("sha256").update(text, "utf8").digest("hex").slice(0, 12));
  });
});
