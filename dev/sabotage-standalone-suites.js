// sabotage-standalone-suites.js — #18 proof that the three formerly-dead fragments reach
// real assertions. Mutations run only against a disposable synthetic engine copy; this lane
// never writes the game's source files.
var fs = require("fs");
var os = require("os");
var path = require("path");
var cp = require("child_process");

var ROOT = path.join(__dirname, "..");
var MANIFEST = require("./engine-manifest.js");
var SPECS = [
  {
    suite: "tests-b9-transport.js",
    file: "storage-adapter.js",
    find: 'function whoAmI(cb)                { _apiJson("/auth/me", "GET", null, cb); }',
    replace: 'function whoAmI(cb)                { _apiJson("/auth/who", "GET", null, cb); }',
    mustFail: "whoAmI",
    label: "B9 detects a regressed whoAmI route"
  },
  {
    suite: "tests-c13-adapter.js",
    file: "storage-adapter.js",
    find: 'function listCharacterLibrary(cb)         { _apiJson("/api/characters", "GET", null, cb); }',
    replace: 'function listCharacterLibrary(cb)         { _apiJson("/api/people", "GET", null, cb); }',
    mustFail: "listCharacterLibrary",
    label: "C13 detects a regressed library route"
  },
  {
    suite: "tests-dedup-a.js",
    file: "helpers.js",
    find: 'function csInitials(name){return(name||"?").split(" ").map(function(w){return w[0]||"";}).join("").toUpperCase().slice(0,2)||"?";}',
    replace: 'function csInitials(name){return(name||"?").split(" ").map(function(w){return w[0]||"";}).join("").toUpperCase().slice(0,1)||"?";}',
    mustFail: "normal two-word name",
    label: "dedupA detects a regressed initials cap"
  },
  // #29b fallback-rung clauses: field deleted, attribution inverted, self-fall guard dropped.
  {
    suite: "tests-29-callgm-transport.js",
    file: "globals.js",
    find: '    fallbackModel:"gemini-3.6-flash",',
    replace: '',
    mustFail: "prov.fallbackModel",
    label: "#29b detects a deleted fallbackModel field (storms would fail loud with no rung)"
  },
  {
    suite: "tests-29-callgm-transport.js",
    file: "api.js",
    find: '        if(!sysOverride)_lastTurnModel=model; // #45: the transcript m: stamp must credit the model that actually wrote the turn',
    replace: '        if(sysOverride)_lastTurnModel=model; // #45: the transcript m: stamp must credit the model that actually wrote the turn',
    mustFail: "_lastTurnModel",
    label: "#29b detects an inverted #45 attribution stamp (fallback turns credited to the primary)"
  },
  {
    suite: "tests-29-callgm-transport.js",
    file: "api.js",
    find: '      if(!_fellBack&&prov.fallbackModel&&model!==prov.fallbackModel){',
    replace: '      if(!_fellBack&&prov.fallbackModel){',
    mustFail: "no self-fall",
    label: "#29b detects a dropped self-fall guard (a call already on the fallback would burn a 4th attempt on itself)"
  },
  {
    suite: "tests-29-callgm-transport.js",
    file: "globals.js",
    find: '    fallbackModel:"gpt-5.6-luna",',
    replace: '',
    mustFail: "the OpenAI rung REBUILDS the body",
    label: "#29b detects a deleted OpenAI fallbackModel (sol storms would fail loud with no luna rung)"
  }
];

function copy(from, to) { fs.copyFileSync(from, to); }
function runSuite(tmp, suite) {
  return cp.spawnSync(process.execPath, [path.join(tmp, "dev", suite)], { cwd: tmp, encoding: "utf8" });
}
function output(run) { return String(run.stdout || "") + String(run.stderr || ""); }

var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-standalone-proof-"));
var failed = 0;
try {
  fs.mkdirSync(path.join(tmp, "dev"));
  copy(path.join(__dirname, "engine-manifest.js"), path.join(tmp, "dev", "engine-manifest.js"));
  for (var i = 0; i < SPECS.length; i++) copy(path.join(__dirname, SPECS[i].suite), path.join(tmp, "dev", SPECS[i].suite));
  for (var m = 0; m < MANIFEST.length; m++) copy(path.join(ROOT, MANIFEST[m].file), path.join(tmp, MANIFEST[m].file));
  // C13's duplicate-literal assertion scans every UI shard; dedupA loads ui-browsers.js.
  fs.readdirSync(ROOT).filter(function (name) { return /^ui-.*\.js$/.test(name); })
    .forEach(function (name) { copy(path.join(ROOT, name), path.join(tmp, name)); });

  for (var b = 0; b < SPECS.length; b++) {
    var baseline = runSuite(tmp, SPECS[b].suite);
    if (baseline.status !== 0) {
      failed++;
      console.error("✗ BASELINE FAILED " + SPECS[b].suite + "\n" + output(baseline));
    } else console.log("✓ baseline green " + SPECS[b].suite);
  }

  for (var s = 0; s < SPECS.length; s++) {
    var spec = SPECS[s];
    var target = path.join(tmp, spec.file);
    var repoTarget = path.join(ROOT, spec.file);
    var repoBefore = fs.readFileSync(repoTarget);
    var original = fs.readFileSync(target, "utf8");
    var changed = original.replace(spec.find, spec.replace);
    if (changed === original) {
      failed++;
      console.error("✗ NOT APPLIED " + spec.label);
      continue;
    }
    fs.writeFileSync(target, changed, "utf8");
    var run = runSuite(tmp, spec.suite);
    fs.writeFileSync(target, original, "utf8");
    var restored = fs.readFileSync(target, "utf8") === original;
    var repoIntact = fs.readFileSync(repoTarget).equals(repoBefore);
    var out = output(run);
    var caught = run.status !== 0 && out.indexOf(spec.mustFail) >= 0;
    if (!caught || !restored || !repoIntact) {
      failed++;
      console.error("✗ " + spec.label + " — " + (run.status === 0 ? "MISSED" : "MISATTRIBUTED") +
        "; temp restored=" + restored + "; repository untouched=" + repoIntact + "\n" + out);
    } else {
      console.log("✓ caught " + spec.label + " — named failure: " + spec.mustFail +
        "; temp restored byte-identical; repository target untouched");
    }
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (failed) {
  console.error("STANDALONE SUITE SABOTAGE: " + failed + " failure(s)");
  process.exit(1);
}
console.log("ALL GREEN — " + SPECS.length + "/" + SPECS.length + " standalone suite regressions caught and disposable targets restored");
