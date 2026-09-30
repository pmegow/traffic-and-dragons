// dev/sabotage-481-c4-title-key.js — proves the #481 C4 guards are guarded: ONE skeleton title key on BOTH sides of every act/arc
// title compare, and a real mismatch is said and asked once. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-c4-title-key.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 C4"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "the key keeps the display numbering",
    find: ".trim().replace(/^(?:act|arc)\\s*\\d+\\s*[:.\\-–—]\\s*/i,\"\").trim().toLowerCase();}", replace: ".trim().toLowerCase();}",
    mustFail: "skeletonTitleKey strips" }
]);
prove("tag_table.js", [
  { label: "the ACT_COMPLETE compare uses the raw title again (the Necrotic act stays open)",
    find: "      if(_cAct.title&&skeletonTitleKey(_cAct.title)!==skeletonTitleKey(_at)){/* #481 C4 */", replace: "      if(_cAct.title&&_cAct.title.toLowerCase()!==_at.toLowerCase()){",
    mustFail: "both field shapes close" },
  { label: "the ARC_COMPLETE snapshot keys the raw title (the fae arc is ignored)",
    find: "_pre[skeletonTitleKey(_pa[_sj].title)]=1;}}/* #481 C4 */", replace: "_pre[_pa[_sj].title.toLowerCase()]=1;}}",
    mustFail: "both field shapes close" },
  { label: "ARC_CONTINUE compares the raw title",
    find: "skeletonTitleKey(_carcs[_cj].title)!==skeletonTitleKey(_ct))continue;/* #481 C4 */", replace: "_carcs[_cj].title.toLowerCase()!==_ct.toLowerCase())continue;",
    mustFail: "both field shapes close" },
  { label: "a real mismatch is console-only again",
    find: "  R.muts.push(\"⚠ \"+(kind===\"act\"?\"Act\":\"Arc\")+\" close ignored — '\"", replace: "  void(\"⚠ \"+(kind===\"act\"?\"Act\":\"Arc\")+\" close ignored — '\"",
    mustFail: "a real mismatch still refuses" }
]);
process.exit(code);
