require("./f02_replay.js");
var fs = require("fs"), label = process.argv[2] || "run", from = parseInt(process.argv[3] || "0", 10), to = parseInt(process.argv[4] || "999999", 10);
var seqs = JSON.parse(fs.readFileSync(__dirname + "/seqs_" + label + ".json", "utf8")), i;
for (i = from; i < Math.min(to, seqs.length); i++) { fs.writeFileSync(__dirname + "/progress_" + TREE + ".txt", String(i)); replaySeq(seqs[i], false); }
console.log("done " + from + ".." + i);
