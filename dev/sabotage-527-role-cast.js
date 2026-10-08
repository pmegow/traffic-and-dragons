// Cast observations must share one contextual resolver without changing general NPC identity.
var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
  "file": "identity.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#527 role cast identity"
    ]
  ],
  "cases": [
    {
      "label": "cast observation skips role adapter",
      "find": "take(resolveSceneCastName(parts[i]),\"cast\")",
      "replace": "take(parts[i],\"cast\")",
      "mustFail": "role cast alone"
    },
    {
      "label": "canonical speaker authorization skips role adapter",
      "find": "castCanon[resolveSceneCastName(ck)]=1",
      "replace": "castCanon[resolveNpcName(ck)]=1",
      "mustFail": "role cast binds"
    },
    {
      "label": "companion omission skips role adapter",
      "find": "cast[resolveSceneCastName(k)]=1",
      "replace": "cast[resolveNpcName(k)]=1",
      "mustFail": "role cast alone"
    },
    {
      "label": "occupation registry rejects smith",
      "find": "smith:1,blacksmith:1",
      "replace": "smith:0,blacksmith:1",
      "mustFail": "role cast binds"
    },
    {
      "label": "occupation registry rejects blacksmith",
      "find": "smith:1,blacksmith:1",
      "replace": "smith:1,blacksmith:0",
      "mustFail": "role cast alone"
    },
    {
      "label": "exact recorded role name loses precedence",
      "find": "if(memoryNpcIsPlayer(raw)||wsNpcByName(canon)||(memory.npcs&&memory.npcs[canon]))return canon;",
      "replace": "if(memoryNpcIsPlayer(raw))return canon;",
      "mustFail": "role cast preserves"
    }
  ]
}));
