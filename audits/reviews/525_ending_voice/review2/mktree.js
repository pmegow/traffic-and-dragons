// mktree.js <sha> <name> — extract the engine files (root *.js + dev/engine-manifest.js + dev/load-engine.js) of a commit into ./trees/<name>.
// Read-only against the worktree: uses `git show <sha>:<file>` only.
var cp = require("child_process"), fs = require("fs"), path = require("path");
var WT = "C:/Users/hannu/AppData/Local/Temp/claude/C--Projects-traffic-and-dragons/0b524b92-af76-49d1-b6c9-f6ca4673077c/scratchpad/wt-rev3";
var sha = process.argv[2], name = process.argv[3];
if (!sha || !name) { console.error("usage: node mktree.js <sha> <name>"); process.exit(1); }
var out = path.join(__dirname, "trees", name);
fs.mkdirSync(path.join(out, "dev"), { recursive: true });
var files = cp.execFileSync("git", ["-C", WT, "ls-tree", "--name-only", sha], { encoding: "utf8" }).split("\n").filter(function (f) { return /\.js$/.test(f); });
files.push("dev/engine-manifest.js", "dev/load-engine.js");
files.forEach(function (f) {
  var buf = cp.execFileSync("git", ["-C", WT, "show", sha + ":" + f], { maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(path.join(out, f), buf);
});
console.log(name + ": " + files.length + " files from " + sha + " -> " + out);
