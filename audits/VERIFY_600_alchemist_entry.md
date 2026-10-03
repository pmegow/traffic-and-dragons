# Alchemist entrance bell — 2026-10-03

Owner request: hear the small bell described on entering the alchemist.

## Implementation

v1.1135: one CC0 recorded entry cue named by the authored scene, consumed only on a committed turn between different nodes in the same campaign/generation. The cue uses the existing bounded/checksummed loader and shares the accent voice. No prompt/core edits, prose parsing or live campaign writes. Reloads and preference toggles never ring; slow loads expire after five seconds. Narration ducks the bell; microphone, mute, pause and exit cut it.

## Verification

Three engine assertions were red before implementation (missing entry tracker/binding) and then green. They cover entry/re-entry, save/load deduplication, campaign changes, playback gates, profile vetoes and exclusion from the random glass schedule. The fake-clock controller suite checks narration gain, current-profile vetoes, pending-load abort and release, load timeout, a bed occupying the decode slot, re-entry, mute and disposal. Its first profile-change assertion found and prevented an active bell ignoring a new prohibition.

Isolated Chromium: `node audits/VERIFY_600_alchemist_entry.cjs`, fresh profile, no service workers or external requests, Ammut t279 save read-only and copied into page memory. Loading inside does not ring; two committed visits each start exactly one decoded bell; repeated commits, pause/resume and exit pass without page errors. [Browser receipt](VERIFY_600_alchemist_entry.json). Headless Chrome is muted; perceived sound is for owner audition.

Mutation proof: `node dev/sabotage-entry-bell.js`. The first reload mutation was missed because generation change masked the reason guard; the test now isolates save/load transitions within the same generation. Existing Noctina mutation anchors include the new entry metadata without weakening their assertions.

Local implementation; deployment and owner audition pending.

Final gates: 2,636 engine assertions and 93 standalone verifier suites passed. Entry-bell mutations 6/6, existing accent mutations 21/21, Noctina mutations 2/2. All 2,372 retained mutation anchors apply. Initial full run failed only on the two changed Noctina anchors; after updating them the full run passed. Catalog rebuild and loader checks passed with the bell-specific source hash and processing recipe.
