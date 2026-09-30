// dev/car-driver.js — the CAR MODE DRIVER (#481 E8 verification, owner 2026-09-29; it also serves E9 and the #474 device
// checks). MANUAL QA — not run by dev/run-tests.js or CI. The real game in a system Chrome (dev/cdp-browser.js: the repo
// served from disk on a fake origin, a fresh profile, no server, no network, no spend), Car Mode entered through its own
// entry, and the transport driven where a car reaches it:
//   press(kind)   a head-unit command — the Media Session action handler the page registered for play | pause | nexttrack |
//                 previoustrack, called exactly as the browser's own dispatch calls it. An init script captures each handler
//                 at registration; the real navigator.mediaSession still receives it.
//   say(text)     a spoken command, entering where stt.js hands over a final transcript: carVoiceCommand(text).
//   tap()         the big button (_carTap).
//   narrate(t)    a GM narration through the real speak path (TTS.speakResponse) on the Speechify cloud reader, whose
//                 endpoint is routed to silent PCM (PCM_SECONDS per request). Headless audio is muted; the clock still runs.
//   state()       { tts, held, mic, status } — logged after every step with the crumbs it landed, so a run reads as a
//                 transcript of the game's transitions.
// The microphone is a recording fake (SpeechRecognition + getUserMedia): every open is logged with whether narration was
// playing at that instant (the E9 observation).
//   node dev/car-driver.js [scenario ...]     (default: every scenario; exits non-zero on a failed expectation)
// Writes a receipt (the transcript of every scenario) to QA_OUT (default: the OS temp dir).
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const { chromium } = require("./cdp-browser.js");
const root = path.resolve(__dirname, "..");
const PCM_SECONDS = 1.5, ORIGIN = "qa.test";

/* Runs in the page before any game script: the handler capture and the recording microphone. */
function carInit() {
  window.__car = { handlers: {}, mic: [] };
  const ms = navigator.mediaSession, real = ms && ms.setActionHandler ? ms.setActionHandler.bind(ms) : null;
  if (ms) ms.setActionHandler = function (kind, fn) { window.__car.handlers[kind] = fn; if (real) { try { real(kind, fn); } catch (e) {} } };
  const playing = () => !!(window.TTS && TTS.isPlaying && TTS.isPlaying());
  function FakeRec() { this.lang = ""; this.continuous = false; this.interimResults = false; }
  FakeRec.prototype.start = function () { const self = this; window.__car.mic.push({ kind: "recognizer", ttsPlaying: playing() }); setTimeout(function () { if (self.onstart) self.onstart(); if (self.onaudiostart) self.onaudiostart(); }, 0); };
  FakeRec.prototype.stop = function () { const self = this; setTimeout(function () { if (self.onend) self.onend(); }, 0); };
  FakeRec.prototype.abort = FakeRec.prototype.stop;
  window.SpeechRecognition = FakeRec; window.webkitSpeechRecognition = FakeRec;
  if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = function () {
    window.__car.mic.push({ kind: "getUserMedia", ttsPlaying: playing() });
    return Promise.resolve({ getTracks: () => [{ stop() {} }], getAudioTracks: () => [{ stop() {} }] });
  };
}

