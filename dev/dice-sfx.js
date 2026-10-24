// dev/dice-sfx.js — #659: THE DICE SAMPLE BATCH. Cuts the owner-chosen CC0 recordings (aunrea's "Dice Rolls" pack on
// Freesound: one recording per die, three or four throws in each) into one-shot TAKES and packs every take into ONE
// delivery sprite, dice/sfx/dice-rolls-v<N>.mp3 (the accent-sprite precedent, dev/prepare-accent-sprite.py: one download,
// one decode, one cache entry), with dice/sfx/manifest.json (+ manifest.js, the same as data) that the game's chooser
// reads: per take its CUT on the sprite's decoded timeline, its LANDING (the loudest impact, seconds into the cut — the
// game aligns it with the clip's measured landing) and its LENGTH (landing to the last impact — the game picks the take
// nearest the clip's own motion). Every cut boundary is a whole millisecond.
//   node dev/dice-sfx.js            cuts Audio/CC0/Dice/*.mp3 into dice/sfx/
//   node dev/dice-sfx.js --dry      prints the throws it would cut, writes nothing
// Method: ffmpeg decodes to 48 kHz mono PCM; an impact is an onset (a 5 ms RMS frame twice the mean of the previous four
// and above a tenth of the file's loudest); a THROW is a run of impacts no more than 0.8 s apart whose loudest impact is
// within 9 dB of the file's loudest and above -30 dBFS (the die leaving the hand is quieter and earlier), and it begins at
// the first impact chained to the landing by gaps under 0.3 s; a take runs from 15 ms before that to 160 ms past the last
// impact's decay, peak-normalised to -3 dBFS, 4 ms in / 40 ms out raised-cosine fades, padded to a whole millisecond;
// takes are joined with 0.25 s of silence and encoded libmp3lame 128 kbps mono with the Xing/LAME gapless header (refused
// without it: the browser's decoded timeline would shift by the encoder delay) and no ID3.
var fs = require("fs"), path = require("path"), cp = require("child_process"), crypto = require("crypto");
var ROOT = path.join(__dirname, ".."), SRC = path.join(ROOT, "Audio", "CC0", "Dice"), OUT = path.join(ROOT, "dice", "sfx");
var SR = 48000, DRY = process.argv.indexOf("--dry") >= 0, SPRITE = "dice-rolls-v1.mp3", GAP = 0.25;
var SOURCES = [/* Freesound ids; "Creative Commons 0" verified on the pack page 2026-10-23; the HQ previews (192 kbps mp3, 48 kHz mono) */
  { sides: 4, id: 485943 }, { sides: 6, id: 485950 }, { sides: 8, id: 485949 }, { sides: 10, id: 485946 }, { sides: 12, id: 485945 }, { sides: 20, id: 485944 }
];
function sha(buf) { return crypto.createHash("sha256").update(buf).digest("hex"); }
function dB(v) { return Math.round(20 * Math.log10(Math.max(v, 1e-9)) * 10) / 10; }
function decode(file) {
  var pcm = cp.execFileSync("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SR), "-f", "s16le", "-"], { maxBuffer: 256 * 1024 * 1024 });
  var n = pcm.length / 2, x = new Float64Array(n), i;
  for (i = 0; i < n; i++) x[i] = pcm.readInt16LE(i * 2) / 32768;
  return x;
}
function impacts(x) {
  var frame = Math.round(SR * 0.005), frames = Math.floor(x.length / frame), rms = new Float64Array(frames), f, i, maxR = 0;
  for (f = 0; f < frames; f++) { var s = 0; for (i = f * frame; i < (f + 1) * frame; i++) s += x[i] * x[i]; rms[f] = Math.sqrt(s / frame); if (rms[f] > maxR) maxR = rms[f]; }
  var out = [], last = -100;
  for (f = 4; f < frames; f++) {
    var prev = (rms[f - 1] + rms[f - 2] + rms[f - 3] + rms[f - 4]) / 4;
    if (rms[f] > prev * 2 && rms[f] > maxR * 0.1 && f - last >= 5) {
      var pk = 0, e = f; for (var q = f; q < Math.min(frames, f + 4); q++) if (rms[q] > pk) pk = rms[q];
      while (e < frames && rms[e] > pk * 0.1) e++;
      out.push({ t: f * 0.005, peak: pk, end: e * 0.005 }); last = f;
    }
  }
  return { list: out, maxDb: dB(maxR) };
}
function throws(imp) {
  var groups = [], cur = null, i;
  for (i = 0; i < imp.list.length; i++) { if (!cur || imp.list[i].t - cur[cur.length - 1].t > 0.8) { cur = [imp.list[i]]; groups.push(cur); } else cur.push(imp.list[i]); }
  return groups.map(function (g) {
    var li = 0, k; for (k = 1; k < g.length; k++) if (g[k].peak > g[li].peak) li = k;
    var si = li; while (si > 0 && g[si].t - g[si - 1].t < 0.3) si--;              /* the throw begins where the impacts chain into the landing */
    var hits = g.slice(si);
    return { first: hits[0].t, landing: g[li].t, lastHit: g[g.length - 1].t, end: g[g.length - 1].end, loudDb: dB(g[li].peak), hits: hits.length };
  }).filter(function (t) { return t.loudDb >= imp.maxDb - 9 && t.loudDb >= -30 && t.hits >= 2; });
}
function cut(x, from, to) {
  var a = Math.max(0, Math.round(from * SR)), b = Math.min(x.length, Math.round(to * SR)), y = x.slice(a, b), n = y.length, i, peak = 0;
  for (i = 0; i < n; i++) if (Math.abs(y[i]) > peak) peak = Math.abs(y[i]);
  var g = peak > 0 ? Math.pow(10, -3 / 20) / peak : 1, fin = Math.round(SR * 0.004), fout = Math.round(SR * 0.04), s = 0;
  for (i = 0; i < n; i++) { var w = 1; if (i < fin) w = 0.5 - 0.5 * Math.cos(Math.PI * i / fin); else if (i >= n - fout) w = 0.5 - 0.5 * Math.cos(Math.PI * (n - i) / fout); y[i] = y[i] * g * w; s += y[i] * y[i]; }
  var ms = Math.ceil(n / (SR / 1000)), padded = new Float64Array(ms * (SR / 1000)); padded.set(y);   /* a whole millisecond — every boundary exact */
  return { pcm: padded, seconds: ms / 1000, rmsDb: dB(Math.sqrt(s / n)) };
}
function encode(pieces, file) {
  var total = 0, i; for (i = 0; i < pieces.length; i++) total += pieces[i].length;
  var pcm = Buffer.alloc(total * 2), at = 0;
  for (i = 0; i < pieces.length; i++) { var p = pieces[i]; for (var k = 0; k < p.length; k++) { pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, p[k])) * 32767), at * 2); at++; } }
  cp.execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "s16le", "-ar", String(SR), "-ac", "1", "-i", "-", "-c:a", "libmp3lame", "-b:a", "128k", "-write_xing", "1", "-id3v2_version", "0", "-write_id3v1", "0", file], { input: pcm });
  var head = fs.readFileSync(file).slice(0, 4096).toString("latin1");
  if (!/Xing|Info/.test(head) || !/LAME|Lavc|Lavf/.test(head)) throw new Error(file + " has no Xing/LAME gapless header (the encoder tag, with the delay and padding the browser trims) — the decoded timeline would not match the cut list");
  return total / SR;
}
var manifest = { schema: 1, file: "dice/sfx/" + SPRITE, license: "CC0 1.0", author: "aunrea", source: "Freesound pack \"Dice Rolls\" https://freesound.org/people/aunrea/packs/27882/ — a plastic die rolled on a wooden table, Tascam DR-100MKIII + AT875R; the HQ previews (192 kbps mp3, 48 kHz mono)", licenseVerified: "2026-10-23 — \"Creative Commons 0\" on the pack page and on sound 485950's page; owner chose the pack by ear the same day", cut: new Date().toISOString().slice(0, 10), gap: GAP, method: "dev/dice-sfx.js (its header): onsets → throws → takes at -3 dBFS peak, 4/40 ms fades, whole-millisecond cuts joined by " + GAP + " s of silence, libmp3lame 128 kbps mono with the Xing/LAME gapless header, no ID3", dice: {} };
var pieces = [], silence = new Float64Array(GAP * SR), at = 0, count = 0;
SOURCES.forEach(function (src) {
  var file = fs.readdirSync(SRC).filter(function (n) { return n.indexOf("fs" + src.id + "__") === 0; })[0];
  if (!file) throw new Error("no download for Freesound " + src.id + " under " + SRC);
  var raw = fs.readFileSync(path.join(SRC, file)), x = decode(path.join(SRC, file)), th = throws(impacts(x)), key = "d" + src.sides;
  if (th.length < 2) throw new Error(key + ": only " + th.length + " throw(s) found in " + file + " — the chooser needs a choice");
  var set = { freesound: src.id, url: "https://freesound.org/people/aunrea/sounds/" + src.id + "/", download: "https://cdn.freesound.org/previews/485/" + src.id + "_7932944-hq.mp3", downloadSha256: sha(raw), downloadBytes: raw.length, takes: [] };
  console.log(key + " (" + file + "): " + th.length + " throws — " + th.map(function (t) { return t.first.toFixed(2) + "-" + t.end.toFixed(2) + "s landing@" + t.landing.toFixed(2) + " " + t.loudDb + "dB " + t.hits + " hits"; }).join(" | "));
  th.forEach(function (t) {
    var from = Math.max(0, t.first - 0.015), to = t.end + 0.16, c = cut(x, from, to);
    set.takes.push({ cut: [+at.toFixed(3), +(at + c.seconds).toFixed(3)], landing: +(t.landing - from).toFixed(3), length: +(t.lastHit - t.landing).toFixed(3), hits: t.hits, sourceFrom: +from.toFixed(3), sourceTo: +to.toFixed(3), rmsDb: c.rmsDb });
    pieces.push(c.pcm, silence); at += c.seconds + GAP; count++;
  });
  manifest.dice[key] = set;
});
if (!DRY) {
  fs.mkdirSync(OUT, { recursive: true });
  var out = path.join(OUT, SPRITE);
  manifest.seconds = +encode(pieces, out).toFixed(3);
  var bytes = fs.readFileSync(out); manifest.bytes = bytes.length; manifest.sha256 = sha(bytes);
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  fs.writeFileSync(path.join(OUT, "manifest.js"), "var DICE_SFX = " + JSON.stringify(manifest) + ";\n");
  console.log(count + " takes, " + manifest.seconds + " s, " + Math.round(bytes.length / 1024) + " KB → " + out);
} else console.log(count + " takes, " + at.toFixed(2) + " s (dry)");
