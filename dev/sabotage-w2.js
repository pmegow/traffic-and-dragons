// sabotage-w2.js — prove the #168 W2 referential-integrity guards are load-bearing.
// Every mutation must change source bytes, turn a focused regression red, and restore the file
// byte-identically before the next case.
var sabotage=require("./sabotage.js"),rc=0;
/* #170 + CI ruling (owner 2026-08-13): `--focused` runs only the section-scoped groups (fast,
   attributable) — CI runs those on every push; the full-suite-per-mutation groups stay manual. */
var FOCUSED=process.argv.indexOf("--focused")>=0;

rc|=sabotage.prove({
  file:"identity.js",
  command:["node",["dev/run-tests.js"]],skip:FOCUSED,
  cases:[
    {label:"explicit scene exclusion stops blocking the claimed identity",
    mustFail:"W2 an explicit exclusion also blocks a later bare named death despite ",
      find:"as[j].entity===canon&&!_sceneRefExplicitNegative(fs[i],as[j].handle,canon)",
      replace:"as[j].entity===canon"},
    {label:"same-response scene evidence can self-authorize a combat death",
    mustFail:"W2 combat-close propagation cannot bypass a scene exclusion, but a pri",
      find:"as[j].sourceTurn<_nmLim&&(!as[j].revealed||as[j].revealTurn<_nmLim)&&as[j].entity===canon",
      replace:"as[j].entity===canon"},
    {label:"the frame scan stops honoring a summary's cited sourceTurn (#175bR)",
    mustFail:"#175bR: a scene binding newer than the summary's cited sourceTurn cann",
      find:"var _nmLim=(sourceTurn!=null&&Number(sourceTurn)<worldState.turn)?Number(sourceTurn):worldState.turn;",
      replace:"var _nmLim=worldState.turn;"},
    {label:"the already-dead closing envelope stamps whoever its handle resolves to (#175bR)",
    mustFail:"#175bR: an already-dead subject's envelope cannot stamp a DIFFERENT NP",
      find:"if(subj&&_w2SubjectDeadInCanon(subj)){",
      replace:"if(false){"},
    {label:"the executor stops pinning the bound scene actor to the transaction subject (#175bR)",
    mustFail:"#175bR: a same-response scene binding to a different NPC quarantines t",
      find:"if(subj&&hit.actor.entity!==subj){",
      replace:"if(false){"},
    {label:"the co-location evidence limb loses its turn stamp (#175bR)",
    mustFail:"#175bR: a lastSeenAt stamp written THIS turn cannot authorize its own ",
      find:"m.lastSeenTurn!=null&&Number(m.lastSeenTurn)<lim&&",
      replace:""},
    {label:"transaction operations stop matching their declared subject and quest",
    mustFail:"W2 malformed envelopes and cross-subject death operations fail closed ",
      find:"if(resolveNpcName(m[1].trim())!==resolveNpcName(meta.subject))return{reason:\"death operation names a different NPC than the transaction subject\"};",
      replace:""},
    {label:"semantic XP fingerprints revert to raw spelling and pay +100 twice",
    mustFail:"W2 transaction ids are idempotent while the same claim id may carry a ",
      find:"if(name===\"XP\"){m=tag.match(/^\\[XP:\\s*\\+?(\\d+)/);if(m)return\"XP:\"+parseInt(m[1],10);}",
      replace:"if(name===\"XP\")return tag;"},
    {label:"proposal-free NPC merges become destructive again",
    mustFail:"W2 direct merges are proposals first; a delivered exact confirmation a",
      find:"function w2MergeAllowed(canonical,duplicate){if(!worldState||!worldState.sceneRefs)return true;",
      replace:"function w2MergeAllowed(canonical,duplicate){return true;if(!worldState||!worldState.sceneRefs)return true;"}
  ]
});

