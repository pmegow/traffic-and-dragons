// #527(16): compact settlement rendering preserves literal campaign titles.
var sabotage=require("./sabotage.js"),rc=0;
rc|=sabotage.prove({
  "file": "helpers.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#527 Village settled campaign title"
    ]
  ],
  "cases": [
    {
      "label": "campaign names are split at a colon",
      "find": "\" in \"+last.camp",
      "replace": "\" in \"+last.camp.split(\":\")[0]",
      "mustFail": "#527 Village preserves literal"
    },
    {
      "label": "compact render still includes reason",
      "find": "opts&&opts.omitHow?\"\":",
      "replace": "false?\"\":",
      "mustFail": "#527 Village preserves literal"
    },
    {
      "label": "default rendering loses reason",
      "find": "opts&&opts.omitHow?\"\":",
      "replace": "true?\"\":",
      "mustFail": "#527 settled renderer keeps default"
    }
  ]
});
rc|=sabotage.prove({
  "file": "api.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#527 Village settled campaign title"
    ]
  ],
  "cases": [
    {
      "label": "Village caller requests detailed history",
      "find": "motivationSettledLine(cs,{omitHow:typeof kindDef===\"function\"&&kindDef().smallTalk})",
      "replace": "motivationSettledLine(cs)",
      "mustFail": "#527 Village preserves literal"
    },
    {
      "label": "adventure also omits settlement reason",
      "find": "motivationSettledLine(cs,{omitHow:typeof kindDef===\"function\"&&kindDef().smallTalk})",
      "replace": "motivationSettledLine(cs,{omitHow:true})",
      "mustFail": "#527 adventure preserves full"
    }
  ]
});
process.exit(rc);
