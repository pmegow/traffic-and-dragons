// dev/blender/dice-clips.js — THE dice clip batch (2026-10-20; the damage dice 2026-10-21, #653). Renders one roll per
// face of a die through dev/blender/render.js, ONE transparent render each, encoded two ways from the same frames:
// a VP9 WebM with alpha (the die over the page) and a STACKED-ALPHA H.264 MP4 (colour | matte, twice as wide) for
// WebKit, which drops VP9 alpha — the page recombines it on a canvas (ui-dice.js). The clips land in dice/ with a
// manifest. Nothing here is loaded by the game.
//
//   node dev/blender/dice-clips.js                        the d20: all twenty results, four at a time (#650)
//   node dev/blender/dice-clips.js --sides 4,6,8,10,12    the damage dice: forty clips, one per face (#653)
//   node dev/blender/dice-clips.js --sides 6 --only 3,4   a subset of one die
//   node dev/blender/dice-clips.js --jobs 2               fewer Blender processes side by side
//
// A face's seed starts at its base (the face number for the d20; sides×100 + the face for the others, so no two
// dice share a throw) and steps by the number of faces until the die has SETTLED by the last frame AND turned over
// at least MIN_TURNS[sides] times on the felt (the scene's own verdicts; a tetrahedron flops where a dodecahedron
// rolls, so the bar is the die's); an unsettled roll or a lazy one is never shipped. Both clips of a face come
// from one render, so they are the same roll. The manifest records every seed and the settled die's place in the
// frame (rest) — rerunning reproduces the clips byte-for-byte short of encoder drift.
var fs = require("fs");
var path = require("path");
var cp = require("child_process");

var ROOT = path.join(__dirname, "..", "..");
var RENDER = path.join(__dirname, "render.js");
var OUT = path.join(ROOT, "dice");
var SCRATCH = path.join(ROOT, "renders", "dice-clips");
var SIZE = "800x400", FPS = 24, TRIES = 8;
// the clip's length per die: 84 frames (3.5 s) is the d20's — the harder throw (2026-10-21) needs the extra half second
// to come to rest. The rounder damage dice take longer on the same throw even with their own damping (dice_roll.py's
// DAMPING; the 2026-10-21 surveys): the d10 rests by frame ~78, the d12 — the roundest solid of the five — by ~116.
var FRAMES = { 4: 84, 6: 84, 8: 84, 10: 96, 12: 120, 20: 84 };
// turns ROLLED ON THE FELT (the scene's "turns"): under the bar the roll reads as a drop. The d20's 1.5 is the #650
// ruling; the damage dice take what their shapes give (the same survey: a d4 flops and rarely passes 0.4, a d6 rolls
// in quarter turns, the d8 and the kites roll freely).
var MIN_TURNS = { 4: 0.2, 6: 0.5, 8: 1.0, 10: 0.8, 12: 1.0, 20: 1.5 };
var SIDES_ALL = [4, 6, 8, 10, 12, 20];

function parseArgs(argv) {
  var o = { only: null, jobs: 4, sides: [20] };
  for (var i = 0; i < argv.length; i++) {
    if (argv[i] === "--only") o.only = String(argv[++i]).split(",").map(Number);
    else if (argv[i] === "--jobs") o.jobs = Number(argv[++i]);
    else if (argv[i] === "--sides") { var v = String(argv[++i]); o.sides = v === "all" ? SIDES_ALL.slice() : v.split(",").map(Number); }
  }
  o.sides.forEach(function (s) { if (SIDES_ALL.indexOf(s) < 0) throw new Error("--sides takes " + SIDES_ALL.join(", ") + " (or all), got " + s); });
  return o;
}

function clipBase(sides, face) { return "d" + sides + "_" + pad(face); }
function seedBase(sides, face) { return sides === 20 ? face : sides * 100 + face; }

function render(sides, face, seed) {
  var out = path.join(SCRATCH, "d" + sides, String(face));
  var args = [RENDER, "dice_roll", "--sides", String(sides), "--seed", String(seed), "--result", String(face), "--size", SIZE,
    "--frames", String(FRAMES[sides]), "--fps", String(FPS), "--out", out, "--transparent", "--shadow",
    "--video", "webm,stacked", "--name", clipBase(sides, face) + ".webm"];
  return new Promise(function (resolve, reject) {
    cp.execFile(process.execPath, args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }, function (err, stdout, stderr) {
      var m = String(stdout).split(/\r?\n/).filter(function (l) { return /^result: /.test(l); })[0];
      if (err || !m) return reject(new Error("render d" + sides + " " + face + " seed " + seed + " failed:\n" + String(stdout).slice(-800) + String(stderr).slice(-400)));
      var rep = JSON.parse(m.slice(8));
      var v = rep.videos || {};
      if (!v.webm || !fs.existsSync(v.webm) || !v.stacked || !fs.existsSync(v.stacked)) return reject(new Error("a clip is missing for d" + sides + " " + face + ": " + JSON.stringify(v)));
      resolve(rep);
    });
  });
}

