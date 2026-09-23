# L7 accent layer — implementation and verification (v1.975, 2026-09-23)

**TLDR:** the Opus-tier half of the owner-approved accent design (Proposal_general_audio.html §21) is built: a place can now play occasional short sounds over its bed, never over narration. The first set, footsteps on a wooden floor, is bound to the Village tavern; the owner approved its mix by listening (v1.976), so the tavern plays it. Chimes and bells wait for the Fable review of the new content words.

## What shipped

| Piece | Where |
|---|---|
| Layer-kind table (bed, accent), selection, sprite admission, the pure `accentNext` scheduler, the accent controller | `audio-accents.js` (new; loads after `ambient.js`) |
| One media lookup for beds and sprites (`audioAssetMedia`) | `audio-loader.js`, used by `audio-cache.js` (service worker) |
| Bed selector can never pick an accent set | `audio-profile.js` (`a.role!=="accent"`) |
| Tavern seed lists its accents | `audio-scenes.js` (`accents:["footsteps-wood"]`, replaces the unused `layers:[]`) |
| Driver: shared loader, bed-first decode ordering, memory shedding, burst playback on the AudioContext clock | `ui-ambient.js` |
| Accent entries in the delivery catalog, with refusals for malformed sets | `dev/audio-delivery.json`, `dev/build-audio-catalog.js` → `audio-catalog.js` |
| Sprite packer | `dev/prepare-accent-sprite.py` |
| Footsteps sprite (Nox Walk 01–05, 3.78 s, 61,440 bytes) | `sfx/accent-footsteps-wood-v1.mp3`, provenance in `sfx/interior-and-layer-provenance.json` |
| "Play as in game" audition over any bed, with a narrator toggle and 10× gaps | `dev/accent-audition.html` |

Owner rulings applied: accents from the place (seed or profile) first, GM cues later; never over narration; footsteps only where people are about (`needsAny: voices|crowd`, interior); church bell outdoors only (recorded for the bell set, not built); under rain chimes play and footsteps stop (`rain: "stop"` on footsteps; no weather producer exists yet, so nothing is suppressed today).

## Found during verification

**Footsteps never loaded in the real page.** The controller correctly defers its load while the bed decodes, but nothing calls `update()` when the bed's decode settles, so the set waited for an unrelated UI event. The first controller test hid this by calling `update()` again by hand. Fixed test-first: the test now advances time without an update and expects the load (red before the fix), and a deferred load re-checks every 500 ms. A mutation clause removes the retry and is caught.

## Evidence

- **Engine suite:** four new `L7 accent` tests (selection, scheduler, burst, sprite admission). Full gate: see the commit's hook output.
- **Standalone suite** `dev/tests-accent-layer.js`: controller over a fake clock (bed first, deferred-load retry, arrival quiet, settle window, narration fade 0.15 s, mic cut with no backlog, leave releases buffers, memory refusal warns without a toast, real failure reported, shed and reload, dispose); nine catalog refusals; the real sprite through checksum, loader and service-worker cache.
- **Mutation proof** `dev/sabotage-accent-layer.js`: 16 clauses, every one caught by its named test, files restored byte-identical. The first run exposed a spacing rule no test exercised (clause MISSED); a test case now covers a set falling due inside the 30 s spacing.
- **Chrome (browser pane, localhost, service worker cleared), compressed timing:** tavern bed plus accent set loaded (decoded 7.54 MB total); bursts of 3–7 real cuts ~0.5 s apart, no step repeated back to back; 0 accents during 7 s of simulated narration and the playing burst stopped; 0 inside the settle window, first accent 2.6 s after narration ended; car-intent pause cleared the schedule with 0 plays; leaving the tavern released the accent buffer and switched to the evening exterior bed; no console errors.
- **Audition page:** real click, 10× gaps: first burst 2 s after start, next drawn 9–24 s; narrator toggle held accents for 20 s, then they resumed.

## Owner acceptance (v1.976)

The owner listened in `dev/accent-audition.html` over the tavern crowd and approved: "Sounds great" (2026-09-23). `mix` is now true in the delivery catalog, so the Village tavern plays the footsteps.

## Level range (v1.977)

Owner ask 2026-09-23: rather than one volume per set, a range — footsteps 35% at the quietest, 70% at the loudest, drawn once per walk (owner chose per walk over per step). `sprite.gain` is now a `[min, max]` pair; `accentLevel` draws it inside `accentNext`, the builder refuses a reversed or single value, a scheduler test requires every level inside the range and the range actually used, and a mutation fixing the level at the top is caught. Audition page, four plays: 45%, 49%, 52%, 65%.

## Not claimed

Phone/background behaviour; chimes, bells and the bowls (Fable vocabulary review, then sprites); cued accents (the §9 event project); the weather rule in action (no weather producer yet).
