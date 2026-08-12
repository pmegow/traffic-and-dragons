// sabotage-w2.js — prove the #168 W2 referential-integrity guards are load-bearing.
// Every mutation must change source bytes, turn a focused regression red, and restore the file
// byte-identically before the next case.
var sabotage=require("./sabotage.js"),rc=0;

rc|=sabotage.prove({
  file:"identity.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    {label:"explicit scene exclusion stops blocking the claimed identity",
      find:"as[j].entity===canon&&!_sceneRefExplicitNegative(fs[i],as[j].handle,canon)",
      replace:"as[j].entity===canon"},
    {label:"same-response scene evidence can self-authorize a combat death",
      find:"as[j].sourceTurn<worldState.turn&&(!as[j].revealed||as[j].revealTurn<worldState.turn)&&as[j].entity===canon",
      replace:"as[j].entity===canon"},
    {label:"transaction operations stop matching their declared subject and quest",
      find:"if(!reason)reason=_w2TxnOpReason(meta,ops);",
      replace:""},
    {label:"semantic XP fingerprints revert to raw spelling and pay +100 twice",
      find:"if(name===\"XP\"){m=tag.match(/^\\[XP:\\s*\\+?(\\d+)/);if(m)return\"XP:\"+parseInt(m[1],10);}",
      replace:"if(name===\"XP\")return tag;"},
    {label:"proposal-free NPC merges become destructive again",
      find:"function w2MergeAllowed(canonical,duplicate){if(!worldState||!worldState.sceneRefs)return true;",
      replace:"function w2MergeAllowed(canonical,duplicate){return true;if(!worldState||!worldState.sceneRefs)return true;"}
  ]
});

rc|=sabotage.prove({
  file:"memory.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    {label:"summary extraction writes before referent validation",
      find:"  if(typeof validateSummaryExtract===\"function\")validateSummaryExtract(extracted,identityTable);/* #168 W2/W6: whole-extraction preflight before any tier can ratchet disputed identity */\n",
      replace:""}
  ]
});

rc|=sabotage.prove({
  file:"tag_table.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    {label:"combat-close propagation bypasses the scene ledger",
      find:"    if(worldState.sceneRefs&&typeof w2DeathAuthorized===\"function\"&&!w2DeathAuthorized(cn,null)){\n      if(typeof _w2Conflict===\"function\")_w2Conflict(cn,\"-\",\"registered combat foe lacks a prior positive scene binding\");\n      R.muts.push(w.name+\": combat death quarantined (identity unproven)\");\n      continue;\n    }\n",
      replace:""}
  ]
});

rc|=sabotage.prove({
  file:"api.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    {label:"transaction handlers mutate the authoritative state instead of a clone",
      find:"    worldState=_w2Copy(_w2Ws);memory=_w2Copy(_w2Mem);",
      replace:"    worldState=_w2Ws;memory=_w2Mem;"},
    {label:"rolled-back quest success toasts escape the staged side-effect buffer",
      find:"\"addMsg\",\"showToast\",\"updateAbPanel\"",
      replace:"\"addMsg\",\"updateAbPanel\""}
  ]
});

process.exit(rc?1:0);
