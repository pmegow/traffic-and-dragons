// dev/blender/dice-clips.js — THE d20 clip batch (2026-10-20). Renders one roll per result 1..20
// through dev/blender/render.js, twice each: a transparent VP9 WebM (the die over the page, with
// alpha) and an opaque H.264 MP4 on the felt (the fallback for Safari, which drops VP9 alpha).
// The clips land in dice/ with a manifest; the game plays dice/d20_NN.webm, or the .mp4 where the
// browser cannot show the alpha. Nothing here is loaded by the game.
//
//   node dev/blender/dice-clips.js                 all twenty, four at a time
//   node dev/blender/dice-clips.js --only 20,1     a subset
//   node dev/blender/dice-clips.js --jobs 2        fewer Blender processes side by side
//
// A result's seed starts at the result number and steps by 20 until the die has SETTLED by the
// last frame (the scene's own verdict); an unsettled roll is never shipped. Both clips of a result
// use the same seed, so they are the same roll. The manifest records every seed — rerunning
// reproduces the clips byte-for-byte short of encoder drift.
var fs = require("fs");
var path = require("path");
var cp = require("child_process");

var ROOT = path.join(__dirname, "..", "..");
var RENDER = path.join(__dirname, "render.js");
var OUT = path.join(ROOT, "dice");
var SCRATCH = path.join(ROOT, "renders", "dice-clips");
var SIZE = "800x400", FRAMES = 72, FPS = 24, TRIES = 6;

function parseArgs(argv) {
  var o = { only: null, jobs: 4 };
  for (var i = 0; i < argv.length; i++) {
    if (argv[i] === "--only") o.only = String(argv[++i]).split(",").map(Number);
    else if (argv[i] === "--jobs") o.jobs = Number(argv[++i]);
  }
  return o;
}

function render(result, seed, fmt, name) {
  var out = path.join(SCRATCH, String(result), fmt);
  var args = [RENDER, "dice_roll", "--seed", String(seed), "--result", String(result), "--size", SIZE,
    "--frames", String(FRAMES), "--fps", String(FPS), "--out", out, "--video", fmt, "--name", name];
  if (fmt === "webm") args.push("--transparent");
  return new Promise(function (resolve, reject) {
    cp.execFile(process.execPath, args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }, function (err, stdout, stderr) {
      var m = String(stdout).split(/\r?\n/).filter(function (l) { return /^result: /.test(l); })[0];
      if (err || !m) return reject(new Error("render " + result + " " + fmt + " seed " + seed + " failed:\n" + String(stdout).slice(-800) + String(stderr).slice(-400)));
      var rep = JSON.parse(m.slice(8));
      if (!rep.video || !fs.existsSync(rep.video)) return reject(new Error("no clip for " + result + " " + fmt));
      resolve(rep);
    });
  });
}

async function oneResult(result) {
  for (var k = 0; k < TRIES; k++) {
    var seed = result + 20 * k;
    var webm = await render(result, seed, "webm", "d20_" + pad(result) + ".webm");
    if (webm.up_number !== result) throw new Error("result " + result + ": the scene painted " + webm.up_number + " up");
    if (!webm.settled) { console.log("d20 " + pad(result) + ": seed " + seed + " had not settled, next seed"); continue; }
    var mp4 = await render(result, seed, "mp4", "d20_" + pad(result) + ".mp4");
    if (!mp4.settled || mp4.up_number !== result) throw new Error("result " + result + ": the mp4 roll differs from the webm roll (seed " + seed + ")");
    fs.mkdirSync(OUT, { recursive: true });
    fs.copyFileSync(webm.video, path.join(OUT, path.basename(webm.video)));
    fs.copyFileSync(mp4.video, path.join(OUT, path.basename(mp4.video)));
    console.log("d20 " + pad(result) + ": seed " + seed + " → " + path.basename(webm.video) + " " + kb(webm.video) + ", " + path.basename(mp4.video) + " " + kb(mp4.video));
    return { result: result, seed: seed, webm: fs.statSync(webm.video).size, mp4: fs.statSync(mp4.video).size };
  }
  throw new Error("result " + result + ": no settled roll in " + TRIES + " seeds");
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

async function main() {
  var o = parseArgs(process.argv.slice(2));
  var wanted = o.only || Array.apply(null, Array(20)).map(function (_, i) { return i + 1; });
  var t0 = Date.now();
  var done = await pool(wanted, o.jobs, oneResult);
  var manifestPath = path.join(OUT, "manifest.json");
  var manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : { clips: {} };
  manifest.scene = "dice_roll"; manifest.size = SIZE; manifest.frames = FRAMES; manifest.fps = FPS;
  manifest.rendered = new Date().toISOString().slice(0, 10);
  done.results.forEach(function (r) { manifest.clips[pad(r.result)] = { seed: r.seed, webm: r.webm, mp4: r.mp4 }; });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  var total = Object.keys(manifest.clips).reduce(function (s, k) { return s + manifest.clips[k].webm + manifest.clips[k].mp4; }, 0);
  console.log((done.results.length + " of " + wanted.length + " results in " + ((Date.now() - t0) / 1000).toFixed(0) + "s; ") + Object.keys(manifest.clips).length + " clips in manifest, " + (total / 1024 / 1024).toFixed(1) + " MB → " + OUT);
  if (done.failures.length) { console.error(done.failures.length + " FAILED"); process.exit(1); }
}

if (require.main === module) main().catch(function (e) { console.error(e); process.exit(1); });
