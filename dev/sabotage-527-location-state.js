// #527(18): durable-note receipt and current-world spelling.
var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
  "file": "tag_table.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#527 location state receipt and world case"
    ]
  ],
  "cases": [
    {
      "label": "terminal s is stripped from a place-qualified receipt",
      "find": "lsNote.slice(0,60).replace(/\\s+$/,\"\")",
      "replace": "lsNote.slice(0,60).replace(/s+$/,\"\")",
      "mustFail": "#527 location receipt retains"
    },
    {
      "label": "receipt boundary whitespace is not trimmed",
      "find": "lsNote.slice(0,60).replace(/\\s+$/,\"\")",
      "replace": "lsNote.slice(0,60)",
      "mustFail": "#527 location receipt retains"
    },
    {
      "label": "world names compare case-exact again",
      "find": "lsPl.toLowerCase()===String(lsW).toLowerCase()",
      "replace": "lsPl===String(lsW)",
      "mustFail": "#527 world case variant"
    },
    {
      "label": "an unrelated world name is accepted",
      "find": "lsPl.toLowerCase()===String(lsW).toLowerCase()",
      "replace": "true",
      "mustFail": "#527 world comparison uses each"
    }
  ]
}));
