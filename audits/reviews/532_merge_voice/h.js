// Probe harness for the #532/#539 review. Wraps the shared harness (engine up to game.js) and then loads the
// REST of the engine manifest (audio-events.js, tts.js, sound.js, ...) so TTS is real. READ-ONLY on both trees.
// Usage: node probe.js <before|after>
var SP = "C:/Users/hannu/AppData/Local/Temp/claude/C--Projects-traffic-and-dragons/0b524b92-af76-49d1-b6c9-f6ca4673077c/scratchpad";
var which = process.argv[2] || "after";
var ROOT = which === "before" ? SP + "/wt-before" : SP + "/wt-rev";
process.env.ENGINE_ROOT = ROOT;
require(SP + "/thu/vtags/harness.js");
var fs = require("fs"), path = require("path");
var FILES = require(ROOT + "/dev/load-engine.js").FILES;
var geval = eval;
var _ow = console.warn, _oi = console.info, _od = console.debug;
console.warn = function () {}; console.info = function () {}; console.debug = function () {};
var from = FILES.indexOf("game.js") + 1, i;
for (i = from; i < FILES.length; i++) geval(fs.readFileSync(path.join(ROOT, FILES[i]), "utf8"));
console.warn = _ow; console.info = _oi; console.debug = _od;
global.WHICH = which; global.ROOT = ROOT;
global.out = function (label, v) { console.log("[" + which.toUpperCase() + "] " + label + ": " + (typeof v === "string" ? v : JSON.stringify(v))); };
// captures console.info lines too (the #532 fill reports through console.info)
global.pins = function (o) { if (!o) return null; var f = ["voiceId", "speechifyVoiceId", "inworldVoiceId", "voiceDirection", "voiceRate"], r = {}, k; for (k = 0; k < f.length; k++) if (f[k] in o) r[f[k]] = o[f[k]]; return r; };
global.loadUi = function (file) { geval(fs.readFileSync(path.join(ROOT, file), "utf8")); };
module.exports = { ROOT: ROOT, which: which };
