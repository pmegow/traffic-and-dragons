# #402 follow-up — Filter character voice choices by gender

Version v1.906; cache tnd-v3-20260911o. Built locally, not pushed or published.
Owner request: filter both character-sheet voice lists by character gender; show both only for non-binary characters.

## Cause and behavior

The v1.905 creation helper matched genders, but the two character-sheet option renderers used complete catalogs. The shared filter now applies to Speechify actors, Piper stars and individual Piper voices. M/F require matching structured actor metadata. NB retains the whole bank. Missing/ANY character gender does not unlock both banks; existing character pronoun resolution still applies.

Known Piper gender labels now have equivalent structured metadata. Mixed-speaker models and actors without gender metadata are excluded from binary character lists; matching individual starred speakers remain available. Edited star metadata takes precedence over a duplicate base-catalog actor. No vendor gender was guessed from a name.

Existing assignments outside the filtered lists remain saved and selected through a hidden, disabled option labeled Saved voice (not listed). Opening or closing the sheet does not reassign a voice. Choosing a replacement saves it through the existing independent control handlers. Global narrator settings, character creation and speech routing are unchanged.

## Verification

- Three new engine assertions failed before implementation: binary/NB/unknown filtering, starred metadata, and individual Piper actor filtering. All six #402 engine assertions now pass.
- Full gate: 2105 engine assertions and 33 standalone suites pass.
- Five #402 integration groups pass. The added group executes both sheet renderers with mismatched saved pins, male/female/NB/unknown characters, and a conflicting base/star metadata override. Existing request, fallback, NPC generation and creation tests also pass.
- Six retained mutations in dev/sabotage-402-voice-filter.js fail on their named guards: bypass shared filtering, bypass starred filtering, bypass either renderer, expose an out-of-list saved actor, or ignore edited star metadata.
- Phone-width browser QA: dev/qa-402-voice-filter.js reproduces both mixed-gender lists before the change and verifies M/F/NB/unknown choices, saved out-of-list selections, independent changes and no horizontal overflow afterward. The selects are expanded as listboxes for screenshots so their contents are visible. Before/after renders were inspected visually.
- A temporary test comparison against #9 also matched the star icon's HTML entity; it was corrected to match full actor IDs. The browser fixture initially omitted required synthetic key/narrator settings; those were supplied before the successful reproduction. No paid requests were made.

Screenshots: [before](screenshots/402-voice-filter-before.png), [after](screenshots/402-voice-filter-after.png).
Native iOS picker behavior and real service audio were not exercised; browser QA uses isolated Chrome and synthetic catalogs.