rc|=sabotage.prove({
  file:"memory.js",
  command:["node",["dev/run-tests.js"]],skip:FOCUSED,
  cases:[
    {label:"summary extraction writes before referent validation",
    mustFail:"W2 summary preflight rejects the whole extraction on a conflicting dea",
      find:"  if(typeof validateSummaryExtract===\"function\")validateSummaryExtract(extracted,identityTable);/* #168 W2/W6: whole-extraction preflight before any tier can ratchet disputed identity */\n",
      replace:""}
  ]
});

rc|=sabotage.prove({
  file:"tag_table.js",
  command:["node",["dev/run-tests.js"]],skip:FOCUSED,
  cases:[
    {label:"combat-close propagation bypasses the scene ledger",
    mustFail:"W2 combat-close propagation cannot bypass a scene exclusion, but a pri",
      find:"    if(worldState.sceneRefs&&typeof w2DeathAuthorized===\"function\"&&!w2DeathAuthorized(cn,null)){\n      if(typeof _w2Conflict===\"function\")_w2Conflict(cn,\"-\",\"registered combat foe lacks a prior positive scene binding\");\n      R.muts.push(w.name+\": combat death quarantined (identity unproven)\");\n      continue;\n    }\n",
      replace:""}
  ]
});

rc|=sabotage.prove({
  file:"api.js",
  command:["node",["dev/run-tests.js"]],skip:FOCUSED,
  cases:[
    {label:"transaction handlers mutate the authoritative state instead of a clone",
    mustFail:"W2 state application is atomic when a transaction handler throws after",
      find:"    worldState=_w2Copy(_w2Ws);memory=_w2Copy(_w2Mem);",
      replace:"    worldState=_w2Ws;memory=_w2Mem;"},
    {label:"rolled-back quest success toasts escape the staged side-effect buffer",
    mustFail:"W2 state application is atomic when a transaction handler throws after",
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
    mustFail:"R1: a refused bare death cannot leak its co-emitted quest completion a",
      find:"if(refusedVictim&&",
      replace:"if(false&&"},
    {label:"same-turn summary evidence self-authorizes a corpse again",
    mustFail:"R6: a summary death cannot cite same-turn scene evidence the tag path ",
      find:"if(sourceTurn!=null&&(Number(sourceTurn)>=worldState.turn||(hit.actor.revealed&&hit.actor.revealTurn>=worldState.turn)))return false;",
      replace:""},
    {label:"a quarantined transaction id becomes citable death authority again",
    mustFail:"R6b: a summary death citing a quarantined transaction id is refused; a",
      find:"if(_ctr&&_ctr.status===\"quarantined\")return true;",
      replace:"if(false)return true;"},
    {label:"the latched-transition frame buffer stops preserving accepted evidence",
    mustFail:"R9: accepted frame evidence survives a transition after the overflow l",
      find:"if(s.overflow.frames.length<SCENE_REF_SEALED_CAP){s.overflow.frames.push(old);",
      replace:"if(false){s.overflow.frames.push(old);"}
  ]
});

rc|=sabotage.prove({
  file:"memory.js",
  command:["node",["dev/run-tests.js","#168R"]],
  cases:[
    {label:"committed receipts stop retiring — the receipt cap permanently kills envelopes again",
    mustFail:"R3: committed receipts retire on structured-summary success",
      find:"if(typeof w2TxnSummaryRetire===\"function\")w2TxnSummaryRetire();",
      replace:"if(false)w2TxnSummaryRetire();"},
    {label:"array-valued chapterSummary stops normalizing — the t1644 type bypass reopens",
    mustFail:"R2: an array-valued chapterSummary normalizes and cannot bypass W6 ide",
      find:"if(_snn!=null)extracted.chapterSummary=_snn;",
      replace:"if(false)extracted.chapterSummary=_snn;"}
  ]
});

