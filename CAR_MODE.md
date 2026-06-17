# Car Mode — Planning Doc

## What it is

A hands-free, eyes-light way to play while driving: the GM **speaks** the scene and reads the
options aloud, you **speak** your choice, and the turn loops — no tapping, no reading required.
This is the XL "hook" feature (TODO #5). Same stack, no build step, no new deps for the core loop.

The good news: **both halves already exist.** This feature is mostly *wiring* and *UX*, not new tech.

---

## Foundations already shipped (what we reuse)

| Piece | Where | Role in Car Mode |
|---|---|---|
| **TTS** (Cartesia, streaming) | `tts.js` — `TTS.isOn()`, `speak()`, `speakResponse()`, queue + `_drain()` | Speaks the narration **and** the options aloud |
| **STT** (Web Speech API) | `stt.js` — `STT.toggle()`, dictates into `#userinput`, `isAutoSend()`→`sendAction(null)` | Captures the spoken choice |
| **Auto-send** (v1.40) | `stt.js` — on a final transcript, fires `sendAction(null)` | Sends the spoken turn with no tap |
| **Suggested actions** | `parseActions()` → `.qa` buttons with `data-action` | The numbered options to read + match against |
| **Turn entry** | `sendAction(override, opts)` | One call per turn |

**The missing piece is the loop closure:** after the GM finishes speaking, automatically start
listening; after a final transcript, auto-send; repeat. Today STT is manual-tap and TTS has no
"finished" callback. That single seam is Phase 1.

---

## The core loop

```
GM responds
  → TTS speaks the prose
  → TTS reads the options as a numbered list ("Option 1: …  Option 2: …  Option 3: …")
  → [TTS finishes]  ← the new hook
  → STT auto-starts listening
  → player speaks:  a number ("two" / "option 2" / "the second one")  → maps to that .qa action
                    OR free-form speech                               → sent as the action verbatim
                    OR a command ("repeat" / "stop" / "pause")        → handled locally, no turn
  → auto-send → next GM turn → loop
```

**Loop closure (Phase 1):** `TTS._drain()` already detects queue-empty (the "all narration done"
point). Add an `onComplete` callback there. In Car Mode, that callback calls `STT.start()`. STT's
existing auto-send then fires `sendAction(null)` on the final transcript. The response triggers
`TTS.speakResponse()` again → the loop self-sustains.

---

## Numbered-option voice selection

The options are already in the DOM as `.qa` buttons (`data-action`). Two layers:

1. **TTS side:** today `speakResponse()` reads the raw `*You could A; B; or C.*` line. Car Mode reads
   it as **"Option 1: A. Option 2: B. Option 3: C."** so the player has stable handles.
2. **STT side:** parse the transcript for an ordinal/number — `one|two|three|first|second|third|last|
   option N|number N` — and map to the Nth `.qa` button's `data-action`. If no number matches, treat
   the whole transcript as a free-form action (the GM handles arbitrary input fine).

No need to store options in a global — read the live `.qa` buttons at match time (single source).

---

## The Car Mode shell (UX)

A dedicated mode, not just toggles. Entering Car Mode (one **🚗** button — also the required user
gesture for AudioContext):
- Forces **TTS on** + **STT auto-send on** for the duration; restores prior settings on exit.
- Swaps to a **minimal, high-contrast screen**: current location + HP, a huge mic state indicator
  (idle / listening / speaking), and 2–3 oversized controls (Repeat · Pause loop · Exit). No reading
  required to play.
- **Voice commands** handled locally (never sent as a turn): `repeat`/`say again` (re-read options),
  `pause`/`stop` (halt the loop), `resume`, `exit car mode`.

---

## Hard problems & how we'll handle them

| Problem | v1 approach |
|---|---|
| **Listen vs. speak collision** (mic hears the GM's own TTS) | v1: **don't** listen while TTS plays — only `STT.start()` *after* `_drain()`. Barge-in (interrupt the GM) is a Phase-4 nice-to-have. |
| **Mishears / no speech** | On STT `no-speech`/`error`, speak a short "I didn't catch that — say it again," then re-listen. Cap retries, then idle. |
| **Ambient car noise** | Web Speech is the unknown here (see Risk). Number-words are short/robust; free speech is the fragile part. |
| **Mobile/iOS** | AudioContext + SpeechRecognition both need a user gesture → the 🚗 entry tap covers it. iOS Safari Web Speech is flaky — real-device test gates this (ties to TODO #19). |
| **Safety** | Big targets, no required reading, a one-tap Exit, and the loop pauses on any error rather than spinning. |
| **`busy` races** | The loop is strictly serialized: listen only after a turn fully completes (TTS done = turn done). Auto-send already guards on `!busy`. |

---

## Open decisions (need your call — flagged for the build session)

1. **Hands-free purity:** fully auto-listen-after-TTS (true hands-free, riskier with noise/mishears),
   or **push-to-talk** (tap the big button to speak — safer, still eyes-light)? *Recommend: build the
   auto loop, but keep a push-to-talk fallback toggle for noisy environments.*
2. **Selection style:** numbered options only, free speech only, or **both**? *Recommend: both.*
3. **STT engine:** Web Speech (free, zero-dep, in hand) vs. Whisper-via-fal (better accuracy, latency +
   cost). *Recommend: ship on Web Speech, switch only if the real-device test fails — see Risk.*
4. **Wake word** ("Hey GM…"): out of scope for v1? *Recommend: yes, defer.*

---

## Build phases

| Phase | Scope | Est. |
|---|---|---|
| **1 — Close the loop** | `TTS._drain()` onComplete → `STT.start()` → existing auto-send. A bare 🚗 toggle that forces TTS-on + STT-auto. Prove the hands-free turn cycle end-to-end. | M |
| **2 — Numbered options** | `speakResponse()` reads "Option N: …"; STT number-word → `.qa` match; free-speech fallback. | M |
| **3 — Car Mode shell** | Dedicated minimal UI, oversized controls, local voice commands (repeat/pause/resume/exit), settings save+restore. | M |
| **4 — Robustness** | Mishear recovery, retry caps, optional barge-in, **real-device (Android Chrome + iOS) testing**. | M–L |

Phase 1 is the spike that proves the whole thing; if the loop *feels* right, the rest is polish.

---

## The one risk that could change everything

**Web Speech accuracy in a moving car.** Everything above assumes Web Speech transcribes well enough
over road noise. If the real-device test (TODO #19) shows it can't, the STT engine swaps to
Whisper-via-fal — which changes latency, cost, and the listen/send timing (Whisper is record-then-send,
not streaming). The *loop architecture* survives either way; only the capture step changes. So:
**do the Android-Chrome accuracy test early in Phase 1** before committing to the auto-listen feel.

---

## File touch-list (anticipated)

- `tts.js` — add an `onComplete` hook fired from `_drain()` when the queue empties; a "read options as
  numbered list" mode.
- `stt.js` — a Car-Mode listen cycle (start after TTS, retry on no-speech); number-word → action parse.
- new `carmode.js` (likely) — the mode controller: enter/exit, settings save/restore, the loop glue,
  local voice commands.
- `dnd_game_1_0.html` + `ui.js` — the 🚗 entry button and the minimal Car Mode overlay/shell.
- Script load order: after `tts.js`/`stt.js` (depends on both).
