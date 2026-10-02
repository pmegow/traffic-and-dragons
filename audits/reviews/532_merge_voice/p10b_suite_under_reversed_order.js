// Runs the REAL suite section (dev/run-tests.js "#532" from the AFTER tree) while tag_table.js is served with the merge
// fill's source order REVERSED, in memory only (fs.readFileSync wrapped; nothing on disk changes).
//   node p10b_suite_under_reversed_order.js            -> reversed order
//   node p10b_suite_under_reversed_order.js control    -> control: the fill removed (the suite must go red)
var fs = require("fs"), path = require("path");
var ROOT = "C:/Users/hannu/AppData/Local/Temp/claude/C--Projects-traffic-and-dragons/0b524b92-af76-49d1-b6c9-f6ca4673077c/scratchpad/wt-rev";
var CONTROL = process.argv[2] === "control";
var FIND = "[_mgCanN.charSheet&&_mgCanN.charSheet===_mgDupN.charSheet?_mgCanN:null,_mgDupN.charSheet,_mgDupN]";
var REPL = CONTROL ? "[]" : "[_mgDupN,_mgDupN.charSheet,_mgCanN.charSheet&&_mgCanN.charSheet===_mgDupN.charSheet?_mgCanN:null]";
var real = fs.readFileSync, hits = 0;
fs.readFileSync = function (p) {
  var t = real.apply(fs, arguments);
  if (/wt-rev[\\/]tag_table\.js$/.test(String(p)) && typeof t === "string" && t.indexOf(FIND) >= 0) { hits++; return t.replace(FIND, REPL); }
  return t;
};
process.on("exit", function (c) { console.log("[probe] mode=" + (CONTROL ? "control (no sources)" : "reversed order") + " substitutions served=" + hits + " exit code=" + c); });
process.chdir(ROOT);
process.argv = [process.argv[0], path.join(ROOT, "dev/run-tests.js"), "#532"];
require(path.join(ROOT, "dev/run-tests.js"));
