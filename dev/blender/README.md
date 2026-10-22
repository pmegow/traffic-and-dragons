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

One roll per result 1..20, ONE transparent render each, encoded twice from the same frames (`--video
webm,stacked`): `dice/d20_NN.webm` (VP9 with alpha, the die over the page) and `dice/d20_NN-stacked.mp4`
(H.264 twice as wide — the colour premultiplied over black on the left, the alpha as grey on the right).
WebKit plays VP9 but drops its alpha, and its only alpha codec, HEVC with alpha, cannot be encoded on this
machine (no Windows ffmpeg or x265 build ships the alpha layer — tried 2026-10-20 with the Gyan 9.0.2
build: "Loaded libx265 does not support alpha layer encoding"), so every iPhone and Safari on the Mac get
the stacked clip and ui-dice.js recombines it on a canvas; `diceClipFormat` in helpers.js decides from the
user agent. The stacked frames are built in the scene with numpy (bundled with Blender), no ffmpeg.
The throw is a real one — about 4 units/s with ~20 rad/s of spin, so the die turns over a few times
before it rests (owner 2026-10-21; the first cut read as a drop), which is why the clips run 84 frames.
A result's seed starts at its number and steps by 20 until the die has settled by the last frame AND
rolled at least 1.5 turns on the felt (the scene's `turns`: rotation about a horizontal axis while the
die is down — air tumbling and spinning on the spot do not count; `dev/dice-review.html` shows every
clip with its count); the
manifest records every seed and size, and the #650 engine test refuses a batch with a clip missing.
After a re-render bump `DICE_CACHE` in sw.js (the clips live in their own purge-exempt cache) and `CACHE`.

The batch passes `--shadow`: EEVEE has no shadow catcher, so the scene renders a second opaque pass plus
one bare-felt reference frame and composes the measured darkening (linear light, strength 0.9) under the
die as black with alpha; the fill light casts no shadow (its penumbra measured as grain). The encode scenes
use the Standard view transform — a new scene's default AgX re-graded the frames and squeezed the matte's
white to 207, a die the story showed through.

Three scene rules the clips depend on (dice_roll.py): the UP face's numeral is spun about its face normal
at the LAST frame so the result reads right side up from the camera (owner 2026-10-19) — only that one,
since every numeral squared to the camera looked printed on rather than rolled (owner 2026-10-21); the
nineteen other faces sit at 87.5% of the bone colour from the first frame so the result pops (owner
2026-10-20, dialled to half and on from the throw 2026-10-21); and the shadow pass above.

## The damage dice (#653)

```
node dev/blender/dice-clips.js --sides 4,6,8,10,12      the forty damage clips, four Blender processes at a time
node dev/blender/dice-clips.js --sides 12 --only 7      one face
node dev/blender/render.js dice_roll --sides 6 --result 4 --seed 3 --still 84   one look at a d6
```

Owner rulings 2026-10-21, all four as recommended: **clips like the d20** (not stills); **one clip per face, composited**
for several dice — a real two-to-four-die throw has ONE outcome per clip (2d6 has 36, 4d6 has 1296), so either the faces
could not match the damage number or the render count explodes, where one clip per face shows any result from forty
renders (4+6+8+10+12) and the page plays N clips side by side; **a row that wraps two-by-two when narrow**; **bone and ink**
like the d20. The same scene renders every die through `--sides`: the d20 is still Blender's icosahedron primitive on the
same seeds (its path is byte-for-byte the #650 one); the others are built from their vertices (convex hull, coplanar
triangles dissolved into the real faces) — a tetrahedron, a cube, an octahedron, a pentagonal trapezohedron (ten kites;
the ring vertices sit at the one height, k = h (1 − cos 36°) / (1 + cos 36°), that makes each kite planar) and a
dodecahedron, each with its own circumradius so the five read as one set, and a bevel in proportion to its shortest
edge. The numerals are painted after the bake as before, pair-wise so opposites sum to sides+1 (a d10 reads 1..10). The
**d4** is read at its top vertex: every face carries three numerals, one per corner, each standing up toward its corner,
so the apex number reads on every visible face; its pop is in the ink (the nine other numerals a third of the way to
bone) since every face is a result face. The 6/9 mark appears only on a die that has both.

Physics: the rounder dice roll much farther on the d20's throw. The 2026-10-21 seed survey (eight seeds each, the d20's
damping, 84 frames): d4, d6, d8 settled 8/8; the d10 6/8; **the d12 1/8** — it is the roundest solid of the five
(inradius 0.79 of the circumradius against the d20's 0.76) and it rocks on its flat pentagon after landing. A smaller
collision margin changed nothing (0.005 and 0.001: still 1–2 of 8); damping alone at 84 frames changed nothing either
(0.8/0.35: 2 of 8); at 120 frames, damping 0.65/0.3 settled 8/8 with rests at frames 77–116, so that is the d12's
setting (`DAMPING` in dice_roll.py, `FRAMES` in dice-clips.js: 120 for the d12, 96 for the d10 at 0.5/0.25, 84 for the
rest). The on-felt turn bar is per die too (`MIN_TURNS`): a tetrahedron flops (0.2), a cube rolls in quarter turns
(0.5), the d8 and the kites roll freely (1.0, 0.8), the d12 1.0; the d20 keeps its 1.5.

The scene now reports `rest_box` — the settled die's bounding box in the frame, fractions with a top-left origin — and
the batch records it per clip. The camera aims at the landing in every render, so the box barely moves between seeds;
`DICE_TILE_REST` (helpers.js) is its centre, and `diceTileLayout` crops each tile of a composited roll around it.
`dev/dice-review.html` draws every clip's box (the *Rest boxes* button). Survey knobs on the scene, all surveyed off by
default: `--damp A,L`, `--margin M`, `--throw F`, `--bounce F`.

Proof, 2026-10-21: `node dev/blender/dice-clips.js --sides 4,6,8,10,12` rendered all forty faces in 1481 s at four
lanes (13 seed retries, every one for too few turns, none unsettled; the d12's twelve faces averaged 1.6 turns on the
felt), 14 MB in all (d4 0.8, d6 1.6, d8 2.2, d10 3.2, d12 6.2 — the d12's 120 frames cost); the measured rest centre
over the forty clips is (0.614, 0.434), pinned as `DICE_TILE_REST` {0.61, 0.43}. The #650 engine tests stayed green
with the d20 untouched, and `showDamageRoll(4,[1,2,3,4])` played four tiles in a row at 1024 px and two-by-two at
375 px through the WebM player, the stacked-alpha canvas path recombining three d4 tiles in the same page.

## Proof

`node dev/blender/render.js dice_roll --seed 3 --result 20 --video` on 2026-10-19: 60 RGBA frames at
512×512 through EEVEE plus the WebM in 19 s, the die settled with the requested 20 up, the WebM encoded
through the sequencer without a second render (Blender 5 wants `image_settings.media_type = "VIDEO"`
before `file_format = "FFMPEG"`). The MCP chain (uvx server v1.30 → add-on socket → `get_scene_info`)
answered from a live Blender window.
