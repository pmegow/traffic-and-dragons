// #527 lead 10: same-response speech authorizes growth; refused growth stays visible.
var sabotage=require("./sabotage.js"),rc=0;
rc|=sabotage.prove({
  "file": "helpers.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#437 motivation lifecycle"
    ]
  ],
  "cases": [
    {
      "label": "SAY evidence disappears",
      "find": "if(findCompanionChar(m[1].trim())===cs)return true;",
      "replace": "if(false)return true;",
      "mustFail": "#527 SAY growth:"
    },
    {
      "label": "Wrong speaker authorizes growth",
      "find": "if(findCompanionChar(m[1].trim())===cs)return true;",
      "replace": "if(findCompanionChar(m[1].trim()))return true;",
      "mustFail": "#527 SAY refusal:"
    },
    {
      "label": "Growth metadata authorizes itself",
      "find": "  if(named(name))return true;",
      "replace": "  if(String(text).indexOf(cs.name)>=0)return true;\n  if(named(name))return true;",
      "mustFail": "#527 SAY refusal:"
    },
    {
      "label": "Prose substring counts as a name",
      "find": "  if(named(name))return true;",
      "replace": "  if(prose.indexOf(name)>=0)return true;",
      "mustFail": "#527 prose evidence:"
    },
    {
      "label": "Article counts as short name",
      "find": "if(!first||/^(the|a|an)$/i.test(first)||!named(first))return false;",
      "replace": "if(!first||!named(first))return false;",
      "mustFail": "#527 prose evidence:"
    },
    {
      "label": "Shared first name counts as unique",
      "find": "  return Object.keys(candidates).length===1;",
      "replace": "  return true;",
      "mustFail": "#527 prose evidence:"
    },
    {
      "label": "Hero omitted from name census",
      "find": "  take(worldState.character&&worldState.character.name);",
      "replace": "",
      "mustFail": "#527 prose evidence:"
    }
  ]
});
rc|=sabotage.prove({
  "file": "tag_table.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#437 motivation lifecycle"
    ]
  ],
  "cases": [
    {
      "label": "Dead companion grows",
      "find": "if(npcIsDead(gnpc)||(memory.npcs&&memory.npcs[gnm]&&memory.npcs[gnm].dead)){",
      "replace": "if(false){",
      "mustFail": "#527 SAY refusal:"
    },
    {
      "label": "Memory death ignored",
      "find": "if(npcIsDead(gnpc)||(memory.npcs&&memory.npcs[gnm]&&memory.npcs[gnm].dead)){",
      "replace": "if(npcIsDead(gnpc)){",
      "mustFail": "#527 prose evidence:"
    },
    {
      "label": "Missing evidence console-only",
      "find": "R.muts.push(\"⚠ \"+gname+\": growth refused — not on screen in this response\");",
      "replace": "",
      "mustFail": "#527 SAY refusal:"
    },
    {
      "label": "Unknown companion console-only",
      "find": "R.muts.push(\"⚠ [COMPANION_GROWTH:] \"+gm[1].trim()+\" — no companion sheet by that name (ignored)\");",
      "replace": "",
      "mustFail": "#527 growth refusals:"
    },
    {
      "label": "Stale flaw console-only",
      "find": "R.muts.push(\"⚠ \"+gname+\": growth refused — the stated flaw does not match the sheet, or nothing changed\");",
      "replace": "",
      "mustFail": "#527 growth refusals:"
    },
    {
      "label": "Unchanged purpose console-only",
      "find": "R.muts.push(\"⚠ \"+gname+\": purpose unchanged — empty or the same text\");",
      "replace": "",
      "mustFail": "#527 growth refusals:"
    }
  ]
});
process.exit(rc?1:0);
