# Smithy fire pilot asset

`smithy-fire-v1.mp3`: 18 seconds, mono, 44.1 kHz encoding, 128 kbps MP3. Owner approved the fire and its clean looping on 2026-09-14. Delivery copy of the owner's purchased library recording; this project does not grant a separate redistribution license.

- Source: `Audio/Ambient/Fire/Campfire Fire Loop.wav` (unchanged, ignored).
- Source SHA-256: `b3f2e320f098d11581dffe68fe3a245803fc50aa6d1f0076da8bd7811c8211b6`.
- Delivery SHA-256: `f06f87b9b718594c10a171ddbf83c9af6d0712e2e5538522dd746c9f65e02dda`.
- Processing: seconds 9–29; stereo mean; DC removal; 2-second raised-cosine overlap of tail/head; peak normalized to −6 dBFS; libmp3lame 128 kbps mono, metadata removed.
- Prepared WAV: `Audio/Prepared/smithy-fire-v1.wav`; processing receipt beside it.
- Chrome decoded receipt: 18 seconds, mono, 48 kHz, 3,456,000 bytes; loop [0,18). Decoder boundary step 0.00784 full scale. Owner listening approved; Safari certification remains separate.

Change the filename and scene manifest when replacing the delivery file. WAV masters and review choices stay outside git. See [implementation brief](../DOC/PROPOSAL_Village_Blacksmith_Ambience.md).

## Village exterior beds (v1.931)

Approved sources: Medieval Ambiences Morning, Medieval Ambiences Town 2 min, Light wind, and Medieval Ambience Night 2 min. Owner review exported 2026-09-15T06:46:16.059Z; the full review and all 26 approved assets are indexed under ignored Audio/. Music and action sounds remain approved assets for later integration.

Delivery: village-morning-v1.mp3, village-day-v1.mp3, village-evening-v1.mp3, village-night-v1.mp3. Each uses the full source recording with a two-second tail/head overlap, mono averaging, DC removal and level matching (-26 dBFS RMS target, -6 dBFS peak ceiling), encoded at 128 kbps. This keeps the long variation rather than repeating a short rooster-containing slice. Rooster calls remain part of the morning recording; no source separation or rooster removal is claimed.

Source/derivative hashes, exact lengths and processing are in village-exterior-provenance.json. Loop ends round down to milliseconds to stay within resampled decoder lengths. The prepared loops need an owner audition; source approval is not clean-loop certification. New assets total 7,117,597 bytes. At 48 kHz each decoded bed uses 20.7–23.3 MB; the controller retains at most two during transitions and one load/decode job, with 24 MB per exterior buffer.
