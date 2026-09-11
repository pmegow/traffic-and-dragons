# #401 — Model-driven Voice Settings

Owner design, 2026-09-11. Published as v1.901 on owner request via [PR #11](https://github.com/pmegow/traffic-and-dragons/pull/11), merge `781b10d`, after all branch CI checks passed. [Production](https://traffic-and-dragons.pages.dev/) and the release deployment `14b08703` were verified on 2026-09-11.

## Cause and behavior

The previous dialog stacked OpenAI, Google, Piper and device controls. Its rate, cloud enable switches, key input, narrator and direction wrote immediately, while Save applied only the local fallback choices. Closing the dialog therefore could not discard an edit.

`ui-voice-settings.js` now owns the dialog. The primary-model dropdown chooses a form from `TTS.settings.models`. Settings and keys are copied into a draft; switching models keeps each draft, Cancel/close/Escape discards it, and Save validates the selected model before committing. Failed preference writes restore their prior values. Existing OpenAI and Google opt-ins, narrator IDs, keys and automatic cast mappings are retained. OpenAI still uses the shared BYOK key and does not change the GM provider.

Inworld TTS-2 and Speechify Simba 3.2 are available alongside the existing options. Their catalogs load explicitly with the draft API key and are retained only on Save. UI controls reflect documented capabilities: Inworld direction, stable/balanced/creative delivery, speed and auto/English/Korean language; Speechify emotion and speed, English. Korean speech does not translate the GM campaign. The test passage is editable, including Korean text.

Test explicitly auditions the draft and bills its selected API key. It never persists that draft or falls to another voice after a cloud error. Normal failed cloud reads retain local fallback. Each read snapshots its configuration; saving does not alter the middle of an already-running read. Both new adapters use the existing ordered two-group conveyor, 24kHz PCM and a 20-second whole-operation deadline. Stop and Skip abort pending requests. Streaming-first-byte playback is not added: each bounded group is collected before playback, as with OpenAI.

## Temporary cast surface

`TABS.cast` and `renderCast` in the UI file are the removable surface. Delete the registry entry to hide it; the settings implementation does not depend on the tab. It maps existing character-sheet/star-bench voice slots to provider actor IDs. Everyone sharing a slot shares its actor. The dialog identifies currently assigned characters. These mappings are device-local, per model, and never rewrite NPC identity, sheet schemas, `[SAY:]` attribution or the GM prompt. Final provider-native character-sheet controls remain future work, as requested.

Automatic casting preserves Google's subdued bench and OpenAI's gender matching (Alloy remains male). New catalogs use provider-supplied genders; unspecified metadata is displayed honestly. A very small pool reuses a same-gender narrator before crossing gender. Explicit overrides may choose any actor. Large catalogs are searchable; cast rows show at most 100 matches plus a retained selected actor, preventing catalog-size × cast-size DOM growth.

## Verification

- Test-first: three new engine assertions failed with `settings draft API missing`, then passed.
- `node dev/tests-401-voice-settings.js`: 20 groups covering request schemas, Korean text, SSML escaping, header/body stalls, cancellation, 401/402/429/500, malformed PCM, draft isolation, failed-audition isolation, catalog pagination/cursor loops, selection persistence, legacy casting and storage rollback.
- `node dev/qa-401-voice-settings.js`: fresh Chrome profile, synthetic keys, all external requests blocked or mocked. Covers migration, Save/Cancel, all 13 OpenAI gender labels, draft audition payload, elapsed status, stop, escaped catalog labels, provider-specific controls, cast persistence, stale catalog cancellation, searchable 1,000-actor bank, desktop and 390px mobile layout. `dev/qa-398-openai.js` forwards to this expanded current-UI suite; its immediate-save assertions were superseded by the owner's explicit Save-only decision.
- `node dev/run-tests.js`: full gate, 2,096 engine assertions and 32 standalone suites green. The initial retained-proof failure came from changing the literal ladder declaration; new providers now prepend to the existing declaration, preserving the old sabotage's exact target and meaning.
- Four unauthenticated OPTIONS requests verified CORS for the production origin on both services' speech and catalog endpoints. HTTP 200 and appropriate authorization/content-type headers were returned. No paid audio calls or real account catalogs were exercised.
- Screenshots: `audits/screenshots/401-{before-desktop,before-mobile,openai-desktop,inworld-mobile,speechify-mobile,cast-mobile}.png`.

## Resource review

Per request: one AbortController and deadline, both cleaned in finally. Per read: two in-flight/landed groups plus the existing playback lookahead; stop clears the retained item and draft reader. Per dialog: one diagnostic interval and at most one catalog load/ticker; switching, closing and reopening cancels/disposes them. Catalog fetches cap at 20 pages/4,000 actors and reject repeated cursors. Per campaign: no new saved fields. Per device: one preferences record and one credentials record, replaced on Save, with one cached parsed version each; one actor catalog and cast map per provider. The optional cast tab adds no listener or timer outside its dialog.

## API references checked 2026-09-11

- [Inworld synthesis](https://docs.inworld.ai/api-reference/ttsAPI/texttospeech/synthesize-speech): explicit `inworld-tts-2`, PCM, `instruction`, `deliveryMode`, `language`, `speakingRate`.
- [Inworld voice catalog](https://docs.inworld.ai/api-reference/voiceAPI/voiceservice/list-voices): Basic key, system/workspace actors, gender and pagination.
- [Speechify synthesis](https://docs.speechify.ai/tts/api-reference/v1/audio/stream): explicit `simba-3.2`, English, `pcm_24000`.
- [Speechify voice catalog](https://docs.speechify.ai/build/api-reference/v1/voices/get): model-filtered catalog, `has_more` and cursor pagination.
- [Speechify emotion control](https://docs.speechify.ai/tts/text-to-speech/features/emotion-control): SSML style emotion and prosody.

Remaining: owner enters the two provider API keys and judges real audio, Korean pronunciation and end-to-end latency. CORS success and mocked transport tests do not establish real account entitlement or audio quality. Production browser QA passed on the live origin in a fresh profile with synthetic credentials and mocked paid endpoints. Real keys were not read or used during verification.


## Speechify rate follow-up — v1.902 (published)

Owner reported unusually fast Speechify narration with an ineffective slider. The UI already forwarded the draft rate, but the adapter encoded it as an absolute percentage (0.8 -> 80%, 1 -> 100%). [Speechify's SSML contract](https://docs.speechify.ai/docs/ssml/) specifies percentage adjustments relative to normal speed. The adapter now sends signed adjustments and the documented neutral keyword medium. No UI persistence behavior changed.

Test-first failure: Voice settings drafts (#401) / #401 Speechify rate uses relative SSML adjustments at every slider step: 0.8x must send -20%, got rate=80%. The regression covers all eleven slider positions; the prior transport assertion expecting 110% was corrected to +10%. Browser QA (node dev/qa-401-speechify-rate.js) captures real Test requests for the default and replacement passages at 0.80x, 1.00x and 1.30x. Speechify remains selected while the dialog stays open; Close without Save restores OpenAI; Save/reopen retains Speechify and 0.80x; gameplay requests use that saved rate. Requests use synthetic keys and intercepted transport, so audible provider performance has not been re-tested.
Validation: full gate ALL GREEN (2,097 engine assertions and 32 standalone suites); focused browser QA passed. Sabotage harness caught absolute-percentage and incorrect-neutral mutations with the named regression assertion (2/2), restoring source byte-identically.

Production release: owner authorized push/publish; PR #12 merged as 4c8bfed625b32b0f77b0b9ae35a22cdffbedce86 after both CI runs passed. Cloudflare production deployment 0c0f9089-fd7d-4afc-af07-3c6b5eeeda9c succeeded. The live https://traffic-and-dragons.pages.dev/ served v1.902 and passed the focused browser rate / Save / gameplay checks using intercepted requests. Real Speechify listening remains the owner trial.


## Speechify trial concurrency — v1.903 (local)

Owner saw HTTP 429 during a two-group Test and confirmed Free/trial. [Speechify API limits](https://docs.speechify.ai/docs/api-limits) allow one concurrent synthesis on Free, shared account-wide; the adapter inherited two-group prefetch. A synthetic request probe confirmed two requests started before either response arrived. Transport regression failed with 'free tier received overlapping speech requests'. The screenshot alone cannot distinguish concurrency from other quotas because the old request helper discarded the response body.

Provider metadata now supplies scheduling depth: Speechify one, Inworld two. The second group begins after the first body completes; it can generate while the first plays. This does not coordinate other tabs or Speechify's console, nor guarantee instant provider-side cancellation. HTTP 429 diagnostics recognize concurrency_limit_reached and rate_limited and show valid numeric Retry-After. Unknown or malformed bodies retain the generic HTTP error; stalled bodies remain within the existing 20-second deadline. Raw provider messages are not echoed, avoiding accidental credential/text exposure. No automatic retry or additional billing is introduced.

Test-first engine and transport failures preceded the fix. Transport tests cover waiting through body completion, the next group starting, Stop cancelling it, late audio staying silent, both 429 reasons, retry hints, malformed/stalled bodies and visible audition errors. Real account responses and audio have not been retested.
Validation: full gate ALL GREEN (2,098 engine assertions, 32 standalone suites); focused Speechify rate / Save / gameplay browser QA passed. Two isolated sabotage mutations (overlapping requests and discarded limit reason) were caught by the named transport tests; source restored byte-identically.
