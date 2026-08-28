// Retained mutation proof for #144A's archive carry at import and every capped NPC write path.
var sabotage = require("./sabotage.js"), rc = 0;

rc |= sabotage.prove({
  file: "state.js",/* JP0-5 (v1.722): the import rebuild moved from the ui-files.js hand-copied whitelist into archiveRebuild — the clauses now mutate the registry path itself */
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    {
      label: ".tnd import drops archived NPC knowledge",
      mustFail: "a full archive round-trips EVERY shipped category",
      find: "      if(known[k]){if(Array.isArray(src[k]))out[k]=src[k];}",
      replace: "      if(known[k]){if(Array.isArray(src[k])&&k!==\"npcKnowledge\")out[k]=src[k];}"
    },
    {
      label: ".tnd import drops archived NPC events",
      mustFail: "a full archive round-trips EVERY shipped category",
      find: "      if(known[k]){if(Array.isArray(src[k]))out[k]=src[k];}",
      replace: "      if(known[k]){if(Array.isArray(src[k])&&k!==\"npcEvents\")out[k]=src[k];}"
    }
  ]
});

rc |= sabotage.prove({
  file: "memory.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    {
      /* #269 re-point: the three filing sites now route through fileNpcKnowledge — the void
         shed is now the HELPER's cap eviction losing its archive */
      label: "the shared knowledge helper's cap eviction sheds to the void",
      mustFail: "bare knowledge.shift() in memory.js",
      find: "while(n.knowledge.length>12)memArchive().npcKnowledge.push({npc:name,fact:n.knowledge.shift(),turn:turn});",
      replace: "while(n.knowledge.length>12)n.knowledge.shift();"
    },
    {
      label: "supersession stops filing through the shared knowledge helper",
      mustFail: "summary supersession no longer files through fileNpcKnowledge",
      find: "fileNpcKnowledge(sfName,newFact,worldState.turn,true);",
      replace: "if(sfNpc.knowledge.indexOf(newFact)<0)sfNpc.knowledge.push(newFact);"
    },
    {
      label: "summary knowledge filing stops routing through the shared helper",
      mustFail: "summary knowledge filing no longer routes through fileNpcKnowledge",
      find: "else if(_kgFact){fileNpcKnowledge(nuName,_kgFact,worldState.turn,false);",
      replace: "else if(_kgFact){if(memory.npcs[nuName].knowledge.indexOf(_kgFact)<0)memory.npcs[nuName].knowledge.push(_kgFact);"
    },
    {
      label: "NPC event overflow stops entering the archive",
      mustFail: "fileNpcEvent no longer archives evicted events",
      find: "memArchive().npcEvents.push({npc:name,note:_evD[_evi].note,turn:_evD[_evi].turn})",
      replace: "void _evD[_evi]"
    },
    {
      label: "extractor loses the durable-versus-scene filing lesson",
      mustFail: "extraction schema no longer teaches the durable/scene kind",
      find: "scene facts are filed as dated history",
      replace: "scene facts are stored without a filing rule"
    }
  ]
});

rc |= sabotage.prove({
  file: "tag_table.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    {
      label: "NPC_MERGE overflow stops entering archive.npcKnowledge",
      mustFail: "NPC_MERGE truncation no longer archives its overflow",
      find: "memArchive().npcKnowledge.push({npc:mgCanon,fact:mgOv[mgOvi],turn:worldState.turn})",
      replace: "void mgOv[mgOvi]"
    }
  ]
});

process.exit(rc);
