// read-only: what a save holds (shape only)
var fs = require("fs");
var root = process.argv[2], file = process.argv[3];
var l = require(root + "/dev/load-engine.js"); var w0 = console.warn, i0 = console.info; console.warn = function () {}; console.info = function () {}; l.loadEngine("game.js"); console.warn = w0; console.info = i0;
var save = JSON.parse(fs.readFileSync(file, "utf8"));
console.log("save keys", Object.keys(save));
worldState = inflateWorldStateSnapshot(save.worldState); memory = save.memory || { npcs: {} };
console.log("ws keys", Object.keys(worldState).join(","));
console.log("hero", worldState.character.name, "aliases", JSON.stringify(worldState.character.aliases || []), "kind", worldState.kind, "turn", worldState.turn);
console.log("transcript len", (worldState.transcript || []).length, "sample entry keys", worldState.transcript && worldState.transcript.length ? Object.keys(worldState.transcript[worldState.transcript.length - 1]) : null);
var tr = worldState.transcript || [], withTags = 0, i;
for (i = 0; i < tr.length; i++) { var e = tr[i]; var s = JSON.stringify(e); if (/\[NPC[_A-Z]*:/.test(s)) withTags++; }
console.log("transcript entries with an [NPC…: tag", withTags);
var last = tr[tr.length - 1]; console.log("last entry", JSON.stringify(last).slice(0, 700));
console.log("tagLog", worldState.tagLog ? (Array.isArray(worldState.tagLog) ? worldState.tagLog.length + " entries; sample " + JSON.stringify(worldState.tagLog[worldState.tagLog.length - 1]).slice(0, 600) : typeof worldState.tagLog) : "none");
console.log("memory keys", Object.keys(memory).join(","));
console.log("npc count mem/roster", Object.keys(memory.npcs || {}).length, (worldState.npcs || []).length);
var rawKeys = Object.keys(worldState).filter(function (k) { return /raw|tag|ring|prov/i.test(k); }); console.log("raw-ish ws keys", rawKeys);
var sKeys = Object.keys(save).filter(function (k) { return /raw|tag|ring|prov|session/i.test(k); }); console.log("raw-ish save keys", sKeys);
if (save.sessionLog) console.log("sessionLog len", save.sessionLog.length, JSON.stringify(save.sessionLog[save.sessionLog.length - 1]).slice(0, 500));
