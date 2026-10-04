# Reusable audio envelope editor — 2026-10-03

Open `http://localhost:8123/dev/audio-envelope-editor.html` while `node dev/static-server.js` is running. The editor also accepts local recordings through **Open audio**. It does not load game scripts, read campaign saves, sign into an account, upload recordings, or change the game's catalog.

## Bell example

`http://localhost:8123/dev/audio-envelope-editor.html?src=../Audio/Prepared/alchemist-entry-bell-v1.wav&start=0.25&end=1.5343958333333334&fade=0.4&label=Alchemist%20bell`

The example selects the shortened 1.2844-second phrase from the original lossless master, starts its fade at 0.4 seconds and uses exponential strength 6.9. The source is a local ignored working master; another checkout can use Open audio instead. The generic editor contains no bell-specific asset path or campaign binding. `src` must resolve to the same HTTP(S) server. Optional query fields: `start`, `end`, `fade` (relative to selected region), `label`.

## Controls

- Drag any point or use exact time/volume fields and sliders. First/last points stay at the region boundaries but their volume can move. Arrow keys adjust a focused point; Shift increases time steps. Double-click the graph or use Add point; Remove/Delete removes an interior point.
- Choose linear, cosine or exponential interpolation. Strength controls how fast exponential segments approach the next point. Points can create fade-ins, fade-outs or more complex envelopes.
- Play curve and Play original compare the same selected region. Repeat auditions until stopped. Editing stops playback so no stale curve keeps playing.
- Export WAV downloads 16-bit PCM with the curve applied to every source channel. Playback and export use the same renderer; the original recording stays unchanged.
- Save/Load preset stores region, point coordinates and shape in versioned JSON. Open the matching recording before loading a preset. Copy settings also displays selectable JSON if clipboard access fails.

## Separation

`dev/audio-envelope.js` is browser-independent math, validation, multichannel PCM processing and WAV encoding; it also exports a CommonJS API. `dev/audio-envelope-editor.js` owns file I/O and the browser controls. HTML and CSS own layout. No external dependencies or game version changes.

## Evidence

Tests were written before the module existed. `node dev/tests-audio-envelope.js` checks malformed/nonfinite/duplicate points, bounds, exponential/linear/cosine behavior, exact endpoints, stereo processing, immutable input and WAV header/interleaving. Registered in the full standalone suite gate.

`node audits/VERIFY_601_audio_envelope_editor.cjs` uses isolated Chrome and the local server: actual pointer drag, numeric edit, add/remove, shape selection, audio start/stop, real WAV download with silent endpoint, rejected malformed preset leaves state intact, no horizontal overflow at 390px, and a different audio recording through the file picker. No page errors. Local screenshots: `Audio/Prepared/envelope-editor-desktop.png` and `Audio/Prepared/envelope-editor-phone.png` (ignored working artifacts). The editor exposes `window.__audioEnvelopeEditorTest` for reproduction without campaign state.

Prior bell revisions remain separate pending work. This editor is an audition/export surface; using it does not deploy a sound.

Full gate: ALL GREEN — 2,641 engine assertions and 94 standalone verifier suites. Desktop and phone screenshots inspected; the source-region time fields display six decimals without clipping.
