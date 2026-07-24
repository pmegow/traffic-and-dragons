# Traffic and Dragons — Session Handoff (2026-07-24, end of a 9-hour day)

**Deployed:** `v1.434` (APP_VERSION in globals.js) · CACHE `tnd-v3-20260724a` (sw.js) · Piper runtime **r9** (no vendored file touched all day, again on purpose)
**Tests:** 805 assertions, all green · **Branch:** master, everything committed and pushed, tree clean
**Harness:** piper_test.html at **v0.10** (network-first in the SW — deploys instantly, versions independently)
**Model note:** this session ran on **Fable** (arrived a day early); the Fable review queue was opened and two entries closed.

Seven engine versions (v1.428 → v1.434), seven harness versions (v0.4 → v0.10), and the headline:
**B9 IS ROOT-CAUSED AND CLOSED**, with the interim fix shipped and the real fix designed and mandated.

---

## ⭐ B9 — ROOT CAUSE FOUND, GOVERNOR SHIPPED, SERVER-TTS MANDATED

**The verdict, after ~35 deaths and a day of on-device experiments run live with the user:**
**iOS kills the WebContent process after a CUMULATIVE budget of heavy synthesis work per page load**
— the energy assassin. ~100 game-unit synths ≈ ~29 large harness synths ≈ ~2 minutes of sustained wasm
inference, then the kill, deterministically. Not memory (deaths at ORT 248-624MB; idle at the fatal
level survived twice; a same-index death arrived at a different memory state), not grows (geometric,
~10 per session, final grow completed 4 synths before a death), not playback (bypass run died with
zero audio objects), not turns (narration-off survived 10+), not rate (75s sprint = 20min paced),
not the realm (in-page deaths identical). The full falsification chain — every hypothesis, every
instrument, every pre-registered prediction and its honest outcome — is in **DOC/BUGS.md ▸ B9**,
which is now effectively a case study in eliminative diagnosis. Also read **DOC/piper_deepdive.html**
(the 14-agent external research pass that reframed the investigation mid-day).

**Shipped — the work-budget governor (v1.434, tts.js, off drift surface):** Piper reads stop STARTING
at 40 synths/60s per page and stop MID-READ at 75/100s (remainder queued on the native voice); the
page latches GOVERNED with a loud 🔋 toast; a reload resets the budget. The tab stops dying because
the work stops happening. `cpu`/`gv` ride the crash crumb; 2 sabotage-proven tripwires (GOVERNOR
CONTRACT). **A future death crumb with `gv:1` means the constants are too high for that device —
lower them, don't re-diagnose.**

**Mandated — server-side TTS (TODO #90, user "GO" 2026-07-24):** the governor's native fallback is
"awful" (user, correctly). The close: `POST /api/tts` on the Fly server — self-hosted Piper first
(same 19 voices, identical audio, zero client work, Car Mode safe), **Kokoro-82M** behind the same
endpoint as the quality upgrade (better than Piper mediums + voice blending for per-character
voices). Design + the five decisions to ratify (auth, topology, fallback UX, Kokoro benchmark gate,
volume size): **DOC/DOC_server_tts.html**. Two-repo change; the server repo is at
`C:\Users\hannu\Projects\traffic-and-dragons-server` (outside this tree). **Build in a fresh
session; get D1-D5 answers first.**

**The instruments that got us here (all deployed, all still useful):**
- Harness v0.4-v0.10: unbounded-shapes mode, per-grow ring with pre-commit IN-FLIGHT marker, the
  IDLE test, `synthCPU` accounting, and **self-emailing death reports** (error-report.js loaded in
  the harness; deaths auto-mail with ctx `piper-harness-death`, 📮 button for manual state).
  ⚠ Standing sync rule: `piper-harness-*` reports are B9 evidence, never new bug rows; harness
  reports from LOCALHOST are test artifacts (three are ledgered, one with an invented synthCPU
  value — do not cite them as field data).
- Game-side: bypass experiment (Admin ▸ 🧪 checkbox, v1.431), bypass-death boot report + the
  unload-stamped er-ring (v1.432 — `erPrevDirty()` finally DETECTS dirty ends instead of asserting).

## Also shipped today

- **v1.428** — `_frameRetryUpgrade` failure crumb (the last silent realm blind spot).
- **v1.429** — Fable review of todo_checkWithFable **#6** (3 PASS, 1 finding): the v1.424
  `_piperInitP` guard did NOT cover the read-during-respawn race; fixed (`_frameRespawnP` publish +
  await), 2 sabotage-proven tripwires. Entry 6 moved to Reviewed.
- **v1.433** — **TODO #89 built by Fable**: sleep rolls the clock to DAWN (the Day boundary IS dawn,
  `clock%1440==0` ≈ 6am, ratified). `[REST:long]` reused as the overnight marker (no new tag);
  same-response TIME_ADVANCE absorbed (the 28h-sleep guard); 30d/response advance cap (loud); the
  spell-less-character Rest fix. Golden doc hash re-baselined (+369 chars). **todo_checkWithFable #3
  (campaign clock) reviewed and moved to Reviewed** (4 PASS, 1 finding fixed = the cap).
