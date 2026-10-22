// dev/sabotage-658-top-inset.js — proves the #658 guards (the top inset): the 1.7× definition, a reader that goes back
// to env() in index.html or mobile.css, and a top-docked rule that drops the variable must each turn the #658 section red.
//   node dev/sabotage-658-top-inset.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#658"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("index.html", [
  { label: "the glass clearance goes (1.7× becomes 1×)",
    find: ":root { --top-inset: calc(env(safe-area-inset-top, 0px) * 1.7); }", replace: ":root { --top-inset: calc(env(safe-area-inset-top, 0px) * 1); }",
    mustFail: "must define" },
  { label: "the topbar reads env() again",
    find: "#topbar    { padding-top:    max(8px,  var(--top-inset)); }", replace: "#topbar    { padding-top:    max(8px,  env(safe-area-inset-top, 0px)); }",
    mustFail: "reads env(safe-area-inset-top)" },
  { label: "the sidebar drops the variable",
    find: "#sidebar   { padding-top:    max(16px, var(--top-inset)); }", replace: "#sidebar   { padding-top:    max(16px, 0px); }",
    mustFail: "the nine top-docked rules" }
]);
prove("mobile.css", [
  { label: "the phone's HUD buttons read env() again",
    find: "top:max(7px,var(--top-inset));gap:0!important}", replace: "top:max(7px,env(safe-area-inset-top,0px));gap:0!important}",
    mustFail: "reads env(safe-area-inset-top)" }
]);
process.exit(code);
