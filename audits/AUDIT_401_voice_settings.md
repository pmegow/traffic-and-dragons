# #401 — Model-driven Voice Settings

Owner design, 2026-09-11. Built locally as v1.901 on `codex/voice-settings`; no push or deployment requested for this change.

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

Remaining: owner enters the two provider API keys and judges real audio, Korean pronunciation and end-to-end latency. CORS success and mocked transport tests do not establish real account entitlement or audio quality. No deployment was performed.
