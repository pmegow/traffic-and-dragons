// dev/sabotage-481-c5-scene-boundary.js — proves the #481 C5 guards are guarded: a scene (outfit, relationship dynamics)
// stays in its campaign — the boundary helper at every adoption site leaves it at the door (worn and bonds untouched), an
// outfit is stamped with its campaign, and the renders omit a negative age. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-c5-scene-boundary.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 C5"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "every turn is live (the negative age is served)",
    find: "function sceneTurnLive(turn){var now=", replace: "function sceneTurnLive(turn){return true;var now=",
    mustFail: "renders neither line" },
  { label: "an incoming outfit crosses the boundary",
    find: "  var o=sheet.outfit;if(o&&!((o.camp!==undefined||o.campId)&&campIsCurrent(o)))delete sheet.outfit;\n", replace: "",
    mustFail: "the boundary: an incoming sheet" },
  { label: "incoming dynamics cross the boundary",
    find: "  (sheet.relationships||[]).forEach(function(r){if(r&&r.dynamic){r.dynamic=\"\";r.dynamicTurn=null;}});\n", replace: "",
    mustFail: "the boundary: an incoming sheet" },
  { label: "the boundary strips worn gear too",
    find: "  (sheet.relationships||[]).forEach(function(r){if(r&&r.dynamic){r.dynamic=\"\";r.dynamicTurn=null;}});\n", replace: "  (sheet.relationships||[]).forEach(function(r){if(r&&r.dynamic){r.dynamic=\"\";r.dynamicTurn=null;}});sheet.worn=[];\n",
    mustFail: "the boundary: an incoming sheet" }
]);
prove("api.js", [
  { label: "the outfit is filed without its campaign",
    find: "if(typeof campStampOn===\"function\")campStampOn(cs.outfit);/* #481 C5 (d): C8's stamper */", replace: "",
    mustFail: "an outfit is filed with the campaign's stamp" },
  { label: "the attire line ignores the age",
    find: "o=cs.outfit&&cs.outfit.text&&(typeof sceneTurnLive!==\"function\"||sceneTurnLive(cs.outfit.turn))?cs.outfit:null;/* #481 C5: a negative age is another campaign's */", replace: "o=cs.outfit&&cs.outfit.text?cs.outfit:null;",
    mustFail: "renders neither line" },
  { label: "the party block serves a companion's foreign dynamic",
    find: "if(_pmR[_pmRi].dynamic&&(typeof sceneTurnLive!==\"function\"||sceneTurnLive(_pmR[_pmRi].dynamicTurn)))", replace: "if(_pmR[_pmRi].dynamic)",
    mustFail: "renders neither line" },
  { label: "the hero block serves a foreign dynamic",
    find: "if(_pcR[_pcRi].dynamic&&(typeof sceneTurnLive!==\"function\"||sceneTurnLive(_pcR[_pcRi].dynamicTurn)))", replace: "if(_pcR[_pcRi].dynamic)",
    mustFail: "renders neither line" }
]);
prove("game.js", [
  { label: "a resident's import bypasses the boundary",
    /* #599 (b): the cross is the registry's scene entry, cross mode only — a door that calls its import same-campaign data bypasses it */
    find: "{door:\"village resident \"+nm,mode:\"cross\",", replace: "{door:\"village resident \"+nm,mode:\"same\",",
    mustFail: "the boundary: an incoming sheet" }
]);
process.exit(code);
