// Existing record aliases are proposals; accepted handoff has one canonical identity.
var sabotage=require("./sabotage.js"),code=0;
if(!code)code=sabotage.prove({
  "file": "tag_table.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#544"
    ]
  ],
  "cases": [
    {
      "label": "existing-record alias is refused without proposal",
      "find": "if(w2MergePropose(alCanon,_alHas,\"NPC_MERGE\",R))",
      "replace": "if(false)",
      "mustFail": "existing-record alias queues"
    },
    {
      "label": "proposal prematurely registers the duplicate alias",
      "find": "needs exact confirmation; '\"+alAlias+\"' is already \"+_alHas+\"'s name\");continue;",
      "replace": "needs exact confirmation; '\"+alAlias+\"' is already \"+_alHas+\"'s name\");memory.npcs[alCanon].aliases.push(alAlias);continue;",
      "mustFail": "existing-record alias queues"
    },
    {
      "label": "no-scene handler bypasses pending confirmation",
      "find": "&&typeof w2MergeAllowed===\"function\"&&!w2MergeAllowed(mgCanon,mgDupe,_mgTag)",
      "replace": "&&worldState.sceneRefs&&typeof w2MergeAllowed===\"function\"&&!w2MergeAllowed(mgCanon,mgDupe,_mgTag)",
      "mustFail": "pending alias cannot"
    },
    {
      "label": "transferred sheet keeps duplicate name",
      "find": "_mgCanN.charSheet.name=mgCanon;",
      "replace": "",
      "mustFail": "accepted reveal renames"
    },
    {
      "label": "hero canonical operand rewritten by NPC alias",
      "find": "var _alRef=npcAliasOperand(alCanon)",
      "replace": "var _alRef={kind:\"known\",key:npcExactKey(alCanon,2)}",
      "mustFail": "shared alias adapter"
    },
    {
      "label": "roster-only old name not retained",
      "find": "if((!npcIsProvisional(mgDupe)||_mgCalled)&&memory.npcs[mgCanon].aliases.indexOf(mgDupe)<0)",
      "replace": "if(memory.npcs[mgDupe]&&(!npcIsProvisional(mgDupe)||_mgCalled)&&memory.npcs[mgCanon].aliases.indexOf(mgDupe)<0)",
      "mustFail": "roster-only duplicate"
    }
  ]
});
if(!code)code=sabotage.prove({
  "file": "identity.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#544"
    ]
  ],
  "cases": [
    {
      "label": "pending pairs never require confirmation",
      "find": "for(i=0;i<q.length;i++)if(pair(q[i].canonical,q[i].duplicate))return true;",
      "replace": "",
      "mustFail": "pending alias cannot"
    },
    {
      "label": "all no-scene merges bypass proposal evidence",
      "find": "if(!worldState.sceneRefs&&!w2MergePairKnown(ans.canon,ans.dupe))return true;",
      "replace": "if(!worldState.sceneRefs)return true;",
      "mustFail": "pending alias cannot"
    },
    {
      "label": "confirmation accepts reversed direction",
      "find": "a.canonical===canonical&&a.duplicate===duplicate",
      "replace": "(a.canonical===canonical&&a.duplicate===duplicate||a.canonical===duplicate&&a.duplicate===canonical)",
      "mustFail": "pending alias cannot"
    },
    {
      "label": "confirmation ignores turn",
      "find": "a.turn===worldState.turn&&a.canonical===canonical",
      "replace": "a.canonical===canonical",
      "mustFail": "pending alias cannot"
    }
  ]
});
if(!code)code=sabotage.prove({
  "file": "api.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#544"
    ]
  ],
  "cases": [
    {
      "label": "roster-only hint discarded",
      "find": "(memory.npcs[c.canonical]||wsNpcByName(c.canonical))&&(memory.npcs[c.duplicate]||wsNpcByName(c.duplicate))",
      "replace": "memory.npcs[c.canonical]&&memory.npcs[c.duplicate]",
      "mustFail": "roster-only duplicate"
    },
    {
      "label": "same-turn proposal arms itself",
      "find": "worldState.mergeConfirmArmed={canonical:h.canonical,duplicate:h.duplicate,turn:worldState.turn+1};",
      "replace": "worldState.mergeConfirmArmed={canonical:h.canonical,duplicate:h.duplicate,turn:worldState.turn};",
      "mustFail": "pending alias cannot"
    }
  ]
});
if(!code)code=sabotage.prove({
  "file": "tag_table.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#544"
    ]
  ],
  "cases": [
    {
      "label": "canonical operand ignores sheet-only alias",
      "find": "var _alRef=npcAliasOperand(alCanon)",
      "replace": "var _alRef={kind:\"known\",key:npcExactKey(alCanon,2)}",
      "mustFail": "alias operands identify"
    },
    {
      "label": "duplicate operand ignores sheet-only alias",
      "find": "var _alDest=npcAliasOperand(alAlias)",
      "replace": "var _alDest={kind:\"known\",key:npcExactKey(alAlias)}",
      "mustFail": "alias operands identify"
    }
  ]
});
if(!code)code=sabotage.prove({
  "file": "identity.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#544"
    ]
  ],
  "cases": [
    {
      "label": "ambiguous alias becomes unregistered canonical",
      "find": "if(claims.length>1)return {kind:\"ambiguous\",key:null};",
      "replace": "if(claims.length>1)return {kind:\"new\",key:null};",
      "mustFail": "ambiguous sheet alias"
    }
  ]
});
if(!code)code=sabotage.prove({
  "file": "tag_table.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#544"
    ]
  ],
  "cases": [
    {
      "label": "new canonical queues undeliverable proposal",
      "find": "if(_alRef.kind===\"new\"&&!_alOwn){",
      "replace": "if(false){",
      "mustFail": "genuinely new canonical"
    }
  ]
});
if(!code)code=sabotage.prove({
  "file": "tag_table.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#544"
    ]
  ],
  "cases": [
    {
      "label": "selected canonical malformed shape reaches writers",
      "find": "var _alShape=npcAliasWriteIssue(_alRef);if(_alShape){identityAdmissionWarn(_alShape,R);continue;}",
      "replace": "var _alShape=\"\";",
      "mustFail": "malformed selected"
    },
    {
      "label": "response plan absent so generic merge wins ordering",
      "find": "R.aliasDeferred=identityDeferredAliasPlan(R.aliasClaims);",
      "replace": "R.aliasDeferred=[];",
      "mustFail": "every alias and merge vocabulary"
    },
    {
      "label": "planned alias proposal never finalized",
      "find": "  identityFinishAliasProposals(R);",
      "replace": "",
      "mustFail": "planned canonical introduction"
    },
    {
      "label": "coemitted merge ignores response alias intent",
      "find": "if(identityDeferredAliasMatch(R,mgCanon,mgDupe)&&!w2MergeArmed(mgCanon,mgDupe)){",
      "replace": "if(false){",
      "mustFail": "every alias and merge vocabulary"
    }
  ]
});
if(!code)code=sabotage.prove({
  "file": "identity.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#544"
    ]
  ],
  "cases": [
    {
      "label": "unknown proposal endpoints enter global queue",
      "find": "if(ans.kind===\"refused\"||!(memory.npcs[ans.canon]||wsNpcByName(ans.canon))||!(memory.npcs[ans.dupe]||wsNpcByName(ans.dupe))){",
      "replace": "if(false){",
      "mustFail": "refused planned introduction"
    },
    {
      "label": "known canonical aliases omitted from response preflight",
      "find": "if(ref.kind===\"known\"){if(ref.key!==d.key)",
      "replace": "if(ref.kind===\"known\"){if(false)",
      "mustFail": "every alias and merge vocabulary"
    },
    {
      "label": "deferred attempt never becomes a proposal",
      "find": "if(!p.attempted)continue;",
      "replace": "continue;",
      "mustFail": "planned canonical introduction"
    }
  ]
});
process.exit(code);
