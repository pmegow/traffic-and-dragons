// Personal owner words share the identity vocabulary without broadening name tokenization.
var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
  "file": "helpers.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#527 house owner personal names"
    ]
  ],
  "cases": [
    {
      "label": "generic words become owners again",
      "find": "||_NPC_STOP[toks[j]]",
      "replace": "",
      "mustFail": "old miller house"
    },
    {
      "label": "only old is excluded rather than shared identity vocabulary",
      "find": "||_NPC_STOP[toks[j]]",
      "replace": "||toks[j]===\"old\"",
      "mustFail": "rejects generic partial"
    },
    {
      "label": "every partial name is excluded",
      "find": "if(toks[j].length<2||_NPC_STOP[toks[j]])continue;",
      "replace": "continue;",
      "mustFail": "rejects generic partial"
    }
  ]
}));
