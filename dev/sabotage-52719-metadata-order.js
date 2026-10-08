var sabotage=require('./sabotage.js'),code=0;
function prove(file,cases){if(!code)code=sabotage.prove({file:file,command:['node',['dev/run-tests.js','#527(19)']],cases:cases});}
prove('memory.js',[
  {
    "label": "shared creation omits arrival provenance",
    "find": "if(typeof _exitNoteCreated===\"function\")_exitNoteCreated(key);",
    "replace": "void 0;",
    "mustFail": "#527(19) hours range"
  }
]);
prove('tag_table.js',[
  {
    "label": "hours range bypasses shared creation",
    "find": "ensureMapNode(key,R.turn,(key.indexOf(\"|\")>=0?key.split(\"|\")[0]:null)).hours",
    "replace": "(memory.map.nodes[key]||(memory.map.nodes[key]=newMapNode(R.turn,null))).hours",
    "mustFail": "#527(19) hours range"
  },
  {
    "label": "hours none bypasses shared creation",
    "find": "ensureMapNode(nk,R.turn,(nk.indexOf(\"|\")>=0?nk.split(\"|\")[0]:null)).hoursNone",
    "replace": "(memory.map.nodes[nk]||(memory.map.nodes[nk]=newMapNode(R.turn,null))).hoursNone",
    "mustFail": "#527(19) hours range"
  },
  {
    "label": "missing-subject keeper is refused early again",
    "find": "if(!settled&&raw&&(!node||!npc))return false;",
    "replace": "if(false)return false;",
    "mustFail": "#527(19) same-response new NPC"
  },
  {
    "label": "deferred keeper queue never settles",
    "find": "try{applyShopKeeper(R.pendingShopKeepers[ki],text,R,true);}",
    "replace": "try{void 0;}",
    "mustFail": "#527(19) same-response new NPC"
  },
  {
    "label": "existing keeper unnecessarily waits until after gold",
    "find": "if(!settled&&raw&&(!node||!npc))return false;",
    "replace": "if(!settled&&raw)return false;",
    "mustFail": "#527(19) early existing keeper"
  },
  {
    "label": "hours moves after gold",
    "find": "function applyMutsTable(text,opts){",
    "replace": "function applyMutsTable(text,opts){\n  for(var hi=0;hi<TAG_TABLE.length;hi++)if(TAG_TABLE[hi].t===\"LOCATION_HOURS\"){TAG_TABLE.push(TAG_TABLE.splice(hi,1)[0]);break;}",
    "mustFail": "#527(19) early existing keeper"
  },
  {
    "label": "deferred earlier keeper overrides later success",
    "find": "for(wk in written)if(locResolve(wk)===key&&written[wk]>entry.off)return true;",
    "replace": "for(wk in written)void 0;",
    "mustFail": "#527(19) deferred earlier keeper"
  },
  {
    "label": "deferred keeper skips final party eligibility",
    "find": "else if(npc.partyMember)why=npc.name+\" travels with the party\";",
    "replace": "else if(false)why=npc.name+\" travels with the party\";",
    "mustFail": "#527(19) deferred keeper checks"
  }
]);
process.exit(code?1:0);
