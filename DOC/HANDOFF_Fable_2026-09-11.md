# Handoff to Fable — 2026-09-11

## Current state

Traffic and Dragons is LIVE at **v1.906**, cache **tnd-v3-20260911o**, on https://traffic-and-dragons.pages.dev/.

- Repository: **C:/Projects/traffic-and-dragons**. The old OneDrive dnd_rpg location is obsolete.
- Main checkout: master at **a50b9bb** before this documentation handoff. No tracked game changes are pending.
- Latest feature: **369a187**, merged through [PR #16](https://github.com/pmegow/traffic-and-dragons/pull/16) as **bcddd00**. Both CI runs passed. Production deployment **4e5fc560-01ad-4fa1-888a-d0980ebc55ee** was verified; subsequent docs-only commits keep the same game version.
- Prior character voice feature: **9c8e165**, [PR #15](https://github.com/pmegow/traffic-and-dragons/pull/15), merge **8dd288f**.
- User explicitly authorized the completed push/publication steps. The current request is to prepare this handoff, not to start another implementation or release.

Read [CLAUDE.md](../CLAUDE.md), [AGENTS.md](../AGENTS.md), [TODO.md](../TODO.md), and the relevant contracts before further work. TODO remains the task source of truth; this handoff is context, not another tracker.

## Owner decisions to preserve

1. OpenAI audio quality is good, but its actor bank is too small for the desired cast. Google hangs too often. The owner wanted trials of **Speechify and Inworld**.
2. A **Korean-language campaign** is a reach goal. Speechify was not disqualified for a presumed lack of Korean. The owner later supplied a screenshot showing numerous Korean Speechify voices; do not repeat the blanket claim that Speechify lacks Korean voices.
3. Voice Settings has one primary-model dropdown that reconfigures provider controls. **Gameplay changes apply only after Save.** Test auditions the unsaved draft. Closing/reopening without Save reverts to saved settings; that explained an observed switch back to OpenAI.
4. Manage Cast is a separate, easily removable tab. Keep its registration modular; removing it has not been requested.
5. Character sheet: **Primary voice = Speechify; Backup voice = Piper**, with separate selectors and Test buttons. Random gender-matched assignment at creation; preserve existing pins.
6. Latest ruling: male characters see male choices, female characters see female choices; **only non-binary characters get the full list**, in both selectors. Global narrator lists are not character-filtered.
7. Compact Speechify option labels: name and gender. Marketing/use-case tags made native phone selectors nearly unusable. Keep extra useful traits short and outside options.
8. The owner confirmed their Speechify account was **Free/trial**. A key is already entered by the owner; do not ask for or expose it.

## Shipped voice changes

| Version | Change | Release |
|---|---|---|
| v1.892–v1.893 | OpenAI gpt-4o-mini-tts option using existing OpenAI BYOK key, 13 actors, performance instructions/rate; app casting gender metadata, Alloy male by owner ruling | Audits #398/#399 below |
| v1.901 | Separate model-driven Voice Settings shell; provider drafts and removable cast tab; Inworld TTS-2 and Speechify Simba 3.2 adapters | PR #11, merge 781b10d |
| v1.902 | Speechify rate encoding corrected: 0.8x sends -20%, 1x medium, 1.3x +30%; former absolute encoding was wrong | PR #12, merge 4c8bfed |
| v1.903 | Speechify outstanding synthesis groups reduced to one for Free-plan concurrency; specific 429 reasons and numeric Retry-After surfaced, no automatic retries | PR #13, merge 0bcdbb0 |
| v1.904 | Compact actor labels and up to three cleaned useful traits; old saved catalogs benefit without refresh | PR #14, merge 27598b0 |
| v1.905 | Independent per-character primary/backup assignments, creation hooks, correct unread per-speaker Piper fallback | PR #15, merge 8dd288f |
| v1.906 | Gender-filter both sheet lists; preserve saved out-of-list actors; honor edited Piper star metadata | PR #16, merge bcddd00 |

## Implementation map and contracts

**tts.js:** provider/settings adapters, shared ordered cloud scheduler, CHARACTER_VOICE_SLOTS registry, assignCharacterVoices, filterCharacterVoices, optional character filter in starOptionsHtml, and _cloudFallbackItem. Speechify prefetch is one; Inworld is two. Stop/Skip and request-body deadlines retain prior behavior.

**ui-voice-settings.js:** model-driven draft UI. Manage Cast remains under its tab registration. Its help explains that explicit character-sheet primaries take precedence over automatic mapping.

**ui-sheets.js:** csPrimaryVoiceOptions, csBackupVoiceOptions, csVoiceControlHtml and csWireVoice. Sheet changes save immediately, like the previous sheet voice control; this is separate from Voice Settings' Save-only contract. generateNpcSheet discards model-authored voice fields, inherits prior/roster pins, fills missing assignments, then transfers ownership to the sheet.

**game.js:** v1.905 changes were limited to requested player/companion creation and speaker-resolution hooks: startGame, _speakerVoiceSubject, speakerVoiceMap and pinAutoCastVoices. No parser, prompt, memory, identity or storage implementation was edited for #401/#402.

- **speechifyVoiceId** is the saved primary actor ID.
- **voiceId** remains the saved Piper backup, including model#speaker suffixes. Existing saves and whole-sheet export/library payloads carry both.
- Sheetless NPCs may carry the same fields until a generated sheet inherits them. Imported existing companions retain their sheets as-is.
- Numeric per-unit speaker-map entries remain Piper IDs. Optional **providers.speechify** metadata carries explicit primary actors by unit. Stored SAY names/transcript formats are unchanged.
- Two characters can share a Piper backup and still have different Speechify actors. Explicit sheet primaries beat legacy cast-slot mapping.
- A cloud failure queues only unread text, rebases its numeric speaker indices, and preserves complete backup IDs.
- Creation only fills missing pins. Speechify needs a saved compatible catalog and a gender match; otherwise primary stays automatic. Piper uses matching stars, then the shipped bank.
- Picker filtering is deliberately stricter for missing/ANY gender: it does not expose both banks. Existing pronoun fallback applies. NB gets the whole bank; M/F exclude unknown or mixed actor metadata.
- Edited Piper star metadata wins over a duplicate base actor. Known gender labels on single-actor Piper entries now have equivalent structured metadata; no gender was guessed from actor names.
- A saved actor outside the filtered choices remains selected as **Saved voice (not listed)** via a hidden disabled option. Opening a sheet does not silently reassign it. The owner can choose a replacement.
- Global primary-provider selection still determines the gameplay service. Sheet labels do not force every campaign onto Speechify.

## Fable review / next checks

These are review targets and unverified edges, not claims of reproduced failures:

1. **Real audio and native iOS:** owner trial remains the evidence for actual delivery speed, actor quality, response latency and native picker behavior. Agent verification used synthetic keys, intercepted audio and isolated Chrome. No real paid Speechify/Inworld requests or personal campaign writes were made.
2. **Korean support:** current implementation exposes Inworld auto/English/Korean; Speechify's adapter/settings still use English. The owner's Korean voice-bank screenshot contradicts the earlier broad research exclusion. Verify current API model/language/catalog support separately from Reader/Studio availability before adapting Speechify Korean. Also distinguish Korean TTS from translating campaign text. Do not overwrite the untracked research report until its owner scope is clear.
3. **Piper composite speaker limitation:** the new cloud fallback retains complete IDs in the queue, but the inherited local vits-web path normalizes them through _localVoiceId because it cannot select a composite speaker. Server Piper can retain the suffix. Thus distinct composite backups sharing a base model may sound alike on the local path. This pre-existing limitation was not removed by #402; inspect actual deployment path before promising per-speaker local parity.
4. **Existing campaigns / no catalog:** old nonempty Piper pins are preserved; an existing character may remain on automatic Speechify casting until explicitly assigned. No bulk migration or reroll was performed. Test adding a catalog later, regenerating NPC sheets and reopening imported sheets if this becomes an owner complaint.
5. **Review the transient map seam and fallback:** confirm per-unit alignment, explicit-primary precedence and unread-only rebasing against any future scheduler changes. Tests cover shared backups with distinct primaries and a real intercepted later-group 429.
6. **Filter edge behavior:** retain exact M/F matching, NB full bank, edited star precedence and non-destructive out-of-list pins. Do not loosen the filter simply to show unknown actors; the owner's latest rule is explicit.

## Verification receipts

Latest full gate: **2105 engine assertions + 33 standalone suites, ALL GREEN**. Latest dry applicability: **1005/1005 clauses across 99 batteries**. The existing private mature-fixture skip remains by privacy rule.

- dev/tests-402-character-voices.js: five integration groups covering real request actor selection, later failure/backup mapping, NPC inheritance, creation/save timing, and both actual sheet renderers.
- dev/sabotage-402-character-voices.js: six named mutation proofs.
- dev/sabotage-402-voice-filter.js: six named mutation proofs.
- dev/sabotage-233-tts-body-deadlines.js: four proofs rerun after the queue handoff moved into the helper. Its source assertion and matching mutation were updated to the equivalent helper expression; no timeout/fallback requirement was dropped.
- dev/qa-402-character-voices.js: phone controls, independent saves, exact Speechify Test actor, Stop cancellation, full sheet.
- dev/qa-402-voice-filter.js: M/F/NB/unknown lists, saved pins, replacement choices, phone-width before/after. Selects are expanded as listboxes for screenshot visibility.
- Both preview and production browser checks passed for v1.905 and v1.906. CI also passed four replay fixtures, focused drift guards and affected mutation batteries before each merge.

Current CI receipts: [branch](https://github.com/pmegow/traffic-and-dragons/actions/runs/34672663745), [PR](https://github.com/pmegow/traffic-and-dragons/actions/runs/34672671928).

Read [Voice Settings audit](../audits/AUDIT_401_voice_settings.md), [character voices](../audits/AUDIT_402_character_voices.md), [gender filter](../audits/AUDIT_402_voice_filter.md), [OpenAI option](../audits/AUDIT_398_openai_voice.md), [OpenAI casting](../audits/AUDIT_399_openai_casting.md). Screenshots are linked from the audits. Contracts: [voice](contracts/tts-stt.md), [sheet](contracts/render.md).

## Earlier work: do not restart

- **#351 closed:** nine mutation batteries adjudicated; hand-triggered weekly run [34373931181](https://github.com/pmegow/traffic-and-dragons/actions/runs/34373931181) passed 78/78 with no misattribution, PR #2. See [census audit](../audits/AUDIT_sabotage_census.md).
- **#374 closed:** owner confirmed working as intended on 2026-09-11. Initial stakes readout v1.873; ended-campaign display follow-up v1.890. See [stakes audit](../audits/AUDIT_374_stakes.md). Both rows are in DOC/TODO_ARCHIVE.md.
- Rendering follow-ups removed profile/camera-facing examples and compulsory action/pose directives, then made posture follow scene activity. See [pose audit](../audits/AUDIT_397_scene_poses.md). Broader **#397** composition work and **#400** standalone render-engine/model-sheet work remain in TODO for Fable; they are not part of this completed voice release.

## Workspace hygiene and continuation

Latest isolated feature checkout: C:/Projects/traffic-and-dragons-worktrees/codex-character-voice-filter, branch codex/character-voice-filter (merged). Prior: codex-character-voices (merged). Both feature commits are already in master; do not replay or cherry-pick them again.

User-owned untracked material remains untouched in the main checkout: DOC_TTS_2026_9_11.html; DOC/Research/tabletop_vs_traffic_and_dragons.html; audits/FeatureUsage_Astra.html and FeatureUsage_Fable.html; testRuns/fixtures, modelTests, probe198 and its builder scripts. Never stage all files. Do not read or include API credentials in a handoff.

For further releases, preserve version/cache discipline and use explicit-file commits, full pre-commit gate, branch/PR checks, deployed preview QA, merge, then production version/behavior verification. Obtain any new publication authorization from the current task rather than treating this handoff as a standing release request.
