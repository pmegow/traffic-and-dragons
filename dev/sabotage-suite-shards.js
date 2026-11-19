// dev/sabotage-suite-shards.js — proves the guards on a suite split across processes (dev/suite-shards.js, 2026-11-18):
// every group runs once, and a split that ran less is red — a failing shard, a shard that died early, counts that do
// not add up, shards that disagree, an empty file. And the suite that splits this way: the atlas engine suite counts every
// group before it filters (the live dice suite's three tracks: dev/sabotage-669-dice-tracks.js). Each clause plants the regression; the named test
// must then FAIL. A mutation that changes no bytes is a hard failure.
//   node dev/sabotage-suite-shards.js
var sabotage = require("./sabotage.js");
var SUITE = ["node", ["dev/tests-suite-shards.js"]];
var rc = 0;

rc |= sabotage.prove({ file: "dev/suite-shards.js", command: SUITE, cases: [
  { label: "a failing shard no longer turns the run red",
    find: "    if (r.status !== 0) why.push(name + \" failed (exit \" + r.status + \")\");",
    replace: "",
    mustFail: "a failing group in one shard turns the whole run red" },
  { label: "a shard that died before its last line is passed over",
    find: "    if (!m) { why.push(name + \" never said its count — it ended before its last line\"); return; }",
    replace: "    if (!m) return;",
    mustFail: "a shard that ends before its last line is red" },
  { label: "counts that do not add up to the file's groups pass",
    find: "  else if (totals.length === results.length && ran !== total) why.push(",
    replace: "  else if (totals.length === results.length && ran > total) why.push(",
    mustFail: "a shard that ran fewer groups than are its own is red" },
  { label: "shards that disagree on the file's size pass (the first one's number is believed)",
    find: "  if (totals.some(function (t) { return t !== total; })) why.push(",
    replace: "  if (false) why.push(",
    mustFail: "shards that disagree on how many groups the file has are red" },
  { label: "a file with no groups is green",
    find: "  if (totals.length === results.length && total === 0) why.push(\"the file has no groups — nothing ran\");\n",
    replace: "",
    mustFail: "a file with no groups is red" },
  { label: "two shards take the same groups and one share is never run (the shard's own number ignored)",
    find: "function mine(shard, ordinal) { return !shard || ordinal % shard.n === shard.k; }",
    replace: "function mine(shard, ordinal) { return !shard || ordinal % shard.n === 0; }",
    mustFail: "every group runs exactly once across the shards" },
  { label: "a shard answering under another's number is accepted",
    find: "    if (Number(m[1]) !== k || Number(m[2]) !== results.length) why.push(name + \" answered as shard \" + m[1] + \"/\" + m[2]);\n",
    replace: "",
    mustFail: "judge: a shard answering under another shard's number is refused" },
  { label: "a two-core machine splits anyway",
    find: "  return Math.min(most, Math.max(1, Math.floor((cores || os.cpus().length) / 2)));",
    replace: "  return most;",
    mustFail: "the argument and the count" }
] });

rc |= sabotage.prove({ file: "dev/tests-684-atlas-engine.js", command: SUITE, cases: [
  { label: "the atlas suite's awaited groups are filtered before they are counted (the shards' ordinals drift apart)",
    find: "async function atest(name, fn) {\n  if (!shards.mine(SHARD, seen++)) return;\n",
    replace: "async function atest(name, fn) {\n",
    mustFail: "the atlas engine suite is wired to it" },
  { label: "the atlas suite's shard never says its count",
    find: "  if (SHARD) console.log(shards.line(SHARD, matched, seen));\n",
    replace: "",
    mustFail: "the atlas engine suite is wired to it" }
] });

/* the live dice suite's width rule (pure; its Chrome-driven clauses are in dev/sabotage-669-dice-tracks.js) */
rc |= sabotage.prove({ file: "dev/tests-669-live-dice-browser.js", command: SUITE, cases: [
  { label: "the dice suite draws on three pages at once on any machine (CI's runner times out again)",
    find: "return cores>=8?3:1;}",
    replace: "return 3;}",
    mustFail: "the live dice suite's three pages run at once only on a machine with the cores for it" }
] });

process.exit(rc);
