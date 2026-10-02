// read-only: which transcript fields carry tags
var fs = require("fs");
var root = process.argv[2], file = process.argv[3];
var l = require(root + "/dev/load-engine.js"); var w0 = console.warn, i0 = console.info; console.warn = function () {}; console.info = function () {}; l.loadEngine("game.js"); console.warn = w0; console.info = i0;
var save = JSON.parse(fs.readFileSync(file, "utf8"));
worldState = inflateWorldStateSnapshot(save.worldState); memory = save.memory || { npcs: {} };
var tr = worldState.transcript || [], i, seen = {};
for (i = tr.length - 1; i >= 0 && Object.keys(seen).length < 13; i--) { var e = tr[i]; Object.keys(e).forEach(function (k) { if (!seen[k] && k !== "x") { seen[k] = 1; console.log(k, "=>", JSON.stringify(e[k]).slice(0, 400)); } }); }
var cnt = 0; for (i = 0; i < tr.length; i++) if (tr[i].ta) cnt++;
console.log("entries with ta:", cnt, "of", tr.length);
