// Fuzz analysis: every NEW hero-named memory key / roster row / alias in a tree's output —
// is it explained by an alias tag whose CANONICAL side is an earned epithet ([NPC_ALIAS:<epithet>|X] or [ALIAS:npc|<epithet>|X])?
// argv: <file.jsonl>
var fs = require("fs");
function load(f) { return fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(function (l) { return JSON.parse(l); }); }
var R = load(process.argv[2]), n = 0, explained = 0, other = [], i;
for (i = 0; i < R.length; i++) {
  var r = R[i];
  var fresh = r.viol.filter(function (v) { return r.start.indexOf(v) < 0 && v.indexOf("resolves:") !== 0; });
  if (!fresh.length) continue;
  n++;
  var all = r.replies.join(" ").toLowerCase(), ok = false;
  r.eps.forEach(function (e) {
    var low = e.toLowerCase();
    if (all.indexOf("[npc_alias:" + low + "|") >= 0 || all.indexOf("[alias:npc|" + low + "|") >= 0) ok = true;
  });
  if (ok) explained++; else other.push(r);
}
console.log("scenarios with a new hero-named key/row/alias: " + n + "; explained by an alias tag whose canonical side is an epithet: " + explained + "; other: " + other.length);
other.slice(0, 5).forEach(function (r) {
  console.log("#" + r.i + " hero=" + r.hero + " eps=" + JSON.stringify(r.eps) + " swap=" + r.swap + " viol=" + JSON.stringify(r.viol) + " start=" + JSON.stringify(r.start));
  r.replies.forEach(function (rep, k) { console.log("   " + rep + "\n     " + JSON.stringify(r.muts[k])); });
});
