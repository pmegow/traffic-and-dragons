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
