#!/usr/bin/env node
/* Inworld speed probe (owner report 2026-11-24: the game's Aoife reads far slower than Inworld's own sandbox
   with the same voice, speed 1.0 and Creative delivery).
   Reads ONE passage several ways and measures each take, to say which difference from the sandbox slows it:
     - reasoning on (what the game sends) against reasoning off;
     - headerless PCM at 24 kHz (what the game asks for) against a WAV whose header states the real rate -
       a PCM answer at another rate than asked would play slow and low in the game;
     - the sandbox's own shape (MP3, no rate, no speed) to listen against.
   Every take is saved beside an index.html to listen from.

   Usage (PowerShell):
     $env:INWORLD_API_KEY = "<the encoded key, without the Basic prefix>"
     node dev/inworld-speed-probe.js [--voice Aoife] [--delivery CREATIVE] [--rate 1] [--text "..."] [--out renders/inworld-speed]

   Bills the key: 7 short requests, a few cents. Nothing is written outside --out. */
"use strict";
var fs = require("fs"), path = require("path");

var KEY = process.env.INWORLD_API_KEY || "";
if (!KEY) { console.error("INWORLD_API_KEY is not set. Set it to the encoded key from Inworld (without the Basic prefix) and run again."); process.exit(2); }
KEY = KEY.replace(/^Basic\s+/i, "");

function arg(name, dflt) { var i = process.argv.indexOf("--" + name); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt; }
var VOICE = arg("voice", "Aoife"), DELIVERY = arg("delivery", "CREATIVE"), SPEED = Number(arg("rate", "1"));
var OUT = path.resolve(arg("out", path.join(__dirname, "..", "renders", "inworld-speed")));
/* The Voice Settings test passage (tts.js GEMINI_TEST_LINE). */
var TEXT = arg("text", "The lamps gutter as the door swings wide, and the hall falls quiet. \"You are late,\" she says, not looking up from the map. Rain runs from your cloak onto the flagstones.");
var ENDPOINT = "https://api.inworld.ai/tts/v1/voice", ASKED = 24000;
if (!(SPEED >= 0.5 && SPEED <= 1.5)) { console.error("--rate must be between 0.5 and 1.5."); process.exit(2); }

var ON = { reasoning: "REASONING_ON" };
/* `game` is tts.js VOICE_MODELS.inworld.request for a narrator line with no direction and no mood tag. */
function gameBody(reasoning) {
  var b = { text: TEXT, voiceId: VOICE, modelId: "inworld-tts-2", deliveryMode: DELIVERY, audioConfig: { audioEncoding: "PCM", sampleRateHertz: ASKED, speakingRate: SPEED } };
  if (reasoning) b.synthesisContext = ON;
  return b;
}
var PLAN = [
  { label: "1-game-reasoning-on-a", note: "the game's request (reasoning on), take 1", body: gameBody(true), kind: "pcm" },
  { label: "2-game-reasoning-on-b", note: "the game's request (reasoning on), take 2", body: gameBody(true), kind: "pcm" },
  { label: "3-reasoning-off-a", note: "the same request with reasoning off, take 1", body: gameBody(false), kind: "pcm" },
  { label: "4-reasoning-off-b", note: "the same request with reasoning off, take 2", body: gameBody(false), kind: "pcm" },
  { label: "5-wav-24k", note: "reasoning off, WAV asked at 24 kHz (the header states the real rate)", kind: "wav",
    body: { text: TEXT, voiceId: VOICE, modelId: "inworld-tts-2", deliveryMode: DELIVERY, audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: ASKED, speakingRate: SPEED } } },
  { label: "6-wav-native", note: "reasoning off, WAV with no rate asked (the model's own rate)", kind: "wav",
    body: { text: TEXT, voiceId: VOICE, modelId: "inworld-tts-2", deliveryMode: DELIVERY, audioConfig: { audioEncoding: "LINEAR16", speakingRate: SPEED } } },
  { label: "7-sandbox-shape", note: "the sandbox's shape: MP3, no rate, no speed, reasoning off (listen only)", kind: "mp3",
    body: { text: TEXT, voiceId: VOICE, modelId: "inworld-tts-2", deliveryMode: DELIVERY } }
];