- **v1.430-432** — the B9 experiment chain (playback hygiene + ctx recycle, falsified by design;
  the evidence plumbing that made the root cause findable).
- **Docs:** DOC/piper_deepdive.html (the external deep dive) · DOC/DOC_server_tts.html (R1 design).
- **/bugs**: B17 filed + investigated (`findings-ready`) — GM re-offers a location with no memory
  of its destruction; root cause = NO channel serves a remote location's history (LOCATION_DESC is
  write-once by design; locations[].notes is dead code; RAG's location bonus is current-location-
  only; recency windows scrolled past). Fix sketch: `[LOCATION_STATE:]` + capped stateNotes[] +
  always-present roll-up. **Drift surface, Fable-tier, design conversation wanted before code.**

## Open rows / queues

- **TODO #90** — server TTS. THE next build. Fresh session, D1-D5 first.
- **B17** — `findings-ready`, Fable-tier, wants a short design talk (location-state tag semantics).
- **TODO #88** — suggestion-button punctuation (S, Sonnet, backlog).
- **Fable review queue** — entries **5, 4, 2** pending (6 and 3 closed today); order 5 → 2 → 4.
- **B9 watch** — field validation of the governor: expect `piper-governor` crumbs and NO
  narration-death crumbs; `gv:1` on a death = lower the budget constants.
- **B13 / B15 / B16** — unchanged from the last handoff.

## Gotchas that cost time today

- **⚠ A satellite's "counter" can be a pre-filled INPUT.** The "survived 500 synths" reading was the
  soak's target field; the run had actually died at 29 and the boot forensics knew. Cost: a whole
  analytic arc built and retracted. The record shows both — worth reading as a lesson in premise-checking.
- **⚠ Self-mailing instruments mail their own test data.** The v0.10 preview verification auto-sent
  its planted crumb; it arrived looking like a field death with an invented synthCPU. Ledgered
  do-not-cite. When an instrument reports automatically, its verification runs become plausible
  fakes — ledger them at birth.
- **⚠ The unload stamp defeated its own test** — planting a dirty ring for the kill-simulation got
  clobbered by the stamp firing on navigation. Silence the guard to test the guard.
- **The v1.424 respawn-ordering tripwire caught MY refactor** during the entry-6 fix (moving code
  out of the function it greps). The guards guard the guardsman; keep them.

## Where to start next session

1. **TODO #90 (server TTS)** — read DOC/DOC_server_tts.html, get D1-D5 ratified, build M1.
   Server repo: `C:\Users\hannu\Projects\traffic-and-dragons-server`; deploy `flyctl deploy --ha=false`.
2. Or **B17's design talk** (short) if the user wants the location-history fix first.
3. Watch the feed for `piper-governor` / `gv:1` crumbs — one constant-tune may be wanted.
4. Fable queue entries 5, 2, 4 whenever there's slack.
