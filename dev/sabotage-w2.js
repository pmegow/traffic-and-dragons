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
      find:"if(resolveNpcName(m[1].trim())!==resolveNpcName(meta.subject))return{reason:\"death operation names a different NPC than the transaction subject\"};",
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

/* #168R (entry-13 review): the review-hardening guards prove against their own focused section —
   a narrow blast radius keeps each catch attributable (brief F: exit-status verdicts cannot tell
   an unrelated red from a real catch when the command runs the whole suite). */
rc|=sabotage.prove({
  file:"identity.js",
  command:["node",["dev/run-tests.js","#168R"]],
  cases:[
    {label:"a just-refused death stops de-authorizing its co-emitted rewards (the stripped-tag evidence hole reopens)",
      find:"if(refusedVictim&&",
      replace:"if(false&&"},
    {label:"same-turn summary evidence self-authorizes a corpse again",
      find:"if(sourceTurn!=null&&(Number(sourceTurn)>=worldState.turn||(hit.actor.revealed&&hit.actor.revealTurn>=worldState.turn)))return false;",
      replace:""},
    {label:"a quarantined transaction id becomes citable death authority again",
      find:"if(_ctr&&_ctr.status===\"quarantined\")return true;",
      replace:"if(false)return true;"},
    {label:"the latched-transition frame buffer stops preserving accepted evidence",
      find:"if(s.overflow.frames.length<SCENE_REF_SEALED_CAP){s.overflow.frames.push(old);",
      replace:"if(false){s.overflow.frames.push(old);"}
  ]
});

rc|=sabotage.prove({
  file:"memory.js",
  command:["node",["dev/run-tests.js","#168R"]],
  cases:[
    {label:"committed receipts stop retiring — the receipt cap permanently kills envelopes again",
      find:"if(typeof w2TxnSummaryRetire===\"function\")w2TxnSummaryRetire();",
      replace:"if(false)w2TxnSummaryRetire();"},
    {label:"array-valued chapterSummary stops normalizing — the t1644 type bypass reopens",
      find:"if(_snn!=null)extracted.chapterSummary=_snn;",
      replace:"if(false)extracted.chapterSummary=_snn;"}
  ]
});

/* #175: the quest-credit blackout guards — each mutation must turn a focused #175 test red. */
rc|=sabotage.prove({
  file:"identity.js",
  command:["node",["dev/run-tests.js","#175"]],
  cases:[
    {
        "label": "ejection dies — one incidental tag voids the death and its rewards again (the t1742 refusal)",
        "find": "if(!allowed[name]){eject.push(ops[i]);continue;}",
        "replace": "if(!allowed[name])return{reason:\"unsupported operation \"+name+\" inside \"+meta.claim+\" transaction\"};"
    },
    {
        "label": "already-canon-dead subjects need fresh scene evidence again (re-assertion bookkeeping impossible)",
        "find": "else if(!_w2SubjectDeadInCanon(meta.subject)&&!w2DeathAuthorized(meta.subject,meta.evidence))",
        "replace": "else if(!w2DeathAuthorized(meta.subject,meta.evidence))"
    },
    {
        "label": "the standing-conflict strip goes prose-keyed again — the name-substring blackout returns",
        "find": ".test(payload))return true;",
        "replace": ".test(ordinary))return true;"
    },
    {
        "label": "mismatched-subject death ops get ejected instead of refusing (wrong-corpse writes launder through)",
        "find": "if(resolveNpcName(m[1].trim())!==resolveNpcName(meta.subject))return{reason:\"death operation names a different NPC than the transaction subject\"};",
        "replace": "if(resolveNpcName(m[1].trim())!==resolveNpcName(meta.subject)){eject.push(ops[i]);continue;}"
    }
]
});

rc|=sabotage.prove({
  file:"api.js",
  command:["node",["dev/run-tests.js","#175"]],
  cases:[
    {
        "label": "the heal dies — a committed claim stops resolving its subject's standing conflict",
        "find": "      _w2ResolveConflicts(_w2t.meta.subject);",
        "replace": "      ;"
    },
    {
        "label": "the stale cap dies — an unanswerable conflict nudges forever again",
        "find": "  if(c.attempts>IDENTITY_CONFLICT_STALE_ATTEMPTS){",
        "replace": "  if(false){"
    }
]
});

process.exit(rc?1:0);
