// Builds a SYNTHETIC .tnd (fake data, engine fixture world) in this folder for the offline merge tool probe.
require("./h.js");
var fs = require("fs"), path = require("path");
makeWorld();
function row(name, pron) { memory.npcs[name] = { attitude: "wary", knowledge: ["Wears a grey hood."], events: [{ turn: 3, note: "Stopped the party at the alley mouth." }], aliases: [], pronouns: pron }; var r = { name: name, status: "present", rel: "neutral", pronouns: pron, met: 1, partyMember: false, portrait: null, aliases: [] }; worldState.npcs.push(r); return r; }
var d = row("the hooded man", "he/him");
d.voiceId = "en_US-libritts_r-medium#123"; d.speechifyVoiceId = "heard-speechify-actor"; d.inworldVoiceId = "heard-inworld-actor"; d.voiceDirection = "low, unhurried"; d.voiceRate = 0.9;
row("Aldern Foxglove", "he/him");
fs.writeFileSync(path.join(__dirname, "p04_synthetic.tnd"), JSON.stringify({ worldState: worldState, sessionLog: [], memory: memory }));
out("synthetic save written", "p04_synthetic.tnd; duplicate row pins " + JSON.stringify(pins(d)));