/* #175: the quest-credit blackout guards — each mutation must turn a focused #175 test red. */
rc|=sabotage.prove({
  file:"identity.js",
  command:["node",["dev/run-tests.js","#168 W2"]],
  cases:[
    {
        "label": "ejection dies — one incidental tag voids the death and its rewards again (the t1742 refusal)",
        "mustFail": "#175①",
        "find": "if(!allowed[name]){eject.push(ops[i]);continue;}",
        "replace": "if(!allowed[name])return{reason:\"unsupported operation \"+name+\" inside \"+meta.claim+\" transaction\"};"
    },
    {
        "label": "already-canon-dead subjects need fresh scene evidence again (re-assertion bookkeeping impossible)",
        "mustFail": "#175②",
        "find": "else if(!_w2SubjectDeadInCanon(meta.subject)&&!w2DeathAuthorized(meta.subject,meta.evidence))",
        "replace": "else if(!w2DeathAuthorized(meta.subject,meta.evidence))"
    },
    {
        "label": "the standing-conflict strip goes prose-keyed again — the name-substring blackout returns",
        "mustFail": "#175⑤",
        "find": ".test(payload)){if(!_dqConflict)",
        "replace": ".test(ordinary)){if(!_dqConflict)"
    },
    {
        "label": "mismatched-subject death ops get ejected instead of refusing (wrong-corpse writes launder through)",
        "mustFail": "W2 malformed envelopes and cross-subject death operations fail closed ",
        "find": "if(resolveNpcName(m[1].trim())!==resolveNpcName(meta.subject))return{reason:\"death operation names a different NPC than the transaction subject\"};",
        "replace": "if(resolveNpcName(m[1].trim())!==resolveNpcName(meta.subject)){eject.push(ops[i]);continue;}"
    }
]
});

rc|=sabotage.prove({
  file:"api.js",
  command:["node",["dev/run-tests.js","#168 W2"]],
  cases:[
    {
        "label": "the heal dies on the RE-ASSERTION leg — a committed claim for an already-dead subject stops resolving its conflict",
        "mustFail": "#175②",
        "find": "      _w2ResolveConflicts(_w2t.meta.subject);",
        "replace": "      ;"
    },
    {
        "label": "the stale cap dies — an unanswerable conflict nudges forever again",
        "mustFail": "#175⑥",
        "find": "  if(c.attempts>IDENTITY_CONFLICT_STALE_ATTEMPTS){",
        "replace": "  if(false){"
    }
]
});

/* P2/#171 (workdone_sol_review batch 1): provenance + hygiene guards. */
rc|=sabotage.prove({
  file:"identity.js",
  command:["node",["dev/run-tests.js","#168 W2"]],
  cases:[
    {
        "label": "committed receipts demote again on a formatting-variant re-emission",
        "mustFail": "#171②: a committed receipt is NEVER demoted by a later formatting-vari",
        "find": "if(status===\"quarantined\"){if(r.status===\"committed\"){",
        "replace": "if(status===\"quarantined\"){if(false){"
    },
    {
        "label": "the conflict's first actionable reason is overwritten by retries again",
        "mustFail": "#171③: the conflict keeps its FIRST reason",
        "find": "c.lastReason=reason||c.lastReason;",
        "replace": "c.reason=reason||c.reason;"
    },
    {
        "label": "the same-turn duplicate confirm goes silent again (owner ruled it loud)",
        "mustFail": "#171④ (ruled loud): a same-turn duplicate bond confirmation refuses wi",
        "find": "if(R)R.muts.push(\"Bond change NOT confirmed (same-response duplicate): \"+(who?who+\" → \":\"\")+ent);",
        "replace": ";"
    },
    {
        "label": "confirmation stops re-verifying the staged preimage (a moved bond gets clobbered)",
        "mustFail": "#171⑥: confirmation re-verifies the staged preimage",
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
        "mustFail": "P2: a refused operation's VERBATIM tags survive in the tagLog entry (t",
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
        "mustFail": "P5②: a turn with more than 10 mutation labels carries a '+N more' sent",
        "find": "if((R.muts||[]).length>10)_tlM.push(\"+\"+((R.muts||[]).length-10)+\" more\");",
        "replace": ";"
    },
    {
        "label": "refused provenance never reaches the ring",
        "mustFail": "P2: a refused operation's VERBATIM tags survive in the tagLog entry (t",
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
        "mustFail": "P3: identity-quarantine archive eviction is LOUD, never a silent shift",
        "find": "while(a.length>SUMMARY_IDENTITY_QUARANTINE_CAP){var _ev=a.shift();",
        "replace": "while(a.length>SUMMARY_IDENTITY_QUARANTINE_CAP){a.shift();var _ev=null;if(false)"
    },
    {
        "label": "the canon-contradiction tripwire dies — the two-truths state goes unnoticed again",
        "mustFail": "P5①: a dead NPC",
        "find": "if(CANON_CONTRA_RE.test(line)||CANON_CONTRA_NOW_RE.test(line)){",
        "replace": "if(false){"
    },
    {
        "label": "past-tense history starts tripping the contradiction (the false-positive class)",
        "mustFail": "P5①: past-tense survival on a dead NPC is history, not contradiction",
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
        "mustFail": "P5①: a dead NPC whose stored knowledge asserts PRESENT survival arms t",
        "find": "  delete worldState.canonContradiction;\n  if(!worldState.canonContraNudged)worldState.canonContraNudged={};",
        "replace": "  if(!worldState.canonContraNudged)worldState.canonContraNudged={};"
    }
]
});

