// Probe: does the CI-shaped lint-todo invocation catch a TODO.md row reusing an id that lives in TODO_Atlas.md?
var fs = require("fs"), path = require("path"), cp = require("child_process");
var R = "C:/Projects/traffic-and-dragons", S = __dirname;
var todo = fs.readFileSync(R + "/TODO.md", "utf8");
var atlas = fs.readFileSync(R + "/TODO_Atlas.md", "utf8");
var atlasId = /^\|\s*(\d+)\s*\|/m.exec(atlas)[1];
var cand = todo + "\n\n## Probe\n\n| # | t |\n|---|---|\n| " + atlasId + " | duplicate of an atlas row |\n";
fs.writeFileSync(S + "/cand-TODO.md", cand);
fs.writeFileSync(S + "/head-TODO.md", todo);
fs.copyFileSync(R + "/DOC/TODO_ARCHIVE.md", S + "/arch.md");
function run(extra) {
  var r = cp.spawnSync(process.execPath, [R + "/dev/lint-todo.js", "--git-aware", "--cap-changed", "--file", S + "/cand-TODO.md", "--head-file", S + "/head-TODO.md", "--archive-file", S + "/arch.md", "--head-archive", S + "/arch.md"].concat(extra || []), { encoding: "utf8" });
  return "exit " + r.status + " :: " + (r.stdout + r.stderr).trim().split("\n").slice(0, 3).join(" | ");
}
console.log("atlas id reused: #" + atlasId);
console.log("CI-shaped lint (as engine-tests.yml runs it):", run());
// Control: the same id duplicated inside TODO.md itself is caught (so the probe can fail).
fs.writeFileSync(S + "/cand-TODO.md", cand + "| " + atlasId + " | second copy in TODO.md |\n");
console.log("control (two copies inside TODO.md):", run());
// Atlas file itself: shape damage in TODO_Atlas.md — what lints it?
var broken = atlas.replace(/^(\| \d+ \|[^\n]*)\|\s*$/m, "$1");   // drop a row's closing pipe
console.log("atlas row closing pipe removed:", broken !== atlas);
var r2 = cp.spawnSync(process.execPath, [R + "/dev/check-todo-columns.js", "--file", R + "/TODO_Atlas.md"], { encoding: "utf8" });
console.log("check-todo-columns on the live atlas file (only when given --file; hook/CI never pass it):", r2.status, (r2.stdout + r2.stderr).trim());
