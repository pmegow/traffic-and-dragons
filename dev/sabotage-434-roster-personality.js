// dev/sabotage-434-roster-personality.js — proves the #434 guards are guarded: a PRESENT non-party character's trait, flaw,
// look and motivation ride the roster entry; absence keeps the one-liner (no backlog); party members are not doubled.
// Each mutation runs in a disposable clone (sabotage.js proveScratch); nothing here touches the working tree.
//   node dev/sabotage-434-roster-personality.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "#434 roster"]], cases: cases }); }
prove("api.js", [
  { label: "the personality is dropped from the roster again (village Nyla is a housewife)",
    find: '      if(_rosterPresent[String(npc.name).toLowerCase()]){var _pcs=npc.charSheet;', replace: '      if(false){var _pcs=npc.charSheet;',
    mustFail: "#434 a present resident" },
  { label: "the presence gate is gone (every sheeted character on the roster pays the backlog)",
    find: '      if(_rosterPresent[String(npc.name).toLowerCase()]){var _pcs=npc.charSheet;', replace: '      if(true){var _pcs=npc.charSheet;',
    mustFail: "#434 a present resident" },
  { label: "party members are doubled",
    find: '    if(!npc.partyMember&&npc.charSheet){\n      if(!_rosterPresent)', replace: '    if(npc.charSheet){\n      if(!_rosterPresent)',
    mustFail: "#434 a present resident" }
]);
process.exit(code);