async function openCar(opts) {
  opts = opts || {};
  const engine = require(root + "/dev/load-engine.js"); engine.loadEngine(); engine.makeTestWorld({ kind: "adventure" });
  const fixture = JSON.parse(JSON.stringify({ world: worldState, memory }));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined), headless: true });
  const context = await browser.newContext({ viewport: { width: 420, height: 860 }, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [], log = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/*", async route => {
    const u = new URL(route.request().url());
    if (u.hostname === "api.speechify.ai") return route.fulfill({ status: 200, contentType: "audio/pcm", body: Buffer.alloc(Math.round(24000 * 2 * PCM_SECONDS)) });
    if (u.hostname !== ORIGIN) return route.abort();
    const f = path.resolve(root, "." + decodeURIComponent(u.pathname));
    if (!f.startsWith(root + path.sep)) return route.abort();
    try { await route.fulfill({ status: 200, contentType: f.endsWith(".html") ? "text/html" : f.endsWith(".js") ? "application/javascript" : f.endsWith(".css") ? "text/css" : "application/json", body: fs.readFileSync(f) }); }
    catch (e) { await route.fulfill({ status: 404, body: "Not found" }); }
  });
  await page.addInitScript(carInit);
  await page.goto("http://" + ORIGIN + "/index.html");
  await page.waitForFunction(() => typeof showCarMode === "function" && typeof TTS !== "undefined" && typeof STT !== "undefined");
  await page.evaluate(f => {
    worldState = f.world; memory = f.memory; sessionLog = []; worldState.lastTurnAt = Date.now();   /* fresh: no scene brief */
    document.getElementById("api-screen").style.display = "none"; showGame(); syncUI();
    const d = TTS.settings.draft(); d.primary = "speechify"; d.keys.speechify = "fixture";
    d.models.speechify.voices = [{ id: "a", label: "A", g: "F" }]; d.models.speechify.narrator = "a"; TTS.settings.save(d);
    /* the options the post-narration loop reads (#78) — the last narrator message's numbered buttons */
    document.getElementById("story-narrative").insertAdjacentHTML("beforeend", "<div class='msg narrator'>The gate.<div><button class='qa' data-action='Knock on the gate'>Knock</button><button class='qa' data-action='Wait in the rain'>Wait</button></div></div>");
  }, fixture);
  let seenCrumbs = 0, seenMic = 0, t0 = Date.now();
  const car = {
    page, browser, errors, log,
    state: () => page._eval("JSON.stringify({tts:TTS.isPlaying()?'playing':TTS.isPaused()?'paused':'idle',held:!!_carHeld,mic:!!STT.isListening(),status:(document.getElementById('car-status')||{}).textContent||''})").then(JSON.parse),
    async step(label, expr, gesture) {
      if (expr) await page._eval(expr, !!gesture);
      await page.waitForTimeout(250);
      const s = await car.state();
      const crumbs = await page._eval("JSON.stringify(_erCrumbs.map(function(c){return c.e+' '+c.d;}))").then(JSON.parse);
      const mic = await page._eval("JSON.stringify(window.__car.mic)").then(JSON.parse);
      const line = { t: ((Date.now() - t0) / 1000).toFixed(1) + "s", step: label, tts: s.tts, held: s.held, mic: s.mic, status: s.status,
        crumbs: crumbs.slice(seenCrumbs).filter(c => /^media-action|^car-/.test(c)), micOpens: mic.slice(seenMic) };
      seenCrumbs = crumbs.length; seenMic = mic.length;
      log.push(line);
      console.log("  " + line.t.padStart(6) + "  " + label.padEnd(34) + " tts=" + line.tts.padEnd(7) + " held=" + String(line.held).padEnd(5) + " mic=" + String(line.mic).padEnd(5) + " \"" + line.status + "\"" +
        (line.crumbs.length ? "  crumbs: " + line.crumbs.join(", ") : "") + (line.micOpens.length ? "  mic opened: " + line.micOpens.map(m => m.kind + (m.ttsPlaying ? " DURING narration" : "")).join(", ") : ""));
      return line;
    },
    enter: () => car.step("enter Car Mode", "showCarMode()", true),
    narrate: text => car.step("narrate", "TTS.speakResponse(" + JSON.stringify(text) + ")", true),
    press: kind => car.step("car sends " + kind.toUpperCase(), "window.__car.handlers[" + JSON.stringify(kind) + "]({action:" + JSON.stringify(kind) + "})"),
    say: text => car.step("say \"" + text + "\"", "carVoiceCommand(" + JSON.stringify(text) + ")"),
    tap: () => car.step("tap", "_carTap()", true),
    until: async (label, expr, ms) => { await page.waitForFunction(expr, undefined, { timeout: ms || 15000 }); return car.step(label); },
    close: () => browser.close()
  };
  return car;
}

