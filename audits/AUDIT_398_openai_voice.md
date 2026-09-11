# OpenAI voice option — #398

Built as v1.892 on the isolated codex/openai-voice branch, based on dd922a7.

## Trial

Open the feature preview, then File → Voice Settings. Add an OpenAI API key if one is not already saved, select OpenAI cloud voices, choose Marin or Cedar and press Test. Test uses the displayed delivery text even before it is saved. The key also serves the existing OpenAI features; saving it here leaves the GM provider unchanged. OpenAI API billing is separate from a ChatGPT subscription. Google remains selectable with its existing narrator/direction preferences.

## Mechanism and limits

The app had no OpenAI speech provider. Google already used a grouped synthesis conveyor; Stop only invalidated its playback epoch, leaving cancellation blocked behind a pending fetch. The cloud reader now accepts a provider adapter and registers its cancellation function directly with Stop/Skip. OpenAI uses gpt-4o-mini-tts at /v1/audio/speech, 24kHz signed PCM, two prefetched groups and a 20s whole-operation deadline. A rejected/stalled response degrades loudly, preserves the unread remainder and blocks another OpenAI attempt for 60s. An enabled OpenAI preference excludes automatic paid Google fallback, even if both keys and stale enable flags exist.

Google retains its voice mapping, model ladder, quota policy and startup priming. The shared reader keeps ordered playback, existing text preparation and local voice fallback. OpenAI cast voice selection is stable and excludes the narrator; it does not promise gender matching or unique voices for every NPC. Streaming within a response is not implemented: each short group is buffered before playback.

Memory/resource review: one shared AudioContext; at most two OpenAI requests/results held by the conveyor; scheduled audio retains the existing ahead-time bound. Each request owns one abort controller and one deadline, cleared on settle. Stop/Skip halt the conveyor and abort requests immediately; late results cannot schedule audio. Completed nodes disconnect and release their buffers. The audition ticker stops on playback/idle and self-clears if its button leaves the DOM. Error toasts expire after eight seconds. Preferences/key reuse the existing browser store; no per-turn persisted audio or new campaign fields.

## Evidence

- Failing-first engine run: three named #398 tests failed with “OpenAI provider missing”; the implemented selection, narrator validation and grouping tests pass.
- Ten isolated async groups in dev/tests-398-openai.js cover the request schema, stalled headers, stalled body even when fetch ignores abort, explicit cancellation, HTTP errors/malformed PCM, immediate Stop of all prefetched requests, Skip status cleanup, out-of-order synthesis, unread-remainder fallback and repeated auditions.
- dev/sabotage-398-openai.js: 9/9 named mutations caught. The initial paid-fallback fixture lacked a Google key; mutation proof exposed the gap and it was strengthened to seed both keys. The existing server-ladder sabotage target now includes OpenAI and still removes native from the final position. Its clone runner copied only the working tests, so its target still contained the old ladder before commit; copying the current source targets makes this proof usable pre-commit. All six server clauses pass. No assertion was loosened.
- Browser QA uses a fresh Chrome profile and synthetic key with the speech endpoint intercepted. It drives actual key-save/provider/Test controls, verifies the displayed voice and unblurred direction reach the request, observes Preparing 1s, cancels the request, switches back to Google, reopens persisted settings and checks mobile overflow.
- Screenshots: [before](screenshots/398-before.png), [desktop](screenshots/398-desktop.png), [mobile](screenshots/398-mobile.png). Reproduce: node dev/qa-398-openai.js (Node 22 and installed Chrome); an optional Pages URL exercises the deployed preview.

Full gate: 2,082 engine assertions and 31 standalone suites pass. All four CI replay fixtures (v1238, v1258, v1271, v1276) match their committed end states. CI receipts will appear on the PR. No live OpenAI API key was available in the agent environment, so real provider access, latency and listening quality remain the owner's audition. Browser QA uses invented text only; no campaign save or credentials are committed.

Official API source checked during implementation: https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create and https://developers.openai.com/api/docs/guides/text-to-speech.
