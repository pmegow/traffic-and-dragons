// #527(14): titles and descriptive prose retain their own register lexicons.
var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
  "file": "campaign_generator.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#527 skeleton prose register"
    ]
  ],
  "cases": [
    {
      "label": "prose uses the label lexicon again",
      "find": "wordListScan(text,re||REGISTER_RE)",
      "replace": "wordListScan(text,LABEL_RE)",
      "mustFail": "#527 skeleton prose permits"
    },
    {
      "label": "act titles lose paperwork terms",
      "find": "chk(an+\" title\",a.title,LABEL_RE);",
      "replace": "chk(an+\" title\",a.title);",
      "mustFail": "#527 skeleton titles retain"
    },
    {
      "label": "arc titles lose paperwork terms",
      "find": "chk(rn+\" title\",r.title,LABEL_RE);",
      "replace": "chk(rn+\" title\",r.title);",
      "mustFail": "#527 skeleton titles retain"
    },
    {
      "label": "descriptive field stops checking chk(\"premise\",skel.premise);",
      "find": "chk(\"premise\",skel.premise);",
      "replace": "",
      "mustFail": "#527 skeleton keeps the clerical"
    },
    {
      "label": "descriptive field stops checking chk(an+\" goal\",a.goal);",
      "find": "chk(an+\" goal\",a.goal);",
      "replace": "",
      "mustFail": "#527 skeleton keeps the clerical"
    },
    {
      "label": "descriptive field stops checking chk(an+\" turningPoint\",a.turningPoint);",
      "find": "chk(an+\" turningPoint\",a.turningPoint);",
      "replace": "",
      "mustFail": "#527 skeleton keeps the clerical"
    },
    {
      "label": "descriptive field stops checking chk(rn+\" objective\",r.objective);",
      "find": "chk(rn+\" objective\",r.objective);",
      "replace": "",
      "mustFail": "#527 skeleton keeps the clerical"
    },
    {
      "label": "descriptive field stops checking chk(rn+\" dnaHint\",r.dnaHint);",
      "find": "chk(rn+\" dnaHint\",r.dnaHint);",
      "replace": "",
      "mustFail": "#527 skeleton keeps the clerical"
    }
  ]
}));
