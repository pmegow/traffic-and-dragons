#!/usr/bin/env node
/* Inworld TTS-2 "reasoning" A/B (owner ask 2026-11-16).
   Reads the same lines with synthesisContext.reasoning off and on, prints the instruction the model
   wrote (reasoningInstruction), and saves every take as a WAV beside an index.html to listen from.
   It also answers two open questions about the game's own request (tts.js):
     - does the undocumented `instruction` field still steer?
     - does a leading mood tag or a non-verbal tag switch reasoning off?

   Usage (PowerShell):
     $env:INWORLD_API_KEY = "<the encoded key, without the Basic prefix>"
     node dev/inworld-reasoning-ab.js [--voice Dennis] [--out renders/inworld-ab]

   Bills the key: about 20 short requests, a few cents. Nothing is written outside --out. */
"use strict";
var fs = require("fs"), path = require("path");

var KEY = process.env.INWORLD_API_KEY || "";
if (!KEY) { console.error("INWORLD_API_KEY is not set. Set it to the encoded key from Inworld (without the Basic prefix) and run again."); process.exit(2); }
KEY = KEY.replace(/^Basic\s+/i, "");

function arg(name, dflt) { var i = process.argv.indexOf("--" + name); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt; }
var VOICE = arg("voice", "Dennis");
var OUT = path.resolve(arg("out", path.join(__dirname, "..", "renders", "inworld-ab")));
var ENDPOINT = "https://api.inworld.ai/tts/v1/voice", RATE = 24000;

var SCENE = "A sword and sorcery tale told by a narrator. Night, a storm, a ruined watchtower. Mirelle is a weary old soldier who has just lost a friend; Tovin is a nervous young thief.";
var LINES = [
  { id: "narration", who: "narrator", text: "The door gives way at last, and the cold of the crypt rolls out over your boots like a tide." },
  { id: "grief", who: "Mirelle", text: "He held the gate so we could run. I never even told him thank you." },
  { id: "fear", who: "Tovin", text: "Did you hear that? Something is on the stairs. Something big." },
  { id: "relief", who: "Mirelle", text: "We made it. I honestly didn't think we would." },
  { id: "menace", who: "the warden", text: "You may leave whenever you like. The tower, however, will decide whether you arrive anywhere." },
  { id: "plain", who: "narrator", text: "The road to Henthein runs north for two days, past the mill and the old toll bridge." }
];

