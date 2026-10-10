// dev/battery-targets.js — the ONE reader of a battery's target files, for run-sabotage-diff (#599 (d2), review finding 4).
// A battery declares a target as `file: "x"`, as `"file": "x"` (#472), or through the `prove("x", [...])` wrapper most #599
// batteries use. The wrapper form was invisible to the sweep's due-selection: for the (d) range, 78 batteries that target
// changed files were never scheduled, and "all due batteries green" proved less than it read. A label passed to a member call
// (`sabotage.prove("A LABEL", cases)`) is not a target; a key that merely ends in "file" (profile:) is not either.
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
module.exports = { targetsOf: targetsOf };
