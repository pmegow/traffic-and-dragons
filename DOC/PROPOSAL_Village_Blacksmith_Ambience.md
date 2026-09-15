# Village blacksmith ambience pilot — implementation brief

Owner authorized implementation on 2026-09-14 after [Fable and panel review](panel/reviews/village/blacksmith_audio_proposal_review.html). This revision incorporates the final review and the newer #410 Car Mode contract. Implementation stays off the prompt, tag, memory and campaign-save surfaces.

## First listening experience

One fire at the Village's canonical smithy (shipped opt-in and default-off; owner turned ambience ON by default in v1.936, 2026-09-15). No music, hammering or transaction sounds in this slice. File → Settings contains Village ambience and a separate volume control beside UI sounds. Settings persist on this device; a gesture unlocks browser audio after a reload.

The room keeps one stable recording. UI refreshes and narration do not restart it. Fire fades in and ducks about 10 dB during a read, including its synthesis wait; finishing narration restores the level. Leaving the room, closing time, switching campaigns, leaving gameplay, disabling ambience, or pausing releases playback. Microphone capture silences the gain synchronously before native recognition or cloud getUserMedia starts, and keeps it silent until capture ends.

The implemented #410 vocabulary is **pause/resume**, not the earlier proposed spoken Stop. Ambience subscribes to `tnd:car-intent` on `document`, reading `detail.kind` equal to `pause` or `resume`. A pause holds ambience until resume; internal `TTS.stop()` cannot create that hold. Ordinary TTS pause also quiets ambience. The mic is closed during narration, so interrupting narration still requires the existing tap/control. No new voice command or parser change is required.

When hidden, retain the ducked scene only while narration is active; otherwise release it. Background playback remains subject to the phone/browser's audio-session policy. The audio controller never suspends or closes Sound's shared context, so it cannot disable UI clicks.

## Scene facts and assets

Resolve `currentNodeKey()` through `locResolve`, and compare it with the canonical commons entry under the current village. Never match prose, a loose display-name substring or a resident's usual base. Read the node's filed opening hours using the fixed `clockMinuteOfDay()` (#409), including overnight hours. Unknown hours stay silent and are named in settings. The live owner's save has not yet been available as an export; canonical binding is verified against an engine fixture and remains a real-campaign acceptance check.

Fire while the smithy is open is the pilot's authored ambience policy. Hammering requires an engine-owned **activity** fact that does not currently exist. Residency is not presence, and witnessed presence is not work. Do not manufacture an activity record or infer it from prose for audio.

Candidate: `Audio/Ambient/Fire/Campfire Fire Loop.wav`. The last available review export has no approved files; its shorter fire is rejected. This candidate remains pending owner listening, and no review selections are changed.

Preparation selects source seconds 9–29, averages to mono, removes DC, overlaps the last and first two seconds with a raised-cosine crossfade, and normalizes peak to −6 dBFS. The resulting WAV master is 18 seconds; MP3 delivery is 128 kbps, 289,270 bytes. Originals and prepared WAVs remain under ignored `Audio/`. A preparation receipt records hashes and processing parameters.

The manifest limits the bed to ≤20 seconds, one channel, ≤500 KB encoded and ≤4 MB decoded. Loop bounds are measured against decoded playback, never a guessed MP3 padding amount. Chrome at 48 kHz decodes this asset to exactly 18 seconds / 3,456,000 bytes, with loopStart 0 and loopEnd 18. Safari/phone listening remains an acceptance check; source-waveform continuity does not certify perceived looping.

## Implementation

- `audio-scenes.js`: registry of canonical binding, fixed bed asset, volume, loop bounds, resource limits and an empty future layers list.
- `ambient.js`: node-safe `ambientPlan(snapshot, registry)` plus an injected playback controller. Snapshot includes campaign/node identity, canonical common, hours result, enable/unlock/volume, screen visibility, narration, capture and pause state. Future activity/weather/speaker facts are optional extensions; the pilot does not invent values for unavailable facts.
- `ui-ambient.js`: read-only snapshot adapter, Web Audio driver, persisted device settings and subscriptions. Sync at `syncUI`, showGame/showChar, voice/capture, visibility and Car Mode boundaries; no polling.
- `audio-events.js`: additive event subscribers, exception-isolated and removable. TTS emits its playing/paused state; STT emits capture boundaries before opening either mic path. Existing `setOnDone`/`setOnState` callbacks retain their behavior and are never replaced by ambience.
- `Sound.context()` exposes the existing lazy singleton. TTS retains its private playback context. No additional ambience AudioContext.

One playing source, one retained decoded buffer and one load/decode job maximum. Leaving invalidates the generation, aborts network work and releases playback/buffer ownership. An unabortable decode must settle before another begins; stale completions cannot play. Failed assets report a reason and wait for an explicit retry or scene re-entry, rather than retrying every UI update. Network header/body work has a 15-second abort deadline. ES5 game modules, no runtime dependency or build step.

## Delivery and verification

Ship the versioned MP3 under tracked `sfx/` alongside the game. The service worker routes `/sfx/` network-first; engine modules join its app shell. R2 is deferred until library size warrants it. Direct `file://` gameplay continues to work, but ambience reports its unavailable reason once and stays silent; deployed HTTP(S) and localhost are the pilot targets. Offline ambience is not promised.

Tests cover canonical eligibility, open/closed/unknown hours, microphone ordering on both paths, narration priority, explicit pause/resume, source reuse, cancelled loads, campaign replacement, error retry bounds, channel/memory/loop limits and file-origin failure. Mutation proofs must fail by the named guarding test. Browser QA drives the real MP3 and real TTS scheduler with synthetic local response audio; it does not bill providers or modify the owner's campaign.

Owner acceptance: listen to at least ten normal-speed wraps, then narration over the fire; confirm the real smithy binding, volume, pause/resume and phone/Car Mode behavior. This is the decision about whether the candidate earns approval. Integration and technical tests can be complete while that listening decision remains open.

Later slices: activity-backed hammering, player transaction sounds, a second place and weather layers. Preserve one recognizable bed per place throughout.
