# todo_TTS_piper.md — Piper (local, $0) TTS integration plan

**Status:** Plan drafted 2026-07-15 by Opus 4.8, based on a validated spike. Reviewed 2026-07-16 by Fable 5 — approved, all 7 forks resolved (§5). **BUILT 2026-07-16 (same day): Phases 1–4 shipped v1.298–v1.301 (Sonnet built each phase, Fable reviewed+revised each before commit); Phase 5 machine-verifiable checks done in the live preview v1.302.** What remains is the HUMAN half of Phase 5: the long-term listen on real narration, Car Mode in a real session, cross-device on the deployed origin, and the post-deploy `curl -I` header check. Build-vs-plan deltas worth knowing: Phase 1 found the quote-drop was CONTENT LOSS (not benign merge) — fixed with a quote-tolerant regex + a loud no-loss fallback net; Phase 3 gained a post-loop epoch check (skip-during-final-unit hole); `_headers` gained an explicit `! Cache-Control` detach.
**Tier:** Sonnet — CONFIRMED by the Fable review (the TTS layer sits entirely downstream of `cleanTxt` output; it never touches memory, prompts, tags, or transcript). One carve-out: the Phase 2 sw.js change is not drift surface either, but it's the file behind the Netlify bandwidth incident — implement it exactly per the concrete design in Phase 2 (dedicated persistent cache + activate-purge exemption), no improvising.
**Tracker row:** [TODO.md](../../TODO.md) **#41** carries the full research trail (Kokoro/Kitten elimination, Piper validation, the spike findings). This doc is the implementation-facing distillation.

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
- [ ] **Split is per-provider, NOT universal (review finding 2):** normalization is shared by all providers; **sentence-splitting applies to Piper + native only — NOT Cartesia.** Cartesia is a streaming API that handles whole paragraphs in one request; splitting it into N per-sentence POSTs multiplies request count/latency and breaks cross-sentence prosody. Model this as a per-provider capability flag (feeds the Phase 4 table). Native genuinely benefits (Chrome long-utterance speechSynthesis flakiness + per-sentence skip granularity).
- [ ] **Cartesia dash normalization is a behavior change — A/B it, don't assume.** `_dashToPause` deliberately applies to native only today (tts.js comment: Cartesia handles dashes fine). If routing Cartesia through `normalizeForTTS`'s dash→comma, listen to the before/after first.
- [ ] Retire/merge the old `_dashToPause` into `normalizeForTTS` (for the providers that use it).
- [ ] Nit from review: add single-`\n` collapse to `normalizeForTTS` (it collapses `[ \t]+` only; paragraphs are already split beforehand, so intra-paragraph newlines should become spaces).
- [ ] Engine/unit coverage for the splitter: run-on sentence → capped units; paragraph → `paraEnd`; empty/whitespace; dialogue with quotes (known: `"Run!" she said.` merges into one unit — benign, length cap still applies); abbreviations (known-naive — document).
- [ ] Bump `APP_VERSION` + `CACHE` (sw.js). This phase is shippable on its own.