/* P4a (batch 3): the all-quotes-tagged ruling + coverage precision. */
rc|=sabotage.prove({
  file:"game.js",
  command:["node",["dev/run-tests.js","#96 [SAY:]"]],
  cases:[
    {
        "label": "untagged continuation paragraphs inherit a voice again (the P4a ruling dies)",
        "mustFail": "P4a (owner-ruled)",
        "find": "if(segs[j].name&&!(segs[j].para&&segs[j].para[hit])){out[i]=segs[j].name;kept++;}",
        "replace": "if(segs[j].name){out[i]=segs[j].name;kept++;}"
    },
    {
        "label": "scare-quoted narration counts as untagged speech again (the /i defect returns)",
        "mustFail": "P4a: scare quotes in narration no longer count as an untagged spoken l",
        "find": "(?:says?|said|asks?|asked|answers?|answered|whispers?|whispered|murmurs?|murmured)\\b/.test(p);",
        "replace": "(?:says?|said|asks?|asked|answers?|answered|whispers?|whispered|murmurs?|murmured)\\b/i.test(p);"
    },
    {
        "label": "the gap check re-anchors on before-the-quote text (tag-inside-quote nags forever again)",
        "mustFail": "P4a: a [SAY:] anywhere in the paragraph silences the gap",
        "find": "if(spoken&&!/\\[SAY:[^\\]]+\\]/.test(p))paragraphGaps++;",
        "replace": "if(spoken&&!/\\[SAY:[^\\]]+\\]/.test(p.slice(0,qm)))paragraphGaps++;"
    }
]
});

/* P4b (#169): recognizer-precision guards. */
rc|=sabotage.prove({
  file:"game.js",
  command:["node",["dev/run-tests.js","#96 [SAY:]"]],
  cases:[
    {
        "label": "the sentence veto dies — negation/hypotheticals/dreams arm the filing watch again",
        "mustFail": "P4b/W4: spoken intent",
        "find": "if(_LOC_CUE_VETO.test(sent)||!_LOC_CUE_PARTY.test(sent))continue;\n      return nm;",
        "replace": "return nm;"
    },
    {
        "label": "dialogue stops being stripped — spoken intent arms the watch again",
        "mustFail": "P4b/W4: spoken intent, negation, hypotheticals and dreams do not arm t",
        "find": "var s=String(clean||\"\").replace(/\"[^\"]*\"/g,\" \").replace(/“[^”]*”/g,\" \");if(!s)return null;",
        "replace": "var s=String(clean||\"\");if(!s)return null;"
    },
    {
        "label": "commitment pings stop aging out",
        "mustFail": "P4b/W4: commitmentPing ages out instead of living forever",
        "find": "if(worldState.commitmentPing&&turn-worldState.commitmentPing.turn>COMMITMENT_PING_MAX_AGE)delete worldState.commitmentPing;",
        "replace": ";"
    }
]
});

