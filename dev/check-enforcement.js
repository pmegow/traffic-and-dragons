// check-enforcement.js — pure contracts for the local/CI gate topology. The CI workflow runs
// run-tests.js, and run-tests.js calls this checker, so deleting that step, the focused sabotage
// step, or a local pre-commit layer makes the surviving gate fail loudly.
var fs = require("fs");
var path = require("path");

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
    { label: "node dev/run-tests.js", pattern: /run:\s*node dev\/run-tests\.js(?:\s|$)/ },
    { label: "node dev/sabotage-w2.js --focused", pattern: /run:\s*node dev\/sabotage-w2\.js\s+--focused(?:\s|$)/ }
  ], "engine-tests.yml");
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
  return workflowProblems(workflow).concat(preCommitProblems(hook));
}

module.exports = { workflowProblems: workflowProblems, preCommitProblems: preCommitProblems, realProblems: realProblems };
