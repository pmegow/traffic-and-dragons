# L1/L7 blacksmith ambience pilot

Owner authorized work after the Fable/panel review and then supplied #410's `document` event contract. Scope is one optional fire loop, not hammer activity or narrative cues. [Current brief](../DOC/PROPOSAL_Village_Blacksmith_Ambience.md).

The missing mechanism was an ambience controller plus additive lifecycle notifications. TTS's and STT's existing single callbacks belong to Car Mode; installing ambience through them would replace Car Mode. The new event subscribers coexist with those callbacks. Microphone silence precedes native recognition.start and cloud getUserMedia, not their later success notification. Player pause/resume arrives through the existing document event; internal TTS.stop is not a player hold.

Runtime resource bounds: one Sound context shared with UI sounds; TTS context remains private; at most one ambience source, buffer and load/decode. New scenes wait for cancelled decoding to settle, since decoding itself cannot be aborted. Generation changes prevent stale playback. Audio failures are surfaced and latched against repeated UI retries. Pagehide disposes playback; preference restoration requires another gesture. No campaign data writes, prompt changes, parser changes or new tags.

Asset: 18 s mono candidate from the longer campfire; 289,270-byte MP3. Browser decoded allocation 3,456,000 bytes at 48 kHz. Crossfaded WAV and metadata receipts under ignored Audio/Prepared; delivery provenance in sfx/README.md. Approval remains the owner's listening decision.

Verification:

- Test-first policy failure: `ambientPlan missing`; policy test subsequently green. An initial incorrect filter invocation ran zero tests and was corrected before implementation.
- Full regression: ALL GREEN, 2,169 engine assertions plus all standalone suites (including nine new L7 test groups).
- Initial source-contract failure came from Windows CRLF translation while editing; restored LF and reran successfully. Isolated STT harnesses and the designer also needed the shared event script loaded before STT/TTS; existing assertions were preserved.
- `dev/qa-l7-ambient.js`: real MP3 decode; default off; canonical fixture; 100 UI refreshes without restart; open at 8 am, closed at 6 pm; leave/reentry; pause/resume; multiple loop wraps; showChar cleanup; explicit file-origin unavailable; actual TTS scheduler with synthetic PCM verifies duck/restore and coexistence with legacy done callback. No paid requests. No browser page errors. Desktop and 390 px screenshots inspected.
- `dev/sabotage-l7-ambient.js`: 11/11 clauses caught by their named tests, working files restored byte-identical. The first proof run exposed missing working-copy dependencies in the isolated clone; the next exposed a weak assertion that allowed silence to count as ducking. Dependencies and the assertion were corrected, then all clauses proved. The production hidden-narration behavior already retained the scene.

Remaining acceptance: real owner save binding (no village export available), subjective ten-wrap audition, narration balance on the owner's voice, Safari/phone/Car Mode background behavior. The local technical fixture is not an owner listening result. No deployment or push performed.

## v1.929 — unfiled smithy arrival

The owner enabled ambience but saw “Waiting for an open smithy.” A read-only check of the live save found The Village as the world location, no sublocation, and an open smithy node. The latest GM reply said “You step back through the smithy door” but omitted SUBLOCATION after an earlier SUBLOCATION_LEAVE. The existing filing watcher explicitly skips child nodes; its generic fallback does not cover smithies.

Owner authorized the engine repair and asked us to wait until Fable finished shared-file work. Fable completed and pushed v1.928 before these edits. The bounded repair in game.js detects explicit party arrivals into known interiors of the current world and immediately arms the existing GM-decides location reminder. api.js prepares the same reminder from only the latest committed assistant reply when loading an affected save. Player wishes, dialogue, hypothetical/future movement, scenery, departures, refusal turns, other-world rooms, and already-filed interiors cannot establish an arrival. Prose never changes canon or drives audio. The eight-turn world-location watcher remains unchanged.

Three test-first engine assertions reproduced the failures (skipped interior, missing detector, missing reload recovery). They now cover the exact owner sentence, negative cases, explicit-tag authority, one-shot consumption, failed-request retry and stale-history exclusion. Browser QA starts with the untagged save, verifies silence and the location question, then feeds the explicit GM tag through applyMuts and observes real MP3 playback. The model response is simulated; there were no paid requests and no writes to the owner's campaign. An existing affected save needs a subsequent GM response to file its location.

The original pilot verification above remains historical. This repair changes a volatile engine note, not the stable system prompt or STATE TAGS documentation. Listening approval and phone/Car Mode background acceptance remain with the owner.

Repair verification: full regression ALL GREEN (2,177 engine assertions plus standalone suites); five of five named sabotage clauses caught and source bytes restored; stable system prompt and STATE TAGS byte-identical to v1.928; Chrome browser QA green with real decoded audio and zero page errors.