rc|=sabotage.prove({
  file:"identity.js",
  command:["node",["dev/run-tests.js","#96 [SAY:]"]],
  cases:[
    {
        "label": "sentence-initial possessives anchor subjects again (valid summaries burn strikes)",
        "mustFail": "P4b/W6: a sentence-initial POSSESSIVE is not a subject",
        "find": "if(/^['’]s\\b/.test(low.slice(n.length)))continue;",
        "replace": ";"
    },
    {
        "label": "lone reflexives count as subject evidence again (third-party false rejects return)",
        "mustFail": "P4b/W6: a reflexive about a THIRD PARTY is not subject evidence",
        "find": "if(/\\bshe\\b[^.!?]*\\bherself\\b/.test(low))return\"F\";",
        "replace": "if(/\\bherself\\b/.test(low))return\"F\";"
    }
]
});

rc|=sabotage.prove({
  file:"tag_table.js",
  command:["node",["dev/run-tests.js","#96 [SAY:]"]],
  cases:[
    {
        "label": "name-led death claims survive a retraction again",
        "mustFail": "P4b: NPC_DEATH_RETRACTED scrubs name-led and pronoun-led death claims ",
        "find": "||new RegExp(\"^\\\\s*(?:\"+drName.replace(/[.*+?^${}()|[\\]\\\\]/g,\"\\\\$&\")+\"|he|she|they)\\\\b[^.!?]{0,60}?\\\\b(?:slain|killed|dead|deceased|died|perished)\\\\b\",\"i\").test(s);",
        "replace": ";"
    }
]
});

/* P7: the unregistered-recurring-name detector. */
rc|=sabotage.prove({
  file:"memory.js",
  command:["node",["dev/run-tests.js","#96 [SAY:]"]],
  cases:[
    {
        "label": "the recurring-name scan dies — unregistered characters escape identity protection again",
        "mustFail": "P7: a name recurring",
        "find": "if(turnCount<RECURRING_NAME_MIN_TURNS||!c2.mid)continue;",
        "replace": "continue;"
    },
    {
        "label": "the roster/place/faction exclusion dies — known names ping as unregistered",
        "mustFail": "P7: roster NPCs, aliases, map nodes, factions, the hero, and sentence-",
        "find": "if(_recurringKnownName(nm))continue;",
        "replace": ";"
    }
]
});

rc|=sabotage.prove({
  file:"api.js",
  command:["node",["dev/run-tests.js","#96 [SAY:]"]],
  cases:[
    {
        "label": "the twice-ignored retirement dies — the registration note becomes permanent noise",
        "mustFail": "P7: two ignored nudges retire the name for good",
        "find": "  rec.count++;rec.turn=worldState.turn;",
        "replace": "  rec.turn=worldState.turn;"
    }
]
});

/* #213 (v1.698): the withhold toasts ship to players, so "why" and "is it coming back" are
   contract, not copy. Each mutation below is a plausible refactor that would silently send the
   player back to "an unresolved identity dispute" or, worse, lie about the reward. */
