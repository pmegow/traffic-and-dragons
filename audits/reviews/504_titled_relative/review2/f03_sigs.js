// Runs EVERY recorded sequence (seqs_<label>.json) on this tree and writes the violation set of each to sigs_<label>_<tree>.json.
// usage: TREE=head|before node f03_sigs.js <label>
require("./f02_replay.js");
var fs = require("fs"), label = process.argv[2] || "run";
var seqs = JSON.parse(fs.readFileSync(__dirname + "/seqs_" + label + ".json", "utf8")), out = [], i;
for (i = 0; i < seqs.length; i++) out.push(Object.keys(replaySeq(seqs[i], false)).sort());
fs.writeFileSync(__dirname + "/sigs_" + label + "_" + TREE + ".json", JSON.stringify(out));
console.log(seqs.length + " sequences replayed on " + TREE);
