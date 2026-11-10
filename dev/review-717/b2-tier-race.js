// b2-tier-race.js — is the "wait for the frame" added to browser checks ④ and ⑤ a test race, or did the commit change
// when a trail tier becomes clickable? Builds a copy of THIS tree's dev/tests-684-atlas-browser.js with the two added
// waits removed (written to an out dir, requires made absolute), runs it N times and prints the verdict of ④ and ⑤ each
// time. Compare with the untouched suite on the parent commit (10 of 10 green there). Then measures, in the page, how
// long a tier stays unclickable after the repaint a turn causes.
// node dev/review-717/b2-tier-race.js <out dir> [runs=6] [ROOT]
var fs = require("fs"), path = require("path"), cp = require("child_process");
var OUT = process.argv[2], N = +(process.argv[3] || 6), ROOT = path.resolve(process.argv[4] || path.join(__dirname, "..", ".."));
if (!OUT) { console.error("usage: node b2-tier-race.js <out dir> [runs] [ROOT]"); process.exit(2); }
var src = fs.readFileSync(path.join(ROOT, "dev", "tests-684-atlas-browser.js"), "utf8"), dev = path.join(ROOT, "dev").replace(/\\/g, "/"), n = 0, i, r, lines;
var A4 = "   await settle();\n   const k=await page.evaluate(()=>{const v=_atlasPane.view,c=document.getElementById('atlas-canvas'),r=c.getBoundingClientRect(),tier=";
var A5 = "   await settle();/* the tiers are clickable once drawn (see ④) */\n";
var FOG_ON = process.argv.indexOf("--fog-on") > 0, KEEP = process.argv.indexOf("--keep-waits") > 0, EDITS = KEEP ? [] : [[A4, A4.replace("   await settle();\n", "")], [A5, ""]];
/* --fog-on: checks ②–⑤ run with the campaign's fog ON, as a player has it (the suite switches it off for them) */
if (FOG_ON) EDITS.push(["atlasCreate('campaign-1');worldState.atlas.fog=false;", "atlasCreate('campaign-1');"]);
EDITS.forEach(function (p) { if (src.split(p[0]).length !== 2) { console.error("anchor not found once: " + p[0].slice(0, 50)); process.exit(3); } src = src.replace(p[0], function () { return p[1]; }); n++; });
src = src.replace("require('./cdp-browser.js')", "require('" + dev + "/cdp-browser.js')").replace("require('./load-engine.js')", "require('" + dev + "/load-engine.js')").replace("path.resolve(__dirname,'..')", "path.resolve('" + ROOT.replace(/\\/g, "/") + "')");
fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, "tests-684-atlas-browser.nowait.js"), src, "utf8");
console.log("applied " + n + " edits (" + (KEEP ? "waits kept" : "the two waits removed") + (FOG_ON ? ", fog ON in checks 2-5" : "") + "); running " + N + " times against " + ROOT);
for (i = 1; i <= N; i++) {
  r = cp.spawnSync("node", [path.join(OUT, "tests-684-atlas-browser.nowait.js")], { encoding: "utf8", timeout: 300000 });
  lines = ((r.stdout || "") + (r.stderr || "")).split(/\r?\n/).filter(function (l) { return /^(PASS|FAIL) /.test(l); }).slice(0, 5).map(function (l) { return l.slice(0, 6) + (l.indexOf("FAIL") === 0 ? " [" + l.split(" — ").pop().slice(0, 110) + "]" : ""); });
  console.log("run " + i + ": " + lines.join("   "));
}