rc|=sabotage.prove({
  file:"identity.js",
  command:["node",["dev/run-tests.js"]],skip:FOCUSED,
  cases:[
    {label:"the refused death stops carrying its cause to the toast (#213)",
      mustFail:"#213 a death-refusal withhold names the victim and the plain-language",
      find:"refusedReason=_bdR;",
      replace:""},
    {label:"the withheld reward is no longer stamped on the conflict record (#213)",
      mustFail:"#213 a withheld reward is itemised on the toast and stamped on the co",
      find:"_w2StampWithheld(refusedConflict,_waTok);",
      replace:""},
    {label:"the withheld ledger loses its bound and grows with every re-refusal (#213)",
      mustFail:"#213 a withheld reward is itemised on the toast and stamped on the co",
      find:"if(c.withheld.indexOf(t)<0&&c.withheld.length<W2_WITHHELD_CAP)c.withheld.push(t);",
      replace:"c.withheld.push(t);"},
    {label:"reward tokens are collected AFTER the strip, so the receipt is always empty (#213)",
      mustFail:"#213 a withheld reward is itemised on the toast and stamped on the co",
      find:"var _waTok=_w2CollectStripped(ordinary,W2_REWARD_RES);",
      replace:"var _waTok=[];"},
    {label:"the standing dispute stops resolving to the record that holds its reason (#213)",
      mustFail:"#213 a completion withheld under a standing dispute names the quest A",
      find:"_dqConflict=_liveConflict(rs[z].subject);if(_dqConflict)break;",
      replace:"break;"},
    {label:"every refusal collapses to the generic fallback (#213)",
      mustFail:"#213 every shipped refusal reason has player copy: none falls through",
      find:"for(i=0;i<W2_REFUSAL_COPY.length;i++)if(W2_REFUSAL_COPY[i].match.test(s))return W2_REFUSAL_COPY[i].copy;",
      replace:""},
    {label:"unmasking and unwitnessed-death copy merge, losing the distinction (#213)",
      mustFail:"#213 the copy table discriminates: causes a player would act on diffe",
      find:"   copy:\"the GM unmasked a face nobody in the scene was wearing\"},",
      replace:"   copy:\"the GM killed someone the scene never showed was there\"},"},
    {label:"an unknown reward token is shown to the player raw (#213)",
      mustFail:"#213 withheld-reward tokens render as player amounts, and an unknown ",
      find:"    else if((m=t.match(/^\\[ITEM_GAINED:\\s*([^\\]|]+)/i)))out.push(m[1].trim());",
      replace:"    else out.push(t);"}
  ]
});

rc|=sabotage.prove({
  file:"api.js",
  command:["node",["dev/run-tests.js"]],skip:FOCUSED,
  cases:[
    {label:"shelving a dispute stops telling the player the reward is gone (#213)",
      mustFail:"#213 shelving a dispute that cost the player a reward says so; one th",
      find:"    var _shLost=(typeof w2WithheldSummary===\"function\")?w2WithheldSummary(c.withheld):\"\";",
      replace:"    var _shLost=\"\";"},
    {label:"a dispute that cost nothing invents a loss anyway (#213)",
      mustFail:"#213 shelving a dispute that cost the player a reward says so; one th",
      find:"showToast(_shLost",
      replace:"showToast(_shLost||\"1 XP\""}
  ]
});

/* #214/#215 (v1.699): the narration/tracker desync and the reward claim that replaced the loss. */
rc|=sabotage.prove({
  file:"tag_table.js",
  command:["node",["dev/run-tests.js"]],skip:FOCUSED,
  cases:[
    {label:"a victory close goes back to discarding foes that are still standing (#214)",
      mustFail:"#214\u2460 a victory close marks the living foe slain in the encounter record",
      find:"if(worldState.combat&&/^(victor|won|win|slain|kill|rout|triumph)/i.test(ce[1].trim())){",
      replace:"if(false){"},
    {label:"the outcome word stops being checked, so a rout and a retreat kill alike (#214)",
      mustFail:"#214\u2460 a non-victory close never invents deaths: fled/truce/disengaged",
      find:"/^(victor|won|win|slain|kill|rout|triumph)/i.test(ce[1].trim())",
      replace:"true"},
    {label:"combat-tag activity stops being stamped, so a live fight gets nagged (#214)",
      mustFail:"#214\u2461 combat-tag activity keeps the note silent",
      find:"worldState.combat.lastTouch=R.turn;",
      replace:";"}
  ]
});

