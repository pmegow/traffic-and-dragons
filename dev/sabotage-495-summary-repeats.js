// dev/sabotage-495-summary-repeats.js — proves the #495 guard is guarded (owner 2026-09-30, the Village t241: 24 separate bolt
// gains printed "+CROSSBOW BOLT" 24 times). The turn's summary line says a repeated label once with its count, through one pure
// function (mutsCollapseRepeats, tag_table.js); R.muts and the provenance ring keep every label. Each mutation runs in a
// disposable clone.
//   node dev/sabotage-495-summary-repeats.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#431 here line"]], T = "#495 the summary line says a repeated label once";
process.exit(sabotage.prove({ file: "tag_table.js", command: CMD, cases: [
  { label: "the line lists every repeat again",
    find: "var lines=mutsCollapseRepeats((R&&R.muts)?R.muts:[]),here=", replace: "var lines=((R&&R.muts)?R.muts.slice():[]),here=",
    mustFail: T },
  { label: "the collapse is written back into R.muts (the provenance ring loses the labels)",
    find: "function mutsSummaryEmit(R){\n  var lines=mutsCollapseRepeats(", replace: "function mutsSummaryEmit(R){\n  if(R&&R.muts)R.muts=mutsCollapseRepeats(R.muts);\n  var lines=mutsCollapseRepeats(",
    mustFail: T },
  { label: "only neighbouring repeats collapse",
    find: "if(Object.prototype.hasOwnProperty.call(at,s)){out[at[s]].n++;continue;}", replace: "if(out.length&&out[out.length-1].s===s){out[out.length-1].n++;continue;}",
    mustFail: T },
  { label: "the repeats collapse silently, with no count",
    find: "return out.map(function(o){return o.n>1?o.s+\" (x\"+o.n+\")\":o.s;});", replace: "return out.map(function(o){return o.s;});",
    mustFail: T }
]}) ? 1 : 0);
