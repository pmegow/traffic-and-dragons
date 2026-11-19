# Lane H report — voice: tts.js, stt.js, audio-session.js, audio-master.js, piper-host.html, wasm-probe.js

HEAD d7ed4ea6. Browser audio code: nothing here can run headless against a real AudioContext, recognizer, MediaRecorder or
iframe. Evidence is mostly READ. Where a behaviour lives in plain JS state, I drove the real file in a `vm` with the
fixture pattern the repo's own suites use (dev/tests-484-earcon-pause.js, dev/tests-audit-voice.js). Those probes are
marked REPRODUCED. They show what the code does with a fake platform. They do not show device timing.

## 1. Coverage

| File | Read | Notes |
|---|---|---|
| tts.js (4588 lines) | whole, lines 1–4588, in order | The long data tables (PIPER_VOICES, GEMINI_VOICES, DEFAULT_SPEAKER_STARS) were read and not analysed. |
| stt.js (936 lines) | whole | |
| audio-session.js | whole | |
| audio-master.js | whole | |
| piper-host.html | whole | |
| wasm-probe.js | whole | |
| DOC/contracts/tts-stt.md | whole | Read first. |
| Context (not reviewed) | car-session.js 155–170, 286–315, 370–390, 505–530; dev/sabotage-657-master-mute.js; dev/tests-484-earcon-pause.js; parts of dev/tests-audit-voice.js and dev/engine-tests.js | Read only to check callers and existing pins. |
| vendor/ | not reviewed | Grepped only for `WebAssembly.instantiate` / `new WebAssembly.Instance` call shapes, for finding 7. |

I ran no suite, battery or browser.

## 2. Findings