/* One take = one request. `body` is merged over the game's own request shape (tts.js VOICE_MODELS.inworld.request). */
function take(label, text, extra) {
  var body = { text: text, voiceId: VOICE, modelId: "inworld-tts-2", deliveryMode: "STABLE",
    audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: RATE, speakingRate: 1.1 } };
  Object.keys(extra || {}).forEach(function(k) { body[k] = extra[k]; });
  var t0 = Date.now();
  return fetch(ENDPOINT, { method: "POST", headers: { "Authorization": "Basic " + KEY, "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(body) })
    .then(function(r) { return r.text().then(function(t) { return { status: r.status, text: t }; }); })
    .then(function(r) {
      var ms = Date.now() - t0, j = null;
      try { j = JSON.parse(r.text); } catch (e) { /* reported below */ }
      if (r.status !== 200 || !j || !j.audioContent) return { label: label, ok: false, ms: ms, error: "HTTP " + r.status + " " + r.text.slice(0, 300) };
      var pcm = Buffer.from(j.audioContent, "base64"), file = label + ".wav";
      fs.writeFileSync(path.join(OUT, file), wav(pcm));
      var other = {}; Object.keys(j).forEach(function(k) { if (k !== "audioContent") other[k] = j[k]; });
      return { label: label, ok: true, ms: ms, file: file, seconds: Math.round(audioBytes(pcm) / (RATE * 2) * 10) / 10, instruction: j.reasoningInstruction || "", sentText: text, other: other };
    })
    .catch(function(e) { return { label: label, ok: false, ms: Date.now() - t0, error: String(e && e.message || e) }; });
}
function isWav(b) { return b.length > 12 && b.toString("ascii", 0, 4) === "RIFF"; }
function audioBytes(b) { return isWav(b) ? b.length - 44 : b.length; }
function wav(pcm) {
  if (isWav(pcm)) return pcm;
  var h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

var ON = { reasoning: "REASONING_ON" };
var PLAN = [];
LINES.forEach(function(l) {
  PLAN.push({ group: l.id, label: l.id + "-1-off", note: "reasoning off", text: l.text });
  PLAN.push({ group: l.id, label: l.id + "-2-on", note: "reasoning on", text: l.text, extra: { synthesisContext: ON } });
  PLAN.push({ group: l.id, label: l.id + "-3-on-scene", note: "reasoning on + scene note", text: l.text,
    extra: { synthesisContext: { reasoning: "REASONING_ON", reasoningContext: SCENE + " Speaking now: " + l.who + "." } } });
});
/* The game's own request: is the `instruction` field honoured? Same text three ways. */
var PROBE = "Keep your voice down. They are right behind that wall.";
PLAN.push({ group: "instruction-field", label: "probe-1-bare", note: "no direction at all", text: PROBE });
PLAN.push({ group: "instruction-field", label: "probe-2-instruction-field", note: "instruction FIELD (what the game sends for a character's direction)", text: PROBE, extra: { instruction: "whisper in a hushed frightened voice" } });
PLAN.push({ group: "instruction-field", label: "probe-3-inline-tag", note: "inline bracket tag (documented)", text: "[whisper in a hushed frightened voice] " + PROBE });
/* Does the game's markup switch reasoning off? */
PLAN.push({ group: "tags-vs-reasoning", label: "tags-1-mood-first", note: "reasoning on, the game's mood prefix", text: "[speak weary] " + LINES[1].text, extra: { synthesisContext: ON } });
PLAN.push({ group: "tags-vs-reasoning", label: "tags-2-sound-first", note: "reasoning on, a leading non-verbal", text: "[sigh] " + LINES[1].text, extra: { synthesisContext: ON } });
PLAN.push({ group: "tags-vs-reasoning", label: "tags-3-field-and-reasoning", note: "reasoning on + the instruction field", text: LINES[1].text, extra: { instruction: "speak wearily", synthesisContext: ON } });

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function page(rows) {
  var h = "<!doctype html><meta charset=utf-8><title>Inworld reasoning A/B</title><style>body{font:15px/1.5 system-ui;max-width:860px;margin:24px auto;padding:0 16px;background:#14110d;color:#ddd}h2{margin:28px 0 4px;color:#e0a040}p.t{margin:0 0 8px;color:#aaa}div.r{margin:8px 0;padding:8px 10px;background:#1e1a14}code{color:#9c9}audio{display:block;width:100%;margin-top:6px}.bad{color:#e66}</style><h1>Inworld TTS-2 reasoning A/B</h1><p>Voice " + esc(VOICE) + " · " + new Date().toISOString() + "</p>";
  var last = "";
  rows.forEach(function(r) {
    if (r.group !== last) { h += "<h2>" + esc(r.group) + "</h2>"; last = r.group; }
    h += "<div class=r><b>" + esc(r.note) + "</b> · " + r.ms + " ms" + (r.ok ? " · " + r.seconds + " s of audio" : "") + "<br>text: " + esc(r.sentText || r.text || "")
      + (r.ok ? "<br>instruction it wrote: <code>" + esc(r.instruction || "(none)") + "</code><audio controls preload=none src=\"" + esc(r.file) + "\"></audio>" : "<br><span class=bad>" + esc(r.error) + "</span>") + "</div>";
  });
  return h;
}

fs.mkdirSync(OUT, { recursive: true });
(function run(i, rows) {
  if (i >= PLAN.length) {
    fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(rows, null, 2));
    fs.writeFileSync(path.join(OUT, "index.html"), page(rows));
    var bad = rows.filter(function(r) { return !r.ok; }).length;
    console.log("\n" + (rows.length - bad) + " of " + rows.length + " takes saved. Listen: " + path.join(OUT, "index.html"));
    process.exit(bad ? 1 : 0);
    return;
  }
  var p = PLAN[i];
  take(p.label, p.text, p.extra).then(function(r) {
    r.group = p.group; r.note = p.note; r.text = p.text;
    console.log((r.ok ? "ok  " : "FAIL") + " " + p.label + "  " + r.ms + " ms" + (r.ok ? "  " + r.seconds + " s  instruction: " + (r.instruction || "(none)") : "  " + r.error));
    rows.push(r); run(i + 1, rows);
  });
})(0, []);
