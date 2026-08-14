// sabotage-identity.js — prove the #156 Phase A identity guards actually guard.
// Each case breaks one clause (pipe refusal, provisional predicate/mint/cap channel, nudge
// gates, #128 scan exclusion, suggestion filter, merge pre-image + alias suppression, the
// NOTE_LATCH entry, route-name normalization); the suite must go red on every one, and every
// mutation must change real bytes (a no-byte mutation is a HARD FAILURE — untested-but-green
// is worse than absent). One prove() per touched file, sequential.
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "identity.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "pipe refusal disabled — a 4-operand [MERGE:] flows through mis-split", mustFail:"pipe refusal: a 4-operand [MERGE:] mutates NOTHING, warns loudly, and ",
      find: "if(parts.length!==3){",
      replace: "if(false){" },
    { label: "provisional predicate loses the introduction-shape gate (every re-tag of a rich record would mint)", mustFail:"provisional immunity: party members, thin records, dead records, and o",
      find: "if(!NPC_INTRO_REL_RE.test(rawRel||\"\"))return resolved;",
      replace: "" },
    { label: "the mint exists but the write is routed back into the canonical (the fusion happens anyway)", mustFail:"PROVISIONAL RECORD (the Savah class ends here): an introduction-shaped",
      find: "if(typeof showToast===\"function\")showToast(\"⚠ Possible name collision: \"+rawName+\" — filed separately pending confirmation\");\n  return key;",
      replace: "if(typeof showToast===\"function\")showToast(\"⚠ Possible name collision: \"+rawName+\" — filed separately pending confirmation\");\n  return resolved;" },
    { label: "the collision nudge fires mid-combat", mustFail:"buildProvisionalNudge: fires the same/distinct fork with exact tags; l",
      find: "if(!worldState||worldState.combat)return\"\";",
      replace: "if(!worldState)return\"\";" }
  ]
});

rc |= sabotage.prove({
  file: "memory.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "#128 scan proposes against provisional keys again (dueling nudges)", mustFail:"#128 variant scan never proposes against a provisional key (its own nu",
      find: "if(npcIsProvisional(cn)||npcIsProvisional(dn))continue;",
      replace: "" },
    { label: "suggestion pool serves on-file names again (the Frizwick Coldwater class)", mustFail:"suggestion pool stops serving on-file npc names (the 'Frizwick Coldwat",
      find: "if(ok)result.push(cand);",
      replace: "result.push(cand);" }
  ]
});

rc |= sabotage.prove({
  file: "tag_table.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "provisional ° keys pollute the alias table on resolution", mustFail:"buildProvisionalNudge: fires the same/distinct fork with exact tags; l",
      find: "if(!npcIsProvisional(mgDupe)&&memory.npcs[mgCanon].aliases.indexOf(mgDupe)<0)memory.npcs[mgCanon].aliases.push(mgDupe);",
      replace: "if(memory.npcs[mgCanon].aliases.indexOf(mgDupe)<0)memory.npcs[mgCanon].aliases.push(mgDupe);" },
    { label: "merges stop archiving pre-images (irreversible again)", mustFail:"every [NPC_MERGE:] archives the duplicate's complete pre-image to memo",
      find: "memArchive().identityMerges.push({domain:\"npc\",canonical:mgCanon,duplicate:mgDupe,turn:R.turn,records:{mem:JSON.parse(JSON.stringify(memory.npcs[mgDupe])),ws:_imWs?JSON.parse(JSON.stringify(_imWs)):null}});",
      replace: "" },
    { label: "the NPC handler bypasses the collision boundary (pre-#156 direct resolve)", mustFail:"PROVISIONAL RECORD (the Savah class ends here): an introduction-shaped",
      find: "var npName=npcUpsertTarget(_npRaw,(np[3]||\"\").trim(),R);",
      replace: "var npName=resolveNpcName(_npRaw);" }
  ]
});

rc |= sabotage.prove({
  file: "api.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "provisionalNudged dropped from NOTE_LATCH_FIELDS (the suggestion call eats the nudge)", mustFail:"NOTE_LATCH_FIELDS carries provisionalNudged",
      find: "\"presencePing\",\"provisionalNudged\",\"reciprocityNudged\"",
      replace: "\"presencePing\",\"reciprocityNudged\"" }
  ]
});

