// usage: TREE=head|before node f05_trace.js <label> <index>
require("./f02_replay.js");
var fs = require("fs"), label = process.argv[2], idx = parseInt(process.argv[3], 10);
var seqs = JSON.parse(fs.readFileSync(__dirname + "/seqs_" + label + ".json", "utf8"));
console.log("cfg " + JSON.stringify(seqs[idx].cfg));
var s = replaySeq(seqs[idx], true); console.log("SIGS: " + Object.keys(s).join(" | "));
