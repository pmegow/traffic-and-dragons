# dev/blender — Blender from Claude Code

Two hookups, decided by the owner 2026-10-19 ("Both"), one job each:

| Path | What it is | When |
|---|---|---|
| **Headless scripts** (this folder) | `render.js` runs a scene script from `scenes/` inside `blender --background` and reports what it wrote. Reproducible, nothing to click, the frames are the proof. | The asset build: a dice roll, a clip for the game, anything that should render the same way next month. |
| **Live MCP link** | The `mcp-for-blender` add-on (a socket on `localhost:9876` inside a running Blender) and its MCP server, registered with Claude Code at user scope as `blender`. Claude builds and inspects in the OPEN Blender while you watch the viewport. | Exploration with you at the desk: "move the camera", "what does the scene hold", trying a material. |

Nothing here is loaded by the game. Output lands in `renders/<scene>/` (gitignored).

## Headless

```
node dev/blender/render.js                                  list the scenes
node dev/blender/render.js dice_roll                        defaults → renders/dice_roll/frame_0001.png …
node dev/blender/render.js dice_roll --result 20 --seed 3   a natural 20, reproducible from the seed
node dev/blender/render.js dice_roll --still 60             one frame, for a quick look
node dev/blender/render.js dice_roll --video                the frames plus renders/dice_roll/dice_roll.webm
```

Common flags: `--out DIR`, `--frames N`, `--fps N`, `--size WxH`, `--seed N`, `--engine EEVEE|WORKBENCH`,
`--samples N`, `--transparent` (RGBA frames, the felt hidden), `--video`, `--still N`. A scene's own
flags are documented at the top of its file. Blender is found through `BLENDER=<path>`, else the newest
install under `C:\Program Files\Blender Foundation`, else PATH; none is a loud refusal.

A scene script ends with ONE `SCENE_RESULT {json}` line the launcher parses; a `WARN` line names
anything it skipped or doubted (an unsettled die, a version-specific setting). A run with no result
line fails with Blender's tail.

**Adding a scene** = one file in `scenes/` that reads its options from the single `--json` argument
after Blender's `--` (see `dice_roll.py` for the shape). The launcher needs no change.

## Live MCP link

Installed 2026-10-19 on this machine (Blender 5.2.2 LTS):

- `uv` via winget (`astral-sh.uv`); the server is `uvx mcp-for-blender`.
- The add-on `mcp_for_blender.py` (v1.8, from github.com/ahujasid/blender-mcp `addon.py`) in
  `%APPDATA%\Blender Foundation\Blender\5.2\scripts\addons\`, enabled and saved in the preferences.
  It auto-starts its socket when a Blender window opens (scene property *Auto-Start Server*, on by
  default; the N-panel ▸ *MCP* tab has Start/Stop).
- Claude Code: `claude mcp add -s user blender <uvx.exe> mcp-for-blender` (user scope — it depends on
  this machine's Blender, so it is not in the repo's `.mcp.json`). A session started after the add sees
  the `mcp__blender__*` tools; a session older than the add does not.

To use it: open Blender, then ask. The add-on's `execute_blender_code` tool runs arbitrary Python in
your Blender — keep the socket on localhost (it has no authentication, which is the add-on's own
warning). Its Poly Haven / Hyper3D / Sketchfab integrations stay off unless you turn them on.

## The d20 clip batch (#650)

```
node dev/blender/dice-clips.js                 all twenty results, four Blender processes at a time (~5 min)
node dev/blender/dice-clips.js --only 20,1     a subset
```

One roll per result 1..20, rendered twice from the same seed: `dice/d20_NN.webm` (transparent VP9, the die
over the page) and `dice/d20_NN.mp4` (H.264 on the felt — WebKit plays VP9 but drops its alpha, so every
iPhone and Safari on the Mac get this one; `diceClipFormat` in helpers.js decides from the user agent).
A result's seed starts at its number and steps by 20 until the die has settled by the last frame; the
manifest records every seed and size, and the #650 engine test refuses a batch with a clip missing.
After a re-render bump `DICE_CACHE` in sw.js (the clips live in their own purge-exempt cache) and `CACHE`.

Two scene rules the clips depend on (dice_roll.py): the numerals are spun about their face normals at
the LAST frame so the result reads right side up from the camera (owner 2026-10-19), and the nineteen
other faces fade to 75% of the bone colour over the last twelve frames so the result pops (owner
2026-10-20) — a die dim through the tumble would look loaded.

## Proof

`node dev/blender/render.js dice_roll --seed 3 --result 20 --video` on 2026-10-19: 60 RGBA frames at
512×512 through EEVEE plus the WebM in 19 s, the die settled with the requested 20 up, the WebM encoded
through the sequencer without a second render (Blender 5 wants `image_settings.media_type = "VIDEO"`
before `file_format = "FFMPEG"`). The MCP chain (uvx server v1.30 → add-on socket → `get_scene_info`)
answered from a live Blender window.
