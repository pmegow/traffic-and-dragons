// #527(13): one request per canonical map shop, durable and restored if never delivered.
var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
  "file": "api.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "#527 keeper asks once per shop"
    ]
  ],
  "cases": [
    {
      "label": "visiting a new shop forgets every previous shop",
      "find": "(ka&&ka.nodes instanceof Array)?ka.nodes.slice():[]",
      "replace": "[]",
      "mustFail": "#527 keeper asks A then B once"
    },
    {
      "label": "legacy last-shop latch is forgotten",
      "find": "if(ka&&ka.node)asked.push(ka.node);",
      "replace": "",
      "mustFail": "#527 legacy and aliased shop asks"
    },
    {
      "label": "recorded shop aliases are not canonicalized",
      "find": "nk=(typeof locResolve===\"function\")?locResolve(asked[i]):asked[i];",
      "replace": "nk=asked[i];",
      "mustFail": "#527 legacy and aliased shop asks"
    },
    {
      "label": "canonical duplicates accumulate after a shop merge",
      "find": "&&seen.indexOf(nk)<0)seen.push(nk);",
      "replace": ")seen.push(nk);",
      "mustFail": "#527 legacy and aliased shop asks"
    },
    {
      "label": "deleted and nonshop keys remain in the latch",
      "find": "if(memory.map.nodes[nk]&&isShopNode(nk,memory.map.nodes[nk])&&seen.indexOf(nk)<0)",
      "replace": "if(seen.indexOf(nk)<0)",
      "mustFail": "#527 legacy and aliased shop asks"
    },
    {
      "label": "new shop is never recorded",
      "find": "  seen.push(key);",
      "replace": "",
      "mustFail": "#527 keeper asks A then B once"
    },
    {
      "label": "budget and failed-turn restore lose the whole-shop latch",
      "find": "var k=NOTE_LATCH_FIELDS[i],v=snap.t[k];",
      "replace": "var k=NOTE_LATCH_FIELDS[i],v=snap.t[k];if(k===\"keeperAsk\")continue;",
      "mustFail": "#527 keeper delivery deferral"
    }
  ]
}));
