// sabotage-battery-pool.js — retained proof for the battery pool (2026-10-02): both runners run batteries several at a
// time, each in its own temp dir; a failure beside others is re-run alone and only that verdict counts; a battery that
// passes only alone is named; one job keeps the first verdict; a malformed job count is refused. Every clause must
// redden the "battery pool" probe in dev/tests-252-retained-proof-wiring.js. Each mutation runs in a disposable clone
// (sabotage.js proveScratch); nothing here touches the working tree.
//   node dev/sabotage-battery-pool.js
var sabotage = require("./sabotage.js"), code = 0;
var command = ["node", ["dev/tests-252-retained-proof-wiring.js", "battery pool"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: command, cases: cases }); }
prove("dev/battery-pool.js", [
  { label: "the pool runs one battery at a time",
    find: "var jobs = Math.max(1, Math.min(opts.jobs || 1, files.length))", replace: "var jobs = 1",
    mustFail: "did not run two batteries at once" },
  { label: "every battery inherits the runner's temp dir",
    find: "if ([\"TEMP\", \"TMP\", \"TMPDIR\"].indexOf(k.toUpperCase()) < 0) env[k] = process.env[k]; });\n  env.TEMP = tmp; env.TMP = tmp; env.TMPDIR = tmp;",
    replace: "env[k] = process.env[k]; });",
    mustFail: "shared a temp dir" },
  { label: "a battery's temp dir is never removed",
    find: "try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }", replace: "try { }",
    mustFail: "temp dir was left on disk" },
  { label: "a failure beside others is final, never re-run alone",
    find: "if (v.verdict === \"fail\" && jobs > 1 && !lone) {", replace: "if (false) {",
    mustFail: "was not re-run alone and named" },
  { label: "the lone re-run's verdict is ignored, so a real failure passes",
    find: "var v = verdict.classify(raw.status, raw.out);", replace: "var v = lone ? { verdict: \"ok\", skipLines: [] } : verdict.classify(raw.status, raw.out);",
    mustFail: "a real failure passed the gate" },
  { label: "one job at a time re-runs a failure too",
    find: "&& jobs > 1 && !lone", replace: "&& !lone",
    mustFail: "one job at a time re-ran a failure" },
  { label: "the pool starts batteries in the order it was given, not slowest first",
    find: "var queue = slowestFirst(files, opts.cwd)", replace: "var queue = files.slice()",
    mustFail: "the slowest battery did not start first" },
  { label: "the clause count reads nothing, so every battery ties and name order wins",
    find: "return (String(src).match(/(^|[^\\w$])[\"']?find[\"']?\\s*:/g) || []).length;", replace: "return 0;",
    mustFail: "the slowest battery did not start first" },
  { label: "a malformed --jobs is passed on as a commit range",
    find: "if (!m) throw new Error(", replace: "if (!m) { rest.push(argv[i]); continue; } if (0) throw new Error(",
    mustFail: "a malformed --jobs passed" }
]);
prove("dev/run-sabotage-diff.js", [
  { label: "the commit gate ignores the job count",
    find: "pool.run(due,{cwd:ROOT,jobs:args.jobs}", replace: "pool.run(due,{cwd:ROOT,jobs:1}",
    mustFail: "did not run two batteries at once" },
  { label: "the commit gate folds a load flake into green without naming it",
    find: "if(v.flake)flaky.push(f);", replace: "",
    mustFail: "the flake was not named in the summary" }
]);
prove("dev/run-sabotage-all.js", [
  { label: "the weekly job ignores the job count",
    find: "pool.run(files,{cwd:ROOT,jobs:args.jobs}", replace: "pool.run(files,{cwd:ROOT,jobs:1}",
    mustFail: "the weekly runner did not run two batteries at once" }
]);
process.exit(code);
