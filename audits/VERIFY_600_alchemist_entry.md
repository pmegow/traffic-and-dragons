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

## Owner trim revision — v1.1136

Removed exactly 96,000 samples (two seconds at 48 kHz) from the audible end of the prepared lossless v1 phrase. Kept the original level and 0.25 s padding on each side, applied a 20 ms raised-cosine end fade, and encoded v2 directly from PCM. Audible phrase 3.2844 → 1.2844 s; decoded sprite 3.7843958333 → 1.7843958333 s. Catalog cuts are [0.25, 1.5344], with tighter byte/duration/memory limits and new checksum. No entry-policy changes. Loader/controller checks and the two-visit isolated-browser check passed; [trim receipt](VERIFY_600_alchemist_entry_trim.json). Revised owner audition and deployment pending.

## Earlier fade revision — v1.1137

Owner found the trimmed ending abrupt. V3 preserves the 1.2844 s phrase and original gain, but fades over its final 200 ms instead of 20 ms (starts 180 ms earlier). Rendered again from the lossless v1 master, with unchanged padding and sprite cuts. Updated delivery URL, checksum and provenance. Loader/controller checks pass.

## Owner-selected editor curve — v1.1140

The owner selected smooth cosine with points (0 s, 100%), (0.001 s, 100%), (1.2843958333333334 s, 0%). V5 renders the original lossless v1 region [0.25, 1.5343958333333334] through `dev/audio-envelope.js`, the same function used by editor preview and export. No cumulative fades or level normalization. Preserved 0.25 s padding each side. The 61,651-sample phrase ends at exact zero; midpoint gain is 50%. [Preset](../sfx/alchemist-entry-bell-envelope.json). The owner emphasized the shape: cosine eases into and out of the fade (zero endpoint slopes), unlike the sharp initial exponential drop. The earlier v3 was an uncommitted audition; v4 was an exponential audition only. Deployment pending.

V5 validation: 2,641 engine assertions and 94 standalone verifier suites ALL GREEN; catalog checksum regeneration verified; isolated copied-save Chromium entry/re-entry, repeat, pause/resume and exit checks PASS ([receipt](VERIFY_600_alchemist_entry_curve.json)). Headless playback is muted; the curve itself was selected by owner audition.

## Owner volume revision — v1.1141

Owner confirmed the deployed v1.1140 bell works well, then requested a slightly louder mix. Catalog playback gain changes from 0.65 to 0.78: +20% amplitude (+1.58 dB). The MP3, approved ease-in/ease-out cosine envelope, sprite cuts and 0.5 narration duck multiplier are unchanged. Existing controller assertions first failed at the old gain (0.2925 vs 0.351 at 45% ambience), then passed at the new level; the narration check still pins the ducked level. Deployment and revised owner audition pending.
