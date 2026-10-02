// read-only: the provenance ring (worldState.tagLog) of every save — labels that name the player, epithets, aliases, merges, swaps.
var fs = require("fs"), path = require("path"), root = process.argv[2], CAMP = "C:/Projects/traffic-and-dragons/Campaigns";
var l = require(root + "/dev/load-engine.js"); var w0 = console.warn, i0 = console.info; console.warn = function () {}; console.info = function () {}; l.loadEngine("game.js"); console.warn = w0; console.info = i0;
var seen = Object.create(null), n = 0, files = 0, tagCounts = Object.create(null), swaps = 0;
fs.readdirSync(CAMP).forEach(function (c) {
  var d = path.join(CAMP, c, "saves"); if (!fs.existsSync(d)) return;
  fs.readdirSync(d).filter(function (f) { return /\.tnd$/.test(f); }).forEach(function (f) {
    var save; try { save = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")); } catch (er) { return; } files++;
    worldState = inflateWorldStateSnapshot(save.worldState); memory = save.memory || { npcs: {} };
    var hero = worldState.character.name;
    if (worldState.recentSwitch) { swaps++; console.log(c + "/" + f + " recentSwitch " + JSON.stringify(worldState.recentSwitch)); }
    (worldState.tagLog || []).forEach(function (e) {
      (e.tags || []).forEach(function (t) { tagCounts[t] = (tagCounts[t] || 0) + 1; });
      (e.m || []).forEach(function (m) {
        var key = c + "|" + e.t + "|" + m; if (seen[key]) return; seen[key] = 1;
        if (/refused \(player\)|^Epithet|^Alias:|^Merged:|Epithet refused|^Pronouns:|^Party:/.test(m)) { n++; console.log(c + " t" + e.t + " (hero " + hero + "): " + m); }
      });
    });
  });
});
console.log(files + " saves; " + n + " distinct labels of interest; swaps recorded: " + swaps);
var want = ["NPC", "NPC_NOTE", "NPC_PRONOUN", "NPC_ALIAS", "NPC_MERGE", "NPC_SUPERSEDE", "PARTY_MEMBER", "ALIAS", "MERGE", "NPC_LINK", "NPC_DEATH_REPORTED", "SAY", "SCENE_CAST"];
console.log("tag counts over all rings (not deduped across saves): " + want.map(function (t) { return t + "=" + (tagCounts[t] || 0); }).join(" "));
