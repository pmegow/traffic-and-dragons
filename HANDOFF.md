# Traffic and Dragons — Session Handoff (2026-07-24, the #90 build session)

**Deployed:** `v1.435` (APP_VERSION in globals.js) · CACHE `tnd-v3-20260724b` (sw.js) · Piper runtime **r9** (no vendored file touched)
**Tests:** 810 assertions, all green · **Branch:** master, both repos committed and pushed, trees clean
**New Fly app:** **`tnd-tts`** (https://tnd-tts.fly.dev) — deployed, live-verified, smoke-test secret UNSET
**Model note:** built by Fable (the row's "annotate for Fable" tier note is moot — no annotation needed).

One version, one feature, fully landed:
**TODO #90 M1 — SERVER-SIDE TTS SHIPPED AND LIVE-VERIFIED. The B9 fix is now architectural, not a tourniquet.**

---

## ⭐ #90 M1 — what shipped

**D1–D5 all ratified at build start** (user, 2026-07-24): D1 session-token auth · D2 second Fly app
`tnd-tts` · D3 degrade toast once per session · D4 Kokoro benchmark-gated (→ **new row #91**) ·
D5 3GB volume. Full as-built record: TODO.md ▸ completed #90.

**Server half** (server repo `tts/`, deploy `cd tts && flyctl deploy --ha=false`): `POST /api/tts`
{text, voiceId, rate} → audio/wav. Warm piper daemon per (voice,rate) — LRU 3, 10min idle kill,
2 timeout strikes = kill+respawn; the `--json-input` stdout path-print is the completion signal
(FIFO stays aligned across timeouts — a timed-out pending entry deliberately stays queued).
Voices download HF→volume on first use behind an allowlist mirroring `PIPER_VOICES`. Auth =
proxy `/auth/me` with a 10-min memo (one auth round trip per read). `TTS_TEST_SECRET` ops lever
exists for deploy smoke tests (DEV_LOGIN_SECRET pattern) — **currently UNSET; set → verify →
unset, never leave it**.

**Client half** (tts.js, off drift surface): `TTS_LADDER = server → piper → native`; `getEngine()`
RESOLVES ("server" when connected+healthy, else "piper" — offline devices byte-identical to #9;
the 3 constant-piper engine tests pass unchanged). `_speakServer` = the `_speakPiper` unit loop
with predict()→fetch (same splitter/speaker maps/manual WAV decode/scheduler/backpressure/shared
epoch). Unit failure → the WHOLE remainder hands down the ladder via the queue (the governor's
handoff pattern) + 60s retry memo. `prewarmServer()` health probe wakes the auto-stopped machine.
The governor meters ONLY the local tier and stays forever. `storageAdapter.authHeader()` exposes
the header, never the token. Voice Settings shows a server-tier status line.

**Live verification (deployed site + deployed app, failure conditions exercised):**
- Cold first synth incl. the 75MB HF voice download: **3.3s** (inside the 10s unit timeout);
  warm units **201–823ms** for 3–13s of audio (~6× realtime; RTF ≈ 0.16). WAV = 22050Hz mono
  PCM16, parsed by `_wavToAudioBuffer`.
- Auth gate: no token → 401; unknown voiceId → 400; retired test secret → 401 after unset.
- Browser end-to-end on traffic-and-dragons.pages.dev @v1.435: `getEngine()`="server", 4 units →
  4 POSTs → 4 scheduled sources, playback completed.
- **Failure condition:** unreachable server → ONE fetch, ONE loud degrade at the failing unit,
  remainder ACTUALLY synthesized by local Piper (in-page voice download → 4 local synths →
  played). Memo steered selection to "piper", retry after 60s confirmed via backdate test.
- Instrumented fetch-count run closed an anomaly: doubled console warns were the Browser pane's
  console-capture duplicating EVERY line (download %s too) — not a double degrade.

**Guards:** +5 engine tests (resolution, D1 no-token, degrade window + backdated retry, D3 single
toast, enqueue shape) + a 4-point SERVER TTS source contract in run-tests.js (zero-wasm, no
governor contact, remainder handoff, ladder order).

## Field watch

- **Server tier on the user's phone** — the real B9 validation: connected + voice on, expect
  NO `piper-*` death crumbs and NO governor latches (server reads spend no budget). A
  `tts-server-degrade` crumb names any server failure with its unit + reason.
- **First read of a voice not yet on the server volume** pays its HF download inside the unit
  timeout (libritts_r took ~2s on Fly's pipe; the 109–130MB "high" models will take longer —
  if one ever times out, the read degrades gracefully and the NEXT read finds it cached).
- **B9 governor watch continues for the offline tier** (`gv:1` on a death = lower the constants).

## Open rows / queues

- **#91 (NEW)** — Kokoro M2, gated on the D4 Fly CPU benchmark (run it on the tnd-tts box).
- **B17** — `findings-ready`, Fable-tier, wants its short design talk (location-state semantics).
- **#88** — suggestion-button punctuation (S, Sonnet, backlog).
- **Fable review queue** — entries 5, 2, 4 (order 5 → 2 → 4).
- **B13 / B15 / B16** — unchanged.

## Gotchas from this session

- **⚠ PowerShell 5.1 mangles native args containing spaces + quotes** — a curl `-d '{json with
  spaces}'` split into multiple args and each word became a URL (HTTP 000 spray). Body-from-file
  (`-d "@file"`) is the reliable form.
- **⚠ The Write tool can serialize `\x00`-style escapes as RAW control bytes** — tts/index.js
  landed with a literal NUL in a regex class and git/grep saw a binary file. Hex-dump to confirm,
  byte-level replace to fix.
- **⚠ The Browser pane duplicates console lines** — treat doubled warns as capture noise until an
  instrumented counter says otherwise (this session's fetch counter settled it).
- The pane's network monitor does NOT record cross-origin `fetch()` — Fly logs are the authority
  for "did the request land".

## Where to start next session

1. **B17 design talk** (short) — the location-history fix wants a decision on tag semantics.
2. **#91 Kokoro benchmark** whenever there's slack — one SSH session on the tnd-tts box decides M2.
3. Watch the feed for `tts-server-degrade` / `piper-governor` / death crumbs per Field watch.
4. Fable queue 5 → 2 → 4.
