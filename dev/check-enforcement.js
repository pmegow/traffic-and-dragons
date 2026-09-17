// check-enforcement.js — pure contracts for the local/CI gate topology. The CI workflow runs
// run-tests.js, and run-tests.js calls this checker, so deleting that step, the focused sabotage
// step, or a local pre-commit layer makes the surviving gate fail loudly.
//
// #G1 (audit 2026-09-18): the two lists above are hand-written per surface, and that is exactly
// how CI came to run ONE of the five gates dev/pre-commit runs. The workflow header says it
// exists because --no-verify or another machine bypasses the hook — so any gate the hook enforces
// and the workflow does not is enforced by NOBODY in precisely the case the workflow was written
// for. coverageProblems() derives the requirement from the hook itself instead of restating it:
// every dev/<tool>.js the pre-commit invokes must also be invoked by the workflow. Add a gate to
// the hook, forget CI, and the build fails.
var fs = require("fs");
var path = require("path");

// The ONE documented exemption. check-hook-parity.js compares the INSTALLED .git/hooks/pre-commit
// against the tracked dev/pre-commit; a CI checkout has no installed hook, so there is nothing
// there for CI to verify, and installing it first in order to compare it would be a tautology.
// A new entry here needs a reason of the same kind: "CI structurally cannot observe this".
var HOOK_ONLY = {
  "check-hook-parity.js": "local-only: it compares the INSTALLED .git hook, which a CI checkout does not have"
};

function orderedProblems(source, clauses, surface) {
  var problems = [], previous = -1;
  for (var i = 0; i < clauses.length; i++) {
    var at = source.search(clauses[i].pattern);
    if (at < 0) problems.push(surface + " missing " + clauses[i].label);
    else if (at < previous) problems.push(surface + " has " + clauses[i].label + " out of order");
    else previous = at;
  }
  return problems;
}
function workflowProblems(source) {
  return orderedProblems(String(source || ""), [
    { label: "actions/checkout@v4", pattern: /actions\/checkout@v4/ },
    { label: "actions/setup-node@v4", pattern: /actions\/setup-node@v4/ },
    { label: "Node 22", pattern: /node-version:\s*["']?22["']?/ },
    /* #G1: the three hook gates that had never crossed to CI. They run BEFORE the suite here,
       in the hook's own order, so a red one blocks the expensive steps the way it does locally. */
    { label: "node dev/lint-todo.js --git-aware (#G1 hook parity)", pattern: /node dev\/lint-todo\.js[^\n]*--git-aware/ },
    { label: "node dev/tests-todo-hygiene.js (#G1 hook parity)", pattern: /run:\s*node dev\/tests-todo-hygiene\.js(?:\s|$)/ },
    { label: "node dev/check-shell-markers.js --ci (#G1 hook parity)", pattern: /node dev\/check-shell-markers\.js\s+--ci(?:\s|$)/ },
    { label: "node dev/run-tests.js", pattern: /run:\s*node dev\/run-tests\.js(?:\s|$)/ },
    { label: "node dev/check-sabotage-applicability.js", pattern: /run:\s*node dev\/check-sabotage-applicability\.js(?:\s|$)/ },
    { label: "v1238 diff-replay baseline check", pattern: /run:\s*node dev\/diff-replay\.js dev\/corpus_playtest_v1238\.json --check(?:\s|$)/ },
    { label: "v1258 diff-replay baseline check", pattern: /run:\s*node dev\/diff-replay\.js dev\/corpus_playtest_v1258\.json --check(?:\s|$)/ },
    { label: "v1271 diff-replay baseline check", pattern: /run:\s*node dev\/diff-replay\.js dev\/corpus_playtest_v1271\.json --check(?:\s|$)/ },
    { label: "v1276 diff-replay baseline check", pattern: /run:\s*node dev\/diff-replay\.js dev\/corpus_playtest_v1276\.json --check(?:\s|$)/ },
    { label: "node dev/sabotage-w2.js --focused", pattern: /run:\s*node dev\/sabotage-w2\.js\s+--focused(?:\s|$)/ }
  ], "engine-tests.yml");
}
// hookGateNames — every dev/<tool>.js the pre-commit invokes, in the order it invokes them.
function hookGateNames(source) {
  var seen = {}, names = [], re = /dev\/([A-Za-z0-9_.-]+\.js)/g, m;
  while ((m = re.exec(String(source || "")))) { if (!seen[m[1]]) { seen[m[1]] = true; names.push(m[1]); } }
  return names;
}
// coverageProblems — the #G1 rule: no gate may be hook-only except by a listed, reasoned exemption.
function coverageProblems(workflow, hook) {
  var text = String(workflow || ""), problems = [];
  hookGateNames(hook).forEach(function (name) {
    if (HOOK_ONLY[name]) return;
    if (text.indexOf("dev/" + name) < 0)
      problems.push("engine-tests.yml never runs dev/" + name + ", which dev/pre-commit does — a gate the hook enforces and CI does not is enforced by nobody the moment the hook is bypassed (#G1). Add it to the workflow, or add a reasoned entry to HOOK_ONLY in check-enforcement.js.");
  });
  return problems;
}
function preCommitProblems(source) {
  return orderedProblems(String(source || ""), [
    { label: "check-hook-parity.js", pattern: /dev\/check-hook-parity\.js/ },
    { label: "lint-todo.js --git-aware --staged", pattern: /dev\/lint-todo\.js[^\n]*--git-aware\s+--staged/ },
    { label: "tests-todo-hygiene.js", pattern: /dev\/tests-todo-hygiene\.js/ },
    { label: "check-shell-markers.js", pattern: /dev\/check-shell-markers\.js/ },
    { label: "run-tests.js", pattern: /dev\/run-tests\.js/ }
  ], "dev/pre-commit");
}
function realProblems(root) {
  var workflow = fs.readFileSync(path.join(root, ".github", "workflows", "engine-tests.yml"), "utf8");
  var hook = fs.readFileSync(path.join(root, "dev", "pre-commit"), "utf8");
  return workflowProblems(workflow).concat(preCommitProblems(hook)).concat(coverageProblems(workflow, hook));
}

module.exports = { workflowProblems: workflowProblems, preCommitProblems: preCommitProblems, coverageProblems: coverageProblems, hookGateNames: hookGateNames, HOOK_ONLY: HOOK_ONLY, realProblems: realProblems };
