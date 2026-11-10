// mutants.js — the #717 reviewer's own mutants of the NEW code, run against the full atlas engine suite and the atlas
// browser suite in a SCRATCH checkout (never this tree): which regressions do the commit's tests let live?
// Each mutant is applied to <SCRATCH>/<file>, both suites are run there, the file is restored (and verified byte-equal).
// A mutant whose find matches zero or several times is an error, not a survivor.
// node dev/review-717/mutants.js <SCRATCH checkout of ab55473b> [only-label-substring] [--no-browser]
var fs = require("fs"), path = require("path"), cp = require("child_process");
var SCRATCH = process.argv[2], ONLY = process.argv[3] && process.argv[3].charAt(0) !== "-" ? process.argv[3] : null, NOB = process.argv.indexOf("--no-browser") > 0;
if (!SCRATCH || path.resolve(SCRATCH) === path.resolve(__dirname, "..", "..")) { console.error("usage: node mutants.js <scratch checkout> — never the review tree itself"); process.exit(2); }
var M = [
  { label: "MU1 a leg bridges a stretch off the map (a last mapped place counts as where the walk began)", file: "atlas.js",
    find: "a=(a&&a.exact&&a.key)?a.key:null;b=(b&&b.exact&&b.key)?b.key:null;",
    replace: "a=(a&&(a.exact||a.last)&&a.key&&a.key!==\"c\")?a.key:null;b=(b&&b.exact&&b.key)?b.key:null;" },
  { label: "MU2 the record of a sheet removed with its addition is kept (the next addition under that id inherits it)", file: "atlas.js",
    find: "for(i=0;i<under.length;i++){delete A.zones[under[i]];if(A.seen)delete A.seen[under[i]];}",
    replace: "for(i=0;i<under.length;i++){delete A.zones[under[i]];}" },
  { label: "MU3 'somewhere here' shows the room under the sheet's middle", file: "atlas.js",
    find: "    if(stands[i].key===\"c\")continue;/* somewhere here: no room is known */",
    replace: "" },
  { label: "MU4 a wild zone's stand is never read back (the 'p:' key resolves to nothing)", file: "atlas.js",
    find: "  if(key.charAt(0)===\"p\"){",
    replace: "  if(key.charAt(0)===\"q\"){" },
  { label: "MU5 a wild zone's stand is written under a thing's key", file: "atlas.js",
    find: "return mk(c[0],c[1],true,z,\"p:\"+rec.kind+\":\"+rec.via);",
    replace: "return mk(c[0],c[1],true,z,\"t:\"+rec.via);" },
  { label: "MU6 the tap test ignores walked ways (only the discs round the stands answer)", file: "atlas.js",
    find: "  for(i=0;i<spec.paths.length;i++){p=spec.paths[i];for(k=0;k<p.length;k++)if(atlasSegDist(x,y,p[k?k-1:0],p[k])<=r)return true;}",
    replace: "" },
  { label: "MU7 the load door accepts any legs (a null leg, a leg of one)", file: "atlas.js",
    find: "&&s.legs.every(function(l){return (l instanceof Array)&&l.length===2&&isKey(l[0])&&isKey(l[1]);})",
    replace: "" },
  { label: "MU8 the load door accepts any stands (a number, an object)", file: "atlas.js",
    find: "&&s.at.every(isKey)",
    replace: "" },
  { label: "MU9 the stand the party LEFT is not recorded", file: "atlas.js",
    find: "      if(a&&rec.at.indexOf(a)<0)rec.at.push(a);",
    replace: "" },
  { label: "MU10 a way is not sampled between its corners", file: "atlas.js",
    find: "      for(q=1;q<n;q++)add(row.locate(doc,[p[k-1][0]+(p[k][0]-p[k-1][0])*q/n,p[k-1][1]+(p[k][1]-p[k-1][1])*q/n]));",
    replace: "" },
  { label: "MU11 a stand's own room id is not shown (only the room under its point)", file: "atlas.js",
    find: "    if(typeof stands[i].key===\"string\"&&stands[i].key.charAt(0)===\"t\")add(stands[i].key.slice(2));",
    replace: "" },
  { label: "MU12 the room under a stand's point is not shown (only a stand that IS a room)", file: "atlas.js",
    find: "    add(row.locate(doc,stands[i].xy));",
    replace: "" },
  { label: "MU13 a wild sheet is never fogged", file: "atlas.js",
    find: "  if(!row||A.fog===false)return null;",
    replace: "  if(!row||A.fog===false||rec.kind===\"wild\")return null;" },
  { label: "MU14 the whole record is dropped at the load door when it is an object but junk — said or not is untested: a junk store heals without a word", file: "atlas.js",
    find: "  if(!A.seen||typeof A.seen!==\"object\"||A.seen instanceof Array){A.seen=keyedDict();return true;}",
    replace: "  if(!A.seen||typeof A.seen!==\"object\"||A.seen instanceof Array){A.seen=keyedDict();return false;}" },
  { label: "MU15 the fog is computed AFTER the sheet is shown: the reveal is handed over only on a later repaint", file: "ui-atlas.js",
    find: "    reveal=atlasReveal(zoneId);if(JSON.stringify(P.view.reveal())!==JSON.stringify(reveal))P.view.setReveal(reveal);",
    replace: "    reveal=atlasReveal(zoneId);if(P.zone===zoneId&&JSON.stringify(P.view.reveal())!==JSON.stringify(reveal))P.view.setReveal(reveal);" },
  { label: "MU16 the tap test reads the fog off (true everywhere) on a sheet whose record is empty", file: "atlas.js",
    find: "  if(!spec||spec instanceof Array)return true;",
    replace: "  if(!spec||spec instanceof Array||(!spec.paths.length&&spec.points.length>1))return true;" }
];
function run(cmd, args) { var r = cp.spawnSync(cmd, args, { cwd: SCRATCH, encoding: "utf8", timeout: 600000, maxBuffer: 64 * 1024 * 1024 }); return { code: r.status, out: (r.stdout || "") + (r.stderr || "") }; }
function fails(out) { return out.split(/\r?\n/).filter(function (l) { return /^FAIL /.test(l); }).map(function (l) { return l.slice(0, 110); }); }
var survivors = [], rows = [];
M.forEach(function (m) {
  if (ONLY && m.label.indexOf(ONLY) < 0) return;
  var f = path.join(SCRATCH, m.file), orig = fs.readFileSync(f, "utf8"), n = orig.split(m.find).length - 1, e, b, verdict;
  if (n !== 1) { console.log("ERROR " + m.label + " — the find matches " + n + " times"); return; }
  fs.writeFileSync(f, orig.replace(m.find, function () { return m.replace; }), "utf8");
  try {
    e = run("node", ["dev/tests-684-atlas-engine.js"]);
    b = NOB ? { code: 0, out: "" } : run("node", ["dev/tests-684-atlas-browser.js"]);
  } finally { fs.writeFileSync(f, orig, "utf8"); }
  if (fs.readFileSync(f, "utf8") !== orig) { console.log("RESTORE FAILED for " + m.file); process.exit(3); }
  verdict = (e.code === 0 && b.code === 0) ? "SURVIVED" : "caught";
  if (verdict === "SURVIVED") survivors.push(m.label);
  console.log(verdict + "  " + m.label + (verdict === "caught" ? "\n         by: " + fails(e.out).concat(fails(b.out)).slice(0, 3).join(" | ") : ""));
});
console.log("\n" + survivors.length + " survived:\n  " + survivors.join("\n  "));
