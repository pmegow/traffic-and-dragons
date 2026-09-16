# L7 general ambience — v1.941

Owner authorization: implementation approved after proposal/Fable discussion; explicit exceptions granted for audio-only changes in tag_table.js, api.js, memory.js, game.js, state.js, identity.js, index.html and sw.js. Fable's review is preserved in proposal section 19; disposition and actual scope are section 20. No further Fable round is required for this approved slice.

## Problem and resulting behavior

The pilot used named Village bindings and read live state during UI refreshes. The parser can refresh the UI before movement, consequences and saves settle, so that surface cannot safely publish dynamically classified scenes. The new immutable snapshot is published after accepted saves; nested turn saves are held until final commit. Device controls update gains immediately without rereading partially mutated scene state.

A bounded engine-only SOUNDSCAPE tag stages cosmetic metadata. The filer checks the final canonical location and request campaign/playback generation. Refused moves, refused narration, stale responses, parse errors and death/restore changes cannot file the proposed classification. Save failure publishes silence through the existing visible save-error policy. The standing STATE TAGS prompt is byte-identical; only the strip golden gains SOUNDSCAPE.

Missing classification is requested through the lowest-priority note builder, at most once per visit/node stamp, with the existing deferral and failed-call latch restoration. No paid classifier or prose detector. The request may arrive on the next ordinary turn after entering a new place. Import/load and direct saved actions publish their settled scenes. Metadata survives coherent identity merges; ambiguous merges/splits and changed location descriptions/state notes invalidate it conservatively.

## Playback and catalog

- One continuous bed; two sources only during the existing three-second overlap. Same campaign/role/recording retains its source across adjacent places.
- Existing Village fire/tavern filed-hours rules and exterior bands remain migration bindings.
- Any campaign can match a saved profile to the catalog by enclosure, setting, biome, clock, every inseparable content, explicit silence and independent recording/rights/contents/loop/mix approvals.
- Saved cohort and variant are engine-owned. Future cohort additions do not reroll existing places. Unknown or incompatible places remain silent.
- Original CC0 recordings and current versioned MP3 derivatives are unchanged. dev/audio-delivery.json holds the six delivery receipts; dev/build-audio-catalog.js hashes physical delivery files into committed audio-catalog.js. The game has no runtime build step.
- Generic coverage currently includes temperate outdoor morning, day and evening. Newer night/tavern derivatives keep existing Village behavior, but their prepared-loop/mix acceptance is not inferred from approval of originals. They are not newly enabled for generic matching.
- Device OFF/volume, autoplay recovery, minus-six-dB narration duck, gradual unduck, immediate mic silence and car pause/resume remain in effect. UI sounds retain their separate existing path.

## Resource ownership

The loader rejects unknown assets, verifies SHA-256 before decoding, limits streaming to 8 MiB, and reserves the decoded maximum before admission under a 48 MiB aggregate budget. A cancelled native decode retains its reservation until it settles; only one decode may be pending. Stale, stopped and failed sources release their records.

The service worker owns a manifest-hash-versioned audio cache with 32 MiB / 32 entries, LRU eviction and one serialized writer with at most eight queued requests. Queue overflow uses uncached delivery; the player still bounds and verifies bytes. Cache unavailability warns and falls back to network. The generic app-shell runtime cache no longer stores /sfx/. Only previously fetched recordings are available offline.

## Verification

- Test-first: missing validator/selector/filer and stale-request scope assertions failed before implementation.
- Full gate: 2,198 engine assertions plus 37 standalone suites (node dev/run-tests.js).
- Seven named mutation proofs: inseparable contents, explicit silence, frozen cohort, nested publication hold, material-change invalidation, request scope and refused destination. Initial contents/cohort mutations escaped because fixtures accidentally tested a contradictory profile and a different clock band; valid failure fixtures now catch both. No guard was removed.
- Standalone loader: oversized streamed body without Content-Length, exact byte boundary, cancelled-native reservation, release, aggregate decoded capacity and checksum rejection before decoding.
- Standalone cache: byte/object limits, LRU, offline hits and unavailable-cache fallback. Retained source proof applicability also runs in the full gate.
- Chrome general scenario: real sendAction with a stubbed GM response, staged versus committed classification, adventure playback of a real MP3, adjacent source reuse, explicit silence, pause/resume and actual saved reload. No paid model/TTS calls or live campaign slots used.
- Chrome Village transitions: fire/exterior three-second overlap, every clock band, tavern, narration duck, mic gating and rapid replacement. Peak two sources; 16,456,252 decoded bytes. Existing reload QA passed allowed autoplay, blocked mouse/touch recovery and saved OFF/volume.
- Chrome service worker: no app-shell duplicate, one audio cache owner, cached MP3 plays after an offline page reload.
- Local evidence (not committed): testRuns/audio-full-gate.log, testRuns/audio-mutation-proof.log, testRuns/general-audio-browser.png and Audio/Prepared/exterior-browser-receipt.json. Browser scripts are manual verification entry points, not part of CI.

## Remaining gates and deliberate limits

Owner listening acceptance of the full transitions and phone/background/thermal soak remain open. General fire/water features, simultaneous continuous roles, current activity evidence, normalized weather, event receipts, action effects and music remain later slices. Bulk content tagging and importing the entire local review/provenance library into authoring tooling are also open. The first slice uses checked-in delivery receipts, not automatic approval of the fifty-original library.

Commit-time fades are implemented; sentence-synchronized departure is not claimed. No narrative truth checker can prove a GM classification: restricted fields, public-evidence instructions, strict compatibility and silence for unknown facts constrain that residual risk. UI earcons remain outside the ambience mic bus as documented in the reviewed design.
