var fs = require("fs"), f = process.argv[2], label = process.argv[3];
if (!fs.existsSync(f)) { console.log("[" + label + "] no output file written"); process.exit(0); }
var j = JSON.parse(fs.readFileSync(f, "utf8")), F = ["voiceId", "speechifyVoiceId", "inworldVoiceId", "voiceDirection", "voiceRate"];
j.worldState.npcs.forEach(function (n) { var r = {}; F.forEach(function (k) { if (k in n) r[k] = n[k]; }); console.log("[" + label + "] merged save row " + JSON.stringify(n.name) + " voice fields: " + JSON.stringify(r)); });
