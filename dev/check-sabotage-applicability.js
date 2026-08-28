// check-sabotage-applicability.js — dry applicability gate for every retained sabotage clause.
// It loads battery declarations through inert harness stubs and applies each mutation in memory.
// No target file is written and no guarding command is run; CI pays only the match-check cost.
var fs = require("fs");
var path = require("path");
var Module = require("module");

var ROOT = path.join(__dirname, "..");
var LIST_ONLY = "TND_SABOTAGE_APPLICABILITY_ONLY";

function applyMutation(source, c) {
  if (typeof c.mutate === "function") return String(c.mutate(source));
  if (c.find instanceof RegExp) return source.replace(c.find, c.replace);
  var cFind = String(c.find), cRepl = String(c.replace);
  // Keep byte-for-byte parity with sabotage.js: LF-authored multi-line clauses are folded to
  // a CRLF target, including the replacement, while the file itself remains untouched.
  if (source.indexOf(cFind) < 0 && cFind.indexOf("\n") >= 0) {
    var crlfFile = source.indexOf("\r\n") >= 0;
    var nlNorm = function (x) { return x.replace(/\r\n/g, "\n").replace(/\n/g, crlfFile ? "\r\n" : "\n"); };
    if (source.indexOf(nlNorm(cFind)) >= 0) { cFind = nlNorm(cFind); cRepl = nlNorm(cRepl); }
  }
  var at = source.indexOf(cFind);
  return at < 0 ? source : source.slice(0, at) + cRepl + source.slice(at + cFind.length);
}

function collectFrameworkBattery(file, clauses) {
  var originalLoad = Module._load, originalExit = process.exit;
  Module._load = function (request, parent, isMain) {
    if (request === "./sabotage.js") return { prove: function (opts) {
      for (var i = 0; i < opts.cases.length; i++) clauses.push({
        battery: path.basename(file), file: opts.cases[i].file || opts.file, spec: opts.cases[i]
      });
      return 0;
    } };
    if (request === "./scratch-contract-sabotage.js") return { prove: function (name, cases) {
      for (var j = 0; j < cases.length; j++) clauses.push({
        battery: path.basename(file), file: cases[j].file, spec: cases[j]
      });
      return 0;
    } };
    return originalLoad.call(Module, request, parent, isMain);
  };
  process.exit = function () {};
  try {
    delete require.cache[require.resolve(file)];
    require(file);
  } finally {
    Module._load = originalLoad;
    process.exit = originalExit;
    delete require.cache[require.resolve(file)];
  }
}

function collectSelfBattery(file, clauses) {
  var prior = process.env[LIST_ONLY];
  try {
    process.env[LIST_ONLY] = "1";
    delete require.cache[require.resolve(file)];
    var specs = require(file);
    if (!Array.isArray(specs)) throw new Error(path.basename(file) + " has no list-only clause export");
    for (var i = 0; i < specs.length; i++) clauses.push({
      battery: path.basename(file), file: specs[i].file, spec: specs[i]
    });
  } finally {
    if (prior == null) delete process.env[LIST_ONLY]; else process.env[LIST_ONLY] = prior;
    delete require.cache[require.resolve(file)];
  }
}

function collect(root) {
  var dev = path.join(root, "dev"), clauses = [];
  var batteries = fs.readdirSync(dev).filter(function (name) {
    return /^sabotage-.*\.js$/.test(name);
  }).sort();
  for (var i = 0; i < batteries.length; i++) {
    var file = path.join(dev, batteries[i]);
    var source = fs.readFileSync(file, "utf8");
    if (source.indexOf("./sabotage.js") >= 0 || source.indexOf("./scratch-contract-sabotage.js") >= 0) {
      collectFrameworkBattery(file, clauses);
    } else collectSelfBattery(file, clauses);
  }
  return { batteries: batteries, clauses: clauses };
}

function problems(root) {
  var inventory = collect(root), failures = [];
  for (var i = 0; i < inventory.clauses.length; i++) {
    var clause = inventory.clauses[i];
    if (!clause.file) {
      failures.push(clause.battery + " :: " + clause.spec.label + " has no target file");
      continue;
    }
    var target = path.resolve(root, clause.file);
    if (target !== root && target.indexOf(root + path.sep) !== 0) {
      failures.push(clause.battery + " :: " + clause.spec.label + " escapes the repository: " + clause.file);
      continue;
    }
    if (!fs.existsSync(target)) {
      failures.push(clause.battery + " :: " + clause.spec.label + " target is missing: " + clause.file);
      continue;
    }
    var before = fs.readFileSync(target, "utf8"), after;
    try { after = applyMutation(before, clause.spec); }
    catch (e) {
      failures.push(clause.battery + " :: " + clause.spec.label + " mutator threw: " + (e && e.message || e));
      continue;
    }
    if (after === before) failures.push(clause.battery + " :: " + clause.spec.label + " find target is stale in " + clause.file);
  }
  return { batteries: inventory.batteries.length, clauses: inventory.clauses.length, failures: failures };
}

if (require.main === module) {
  var result, rootArg = ROOT, rootAt = process.argv.indexOf("--root");
  if (rootAt >= 0 && process.argv[rootAt + 1]) rootArg = path.resolve(process.argv[rootAt + 1]);
  try { result = problems(rootArg); }
  catch (e) { console.error("SABOTAGE APPLICABILITY FAILED — " + (e && e.stack || e)); process.exit(1); }
  for (var i = 0; i < result.failures.length; i++) console.error("FAIL " + result.failures[i]);
  if (!result.batteries || !result.clauses) {
    console.error("SABOTAGE APPLICABILITY FAILED — no retained sabotage clauses were discovered");
    process.exit(1);
  }
  if (result.failures.length) {
    console.error("SABOTAGE APPLICABILITY: " + result.failures.length + " stale clause(s) across " + result.batteries + " batteries");
    process.exit(1);
  }
  console.log("ALL GREEN — " + result.clauses + "/" + result.clauses + " retained sabotage clauses applicable across " + result.batteries + " batteries (dry match-check; no mutations run)");
}

module.exports = { applyMutation: applyMutation, collect: collect, problems: problems };
