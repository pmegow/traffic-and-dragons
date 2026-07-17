// capture-stable.js — DEV TOOL (UA1): render buildSysPrompt's STABLE half with a fixed world
// and write it to a file. Run BEFORE and AFTER the tag-table refactor; the two outputs must be
// byte-identical (the derived STATE TAGS block may not change the money-tested prompt by even
// one character at cutover). Usage: node dev/capture-stable.js <outfile>
var fs = require("fs"), path = require("path");
var root = path.join(__dirname, "..");
// Canonical engine load through game.js (dev/load-engine.js, AUDIT_FABLE_07_16_2026 #18/#21):
// tag_table.js loads UNCONDITIONALLY — it has existed since v1.241, and the old "once it
// exists" conditional would have silently masked an accidental deletion. A missing file
// now fails LOUDLY (loadEngine throws).
var engine = require("./load-engine.js");
engine.loadEngine("game.js");

// Fixed world — the shared v10 fixture (#19); only the campaign identity is overridden,
// so both BEFORE and AFTER captures see identical inputs.
engine.makeTestWorld({ campId: "golden", campName: "Golden" });

var s = buildSysPrompt();
var out = process.argv[2] || "dev/golden_stable.txt";
fs.writeFileSync(path.join(root, out), s.stable, "utf8");
console.log("stable half: " + s.stable.length + " chars -> " + out);
