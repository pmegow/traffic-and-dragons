// doc-dump.js — write buildStateTagsDoc() of a tree: node dev/review-702-3/doc-dump.js <ROOT> <outfile>
var path = require("path"), fs = require("fs");
var engine = require(path.join(process.argv[2], "dev", "load-engine.js"));
engine.loadEngine();
var doc = buildStateTagsDoc();
fs.writeFileSync(process.argv[3], doc);
console.log("standing doc " + doc.length + " chars, mentions MAP_PLACE: " + (doc.indexOf("MAP_PLACE") >= 0) + " -> " + process.argv[3]);
