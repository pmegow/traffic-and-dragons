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

/* P2/#171 (workdone_sol_review batch 1): provenance + hygiene guards. */
rc|=sabotage.prove({
  file:"identity.js",
  command:["node",["dev/run-tests.js","#171"]],
  cases:[
    {
        "label": "committed receipts demote again on a formatting-variant re-emission",
        "find": "if(status===\"quarantined\"){if(r.status===\"committed\"){",
        "replace": "if(status===\"quarantined\"){if(false){"
    },
    {
        "label": "the conflict's first actionable reason is overwritten by retries again",
        "find": "c.lastReason=reason||c.lastReason;",
        "replace": "c.reason=reason||c.reason;"
    },
    {
        "label": "the same-turn duplicate confirm goes silent again (owner ruled it loud)",
        "find": "if(R)R.muts.push(\"Bond change NOT confirmed (same-response duplicate): \"+(who?who+\" → \":\"\")+ent);",
        "replace": ";"
    },
    {
        "label": "confirmation stops re-verifying the staged preimage (a moved bond gets clobbered)",
        "find": "if((row.bond||\"\")!==String(pending.prev||\"\")){",
        "replace": "if(false){"
    }
]
});

rc|=sabotage.prove({
  file:"identity.js",
  command:["node",["dev/run-tests.js","#168 W2"]],
  cases:[
    {
        "label": "refusal provenance dies — stripped operations vanish without a trace again (the t1760 class)",
        "find": "function _w2RefuseLog(tags){if(!tags)return;",
        "replace": "function _w2RefuseLog(tags){return;if(!tags)return;"
    }
]
});

rc|=sabotage.prove({
  file:"api.js",
  command:["node",["dev/run-tests.js","#168 W2"]],
  cases:[
    {
        "label": "the tagLog label sentinel dies — over-cap turns silently truncate again",
        "find": "if((R.muts||[]).length>10)_tlM.push(\"+\"+((R.muts||[]).length-10)+\" more\");",
        "replace": ";"
    },
    {
        "label": "refused provenance never reaches the ring",
        "find": "if(_tlRef.length){_tlEntry.refused=_tlRef.slice(0,6);",
        "replace": "if(false){_tlEntry.refused=_tlRef.slice(0,6);"
    }
]
});

/* P3/P5① (batch 2): lifecycle loudness + the canon-contradiction tripwire. */
rc|=sabotage.prove({
  file:"memory.js",
  command:["node",["dev/run-tests.js","#168 W2"]],
  cases:[
    {
        "label": "quarantine-archive eviction goes silent again",
        "find": "while(a.length>SUMMARY_IDENTITY_QUARANTINE_CAP){var _ev=a.shift();",
        "replace": "while(a.length>SUMMARY_IDENTITY_QUARANTINE_CAP){a.shift();var _ev=null;if(false)"
    },
    {
        "label": "the canon-contradiction tripwire dies — the two-truths state goes unnoticed again",
        "find": "if(CANON_CONTRA_RE.test(line)||CANON_CONTRA_NOW_RE.test(line)){",
        "replace": "if(false){"
    },
    {
        "label": "past-tense history starts tripping the contradiction (the false-positive class)",
        "find": "var CANON_CONTRA_NOW_RE=/\\bsurviv\\w*\\b[\\s\\S]{0,120}?\\b(?:now|remains|continues|still)\\b/i;",
        "replace": "var CANON_CONTRA_NOW_RE=/\\bsurviv\\w*\\b/i;"
    }
]
});

rc|=sabotage.prove({
  file:"api.js",
  command:["node",["dev/run-tests.js","#168 W2"]],
  cases:[
    {
        "label": "the contradiction note stops consuming its latch (permanent noise)",
        "find": "  delete worldState.canonContradiction;\n  if(!worldState.canonContraNudged)worldState.canonContraNudged={};",
        "replace": "  if(!worldState.canonContraNudged)worldState.canonContraNudged={};"
    }
]
});

process.exit(rc?1:0);
