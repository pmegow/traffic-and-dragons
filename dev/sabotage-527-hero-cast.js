// #527(4): hero identity precedes NPC matching at the shared resolver boundary.
// #616 (2026-10-12): the two hero-guard clauses re-aimed — a possessive names someone else now, so "Ammut" never reaches "Ammut's old master" by
// consolidation and the hero-only cast test no longer needs the guard to pass; the guard still keeps the hero name off an NPC that carries it as an
// exact alias, which "#527 resolver protects only current" proves (same mutations).
var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
  "file": "memory.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#527 hero cast identity"
    ]
  ],
  "cases": [
    {
      "label": "hero enters NPC consolidation again",
      "find": "  if(memoryNpcIsPlayer(name))return name;",
      "replace": "",
      "mustFail": "#527 resolver protects only current"
    },
    {
      "label": "hero guard narrowed to literal player",
      "find": "  if(memoryNpcIsPlayer(name))return name;",
      "replace": "  if(name===\"player\")return name;",
      "mustFail": "#527 resolver protects only current"
    },
    {
      "label": "exact NPC aliases win before hero identity",
      "find": "  if(memoryNpcIsPlayer(name))return name;",
      "replace": "  if(npcExactKey(name,1))return npcExactKey(name,1);\n  if(memoryNpcIsPlayer(name))return name;",
      "mustFail": "#527 resolver protects only current"
    },
    {
      "label": "hero guard captures every NPC name",
      "find": "  if(memoryNpcIsPlayer(name))return name;",
      "replace": "  return name;",
      "mustFail": "#527 resolver protects only current"
    }
  ]
}));
