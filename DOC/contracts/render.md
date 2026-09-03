# Rendering, portraits and the character sheet

**Read this when** you touch doRender, the fal.ai models, portrait paths or the sheet modal.

Split out of CLAUDE.md on 2026-09-03 (#310); the map there links here. Version stamps and history links inside are the record as written — the contract lines are current unless a newer commit says otherwise.

## 18. Render feature

`doRender()` calls the **fal.ai** API. Three models selectable via Render Options modal (in Dev Mode). **#208a (owner call 2026-08-21): BOTH Flux entries (flux/dev + the flux-lora "HQ" host) are DROPPED from the menu** — consistently sub-par for scenes (solo-portrait img2img collapsed party scenes to one figure; the five-way controlled test [DOC/Research/party_render_engines.html](DOC/Research/party_render_engines.html) confirmed the class). Stored prefs pointing at departed ids fall back via `resolveRenderModel` (helpers.js); the shipped default is now **Nano Banana 2** (the five-way champion). ⚠ The PORTRAIT paths (ui-portrait.js `generatePortraitImage` refSrc branch + game.js portrait-from-render) still call `fal-ai/flux/dev/image-to-image` DIRECTLY at pinned 0.75 — deliberate: the endpoint remains live on fal, portraits were the one surface the owner rated Flux decent at, and re-pointing them is its own decision:
- **Nano Banana 2** — `fal-ai/nano-banana-2` / `fal-ai/nano-banana-2/edit` (img2img via `image_urls`; edit-style API, no strength knob) — **the default** (five-way champion)
- **GPT Image 2** (#210) — `openai/gpt-image-2` / `openai/gpt-image-2/edit` (multiSeed compositor via `image_urls`, no strength knob). Quality pinned `"medium"` — the exact config that tops every image arena, ~4× cheaper than high. Probe-verified 2026-08-21
- **Seedream 5 Pro** (#210) — `bytedance/seedream/v5/pro/text-to-image` / `/edit` (multiSeed, up to 10 refs). ⚠ NO `fal-ai/` prefix — the newest partner models drop it; the prefixed id 404s. Probe-verified presets incl. landscape/portrait_4_3. Group-scene caveat from the five-way rides the family; the #209 levers + text-only-party policy are the mitigations
- **Qwen Image 2512** — `fal-ai/qwen-image-2512` / `fal-ai/qwen-image-edit/image-to-image` (img2img, default strength 0.9 — edit-style model returns near-copies at 0.6)
- **Grok Imagine** (#162) — `xai/grok-imagine-image` / `xai/grok-imagine-image/edit` (img2img via `image_urls`, edit-style API, no strength knob; lowercase `"1k"` resolution; **`maxSeeds:3` as table data** — the over-cap party member is described-only and named in the status line + legend). #210: v2.0 exists at the vendor but is NOT on fal (404-probed 2026-08-21) — v1 is the latest callable. ⚠ #166 field: the edit endpoint ACCEPTS `aspect_ratio:"4:3"` but output follows the reference portraits' 3:4 when references dominate. **#166: every multiSeed prompt carries a numbered reference legend** (`buildSeedLegend`, game.js) — unlabeled refs made Grok guess the face-to-name mapping
- ~~Flux Dev / Flux [Dev] HQ~~ — dropped at #208a (both entry shapes + the #163 A/B history live in git at v1.689 should a FLUX.2-era entry ever earn a seat)

**img2img strength is user-tunable (#42):** each model's `img2img` entry declares its `strength` default as data (body fns take it as a param); `img2imgStrength(cfg)` (helpers.js) resolves the player's per-model override (Render Options ▸ "Portrait influence" slider, 0.2–0.95, persisted in `RENDER_STR_K`) over the default, returning `null` for knobless models (slider hides). Only the scene render (`doRender`) reads it — portrait-generation paths keep their fixed 0.75.

When `character.portrait` exists, img2img is used automatically. **#165:** portrait-seed selection is table-driven — a `multiSeed:true` entry (Nano, Grok) gets the whole party's portraits via `collectRenderSeeds` (pure, game.js); single-reference APIs get the player only, and the status line says so. The scene-render request is built by pure `buildSceneRenderRequest` (engine-tested): per-character description FLOOR instead of a party sentence cap (the STYLE-cap lesson again) + an explicit never-omit-gender demand. Falls back to text-to-image if no portrait.

Parameters: `aspect_ratio:"4:3"`, `resolution:"1K"`. `genderWord` derived from `c.gender` (male/female/androgynous).

## 19. Portrait system

`character.portrait` — null or base64 data URL. Compressed via `compressPortrait()` (Canvas resize to max 400×600px, JPEG 0.8) before storage to avoid localStorage quota overflow.

Set from three paths:
1. Scene render → portrait button on render output
2. Portrait modal → "Use as Portrait" button
3. Portrait modal → file upload

**Pan + zoom:** `character.portraitOffset = {x, y, zoom}` (x,y 0..1, zoom ≥ 1) — rendered by `applyPortraitTransform(img, off)` (translate+scale, post-load), NOT `object-position` (it can only pan the single cover-overflow axis). `wirePortraitDrag()` does drag-pan + wheel/pinch zoom + exposes `img._zoomBy(factor)`; `normPortraitOff()` upconverts legacy saves. Player + companion char-sheet avatars and the portrait modal use the offset; small NPC/list/party-HUD avatars stay center-cropped.

**Companion portrait single-source:** an NPC's portrait lives in ONE place — `charSheet.portrait` when a sheet exists (rides inline in the sync blob), `npc.portrait` only for sheet-less NPCs (separate `/portrait` store). All display reads go through `npcPortrait()` (helpers.js, charSheet-first). **Transport:** the `/portrait` collectors read via `npcPortrait()`, and `fillPortraitsFromBlob()` runs on every server reconcile regardless of the turn/PV gates — fill-only (without it, equal-turn devices have NO portrait transport at all). Desync history: [history](DOC/CLAUDE_HISTORY.md#19-portraits--the-sync-sagas).

**Companion offset:** stored per-companion on `wsNpc.portraitOffset` and mirrored onto `wsNpc.charSheet.portraitOffset` (so it survives promotion-to-PC). ⚠ `showNpcSheet` wires `wirePortraitDrag` on `#npc-portrait-img` via `wireNpcAvatarDrag()` and MUST pass `getOffset`/`setOffset` into `showPortraitModal` — without those the modal's defaults fall back to `worldState.character`, silently rewriting the PLAYER's framing while editing a companion. Portraits generate at **3:4 portrait aspect** via `portraitRenderBody()` (overrides the render model's landscape default; scene renders untouched).

## 20. Character sheet modal (`#cs-modal`)

Opened via **Sheet** button in topbar (desktop) or File menu (mobile). Built by `showCharSheet()`.

**Visual style:** `rgba(0,0,0,.88)` overlay, inner `#181818` box with `1px solid var(--acc)` amber border, `border-radius:12px`, `max-width:560px`. Click outside or × to close.

**No pill/chip borders anywhere** — all data rendered as plain text. Commas separate list items. Used spells get `text-decoration:line-through` + dim color. Broken languages shown in amber with `(broken)` suffix.

**Sections:** Hero card · Attributes · Character (trait/flaw/motivation/backstory) · Conditions · Relationships · Languages · Save Modifiers · Skills (earned only) · Story Beats · Abilities · Spells · Inventory

**⟳ Sync button** (header, beside Export Character) calls `syncCharSheet()` in `game.js`. It sends an internal GM audit prompt (not a player turn) asking the GM to emit ONLY state tags for anything missing or changed on the player AND every party member — using `COMPANION_*` tags for companions. The prompt enumerates each party member by name. Response passes through `applyMuts()`; the sheet then closes and reopens. Gated by `busy`; uses a 500-token budget. Provides a manual fallback for older sessions where the GM didn't emit upkeep tags inline.
