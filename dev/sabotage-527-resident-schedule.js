// #527(9): stable preferred commons plus legal fallbacks, and the shared leading-travel boundary.
var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
  "file": "helpers.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#527 resident schedule and travel"
    ]
  ],
  "cases": [
    {
      "label": "closed venues are filtered before choosing the schedule index",
      "find": "  var list=villageCommons();",
      "replace": "  var list=villageCommons().filter(function(c){var nd=memory.map.nodes[locResolve(v+\"|\"+c)];return nodeOpenAtHour(nd,hour)!==false;});",
      "mustFail": "#527 opening one venue does not move"
    },
    {
      "label": "a closed preferred venue is served",
      "find": "if(nodeOpenAtHour(nd,hour)!==false)return {place:place,home:false};",
      "replace": "if(true)return {place:place,home:false};",
      "mustFail": "#527 closed preferred venue uses"
    },
    {
      "label": "the search does not reach an open fallback",
      "find": "for(i=0;i<list.length;i++){\n    var place=list[(start+i)%list.length]",
      "replace": "for(i=0;i<1;i++){\n    var place=list[(start+i)%list.length]",
      "mustFail": "#527 closed preferred venue uses"
    },
    {
      "label": "the three-hour schedule changes every hour",
      "find": "var start=(h+Math.floor(hour/3))%list.length;",
      "replace": "var start=(h+hour)%list.length;",
      "mustFail": "#527 opening one venue does not move"
    },
    {
      "label": "Go to loses travel status",
      "find": "|go (?:back )?to|head(?=\\s+home\\b)",
      "replace": "|go back to|head(?=\\s+home\\b)",
      "mustFail": "#527 Go to and Head home wait"
    },
    {
      "label": "Head home loses travel status",
      "find": "|head(?=\\s+home\\b)|set out",
      "replace": "|set out",
      "mustFail": "#527 Go to and Head home wait"
    },
    {
      "label": "head wound and homework become travel",
      "find": "head(?=\\s+home\\b)",
      "replace": "head",
      "mustFail": "#527 travel parser distinguishes"
    }
  ]
}));