rc|=sabotage.prove({
  file:"api.js",
  command:["node",["dev/run-tests.js"]],skip:FOCUSED,
  cases:[
    {label:"the combat-stale note loses its cooldown and nags every turn (#214)",
      mustFail:"#214\u2461 the note does not repeat every turn",
      find:"  if(ping!=null&&worldState.turn-ping<COMBAT_STALE_TURNS)return\"\";",
      replace:""},
    {label:"a shelved dispute stops queueing the reward claim (#215)",
      mustFail:"#215 a shelved dispute that cost the player a reward queues a claim",
      find:"if(_shLost&&typeof rewardClaimQueue===\"function\"&&rewardClaimQueue(c.subject,c.withheld,c.reason)){",/* #262 made the queue call the ledger-clearing conditional */
      replace:"if(false){"}
  ]
});

rc|=sabotage.prove({
  file:"helpers.js",
  command:["node",["dev/run-tests.js"]],skip:FOCUSED,
  cases:[
    {label:"a payout that moves no state reports success anyway (#215)",
      mustFail:"#215 a payout that silently changes nothing is caught and reported",
      find:"  if(after.xp===before.xp&&after.gold===before.gold&&after.inv===before.inv){",
      replace:"  if(false){"},
    {label:"declining a claim pays it out anyway (#215)",
      mustFail:"#215 declining drops the claim without paying",
      find:"function rewardClaimDecline(id){",
      replace:"function rewardClaimDecline(id){return rewardClaimAccept(id);"},
    {label:"the claim queue loses its bound (#215)",
      mustFail:"#215 declining drops the claim without paying",
      find:"  if(q.length>=REWARD_CLAIM_CAP){",
      replace:"  if(false){"}
  ]
});

/* #225 (v1.705): the orphan-combat channel (the Bronze Bell Warden ghost fight) + the v1.700
   TIME_CHECK nc slip. Single-line finds only. */
rc|=sabotage.prove({
  file:"tag_table.js",
  command:["node",["dev/run-tests.js"]],skip:FOCUSED,
  cases:[
    {label:"orphan combat tags stop being collected — the ghost fight goes console-only again (#225)",
      mustFail:"#225 orphan combat tags arm the record and toast ONCE",
      find:"if(!R._orphanNc)R._orphanNc=[];if(R._orphanNc.indexOf(TAG_TABLE[i].t)<0)R._orphanNc.push(TAG_TABLE[i].t);",
      replace:""},
    {label:"a COMBAT_END over a null tracker records a false victory again (#225)",
      mustFail:"#225 COMBAT_END over a null tracker records no false outcome",
      find:"  if(ce&&!worldState.combat){",
      replace:"  if(false){"},
    {label:"TIME_CHECK regains combat scoping — every peaceful turn trips the UA27 counter (#216fix)",
      mustFail:"#216fix TIME_CHECK is NOT combat-scoped",
      find:"{t:\"TIME_CHECK\",apply:function(text,R){",
      replace:"{t:\"TIME_CHECK\",nc:1,apply:function(text,R){"},
    /* #254 (JP0-6, Fable f26): a foe whose COMBAT_START sits AFTER the COMBAT_END in the response
       text is not part of the encounter being closed. Both halves are load-bearing — the victory
       exemption (a rostered newcomer would otherwise be stamped durably dead by the previous
       fight's outcome, unconditionally on a save whose sceneRefs was never activated) and the
       carry-over (the fresh fight used to be destroyed even when the death gate refused). */
    {label:"#254: the positional split is dropped — the previous fight's victory kills a foe the same response just introduced",
      mustFail:"a rostered NPC was stamped durably dead by the PREVIOUS fight's victory",
      find:"        if(_ceAfter[String(_ceStanding[_cs2].name||\"\").toLowerCase()])_ceKeep.push(_ceStanding[_cs2]);",
      replace:"        if(false)_ceKeep.push(_ceStanding[_cs2]);"},
    {label:"#254: the index comparison inverts — the foes that fought and fell are spared and the newcomer dies",
      mustFail:"the carried encounter is wrong",
      find:"if(_ceStarts[_cq].idx>_ceIdx)",
      replace:"if(_ceStarts[_cq].idx<_ceIdx)"},
    {label:"#254: the exempt foes are computed but discarded — the new fight still dies with the old one",
      mustFail:"the new fight is gone",
      find:"    }else worldState.combat=null;",
      replace:"    }\n    worldState.combat=null;"}
  ]
});