/* A WAV's stated rate and the length of its sample data, read from its chunks (never assumed at byte 44). */
function wavInfo(b) {
  if (b.length < 12 || b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WAVE") return null;
  var pos = 12, rate = 0, channels = 1, bits = 16, data = -1;
  while (pos + 8 <= b.length) {
    var id = b.toString("ascii", pos, pos + 4), size = b.readUInt32LE(pos + 4);
    if (id === "fmt ") { channels = b.readUInt16LE(pos + 10); rate = b.readUInt32LE(pos + 12); bits = b.readUInt16LE(pos + 22); }
    if (id === "data") { data = Math.min(size, b.length - pos - 8); break; }
    pos += 8 + size + (size % 2);
  }
  if (!rate || data < 0) return null;
  return { rate: rate, bytes: data, seconds: data / (rate * channels * (bits / 8)) };
}
function wavOf(pcm, rate) {
  var h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
function r1(n) { return Math.round(n * 10) / 10; }

function take(p) {
  var t0 = Date.now();
  return fetch(ENDPOINT, { method: "POST", headers: { "Authorization": "Basic " + KEY, "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(p.body) })
    .then(function(r) { return r.text().then(function(t) { return { status: r.status, text: t }; }); })
    .then(function(r) {
      var out = { label: p.label, note: p.note, kind: p.kind, ms: Date.now() - t0, ok: false }, j = null;
      try { j = JSON.parse(r.text); } catch (e) { /* reported below */ }
      if (r.status !== 200 || !j || !j.audioContent) { out.error = "HTTP " + r.status + " " + r.text.slice(0, 300); return out; }
      var bytes = Buffer.from(j.audioContent, "base64");
      out.instruction = j.reasoningInstruction || "";
      if (p.kind === "pcm") {
        if (wavInfo(bytes)) { out.error = "asked for headerless PCM, received a WAV header - the game would play the header as noise"; return out; }
        /* Saved exactly as the game plays it: these bytes at the rate it asked for. */
        out.file = p.label + ".wav"; fs.writeFileSync(path.join(OUT, out.file), wavOf(bytes, ASKED));
        out.bytes = bytes.length; out.seconds = bytes.length / (ASKED * 2); out.rate = ASKED;
      } else if (p.kind === "wav") {
        var info = wavInfo(bytes);
        if (!info) { out.error = "asked for a WAV, received no readable WAV header (" + bytes.length + " bytes)"; return out; }
        out.file = p.label + ".wav"; fs.writeFileSync(path.join(OUT, out.file), bytes);
        out.bytes = info.bytes; out.seconds = info.seconds; out.rate = info.rate;
      } else {
        out.file = p.label + ".mp3"; fs.writeFileSync(path.join(OUT, out.file), bytes);
      }
      out.ok = true; return out;
    })
    .catch(function(e) { return { label: p.label, note: p.note, kind: p.kind, ms: Date.now() - t0, ok: false, error: String(e && e.message || e) }; });
}

/* What the numbers say. Two takes of one request differ by a few percent on their own, so only a clear gap is called. */
function verdict(rows) {
  var by = {}, lines = [];
  rows.forEach(function(r) { by[r.label] = r; });
  function avg(a, b) { var xs = [by[a], by[b]].filter(function(r) { return r && r.ok; }).map(function(r) { return r.seconds; }); return xs.length ? xs.reduce(function(s, x) { return s + x; }, 0) / xs.length : 0; }
  var on = avg("1-game-reasoning-on-a", "2-game-reasoning-on-b"), off = avg("3-reasoning-off-a", "4-reasoning-off-b");
  if (on && off) {
    var pct = Math.round((on / off - 1) * 100);
    lines.push("REASONING: on " + r1(on) + " s, off " + r1(off) + " s (" + (pct >= 0 ? "+" : "") + pct + "%). "
      + (pct >= 15 ? "Reasoning slows this passage." : pct <= -15 ? "Reasoning speeds this passage up." : "No clear difference: reasoning is not what slows it."));
  } else lines.push("REASONING: not measured (a take failed).");
  var w24 = by["5-wav-24k"], nat = by["6-wav-native"];
  if (w24 && w24.ok) lines.push("RATE ASKED: the WAV asked at " + ASKED + " Hz states " + w24.rate + " Hz. " + (w24.rate === ASKED ? "Honoured." : "NOT honoured: the game plays PCM as " + ASKED + " Hz, so its audio would run at " + r1(ASKED / w24.rate * 100) + "% speed."));
  if (w24 && w24.ok && off) {
    var ratio = off / w24.seconds;
    lines.push("PCM AGAINST WAV: the game's PCM plays " + r1(off) + " s at " + ASKED + " Hz; the WAV holds " + r1(w24.seconds) + " s. "
      + (ratio > 1.3 ? "The PCM is " + r1(ratio) + " times as long: it was NOT sent at the rate asked, and the game plays it slow and low." : ratio < 0.77 ? "The PCM is shorter than the WAV by more than take-to-take noise: the game plays it fast." : "They agree: the game plays the PCM at the right speed."));
  }
  if (nat && nat.ok) lines.push("MODEL'S OWN RATE: " + nat.rate + " Hz when none is asked.");
  return lines;
}

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function page(rows, lines) {
  var h = "<!doctype html><meta charset=utf-8><title>Inworld speed probe</title><style>body{font:15px/1.5 system-ui;max-width:860px;margin:24px auto;padding:0 16px;background:#14110d;color:#ddd}div.r{margin:8px 0;padding:8px 10px;background:#1e1a14}code{color:#9c9}audio{display:block;width:100%;margin-top:6px}.bad{color:#e66}li{margin:4px 0}</style><h1>Inworld speed probe</h1><p>Voice " + esc(VOICE) + " · delivery " + esc(DELIVERY) + " · speed " + SPEED + " · " + new Date().toISOString() + "</p><p>" + esc(TEXT) + "</p><ul>";
  lines.forEach(function(l) { h += "<li>" + esc(l) + "</li>"; });
  h += "</ul>";
  rows.forEach(function(r) {
    h += "<div class=r><b>" + esc(r.note) + "</b> · " + r.ms + " ms" + (r.ok && r.seconds ? " · " + r1(r.seconds) + " s of audio at " + r.rate + " Hz" : "")
      + (r.ok ? "<br>instruction it wrote: <code>" + esc(r.instruction || "(none)") + "</code><audio controls preload=none src=\"" + esc(r.file) + "\"></audio>" : "<br><span class=bad>" + esc(r.error) + "</span>") + "</div>";
  });
  return h;
}

fs.mkdirSync(OUT, { recursive: true });
(function run(i, rows) {
  if (i >= PLAN.length) {
    var lines = verdict(rows);
    fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ voice: VOICE, delivery: DELIVERY, speed: SPEED, text: TEXT, verdict: lines, takes: rows }, null, 2));
    fs.writeFileSync(path.join(OUT, "index.html"), page(rows, lines));
    var bad = rows.filter(function(r) { return !r.ok; }).length;
    console.log(""); lines.forEach(function(l) { console.log(l); });
    console.log("\n" + (rows.length - bad) + " of " + rows.length + " takes saved. Listen: " + path.join(OUT, "index.html"));
    process.exit(bad ? 1 : 0);
    return;
  }
  take(PLAN[i]).then(function(r) {
    console.log((r.ok ? "ok  " : "FAIL") + " " + r.label + "  " + r.ms + " ms" + (r.ok ? (r.seconds ? "  " + r1(r.seconds) + " s at " + r.rate + " Hz" : "  saved") + "  instruction: " + (r.instruction || "(none)") : "  " + r.error));
    rows.push(r); run(i + 1, rows);
  });
})(0, []);
