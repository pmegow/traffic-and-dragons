# Smithy fire pilot asset

`smithy-fire-v2.mp3`: 9.005 seconds, mono, 48 kHz, 128 kbps MP3 with the Xing/LAME gapless header (145,152 bytes). **License: CC0 1.0** — Nox_Sound, "Ambiance_Firecamp_Medium_Loop_Mono.wav" from the free Essentials Series pack (Nature_Essentials), https://nox-sound-design.itch.io/essentials-series-sfx-nox-sound ; the pack README states "All these sounds are under CC0 license." No attribution required; safe to redistribute in this public repository. Replaces v1 (2026-09-15), which was cut from a Unity Asset Store purchase whose EULA forbids the files in a public repo (see Audio/CC0-SOURCING.md). Owner listening approval of v2 is pending; v1's approval covered a different recording.

- Source: `Audio/CC0/Essentials_Series_NOX_SOUND/Nature_Essentials_NOX_SOUND/Ambiance_Firecamp_Medium_Loop_Mono.wav` (unchanged, ignored).
- Source SHA-256: `36d5ccc8ffa065a642d46d2b8d15cda7556184f30662fe2bf3bf25c5236611c7`.
- Delivery SHA-256: `d2b017fce86f4ef9eef89b669733c35433dae5517fc85ff0ba3e2852b9df23cd`.
- Processing (`dev/prepare-ambience-loop.py`): full 10.005 s author loop; DC removal; 1-second raised-cosine overlap of tail/head (loop end joins sample 0 continuously); RMS matched to v1 at −32 dBFS (peak −10.9 dBFS, ceiling −6); ffmpeg 7.1 libmp3lame 128 kbps mono, no ID3.
- Prepared WAV: `Audio/Prepared/smithy-fire-v2.wav`; processing receipt beside it. Two CC0 alternates from the same pack are prepared for audition: `smithy-fire-alt-big` (Ambiance_Fire_Big, denser roar) and `smithy-fire-alt-small` (Ambiance_Firecamp_Small, sparser crackle).
- Chrome decoded receipt: see `Audio/Prepared/browser-audio-receipt.json` (loop [0,9.005)).

Change the filename and scene manifest when replacing the delivery file. WAV masters and review choices stay outside git. See [implementation brief](../DOC/PROPOSAL_Village_Blacksmith_Ambience.md).

## Village exterior beds (v1.931)

Approved sources: Medieval Ambiences Morning, Medieval Ambiences Town 2 min, Light wind, and Medieval Ambience Night 2 min. Owner review exported 2026-09-15T06:46:16.059Z; the full review and all 26 approved assets are indexed under ignored Audio/. Music and action sounds remain approved assets for later integration.

Delivery: village-morning-v1.mp3, village-day-v1.mp3, village-evening-v1.mp3, village-night-v1.mp3. Each uses the full source recording with a two-second tail/head overlap, mono averaging, DC removal and level matching (-26 dBFS RMS target, -6 dBFS peak ceiling), encoded at 128 kbps. This keeps the long variation rather than repeating a short rooster-containing slice. Rooster calls remain part of the morning recording; no source separation or rooster removal is claimed.

Source/derivative hashes, exact lengths and processing are in village-exterior-provenance.json. Loop ends round down to milliseconds to stay within resampled decoder lengths. The prepared loops need an owner audition; source approval is not clean-loop certification. New assets total 7,117,597 bytes. At 48 kHz each decoded bed uses 20.7–23.3 MB; the controller retains at most two during transitions and one load/decode job, with 24 MB per exterior buffer.
