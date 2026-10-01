// dev/sabotage-493-dead-possessive.js — proves the #493 guard is guarded (playtest v1.1078: "Show Aldric's arena token" was
// rejected as an interaction with the dead Aldric). Rule ③ of the suggestion gate now skips a name, or the rest of a full name,
// followed by an apostrophe: a possessive names the thing. A bare name after the verb is still an interaction with the dead.
// Each mutation runs in a disposable clone.
//   node dev/sabotage-493-dead-possessive.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "suggestion affordance gate (#126)"]], T = "#493 a possessive names the thing";
process.exit(sabotage.prove({ file: "game.js", command: CMD, cases: [
  { label: "a possessive is read as the dead owner again",
    find: "\\\\b(?!(?:\\\\s+\"+_dnA+\"\\\\b)*['\\u2019])\",\"i\").test(t))", replace: "\\\\b\",\"i\").test(t))",
    mustFail: T },
  { label: "only a first-name possessive is skipped (\"Nualia Tobyn's token\" is rejected)",
    find: "(?!(?:\\\\s+\"+_dnA+\"\\\\b)*['\\u2019])", replace: "(?!['\\u2019])",
    mustFail: T },
  { label: "a curly apostrophe is not a possessive",
    find: ")*['\\u2019])\",\"i\")", replace: ")*['])\",\"i\")",
    mustFail: T },
  { label: "a name followed by any word is skipped (the rule goes blind to the dead)",
    find: "(?!(?:\\\\s+\"+_dnA+\"\\\\b)*['\\u2019])", replace: "(?!\\\\s)",
    mustFail: T }
]}) ? 1 : 0);
