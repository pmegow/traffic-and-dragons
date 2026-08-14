// attribute-sabotage.js — #183①: measure which test ACTUALLY catches each un-attributed
// sabotage clause, so `mustFail` can be threaded through the pre-#175 batteries on EVIDENCE
// instead of guesswork. mustFail's very first run proved the need: an exit-status-only verdict
// counted 2 fake catches among 25 W7 clauses (reds from unrelated sections).
//
// How: pre-populates require.cache for dev/sabotage.js with a stub whose prove() applies each
// case's mutation, runs THAT prove-block's own gate command, records the FIRST failing test
// line from the output, restores the file byte-identically, and never asserts. Then requires
// the battery files, which drive their cases through the stub unmodified.
//
// Usage: node dev/attribute-sabotage.js <battery.js> [more batteries…]
//   Writes testRuns/sabotage_attribution.json (append/merge across runs).
// The output is a PROPOSAL: a human reviews each suggested attribution before baking it into
// the battery (a surprising guardian = a real finding, exactly what #170's measurement showed).
var fs = require("fs"), path = require("path"), cp = require("child_process");
var ROOT = path.join(__dirname, "..");
var OUT = path.join(ROOT, "testRuns", "sabotage_attribution.json");

var results = [];
var stub = {
  prove: function (spec) {
    var file = path.join(ROOT, spec.file);
    var original = fs.readFileSync(file);
    var src = original.toString("utf8");
    (spec.cases || []).forEach(function (c) {
      if (c.mustFail) { results.push({ file: spec.file, label: c.label, mustFail: c.mustFail, status: "already-attributed" }); return; }
      if (src.indexOf(c.find) < 0) { results.push({ file: spec.file, label: c.label, status: "FIND-MISS (clause is stale)" }); return; }
      var mutated = src.split(c.find).join(c.replace);
      try {
        fs.writeFileSync(file, mutated);
        var run = cp.spawnSync(spec.command[0], spec.command[1], { cwd: ROOT, encoding: "utf8", timeout: 240000 });
        var out = String(run.stdout || "") + String(run.stderr || "");
        if (run.status === 0) { results.push({ file: spec.file, label: c.label, status: "MISSED (nothing guards this)" }); return; }
        // engine-tests failure lines: "  ✗ <section> › <name> — <detail>"; other gates print their own ✗/error lines
        var m = out.match(/✗\s+[^\n›]*›\s*([^\n—]+)/) || out.match(/✗\s+([^\n]+)/) || out.match(/Error: ([^\n]+)/);
        var name = m ? m[1].trim().slice(0, 70) : "(failing output had no recognizable ✗ line)";
        results.push({ file: spec.file, label: c.label, status: "attributed", suggest: name });
        console.log("  → " + spec.file + " :: " + c.label.slice(0, 60) + "\n      suggest mustFail: \"" + name + "\"");
      } finally {
        fs.writeFileSync(file, original);
        var now = fs.readFileSync(file);
        if (now.length !== original.length || !now.equals(original)) { console.error("RESTORE FAILED for " + spec.file + " — ABORTING"); process.exit(2); }
      }
    });
    return 0; // never fails the battery — this is measurement, not proof
  }
};

require.cache[require.resolve("./sabotage.js")] = { id: require.resolve("./sabotage.js"), filename: require.resolve("./sabotage.js"), loaded: true, exports: stub };

var batteries = process.argv.slice(2);
if (!batteries.length) { console.error("usage: node dev/attribute-sabotage.js <dev/sabotage-*.js> …"); process.exit(1); }
var realExit = process.exit;
function flush() { fs.writeFileSync(OUT, JSON.stringify(results, null, 2)); }
batteries.forEach(function (b) {
  console.log("== attributing " + b + " ==");
  // batteries are EXECUTABLES that end with process.exit(rc) — trap it so one battery's
  // exit can't kill the measurement run (the first-run bug: w6 exited and no JSON landed)
  process.exit = function (code) { throw { __batteryExit: code }; };
  try { require(path.resolve(b)); }
  catch (e) { if (!e || e.__batteryExit === undefined) console.error("battery " + b + " threw: " + (e && e.message)); }
  finally { process.exit = realExit; flush(); }
});
console.log("\n" + results.length + " clauses measured → " + OUT);
