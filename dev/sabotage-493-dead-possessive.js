// dev/sabotage-493-dead-possessive.js — proves the #493 guard is guarded (playtest v1.1078: "Show Aldric's arena token" was
// rejected as an interaction with the dead Aldric). Rule ③ of the suggestion gate now skips a name, or the rest of a full name,
// followed by an apostrophe: a possessive names the thing. A bare name after the verb is still an interaction with the dead.
// Each mutation runs in a disposable clone.
//   node dev/sabotage-493-dead-possessive.js
var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
  "file": "game.js",
  "command": [
    "node",
    [
      "dev/run-tests.js",
      "suggestion affordance gate (#126)"
    ]
  ],
  "cases": [
    {
      "label": "a possessive is read as the dead owner again",
      "find": "(?!(?:\\\\s+\"+alt+\"\\\\b)*['\\u2019])",
      "replace": "",
      "mustFail": "#493 a possessive names the thing"
    },
    {
      "label": "only a first-name possessive is skipped (\"Nualia Tobyn's token\" is rejected)",
      "find": "(?!(?:\\\\s+\"+alt+\"\\\\b)*['\\u2019])",
      "replace": "(?!['\\u2019])",
      "mustFail": "#493 a possessive names the thing"
    },
    {
      "label": "a curly apostrophe is not a possessive",
      "find": "(?!(?:\\\\s+\"+alt+\"\\\\b)*['\\u2019])",
      "replace": "(?!(?:\\\\s+\"+alt+\"\\\\b)*['])",
      "mustFail": "#493 a possessive names the thing"
    },
    {
      "label": "a name followed by any word is skipped (the rule goes blind to the dead)",
      "find": "(?!(?:\\\\s+\"+alt+\"\\\\b)*['\\u2019])",
      "replace": "(?!\\\\s)",
      "mustFail": "#493 a possessive names the thing"
    }
  ]
})?1:0);
