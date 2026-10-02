// read-only: how often does the GM key a person by a possessive handle ("X's mother") in the owner's saves, and is X ever the hero or a companion?
var fs = require("fs"), path = require("path"), root = process.argv[2], CAMP = "C:/Projects/traffic-and-dragons/Campaigns";
var l = require(root + "/dev/load-engine.js"); var w0 = console.warn, i0 = console.info; console.warn = function () {}; console.info = function () {}; l.loadEngine("game.js"); console.warn = w0; console.info = i0;
var seen = Object.create(null), total = 0, files = 0, heroPoss = 0, titled = 0;
fs.readdirSync(CAMP).forEach(function (c) {
  var d = path.join(CAMP, c, "saves"); if (!fs.existsSync(d)) return;
  fs.readdirSync(d).filter(function (f) { return /\.tnd$/.test(f); }).forEach(function (f) {
    var save; try { save = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")); } catch (er) { return; } files++;
    worldState = inflateWorldStateSnapshot(save.worldState); memory = save.memory || { npcs: {} };
    var hero = String(worldState.character.name || ""), hCore = npcCoreTokens(hero), names = Object.keys(memory.npcs || {}).concat((worldState.npcs || []).map(function (n) { return n && n.name; }));
    names.forEach(function (n) { if (!n) return; var key = c + "|" + n; if (seen[key]) return; seen[key] = 1; total++;
      var poss = n.indexOf("'s ") >= 0 || n.indexOf("\u2019s ") >= 0, kc = npcCoreTokens(n), sub = hCore.length && hCore.every(function (t) { return kc.indexOf(t) >= 0; });
      if (poss) console.log("possessive key: " + c + " (hero " + hero + "): '" + n + "'" + (sub ? "  <-- holds every word of the hero's name" : ""));
      if (sub) { heroPoss++; if (!poss) console.log("holds the hero's name words: " + c + " (hero " + hero + "): '" + n + "'"); }
    });
  });
});
console.log(files + " saves; " + total + " distinct person keys; " + heroPoss + " hold every distinctive word of the hero's name");
