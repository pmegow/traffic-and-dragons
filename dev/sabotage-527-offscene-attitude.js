// #527(2): suppression must follow the presence-gated sheet, never erase off-scene context.
var sabotage=require("./sabotage.js"),rc=0;
rc|=sabotage.prove({
  "file": "helpers.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#527 off-scene NPC attitude"
    ]
  ],
  "cases": [
    {
      "label": "off-scene sheets suppress attitude again",
      "find": "&&typeof scenePresentNow===\"function\"&&scenePresentNow(n.name)",
      "replace": "",
      "mustFail": "#527 absent traited NPC keeps attitude"
    },
    {
      "label": "present sheets never suppress attitude",
      "find": "&&typeof scenePresentNow===\"function\"&&scenePresentNow(n.name)",
      "replace": "&&false",
      "mustFail": "#527 attitude suppression follows"
    },
    {
      "label": "party sheet suppresses recorded attitude",
      "find": "n&&!n.partyMember&&n.charSheet&&typeof n.charSheet.trait===\"string\"&&n.charSheet.trait.trim()",
      "replace": "n&&n.charSheet&&typeof n.charSheet.trait===\"string\"&&n.charSheet.trait.trim()",
      "mustFail": "#527 party, traitless and unsheeted"
    },
    {
      "label": "empty sheet trait suppresses recorded attitude",
      "find": "n&&!n.partyMember&&n.charSheet&&typeof n.charSheet.trait===\"string\"&&n.charSheet.trait.trim()",
      "replace": "n&&!n.partyMember&&n.charSheet&&typeof n.charSheet.trait===\"string\"",
      "mustFail": "#527 party, traitless and unsheeted"
    }
  ]
});
rc|=sabotage.prove({
  "file": "memory.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#527 off-scene NPC attitude"
    ]
  ],
  "cases": [
    {
      "label": "detail ignores shared presence predicate",
      "find": "n.attitude&&!(typeof sheetTraitLeads===\"function\"&&sheetTraitLeads(name))",
      "replace": "n.attitude&&false",
      "mustFail": "#527 absent traited NPC keeps attitude"
    },
    {
      "label": "graph ignores shared presence predicate",
      "find": "npc.attitude&&!(typeof sheetTraitLeads===\"function\"&&sheetTraitLeads(name))",
      "replace": "npc.attitude&&false",
      "mustFail": "#527 absent traited NPC keeps attitude"
    }
  ]
});
process.exit(rc);
