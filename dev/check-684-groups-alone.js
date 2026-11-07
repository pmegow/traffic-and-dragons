// dev/check-684-groups-alone.js — proves every group of dev/tests-684-atlas-engine.js passes ALONE under its --only filter,
// which is how the five atlas sabotage batteries run them (sabotage.js `only:`). A group that leans on a neighbour's side
// effect passes in the file and fails alone; this sweep finds it before a battery reads that failure as a catch. Run it
// when a group is added to the suite or the filter changes (~1 min: the engine loads once per group).
//   node dev/check-684-groups-alone.js
var cp = require("child_process"), path = require("path");
var SUITE = path.join(__dirname, "tests-684-atlas-engine.js");
function run(args) { return cp.spawnSync(process.execPath, [SUITE].concat(args), { cwd: path.join(__dirname, ".."), encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }); }
var full = run([]), out = String(full.stdout || "") + String(full.stderr || "");
if (full.status !== 0) { console.error("check-684-groups-alone: the suite is red as a whole — fix that first\n" + out.slice(-2000)); process.exit(1); }
var names = String(full.stdout || "").split(/\r?\n/).filter(function (l) { return l.indexOf("PASS #684 ") === 0; }).map(function (l) { return l.slice("PASS #684 ".length); });
if (!names.length) { console.error("check-684-groups-alone: no PASS #684 lines in the suite's output"); process.exit(1); }
var bad = [], t0 = Date.now();
names.forEach(function (name) {
  var r = run(["--only", name]), o = String(r.stdout || "") + String(r.stderr || "");
  var m = /\(--only: (\d+) of the file's groups ran\)/.exec(o), ran = m ? +m[1] : 0;
  if (r.status !== 0 || o.indexOf("ALL GREEN") < 0) bad.push("FAILS ALONE: " + name + "\n" + o.split(/\r?\n/).filter(function (l) { return /^FAIL|matched 0/.test(l); }).join("\n"));
  else if (ran !== 1) bad.push("ran " + ran + " groups, not 1 (a name that is a substring of another's): " + name);
});
if (bad.length) { console.error("check-684-groups-alone: " + bad.length + " of " + names.length + " groups do not stand alone\n" + bad.join("\n")); process.exit(1); }
console.log("ALL GREEN — every one of the " + names.length + " atlas engine groups passes alone under --only (" + Math.round((Date.now() - t0) / 1000) + " s)");
