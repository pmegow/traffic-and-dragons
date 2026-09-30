// dev/sabotage-481-e3-accent-block.js — proves the #481 E3 guards are guarded: nothing is scheduled while the accent layer is
// blocked, a block aborts the in-flight load (without marking the set failed), and a block keeps lastPlay so the 30 s
// spacing survives a short capture. Each mutation runs in a disposable clone against the accent-layer suite.
//   node dev/sabotage-481-e3-accent-block.js
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({ file: "audio-accents.js", command: ["node", ["dev/tests-accent-layer.js"]], cases: [
  /* plan()'s own blocked check (the audit's first fix item) is kept as belt-and-braces but is NOT proven here: with the abort
     in place every settle during a block returns before plan() (aborted signal), and nothing else calls plan() while blocked,
     so removing that check alone changes no observable behaviour. The abort below is the guard that stops the late play. */
  { label: "the block leaves the in-flight load running",
    find: "        if (loading) { loading.abort.abort(); loading = null; }   /* #481 E3:", replace: "        /* #481 E3:",
    mustFail: "the block aborts the in-flight load" },
  { label: "an aborted load is marked failed (the set never reloads)",
    find: "      if (disposed || job.key !== key || job.abort.signal.aborted) return;   /* #481 E3:", replace: "      if (disposed || job.key !== key) return;   /* #481 E3:",
    mustFail: "the aborted set reloads" },
  { label: "the block wipes lastPlay (the spacing breaks after a 1 s capture)",
    find: "        if (st) st.due = {};", replace: "        st = null;",
    mustFail: "the 30 s spacing survives a 1 s capture" }
]}));
