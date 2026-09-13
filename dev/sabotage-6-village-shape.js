// dev/sabotage-6-village-shape.js — proves the #6 phase A (village shape) clauses are guarded: the kind registry
// dispatch, resident import outside the party, the free village swap, the skeleton gate, the switch-POV override.
// Each mutation runs in a disposable clone (sabotage.js proveScratch); nothing here touches the working tree.
//   node dev/sabotage-6-village-shape.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "#6 the village"]], cases: cases }); }
prove("data.js", [
  { label: "the village swap demotes into the party like an adventure",
    find: 'village:{label:"Village",skeleton:false,swapDemotesTo:"resident",swapHandoff:false,', replace: 'village:{label:"Village",skeleton:false,swapDemotesTo:"party",swapHandoff:false,',
    mustFail: "#6A the village swap (pure core)" },
  { label: "the village swap spends a GM handoff turn",
    find: 'swapDemotesTo:"resident",swapHandoff:false,', replace: 'swapDemotesTo:"resident",swapHandoff:true,',
    mustFail: "#6A the village swap (pure core)" },
  { label: "the village kind forges a skeleton",
    find: 'village:{label:"Village",skeleton:false,', replace: 'village:{label:"Village",skeleton:true,',
    mustFail: "#6A CAMPAIGN_KINDS is ONE registry" }
]);
prove("helpers.js", [
  { label: "an unknown kind is returned as-is instead of falling back to adventure",
    find: 'return (k&&typeof CAMPAIGN_KINDS!=="undefined"&&CAMPAIGN_KINDS[k])?k:"adventure";', replace: 'return k||"adventure";',
    mustFail: "#6A CAMPAIGN_KINDS is ONE registry" }
]);
prove("game.js", [
  { label: "residents move in as party members",
    find: 'rel:"resident",met:0,partyMember:false,resident:true,pronouns:pr,portrait:null,charSheet:sheet}', replace: 'rel:"resident",met:0,partyMember:true,resident:true,pronouns:pr,portrait:null,charSheet:sheet}',
    mustFail: "#6A residents: importVillageResidents" },
  { label: "the resident's sheet is the library object itself, not a copy",
    find: 'var sheet=JSON.parse(JSON.stringify(c));', replace: 'var sheet=c;',
    mustFail: "#6A residents: importVillageResidents" },
  { label: "the house node forgets its owner",
    find: 'size:"small",travelMins:null,owner:nm};', replace: 'size:"small",travelMins:null};',
    mustFail: "#6A residents: importVillageResidents" },
  { label: "applyBlueprint stamps every kind, adventure included (legacy saves gain a field)",
    find: 'if(bp.kind&&bp.kind!=="adventure"&&typeof CAMPAIGN_KINDS!=="undefined"&&CAMPAIGN_KINDS[bp.kind])worldState.kind=bp.kind;', replace: 'if(bp.kind)worldState.kind=bp.kind;',
    mustFail: "#6A the blueprint carries the kind" },
  { label: "the write-back stays silent when signed out",
    find: 'return refuse("not signed in to the server");', replace: 'return {status:"refused"};',
    mustFail: "#6A the library write-back" }
]);
prove("api.js", [
  { label: "the switch-POV block ignores the kind's wording",
    find: 'if(_kdSw&&_kdSw.switchPovBlock)switchBlock=_kdSw.switchPovBlock(rs);else switchBlock=', replace: 'if(false)switchBlock=_kdSw.switchPovBlock(rs);else switchBlock=',
    mustFail: "#6A the switch-POV prompt block" }
]);
process.exit(code);
