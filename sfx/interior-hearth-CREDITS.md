# Tavern and interior hearth

The tavern uses `tavern-hearth-v1.mp3`; other habitable interiors use the existing `smithy-fire-v2.mp3` at its quiet playback gain. Both recordings were previously approved for this project. The new balance awaits owner listening.

- Tavern: ivolipa, [Freesound 326313](https://freesound.org/s/326313/), CC0 1.0. Original provenance: `interior-and-layer-provenance.json`.
- Fire: Nox_Sound, [Essentials Series](https://nox-sound-design.itch.io/essentials-series-sfx-nox-sound), CC0. Original recording and prepared WAV retained under local `Audio/`.

Preparation: decode both prepared loops to mono 44.1 kHz, add the fire at 0.6 gain, fit four periodic fire cycles over the 35.485714-second tavern loop, PCM16 then libmp3lame 128 kbps with gapless Xing/LAME header. No ID3 metadata. Playback loop ends at 35.485 seconds. Peak -11.26 dBFS, RMS -30.66 dBFS; no clipping. Delivery SHA-256: `091d4177ecb1e9114ac6c1f0d62a8484dbd8a5d949ac7760abf022b10d4f5ecc`.

Source files and detailed preparation receipt are retained locally in `Audio/Prepared/tavern-hearth-v1.json`. This is one premixed bed, using the existing bounded audio loader and narration/microphone controls.
