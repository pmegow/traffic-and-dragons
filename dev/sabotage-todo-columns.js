// Prove the column guard catches both data corruption and a staged/working-tree mixup.
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({
  file: "dev/check-todo-columns.js",
  command: ["node", ["dev/tests-todo-columns.js"]],
  cases: [
    { label: "extra columns silently pass", mustFail: "raw prose pipes are rejected with row number and expected width",
      find: "if (measured.columns !== expected) errors.push",
      replace: "if (false) errors.push" },
    { label: "escaped prose pipes become separators again", mustFail: "escaped and code-span pipes preserve five columns",
      find: 'if (ch === "\\\\" && line.charAt(i + 1) === "|") { i++; continue; }',
      replace: "if (false) { i++; continue; }" },
    { label: "code spans lose their boundary protection", mustFail: "escaped and code-span pipes preserve five columns",
      find: 'if (ch === "|" && !inCode) separators++;',
      replace: 'if (ch === "|") separators++;' },
    { label: "hook checks the working file instead of the staged file", mustFail: "staged guard reads the index even when the working file is repaired",
      find: 'var text = staged ? cp.execFileSync',
      replace: 'var text = false ? cp.execFileSync' }
  ]
}) ? 1 : 0);