function expect(line, want, failures, scenario) {
  Object.keys(want).forEach(k => {
    const got = k === "crumb" ? line.crumbs.some(c => c.indexOf(want[k]) === 0) : line[k];
    const ok = k === "crumb" ? got : got === want[k];
    if (!ok) failures.push(scenario + " / " + line.step + ": expected " + k + " " + JSON.stringify(want[k]) + ", got " + JSON.stringify(k === "crumb" ? line.crumbs : got));
  });
}

/* Each scenario drives one scripted sequence and states what the game must do at each step. */
const SCENARIOS = {
  /* #481 E8, the owner's example: the driver holds the session with a spoken "pause"; a call ends and the car sends PLAY
     by itself. Nothing may replay; every transport command is a no-op while held; "resume" releases, then PLAY works. */
  "e8-held-play": async (car, fail) => {
    await car.enter();
    await car.narrate("Rain drums on the gatehouse roof while the guard counts coins.");
    await car.until("narration + options done, mic open", "STT.isListening()");
    expect(await car.say("pause"), { held: true, mic: false, tts: "idle" }, fail, "e8-held-play");
    expect(await car.press("play"), { tts: "idle", held: true, crumb: "media-action play held" }, fail, "e8-held-play");
    expect(await car.press("nexttrack"), { tts: "idle", held: true, crumb: "media-action next held" }, fail, "e8-held-play");
    expect(await car.press("previoustrack"), { tts: "idle", held: true, crumb: "media-action prev held" }, fail, "e8-held-play");
    expect(await car.press("pause"), { tts: "idle", held: true, crumb: "media-action pause held" }, fail, "e8-held-play");
    expect(await car.say("resume"), { held: false }, fail, "e8-held-play");
    await car.step("mic closes (driver silent)", "STT.cancel()");
    expect(await car.press("play"), { tts: "playing", held: false, crumb: "media-action play idle" }, fail, "e8-held-play");
  },
  /* #481 E8 with narration: a car PAUSE and PLAY stay idempotent (#19) while nothing is held; a spoken "pause" mid-read
     pauses AND holds, the car's own PLAY then leaves the read paused, and the tap releases. */
  "e8-paused-read": async (car, fail) => {
    await car.enter();
    await car.until("entry settled, mic open", "STT.isListening()");
    await car.step("mic closes (driver silent)", "STT.cancel()");
    await car.narrate("The guard lifts his lantern. Beyond him the road bends into the dark. Somewhere a dog barks twice and stops.");
    expect(await car.press("pause"), { tts: "paused", held: false }, fail, "e8-paused-read");
    expect(await car.press("play"), { tts: "playing", held: false }, fail, "e8-paused-read");
    expect(await car.say("pause"), { tts: "paused", held: true }, fail, "e8-paused-read");
    expect(await car.press("play"), { tts: "paused", held: true, crumb: "media-action play held" }, fail, "e8-paused-read");
    expect(await car.tap(), { held: false }, fail, "e8-paused-read");
  }
};

async function main() {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENARIOS);
  const out = process.env.QA_OUT || path.join(os.tmpdir(), "tnd-car-driver"); fs.mkdirSync(out, { recursive: true });
  const receipt = { at: new Date().toISOString(), pcmSeconds: PCM_SECONDS, scenarios: {} }, failures = [];
  for (const name of names) {
    if (!SCENARIOS[name]) { failures.push("unknown scenario " + name); continue; }
    console.log("== " + name);
    const car = await openCar();
    try { await SCENARIOS[name](car, failures); }
    catch (e) { failures.push(name + ": " + (e && e.message || e)); }
    finally { receipt.scenarios[name] = { log: car.log, pageErrors: car.errors }; if (car.errors.length) failures.push(name + ": page errors " + JSON.stringify(car.errors)); await car.close(); }
  }
  receipt.failures = failures;
  fs.writeFileSync(path.join(out, "receipt.json"), JSON.stringify(receipt, null, 2));
  console.log(failures.length ? "CAR DRIVER: " + failures.length + " failed expectation(s)\n  " + failures.join("\n  ") : "CAR DRIVER GREEN — " + names.length + " scenario(s)");
  console.log("receipt: " + path.join(out, "receipt.json"));
  process.exitCode = failures.length ? 1 : 0;
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { openCar, SCENARIOS };
