// dev/battery-targets.js — the ONE reader of a battery's target files, for run-sabotage-diff (#599 (d2), review finding 4).
// A battery declares a target as `file: "x"`, as `"file": "x"` (#472), or through the `prove("x", [...])` wrapper most #599
// batteries use. The wrapper form was invisible to the sweep's due-selection: for the (d) range, 78 batteries that target
// changed files were never scheduled, and "all due batteries green" proved less than it read. A label passed to a member call
// (`sabotage.prove("A LABEL", cases)`) is not a target; a key that merely ends in "file" (profile:) is not either.
//
// Audit 2026-11-19, G2: reading the SOURCE TEXT still missed every battery that wraps the call under another name (proveV,
// proveU, proveE, proveF) or holds its target in a variable — 18 battery/target pairs, 94 clauses, 19 of them on memory.js.
// collected(root) reads what each battery actually HANDS the harness, through the anchor scan's own stub collector
// (dev/check-sabotage-applicability.js), and due() is the one scheduling rule both runners use. Collecting RUNS each battery
// file under inert stubs, so it is done only for the repository this tool lives in; a foreign tree (a fixture repo, a --root)
// is read from its text alone. No require() at load: the engine suite evaluates this file with none.
"use strict";
function targetsOf(src) {
  var out = [], seen = {}, m;
  var keyed = /(^|[^\w$])["']?file["']?\s*:\s*["']([^"']+)["']/g;
  var wrapped = /(^|[^\w$.])prove\(\s*["']([^"']+)["']/g;
  function add(t) { t = t.replace(/\\/g, "/"); if (!seen[t]) { seen[t] = 1; out.push(t); } }
  while ((m = keyed.exec(src))) add(m[2]);
  while ((m = wrapped.exec(src))) add(m[2]);
  return out;
}
var _collected = null;
function collected(root) {
  var fs = require("fs"), path = require("path");
  var own = path.resolve(__dirname, ".."), tool = path.join(__dirname, "check-sabotage-applicability.js");
  if (path.resolve(root) !== own || !fs.existsSync(tool)) return null;
  if (_collected) return _collected;
  var map = {}, log = console.log, err = console.error, warn = console.warn, inventory;
  console.log = console.error = console.warn = function () {};   /* a battery's load-time lines (a Chrome skip notice) are not this tool's output */
  try { inventory = require(tool).collect(own); }
  finally { console.log = log; console.error = err; console.warn = warn; }
  inventory.clauses.forEach(function (c) {
    if (!c.file) return;
    var rel = path.relative(own, path.resolve(own, c.file)).split("\\").join("/");
    if (!map[c.battery]) map[c.battery] = [];
    if (map[c.battery].indexOf(rel) < 0) map[c.battery].push(rel);
  });
  return (_collected = map);
}
/* due — the batteries a change schedules: a battery that itself changed, or one that targets a changed file by its text
   or by what it hands the harness (`more`, from collected(); null = the text alone). */
function due(changed, sources, more) {
  return Object.keys(sources).filter(function (f) {
    var t = targetsOf(sources[f]);
    if (more && more[f]) t = t.concat(more[f]);
    return changed.indexOf("dev/" + f) >= 0 || t.some(function (x) { return changed.indexOf(x) >= 0; });
  });
}
module.exports = { targetsOf: targetsOf, collected: collected, due: due };
