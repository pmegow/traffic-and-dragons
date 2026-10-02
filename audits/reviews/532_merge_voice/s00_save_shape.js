// READ-ONLY look at one owner save: top-level shape only (no content printed beyond key names and counts).
var fs = require("fs");
var f = process.argv[2];
var raw = fs.readFileSync(f, "utf8");
var j = JSON.parse(raw);
console.log("top keys:", Object.keys(j));
var ws = j.worldState || j.ws || j.state || null, mem = j.memory || null;
if (ws) console.log("ws keys:", Object.keys(ws).slice(0, 80).join(","));
if (mem) console.log("mem keys:", Object.keys(mem).join(","));
if (mem && mem.archive) console.log("archive keys:", Object.keys(mem.archive).join(","), "identityMerges:", (mem.archive.identityMerges || []).length);
if (ws) console.log("npcs:", (ws.npcs || []).length, "sceneRefs:", !!ws.sceneRefs, "turn:", ws.turn, "tagLog:", (ws.tagLog || []).length);
