// tests-502-ambience-insecure-page.js — #502: ambience on a page that is not a secure context.
// A browser exposes SubtleCrypto only on https or localhost. On plain http (the game served to a phone over the LAN, a
// real-browser test host) `crypto.subtle` is undefined, so the audio checksum threw a TypeError and the player saw
// "Ambience: Cannot read properties of undefined (reading 'digest')" — after every scene had downloaded its audio for nothing.
// The page now says what is wrong, once, and downloads nothing. The checksum is never skipped.
//   node dev/tests-502-ambience-insecure-page.js
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm'), webcrypto = require('crypto').webcrypto;
const root = path.resolve(__dirname, '..'), src = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS #502 ' + name); } catch (e) { failed++; console.error('FAIL #502 ' + name + ' — ' + (e && e.message || e)); } }
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(r => setTimeout(r, 0)); };

// The loader files in a bare realm: `crypto` exists only when the test hands one in (a vm context has no web crypto of its own).
function loaderScope(cryptoObj) {
  const scope = { console, Promise, Uint8Array, AbortController, setTimeout, clearTimeout };
  if (cryptoObj !== undefined) scope.crypto = cryptoObj;
  vm.createContext(scope);
  for (const f of ['audio-catalog.js', 'audio-scenes.js', 'ambient.js', 'audio-loader.js']) vm.runInContext(src(f), scope, { filename: f });
  return scope;
}
const body = bytes => new ReadableStream({ start(c) { c.enqueue(bytes); c.close(); } });

// ui-ambient.js with recording stand-ins (the tests-audit-voice.js loadAmbient pattern). `page` picks the protocol and the crypto.
function ambientShell(page) {
  const listeners = {}, toasts = [], status = { textContent: '', style: {} }, counts = { contexts: 0, loaders: 0, controllers: 0 };
  const doc = {
    hidden: false, addEventListener(n, f) { (listeners[n] = listeners[n] || []).push(f); },
    fire(n, e) { (listeners[n] || []).slice().forEach(f => f(e || {})); },
    getElementById: () => ({ style: { display: 'flex' } })
  };
  const ctx = { state: 'running', currentTime: 0, resume() { return Promise.resolve(); } };
  const el = () => ({ style: {}, addEventListener() {}, checked: false, value: 0 });
  const deps = {
    window: doc, document: doc, location: { protocol: page.protocol },
    audioPageRefusal: loaderScope(page.crypto).audioPageRefusal,   // the loader's own rule, in a realm with this page's crypto (or none)
    localStorage: { getItem: k => (k === 'tnd_ambient_enabled_v1' ? '1' : '0.45'), setItem() {} },
    eachMenuEl(key, fn) { fn(key === 'ambient-status' ? status : el()); },
    showToast(m) { toasts.push(String(m)); },
    Sound: { context() { counts.contexts++; return ctx; } },
    Promise, console: { warn() {}, info() {}, log() {} }, Object, Math, Number, String, JSON, AbortController, Error,
    TTS: { isPlaying: () => false, isPaused: () => false, on: () => function () {} }, STT: { on: () => function () {} },
    navigator: {}, setTimeout, clearTimeout,
    audioPublishedScene: { campaignId: 'one', nodeKey: null }, audioScenePublish() {},
    ambientPlan: () => ({ scene: null, gain: 0 }), AUDIO_SCENES: [], AUDIO_CATALOG: { assets: [] },
    createAudioLoader() { counts.loaders++; return { load() { return Promise.resolve({}); }, release() {}, inspect: () => ({ reservedDecodes: 0 }) }; },
    createAmbientController() { counts.controllers++; return { update() {}, retry() {}, dispose() {}, inspect: () => ({ pending: 0, sources: 0, buffers: 0 }) }; },
    createAccentController() { return { update() {}, shed() {}, dispose() {}, inspect: () => ({}) }; }
  };
  const names = Object.keys(deps);
  const app = new Function(...names, src('ui-ambient.js') + '\n;return Ambient;')(...names.map(k => deps[k]));
  return { app, doc, toasts, status, counts };
}

