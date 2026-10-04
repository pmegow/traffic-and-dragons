# Rendering, portraits and the character sheet

**Read this when** you touch doRender, the fal.ai models, portrait paths, the sheet modal, the live panels or the utility modals.

**A portrait is an image, never markup (#481 F2, v1.1036).** Every `<img>` whose `src` is concatenated goes through `safeImgSrc(url)` (helpers.js): it admits an image data URL (`png|jpeg|jpg|gif|webp`, base64), `https:` or `blob:`, returns it HTML-escaped, and returns "" with one console line for anything else — a crafted save could otherwise close `src` and add an event handler. The IMAGE SRC CONTRACT in run-tests.js scans root `*.js` AND `*.html` and fails on a raw concatenated `<img>` src. The import boundaries drop a failing portrait with a toast through `portraitAdmit` / `portraitsSanitizeWorld`: `importSaveData`, the `.char`/library preview funnel (`showCharImportPreview`), both library adopters, `fillPortraitsFromBlob` and the quick start. All 318 real portraits in the owner saves (JPEG data URLs) pass unchanged. Pinned by `#481 F2` + `dev/sabotage-481-f2-safe-img.js`.

Split out of CLAUDE.md on 2026-09-03 (#310); the map there links here. Version stamps and history links inside are the record as written — the contract lines are current unless a newer commit says otherwise.

## Files

### ui-shell.js

Status: ✅

Moved here from CLAUDE.md's file table on 2026-10-03 (the clutter pass): the stamps are the record as written.

toasts, screen switching, message log (`showToast`, `addMsg`, `showGame`/`showChar`, `switchTab`, `closeAllMenus`) — loads first; called by nearly every other file. **#501:** `syncShopButton()` keeps ONE Shop button on the newest scene's Render row while `shopOpportunity()` holds — painted from the live state by `syncUI` and by `addMsg` for a narration, never stored with a turn

### ui-panels.js

Status: ✅

Moved here from CLAUDE.md's file table on 2026-10-03 (the clutter pass): the stamps are the record as written.

`syncUI` + the live panels (HUD, party, quest, inventory/abilities/spells, combat, membar + the #17 drift-health dot, sync badge). **#489:** the abilities panel paints through `abPanelHTML`, grouped Racial / Class / Archetype / Story by the sheet's own `abilityGroups`. **#430:** the inventory panel's ledger rows (counter, chest) route through ONE click-time gate `invLedgerOpen(name)` — nothing about `busy` is baked into the paint (the turn's repaint runs before busy clears). **#501:** the counter has two doors over ONE rule, `shopOpportunity()` (helpers.js) — this panel's Trade row and the narration's Shop button (`syncShopButton`, ui-shell.js). **#431:** what lies at the current node rides the turn's summary line ("Here: …", `hereItemsLine` in helpers.js via `mutsSummaryEmit` in tag_table.js, every kind, UI only); the panel's "Your house" item group is retired. **#495:** the summary line says a repeated label once with its count ("+Crossbow bolt (x24)", `mutsCollapseRepeats` in tag_table.js) — display only; `R.muts` and the provenance ring keep every label. **#481 A6:** decided by the NODE — the hero's own house (`node.owner` = the hero) shows "chest (N items)"; every other node names its items

### ui-sheets.js

Status: ✅

Moved here from CLAUDE.md's file table on 2026-10-03 (the clutter pass): the stamps are the record as written.

char/NPC sheet rendering (`csSheetSections` one-renderer-three-hosts), `showCharSheet`/`showNpcSheet`, `generateNpcSheet`, `_switchPlayerCharacter`, `showCapabilityCard`; **#489:** the ability list is grouped under Racial / Class / Archetype / Story headings by `abilityGroups` (helpers.js, derived from the name → [contract](render.md)); **#429 batch drop:** the inventory × MARKS a row red (`markInvItem`), one "Delete N items" button at the foot of the list commits every mark (`dropMarkedItems`; the copy says DELETE because nothing is placed in the world — owner ruling 2026-09-21) through the pure `invDropPlan`/`invDropApply` (helpers.js) — marks are session state resolved against the live inventory at render and at commit — and at the click: the × carries its row's name beside its index and `invMarkResolve` (helpers.js) prefers the name when a GM turn moved the pack under an open sheet (#481 F8; it used to mark the neighbour); no per-item confirm; closing a sheet discards pending marks with a toast (`_invDropDiscard` via modalShell `onClose`)

### ui-modals.js

Status: ✅

Moved here from CLAUDE.md's file table on 2026-10-03 (the clutter pass): the stamps are the record as written.

settings & utility modals (rules, sync, render options, provider, usage, prose, quest journal, bug report, #17 drift health, the #426 stake modal at Begin — `showStakeModal(done)`, asked only when `stakeAskWanted`, latches `done()` once); the #407 ledger modal (`showLedgerModal`: the shop's counter and the chest) — **#497:** a row's count steps through the pure `ledgerNextMark` (helpers.js): up by one to the row's maximum, then back to none

## 18. Render feature

`doRender()` calls the **fal.ai** API. Three models selectable via Render Options modal (in Dev Mode). **#208a (owner call 2026-08-21): BOTH Flux entries (flux/dev + the flux-lora "HQ" host) are DROPPED from the menu** — consistently sub-par for scenes (solo-portrait img2img collapsed party scenes to one figure; the five-way controlled test [DOC/Research/party_render_engines.html](../Research/party_render_engines.html) confirmed the class). Stored prefs pointing at departed ids fall back via `resolveRenderModel` (helpers.js); the shipped default is now **Nano Banana 2** (the five-way champion). ⚠ The PORTRAIT paths (ui-portrait.js `generatePortraitImage` refSrc branch + game.js portrait-from-render) still call `fal-ai/flux/dev/image-to-image` DIRECTLY at pinned 0.75 — deliberate: the endpoint remains live on fal, portraits were the one surface the owner rated Flux decent at, and re-pointing them is its own decision:
- **Nano Banana 2** — `fal-ai/nano-banana-2` / `fal-ai/nano-banana-2/edit` (img2img via `image_urls`; edit-style API, no strength knob) — **the default** (five-way champion)
- **GPT Image 2** (#210) — `openai/gpt-image-2` / `openai/gpt-image-2/edit` (multiSeed compositor via `image_urls`, no strength knob). Quality pinned `"medium"` — the exact config that tops every image arena, ~4× cheaper than high. Probe-verified 2026-08-21
- **Seedream 5 Pro** (#210) — `bytedance/seedream/v5/pro/text-to-image` / `/edit` (multiSeed, up to 10 refs). ⚠ NO `fal-ai/` prefix — the newest partner models drop it; the prefixed id 404s. Probe-verified presets incl. landscape/portrait_4_3. Group-scene caveat from the five-way rides the family; the #209 levers + text-only-party policy are the mitigations
- **Qwen Image 2512** — `fal-ai/qwen-image-2512` / `fal-ai/qwen-image-edit/image-to-image` (img2img, default strength 0.9 — edit-style model returns near-copies at 0.6)
- **Grok Imagine** (#162) — `xai/grok-imagine-image` / `xai/grok-imagine-image/edit` (img2img via `image_urls`, edit-style API, no strength knob; lowercase `"1k"` resolution; **`maxSeeds:3` as table data** — the over-cap party member is described-only and named in the status line + legend). #210: v2.0 exists at the vendor but is NOT on fal (404-probed 2026-08-21) — v1 is the latest callable. ⚠ #166 field: the edit endpoint ACCEPTS `aspect_ratio:"4:3"` but output follows the reference portraits' 3:4 when references dominate. **#166: every multiSeed prompt carries a numbered reference legend** (`buildSeedLegend`, game.js) — unlabeled refs made Grok guess the face-to-name mapping
- ~~Flux Dev / Flux [Dev] HQ~~ — dropped at #208a (both entry shapes + the #163 A/B history live in git at v1.689 should a FLUX.2-era entry ever earn a seat)

**img2img strength is user-tunable (#42):** each model's `img2img` entry declares its `strength` default as data (body fns take it as a param); `img2imgStrength(cfg)` (helpers.js) resolves the player's per-model override (Render Options ▸ "Portrait influence" slider, 0.2–0.95, persisted in `RENDER_STR_K`) over the default, returning `null` for knobless models (slider hides). Only the scene render (`doRender`) reads it — portrait-generation paths keep their fixed 0.75.

When `character.portrait` exists, img2img is used automatically. **#165:** portrait-seed selection is table-driven — a `multiSeed:true` entry (Nano, Grok) gets the whole party's portraits via `collectRenderSeeds` (pure, game.js); single-reference APIs get the player only, and the status line says so. The scene-render request is built by pure `buildSceneRenderRequest` (engine-tested): per-character description FLOOR instead of a party sentence cap (the STYLE-cap lesson again) + an explicit never-omit-gender demand. Falls back to text-to-image if no portrait.

**Per-scene render (#206, v1.881; owner rulings 2026-09-09).** Every GM frame carries a small Render (`.frame-render`, addMsg) that calls `doRender({turn})`. The current turn takes the live path unchanged; a past turn renders from ITS frame: `renderContextForTurn(turn)` reads the last non-bookkeeping, non-refusal GM entry of that turn — prose, `ck`, and the stamps — and the writer call goes with `{noHistory:true}` and the frame's prose embedded (`opts.scene`), or every button would paint the CURRENT scene. **Weather:** omitted unless the entry stamps it or the prose names it (`weatherInProse`, `WEATHER_WORDS`) — "paint no weather, only the place and its light" otherwise. **Party:** the entry's `p` stamp when present (dead-since companions included), else the current living party filtered to members the prose names, the player always. **Stamps going forward** (state.js `logTranscript`, GM entries only): `l` location, `sl` sub-location, `w` weather, `p` living party names — entries older than the stamps approximate. The image sits under its frame and the render pointer stamps the FRAME's turn. Test + `dev/sabotage-206-scene-render.js` (5 clauses).

**Scene-led posture (#397, v1.896; owner direction):** the writer derives each character's actual posture and activity from the scene; stillness is valid and movement/intensity must be supported by the story. There is no compulsory action-pose menu, comic-book posing, pose-variety quota, foreground crop or motion-verb preference. Camera motion cues are conditional on scene movement. The portrait-reference instructions preserve the written posture and activity, including stillness. The #397 tests and five mutation proofs guard both boundaries. These replace the earlier action-pose requirements; the remaining orientation clauses below still apply.

**Staging clauses in `buildSceneRenderRequest` (game.js):** #209 eye-lines → body-orientation floor → faces optional → staging geometry + camera-relative view angles → **#390 MOVEMENT (v1.870):** a moving character's direction of travel is stated relative to the focal point, a moving party shares ONE line of advance staggered in depth, the ground ahead of a runner is open toward it (the High Reach gate render: torsos on the gate, the companion's legs into the wall) → **#390b (v1.877, clause REMOVED v1.897 — owner ruling 2026-09-11):** the "A DESCRIBED FACE IS A SHOWN FACE" clause is gone — naming the face, even to forbid it, was the problem; the test now asserts its ABSENCE. What survives is the header rule: eye colour and face words are demanded only for face-shown characters, so the engine withholds face words rather than the writer being told to (six-render A/B, 2026-09-09: 0/5 with the companion's face described across three painters, seeds and no seeds; 1/1 without — [audits/AUDIT_390_staging_renders.md](../../audits/AUDIT_390_staging_renders.md)). Each clause is pinned by the #165/#209 render-request test; wording changes are deliberate commits.

Parameters: `aspect_ratio:"4:3"`, `resolution:"1K"`. `genderWord` derived from `c.gender` (male/female/androgynous).

## 19. Portrait system

`character.portrait` — null or base64 data URL. Compressed via `compressPortrait()` (Canvas resize to max 400×600px, JPEG 0.8) before storage to avoid localStorage quota overflow.

Set from three paths:
1. Scene render → portrait button on render output
2. Portrait modal → "Use as Portrait" button
3. Portrait modal → file upload

**Pan + zoom:** `character.portraitOffset = {x, y, zoom}` (x,y 0..1, zoom ≥ 1) — rendered by `applyPortraitTransform(img, off)` (translate+scale, post-load), NOT `object-position` (it can only pan the single cover-overflow axis). `wirePortraitDrag()` does drag-pan + wheel/pinch zoom + exposes `img._zoomBy(factor)`; `normPortraitOff()` upconverts legacy saves. Player + companion char-sheet avatars and the portrait modal use the offset; small NPC/list/party-HUD avatars stay center-cropped.

**Companion portrait single-source:** an NPC's portrait lives in ONE place — `charSheet.portrait` when a sheet exists (rides inline in the sync blob), `npc.portrait` only for sheet-less NPCs (separate `/portrait` store). All display reads go through `npcPortrait()` (helpers.js, charSheet-first). **Transport:** the `/portrait` collectors read via `npcPortrait()`, and `fillPortraitsFromBlob()` runs on every server reconcile regardless of the turn/PV gates — fill-only (without it, equal-turn devices have NO portrait transport at all). Desync history: [history](../CLAUDE_HISTORY.md#19-portraits--the-sync-sagas).

**Companion offset:** stored per-companion on `wsNpc.portraitOffset` and mirrored onto `wsNpc.charSheet.portraitOffset` (so it survives promotion-to-PC). ⚠ `showNpcSheet` wires `wirePortraitDrag` on `#npc-portrait-img` via `wireNpcAvatarDrag()` and MUST pass `getOffset`/`setOffset` into `showPortraitModal` — without those the modal's defaults fall back to `worldState.character`, silently rewriting the PLAYER's framing while editing a companion. Portraits generate at **3:4 portrait aspect** via `portraitRenderBody()` (overrides the render model's landscape default; scene renders untouched).

## 20. Character sheet modal (`#cs-modal`)

Opened via **Sheet** button in topbar (desktop) or File menu (mobile). Built by `showCharSheet()`.

**Visual style:** `rgba(0,0,0,.88)` overlay, inner `#181818` box with `1px solid var(--acc)` amber border, `border-radius:12px`, `max-width:560px`. Click outside or × to close.

**No pill/chip borders anywhere** — all data rendered as plain text. Commas separate list items. Used spells get `text-decoration:line-through` + dim color. Broken languages shown in amber with `(broken)` suffix.

**Sections:** Hero card · Attributes · Character (trait/flaw/motivation/backstory) · Conditions · Relationships · Languages · Save Modifiers · Skills (earned only) · Story Beats · Abilities · Spells · Inventory

**Abilities are grouped (#489, owner 2026-09-30).** The list prints under plain-text headings in a fixed order — Racial · Class — <class> · Archetype — <archetype> · Story — and an empty group has no heading. The group is DERIVED at render by `abilityGroups(c)` (helpers.js) from the ability's name: a `[Racial]` prefix, a class bible row (level row or starting ability), a row of the COMMITTED archetype (or the archetype itself), else Story. The record has no source field and none is added. Under Racial the name drops its own `[Racial]` prefix; an old `LvN` entry prints the name inside it (`abilityParts`). Headings follow the no-pill rule. The play panel groups the same way: `updateAbPanel` paints through the pure `abPanelHTML(c,hl)` (ui-panels.js) over the same `abilityGroups`, and `hl` marks the NEWEST ability (the last stored), wherever its group puts it. Pinned by `dev/tests-489-ability-sections.js` (pure + the real `csSheetSections` and `abPanelHTML` renders).

**⟳ Sync button** (header, beside Export Character) calls `syncCharSheet()` in `game.js`. It sends an internal GM audit prompt (not a player turn) asking the GM to emit ONLY state tags for anything missing or changed on the player AND every party member — using `COMPANION_*` tags for companions. The prompt enumerates each party member by name. Response passes through `applyMuts()`; the sheet then closes and reopens. Gated by `busy`; uses a 500-token budget. Provides a manual fallback for older sessions where the GM didn't emit upkeep tags inline.

**Character voice controls (#402):** Player and NPC sheets show separate Primary voice (Speechify) and Backup voice (Piper) selectors and Test buttons. Assignments save on selection; tests use the chosen actor. Speechify labels use name/gender and its test uses the player API key. Existing Piper IDs remain intact.

**Character voice filtering (v1.906, owner):** Both sheet pickers offer only gender-matched actors for M/F and the full bank for NB. Unknown character gender does not unlock both banks; existing pronoun fallback applies. Unknown/mixed actor metadata is excluded from M/F lists. Saved pins outside the visible list remain selected but hidden and disabled as choices; opening the sheet never rewrites them. Global narrator/cast catalogs remain unrestricted.