async function oneFace(job) {
  var sides = job.sides, face = job.face, tag = clipBase(sides, face);
  for (var k = 0; k < TRIES; k++) {
    var seed = seedBase(sides, face) + sides * k;
    var rep = await render(sides, face, seed);
    if (rep.up_number !== face) throw new Error(tag + ": the scene painted " + rep.up_number + " up");
    if (!rep.settled) { console.log(tag + ": seed " + seed + " had not settled, next seed"); continue; }
    if (!(rep.turns >= MIN_TURNS[sides])) { console.log(tag + ": seed " + seed + " turned only " + rep.turns + " times, next seed"); continue; }
    var webm = rep.videos.webm, stacked = rep.videos.stacked;
    fs.mkdirSync(OUT, { recursive: true });
    fs.copyFileSync(webm, path.join(OUT, path.basename(webm)));
    fs.copyFileSync(stacked, path.join(OUT, path.basename(stacked)));
    console.log(tag + ": seed " + seed + " (" + rep.turns + " turns) → " + path.basename(webm) + " " + kb(webm) + ", " + path.basename(stacked) + " " + kb(stacked));
    return { sides: sides, face: face, seed: seed, turns: rep.turns, rest: rep.rest_box || null, webm: fs.statSync(webm).size, stacked: fs.statSync(stacked).size };
  }
  throw new Error(tag + ": no settled roll in " + TRIES + " seeds");
}

function pad(n) { return (n < 10 ? "0" : "") + n; }
function kb(f) { return Math.round(fs.statSync(f).size / 1024) + " KB"; }

async function pool(items, width, fn) {
  var results = [], next = 0, failures = [];
  async function worker() {
    while (next < items.length) {
      var i = next++;
      try { results[i] = await fn(items[i]); } catch (e) { failures.push(e); console.error(e.message); }
    }
  }
  var workers = [];
  for (var w = 0; w < Math.min(width, items.length); w++) workers.push(worker());
  await Promise.all(workers);
  return { results: results.filter(Boolean), failures: failures };
}

// The manifest: ONE shape per die under `dice` — {scene, size, frames, fps, rendered, clips:{FF:{seed, turns, rest, webm, stacked}}}.
// The #650 batch wrote the d20 at the top level (clips beside scene/size/frames/fps); that shape is folded into dice.d20
// on first touch so the twenty shipped clips keep their records without a re-render.
function loadManifest(file) {
  var m = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  if (!m.dice) m.dice = {};
  if (m.clips) {
    m.dice.d20 = { scene: m.scene || "dice_roll", size: m.size || SIZE, frames: m.frames || FRAMES[20], fps: m.fps || FPS, rendered: m.rendered, clips: m.clips };
    ["clips", "scene", "size", "frames", "fps"].forEach(function (k) { delete m[k]; });
  }
  return m;
}

async function main() {
  var o = parseArgs(process.argv.slice(2));
  var jobs = [];
  o.sides.forEach(function (s) {
    var faces = o.only || Array.apply(null, Array(s)).map(function (_, i) { return i + 1; });
    faces.forEach(function (f) { if (!(f >= 1 && f <= s)) throw new Error("a d" + s + " has no face " + f); jobs.push({ sides: s, face: f }); });
  });
  var t0 = Date.now();
  var done = await pool(jobs, o.jobs, oneFace);
  var manifestPath = path.join(OUT, "manifest.json");
  var manifest = loadManifest(manifestPath);
  var today = new Date().toISOString().slice(0, 10);
  manifest.rendered = today;
  done.results.forEach(function (r) {
    var key = "d" + r.sides, set = manifest.dice[key] || (manifest.dice[key] = { clips: {} });
    set.scene = "dice_roll"; set.size = SIZE; set.frames = FRAMES[r.sides]; set.fps = FPS; set.rendered = today;
    set.clips[pad(r.face)] = { seed: r.seed, turns: r.turns, rest: r.rest, webm: r.webm, stacked: r.stacked };
  });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  // the same manifest as a script, for dev/dice-review.html opened from disk (a file:// page cannot fetch())
  fs.writeFileSync(path.join(OUT, "manifest.js"), "var DICE_MANIFEST = " + JSON.stringify(manifest) + ";\n");
  var count = 0, total = 0;
  Object.keys(manifest.dice).forEach(function (k) { var c = manifest.dice[k].clips; Object.keys(c).forEach(function (f) { count++; total += c[f].webm + c[f].stacked; }); });
  console.log(done.results.length + " of " + jobs.length + " faces in " + ((Date.now() - t0) / 1000).toFixed(0) + "s; " + count + " clips in manifest, " + (total / 1024 / 1024).toFixed(1) + " MB → " + OUT);
  if (done.failures.length) { console.error(done.failures.length + " FAILED"); process.exit(1); }
}

if (require.main === module) main().catch(function (e) { console.error(e); process.exit(1); });
module.exports = { MIN_TURNS: MIN_TURNS, FRAMES: FRAMES, SIDES_ALL: SIDES_ALL, seedBase: seedBase, clipBase: clipBase, loadManifest: loadManifest };
