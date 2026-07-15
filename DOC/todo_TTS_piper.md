# todo_TTS_piper.md — Piper (local, $0) TTS integration plan

**Status:** Plan drafted 2026-07-15 by Opus 4.8, based on a validated spike. **For review + implementation start on 2026-07-16 (Thu).**
**Tier:** Sonnet (TTS layer — NOT the drift surface). But the reviewer should confirm that framing (the only adjacency is the shared text-prep pass, which is pure and doesn't touch memory/prompt canon).
**Tracker row:** [TODO.md](../TODO.md) **#41** carries the full research trail (Kokoro/Kitten elimination, Piper validation, the spike findings). This doc is the implementation-facing distillation.

---

## 0. TL;DR — what was decided and why

- We evaluated 5 TTS options. **Kokoro** = desktop-only in practice; **Kitten** = "blown speaker," out. **Piper** = the winner for the local/offline/$0 slot.
- **Piper is VALIDATED.** User heard it on real Ammut narration: *"Is it the greatest VO? No. Passable, especially considering the cost? Absolutely."*
- A working spike exists — **`piper_test.html`** (repo root) — that synthesizes real narration **fully local, no build step, no cross-origin isolation**, at **2.5–4.5× real-time** after a one-time ~9s warmup.
- This plan integrates that into the game's `tts.js` as a new provider alongside Cartesia / native / (future) Inworld.
- **Piper does NOT replace hosted TTS** — it's the offline/$0 option. Inworld/Cartesia remain the higher-quality hosted path (still to be priced). Both slots coexist behind a provider-agnostic table (the whole point of #41).

---

## 1. The hard-won findings (READ THIS FIRST — every wall we already hit)

The spike took ~a dozen iterations to get working. These are the non-obvious facts that gate the whole approach. **Do not "simplify" past them — each was learned by hitting it.**

1. **You cannot load ONNX Runtime (ORT) from a CDN.** The obvious approach (`import` the Piper lib from esm.sh, let it pull ORT from a CDN) FAILS in a real browser, three ways in sequence:
   - The lib (`@mintplex-labs/piper-tts-web`) hardcodes `ort.env.wasm.wasmPaths` → `cdnjs/onnxruntime-web@1.18.0/`, but the `.jsep.mjs` WASM-glue file **does not exist for 1.18 on any CDN** (glue files began at 1.19). → 404.
   - Repoint to 1.19.2 (which has the files) and it wants the **threaded** WASM build, which needs `SharedArrayBuffer` → requires **cross-origin isolation** (COOP/COEP). Without it: hangs. `numThreads=1` just 404s (no non-threaded file at 1.19.2).
   - WITH isolation on, ORT spawns its worker **from the cross-origin CDN script** → the browser blocks it: `SecurityError: Failed to construct 'Worker': script … cannot be accessed from origin`.
   - **Conclusion: ORT's runtime + worker + wasm must all be SAME-ORIGIN.**

2. **The fix is vendoring + an import map — NO build step needed.** Native `<script type="importmap">` redirects the bare `onnxruntime-web` specifier (which the lib imports via `await import("onnxruntime-web")` — a *bare* dynamic import, so import-map-redirectable) to a **local, same-origin** ORT copy. This keeps the project's zero-build / zero-dependency tenet intact.

3. **Use the NON-threaded WASM build → no worker, no isolation.** Vendor **onnxruntime-web@1.18.0** specifically, because its dist ships `ort-wasm-simd.wasm` (non-threaded, non-jsep). Lock `numThreads=1` and it runs **single-threaded, inline, no Worker, no SharedArrayBuffer, no COI** — works on a plain HTTP origin. 1.19+ dropped the non-threaded build, which is why we pin 1.18.

4. **The library clobbers your config — you must LOCK it.** `vits-web` internally sets `numThreads = navigator.hardwareConcurrency` (→32) and `wasmPaths = <cdnjs>`. Override BOTH with `Object.defineProperty` getters whose setters silently ignore writes, on the shared ORT instance, before first synth.

5. **Long sentences hang single-threaded Piper.** A ~500-char run-on sentence (commas, no period) synthesized as ONE unit takes 30s+ and looks frozen. The text-prep MUST cap unit length (`MAX_UNIT=220`), sub-splitting long sentences on clause boundaries then word-wrapping. This is in the harvestable splitter already.

6. **`file://` will not work.** Import maps + same-origin `/vendor/` paths need a real HTTP origin. The deployed game (Cloudflare Pages) is fine; local dev must be served over http, not opened as a file. (This bit the user twice during the spike.)

7. **Phonemizer + voice models are separate downloads.** `vits-web` loads the espeak phonemizer WASM (`@diffusionstudio/piper-wasm@1.0.0`) and the voice `.onnx` models (HuggingFace) at runtime, caching voices in **OPFS**. These are cross-origin fetches — fine on a plain (non-COEP) origin. Decide whether to also vendor the phonemizer for full offline (see Open Questions).

---

## 2. The proven working recipe (from the spike)

**Vendored files (~20MB, mostly the 2 wasm binaries):**

| Package | Files | Purpose |
|---|---|---|
| `@diffusionstudio/vits-web@1.0.3` | `dist/vits-web.js`, `dist/piper-DeOu3H9E.js` | The Piper/VITS wrapper (functional API: `predict`, `download`, `stored`, `voices`) |
| `onnxruntime-web@1.18.0` | `dist/esm/ort.wasm.min.js`, `dist/ort-wasm-simd.wasm`, `dist/ort-wasm.wasm` | The inference runtime (ESM entry + non-threaded SIMD wasm + non-SIMD fallback) |

> Note: the spike used `@diffusionstudio/vits-web` (the original), NOT the `@mintplex-labs` fork. The original's functional API is simplest. Confirm at implementation time this is still the maintained/right choice.

**Import map (in `<head>`, before any module script):**
```html
<script type="importmap">
{ "imports": { "onnxruntime-web": "/<vendor>/ort/ort.wasm.min.js" } }
</script>
```

**ORT lock (before first synth, on the shared instance):**
```js
var ort = await import("onnxruntime-web");            // import map → local copy
Object.defineProperty(ort.env.wasm, "wasmPaths",  { get: function(){ return "/<vendor>/ort/"; }, set: function(){}, configurable: true });
Object.defineProperty(ort.env.wasm, "numThreads", { get: function(){ return 1; },               set: function(){}, configurable: true });
```

**Synthesis:** `var wavBlob = await tts.predict({ text: sentence + " ", voiceId: "en_US-lessac-medium" });` → `decodeAudioData` → schedule on AudioContext.
(The trailing space guards a documented Piper "static tail when text ends in punctuation" bug.)

**Measured:** 692-char paragraph → 6 sentences → 38.1s audio in 18.9s = 2.0× overall; 2.5–4.5× per sentence after the one-time ~9s WASM compile on sentence #1.

---

## 3. Harvestable code (already written + tested in the spike)

Lift these from `piper_test.html` into `tts.js`. **They are provider-agnostic** — the text-prep improves Cartesia and native voices too, so do it first and independently.

- `normalizeForTTS(text)` — em/en-dash → comma breath, `...` → `…`, whitespace collapse. Extends the existing `_dashToPause` (tts.js:172, v1.76).
- `splitSentences(text)` — paragraphs → sentences → **length-capped units** (`MAX_UNIT=220`) with `paraEnd` flags for wider gaps at paragraph breaks.
- `packLongUnit(s)` — sub-splits an over-long sentence on clause boundaries (`,;:`), then word-wraps. **Mandatory** (finding #5).
- The ORT-lock + import pattern (finding #4).
- The per-sentence synth→decode→schedule loop (mirrors the shape of the existing `scheduleChunk`, tts.js:214).

> **ES5 caveat:** `tts.js` is ES5 (`var`, no arrow functions, no template literals; `async/await` only in the API-facing functions). The spike's harvestable helpers are already `var`/function-declaration style. New Piper synth code will introduce a new `async` surface — confirm that's an acceptable extension of the "async only in the 3 API functions" convention, or wrap accordingly.

---

## 4. Implementation phases (todo)

### Phase 1 — Harvest the shared text-prep (low-risk, do FIRST, ships independently)
- [ ] Add `normalizeForTTS` / `splitSentences` / `packLongUnit` (+ `MAX_UNIT`) to `tts.js` as a shared prep pass.
- [ ] Route the **native** and **Cartesia** paths through it too (they benefit from sentence-splitting + normalization). Verify no regression to current native/Cartesia behavior.
- [ ] Retire/merge the old `_dashToPause` into `normalizeForTTS`.
- [ ] Engine/unit coverage for the splitter: run-on sentence → capped units; paragraph → `paraEnd`; empty/whitespace; dialogue with quotes; abbreviations (known-naive — document).
- [ ] Bump `APP_VERSION` + `CACHE` (sw.js). This phase is shippable on its own.

### Phase 2 — Vendor ORT + vits-web into the repo (same-origin assets)
- [ ] Create a vendor dir in the repo (e.g. `vendor/piper/` — decide location; see Open Questions on repo-size).
- [ ] Add `vits-web.js`, `piper-DeOu3H9E.js`, `ort.wasm.min.js`, `ort-wasm-simd.wasm`, `ort-wasm.wasm`.
- [ ] Add the `<script type="importmap">` to `index.html` `<head>` (before the `<script src>` block).
- [ ] **Decide phonemizer:** vendor `@diffusionstudio/piper-wasm@1.0.0` for full offline, or let it fetch cross-origin (current spike behavior). See Open Questions.
- [ ] **SW strategy (critical — see the sw.js cache history in CLAUDE.md):** do NOT add the ~20MB wasm to the precache app-shell (would wreck the cache-first bandwidth model). Load ORT on demand the first time TTS is invoked; let the browser/HTTP cache (or a runtime SW cache rule) hold it. Confirm the plan with the sw.js maintainer notes.

### Phase 3 — Piper adapter in `tts.js`
- [ ] Add a Piper path parallel to `_stream` (Cartesia) and `_speakNative`. Piper produces a whole WAV per sentence (not an SSE stream), so it's a decode-and-schedule loop, simpler than the Cartesia PCM path.
- [ ] Lazy engine init: import local ORT, apply the locks, `await import` the local vits-web. One-time; keep the module reference warm across turns.
- [ ] Voice model management: `stored()` / `download(voiceId, progressCb)` before first use of a voice; surface download progress (reuse the red-error / status indicators, per the no-silent-failures rule).
- [ ] Route synth output through the existing AudioContext scheduler (`_ensureCtx`, the `scheduleChunk`-style timeline, `_nextStart`, `_sources[]`) so pause/skip/stop (tts.js:327–368) work unchanged.
- [ ] Warm-up handling: the first `predict` of a session eats ~9s (WASM compile). Options: pre-warm on TTS-enable with a throwaway 1-word synth; or just accept turn-1 latency (engine stays warm after). Decide + implement.

### Phase 4 — Provider-agnostic wiring + UI
- [ ] Make TTS providers a swappable table (mirror the LLM `PROVIDERS` shape) rather than the current implicit native-vs-Cartesia branch. Piper becomes an entry; Inworld later is just another entry.
- [ ] Voice Settings modal: add a Piper engine option + voice picker (the 8 voices from the spike dropdown; Ryan-high / Lessac are the narrator front-runners). Persist choice per the existing settings pattern.
- [ ] Fallback discipline: if the Piper engine fails to load/synthesize → fall back to native voice + a visible reason indicator (same pattern as the Cartesia `402`/error path).
- [ ] Per-campaign vs device-default voice: decide whether the Piper voice choice rides the campaign (like `proseAuthor`) or stays a device setting.

### Phase 5 — Verify + ship
- [ ] Drive it in the real preview: enable Piper, run several real GM turns, confirm audio plays, pause/skip/stop work, long sentences don't hang, download+cache works, warm engine stays fast.
- [ ] Car Mode path (TTS→mic auto-loop, `_drain` onDone) still works with Piper.
- [ ] Cross-device: OPFS voice cache is per-origin; confirm behavior on the deployed origin.
- [ ] Bump `APP_VERSION` + `CACHE`; update TODO.md #41 status; move the todo_checkWithFable entry if applicable.

---

## 5. Open questions / design forks for the reviewer

1. **Repo size:** ~20MB of vendored wasm in the repo (OneDrive-synced). Acceptable, or host the wasm as a separate runtime-fetched asset (still same-origin on Cloudflare Pages, just not in git)? Same-origin is the hard requirement; *in-git* is negotiable.
2. **Phonemizer:** vendor `@diffusionstudio/piper-wasm` for true offline, or accept the cross-origin jsdelivr fetch (breaks pure-offline but simpler, and voices already come from HuggingFace anyway)? If offline-in-the-car is a goal, voices must be pre-downloaded regardless.
3. **Library choice:** `@diffusionstudio/vits-web@1.0.3` (used in spike) vs the `@mintplex-labs` fork vs pinning our own vendored copy forever. The vendored copy is frozen either way — decide the upstream of record.
4. **Warm-up UX:** pre-warm on enable (spend ~9s up front, silent) vs lazy (turn-1 pays it). Car Mode leans toward pre-warm.
5. **Provider-table refactor scope:** do the full LLM-`PROVIDERS`-style TTS table now (cleaner, sets up Inworld), or add Piper as a third branch and refactor later? #41 wants the table; this is the moment.
6. **Voice per-campaign vs device:** mirror `proseAuthor` (per-campaign, rides sync) or keep device-local?
7. **Async convention:** new Piper `async` synth surface vs the "async only in the 3 API functions" rule — sanction the extension or structure around it.

---

## 6. Risks / gotchas cheat-sheet

- ❌ Loading ORT from a CDN — will fail (finding #1). Same-origin only.
- ❌ Adding the wasm to the SW precache shell — bandwidth/cache regression (see sw.js history).
- ❌ Opening dev over `file://` — import maps + `/vendor/` paths need http.
- ❌ Skipping the `MAX_UNIT` cap — long sentences hang.
- ❌ Forgetting to LOCK `numThreads`/`wasmPaths` — the lib resets them to 32/cdnjs.
- ⚠ First synth per session ≈ 9s (WASM compile) — expected, one-time.
- ⚠ ES5 + async-convention in `tts.js`.

---

## 7. Reference

- **Working spike:** `piper_test.html` (repo root) — the full working blueprint. Run it via a local http server (not file://).
- **Spike server (throwaway, was in session scratchpad):** a ~30-line static server with a `/piper_vendor/` route mapping. The vendored files it served are temporary; Phase 2 re-vendors into the repo.
- **Tracker:** [TODO.md](../TODO.md) #41 (full trail: Kokoro/Kitten elimination, all spike findings, live metrics).
- **Existing TTS code:** `tts.js` — `speak()` / `_stream()` (Cartesia SSE→PCM) / `_speakNative()` / `scheduleChunk()` / pause/skip/stop / Voice Settings modal.
- **Related TODO rows:** #9 (per-character voices), #12 (TTS cost / brevity), #2 (Car Mode), #3 (per-character voice IDs).
