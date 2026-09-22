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
    find: 'rel:"resident",met:0,partyMember:false,resident:true,pronouns:pr,portrait:null,charSheet:sheet,libraryAt:_libAt}', replace: 'rel:"resident",met:0,partyMember:true,resident:true,pronouns:pr,portrait:null,charSheet:sheet,libraryAt:_libAt}',
    mustFail: "#6A residents: importVillageResidents" },
  { label: "the resident's sheet is the library object itself, not a copy",
    /* anchored on importVillageResidents' own line — the same copy also opens adoptLibraryCompanion (#428); the harness
       mutates the FIRST match (ambiguous-find census 2026-09-21) */
    find: 'var sheet=JSON.parse(JSON.stringify(c));if(typeof relationshipMigrateSheet==="function")relationshipMigrateSheet(sheet,nm);', replace: 'var sheet=c;if(typeof relationshipMigrateSheet==="function")relationshipMigrateSheet(sheet,nm);',
    mustFail: "#6A residents: importVillageResidents" },
  { label: "the house node forgets its owner",
    find: 'newMapNode(null,parent,{size:"small",owner:name})', replace: 'newMapNode(null,parent,{size:"small"})',
    mustFail: "#6A residents: importVillageResidents" },
  { label: "applyBlueprint stamps every kind, adventure included (legacy saves gain a field)",
    find: 'if(bp.kind&&bp.kind!=="adventure"&&typeof CAMPAIGN_KINDS!=="undefined"&&CAMPAIGN_KINDS[bp.kind]){worldState.kind=bp.kind;', replace: 'if(bp.kind){worldState.kind=bp.kind;',
    mustFail: "#6A the blueprint carries the kind" }
  /* the "write-back stays silent when signed out" clause was retired with villageWriteBack itself (#427, 2026-09-21):
     the library is upstream and no automatic write-back exists to keep honest — dev/sabotage-427-library-upstream.js
     now proves a write smuggled back into the campaign switch or the swap shell is caught. */
]);
prove("api.js", [
  { label: "the switch-POV block ignores the kind's wording",
    find: 'if(_kdSw&&_kdSw.switchPovBlock)switchBlock=_kdSw.switchPovBlock(rs);else switchBlock=', replace: 'if(false)switchBlock=_kdSw.switchPovBlock(rs);else switchBlock=',
    mustFail: "#6A the switch-POV prompt block" }
]);
process.exit(code);
