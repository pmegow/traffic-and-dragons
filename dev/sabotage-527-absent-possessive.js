// #527(20): possession never bypasses a later direct address.
var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
  "file": "game.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#527 absent companion possessive"
    ]
  ],
  "cases": [
    {
      "label": "absent caller loses possessive boundary",
      "find": "    if(new RegExp(\"\\\\b(talk (to|with)|speak (to|with)|ask|tell|question|confront|greet|approach|show|give|message|signal|hail|summon|contact|warn|alert|call out to)\\\\b[ '\\\"]{0,3}(to |with |the |a )?\"+suggestionPersonNamePattern(npcs[j].name),\"i\").test(t))",
      "replace": "    if(new RegExp(\"\\\\b(talk (to|with)|speak (to|with)|ask|tell|question|confront|greet|approach|show|give|message|signal|hail|summon|contact|warn|alert|call out to)\\\\b[ '\\\"]{0,3}(to |with |the |a )?\"+suggestionNameAlt(npcs[j].name)+\"\\\\b\",\"i\").test(t))",
      "mustFail": "#527 absent companion possessions"
    },
    {
      "label": "one possessive exempts a later genuine address",
      "find": "    if(new RegExp(\"\\\\b(talk (to|with)|speak (to|with)|ask|tell|question|confront|greet|approach|show|give|message|signal|hail|summon|contact|warn|alert|call out to)\\\\b[ '\\\"]{0,3}(to |with |the |a )?\"+suggestionPersonNamePattern(npcs[j].name),\"i\").test(t))",
      "replace": "    if(/['’]/.test(t))continue;\n    if(new RegExp(\"\\\\b(talk (to|with)|speak (to|with)|ask|tell|question|confront|greet|approach|show|give|message|signal|hail|summon|contact|warn|alert|call out to)\\\\b[ '\\\"]{0,3}(to |with |the |a )?\"+suggestionPersonNamePattern(npcs[j].name),\"i\").test(t))",
      "mustFail": "#527 absent bare addresses"
    },
    {
      "label": "present characters are treated as absent",
      "find": "    if(npcs[j].dead)continue;/* ③ owns the dead — its message names the real reason */\n    if(present[String(npcs[j].name).toLowerCase()])continue;",
      "replace": "    if(npcs[j].dead)continue;/* ③ owns the dead — its message names the real reason */\n    if(false)continue;",
      "mustFail": "#527 direct address of a present"
    }
  ]
}));
