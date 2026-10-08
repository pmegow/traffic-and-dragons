var sabotage=require('./sabotage.js'),code=0;
function prove(file,cases){if(!code)code=sabotage.prove({file:file,command:['node',['dev/run-tests.js','#581']],cases:cases});}
prove("memory.js",[
  {
    "label": "stable key replaced by mutable camp id",
    "find": "function stashMarkKey(){stashJournalEnsure(worldState,true);return worldState&&worldState.stashJournal?worldState.stashJournal.id:null;}",
    "replace": "function stashMarkKey(){return worldState.campId||\"local\";}",
    "mustFail": "#581 exact repro"
  },
  {
    "label": "legacy migration diverges across devices",
    "find": "hasLegacy?\"stash:legacy:\"+legacy:",
    "replace": "hasLegacy?\"stash:legacy:\"+Math.random():",
    "mustFail": "#581 independent legacy"
  },
  {
    "label": "new journals share reused campaign id",
    "find": "\"stash:new:\"+Date.now().toString(36)+\":\"+Math.random().toString(36).slice(2)+\":\"+Math.random().toString(36).slice(2)",
    "replace": "\"stash:new:\"+legacy",
    "mustFail": "#581 independent legacy"
  },
  {
    "label": "legacy live-sheet marks not migrated",
    "find": "marks[id]=marks[legacy];",
    "replace": "void 0;",
    "mustFail": "#581 empty legacy ring"
  },
  {
    "label": "legacy external copy fallback removed",
    "find": "else if(journal.legacyKey&&Object.prototype.hasOwnProperty.call(marks,journal.legacyKey))key=journal.legacyKey;",
    "replace": "else if(false)key=journal.legacyKey;",
    "mustFail": "#581 legacy marks migrate"
  },
  {
    "label": "zero stable mark loses precedence",
    "find": "if(Object.prototype.hasOwnProperty.call(marks,journal.id))key=journal.id;",
    "replace": "if(marks[journal.id])key=journal.id;",
    "mustFail": "#581 explicit stable marks"
  },
  {
    "label": "new writer first appends then invents legacy identity",
    "find": "  if(typeof kindDef===\"function\"&&kindDef().populateFromLibrary)stashJournalEnsure(worldState,true);\n",
    "replace": "",
    "mustFail": "#581 independent legacy"
  },
  {
    "label": "malformed provenance goes silent",
    "find": "  if(typeof console!==\"undefined\")console.warn(\"[stash] \"+reason);\n",
    "replace": "",
    "mustFail": "#581 explicit stable marks"
  }
]);
prove("game.js",[
  {
    "label": "hero ignores incoming journal mark",
    "find": "stashMovesReplay(hero,_stashMark)",
    "replace": "stashMovesReplay(hero,null)",
    "mustFail": "#581 exact repro"
  },
  {
    "label": "companion ignores incoming journal mark",
    "find": "stashMovesReplay(sheet,_stashMark)",
    "replace": "stashMovesReplay(sheet,null)",
    "mustFail": "#581 companion marks"
  }
]);
prove("state.js",[{"label":"malformed import replaces outgoing world before validation","find":"  if(typeof stashJournalEnsure===\"function\")stashJournalEnsure(ws,false);\n  // Snapshot (and flush","replace":"  worldState=ws;\n  if(typeof stashJournalEnsure===\"function\")stashJournalEnsure(ws,false);\n  // Snapshot (and flush","mustFail":"#581 malformed import"},
  {
    "label": "raw import migrates after id changes",
    "find": "  if(typeof stashJournalEnsure===\"function\")stashJournalEnsure(ws,false);\n  // Snapshot (and flush",
    "replace": "  // Snapshot (and flush",
    "mustFail": "#581 raw legacy import"
  },
  {
    "label": "rehome forgets original legacy id",
    "find": "function rehomeCampaign(reason){\n  if(typeof stashJournalEnsure===\"function\")stashJournalEnsure(worldState,false);",
    "replace": "function rehomeCampaign(reason){",
    "mustFail": "#581 raw legacy import"
  },
  {
    "label": "load assigns active id before migrating local mark",
    "find": "  if(typeof stashJournalEnsure===\"function\"&&stashJournalEnsure(worldState,false))_mig=true;\n",
    "replace": "",
    "mustFail": "#581 local load"
  },
  {
    "label": "server inflater forgets detached provenance",
    "find": "function inflateWorldStateSnapshot(o){\n  if(typeof stashJournalEnsure===\"function\")stashJournalEnsure(o,false);",
    "replace": "function inflateWorldStateSnapshot(o){",
    "mustFail": "#581 detached server"
  },
  {
    "label": "checkpoint overwrites original id",
    "find": "  if(typeof stashJournalEnsure===\"function\")stashJournalEnsure(ws,false);\n  ws.campId=live.campId||ws.campId;",
    "replace": "  ws.campId=live.campId||ws.campId;",
    "mustFail": "#581 detached server"
  },
  {
    "label": "bootstrap assigns id before local provenance",
    "find": "function migrateToCampaigns(){\n  if(getActiveCampId())return;\n  if(typeof stashJournalEnsure===\"function\")stashJournalEnsure(worldState,false);",
    "replace": "function migrateToCampaigns(){\n  if(getActiveCampId())return;",
    "mustFail": "#581 local load"
  }
]);
process.exit(code?1:0);
