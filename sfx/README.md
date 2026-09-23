# Smithy fire pilot asset

`smithy-fire-v2.mp3`: 9.005 seconds, mono, 48 kHz, 128 kbps MP3 with the Xing/LAME gapless header (145,152 bytes). **License: CC0 1.0** — Nox_Sound, "Ambiance_Firecamp_Medium_Loop_Mono.wav" from the free Essentials Series pack (Nature_Essentials), https://nox-sound-design.itch.io/essentials-series-sfx-nox-sound ; the pack README states "All these sounds are under CC0 license." No attribution required; safe to redistribute in this public repository. Replaces v1 (2026-09-15), which was cut from a Unity Asset Store purchase whose EULA forbids the files in a public repo (see Audio/CC0-SOURCING.md). Owner listened and approved v2 on 2026-09-15.

- Source: `Audio/CC0/Essentials_Series_NOX_SOUND/Nature_Essentials_NOX_SOUND/Ambiance_Firecamp_Medium_Loop_Mono.wav` (unchanged, ignored).
- Source SHA-256: `36d5ccc8ffa065a642d46d2b8d15cda7556184f30662fe2bf3bf25c5236611c7`.
- Delivery SHA-256: `d2b017fce86f4ef9eef89b669733c35433dae5517fc85ff0ba3e2852b9df23cd`.
- Processing (`dev/prepare-ambience-loop.py`): full 10.005 s author loop; DC removal; 1-second raised-cosine overlap of tail/head (loop end joins sample 0 continuously); RMS matched to v1 at −32 dBFS (peak −10.9 dBFS, ceiling −6); ffmpeg 7.1 libmp3lame 128 kbps mono, no ID3.
- Prepared WAV: `Audio/Prepared/smithy-fire-v2.wav`; processing receipt beside it. Two CC0 alternates from the same pack are prepared for audition: `smithy-fire-alt-big` (Ambiance_Fire_Big, denser roar) and `smithy-fire-alt-small` (Ambiance_Firecamp_Small, sparser crackle).
- Chrome decoded receipt: see `Audio/Prepared/browser-audio-receipt.json` (loop [0,9.005)).

Change the filename and scene manifest when replacing the delivery file. WAV masters and review choices stay outside git. See [implementation brief](../DOC/PROPOSAL_Village_Blacksmith_Ambience.md).

## Village exterior beds (v1.933 — CC0)

Delivery: village-morning-v2.mp3, village-day-v2.mp3, village-evening-v2.mp3, village-night-v3.mp3. **License: CC0 1.0** — all four are Nox_Sound loops from the free Essentials Series pack (https://nox-sound-design.itch.io/essentials-series-sfx-nox-sound ; README: "All these sounds are under CC0 license."). They replace the v1.931 beds, which were Unity Asset Store cuts the EULA forbids in a public repository (TODO #412).

| Bed | Source loop | Length | Bytes |
|---|---|---|---|
| morning | Nature_Essentials/Ambiance_Forest_Birds_Loop_Stereo | 27.068 s | 433920 |
| day | Sample_A_Sound_Effect/Ambiance_Nature_Meadow_Birds_Flies_Calm_Loop_Stereo | 55.838 s | 894336 |
| evening | Nature_Essentials/Ambiance_Wind_Forest_Loop_Stereo | 27.919 s | 447744 |
| night | Freesound 637083 Ambiance_Nature_Night_Cricket_Calm_Loop (v3, 2026-09-15 — the loop the owner rated PERFECT; v2 Night_Loop retained under Audio/Prepared) | 57.791 s | 925440 |

Each is the author's full loop through `dev/prepare-ambience-loop.py`: mono mean, DC removal, two-second raised-cosine tail/head overlap, RMS −26 dBFS with a −6 dBFS peak ceiling (the v1.931 level policy; morning is peak-limited at −28.7 dBFS RMS), ffmpeg libmp3lame 128 kbps mono with the Xing/LAME gapless header. Source and derivative SHA-256, gains and boundary steps are in village-exterior-provenance.json. Loop ends round down to milliseconds. Owner listened and approved all four on 2026-09-15 (`Audio/Prepared/village-beds-audition.html`). The Unity-pack review (26 approved) remains indexed under ignored Audio/ for any later off-git use.

## Tavern crowd and the rain layer (v1.939 — CC0)

`tavern-v1.mp3`: 35.486 s, mono, 44.1 kHz, 128 kbps (568841 bytes). **CC0 1.0** — ivolipa, "Tavern_Ambience_Inside_Laughter" (Freesound 326313, verified on the sound page; owner-approved by listening in the CC0 review). Real tavern at dinner, Istria: chatter and laughter, no music, no intelligible speech. Bound as scene `tavern` to the village's canonical `the tavern` while its filed hours say open, the smithy pattern. Interior level policy (RMS −32 dBFS like the forge).

`rain-calm-v1.mp3`: 28.000 s, mono, 48 kHz (448896 bytes). **CC0 1.0** — Nox_Sound Essentials `Ambiance_Rain_Calm_Loop_Stereo` (owner-approved). Prepared as a weather LAYER at the exterior level policy (RMS −26 dBFS). **Not bound to any scene yet**: layers wait on the WEATHER normalization contract (Proposal_general_audio §7, Fable feedback 19.2). Provenance for both: `interior-and-layer-provenance.json`.

## Accent sprite: footsteps on a wooden floor (v1.975 — CC0)

`accent-footsteps-wood-v1.mp3`: 3.779 s, mono, 48000 Hz (61440 bytes). **CC0 1.0** — Nox_Sound Essentials `Footsteps_Wood_Walk_01` to `_05` (owner-approved by listening 2026-09-22; 06–10 rejected as "enough footsteps"). One file holds all five steps, separated by 0.25 s of silence; the catalog's cut list names each step's span on the decoded timeline, so a set is one download, one decode and one cache entry (Proposal_general_audio.html §21.2).

Prepared with `dev/prepare-accent-sprite.py`: per step mono mean, DC removal, trim below −50 dB of its own peak (20 ms pre-roll), RMS −30 dBFS (peaks −6.8 to −11.5 dBFS), 10 ms raised-cosine fades; ffmpeg libmp3lame 128 kbps mono with the Xing/LAME gapless header. Source and derivative SHA-256 and the cut list are in `interior-and-layer-provenance.json`. Owner approved the mix 2026-09-23 after hearing it as in game over the tavern crowd (`dev/accent-audition.html`), v1.976; the Village tavern plays it. From v1.977 each walk plays at a level drawn from 35–70% (catalog `sprite.gain: [0.35, 0.7]`).

## Accent sprites: chimes, a bowl and a bell (v1.978 — CC0, mix awaiting audition)

`accent-chimes-koshi-v1.mp3` (six 5 s phrases, Kinoton Koshi 376001/378431), `accent-chimes-metal-v1.mp3` (five 5 s phrases, janbezouska 266951), `accent-bowl-small-v1.mp3` (one strike, inoshirodesign 271370) and `accent-bell-church-v1.mp3` (first 14 s of bassimat 857912 with a 2.5 s fade). **CC0 1.0**, each verified on its Freesound page and owner-approved by listening 2026-09-22. The chime phrases are cut from continuous takes at their quietest edges (300 ms fade in, 1.5 s fade out); RMS −30 dBFS. Catalog: `chimes-koshi`, `chimes-metal` and `bowl-small` play where a place's SOUNDSCAPE allows `chimes`; `bell-church` only in the open settlement where it allows `bells` (owner ruling). Each set's `mix` approval waits for the owner hearing it in `dev/accent-audition.html`. Provenance: `interior-and-layer-provenance.json`.
