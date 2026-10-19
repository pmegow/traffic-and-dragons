// dev/sabotage-b46-say-what-they-are.js — proves the B46 clause of rule 4 is guarded: on first sight every figure
//   and every group gets its kind in a word or two, unnamed crowds included, a sheeted character keeps the
//   sheet's look, and the clause lives IN rule 4 (never a 29th rule).
//   node dev/sabotage-b46-say-what-they-are.js
var sabotage = require("./sabotage.js");
var rc = sabotage.prove({
  file: "data.js",
  command: ["node", ["dev/run-tests.js", "B46"]],
  cases: [
    { label: "the clause loses its name — rule 4 casts many peoples again but no longer asks the prose to say what they are",
      find: " SAY WHAT THEY ARE: on first sight give", replace: " On first sight give" },
    { label: "unnamed crowds are excused",
      find: " — unnamed crowds included;", replace: ";" },
    { label: "a sheeted character may be re-described — the #623 'pale Daeris' class returns",
      find: " a character who has a sheet keeps the sheet's look;", replace: "" },
    { label: "the reason is dropped — an unstated kind becomes a permissible mystery",
      find: " a figure whose kind is never stated is a hole in the scene, not a mystery.", replace: "" },
    { label: "the clause becomes a 29th rule instead of riding rule 4",
      find: "continuity genuinely matters.) SAY WHAT THEY ARE:", replace: "continuity genuinely matters.)\",\"SAY WHAT THEY ARE:" }
  ]
});
process.exit(rc);
