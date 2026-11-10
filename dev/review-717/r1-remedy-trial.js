// r1-remedy-trial.js — tries finding 1's recommended remedy in a SCRATCH checkout (never this tree): in atlasTread, no
// leg on a sheet when both ends show the party WITHIN the same child zone. Applies the one-line change to
// <SCRATCH>/atlas.js, runs the whole atlas engine suite there and p14 (the underground walk) against it, and restores
// the file byte-identical. Shows whether the remedy closes the finding without reddening a group.
// node dev/review-717/r1-remedy-trial.js <SCRATCH checkout of ab55473b>
var fs = require("fs"), path = require("path"), cp = require("child_process");
var SCRATCH = process.argv[2];
if (!SCRATCH || path.resolve(SCRATCH) === path.resolve(__dirname, "..", "..")) { console.error("usage: node r1-remedy-trial.js <scratch checkout> — never the review tree itself"); process.exit(2); }
var f = path.join(SCRATCH, "atlas.js"), orig = fs.readFileSync(f, "utf8");
var find = "      if(a&&b&&a!==b){pair=a<b?[a,b]:[b,a];", repl = "      if(a&&b&&a!==b&&!(was[z]&&now[z]&&was[z].within&&was[z].within===now[z].within)){pair=a<b?[a,b]:[b,a];";
if (orig.split(find).length !== 2) { console.error("the anchor matches " + (orig.split(find).length - 1) + " times"); process.exit(3); }
fs.writeFileSync(f, orig.replace(find, function () { return repl; }), "utf8");
try {
  var e = cp.spawnSync("node", ["dev/tests-684-atlas-engine.js"], { cwd: SCRATCH, encoding: "utf8", timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
  console.log("the atlas engine suite with the remedy: exit " + e.status + " — " + ((e.stdout || "").split(/\r?\n/).filter(function (l) { return /ALL GREEN|FAILED/.test(l); })[0] || "") + ((e.stderr || "").split(/\r?\n/).filter(function (l) { return /^FAIL/.test(l); }).map(function (l) { return "\n  " + l.slice(0, 140); }).join("")));
  [["campaign-1", "1"], ["campaign-1", "0"]].forEach(function (a) {
    var p = cp.spawnSync("node", [path.join(__dirname, "p14-underground-walk.js"), SCRATCH, a[0], a[1]], { encoding: "utf8", timeout: 300000 });
    console.log("p14 (place " + a[1] + ") with the remedy:\n" + (p.stdout || "").split(/\r?\n/).filter(function (l) { return /TOWN record|sewer record|town's sheet shows/.test(l); }).join("\n"));
  });
} finally { fs.writeFileSync(f, orig, "utf8"); }
console.log(fs.readFileSync(f, "utf8") === orig ? "atlas.js restored byte-identical" : "RESTORE FAILED");
