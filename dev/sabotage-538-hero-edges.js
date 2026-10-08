// Shared graph and relationship writers guard hero identity before allocating or migrating state.
var sabotage=require("./sabotage.js"),code=0;
if(!code)code=sabotage.prove({
  "file": "memory.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#538 hero graph and relationship boundaries"
    ]
  ],
  "cases": [
    {
      "label": "graph writer leaves endpoints raw",
      "find": "  nameA=personEntityKey(nameA);nameB=personEntityKey(nameB);",
      "replace": "",
      "mustFail": "graph writers canonicalize"
    },
    {
      "label": "graph writer admits normalized self links",
      "find": "  if(nameA===nameB)return npcGraphRefuse(\"a character cannot link to themself: \"+nameA,R);",
      "replace": "",
      "mustFail": "graph writers canonicalize"
    },
    {
      "label": "faction writer admits hero",
      "find": "  if(memoryNpcIsPlayer(npcName))return npcGraphRefuse(\"NPC_FACTION cannot assign the player to an NPC faction: \"+npcName,R);",
      "replace": "",
      "mustFail": "NPC-only faction writer"
    },
    {
      "label": "faction writer leaves NPC alias uncanonicalized",
      "find": "  npcName=personEntityKey(npcName);",
      "replace": "",
      "mustFail": "NPC-only faction writer"
    }
  ]
});
if(!code)code=sabotage.prove({
  "file": "identity.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#538 hero graph and relationship boundaries"
    ]
  ],
  "cases": [
    {
      "label": "person endpoints lose hero canonicalization",
      "find": "function personEntityKey(entity){var raw=String(entity||\"\").trim();if(typeof memoryNpcIsPlayer===\"function\"&&memoryNpcIsPlayer(raw)&&worldState&&worldState.character)return worldState.character.name;return resolveNpcName(raw);}",
      "replace": "function personEntityKey(entity){return resolveNpcName(String(entity||\"\").trim());}",
      "mustFail": "graph writers canonicalize"
    },
    {
      "label": "supplied hero owner reaches shadow sheet",
      "find": "if(who&&memoryNpcIsPlayer(owner))why=",
      "replace": "if(false)why=",
      "mustFail": "companion owner cannot"
    },
    {
      "label": "self relationship becomes admissible",
      "find": "else if(owner===ent)why=",
      "replace": "else if(false)why=",
      "mustFail": "hero self relationships"
    },
    {
      "label": "explicit writer bypasses admission",
      "find": "  var target=relationshipWriteTarget(who,entity,R);if(!target)return false;\n  var sheet=target.sheet,ent=target.entity;",
      "replace": "  var sheet=relationshipSheet(who),ent=relationshipEntityKey(entity);if(!sheet)return false;",
      "mustFail": "hero self relationships"
    },
    {
      "label": "legacy writer bypasses admission",
      "find": "  var target=relationshipWriteTarget(who,entity,R);if(!target)return false;\n  relationshipMigrateSheet(target.sheet,who);return _relationshipQueueAxis(who,target.entity,value,kind,R);",
      "replace": "  var sheet=relationshipSheet(who);if(!sheet)return false;relationshipMigrateSheet(sheet,who);return _relationshipQueueAxis(who,entity,value,kind,R);",
      "mustFail": "hero self relationships"
    }
  ]
});
if(!code)code=sabotage.prove({
  "file": "tag_table.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#538 hero graph and relationship boundaries"
    ]
  ],
  "cases": [
    {
      "label": "refused graph write emits success",
      "find": "if(link)R.muts.push(\"Link: \"+link.a+\" ↔ \"+link.b",
      "replace": "R.muts.push(\"Link: \"+(link||{}).a+\" ↔ \"+(link||{}).b",
      "mustFail": "graph writers canonicalize"
    },
    {
      "label": "refused faction write emits success",
      "find": "if(npcFactionSet(nfp[1].trim(),nfp[2].trim(),nfp[3].trim(),R))R.muts.push",
      "replace": "npcFactionSet(nfp[1].trim(),nfp[2].trim(),nfp[3].trim(),R);R.muts.push",
      "mustFail": "NPC-only faction writer"
    }
  ]
});
process.exit(code);
