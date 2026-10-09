// dev/capture-prompt-all.js — gate 8 of the #599 plan in ONE command: run dev/capture-prompt.js on the NEWEST save of every
// owner campaign folder (Campaigns/<slug>/…/*.tnd, any depth) into <outRoot>/<slug>/{stable,volatile}.txt, so two captures
// (one from the committed build, one from the working tree) can be diffed:
//   node dev/capture-prompt-all.js <outRoot> [campaignsRoot]
//   diff -r <outRootBefore> <outRootAfter>      → 0 lines = both prompt halves byte-identical on every campaign
// Release (b) proved its b4 and b5 this way (9 campaigns, 0 lines). In (c) the only allowed diff is the order of the carried
// equipment on the still-named "Wearing:" line (§8.2 gate 8); in (d) its "Equipped:" label and the STATE TAGS line.
// Exit 1 when any capture fails, 2 for a missing argument.
var fs = require("fs"), path = require("path"), cp = require("child_process");
var ROOT = path.join(__dirname, ".."), out = process.argv[2], CAMPS = process.argv[3] ? path.resolve(process.argv[3]) : path.join(ROOT, "Campaigns");
if (!out) { console.error("usage: node dev/capture-prompt-all.js <outRoot> [campaignsRoot]"); process.exit(2); }
if (!fs.existsSync(CAMPS)) { console.error("capture-prompt-all: no campaigns folder at " + CAMPS); process.exit(2); }
function newestTnd(dir) {
  var best = null;
  (function walk(d) {
    fs.readdirSync(d).forEach(function (f) {
      var p = path.join(d, f), st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.tnd$/i.test(f) && (!best || st.mtimeMs > best.m)) best = { p: p, m: st.mtimeMs };
    });
  })(dir);
  return best && best.p;
}
var n = 0, fails = 0;
fs.readdirSync(CAMPS).forEach(function (slug) {
  var dir = path.join(CAMPS, slug); if (!fs.statSync(dir).isDirectory()) return;
  var save = newestTnd(dir); if (!save) return;
  var dest = path.join(out, slug); fs.mkdirSync(dest, { recursive: true });
  var r = cp.spawnSync(process.execPath, [path.join(ROOT, "dev", "capture-prompt.js"), save, dest], { cwd: ROOT, encoding: "utf8" });
  n++; if (r.status !== 0) { fails++; console.log("FAIL " + slug + ": " + String(r.stderr || r.stdout).slice(0, 300)); }
  else console.log("ok   " + slug + " <- " + path.basename(save));
});
console.log(n + " campaigns captured, " + fails + " failed");
process.exit(fails ? 1 : 0);