rc |= sabotage.prove({
  file: "helpers.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "route-noun gate dropped — ordinary parentheticals get rewritten", mustFail:"road names canonicalize on an UNORDERED endpoint pair at the map write",
      find: "if(!m||!ROUTE_NOUN_RE.test(m[1]))return s;",
      replace: "if(!m)return s;" },
    { label: "endpoint ordering disabled — reversed twins mint separate nodes again", mustFail:"road names canonicalize on an UNORDERED endpoint pair at the map write",
      find: "var flip=a.toLowerCase()>b.toLowerCase();",
      replace: "var flip=false;" }
  ]
});

// ── Phase B: the location domain ────────────────────────────────────────────────────────────
rc |= sabotage.prove({
  file: "identity.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "locResolve alias hop disabled — aliases stop resolving", mustFail:"locResolve: identity without a table; alias and tombstone chains; cycl",
      find: "if(hitK&&hitK!==cur){",
      replace: "if(false){" },
    { label: "fold loses the visits sum", mustFail:"[MERGE:location|A|B] folds by the A0 field rules: visits sum, firstVis",
      find: "canonNode.visits=(canonNode.visits||0)+(dupNode.visits||0);",
      replace: "canonNode.visits=canonNode.visits||0;" },
    { label: "merge stops healing live pointers", mustFail:"location merge heals the O(1) live pointers: world pointer, combat.nod",
      find: "_locResGen++;\n  _locHealLivePointers(R);\n  _locCompactEdges(R);\n  R.muts.push(\"Location merged: \"+duplicate+\" -> \"+canonical);",
      replace: "_locResGen++;\n  _locCompactEdges(R);\n  R.muts.push(\"Location merged: \"+duplicate+\" -> \"+canonical);" },
    { label: "location merges stop archiving pre-images", mustFail:"location merge: tombstone + alias + pre-image archived (domain:locatio",
      find: "  memArchive().identityMerges.push({domain:\"location\",op:\"merge\",canonical:canonical,duplicate:duplicate,turn:R.turn,\n    records:{node:JSON.parse(JSON.stringify(memory.map.nodes[duplicate])),identity:entries[duplicate]?JSON.parse(JSON.stringify(entries[duplicate])):null,locations:memory.locations[duplicate]?JSON.parse(JSON.stringify(memory.locations[duplicate])):null}});",
      replace: "" }
  ]
});
rc |= sabotage.prove({
  file: "memory.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "fileLocation stops resolving — tombstoned keys re-mint", mustFail:"write-time canonicalization: [LOCATION:] of a merged name lands on the",
      find: "if(typeof locResolve===\"function\")loc=locResolve(loc);",
      replace: "" },
    { label: "RAG e.l scoring reverts to literal equality — merged scenes go invisible", mustFail:"RAG location scoring resolves e.l: a scene stamped under the merged na",
      find: "if(q.loc&&(typeof locSame===\"function\"?locSame(en.e.l,q.loc):en.e.l===q.loc))sc+=2;",
      replace: "if(q.loc&&en.e.l===q.loc)sc+=2;" }
  ]
});
rc |= sabotage.prove({
  file: "api.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "geo block lookups stop resolving the current key", mustFail:"geo block resolves: current-at-merged-name serves the canonical record",
      find: "var wKey=w.location,rwKey=locResolve(wKey);",
      replace: "var wKey=w.location,rwKey=wKey;" }
  ]
});
rc |= sabotage.prove({
  file: "game.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "scene-manifest presence reverts to literal lastSeenAt equality", mustFail:"scene manifest presence resolves lastSeenAt through the identity table",
      find: "var rls=ls?locResolve(ls):\"\",rLoc=locResolve(loc),rNode=locResolve(nodeKey);",
      replace: "var rls=ls,rLoc=loc,rNode=nodeKey;" }
  ]
});
rc |= sabotage.prove({
  file: "dev/loc-repair-core.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "the census auto-classifies (adjudication stolen from the human)", mustFail:"repair census (dev core): finds shadow pairs, byte-identical-descripti",
      find: "groups.push({evidence:evidence,members:members,note:note||\"\",classification:\"undecided\"});",
      replace: "groups.push({evidence:evidence,members:members,note:note||\"\",classification:\"merge\"});" },
    { label: "dry-run stops cloning — a preview mutates the real save", mustFail:"repair plan dry-run mutates NOTHING and reports the diff; apply matche",
      find: "    memory=JSON.parse(JSON.stringify(svM));\n    worldState=JSON.parse(JSON.stringify(svW));",
      replace: "" }
  ]
});

process.exit(rc ? 1 : 0);
