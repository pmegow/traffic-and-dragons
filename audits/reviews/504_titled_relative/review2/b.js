// agent2 wrapper around the first reviewer's base.js (unmodified). TREE=head (default) | before (v1.1109, the tree before #533/#534/#535).
var t = process.env.TREE || "head";
process.env.PROBE_TREE = t === "head" ? "head" : "../agent2/" + t;
require("C:/Users/hannu/AppData/Local/Temp/claude/C--Projects-traffic-and-dragons/0b524b92-af76-49d1-b6c9-f6ca4673077c/scratchpad/r504/agent/base.js");
global.TREE = t;
global.K = "Queen Underbough \u00b0t85";
// the #504 fixture: Wilhelmina Underbough on file, the queen named by title at t85 -> provisional; then turn 86.
global.q = function (opts) {
  fresh(opts); person("Wilhelmina Underbough", "she/her");
  quiet(function () { applyMuts("[NPC:Queen Underbough|furious|hostile]"); });
  worldState.turn = 86;
};
global.dump = function (label) { console.log((label ? label + " " : "") + "ROWS: " + rows() + "\n   MEM: " + mems()); };
global.go = function (text) { var r = run(text); console.log("  > " + text + "\n    muts=" + JSON.stringify(r.muts) + (r.warns.length ? "\n    warns=" + JSON.stringify(r.warns.map(function (w) { return w.slice(0, 220); })) : "")); return r; };
