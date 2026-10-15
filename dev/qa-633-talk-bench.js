// MANUAL QA — not run by dev/run-tests.js or CI (needs a local Chrome, Playwright from PLAYWRIGHT_PATH or the codex runtime cache, and the CX-5 bench checkout at CX5_BENCH, default C:/Projects/cx5-stereo-emulator); run by hand, and its receipt is the audit that cites it (#405).
'use strict';
// #633 — "Talk to your character", driven through the CX-5 bench over the owner's Frizwick save, the model and the microphone FAKED.
//   node dev/qa-633-talk-bench.js
// The bench (C:/Projects/cx5-stereo-emulator, server.cjs) serves THIS repo at http://127.0.0.1:18767/ with its head-unit shim injected
// before the first game script, so the game's Media Session, AudioContext routes and microphone opens are the modeled car's. Faked:
//   • the microphone — a recording SpeechRecognition (installed BEFORE the shim, so the shim wraps it as it wraps Chrome's) whose
//     __hear(text) fires a FINAL result then its own end: the test feeds speech into the LIVE recognizer the loop opened
//   • the cloud reader — api.speechify.ai answers silent PCM, so narration is WebAudio on the modeled route; every request is CAPTURED
//     with the voice id it carries (the wire is the ground truth for WHOSE voice read a line)
//   • the model — api.anthropic.com/v1/messages answers a canned Anthropic-shaped reply; every request body is CAPTURED (the persona
//     in `system`, the one user message), and the route can be told to answer 503
// The save is loaded through the game's OWN door (importSaveData — migrate, heal, saveAll) into a throwaway Chrome profile.
// QA633_ASSUME_FIELD_CLEARED=1 is a DIAGNOSTIC switch (the harness clears #action-input after each heard line — a simulated fix) so a run can get past a
// known defect and show what else holds; such a run exits 3 even when every line passes and is never a receipt.
// Receipts: testRuns/qa-633/ (gitignored) — screenshots of the bench and the page at each stage, and trace.json
//   {crumbs, benchRows, modelRequests, speechifyVoices, speaks}.
// What it proves (each a PASS/FAIL line; exit 1 on any FAIL): the picker lists the hero and no sheetless NPC; the greeting reaches
// Speechify in the CHARACTER's voice (catriona, against a narrator of narrator-x) while the head unit reads PLAYING and the loop then
// opens the mic by itself on hands-free; speech reaches the model as ONE message with the persona as the system, the reply is read in
// the character's voice and the mic reopens; a spoken pause holds, a head-unit PLAY is ignored while held, the tap releases; a failed
// model call is said in the NARRATOR's voice and the talk recovers; Escape closes and leaves worldState and memory byte-identical
// (usage aside) and Car Mode opens again on its own host.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/hannu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { spawn } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const BENCH = path.resolve(process.env.CX5_BENCH || 'C:/Projects/cx5-stereo-emulator');
const SAVE = path.join(ROOT, 'Campaigns', 'Frizwick_test', 'saves', 'Frizwick_Frizwick_t11.tnd');
const OUT = path.join(ROOT, 'testRuns', 'qa-633'); fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/\.(png|json)$/.test(f)) fs.unlinkSync(path.join(OUT, f));   // a receipt folder holds ONE run
const PORT = 18767, ORIGIN = 'http://127.0.0.1:' + PORT, PCM_SECONDS = 3;
const NARRATOR = 'narrator-x', CHARACTER = 'catriona';
const REPLIES = {
  ammut: 'Ammut? She is the floor under my feet. Why do you ask?',
  road: 'The road ahead is long, and I have walked worse.',
  safe: 'Safe enough while we are together. Ask me again at the gate?'
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
// rAF polling stalls in a background tab; every wait polls on a timer.
const until = (page, fn, arg, timeout) => page.waitForFunction(fn, arg, { polling: 100, timeout: timeout || 30000 });
async function untilNode(cond, timeout, what) {
  const end = Date.now() + (timeout || 30000);
  for (;;) { if (cond()) return; if (Date.now() > end) throw new Error('timed out waiting for ' + what); await sleep(100); }
}
const log = (ok, text) => console.log((ok ? 'PASS ' : 'FAIL ') + text);

/* Runs in the game page BEFORE the shim: a recording microphone. start() goes live; __hear(text) delivers a FINAL result then ends,
   exactly what a real recognizer does when the speaker stops; stop()/abort() end the listen. */
function fakeMic() {
  window.__fake = { live: null, made: 0 };
  function FakeRec() { this.lang = ''; this.continuous = false; this.interimResults = false; window.__fake.made++; }
  FakeRec.prototype.start = function () { const self = this; window.__fake.live = self; setTimeout(() => { if (self.onstart) self.onstart(); if (self.onaudiostart) self.onaudiostart(); }, 0); };
  FakeRec.prototype.stop = function () { const self = this; setTimeout(() => { if (window.__fake.live === self) window.__fake.live = null; if (self.onend) self.onend(); }, 0); };
  FakeRec.prototype.abort = FakeRec.prototype.stop;
  FakeRec.prototype.__hear = function (text) {
    const ev = { resultIndex: 0, results: [Object.assign([{ transcript: text, confidence: 0.9 }], { isFinal: true })] };
    if (this.onresult) this.onresult(ev);
    this.stop();
  };
  window.SpeechRecognition = FakeRec; window.webkitSpeechRecognition = FakeRec;
  if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.resolve({ getTracks: () => [{ stop() {} }], getAudioTracks: () => [{ stop() {} }] });
}

const decode = s => String(s).replace(/<[^>]*>/g, '').replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const CORS = { 'access-control-allow-origin': '*' };

(async () => {
  if (!fs.existsSync(SAVE)) throw new Error('the Frizwick save is not at ' + SAVE);
  const save = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
  const t0 = Date.now(), stamp = () => Date.now() - t0;
  const speechify = [];    // {n, at, voice, text}                       every Speechify synthesis request, in order
  const model = { mode: 'ok', delay: 0, reply: REPLIES.ammut, onceUsed: false, requests: [] };   // the canned model
  const errors = { bench: [], game: [] }, notes = [];
  let server, browser, game, bench, failed = false;
  const stderr = [];
  const shots = async label => {
    try { await game.screenshot({ path: path.join(OUT, label + '-page.png') }); await bench.screenshot({ path: path.join(OUT, label + '-bench.png'), fullPage: true }); }
    catch (e) { console.log('NOTE screenshot ' + label + ' failed: ' + e.message); }
  };
  async function step(name, fn) {
    try { await fn(); log(true, name); }
    catch (e) { failed = true; log(false, name); console.log(String(e && e.stack || e).split('\n').slice(0, 8).map(l => '     ' + l).join('\n')); await shots('FAIL-' + name.slice(0, 1)); throw new Error('stopped at the first failure: ' + name); }
  }
  // A soft check is a PASS/FAIL line that does not stop the drive: for a finding about the FEATURE (never patched here) the rest of the
  // drive is still worth running — it tells the owner what else holds. A failed soft check still fails the run.
  const soft = (ok, name, detail) => { if (!ok) failed = true; log(ok, name); if (!ok && detail) console.log('     ' + detail); };
  const headUnitPlays = async what => {   // does the head unit read PLAYING while the game's own TTS plays?
    await until(game, () => TTS.isPlaying(), undefined, 15000);
    const ok = await until(bench, () => document.getElementById('play-status').innerText === 'PLAYING', undefined, 2500).then(() => true, () => false);
    const d = await game.evaluate(() => ({ ttsPlaying: TTS.isPlaying(), playbackState: navigator.mediaSession.playbackState, tapGlyph: document.getElementById('car-tap-btn').innerHTML, status: document.getElementById('car-status').textContent }));
    return { ok, detail: what + ': ' + JSON.stringify(d) + ' · head unit says ' + JSON.stringify(await bench.locator('#play-status').innerText()) };
  };
  try {
    server = spawn(process.execPath, ['server.cjs'], { cwd: BENCH, env: { ...process.env, PORT: String(PORT), TND_ROOT: ROOT }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stderr.on('data', d => stderr.push(String(d)));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('the bench server did not start: ' + stderr.join(''))), 8000);
      server.stdout.once('data', () => { clearTimeout(timer); resolve(); });
      server.once('exit', code => { clearTimeout(timer); reject(Error('the bench server exited ' + code + ' ' + stderr.join(''))); });
    });

    browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, permissions: ['microphone'], serviceWorkers: 'block' });
    await context.route('**/*', async route => {
      const req = route.request(), u = new URL(req.url());
      if (u.hostname === 'api.speechify.ai' || u.hostname === 'api.anthropic.com') {
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...CORS, 'access-control-allow-methods': '*', 'access-control-allow-headers': req.headers()['access-control-request-headers'] || '*' } });
        if (u.hostname === 'api.speechify.ai') {
          const b = JSON.parse(req.postData() || '{}');
          speechify.push({ n: speechify.length + 1, at: Date.now(), ms: stamp(), voice: b.voice_id, text: decode(b.input || '') });
          return route.fulfill({ status: 200, contentType: 'audio/pcm', headers: CORS, body: Buffer.alloc(Math.round(24000 * 2 * PCM_SECONDS)) });
        }
        // the model: BYOK Anthropic — the body carries the persona as `system` and the messages
        const b = JSON.parse(req.postData() || '{}');
        const rec = { n: model.requests.length + 1, at: Date.now(), ms: stamp(), url: req.url(), mode: model.mode, model: b.model, max_tokens: b.max_tokens,
          system: typeof b.system === 'string' ? b.system : JSON.stringify(b.system), messages: b.messages, answered: null };
        model.requests.push(rec);
        if (model.delay) await sleep(model.delay);
        if (model.mode === 'fail' || (model.mode === 'once' && !model.onceUsed)) {
          model.onceUsed = true; rec.answered = '503';
          return route.fulfill({ status: 503, contentType: 'application/json', headers: CORS, body: JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'overloaded (bench)' } }) });
        }
        rec.answered = '200';
        return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ id: 'msg_bench', type: 'message', role: 'assistant', model: b.model, stop_reason: 'end_turn',
          content: [{ type: 'text', text: model.reply }], usage: { input_tokens: 900, output_tokens: 30 } }) });
      }
      if (u.origin !== ORIGIN) return route.abort();
      return route.continue();
    });

    bench = await context.newPage(); bench.on('pageerror', e => errors.bench.push(e.message));
    await bench.goto(ORIGIN + '/bench/'); await until(bench, () => window.__bench);
    game = await context.newPage(); game.on('pageerror', e => errors.game.push(e.message));
    game.on('console', m => { const t = m.text(); if (/\[talk\]|\[car\]/.test(t)) notes.push(m.type() + ': ' + t); });
    await game.addInitScript(fakeMic);
    await game.goto(ORIGIN + '/');
    await until(game, () => window.__carShim && typeof showTalkPicker === 'function' && typeof TTS !== 'undefined' && typeof STT !== 'undefined' && typeof importSaveData === 'function');
    await until(bench, () => window.__bench.state.gameId && document.getElementById('game-state').innerText.includes('connected'), undefined, 8000);

    // The save through the game's own load door; the model and the voice pointed at the fakes.
    await game.evaluate(({ data, narrator }) => {
      importSaveData(data);
      worldState.lastTurnAt = Date.now();   // the owner just played: Car Mode's own entry brief stays quiet at step 5
      providerKeys.anthropic = 'fixture'; activeProvider = 'anthropic'; apiKey = 'fixture'; gmRouting = 'byok';
      document.getElementById('api-screen').style.display = 'none'; showGame(); syncUI();
      const d = TTS.settings.draft(); d.primary = 'speechify'; d.keys.speechify = 'fixture';
      d.models.speechify.voices = [{ id: narrator, label: 'Narrator X', g: 'M' }]; d.models.speechify.narrator = narrator; TTS.settings.save(d);
      // every TTS.speak call and the map it carried — the ground truth for "which voice was asked for"
      window.__speaks = []; const orig = TTS.speak;
      TTS.speak = function (text, vid, map) { window.__speaks.push({ at: Date.now(), text: String(text), map: map ? JSON.parse(JSON.stringify(map)) : null }); return orig.apply(this, arguments); };
      const strip = () => { const c = JSON.parse(JSON.stringify(worldState)); delete c.usage; return JSON.stringify(c); };
      window.__snap = () => ({ ws: strip(), mem: JSON.stringify(memory), sl: JSON.stringify(sessionLog) });
      window.__before = window.__snap();
      // the import's own sticky toast ("Imported as a new campaign…") covers the status line in every screenshot; anything raised AFTER this is the talk's and is reported
      document.querySelectorAll('.tnd-toast').forEach(t => t.remove());
    }, { data: save, narrator: NARRATOR });
    const loaded = await game.evaluate(() => ({ hero: worldState.character.name, cls: worldState.character.cls, level: worldState.character.level, voiceId: worldState.character.voiceId,
      speechifyVoiceId: worldState.character.speechifyVoiceId, inworldVoiceId: worldState.character.inworldVoiceId, core: (worldState.character.coreMemories || []).length,
      npcs: (worldState.npcs || []).map(n => n.name + (n.partyMember ? '*' : '') + (n.charSheet ? '#' : '')), sessionLog: sessionLog.length, chapters: (memory.chapters || []).length }));
    assert.equal(loaded.hero, 'Frizwick'); assert.equal(loaded.speechifyVoiceId, CHARACTER); assert(loaded.sessionLog > 0, 'the save must carry a session log, or "no history rides" proves nothing');
    console.log('NOTE loaded: ' + JSON.stringify(loaded));

    const status = () => game.evaluate(() => document.getElementById('car-status').textContent);
    // The mic is open on a REAL listen (not the entry warm-up): a recognizer is live, STT says so, the loop painted "Listening…". On a timeout the
    // diagnosis rides the error: the status, the pending field the loop reads, the retry arm and the hold — why the loop did not open the mic.
    const listening = async timeout => {
      try { await until(game, () => window.__fake.live !== null && STT.isListening() && document.getElementById('car-status').textContent === 'Listening…', undefined, timeout || 25000); }
      catch (e) {
        const d = await game.evaluate(() => ({ status: document.getElementById('car-status').textContent, actionInput: document.getElementById('action-input').value, held: _carHeld, retryArmed: _carRetryArmed,
          busy: TALK_HOST.busy(), ttsPlaying: TTS.isPlaying(), sttListening: STT.isListening(), liveRecognizer: window.__fake.live !== null, carMode }));
        // what the player would do next when the status does not say "Listening…" (e.g. "Heard you — tap to send"): TAP, and see what the tap does
        const asked = model.requests.length; await game.click('#car-tap-btn'); await sleep(2500);
        d.afterTap = { newModelRequests: model.requests.length - asked, lastUserMessage: model.requests.length ? String(model.requests[model.requests.length - 1].messages[0].content).replace(/\s+/g, ' ').slice(0, 140) : null };
        throw new Error('the mic did not reopen: ' + JSON.stringify(d));
      }
    };
    // QA633_ASSUME_FIELD_CLEARED=1 simulates ONE fix in the harness so the rest of the drive can run past it: stt.js writes every final transcript
    // into #action-input, a talk host that takes the line as speech does not clear it, and _carAutoMic then reads that text as a "parked" utterance
    // and refuses to open the mic ("Heard you — tap to send"). With the flag the harness clears the field right after the line is taken. Default: off.
    const ASSUME_FIELD_CLEARED = process.env.QA633_ASSUME_FIELD_CLEARED === '1';
    if (ASSUME_FIELD_CLEARED) console.log('NOTE QA633_ASSUME_FIELD_CLEARED=1 — the HARNESS clears #action-input after each heard line (a simulated fix). This run is diagnostic only: it exits 3 even when every line passes.');
    const say = async text => {
      await game.evaluate(t => { const r = window.__fake.live; if (!r) throw new Error('no live recognizer to hear ' + JSON.stringify(t)); r.__hear(t); }, text);
      if (ASSUME_FIELD_CLEARED) { await sleep(250); await game.evaluate(() => { document.getElementById('action-input').value = ''; }); }
    };
    const crumbRing = () => game.evaluate(() => _erCrumbs.map(c => c.e + ' ' + c.d));
    const voicesSince = n => speechify.slice(n).map(r => r.voice);
    let tOpen = 0, hu1 = null, hu2 = null;

    // ── 1. the picker, the greeting in the character's own voice, the head unit, the mic by itself ──
    await step('1 the Talk door lists the hero first and no sheetless NPC; the greeting is read in the CHARACTER\'s voice; the loop opens the mic by itself on hands-free', async () => {
      const door = await game.evaluate(() => { const b = document.getElementById('fm-talk'); return b ? b.textContent : null; });
      assert(door && /Talk to/.test(door), 'the File menu row "Talk to…" is missing: ' + door);
      assert.equal(await game.evaluate(() => (worldState.npcs || []).some(n => n.name === 'Fen Marauder' && !n.charSheet)), true, 'the save must hold the sheetless NPC the picker must not list');
      await game.evaluate(() => document.getElementById('fm-talk').click());   // the File ▸ Talk to… row's own click → showTalkPicker()
      await game.waitForSelector('#talk-modal button.talk-pick', { timeout: 5000 });
      const picks = await game.$$eval('#talk-modal button.talk-pick', bs => bs.map(b => b.getAttribute('data-name')));
      assert.equal(picks[0], 'Frizwick', 'the hero is first: ' + JSON.stringify(picks));
      assert(!picks.includes('Fen Marauder'), 'a sheetless NPC is listed: ' + JSON.stringify(picks));
      console.log('NOTE picker lists: ' + JSON.stringify(picks));
      await game.screenshot({ path: path.join(OUT, '01-picker-page.png') });

      tOpen = Date.now();
      await game.locator('#talk-modal button.talk-pick', { hasText: 'Frizwick' }).click();
      await until(game, () => carMode === true);
      assert.equal(await game.evaluate(() => _carHost === TALK_HOST && !!_talk && _talk.name), 'Frizwick', 'the talk host is installed');
      await until(game, () => __carShim.session.metadata && __carShim.session.handlers.play);
      assert.equal(await game.evaluate(() => __carShim.session.metadata.title), 'Frizwick');
      assert.deepEqual((await game.evaluate(() => Object.keys(__carShim.session.handlers).filter(k => __carShim.session.handlers[k]))).sort(), ['nexttrack', 'pause', 'play', 'previoustrack']);
      assert.equal(await game.evaluate(() => localStorage.getItem('tnd_carmode_v1')), null, 'a talk never sets the Car Mode reload flag');

      await untilNode(() => speechify.some(r => r.at >= tOpen && /Frizwick/.test(r.text)), 25000, 'the greeting to reach Speechify');
      const greet = speechify.filter(r => r.at >= tOpen);
      assert(greet.length >= 1 && greet.every(r => r.voice === CHARACTER), 'the greeting must carry the character\'s voice (' + CHARACTER + '), narrator is ' + NARRATOR + ': ' + JSON.stringify(greet.map(r => [r.voice, r.text])));
      assert(greet.every(r => r.voice !== NARRATOR));
      hu1 = await headUnitPlays('during the greeting read');   // judged after the step's hard checks (a soft check: see below)
      await shots('02-greeting-playing');
      await listening(30000);
      await until(game, () => __carShim.snapshot().route === 'HFP · wideband');
      await until(bench, () => document.getElementById('play-status').innerText === 'VOICE SESSION');
      assert.equal(await game.evaluate(() => __carShim.press('play')), 'dropped', 'a head-unit PLAY under hands-free is a call control and is dropped by the car');
      assert.equal(await status(), 'Listening…');
      console.log('NOTE greeting reads: ' + JSON.stringify(greet.map(r => [r.voice, r.text])));
    });
    soft(hu1.ok, '1b the head unit reads PLAYING while the greeting is read', hu1.detail); if (hu1.ok) console.log('NOTE ' + hu1.detail);

    // ── 2. speech → the model (persona, one message) → the reply in the character's voice → the mic reopens ──
    await step('2 "how do you feel about Ammut": ONE model request with the persona and one user message; the reply is read in the character\'s voice; the record lands in Table Talk; the mic reopens', async () => {
      const sBefore = speechify.length; model.reply = REPLIES.ammut; model.delay = 1500;
      await say('how do you feel about Ammut');
      await untilNode(() => model.requests.length === 1, 15000, 'the first model request');
      const mid = await game.evaluate(() => ({ busy: TALK_HOST.busy(), tapDisabled: document.getElementById('car-tap-btn').disabled, status: document.getElementById('car-status').textContent,
        tt: document.getElementById('story-tabletalk').textContent }));
      assert.equal(mid.busy, true, 'busy across the call'); assert.equal(mid.tapDisabled, true, 'the tap yields while the line is out');
      assert(/^Thinking… \d+s$/.test(mid.status), 'the wait counts its seconds (#356): ' + JSON.stringify(mid.status));
      assert(/You:\s*how do you feel about Ammut/i.test(mid.tt), 'the question is on the record at once: ' + mid.tt);
      const rq = model.requests[0];
      assert.equal(rq.url, 'https://api.anthropic.com/v1/messages'); assert.equal(rq.max_tokens, 220);
      assert.equal(typeof rq.system, 'string', 'a plain-string system: the private persona, not the GM prompt');
      for (const s of ['WHO YOU ARE', 'Ammut: Wife', 'WHAT YOU MUST NOT DO']) assert(rq.system.includes(s), 'the persona lacks "' + s + '"');
      assert(!/\[SAY|STATE TAGS|worldState/.test(rq.system), 'no GM machinery rides the persona');
      assert.equal(rq.messages.length, 1, 'exactly ONE message rides — the ' + loaded.sessionLog + '-entry session log is not sent: ' + JSON.stringify(rq.messages.map(m => m.role)));
      assert.equal(rq.messages[0].role, 'user'); assert(/how do you feel about ammut/i.test(rq.messages[0].content), 'the user content carries the question: ' + rq.messages[0].content);
      assert(!/Earlier in this conversation/.test(rq.messages[0].content), 'the first exchange has no earlier lines');
      model.delay = 0;
      await untilNode(() => speechify.slice(sBefore).some(r => /floor under my feet/.test(r.text)), 20000, 'the reply to reach Speechify');
      const reply = speechify.slice(sBefore);
      assert(reply.every(r => r.voice === CHARACTER), 'the reply is read in the character\'s voice: ' + JSON.stringify(reply.map(r => [r.voice, r.text])));
      assert(model.requests.length === 1, 'speech asked the model once');
      hu2 = await headUnitPlays('during the reply read');   // a soft check, judged after the step
      const after = await game.evaluate(() => ({ tt: document.getElementById('story-tabletalk').textContent, crumbs: _erCrumbs.map(c => c.e + ' ' + c.d), talkCalls: worldState.usage && worldState.usage.byKind && worldState.usage.byKind.talk && worldState.usage.byKind.talk.calls,
        sl: sessionLog.length, sent: typeof sendAction === 'function' }));
      assert(/Frizwick:\s*Ammut\? She is the floor under my feet/.test(after.tt), 'the reply is on the Table Talk record: ' + after.tt);
      assert(after.crumbs.some(c => /^talk #1 \d+ms$/.test(c)), 'the talk crumb: ' + JSON.stringify(after.crumbs.slice(-8)));
      assert.equal(after.talkCalls, 1, 'the call accounts itself in its own usage bucket "talk"');
      assert.equal(after.sl, loaded.sessionLog, 'the session log is untouched');
      await shots('03-reply');
      await listening(30000);   // the reply's read ends → the mic reopens by itself
      console.log('NOTE reply reads: ' + JSON.stringify(reply.map(r => [r.voice, r.text])));
    });
    soft(hu2.ok, '2b the head unit reads PLAYING while the reply is read', hu2.detail); if (hu2.ok) console.log('NOTE ' + hu2.detail);

    // ── 3. hold: a spoken pause, the head-unit PLAY ignored, the tap releases ──
    await step('3 "gm pause" holds the talk; a head-unit PLAY lands as "media-action play held"; the tap releases and the mic reopens', async () => {
      await say('gm pause');
      await until(game, () => _carHeld === true && window.__fake.live === null, undefined, 8000);
      assert.match(await status(), /Paused — say resume, or tap/);
      await until(game, () => __carShim.snapshot().phase === 'idle', undefined, 8000);
      const n = (await crumbRing()).length;
      await bench.locator('#play').click();
      await until(game, c => _erCrumbs.some(x => x.e === 'media-action' && /^play held/.test(x.d)), n, 5000);
      assert((await crumbRing()).some(c => /^media-action play held/.test(c)), 'a PLAY while held lands as "media-action play held": ' + JSON.stringify(await crumbRing()));
      assert.equal(await game.evaluate(() => window.__fake.live), null, 'the hold kept the mic closed through the head-unit PLAY');
      await shots('04-held');
      await game.click('#car-tap-btn');
      await until(game, () => _carHeld === false, undefined, 5000);
      await listening(20000);
    });

    // ── 4a. the model's one 503 is absorbed by callGM's own retry; 4. a persistent failure is loud, in the NARRATOR's voice; 4b. the talk recovers ──
    await step('4a a single 503 is absorbed by callGM\'s retry — the line is still answered in the character\'s voice and no talk-error is crumbed', async () => {
      const sBefore = speechify.length, mBefore = model.requests.length;
      model.mode = 'once'; model.onceUsed = false; model.reply = REPLIES.road;
      await say('what do you make of the road ahead');
      await untilNode(() => speechify.slice(sBefore).some(r => /walked worse/.test(r.text)), 30000, 'the retried line to be answered');
      const reqs = model.requests.slice(mBefore);
      assert.deepEqual(reqs.map(r => r.answered), ['503', '200'], 'one 503 then the answer: ' + JSON.stringify(reqs.map(r => r.answered)));
      assert(/Earlier in this conversation:[\s\S]*Player: how do you feel about Ammut[\s\S]*You: Ammut\? She is the floor/.test(reqs[1].messages[0].content), 'the kept exchange rides the next ask, as one message: ' + reqs[1].messages[0].content);
      assert.equal(reqs[1].messages.length, 1);
      assert(speechify.slice(sBefore).every(r => r.voice === CHARACTER), 'answered in the character\'s voice: ' + JSON.stringify(voicesSince(sBefore)));
      assert(!(await crumbRing()).some(c => /^talk-error/.test(c)), 'an absorbed 503 is not a failure');
      model.mode = 'ok';
      await listening(30000);
    });
    await step('4 a failing model route: "are we safe" → a talk-error crumb, "Thinking… Ns" counting, the notice read in the NARRATOR voice, "say it again, or tap" on the status', async () => {
      const sBefore = speechify.length, mBefore = model.requests.length;
      model.mode = 'fail';
      await say('are we safe');
      await until(game, () => /^Thinking… \d+s$/.test(document.getElementById('car-status').textContent), undefined, 10000);
      await until(game, () => _erCrumbs.some(c => c.e === 'talk-error'), undefined, 40000);
      const err = (await crumbRing()).find(c => /^talk-error/.test(c));
      assert(/HTTP 503/.test(err), 'the reason is attributable: ' + err);
      assert(model.requests.length - mBefore >= 2 && model.requests.slice(mBefore).every(r => r.answered === '503'), 'callGM retried before giving up: ' + JSON.stringify(model.requests.slice(mBefore).map(r => r.answered)));
      await until(game, () => document.getElementById('car-status').textContent.includes('say it again, or tap'), undefined, 5000);
      assert.equal(await game.evaluate(() => _carRetryArmed), true, 'the tap is armed to retry');
      await untilNode(() => speechify.slice(sBefore).some(r => /The line dropped/.test(r.text)), 20000, 'the notice to reach Speechify');
      const notice = speechify.slice(sBefore).filter(r => /The line dropped/.test(r.text));
      assert(notice.every(r => r.voice === NARRATOR), 'the notice is read in the NARRATOR\'s voice (' + NARRATOR + '), never the character\'s: ' + JSON.stringify(notice.map(r => [r.voice, r.text])));
      assert(!speechify.slice(sBefore).some(r => r.voice === CHARACTER), 'no line of the failed exchange is read in the character\'s voice');
      const tt = await game.evaluate(() => document.getElementById('story-tabletalk').textContent);
      assert(/No answer \(HTTP 503/.test(tt), 'the failure is on the record too: ' + tt);
      await shots('05-error');
      console.log('NOTE notice reads: ' + JSON.stringify(notice.map(r => [r.voice, r.text])) + ' · crumb: ' + err);
    });
    await step('4b the talk recovers: after the notice the mic reopens and the next "are we safe" is answered in the character\'s voice', async () => {
      model.mode = 'ok'; model.reply = REPLIES.safe;
      await listening(40000);
      const sBefore = speechify.length;
      await say('are we safe');
      await untilNode(() => speechify.slice(sBefore).some(r => /Safe enough/.test(r.text)), 20000, 'the recovered answer to reach Speechify');
      assert(speechify.slice(sBefore).every(r => r.voice === CHARACTER), 'answered in the character\'s voice: ' + JSON.stringify(voicesSince(sBefore)));
      await listening(30000);
    });

    // ── 5. Escape: clean close, the campaign untouched, Car Mode on its own host again ──
    await step('5 Escape closes the talk (handlers cleared, CAR_HOST restored); worldState and memory are byte-identical; Car Mode still opens on its own host and closes', async () => {
      await game.keyboard.press('Escape');
      await until(game, () => carMode === false && window.__fake.live === null, undefined, 8000);
      await until(game, () => __carShim.snapshot().phase === 'idle', undefined, 8000);
      assert.equal(await game.evaluate(() => Object.keys(__carShim.session.handlers).filter(k => __carShim.session.handlers[k]).length), 0, 'the four handlers are cleared at close');
      const st = await game.evaluate(() => ({ host: _carHost === CAR_HOST, talk: _talk, speaking: TTS.isPlaying(), flag: localStorage.getItem('tnd_carmode_v1') }));
      assert.equal(st.host, true, '_carHost === CAR_HOST'); assert.equal(st.talk, null, '_talk is cleared'); assert.equal(st.flag, null, 'no reload-survival flag was ever set');
      const same = await game.evaluate(() => { const a = window.__snap(), b = window.__before, first = (x, y) => { let i = 0; while (i < x.length && x[i] === y[i]) i++; return { at: i, was: y.slice(Math.max(0, i - 40), i + 80), now: x.slice(Math.max(0, i - 40), i + 80) }; };
        return { ws: a.ws === b.ws ? true : first(a.ws, b.ws), mem: a.mem === b.mem ? true : first(a.mem, b.mem), sl: a.sl === b.sl ? true : first(a.sl, b.sl) }; });
      assert.equal(same.ws, true, 'worldState (usage aside) changed during the talk: ' + JSON.stringify(same.ws));
      assert.equal(same.mem, true, 'memory changed during the talk: ' + JSON.stringify(same.mem));
      assert.equal(same.sl, true, 'the session log changed during the talk: ' + JSON.stringify(same.sl));
      await shots('06-closed');

      const mBefore = model.requests.length;
      await game.evaluate(() => showCarMode());
      await until(game, () => carMode === true && __carShim.session.metadata, undefined, 8000);
      const car = await game.evaluate(() => ({ host: _carHost === CAR_HOST, name: document.getElementById('car-name').textContent, vitals: document.getElementById('car-vitals').textContent,
        title: __carShim.session.metadata.title, flag: !!localStorage.getItem('tnd_carmode_v1'), hear: CAR_HOST.hear('I walk north'), cmd: carVoiceCommand('I walk north'), party: document.getElementById('car-party').children.length }));
      assert.equal(car.host, true, 'Car Mode runs on CAR_HOST again'); assert.equal(car.name, 'Frizwick'); assert(/^HP \d+\/\d+/.test(car.vitals), 'Car Mode paints the hero\'s vitals line: ' + car.vitals);
      assert.equal(car.title, 'Frizwick'); assert.equal(car.flag, true, 'Car Mode sets its own reload flag');
      assert.equal(car.hear, false, 'in Car Mode plain speech is left to stt.js (a GM turn)'); assert.equal(car.cmd, false);
      assert.equal(model.requests.length, mBefore, 'Car Mode speech never asks the talk model');
      await shots('07-carmode');
      await game.evaluate(() => hideCarMode());
      await until(game, () => carMode === false, undefined, 5000);
      assert.equal(await game.evaluate(() => localStorage.getItem('tnd_carmode_v1')), null, 'closing Car Mode clears its flag');
    });
    assert.deepEqual(errors, { bench: [], game: [] }, 'uncaught page errors');
    log(true, 'zero uncaught errors in either page');

    // Attribution, not a check: does plain Car Mode (the game's own host, the loop's entry brief) show the head unit PLAYING while it reads?
    // Same probe as 1b/2b, with the entry brief forced (a stale lastTurnAt) — so a 1b/2b finding can be placed on the talk or on the loop.
    await game.evaluate(() => { worldState.lastTurnAt = 0; showCarMode(); });
    const plain = await headUnitPlays('plain Car Mode entry brief (CAR_HOST)').catch(e => ({ ok: false, detail: 'plain Car Mode read no brief: ' + e.message }));
    console.log('NOTE attribution — ' + plain.detail);
    await game.evaluate(() => hideCarMode());
  } catch (e) {
    failed = true;
    if (!/^stopped at the first failure/.test(String(e && e.message))) console.log('FAIL ' + String(e && e.stack || e));
  } finally {
    // the trace — written even on a failure, it is the receipt
    try {
      const reads = game ? await game.evaluate(() => window.__speaks || []).catch(() => []) : [];
      const toasts = game ? await game.evaluate(() => Array.from(document.querySelectorAll('.tnd-toast')).map(t => t.textContent)).catch(() => []) : [];
      const benchRows = game ? await game.evaluate(() => __carShim.rows().map(r => ({ t: r.t, source: r.source, event: r.event, value: r.value == null ? '' : String(r.value) }))).catch(() => []) : [];
      const crumbs = benchRows.filter(r => r.source === 'game').map(r => r.event + ' ' + r.value);
      // per read: the Speechify voice ids that read's requests carried (a request belongs to the latest read that began before it)
      const perRead = reads.map((r, i) => {
        const end = i + 1 < reads.length ? reads[i + 1].at : Infinity;
        const reqs = speechify.filter(s => s.at >= r.at && s.at < end);
        return { read: i + 1, text: r.text, mapProviders: r.map && r.map.providers || null, mapUnits: r.map ? Object.keys(r.map).filter(k => /^\d+$/.test(k)).length : 0, voices: [...new Set(reqs.map(s => s.voice))], requests: reqs.length };
      });
      fs.writeFileSync(path.join(OUT, 'trace.json'), JSON.stringify({ when: new Date().toISOString(), crumbs, benchRows, modelRequests: model.requests, speechifyVoices: speechify, speaks: perRead, notes, toasts, errors }, null, 2));
      console.log('\nSpeechify voice per read (narrator = ' + NARRATOR + ', character = ' + CHARACTER + '):');
      perRead.forEach(r => console.log('  read ' + r.read + ': ' + JSON.stringify(r.voices) + ' x' + r.requests + ' req — map' + (r.mapProviders ? ' providers=' + JSON.stringify(r.mapProviders) : ' none') + ' — ' + JSON.stringify(r.text.length > 70 ? r.text.slice(0, 70) + '…' : r.text)));
      if (model.requests[0]) console.log('\nPersona (first 300 chars of the first model request\'s system):\n' + model.requests[0].system.slice(0, 300));
      console.log('\nToasts left on screen at the end (none expected): ' + JSON.stringify(toasts));
      if (notes.length) console.log('\nGame notes:\n  ' + notes.join('\n  '));
      console.log('\nReceipts: ' + OUT);
    } catch (e) { console.log('NOTE trace not written: ' + e.message); }
    if (browser) await browser.close().catch(() => {});
    if (server) server.kill();
  }
  if (failed) process.exitCode = 1; else if (process.env.QA633_ASSUME_FIELD_CLEARED === '1') { console.log('SIMULATED FIX in use — exit 3 on purpose: this is not a receipt for the real stack.'); process.exitCode = 3; }
})().catch(e => { console.error(e); process.exitCode = 1; });