rc|=sabotage.prove({
  file:"api.js",
  command:["node",["dev/run-tests.js"]],skip:FOCUSED,
  cases:[
    {label:"the orphan-combat note stops delivering — the recovery path dies (#225)",
      mustFail:"#225 the nudge teaches the [COMBAT_START:] re-open",
      find:"  if(!q||q.delivered)return\"\";",
      replace:"  return\"\";if(!q||q.delivered)return\"\";"},
    {label:"the moot check dies — the note nags a fight the GM already re-opened (#225)",
      mustFail:"#225 the nudge teaches the [COMBAT_START:] re-open",
      find:"  if(worldState.combat){delete worldState.orphanCombat;return\"\";}",
      replace:""}
  ]
});

rc |= sabotage.prove({
  file: "tag_table.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "#260: the defer condition dies — the LOCATION clear wipes the tracker before same-response outcome tags again",
      mustFail: "survives the move",
      find: '      R._deferCombatClear={to:_lname};',
      replace: '      worldState.combat=null;' },

    { label: "#260: the seam settle is dropped — a deferred fight leaks open into the new location forever",
      mustFail: "partial damage applies, THEN",
      find: '  if(R._deferCombatClear&&worldState.combat){',
      replace: '  if(false){' },

    { label: "#260: newcomer-sparing dies — the deferred clear tears down the fresh fight with the old one",
      mustFail: "only the newcomer survives",
      find: '    if(_dcKeep.length){',
      replace: '    if(false){' }
  ]
});

rc |= sabotage.prove({
  file: "identity.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "#262: the envelope withheld-stamp dies — the taught channel goes back to costless shelves",
      mustFail: "ENVELOPE-refused reward reaches the withheld ledger",
      find: "    if(_qConf&&ops&&ops.length){var _qTok=_w2CollectStripped(ops.join(\"\"),W2_REWARD_RES);if(_qTok.length)_w2StampWithheld(_qConf,_qTok);}",
      replace: "" },

    { label: "#262: resolve-withdraw dies — a settled dispute leaves its claim payable beside the settlement",
      mustFail: "WITHDRAWS its pending claim",
      find: "  if(worldState&&worldState.pendingRewardClaims){var _rwQ=worldState.pendingRewardClaims,_rwi;",
      replace: "  if(false){var _rwQ=worldState.pendingRewardClaims,_rwi;" },

    { label: "#262: quarantine retirement dies — 24 stale quarantines kill the envelope mechanism forever again",
      mustFail: "SATURATION RECOVERY",
      find: "      if(_qLast<qHorizon&&!_qLive(r.subject)){",
      replace: "      if(false){" },

    { label: "#262: the retirement guard dies — a receipt with a LIVE dispute retires out from under it",
      mustFail: "never retires",
      find: "  function _qLive(subj){var j;for(j=0;j<_qc.length;j++)if(_qc[j].subject===subj&&!_qc[j].resolved&&!_qc[j].stale)return true;return false;}",
      replace: "  function _qLive(subj){return false;}" }
  ]
});

rc |= sabotage.prove({
  file: "helpers.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "#262: superset replacement dies — a re-armed dispute queues a second payable copy of the same reward",
      mustFail: "superset re-shelve REPLACES",
      find: "    if(_sub){var _old=q.splice(i,1)[0];",
      replace: "    if(false){var _old=q.splice(i,1)[0];" }
  ]
});

rc |= sabotage.prove({
  file: "api.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "#262: the shelve stops spending the ledger — the claimed tokens stay re-queueable on re-arm",
      mustFail: "moves the ledger INTO the claim",
      find: "      c.withheldClaimed=(c.withheldClaimed||[]).concat(c.withheld);c.withheld=[];",
      replace: "" }
  ]
});

process.exit(rc?1:0);
