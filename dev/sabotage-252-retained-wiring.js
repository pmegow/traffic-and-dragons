// Retained mutation proof for the applicability, CI-topology, and read-only replay guards.
var sabotage = require("./sabotage.js"), rc = 0;

rc |= sabotage.prove({
  file: "dev/check-sabotage-applicability.js",
  also: ["dev/tests-252-retained-proof-wiring.js"],
  command: ["node", ["dev/tests-252-retained-proof-wiring.js", "disposable fixture"]],
  cases: [
    {
      label: "stale find targets stop failing the dry scan",
      mustFail: "applicability scan rejects a stale target in a disposable fixture",
      find: "if (after === before) failures.push(clause.battery + \" :: \" + clause.spec.label + \" find target is stale in \" + clause.file);",
      replace: "if (false) failures.push(clause.battery + \" :: \" + clause.spec.label + \" find target is stale in \" + clause.file);"
    }
  ]
});

rc |= sabotage.prove({
  file: "dev/check-sabotage-applicability.js",
  also: ["dev/tests-252-retained-proof-wiring.js"],
  command: ["node", ["dev/tests-252-retained-proof-wiring.js", "LF-to-CRLF"]],
  cases: [
    {
      label: "LF-authored clauses stop matching CRLF targets",
      mustFail: "applicability scan shares sabotage.js LF-to-CRLF target normalization",
      find: "if (source.indexOf(nlNorm(cFind)) >= 0) { cFind = nlNorm(cFind); cRepl = nlNorm(cRepl); }",
      replace: "if (false) { cFind = nlNorm(cFind); cRepl = nlNorm(cRepl); }"
    }
  ]
});

rc |= sabotage.prove({
  file: "dev/check-sabotage-applicability.js",
  also: ["dev/tests-252-retained-proof-wiring.js"],
  command: ["node", ["dev/tests-252-retained-proof-wiring.js", "empty battery inventory"]],
  cases: [
    {
      label: "an empty battery inventory reports green",
      mustFail: "applicability scan refuses an empty battery inventory",
      find: "if (!result.batteries || !result.clauses) {",
      replace: "if (false) {"
    }
  ]
});

rc |= sabotage.prove({
  file: "dev/check-enforcement.js",
  also: ["dev/tests-verification-enforcement.js"],
  command: ["node", ["dev/tests-verification-enforcement.js"]],
  cases: [
    { label: "CI can drop the applicability scan", mustFail: "CI/pre-commit topology rejects removal of every required enforcement step", find: "    { label: \"node dev/check-sabotage-applicability.js\", pattern: /run:\\s*node dev\\/check-sabotage-applicability\\.js(?:\\s|$)/ },\n", replace: "" },
    { label: "CI can drop the v1238 replay", mustFail: "CI/pre-commit topology rejects removal of every required enforcement step", find: "    { label: \"v1238 diff-replay baseline check\", pattern: /run:\\s*node dev\\/diff-replay\\.js dev\\/corpus_playtest_v1238\\.json --check(?:\\s|$)/ },\n", replace: "" },
    { label: "CI can drop the v1258 replay", mustFail: "CI/pre-commit topology rejects removal of every required enforcement step", find: "    { label: \"v1258 diff-replay baseline check\", pattern: /run:\\s*node dev\\/diff-replay\\.js dev\\/corpus_playtest_v1258\\.json --check(?:\\s|$)/ },\n", replace: "" },
    { label: "CI can drop the v1271 replay", mustFail: "CI/pre-commit topology rejects removal of every required enforcement step", find: "    { label: \"v1271 diff-replay baseline check\", pattern: /run:\\s*node dev\\/diff-replay\\.js dev\\/corpus_playtest_v1271\\.json --check(?:\\s|$)/ },\n", replace: "" },
    { label: "CI can drop the v1276 replay", mustFail: "CI/pre-commit topology rejects removal of every required enforcement step", find: "    { label: \"v1276 diff-replay baseline check\", pattern: /run:\\s*node dev\\/diff-replay\\.js dev\\/corpus_playtest_v1276\\.json --check(?:\\s|$)/ },\n", replace: "" }
  ]
});

rc |= sabotage.prove({
  file: "dev/diff-replay.js",
  also: ["dev/tests-252-retained-proof-wiring.js", "dev/corpus_playtest_v1238.json.endstate.json"],
  command: ["node", ["dev/tests-252-retained-proof-wiring.js", "diff replay check"]],
  cases: [
    {
      label: "--check falls through to baseline overwrite mode",
      mustFail: "diff replay check accepts the committed v1238 baseline without rewriting it",
      find: "if (checkOnly) {",
      replace: "if (false) {"
    },
    {
      label: "mismatched end states stop failing CI",
      mustFail: "diff replay check rejects a mismatched baseline and leaves it byte-identical",
      find: "  if (expectedEndState !== endState) {",
      replace: "  if (false) {"
    }
  ]
});

process.exit(rc);