(async () => {
  const secure = loaderScope(webcrypto), insecure = loaderScope(undefined);
  const REASON = typeof secure.audioVerifyRefusal === 'function' ? secure.audioVerifyRefusal(null) : null;

  await test('the rule: a page without SubtleCrypto cannot verify audio, and the reason is plain words', async () => {
    assert.equal(typeof secure.audioVerifyRefusal, 'function', 'audioVerifyRefusal is the one rule (audio-loader.js)');
    assert.equal(secure.audioPageRefusal(), null, 'asked about a secure page: fine'); assert.equal(insecure.audioPageRefusal(), REASON, 'asked about a page with no crypto at all: the reason');
    assert.equal(secure.audioVerifyRefusal(webcrypto), null, 'a secure page can verify');
    for (const c of [undefined, null, {}, { subtle: {} }, { subtle: null }]) assert.equal(secure.audioVerifyRefusal(c), REASON, 'no digest to call: ' + JSON.stringify(c));
    assert.match(REASON, /not secure/i, 'it says what is wrong: ' + REASON);
    assert.match(REASON, /hosted game|https/i, 'and where ambience does work: ' + REASON); assert.match(REASON, /localhost/i);
    assert.ok(!/undefined|digest|properties/i.test(REASON), 'no engine words: ' + REASON);
  });

  await test('the checksum on an insecure page is a rejected promise with that reason — never a thrown TypeError, never a pass', async () => {
    let p; assert.doesNotThrow(() => { p = insecure.audioVerifyBytes(new Uint8Array([1, 2, 3]).buffer, { sha256: '00' }); }, 'it must not throw synchronously');
    await assert.rejects(p, e => { assert.equal(e.message, REASON); return true; });
  });

  await test('the loader refuses BEFORE it downloads: no fetch, no decode, nothing left reserved', async () => {
    const scene = insecure.AUDIO_CATALOG.assets[0]; let fetches = 0, decodes = 0;
    insecure.fetch = async () => { fetches++; return { ok: true, headers: { get: () => null }, body: body(new Uint8Array([1, 2, 3])) }; };
    const loader = insecure.createAudioLoader({ decodeAudioData: (b, ok) => { decodes++; ok({}); } }, insecure.AUDIO_CATALOG);
    await assert.rejects(loader.load(scene, new AbortController().signal), e => { assert.equal(e.message, REASON); return true; });
    assert.equal(fetches, 0, 'the audio must not be downloaded only to be thrown away'); assert.equal(decodes, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(loader.inspect())), { decodedBytes: 0, reservedDecodes: 0, bufferRecords: 0 }, 'no reservation survives the refusal');
    await assert.rejects(loader.load(scene, new AbortController().signal), e => e.message === REASON, 'and the next scene is refused the same way, not with "still settling"');
  });

  await test('on a secure page nothing changed: the real file verifies, and a wrong one is still refused (the checksum is never skipped)', async () => {
    const scene = secure.AUDIO_CATALOG.assets[0], data = fs.readFileSync(path.join(root, scene.bed.url));
    const good = { duration: scene.bed.loopEnd, length: 432240, numberOfChannels: 1 };
    secure.fetch = async () => ({ ok: true, headers: { get: () => String(data.length) }, body: body(data) });
    const loader = secure.createAudioLoader({ decodeAudioData: (b, ok) => ok(good) }, secure.AUDIO_CATALOG);
    assert.equal(await loader.load(scene, new AbortController().signal), good);
    secure.fetch = async () => ({ ok: true, headers: { get: () => null }, body: body(new Uint8Array([1, 2, 3])) });
    await assert.rejects(loader.load(scene, new AbortController().signal), /checksum/);
  });

  await test('the ambience shell on an insecure page: ONE plain toast, the status line says why, and audio is never started', async () => {
    const s = ambientShell({ protocol: 'http:', crypto: undefined });
    s.app.init(); await flush();
    assert.deepEqual(s.toasts, ['Ambience: ' + REASON], 'one toast, in plain words');
    assert.equal(s.status.textContent, 'Unavailable: ' + REASON);
    assert.deepEqual(s.counts, { contexts: 0, loaders: 0, controllers: 0 }, 'no audio context, no loader, no controller');
    s.doc.fire('pointerdown'); s.doc.fire('tnd:scene-committed'); s.app.sync(); await flush();
    assert.equal(s.toasts.length, 1, 'a tap, a new scene and a repaint do not say it again: ' + JSON.stringify(s.toasts));
    assert.deepEqual(s.counts, { contexts: 0, loaders: 0, controllers: 0 }, 'and a tap still starts nothing');
  });

  await test('a secure page starts ambience as before: no toast, one controller', async () => {
    const s = ambientShell({ protocol: 'https:', crypto: webcrypto });
    s.app.init(); await flush();
    assert.deepEqual(s.toasts, []); assert.equal(s.counts.controllers, 1, 'the controller is built: ' + JSON.stringify(s.counts)); assert.equal(s.counts.loaders, 1);
    assert.ok(!/Unavailable/.test(s.status.textContent), 'the status is not a refusal: ' + s.status.textContent);
  });

  await test('a local file keeps its own words, and starts nothing', async () => {
    const s = ambientShell({ protocol: 'file:', crypto: webcrypto });
    s.app.init(); await flush();
    assert.deepEqual(s.toasts, ['Ambience: Open the hosted game or localhost to use ambience']);
    assert.deepEqual(s.counts, { contexts: 0, loaders: 0, controllers: 0 });
  });

  console.log((failed ? 'FAILED' : 'ALL GREEN') + ' — #502 ambience on an insecure page (' + passed + ' passed, ' + failed + ' failed)');
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
