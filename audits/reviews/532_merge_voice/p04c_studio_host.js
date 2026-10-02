// The second offline host, dev/npc-merge-studio.html: load EXACTLY its <script src> list (read from the page itself) in node
// and drive the NPC_MERGE handler the way the studio's core does. Checks (a) whether a merge completes at all there and
// (b) which voice fields it carries (tts.js is not in the list).
//   node p04c_studio_host.js <before|after>
var fs = require("fs"), path = require("path");
var SP = "C:/Users/hannu/AppData/Local/Temp/claude/C--Projects-traffic-and-dragons/0b524b92-af76-49d1-b6c9-f6ca4673077c/scratchpad";
var which = process.argv[2] || "after", ROOT = which === "before" ? SP + "/wt-before" : SP + "/wt-rev";
function out(l, v) { console.log("[" + which.toUpperCase() + "] " + l + ": " + (typeof v === "string" ? v : JSON.stringify(v))); }
var html = fs.readFileSync(path.join(ROOT, "dev/npc-merge-studio.html"), "utf8"), list = [], m, re = /<script src="([^"]+)"><\/script>/g;
while ((m = re.exec(html))) list.push(m[1]);
out("studio script list", list);
var geval = eval, ow = console.warn, oi = console.info;
console.warn = function () {}; console.info = function () {};
list.forEach(function (src) { geval(fs.readFileSync(path.join(ROOT, "dev", src), "utf8")); });
console.warn = ow; console.info = oi;
out("typeof TTS / relationshipRekeyEntity / voicePinFields", [typeof TTS, typeof relationshipRekeyEntity, typeof voicePinFields]);
var j = JSON.parse(fs.readFileSync(path.join(SP, "review5/voice/p04_synthetic.tnd"), "utf8"));
worldState = j.worldState; memory = j.memory; sessionLog = [];
var h = null, i; for (i = 0; i < TAG_TABLE.length; i++) if (TAG_TABLE[i].t === "NPC_MERGE") h = TAG_TABLE[i];
var R = { muts: [], turn: worldState.turn, errors: [] }, err = null;
console.warn = function () {}; console.info = function () {};
try { h.apply("[NPC_MERGE:Aldern Foxglove|the hooded man]", R); } catch (e) { err = e; }
console.warn = ow; console.info = oi;
out("handler result", err ? "THREW " + err.message : "completed " + JSON.stringify(R.muts));
var F = ["voiceId", "speechifyVoiceId", "inworldVoiceId", "voiceDirection", "voiceRate"];
worldState.npcs.forEach(function (n) { var r = {}; F.forEach(function (k) { if (k in n) r[k] = n[k]; }); out("row " + JSON.stringify(n.name) + " voice fields", r); });
