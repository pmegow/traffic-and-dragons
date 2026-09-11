# OpenAI actor genders — #399

The owner requested gender assignments and actor descriptions for NPC casting, explicitly assigning Alloy male. Built as v1.893.

## Cause and mechanic

The GM identifies dialogue speakers through [SAY:Name]. The existing game functions resolve the speaker's sheet gender or roster pronouns, select a compatible starred voice and pin that voice id on the NPC. speakerVoiceMap translates stored speaker names into those voice ids at playback time. Google's provider mapper preserves the cast voice's gender. OpenAI's initial mapper hashed the same id across the entire actor pool and lost that constraint.

Reproduced before editing: female cast speaker en_US-libritts_r-medium#9 mapped to Echo with Marin narrating. The planted sheetless NPC Lysa (she/her) followed the real pinAutoCastVoices → speakerVoiceMap → OpenAI group path and received Echo. All five initial #399 tests failed, including that exact case.

The OpenAI bank now contains id, g and note per actor. API ids derive from that bank, preserving existing settings and compatibility seams. A shared cast-gender reader contains the previous Google lookup unchanged: custom starred metadata first, shipped bench metadata for an unstarred pin second. OpenAI selects within the matching M/F pool, excluding the narrator; unknown presentation keeps its previous unrestricted selection. The GM prompt, tags, identity lookup and saved NPC pins are untouched. Existing NPCs can sound different once because their OpenAI choices now come from the correct pool.

| Casting gender | Actors |
|---|---|
| Male | Alloy, Ash, Ballad, Cedar, Echo, Fable, Onyx, Verse |
| Female | Coral, Marin, Nova, Sage, Shimmer |

These are application casting labels, not official provider identity metadata. The dropdown shows name, gender and description; e.g. Alloy · Male · Neutral. Voice direction remains editable.

## Verification

Full gate passes: 2,088 engine assertions and 31 standalone suites.

Six engine checks cover the entire default bench against every narrator, edited structured gender, legacy labels, unstarred shipped pins, the real GM speaker-map path, all 13 dropdown labels/API values, manual ids and stable unknown-cast behavior. The actor catalog test also verifies Alloy is male and returned metadata cannot mutate the shared bank.

Six named mutations in dev/sabotage-399-openai-casting.js prove the bank, pool filtering, narrator exclusion, custom metadata, unstarred defaults and visible gender labels. The first fallback mutation exposed a lucky single-id fixture; the test now checks every shipped pin after replacing the star list.

The existing dev/qa-398-openai.js gains actual-DOM checks for all 13 gender/description labels and Alloy's exact label, while keeping every prior key-save, request, timer, stop and persistence assertion. Run with TND_VOICE_QA_PREFIX=399 to write this task's screenshots. [Before](screenshots/399-before.png), [desktop](screenshots/399-desktop.png), [mobile](screenshots/399-mobile.png).

Resource review: one fixed 13-entry bank; short-lived arrays per cast resolution; no new timers, requests, audio buffers, persisted fields, or growing caches. No live speech API call was needed: transport remains covered by the existing ten isolated OpenAI playback groups. The owner's listening test remains open.