### Phase 2 — Vendor ORT + vits-web into the repo (same-origin assets)
- [ ] Create `vendor/piper/` in the repo (DECIDED: in git — see §5 Q1).
- [ ] Add `vits-web.js`, `piper-DeOu3H9E.js`, `ort.wasm.min.js`, `ort-wasm-simd.wasm`, `ort-wasm.wasm`.
- [ ] **Verify each vendored file is under 25 MiB** — Cloudflare Pages has a hard per-file limit. The ORT 1.18 wasm binaries (~10–11MB each) should clear it; confirm actual sizes before committing. (This is also why the default VOICE MODEL cannot ship in-repo — medium voices run ~60MB; they auto-download from HuggingFace instead, see §5 Q6.)
- [ ] Add the `<script type="importmap">` to `index.html` `<head>` (before the `<script src>` block). Note: root-absolute paths (`/vendor/piper/…`) assume serving from origin root — true on Cloudflare Pages and a repo-root local server; don't serve from a subpath.
- [ ] Phonemizer: DECIDED — keep the cross-origin fetch (§5 Q2). No vendoring now.
- [ ] **SW strategy (critical — CONCRETE DESIGN from review finding 1; the plan's original "let a runtime cache rule hold it" hides a trap):** the SW's default cache-first path runtime-caches any same-origin GET into the **versioned** `CACHE`, and the `activate` handler deletes every cache ≠ `CACHE` — so wasm cached that way is **wiped on every deploy** (CACHE bumps every commit) → ~20MB re-download per device per deploy. Fix, BOTH parts required:
  1. Dedicated persistent cache `tnd-piper-v1` for `/vendor/piper/` requests, cache-first, versioned by vendored-content version (bump ~never — the files are frozen), NOT by deploy.
  2. **Edit the activate purge filter to spare it** (`k!==CACHE && k!==PIPER_CACHE`). Without this, part 1 does nothing — the purge kills any second cache.
  Plus: add a long-max-age immutable rule for `/vendor/piper/*` in `_headers` so the plain HTTP cache backstops it. Do NOT add the wasm to the precache app-shell.
- [ ] **Repoint `piper_test.html`** at `vendor/piper/` (it currently expects the throwaway spike server's `/piper_vendor/` route) — keeps the spike alive as a standing voice-audition harness.

### Phase 3 — Piper adapter in `tts.js`
- [ ] Add a Piper path parallel to `_stream` (Cartesia) and `_speakNative`. Piper produces a whole WAV per sentence (not an SSE stream), so it's a decode-and-schedule loop, simpler than the Cartesia PCM path.
- [ ] Lazy engine init: import local ORT, apply the locks, `await import` the local vits-web. One-time; keep the module reference warm across turns. (Async surface sanctioned — §5 Q7; keep it confined to the Piper adapter functions and document the sanctioned surface in the tts.js header comment.)
- [ ] Voice model management: `stored()` / `download(voiceId, progressCb)` before first use of a voice; surface download progress (reuse the red-error / status indicators, per the no-silent-failures rule).
- [ ] Route synth output through the existing AudioContext scheduler (`_ensureCtx`, the `scheduleChunk`-style timeline, `_nextStart`, `_sources[]`) so pause/skip/stop (tts.js:327–368) work unchanged.
- [ ] **Stale-async guard (review finding 3 — Cartesia gets this free from AbortController, Piper does NOT):** nothing can abort an in-flight `predict()` WASM call, and `skip()` immediately `_drain()`s into the next item — a stale `predict` resolving later must not schedule its audio over the new item. Use an epoch/generation counter: capture before each `await`, discard the result if it changed. The spike's `_cancelled` flag alone is insufficient.
- [ ] Mirror the `streamDone`/`activeSrcs` bookkeeping from `_stream` so `_drain()` doesn't advance before the last scheduled buffer finishes (Car Mode's `onDone` depends on this ordering).
- [ ] Warm-up: DECIDED — **pre-warm on TTS toggle-on, only when Piper is the selected engine** (§5 Q4). `toggle()` already runs inside a user gesture; kick a silent throwaway one-word synth async.

### Phase 4 — Provider-agnostic wiring + UI
- [ ] DECIDED: **full table NOW** (§5 Q5). Make TTS providers a swappable table (mirror the LLM `PROVIDERS` shape) rather than the current implicit native-vs-Cartesia branch. Piper becomes an entry; Inworld later is just another entry. The per-provider sentence-split flag (Phase 1) lives here.
- [ ] **Curated voice stable (§5 Q6):** the 8 spike voices become a data table in tts.js (like `AUTHORS` for prose inspiration) — name, Piper voiceId, blurb. Voice Settings picker selects from it. One standard default voice (Ryan-high / Lessac front-runners — pick at implementation) auto-downloads with a progress bar on first Piper enable.
- [ ] **Voice scope — the `proseAuthor` two-tier pattern (§5 Q6):** per-campaign `worldState.piperVoice` rides the sync blob; unset campaigns fall back to the device default; saving in-game pins the campaign AND updates the device default. Cross-device: a campaign voice not yet in this device's OPFS auto-downloads with visible progress, speaking via the fallback ladder (default Piper voice → native) until it lands. Loud, never silent.
- [ ] Fallback discipline: if the Piper engine fails to load/synthesize → fall back to native voice + a visible reason indicator (same pattern as the Cartesia `402`/error path). This is ALSO the graceful-degrade path for browsers without import-map support (older iOS Safari <16.4 — the importmap tag is harmlessly ignored, but the bare dynamic import will reject; must fail loud → fallback, an explicit test case in Phase 5).

### Phase 5 — Verify + ship
- [ ] Drive it in the real preview: enable Piper, run several real GM turns, confirm audio plays, pause/skip/stop work, long sentences don't hang, download+cache works, warm engine stays fast.
- [ ] **Skip/stop mid-synth:** exercise the stale-predict case specifically — skip while a sentence is synthesizing, confirm the stale result never schedules audio over the next item (the Phase 3 epoch guard's failure condition).
- [ ] **Classic-script dynamic import:** the spike ran its imports from a `<script type="module">`; tts.js is a classic script. Dynamic `import()` + import-map resolution from a classic script is spec'd, but smoke-test it on the DEPLOYED origin, desktop AND iOS.
- [ ] **Import-map-unsupported browser → loud fallback** (older iOS): verify the native-voice fallback + visible reason fires, no silent dead air.
- [ ] **Deploy-cycle cache survival:** deploy a CACHE bump, confirm the `tnd-piper-v1` cache survives the activate purge and the wasm is NOT re-downloaded.
- [ ] Car Mode path (TTS→mic auto-loop, `_drain` onDone) still works with Piper.
- [ ] Cross-device: OPFS voice cache is per-origin; confirm behavior on the deployed origin, including the campaign-borne voice auto-download on a second device.
- [ ] Bump `APP_VERSION` + `CACHE`; update TODO.md #41 status; move the todo_checkWithFable entry if applicable.

---

## 5. Design decisions — ALL RESOLVED (Fable review + user, 2026-07-16)

1. **Repo size → vendor in git** (`vendor/piper/`). 20MB once is trivial for git/OneDrive; in-git = deployed on Pages with zero extra infrastructure. Scale note (user asked): more users costs nothing — synthesis is on-device ($0 at any user count), the wasm serves from Cloudflare Pages (no bandwidth cap — the Netlify lesson already solved this), and voice models ride HuggingFace's CDN. The one multi-user watch item: HuggingFace hosting is outside our control — if it ever throttles/moves, mirror the curated voices same-origin (Pages or R2). Contingency only, don't build now.
2. **Phonemizer → keep the cross-origin fetch.** Pure-offline isn't achieved without pre-downloaded voices anyway, so vendoring it alone buys nothing. Revisit only if offline-in-the-car becomes a goal (then phonemizer + curated voices mirror same-origin together).
3. **Library → pin `@diffusionstudio/vits-web@1.0.3` as upstream of record** — what the spike validated; the vendored copy is frozen regardless.
4. **Warm-up → pre-warm on TTS toggle-on, only when Piper is the selected engine.** `toggle()` runs in a user gesture; silent throwaway one-word synth in the background. Car Mode benefits most.
5. **Provider table → full table NOW.** Three providers with implicit branching is exactly the "N variants → one table" rule; the per-provider split flag (finding 2) needs it anyway.
6. **Voice scope → curated stable + the `proseAuthor` two-tier pattern** (user's design, better than either reviewed option): data-table stable of the 8 spike voices; a standard default voice auto-downloads on first enable (can't ship in-repo — ~60MB model vs Pages' 25MiB file limit); per-campaign `worldState.piperVoice` rides sync with device-default fallback; cross-device auto-download with visible progress + loud fallback ladder. Per-character voices (#9) layer a character→voice map on top later — nothing here blocks it, and Piper makes #9 free.
7. **Async convention → sanctioned.** The rule's spirit is "async only at genuine I/O boundaries"; Piper synthesis is one. Confined to the Piper adapter functions; document the sanctioned surface in the tts.js header.

---

## 6. Risks / gotchas cheat-sheet

- ❌ Loading ORT from a CDN — will fail (finding #1). Same-origin only.
- ❌ Adding the wasm to the SW precache shell — bandwidth/cache regression (see sw.js history).
- ❌ **Letting the wasm land in the versioned `CACHE` via the SW's default runtime-caching** — the activate purge wipes it on EVERY deploy → 20MB re-download per device per deploy. Needs the dedicated `tnd-piper-v1` cache AND the activate-filter exemption (Phase 2; BOTH parts).
- ❌ **Sentence-splitting the Cartesia path** — request multiplication + broken prosody; split is Piper + native only (finding 2).
- ❌ **Skipping the epoch guard on Piper synth** — a stale `predict` resolving after skip() schedules audio over the next item; AbortController can't cancel WASM (finding 3).
- ❌ Opening dev over `file://` — import maps + `/vendor/` paths need http.
- ❌ Skipping the `MAX_UNIT` cap — long sentences hang.
- ❌ Forgetting to LOCK `numThreads`/`wasmPaths` — the lib resets them to 32/cdnjs.
- ❌ Committing a vendored file ≥ 25 MiB — Cloudflare Pages hard per-file limit (verify sizes; the ORT binaries should clear it, voice models never will — they stay on HuggingFace).
- ⚠ Import maps need Chrome 89+/Safari 16.4+/Firefox 108+ — older browsers ignore the tag harmlessly but the Piper import rejects; must fail LOUD → native fallback (never silent dead air).
- ⚠ First synth per session ≈ 9s (WASM compile) — mitigated by pre-warm-on-enable (§5 Q4).
- ⚠ ES5 + async-convention in `tts.js` — extension sanctioned, Piper-adapter-only (§5 Q7).

---

## 7. Reference

- **Working spike:** `piper_test.html` (repo root) — the full working blueprint. Run it via a local http server (not file://).
- **Spike server (throwaway, was in session scratchpad):** a ~30-line static server with a `/piper_vendor/` route mapping. The vendored files it served are temporary; Phase 2 re-vendors into the repo.
- **Tracker:** [TODO.md](../../TODO.md) #41 (full trail: Kokoro/Kitten elimination, all spike findings, live metrics).
- **Existing TTS code:** `tts.js` — `speak()` / `_stream()` (Cartesia SSE→PCM) / `_speakNative()` / `scheduleChunk()` / pause/skip/stop / Voice Settings modal.
- **Related TODO rows:** #9 (per-character voices), #12 (TTS cost / brevity), #2 (Car Mode), #3 (per-character voice IDs).
