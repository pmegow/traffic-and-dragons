// dev/sabotage-370-growth.js — proves the #370 companion rules are guarded: growth only lands on screen and only
// against the flaw as written; the party block carries the flaw-must-cost clause.
//   node dev/sabotage-370-growth.js
var sabotage = require("./sabotage.js");
var rc1 = sabotage.prove({
  file: "tag_table.js",
  command: ["node", ["dev/run-tests.js", "#370"]],
  cases: [
    { label: "the on-screen check is dropped — growth lands for a companion the prose never names",
      find: 'if(!companionGrowthOnScreen(text,gcs)){', replace: 'if(false){', mustFail: "#370 growth: [COMPANION_GROWTH:Name|flaw|replacement]" },
    { label: "the growth toast is dropped (#347: every filing toasts)",
      find: 'if(typeof showToast==="function")showToast("\\u2605 "+gname+" outgrows a flaw: "+gres.now);', replace: '', mustFail: "#370 growth: [COMPANION_GROWTH:Name|flaw|replacement]" }
  ]
});
var rc2 = sabotage.prove({
  file: "helpers.js",
  command: ["node", ["dev/run-tests.js", "#370"]],
  cases: [
    { label: "the flaw match is dropped — any stated flaw rewrites the sheet",
      find: 'if(!ok)return null;var now=', replace: 'var now=', mustFail: "#370 growth: [COMPANION_GROWTH:Name|flaw|replacement]" }
  ]
});
process.exit(rc1 || rc2);
