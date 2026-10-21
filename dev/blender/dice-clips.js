// dev/blender/dice-clips.js — THE d20 clip batch (2026-10-20). Renders one roll per result 1..20
// through dev/blender/render.js, ONE transparent render each, encoded two ways from the same frames:
// a VP9 WebM with alpha (the die over the page) and a STACKED-ALPHA H.264 MP4 (colour | matte, twice
// as wide) for WebKit, which drops VP9 alpha — the page recombines it on a canvas (ui-dice.js).
// The clips land in dice/ with a manifest. Nothing here is loaded by the game.
//
//   node dev/blender/dice-clips.js                 all twenty, four at a time
//   node dev/blender/dice-clips.js --only 20,1     a subset
//   node dev/blender/dice-clips.js --jobs 2        fewer Blender processes side by side
//
// A result's seed starts at the result number and steps by 20 until the die has SETTLED by the
// last frame AND turned over at least MIN_TURNS times (the scene's own verdicts); an unsettled roll
// or a lazy one is never shipped. Both clips of a result
// come from one render, so they are the same roll. The manifest records every seed — rerunning
// reproduces the clips byte-for-byte short of encoder drift.
var fs = require("fs");
var path = require("path");
var cp = require("child_process");

var ROOT = path.join(__dirname, "..", "..");
var RENDER = path.join(__dirname, "render.js");
var OUT = path.join(ROOT, "dice");
var SCRATCH = path.join(ROOT, "renders", "dice-clips");
var SIZE = "800x400", FRAMES = 84, FPS = 24, TRIES = 8, MIN_TURNS = 1.5;   // turns ROLLED ON THE FELT (the scene's "turns"): under 1.5 the roll reads as a drop   // 3.5 s: the harder throw (2026-10-21) needs the extra half second to come to rest

function parseArgs(argv) {
  var o = { only: null, jobs: 4 };
  for (var i = 0; i < argv.length; i++) {
    if (argv[i] === "--only") o.only = String(argv[++i]).split(",").map(Number);
    else if (argv[i] === "--jobs") o.jobs = Number(argv[++i]);
  }
  return o;
}

function render(result, seed) {
  var out = path.join(SCRATCH, String(result));
  var args = [RENDER, "dice_roll", "--seed", String(seed), "--result", String(result), "--size", SIZE,
    "--frames", String(FRAMES), "--fps", String(FPS), "--out", out, "--transparent", "--shadow",
    "--video", "webm,stacked", "--name", "d20_" + pad(result) + ".webm"];
  return new Promise(function (resolve, reject) {
    cp.execFile(process.execPath, args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }, function (err, stdout, stderr) {
      var m = String(stdout).split(/\r?\n/).filter(function (l) { return /^result: /.test(l); })[0];
      if (err || !m) return reject(new Error("render " + result + " seed " + seed + " failed:\n" + String(stdout).slice(-800) + String(stderr).slice(-400)));
      var rep = JSON.parse(m.slice(8));
      var v = rep.videos || {};
      if (!v.webm || !fs.existsSync(v.webm) || !v.stacked || !fs.existsSync(v.stacked)) return reject(new Error("a clip is missing for " + result + ": " + JSON.stringify(v)));
      resolve(rep);
    });
  });
}

async function oneResult(result) {
  for (var k = 0; k < TRIES; k++) {
    var seed = result + 20 * k;
    var rep = await render(result, seed);
    if (rep.up_number !== result) throw new Error("result " + result + ": the scene painted " + rep.up_number + " up");
    if (!rep.settled) { console.log("d20 " + pad(result) + ": seed " + seed + " had not settled, next seed"); continue; }
    if (!(rep.turns >= MIN_TURNS)) { console.log("d20 " + pad(result) + ": seed " + seed + " turned only " + rep.turns + " times, next seed"); continue; }
    var webm = rep.videos.webm, stacked = rep.videos.stacked;
    fs.mkdirSync(OUT, { recursive: true });
    fs.copyFileSync(webm, path.join(OUT, path.basename(webm)));
    fs.copyFileSync(stacked, path.join(OUT, path.basename(stacked)));
    console.log("d20 " + pad(result) + ": seed " + seed + " (" + rep.turns + " turns) → " + path.basename(webm) + " " + kb(webm) + ", " + path.basename(stacked) + " " + kb(stacked));
    return { result: result, seed: seed, turns: rep.turns, webm: fs.statSync(webm).size, stacked: fs.statSync(stacked).size };
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
  done.results.forEach(function (r) { manifest.clips[pad(r.result)] = { seed: r.seed, turns: r.turns, webm: r.webm, stacked: r.stacked }; });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  // the same manifest as a script, for dev/dice-review.html opened from disk (a file:// page cannot fetch())
  fs.writeFileSync(path.join(OUT, "manifest.js"), "var DICE_MANIFEST = " + JSON.stringify(manifest) + ";\n");
  var total = Object.keys(manifest.clips).reduce(function (s, k) { return s + manifest.clips[k].webm + manifest.clips[k].stacked; }, 0);
  console.log((done.results.length + " of " + wanted.length + " results in " + ((Date.now() - t0) / 1000).toFixed(0) + "s; ") + Object.keys(manifest.clips).length + " clips in manifest, " + (total / 1024 / 1024).toFixed(1) + " MB → " + OUT);
  if (done.failures.length) { console.error(done.failures.length + " FAILED"); process.exit(1); }
}

if (require.main === module) main().catch(function (e) { console.error(e); process.exit(1); });
