# TODO 19 — Safari Bluetooth playback after microphone capture

Owner report, 2026-09-16: iPhone 12 Pro Max, Safari home-screen bookmark. One narration
played through the car stereo, later narrations through the phone. YouTube Music uses
the stereo normally. iOS version and installed-web-app versus ordinary shortcut mode
have not been established.

## Mechanism and scope

The previous row tested Media Session transport controls and overclaimed that app
wiring was cleared. Those handlers do not verify the physical audio route.

TTS's primer is an all-zero WebAudio loop, not an explicit playback-category request.
STT stops native recognition or cloud recording, but previously made no audio-session
transition afterward. This leaves routing to Safari's heuristics across the microphone
handoff. The reported sequence matches [WebKit issue 282939](https://bugs.webkit.org/show_bug.cgi?id=282939).
That report supports the hypothesis; the user's physical route has not been reproduced
on this Windows development host.

[Audio Session specification](https://w3c.github.io/audio-session/): AudioContext defaults
to ambient; microphone capture uses play-and-record; playback-only sessions are
incompatible with a live microphone. Therefore playback must be released before
capture starts and restored after capture actually ends.

## Implementation

- One TTS session setter, feature-detected, with attributable warnings and visible
  failure toasts. Playback is requested before primer reuse and native speech.
- Both STT implementations call the same capture handoff: auto before starting
  capture; playback after native onend or after MediaRecorder tracks stop.
- The capture guard prevents a concurrent primer request from selecting playback
  while the mic is live. Subscribers are notified after the session transition.
- A dictation-only session stays auto; closing the narration context releases its
  playback preference. No forced selection of the car microphone or device ID.
- No additional contexts, sources, timers, event listeners or network requests.
  The existing singleton primer remains bounded across repeated captures.
- No drift-stack, prompt, transcript or storage-schema edits.

## Verification and remaining acceptance

Regression tests were written before the implementation. After completing the browser
fixture stubs, the original code failed six groups, including:
"mic end left Safari in its recording session" (play-and-record instead of playback),
and the modeled output remaining phone instead of car.

The tests execute real TTS/STT code with simulated browser audio primitives. They cover
repeated native/cloud capture, Stop/Cancel ordering, permission/start/recorder failures,
primer reuse during recording, absent API, dictation without narration and rejected
session changes. These prove application ordering, not actual iOS routing.

Verification on 2026-09-16: `node dev/run-tests.js` passed ALL GREEN: 2,199 engine
assertions and 38 standalone suites, including all eight Bluetooth session groups.
`node dev/lint-todo.js` and `git diff --check` passed. Full local output:
`testRuns/todo19-full-gate.log` (not committed). No production deployment or hardware
acceptance is implied by automated tests.

Parked-car acceptance on the owner's phone:
1. Load v1.943, connect the same stereo and play the first narration.
2. Dictate an action and listen to the next two responses.
3. Open and cancel the mic, then replay narration.
4. Verify each narration uses the stereo and dictation still works.
5. If it fails, record the iOS version, displayed app version, and whether output
   moves when the mic opens or remains wrong after it closes.

## Deployment integration, 2026-09-16

Owner requested commit and deployment. The initial push was rejected because production
had advanced to d23405f (v1.942). Rebased the Bluetooth change onto that commit,
kept its TODO #6 changes, and assigned Bluetooth v1.943 with a fresh cache marker.
Production CI on d23405f already failed its v1276 replay at byte 4379 (expected
12585 bytes, replayed 12709); this is separate from the Bluetooth change. No replay
baseline or drift-stack code was changed to clear that failure.

## Second pass, 2026-09-22 (v1.972)

Owner field result on v1.943: narration now reaches the car stereo (the routing half
works) but is unintelligible — "the Bluetooth drops in and out rapid fire". Bluetooth
headphones and YouTube Music in the same car are clean.

### What is established (code read, WebKit source, Apple forums; no car hardware)

- iOS routes any active capture over the hands-free profile (HFP/SCO: 8–16 kHz mono, no
  retransmission). A2DP cannot be duplex (Apple forum 730599, 737904).
- WebKit's play-and-record is PlayAndRecord + AllowBluetooth + AllowBluetoothA2DP +
  DefaultToSpeaker (`AudioSessionIOS.mm`). `navigator.audioSession.type = "playback"` is an
  immediate category OVERRIDE (`DOMAudioSession.cpp`), and while an override is set WebKit
  refuses its own category updates ("override set, NOT changing").
- The iPhone runs the cloud STT path: `webkitSpeechRecognition` does not work in home-screen
  web apps (Apple forum 748048). Push-to-talk, one mic cycle per turn — so the profile
  switch is per turn, and a RETAINED route explains a rapid symptom better than flapping.

### Ranked candidate mechanisms (none confirmed)

1. Narration riding the hands-free link after a mic cycle: the `playback` re-assert lands
   synchronously at capture end while iOS is still tearing capture down. SCO breaking up
   IS "drops in and out rapid fire"; wideband SCO on headphones merely sounds tinny. The
   app's idempotence check reads back what it set, not the effective category.
2. Per-sentence gaps meeting head-unit silence-mute: units are gapless only while synthesis
   stays ahead, and the primer emitted exact digital zeros between them.
3. Toggle-style Media Session handlers: `play` and `pause` both ran `_carTap()`, so a head
   unit's own redundant PLAY paused the read and an idle PLAY replayed it mid-turn.

### Shipped

- Instrumentation on the #16 crumb ring (24 entries, File ▸ ⚠ Report bug): `audio-session
  from>to` on every real type transition; `ctx-state <state>` on every narration-context
  state change (2 s window per state); `read-route <why> ol= bl= st= as= cap=` at read start
  (`outputLatency`/`baseLatency` in 5 ms buckets, coalesced, forced on the first read after a
  capture); `media-action <kind> <state> #n` per transport command (2 s window per kind).
- The primer floor is full-scale noise under the 1e-4 gain (−80 dBFS): never digital silence.
- Idempotent transport (`_carTransport`): `play` resumes only a paused read, `pause` pauses
  only a playing one, idle `play` replays only when no turn is in flight and the mic is closed.
- Batteries written failing-first: `dev/tests-19-audio-session.js` (12 groups, four new) and
  `dev/tests-19b-carmode-transport.js` (8 groups, four of which fail on v1.971).

### Deliberately not shipped

The delayed or re-kicked `playback` re-assert for mechanism 1. Under one plausible WebKit
model (capture accounting lingering after the tracks stop) a blind `auto`→`playback` re-kick
flips the car BACK to hands-free right before the read, and the field shows the current
override does apply (the audio reaches the car at all). The timing change waits for evidence:
a `read-route` crumb whose `ol=` is short while `as=playback` would justify it.

### Reading the next drive's crumbs

| Ring shows | Meaning |
|---|---|
| `read-route … as=playback` with a SHORT `ol=` after a capture, long before it | mechanism 1: the read is on the hands-free link |
| `ctx-state interrupted` bursts around reads | the car is flipping profiles under the context |
| `media-action play playing #n` with n climbing | the head unit sends PLAY on its own (mechanism 3, now harmless) |
| none of the above, still choppy | mechanism 2 or car-side A2DP; compare the native voice |

Two-minute checks: one full narration BEFORE any mic use; the head unit's screen during a
garbled read; the 🎙 telephone-quality toast; the native voice for one turn; ambience off.

## Third pass, 2026-09-22 (v1.973)

Owner, same day: plain narration (Car Mode off) over the car's Bluetooth stutters exactly the
same way. That demotes mechanisms 1 and 3 above — neither the mic cycle nor the transport
handlers run in plain narration — and asks what every WebAudio read does regardless of mode
that only a car would notice.

### Mechanism 4 — Now Playing metadata churn

`_armPosState` (tts.js) pushed `navigator.mediaSession.setPositionState` every 2 s for the
whole read, with a duration that GREW as units were scheduled. On iOS each push is a Now
Playing metadata update, and each of those is an AVRCP notification to the head unit; some
units glitch their A2DP decode for a moment on every one. iOS itself throttles apps that push
too often ("Application exceeded audio metadata throttle limit", Apple forum 785411), and
Apple's guidance is to push only when the playing item changes. Headphones ignore metadata;
YouTube Music pushes only on a track change. This fits every observation so far.

### Shipped

- One push at read start (duration estimated from every queued character at the current rate,
  position 0, playbackRate 1) and one clear at read end, only if something was pushed. No timer.
- `dev/tests-19-audio-session.js` gains `position state is ONE push per read, never a timer`
  (fails on v1.972: the seam did not exist and the ticker armed an interval).

### Next drive

Plain narration first. Stutter gone: mechanism 4 confirmed, the row closes. Stutter still
there: the `read-route` crumbs and the native-voice check decide between mechanism 2 (the
WebAudio path) and the car itself, then File ▸ ⚠ Report bug.

## Fourth pass, 2026-09-23 (v1.974)

### Field result on v1.973: the stutter is CarPlay's

Owner: the stutter persisted THROUGH CarPlay; skipping CarPlay and connecting the phone to the
same car by plain Bluetooth, the audio was smooth. So mechanism 4 (the Now Playing ticker) was
not it either, and every earlier "over Bluetooth" test was in fact over the CarPlay link.
Direct Bluetooth is the working configuration today.

What is specific to CarPlay and worth one check each: wireless CarPlay carries audio over Wi-Fi
and is CPU-sensitive (a WASM synthesis tier in the page could starve it — compare the native
voice and the server tier through CarPlay); CarPlay throttles Now Playing updates (now one per
read); the CarPlay route's buffer differs from A2DP (the `read-route` crumbs will show its
`ol=`); a wired CarPlay connection, if the current one is wireless.

### Field correction: the iPhone runs the NATIVE recognition path

The options were read aloud (the cloud path never auto-reads them) and the microphone prompt
came from the recognizer start, so `webkitSpeechRecognition` works in the owner's home-screen
app. The 09-22 "cloud path" note above is withdrawn; the auto-mic loop DOES run on the iPhone.

### Owner ruling: "When car-mode starts, just read the current scene, and jump to options."

Shipped: `_carOpen` — `STT.warmMic()` first (the permission prompt lands while parked), then
`carSceneBrief()` (where you are + the last two sentences of the last narration, capped), then
the normal options-then-mic loop. An entry within two hours of the last turn skips the brief.
The full recap stays on the spoken "previously". Batteries written failing-first:
tests-19 (three warm-up groups), tests-19b (four entry groups), tests-19c (five brief groups).

### Owner verification, 2026-09-23 (v1.974, direct Bluetooth)

"Mic permission comes up immediately. Voice is great. Car mode is working well." The routing
half (v1.943), the entry change (v1.974) and the voice path are field-verified. The only open
item is the CarPlay stutter; direct Bluetooth is the working configuration.
