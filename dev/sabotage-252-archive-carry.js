// Retained mutation proof for #144A's archive carry at import and every capped NPC write path.
var sabotage = require("./sabotage.js"), rc = 0;

rc |= sabotage.prove({
  file: "ui-files.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    {
      label: ".tnd import drops archived NPC knowledge",
      mustFail: "import whitelist no longer carries archive.npcKnowledge",
      find: "npcKnowledge:mm.archive.npcKnowledge||[]",
      replace: "npcKnowledge:[]"
    },
    {
      label: ".tnd import drops archived NPC events",
      mustFail: "import whitelist no longer carries archive.npcEvents",
      find: "npcEvents:mm.archive.npcEvents||[]",
      replace: "npcEvents:[]"
    }
  ]
});

rc |= sabotage.prove({
  file: "memory.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    {
      label: "supersession replacement sheds old knowledge to the void",
      mustFail: "bare knowledge.shift() in memory.js",
      find: "memArchive().npcKnowledge.push({npc:sfName,fact:sfNpc.knowledge.shift(),turn:worldState.turn})",
      replace: "sfNpc.knowledge.shift()"
    },
    {
      label: "summary knowledge filing sheds old knowledge to the void",
      mustFail: "summary knowledge filing no longer archives its shifted NPC fact",
      find: "memArchive().npcKnowledge.push({npc:nuName,fact:_kg.shift(),turn:worldState.turn})",
      replace: "_kg.shift()"
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
