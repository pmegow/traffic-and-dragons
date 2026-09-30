// dev/sabotage-481-f7-party-upload.js — proves the #481 F7 guards are guarded: the party upload plan flags a library copy that
// is AHEAD of the live sheet (a higher level, or saved after the copy the sheet came from), the confirm names each such row
// with its detail, and two party members that map to one library slot are refused (loudly) instead of overwriting each
// other. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-f7-party-upload.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "class bible (#72)"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "a higher library level is not ahead",
    find: "var higher=(ex.level|0)>((sheet&&sheet.level)|0),newer=", replace: "var higher=false,newer=",
    mustFail: "#481 F7 the plan flags a library copy that is AHEAD" },
  { label: "a library copy saved after the sheet's stamp is not ahead",
    find: "newer=typeof ex.updatedAt===\"number\"&&typeof at===\"number\"&&ex.updatedAt>at;", replace: "newer=false;",
    mustFail: "#481 F7 the plan flags a library copy that is AHEAD" },
  { label: "two members on one library slot both upload (one overwrites the other)",
    find: "    if(grp.length>1){if(grp[0]===x)refused.push({slug:slug,names:grp.map(function(g){return g.name;})});continue;}\n", replace: "",
    mustFail: "#481 F7 two party members that map to one library slot" }
]);
prove("ui-browsers.js", [
  { label: "the confirm names an ahead row without its detail",
    find: "aheadRows.map(function(r){return escHtml(partyUploadAheadText(r));})", replace: "aheadRows.map(function(r){return escHtml(r.name);})",
    mustFail: "#481 F7 the shell passes the hero's library stamp" },
  { label: "the plan loses the hero's library stamp",
    find: "partyUploadPlan(worldState.character,livingPartyCompanions(),list||[],worldState.heroLibraryAt);", replace: "partyUploadPlan(worldState.character,livingPartyCompanions(),list||[],null);",
    mustFail: "#481 F7 the shell passes the hero's library stamp" },
  { label: "a refused pair is only logged",
    find: "showToast(\"&#10007; Not uploaded: \"+escHtml(rf.names.join(", replace: "console.info(\"&#10007; Not uploaded: \"+escHtml(rf.names.join(",
    mustFail: "#481 F7 the shell passes the hero's library stamp" }
]);
process.exit(code);
