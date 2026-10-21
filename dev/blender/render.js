// dev/blender/render.js — THE headless Blender launcher (2026-10-19). Runs one scene script from
// dev/blender/scenes/ inside `blender --background` and reports what it wrote. Nothing here is
// loaded by the game; this is dev tooling, like the audio prepare-*.py scripts.
//
//   node dev/blender/render.js                       list the scenes
//   node dev/blender/render.js dice_roll             render the scene with its defaults → renders/dice_roll/
//   node dev/blender/render.js dice_roll --result 20 --seed 7 --frames 60 --size 512x512
//   node dev/blender/render.js dice_roll --still 60  render ONE frame (a quick look, not the animation)
//   node dev/blender/render.js dice_roll --video     also encode the frames to <out>/<scene>.webm
//
// Common flags (every scene reads the ones it understands; a scene's own flags are documented at
// the top of its file): --out DIR (default renders/<scene>), --frames N, --fps N, --size WxH,
// --seed N, --engine EEVEE|WORKBENCH, --samples N, --transparent, --shadow, --video, --still N.
//
// Blender is found through the BLENDER environment variable, else the newest
// "C:\Program Files\Blender Foundation\Blender *\blender.exe", else `blender` on PATH; none → a loud
// refusal. The scene receives its options as ONE JSON argument after Blender's `--` separator, so
// no shell quoting is involved on either side.
var fs = require("fs");
var path = require("path");
var cp = require("child_process");

var ROOT = path.join(__dirname, "..", "..");
var SCENES = path.join(__dirname, "scenes");

function findBlender() {
  if (process.env.BLENDER && fs.existsSync(process.env.BLENDER)) return process.env.BLENDER;
  var base = "C:\\Program Files\\Blender Foundation";
  if (fs.existsSync(base)) {
    var hits = fs.readdirSync(base).filter(function (d) { return /^Blender /.test(d); })
      .map(function (d) { return path.join(base, d, "blender.exe"); })
      .filter(function (p) { return fs.existsSync(p); })
      .sort(function (a, b) { return parseFloat(b.match(/Blender ([\d.]+)/)[1]) - parseFloat(a.match(/Blender ([\d.]+)/)[1]); });
    if (hits.length) return hits[0];
  }
  var where = cp.spawnSync(process.platform === "win32" ? "where" : "which", ["blender"], { encoding: "utf8" });
  if (where.status === 0 && where.stdout.trim()) return where.stdout.trim().split(/\r?\n/)[0];
  return null;
}

function listScenes() {
  return fs.existsSync(SCENES) ? fs.readdirSync(SCENES).filter(function (f) { return /\.py$/.test(f); }).map(function (f) { return f.replace(/\.py$/, ""); }) : [];
}

function parseArgs(argv) {
  var opts = { flags: {} }, i;
  for (i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (a.slice(0, 2) !== "--") { if (!opts.scene) opts.scene = a; continue; }
    var key = a.slice(2), next = argv[i + 1];
    if (next != null && next.slice(0, 2) !== "--") { opts.flags[key] = next; i++; } else opts.flags[key] = true;
  }
  return opts;
}

function usage(code) {
  var scenes = listScenes();
  console.log("usage: node dev/blender/render.js <scene> [--out DIR] [--frames N] [--fps N] [--size WxH] [--seed N] [--engine EEVEE|WORKBENCH] [--samples N] [--transparent] [--shadow] [--video [webm|mp4]] [--still N] [scene flags]");
  console.log("scenes: " + (scenes.length ? scenes.join(", ") : "(none in " + SCENES + ")"));
  process.exit(code);
}

function main() {
  var opts = parseArgs(process.argv.slice(2));
  if (!opts.scene || opts.flags.help) usage(opts.scene ? 0 : 1);
  var script = path.join(SCENES, opts.scene + ".py");
  if (!fs.existsSync(script)) { console.error("no such scene: " + opts.scene + " (have: " + listScenes().join(", ") + ")"); process.exit(1); }
  var blender = findBlender();
  if (!blender) { console.error("Blender not found: set BLENDER=<path to blender.exe> or install it under C:\\Program Files\\Blender Foundation"); process.exit(1); }

  var f = opts.flags;
  var out = path.resolve(ROOT, f.out || path.join("renders", opts.scene));
  var size = (f.size || "512x512").split("x").map(Number);
  var options = {
    out: out,
    frames: f.frames != null ? Number(f.frames) : undefined,
    fps: f.fps != null ? Number(f.fps) : undefined,
    size: size.length === 2 && size.every(function (n) { return n > 0; }) ? size : undefined,
    seed: f.seed != null ? Number(f.seed) : undefined,
    engine: f.engine ? String(f.engine).toUpperCase() : undefined,
    samples: f.samples != null ? Number(f.samples) : undefined,
    transparent: !!f.transparent,
    shadow: !!f.shadow,
    video: f.video === true ? true : (f.video ? String(f.video) : false),
    still: f.still != null ? Number(f.still) : undefined
  };
  Object.keys(f).forEach(function (k) { if (!(k in options) && k !== "out" && k !== "size") options[k] = f[k]; });
  Object.keys(options).forEach(function (k) { if (options[k] === undefined) delete options[k]; });

  fs.mkdirSync(out, { recursive: true });
  // Stale frames from a longer earlier run would masquerade as this run's tail: clear ONLY this
  // scene's frame files, nothing else in the folder.
  fs.readdirSync(out).filter(function (n) { return /^frame_\d+\.png$/.test(n); }).forEach(function (n) { fs.unlinkSync(path.join(out, n)); });

  var args = ["--background", "--factory-startup", "--python", script, "--", "--json", JSON.stringify(options)];
  console.log("blender: " + blender);
  console.log("scene:   " + script);
  console.log("out:     " + out);
  var t0 = Date.now();
  var r = cp.spawnSync(blender, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  var secs = ((Date.now() - t0) / 1000).toFixed(1);
  var lines = (r.stdout || "").split(/\r?\n/);
  var report = null;
  lines.forEach(function (l) {
    if (/^SCENE_RESULT /.test(l)) { try { report = JSON.parse(l.slice(13)); } catch (e) { console.error("unparseable SCENE_RESULT line: " + l); } }
    else if (/^(SCENE|WARN|Error|Traceback)/.test(l)) console.log(l);
  });
  if (r.status !== 0 || !report) {
    console.error("render FAILED (exit " + r.status + ", " + secs + "s). Last output:");
    console.error(lines.slice(-25).join("\n"));
    console.error((r.stderr || "").split(/\r?\n/).slice(-25).join("\n"));
    process.exit(1);
  }
  var frames = fs.readdirSync(out).filter(function (n) { return /^frame_\d+\.png$/.test(n); });
  console.log("done in " + secs + "s: " + (report.still ? "still " + report.still : frames.length + " frames") + (report.video ? ", video " + report.video : "") + " → " + out);
  console.log("result:  " + JSON.stringify(report));
  if (!report.still && frames.length !== report.frames) { console.error("frame count mismatch: scene reported " + report.frames + ", folder holds " + frames.length); process.exit(1); }
}

if (require.main === module) main();
module.exports = { findBlender: findBlender, listScenes: listScenes, parseArgs: parseArgs };
