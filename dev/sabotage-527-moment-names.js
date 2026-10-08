// #527(7): articles and titles cannot stand for a party member in either moment reader.
var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
  "file": "helpers.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#527 meaningful moment names"
    ]
  ],
  "cases": [
    {
      "label": "detector restores unconditional first-word exemption",
      "find": "if(spl.indexOf(exl[j][ni])>=0)own=true;",
      "replace": "if(spl.indexOf(exl[j][ni])>=0||String(ex[j]).toLowerCase().split(/\\s+/)[0]===s.speaker.toLowerCase().split(/\\s+/)[0])own=true;",
      "mustFail": "#527 The innkeeper is not The Entity"
    },
    {
      "label": "article first words identify party members again",
      "find": "&&npcCoreTokens(first).length",
      "replace": "",
      "mustFail": "#527 ordinary articles do not raise"
    },
    {
      "label": "generic-only full names identify a member",
      "find": "if(!full||!npcCoreTokens(full).length)return forms;",
      "replace": "if(!full)return forms;",
      "mustFail": "#527 meaningful first names retain"
    },
    {
      "label": "full titled name is unavailable",
      "find": "if(full!==first||full.length>=(minFirst||1))forms.push(full);",
      "replace": "if(false)forms.push(full);",
      "mustFail": "#527 ordinary articles do not raise"
    },
    {
      "label": "meaningful first names are unavailable",
      "find": "&&npcCoreTokens(first).length)forms.push(first);",
      "replace": "&&false)forms.push(first);",
      "mustFail": "#527 meaningful first names retain"
    },
    {
      "label": "past reader lowers its short-name floor",
      "find": "momentNameForms(n,3)",
      "replace": "momentNameForms(n,1)",
      "mustFail": "#527 meaningful first names retain"
    },
    {
      "label": "retelling reader loses short given name entitlement",
      "find": "exl=ex.map(function(n){return momentNameForms(n);})",
      "replace": "exl=ex.map(function(n){return momentNameForms(n,3);})",
      "mustFail": "#527 meaningful first names retain"
    },
    {
      "label": "punctuation in a name is treated as regex syntax",
      "find": "    var named=false;for(j=0;j<nameForms.length&&!named;j++)if(new RegExp(\"(^|[^a-z0-9])\"+nameForms[j].replace(/[.*+?^{}$()|[\\]\\\\]/g,\"\\\\$&\")+\"([^a-z0-9]|$)\",\"i\").test(low))named=true;",
      "replace": "    var named=false;for(j=0;j<nameForms.length&&!named;j++)if(new RegExp(\"(^|[^a-z0-9])\"+nameForms[j]+\"([^a-z0-9]|$)\",\"i\").test(low))named=true;",
      "mustFail": "#527 meaningful first names retain"
    },
    {
      "label": "a name matches inside another word",
      "find": "    var named=false;for(j=0;j<nameForms.length&&!named;j++)if(new RegExp(\"(^|[^a-z0-9])\"+nameForms[j].replace(/[.*+?^{}$()|[\\]\\\\]/g,\"\\\\$&\")+\"([^a-z0-9]|$)\",\"i\").test(low))named=true;",
      "replace": "    var named=false;for(j=0;j<nameForms.length&&!named;j++)if(new RegExp(\"\"+nameForms[j].replace(/[.*+?^{}$()|[\\]\\\\]/g,\"\\\\$&\")+\"([^a-z0-9]|$)\",\"i\").test(low))named=true;",
      "mustFail": "#527 meaningful first names retain"
    }
  ]
}));
