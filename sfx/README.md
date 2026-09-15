# Smithy fire pilot asset

`smithy-fire-v2.mp3`: 9.005 seconds, mono, 48 kHz, 128 kbps MP3 with the Xing/LAME gapless header (145,152 bytes). **License: CC0 1.0** — Nox_Sound, "Ambiance_Firecamp_Medium_Loop_Mono.wav" from the free Essentials Series pack (Nature_Essentials), https://nox-sound-design.itch.io/essentials-series-sfx-nox-sound ; the pack README states "All these sounds are under CC0 license." No attribution required; safe to redistribute in this public repository. Replaces v1 (2026-09-15), which was cut from a Unity Asset Store purchase whose EULA forbids the files in a public repo (see Audio/CC0-SOURCING.md). Owner listening approval of v2 is pending; v1's approval covered a different recording.

- Source: `Audio/CC0/Essentials_Series_NOX_SOUND/Nature_Essentials_NOX_SOUND/Ambiance_Firecamp_Medium_Loop_Mono.wav` (unchanged, ignored).
- Source SHA-256: `36d5ccc8ffa065a642d46d2b8d15cda7556184f30662fe2bf3bf25c5236611c7`.
- Delivery SHA-256: `d2b017fce86f4ef9eef89b669733c35433dae5517fc85ff0ba3e2852b9df23cd`.
- Processing (`dev/prepare-ambience-loop.py`): full 10.005 s author loop; DC removal; 1-second raised-cosine overlap of tail/head (loop end joins sample 0 continuously); RMS matched to v1 at −32 dBFS (peak −10.9 dBFS, ceiling −6); ffmpeg 7.1 libmp3lame 128 kbps mono, no ID3.
- Prepared WAV: `Audio/Prepared/smithy-fire-v2.wav`; processing receipt beside it. Two CC0 alternates from the same pack are prepared for audition: `smithy-fire-alt-big` (Ambiance_Fire_Big, denser roar) and `smithy-fire-alt-small` (Ambiance_Firecamp_Small, sparser crackle).
- Chrome decoded receipt: see `Audio/Prepared/browser-audio-receipt.json` (loop [0,9.005)).

Change the filename and scene manifest when replacing the delivery file. WAV masters and review choices stay outside git. See [implementation brief](../DOC/PROPOSAL_Village_Blacksmith_Ambience.md).

## Village exterior beds (v1.933 — CC0)

Delivery: village-morning-v2.mp3, village-day-v2.mp3, village-evening-v2.mp3, village-night-v2.mp3. **License: CC0 1.0** — all four are Nox_Sound loops from the free Essentials Series pack (https://nox-sound-design.itch.io/essentials-series-sfx-nox-sound ; README: "All these sounds are under CC0 license."). They replace the v1.931 beds, which were Unity Asset Store cuts the EULA forbids in a public repository (TODO #412).

| Bed | Source loop | Length | Bytes |
|---|---|---|---|
| morning | Nature_Essentials/Ambiance_Forest_Birds_Loop_Stereo | 27.068 s | 433920 |
| day | Sample_A_Sound_Effect/Ambiance_Nature_Meadow_Birds_Flies_Calm_Loop_Stereo | 55.838 s | 894336 |
| evening | Nature_Essentials/Ambiance_Wind_Forest_Loop_Stereo | 27.919 s | 447744 |
| night | Nature_Essentials/Ambiance_Night_Loop_Stereo | 27.860 s | 446592 |

Each is the author's full loop through `dev/prepare-ambience-loop.py`: mono mean, DC removal, two-second raised-cosine tail/head overlap, RMS −26 dBFS with a −6 dBFS peak ceiling (the v1.931 level policy; morning is peak-limited at −28.7 dBFS RMS), ffmpeg libmp3lame 128 kbps mono with the Xing/LAME gapless header. Source and derivative SHA-256, gains and boundary steps are in village-exterior-provenance.json. Loop ends round down to milliseconds. Owner audition pending: `Audio/Prepared/village-beds-audition.html`. The Unity-pack review (26 approved) remains indexed under ignored Audio/ for any later off-git use.
