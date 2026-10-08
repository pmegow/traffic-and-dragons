// #527(12): refusal advice retains the attempted lifecycle operation.
var sabotage=require("./sabotage.js"),rc=0;
rc|=sabotage.prove({
  "file": "tag_table.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#527 continuation title advice"
    ]
  ],
  "cases": [
    {
      "label": "continuation caller loses its operation",
      "find": "skelTitleMiss(R,\"arc\",_ct,\"continue\");",
      "replace": "skelTitleMiss(R,\"arc\",_ct);",
      "mustFail": "#527 continue miss preserves"
    },
    {
      "label": "continuation operation lost in persisted latch",
      "find": "operation:operation||\"complete\",given:String(given)",
      "replace": "operation:\"complete\",given:String(given)",
      "mustFail": "#527 continue miss preserves"
    },
    {
      "label": "continuation receipt calls it a close",
      "find": "+(operation===\"continue\"?\" continuation\":\" close\")+\" ignored —",
      "replace": "+\" close ignored —",
      "mustFail": "#527 continue miss preserves"
    }
  ]
});
rc|=sabotage.prove({
  "file": "api.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#527 continuation title advice"
    ]
  ],
  "cases": [
    {
      "label": "continuation prompt reverts to closing advice",
      "find": "var continuing=q.operation===\"continue\",tag=",
      "replace": "var continuing=false,tag=",
      "mustFail": "#527 continue miss preserves"
    },
    {
      "label": "legacy completion latch becomes continuation",
      "find": "var continuing=q.operation===\"continue\",tag=",
      "replace": "var continuing=!q.operation||q.operation===\"continue\",tag=",
      "mustFail": "#527 legacy title ping retains"
    },
    {
      "label": "no-title continuation miss called a close",
      "find": "(continuing?\"continuation\":\"close\")",
      "replace": "\"close\"",
      "mustFail": "#527 continue miss with no active"
    },
    {
      "label": "continuation drops required reason advice",
      "find": "(continuing?\"|why it remains open\":\"\")",
      "replace": "\"\"",
      "mustFail": "#527 continue miss preserves"
    }
  ]
});
process.exit(rc);
