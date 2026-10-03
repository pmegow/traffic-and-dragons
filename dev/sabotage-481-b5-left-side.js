// dev/sabotage-481-b5-left-side.js — proves the #481 B5 guard (a bare "left" is a SIDE, not a departure — six of six
// field alarms) and its #521 amendment (the plain departures "Daeris left.", "left at dawn" count again; a side or an
// object after "left" does not). Each mutation runs in a disposable clone (sabotage.js); the working tree is never mutated.
//   node dev/sabotage-481-b5-left-side.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 B5"]];
var LEFT = "|leaves|left\\b(?!-)(?!\\s+(?:side|hand|her|his|their|a|an|my|your)\\b)|(?:has|had)\\s+left\\b|";
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "a side or an object after left counts as a departure again (#521: the exclusions are gone)",
    find: LEFT, replace: "|leaves|left\\b(?!-)|(?:has|had)\\s+left\\b|",
    mustFail: "#521 the plain departures" },
  { label: "left-handed counts as a departure again",
    find: LEFT, replace: "|leaves|left\\b(?!\\s+(?:side|hand|her|his|their|a|an|my|your)\\b)|(?:has|had)\\s+left\\b|",
    mustFail: "#521 the plain departures" },
  { label: "a noun's own left counts for the name before it (the gap check is gone)",
    find: "    if(vm&&/\\bleft\\b/i.test(vm[0].slice(vm[1].length))&&!/^\\s*(?:(?:has|had|just|already|quietly|finally|then|now|silently|abruptly|simply|soon|,)\\s*)*$/i.test(vm[1]))vm=null;\n", replace: "",
    mustFail: "the six field lines are no separation" },
  { label: "a plain departure is missed (#521: the complement rule is back)",
    find: LEFT, replace: "|leaves|left(?=\\s+(?:the|for)\\b)|(?:has|had)\\s+left\\b|",
    mustFail: "#521 the plain departures" }
]);
process.exit(code);
