# #402 — Character primary and backup voices

Date: 2026-09-11. Version: v1.905. Cache: tnd-v3-20260911n.
Status: implemented and verified locally; not pushed or published.

## Request and mechanism

The character sheet previously stored only a Piper voiceId. Cloud actors were derived from that backup slot, so two characters sharing a backup could not independently select Speechify actors. The cloud failure handoff also discarded speaker maps and the narrator's composite speaker suffix.

The sheet now exposes Primary voice · Speechify and Backup voice · Piper, each with a Test button. speechifyVoiceId stores the primary actor; voiceId remains the existing Piper backup. A shared slot registry drives sheet wiring, creation assignment and NPC inheritance. Speechify labels remain short: name and gender.

Creation assigns a random available matching actor per service, once. Players and pending companions receive voices before the initial save. Generated NPC sheets inherit roster or previous-sheet pins; model-generated voice fields are discarded. New sheetless speaking NPCs can also receive primary assignments. Existing explicit pins survive regeneration and startup. M/F use matching catalog metadata; NB/unspecified use the available bank under the existing casting convention. Piper falls back to the shipped bank when starred voices have no match. If no compatible Speechify catalog or gender match is available, the primary remains automatic until an actor can be selected.

Primary actors ride transient per-provider speech metadata alongside the existing numeric Piper map. This allows distinct primary actors with the same backup and gives explicit sheet pins precedence over Manage Cast. On cloud failure only unread text is queued for Piper, with rebased speaker indices and complete model#speaker IDs. Stored SAY attribution and transcript formats are unchanged. Whole-sheet saves, library payloads and character exports retain both fields without storage changes. Importing an existing companion still preserves its sheet as-is.

The global primary-model selection still controls gameplay. Changing sheet assignments saves immediately, consistent with the previous sheet control; Voice Settings retains its Save-only behavior.

## Verification

- Test-first engine section: Character primary and backup voices (#402). All three new assertions failed before implementation; now pass. Covers gender matching, stable pins, shared backups, explicit primaries and unread fallback speaker IDs.
- Full gate: node dev/run-tests.js — ALL GREEN, 2102 engine assertions and 33 standalone suites.
- dev/tests-402-character-voices.js — four passing integration groups: actual intercepted Speechify request actor IDs; actual later-group 429 and queued backup mapping; NPC generation/regeneration; campaign startup assignments captured at save time.
- dev/sabotage-402-character-voices.js — 6/6 deliberate mutations caught by named guarding tests; working sources restored byte-identical.
- dev/sabotage-233-tts-body-deadlines.js — 4/4 mutations caught after updating the retained queue-handoff target to the shared fallback helper. Its first rerun exposed a malformed replacement producing an unrelated syntax failure; the fixture was corrected and rerun successfully.
- dev/check-sabotage-applicability.js — 999/999 targets applicable across 98 batteries. The mature private fixture remains skipped by its existing privacy rule.
- dev/qa-402-character-voices.js — real page in isolated headless Chrome at 390px. Verified two selectors, independent saved changes, reopen persistence, exact Speechify audition actor, Stop cancellation, Piper selection/release wiring, and full player sheet without horizontal overflow. Screenshots inspected visually.

The initial full gate failed the existing #233 source assertion because its literal handoff expression changed; the assertion and matching mutation were updated, then the complete gate passed. No unrelated runtime fixes were included.

No user credentials, paid service calls or live campaign writes were used. Audio transports were intercepted; real provider audio quality and native iOS select behavior were not tested. Existing native fallback can still apply if Piper itself is unavailable.

## Screenshots

- [Previous single voice control](screenshots/402-character-voices-before.png)
- [Two voice controls](screenshots/402-character-voices-after.png)
- [Full character sheet at phone width](screenshots/402-full-sheet-phone.png)