### F1. Cancelling the mic while a cloud take is transcribing does not discard it: the transcript still lands and can still be sent. (medium)
- **Where:** stt.js `cancel()` lines 275–286; `_cloudUpload` lines 759–806; `_cloudFinalize` lines 880–898.
- **Code:** `cancel()` checks only `_cloudCancelAcquisition(...)` and `if (_cloudRec) { _cloudStopRecording(true); return; }`. Once recording has stopped, `_cloudRec` is null and the upload is in flight. The generation is not bumped, and `_cloudFinalize` checks only `generation !== _cloudGeneration`. It never reads `_cancelled`.
- **Sequence:** cloud path (iPhone without native recognition, or a keyless player on the #625 gateway). The player speaks, then the VAD endpoint or a tap stops the take, and Car Mode shows "Transcribing…". Then one of these calls `cancel()`:
  - `hideCarMode` (car-session.js:381, whose comment is round-2 #31: "Exit should discard instead"),
  - `_carDoReplay` (car-session.js:523),
  - `_carReadOptions` (car-session.js:163).
- **Outcome:**
  - **Car Mode exited:** the transcript is written into `#action-input` after the overlay closed. If the desktop auto-send preference is on, it is also sent.
  - **Inside Car Mode** (replay or read options): the transcript is sent as a GM turn even though the player cancelled it.
- **Evidence: REPRODUCED.** Probe `audits/audit-2026-11-19-evidence/H\probe-stt-cancel-upload.js` (real stt.js and helpers.js in a vm, the confirm gate off to isolate the cancel). Output:
  ```
  upload in flight: true  notes: info:Recording — pause to finish, or tap | info:Transcribing…
  field after cancel: "I draw my sword and charge the guard"
  sent after cancel: []
  car-mode variant — sent after cancel: ["I draw my sword and charge the guard"]
  ```
- **Refutation tried:** the F2 audit fix covers only the acquisition window, and the contract text names only that window. No test in dev/ cancels during the upload: tests-audit-voice F2 cancels before getUserMedia resolves.
- **Remedy:** in `cancel()`, when an upload is pending (track it, e.g. `_cloudUploading = generation`), bump `_cloudGeneration`. The stale-result guards already present then discard the result.

### F2. The narrator's own earcons ignore the master mute. (medium-low)
- **Where:** tts.js `earcon()` lines 3696–3734: `gain.connect(ctx.destination);` at 3713.
- **Problem:** the #657 rule (audio-master.js header) is to "mute ALL sounds and narration". sound.js's earcon bus multiplies by `AudioMaster.gain()`, and sabotage-657 proves that. But `TTS.earcon` builds its own oscillator and gain straight to the destination at 0.08, bypassing `_masterNode`.
- **Callers:** Car Mode (car-session.js:131/139/142/213: fail, ack, ready, the pause ack) and the companion talk (companion-talk.js:176).
- **Outcome:** with the phone's mute on, every Car Mode turn still beeps.
- **Evidence: REPRODUCED.** Probe `audits/audit-2026-11-19-evidence/H\probe-earcon-mute.js`. Output:
  ```
  AudioMaster.muted() = true  gain() = 0
  link gain(gain=0.08) -> ctx.destination
  RESULT: earcon reaches the destination at gain 0.08 while muted
  ```
  Neither dev/sabotage-657-master-mute.js nor the #657 section covers tts.js's earcon.
- **Remedy:** `gain.connect(_masterNode(ctx))`, or skip when `AudioMaster.gain() === 0`.

### F3. Native STT: a stale `onend` from a stopped recognizer clobbers the next listen. (medium-low)
- **Where:** stt.js `stop()` lines 262–269 and `start()`'s `_rec.onend` at 185–247.
- **Code:** `stop()` sets `_listening = false` synchronously, but the platform's `onend` arrives later. A `start()` in that gap creates a second recognizer. The first recognizer's `onend` then runs `_capture(false); _listening = false; _rec = null;` against the new listen. Its closure has no identity check (`if (_rec !== thisRec) return`).
- **Sequence:** desktop or Android. Tap the mic to stop, then tap again quickly (`toggle()` → `stop()` → `start()`).
- **Outcome:**
  - The button shows idle while the second recognizer is live.
  - `AudioSession.setCapture(false)` and the `capture:false` event fire during capture. That is the #19 WebKit-282939 handoff violation, and it resumes ambience over an open mic.
  - `_rec` is null, so the next tap cannot stop the live recognizer.
  - The first utterance's own send policy runs with `_gotFinal` already reset by the second `start()`, so it is never sent.
- **Evidence: REPRODUCED** in a fixture whose `stop()` ends asynchronously, as real recognizers do. Probe `audits/audit-2026-11-19-evidence/H\probe-stt-stale-onend.js`. Output:
  ```
  after 2nd start: listening = true  recognizers = 2
  after stale onend: listening = false  capture edges = [true,true,false]
  listen 2 recognizer stopped by the tap? false
  ```
  Whether Chrome actually starts a second instance while the first is ending is not verified on a device.
- **Remedy:** capture the instance in `start()` (`var me = _rec;`) and have every handler return when `_rec !== me`. Or keep `_listening` true until `onend`.

### F4. `_piperInit` leaks the spawned iframe when its `init()` or `mem()` fails. (medium: monotonic, B9 class)
- **Where:** tts.js `_piperInit` lines 2556–2580.
- **Code:** `var fr = await _piperSpawnFrame(); await fr.init(); _frameMem = await fr.mem(); …` sits in a `try`. Its `catch` records `_piperFrameFailed` and falls through to the in-page engine. It never calls `fr.destroy()`.
- **Compare:** the two sibling paths do clean up. `_frameRetryUpgrade` has `.catch(function (e) { try { fresh.destroy(); } … })` at 3542, and `_frameRespawnNow` has `try { fresh.destroy(); }` at 3633.
- **Sequence:** the frame posts "ready", then the ORT import or the vits-web import inside it throws, or the `mem` RPC rejects.
- **Outcome:**
  - The hidden iframe stays in the DOM with its window message listener, and possibly a half-booted ORT realm.
  - The page then also loads the in-page engine. That is two engines, which is the exact situation v1.424 exists to prevent.
  - If the in-page load also fails, `_piperError` is set. After the 5-minute retry (`_piperOk`), the next read spawns another frame, which leaks again: one orphan per failed retry.
- **Evidence: READ.** Not driven: it needs a DOM iframe and postMessage.
- **Remedy:** `catch (e) { if (fr) try { fr.destroy(); } catch (e2) {} … }`. Hoist `var fr` above the `try`.

### F5. Skip and stop bypass the #418 retire for every scheduled source: no disconnect, no buffer detach. (medium, Safari retention class)
- **Where:** tts.js `_stopCurrent()` lines 3809–3812:
  ```
  try { _sources[i].onended = null; _sources[i].stop(); } catch(e) {}
  ```
- **Problem:** the contract (#418, and the in-code comment at 2856) says the retire is where the source is disconnected and `src.buffer = null` is set. That detach is what defeats Safari's retention of decoded PCM after disconnect (standardized-audio-context #718). `_stopCurrent` nulls `onended` before stopping, so the retire never runs for any source still pending at a skip or stop. Those sources stay connected to the master gain with their buffers attached until the GC frees them, if it ever does.
- **Size:** up to `PIPER_MAX_AHEAD_SEC` (25 s) of scheduled PCM per skip on Piper or server. On a cloud reader it is the scheduled groups.
- **Callers:** `skip()` (Car Mode next, a new turn) and `stop()` (replay, campaign switch, Test, toggle-off).
- **Evidence:** the mechanism is READ. The retention effect is SUSPECTED: it depends on WebKit GC of stopped, unreferenced sources, which the repo's own #718 note says is not reliable. tests-418 pins only the helper's text, not the stop path. Settle it with a piper_test soak that skips mid-read N times and watches `cs` and memory.
- **Remedy:** in `_stopCurrent`, run the same retire steps: `stop(); disconnect(); buffer = null`.

### F6. A hung Piper predict has no deadline, which wedges every later Piper operation silently. (low, SUSPECTED)
- **Where:** tts.js `_piperSpawnFrame` `call()` lines 2429–2438: no timeout on `pending[id]`. `_speakPiper` at 3392 runs `await _piperSerial(function(){ return mod.predict(...) })`.
- **Problem:** `_piperSerial` chains every op. A predict that never answers blocks `_piperSerial` for the page, so every later ensure, predict, delete and recycle waits behind it.
- **What clears it:** only `destroy()` rejects pending calls, and it runs only on a respawn, which itself runs inside `_piperSerial` and so cannot start.
- **What the player sees:**
  - `stop()` bumps the epoch, but the next Piper read awaits the same chain.
  - The ctx watchdog sees a running context, so nothing is toasted.
  - The bar shows "Speaking…".
- **Evidence:** SUSPECTED, because it needs a wasm call that never returns. Settle it with a frame fixture whose `predict` never replies.
- **Remedy:** a per-call deadline in `call()` that rejects, and destroys the frame on predict timeout.

### F7. The server tier's mid-read handoff drops the speaker map, while the cloud handoff keeps it. (low, duplicated logic that disagrees)
- **Where:** tts.js `_speakServer` line 2952:
  ```
  _queue.unshift({ text: _remText, piper: true, voiceId: voiceBaseId(voiceId) })
  ```
  This item carries no `voices`. `_cloudFallbackItem` (3097–3104) re-maps `voices[i]` onto the remainder (`mapped[i - from]`), and `_speakPiper` honours per-unit voices as base models.
- **Outcome:** when the voice server fails at unit k, every character line after k is read in the narrator's voice on local Piper, though Piper could speak them in the cast models. A cloud failure at the same point keeps them.
- **Evidence: READ.** engine-tests.js:20139 pins only the `voiceId: voiceBaseId(voiceId)` text.
- **Remedy:** build the server remainder through the same `_cloudFallbackItem` shape (unit-index re-map).

### F8. wasm-probe retains one Memory per unnamed instantiation, without bound, contrary to its own "at most one per kind". (low, latent)
- **Where:** wasm-probe.js `kindOf` line 49 (`return "wasm" + (++anon);`), `wrapCtor` hook line 114 (`note(o, "")`), and `wrapAsync` when called with a `WebAssembly.Module` (srcOf returns "").
- **Problem:** every module with no URL and no byte length gets a fresh kind, so `keep()` stores its `mem` under a new key each time. The sync `new WebAssembly.Instance` path always takes this branch.
- **Outcome:** each such instantiation pins its linear memory for the realm's life. This is the "probe becoming the leak" its header warns about.
- **Evidence: READ.** Latent: grepping vendor/piper shows the shipped non-threaded builds instantiate from bytes (classified as ort or phon). The only `new WebAssembly.Instance` is in the threaded worker build, which `numThreads=1` excludes, and roller/ has no wasm.
- **Remedy:** count unnamed instantiations under one "anon" kind, keeping the newest only.

### F9. A native recognizer that fails to start is silent. (low, silent failure)
- **Where:** stt.js `start()` lines 249–259:
  ```
  catch(e) { _capture(false); _listening = false; _rec = null; _syncBtn(); }
  ```
  There is no toast, no console line and no `carNotify`.
- **Compare:** the constructor failure just above (118) toasts, and the cloud path's recorder failures toast and `carNotify`.
- **Outcome:** in Car Mode the overlay simply returns to idle with no reason.
- **Evidence: READ.**
- **Remedy:** toast/carNotify and `console.warn` with `e.message`.

### F10. Every getUserMedia failure is reported as "Microphone permission denied". (low, misattributed)
- **Where:** stt.js `_cloudStart` `.catch` lines 642–652 always says "Microphone permission denied".
- **Misattribution:** `NotFoundError` (no mic), `NotReadableError` (mic busy, e.g. during a phone call over the car's Bluetooth) and `AbortError` all read as a permission denial.
- **Second effect (READ):** the `.catch` is chained after the success `.then`. A throw inside the success handler lands in the same catch, for example from the unguarded `carNotify("info", "Recording…")` at 637, after the recorder has started. The catch then toasts "permission denied" and releases `_capture(false)`, while `_cloudRec` and `_cloudStream` stay live and `_cloudTimer` is never armed, so nothing stops the mic.
- **Evidence:** the misattribution is READ. The handler-throw path is SUSPECTED: no current throw is known.
- **Remedy:** name `e.name` in the message, and use `.then(ok, fail)` instead of `.then(ok).catch(fail)`.

## 3. Monotonic resources

| Resource | Where created / released | Scope | Bound | Enforced |
|---|---|---|---|---|
| Narration AudioContext | `_ensureCtx` / `_closeCtx` (toggle-off, recoverAudio rebuild, B9 recycle at 40 units) | page | 1 live | yes |
| Master GainNode | `_masterNode(ctx)`, one per ctx; the old one dies with its ctx (never disconnected) | per ctx | 1 per ctx | yes |
| AudioBufferSourceNode + decoded AudioBuffer | `_scheduleDecoded` → retired in onended (disconnect + detach + splice) | per unit | ≤ 25 s ahead (backpressure) | on end yes; **on skip/stop the retire is bypassed (F5)** |
| Primer source + gain | audio-session.js `prime` / `stopPrimer` (on `_closeCtx`) | per ctx | 1 | yes |
| Earcon oscillator + gain | `earcon()` → disconnect onended | per blip | ended | yes (but unmuted, F2) |
| Gemini/cloud conveyor results (base64/bytes) | `_geminiConveyor` started−taken < depth (3; Inworld 4; Speechify 1) | per read | depth | yes |
| In-flight AbortControllers (`ctrls`) | deleted on land; `abortAll` | per read | depth | yes |
| Piper iframe realm + window message listener | `_piperSpawnFrame` / `destroy()` | page | 1 | **no on `_piperInit` init/mem failure (F4)** |
| RPC `pending`/`progress` maps | per call, deleted on reply or destroy | per call | answered calls | no deadline (F6) |
| wasm-probe `seen` | per kind, newest Memory | realm | per named kind | **unnamed kinds unbounded (F8, latent)** |
| Piper voice models (OPFS) | download / `_piperEvictExcess` (cap 10, assigned voices protected) | device forever | 10 (+assigned overflow, toasted) | yes, said when over |
| localStorage: crumb, LRU, voice settings (≤1 MiB check), voice keys, stars, mute, rates | single keys | device forever | keyed; settings capped by `VOICE_SETTINGS_MAX` | yes |
| `_voiceReadCache`, `_voiceCatalogCache`, `_voiceErrors`, `_geminiModelClosedUntil`, `_piperDownloaded` | keyed by store key / model id / voice id | page | number of models/voices | yes |
| Timers: `_ctxWatchT` (interval, guarded), `_ctxRunning` interval (≤1.5 s), backpressure 250 ms polls, prime 200 ms poll (≤8 s), native stall watchdog (cleared in `_stopCurrent`), STT `_cloudTimer`, `_vadPoll`, warm timers | each has a clear path | per read / take | 1 each | yes |
| Document listeners: `_armCtxUnlock` (one-shot, `_armed` guard), visibilitychange/pagehide/beforeunload (once at load) | | page | constant | yes |
| `statechange` listener per narration ctx (audio-session `watchCtx`) | on the ctx itself | per ctx | dies with ctx | yes |
| AudioMaster `listeners` | `onChange` / off() | page | callers in code | yes |
| STT: MediaStream tracks, MediaRecorder, `_cloudChunks` | `_cloudTeardownStream` / `_cloudFinish` | per take | 1, 45 s cap | yes (handler-throw gap, F10) |
| STT VAD context | `Sound.context()` shared, else one lazy `_vadOwnCtx` for the page; source/analyser disconnected per take | page | 1 | yes |
| SpeechRecognition instances | one per listen + warm-up throwaway | per listen | 1 intended | stale onend breaks the bookkeeping (F3) |

## 4. Affirmed (tried to break, could not)

1. **`_geminiFetchGroup` retry loop is bounded:** three 429 waits per rung, two rungs, each closed into `_geminiModelClosedUntil`; one quick retry for non-429; skip-abort checked after every wait. An all-closed ladder returns `fail`.
2. **Native no-speech auto-retry (stt.js 226–243)** is capped at one per cycle and resets on success. No restart loop.
3. **Secrets never reach a URL, log or crumb:** Gemini `x-goog-api-key`, Inworld/Speechify `Authorization`, OpenAI `Bearer` and the session header all ride headers. Error strings carry the HTTP status plus vendor or server text. Crumbs (`tts-server-degrade`, `stt-fallback`) slice those strings and carry no key.
4. **`_voiceRequest`:** the deadline races headers, body and decode. The abort listener is removed in `finally`, and a late abort after settle is harmless.
5. **A mid-read cloud failure hands off without a duplicate or a drop:** `_cloudFallbackItem` starts at `indexOf(groups[failed-1].last)+1`, so no unit is spoken twice or dropped. An audition never hands off, per the contract.
6. **Master mute mid-sentence on WebAudio** is live through the one gain per ctx. On the browser voice it cancels the live utterance, `_nativeMuteCancel` marks it, and the chain advances at volume 0. That matches the contract.
7. **`_markupGroup` copies the group,** so the Piper handoff never sees the `[speak …]` prefix.
8. **piper-host.html accepts only same-origin messages from `parent`.** The `OPS[d.op]` lookup of a prototype name (`constructor`) is reachable only from the embedder.

## 5. Undetermined

- **The async lanes have no catch-all.** `_speakServer`, `_speakGemini` and `_speakPiper` are async functions dispatched from `_drain` with no catch. Any unexpected synchronous throw leaves `_playing = true` and the bar on "Speaking…", and every later `speak()` queues behind it, because `speak` drains only when not playing. Examples: inside `conv.pump()`'s start function, or `_scheduleDecoded` on a closed ctx. I found no concrete input that throws today.
- **Tapping the mic during "Transcribing…" starts a new generation,** and the first take's transcript is then dropped as stale with only a console.info. Whether car-session's tap can start a listen in that state is outside this lane.
- **`warmMic()` is not counted in `_listening`.** A real `start()` during an unanswered permission prompt (up to 8 + 1.5 s) would have its capture released by the warm-up's `finish`. I did not establish whether the UI can reach `start()` in that window.
- **A stale `_nativeMuteCancel = true`** can survive when `cancel()` fires neither event and the stall watchdog advances instead. The next real native error would then be logged at debug as a mute. Cosmetic.
