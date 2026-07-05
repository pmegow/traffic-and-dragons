# Traffic and Dragons — Session Handoff

**Date:** 2026-07-05 (late night; covers the 07-04 memory-engine day + the 07-04/05 designer evening)
**Deployed version:** v1.178 (`APP_VERSION` in `globals.js`) — **pushed; Pages auto-deploy in flight at handoff time** (poll `globals.js?nc=<ts>`).
**SW cache:** `tnd-v3-20260705d` (`sw.js`).
**Branch:** `master` — pushed through `a8a9648` (`origin/master` == local HEAD). Working tree clean.
**Server:** healthy on Fly; `/api/blueprints` routes verified LIVE; dead volume `vol_r7yw0lnl3lejpm1r` finally destroyed (#26 fully closed).

> **STANDING RULE: every commit is gated on the engine test suite.** `.git/hooks/pre-commit`
> runs `dev/run-tests.js` (**now 121 assertions**, headless node, ~1s) and BLOCKS on red.
> Hook isn't tracked — after a fresh clone: `cp dev/pre-commit .git/hooks/pre-commit`.
> **Host:** Cloudflare Pages ONLY. Read `CLAUDE.md` first for architecture; this file is "where we left off."

---

## ⚠ FIRST THING NEXT SESSION: the OneDrive stale-file incident

The v1.177 commit **silently dropped TODO.md rows #35/#36** — an edit landed on a stale
working file. Code files verified intact (feature greps + 121 green), rows restored from git
in `a8a9648`. Prime suspect: **OneDrive sync revert** (project lives under OneDrive). This is
the strongest argument yet for Known issue #1 (move/rename `dnd_rpg` → `traffic-and-dragons`,
ideally OUT of OneDrive): do it in Explorer BEFORE opening Claude Code, then update paths in
`.claude/settings.local.json` + `.claude/hooks/stop-check.js`. Until then: after any suspicious
edit failure, `git diff` before committing.

## The two sessions (v1.165 → v1.178, all pushed + deployed)

### Memory-engine day (07-04, from the t198 save evaluation)
| Ver | What |
|---|---|
| 1.165 | **#28 summarize-tail retention** — amnesia cliff killed: `retainSessionTail()` keeps ≤3 exchanges/1600 tok; `worldState.sessKept` marker means retained tail can't re-trip the gate AND is never extracted twice; `SUMMARIZE_AT` 1200→2400 (fires every ~5 mature exchanges). Membar `~NNNtk` now counts UNEXTRACTED tokens only. |
| 1.166 | **#29 futureEvents hygiene** — `fileFutureEvent` near-dup dedupe (feTokens ≥2 shared + ≥half smaller fingerprint → refresh setTurn), `expireFutureEvents()` at 40 turns, extractor echoes finished items via ANTICIPATED EVENTS list → `resolvedEvents[]`. Filing refactored into sync `applySummaryExtract()` (order: expire→file→resolve). t198's 7 "find Shalelu" dupes → 2. |
| 1.167 | **RAG retcon de-index + meta filter + merge-orphan bridge** — `[RETCON:]` tag marks correcting entry + predecessor `rc:1`; **"GM:"-prefixed player turns excluded from retrieval + IDF** (killed the t160 false pin correction AND t164-167 quiz echoes); write-time index names orphaned by `[NPC_MERGE:]` re-resolve via memoized `resolveNpcName`. Pin query now serves the TRUE t147 scene. Residual: untagged pre-tag prose corrections (t35). |
| 1.168/1.171/1.173 | **#32 inventory legibility** (3 rounds) — `invItemHtml()`: names bold, descriptions 80% opacity; splitter = spaced dash \| paren \| comma \| clause lead-ins (with/including/written/…). **Whack-a-mole by design** — user reports new bold-leaks, we add the lead-in. |
| 1.169 | **Known issue #3 CLOSED** — companion portrait single-home (`charSheet.portrait`; `npcPortrait()` helper for ALL display reads; migration drops dupes; 49KB off t198). Root-caused #6 (Daeris desync) in the same stroke. |
| 1.170 | **Portrait transport fix** — v1.169 opened an equal-turn transport hole (Frizwick/Morwen missing on mobile, reported live). Collectors read via `npcPortrait()`; `fillPortraitsFromBlob()` runs on EVERY reconcile, fill-only. |
| 1.171 | **#23 turn labels** ("Turn N" above narrative frames, live + replay) + **Morwen XP-bar lie** root-caused (negative width = invalid CSS = full bar; bars clamp at 0, `migrateWorldState` floors xp to `XP_LEVELS[level-1]` for player + companions). |
| 1.172 | **#34 companion XP parity** (every `[XP:N]` engine-mirrored to party; `COMPANION_XP` = individual bonus only, supersedes mirror same-response; forward-only, catch-up offered not imposed) + **#20 quest lifecycle teeth** (`buildQuestBlock`: all-objectives-done → quest-specific close-or-extend instruction; standing "active crises ARE quests" line). |
| — | Docs: TODO #30 filed (usage meter ~⅓ undercount — unpriced model id); #23 corpus check DONE on t198 (97% NPC registration GREEN, naming GREEN, prose steady GREEN; quest lifecycle RED→#20, future-events RED→#29); #26 closed; #8 merged into #10; **#10 spell/item bible = PRIORITY** (Message spell drift; must be GM-authoritative injection, not just tooltips); SQLite architecture decision recorded (stay JSON; FTS5/changesets as separable revisit triggers). Memory rule saved: **update the TODO row in the same commit as every fix.** |

### Designer evening (07-04/05)
| Ver | What |
|---|---|
| 1.174 | **#15 Blueprint cloud library** — AUDIT FOUND ~80% ALREADY BUILT (server table WITH `public` column + 3 routes LIVE on Fly; adapter methods; game-side surfaces). Added the missing piece: Designer **☁ Publish** (upsert by name-slug) + **☁ Library…** (list/Open/delete). Auth via same-origin localStorage (`autoConnect`) — designer never OAuths. REMAINING: browse-public, HARD-GATED on #22 sanitization. |
| 1.175 | **#35 breakout editors** — ⤢ on Premise/act Goal/Turning point/arc Objective/DNA hint → 55vh resizable modal; same data-attrs = existing delegated binding updates bp live. |
| 1.176 | **#36 creatures + arc rewards + cyanotype theme** — `creatures[]` schema (designer Bestiary section, monster-manual fields) → `worldState.bestiary` → **BESTIARY block in the STABLE prompt half** (campaign-constant = cached; "reach for these before inventing"); arc `reward` rendered on ACTIVE arc, granted same-response as `[ARC_COMPLETE:]`; designer restyled architectural-blueprint (graph-paper grid, designer-only). |
| 1.177 | **#37 collapsible everything** — sections + all cards fold; `_c` flags ON data objects (travel with reorders), `stripView()` keeps them out of files/publish; **existing blueprints load fully folded** (scroll + spoilers). |
| 1.178 | **Act reward** (same as arc reward, milestone scale, tied to `[ACT_COMPLETE:]`, "scene worthy of an act's end") + the #35/#36 row restoration. |
| — | **`tomb_of_annihilation.blueprint`** authored (repo root): 3 acts/11 arcs/11 NPCs/8 locations/6 creatures/6 rules, tone `swords`, voice `howard`, engine-validated end-to-end. Runelords fixture = shape reference. |

## READY TO TEST (next play session watch-list)
1. **Quests:** The Scarred Man (4/4) + The Glassworks (3/3) should CLOSE with rewards early (#20 teeth).
2. **XP parity:** party HUD numbers move together on every award (#34). Frizwick/Morwen/Daeris XP was floored (bars honest now).
3. **Portraits:** desktop first then mobile — Frizwick + Morwen should fill in (#6/v1.170 fill pass). Two-device confirm still owed.
4. **Membar:** counts to 2400 before "Filing memories…" — new normal, not a stuck summarize (#28).
5. **`[RETCON:]`:** correct the GM mid-story and check it emits the tag.
6. **Designer:** publish ToA with the real login → check ☁ Blueprint Library in the game cross-device; play a few ToA turns (bestiary + rewards in the prompt).
7. Turn labels, inventory bold/dim (report new bold-leak phrasings — lead-in list in `invItemHtml`).

## Next session, in order of value
1. **#10 spell/item bible — PRIORITY, affecting play** (Message drifted line-of-sight→limitless). GM-authoritative: inject canonical entry on cast/use (quest-block pattern); #8's tooltips read the same data. Consider the bestiary block (v1.176) as the shape template.
2. **#30 usage meter undercount** (~⅓ of cost silently $0 — identify the unpriced model id, add prefix match + "unpriced calls: N" line). Small.
3. **#33 action buttons append + input clear ×** (small, from play notes).
4. **#15 tail:** browse-public endpoint + UI — but **#22 sanitization first** (hard gate).
5. **Turn-guard CAS** (server-touch session; known issue #5 decision locked).
6. Blueprint Designer remaining: Generate mode, edit-active-game, browser "Edit in Designer" link.

## Don't get burned
- **OneDrive can serve you stale files** (see top). `git diff` before commit when anything smells off; the pre-commit test gate does NOT check docs.
- **RAG invariants:** stable half byte-identical (cache); flag-off = pre-RAG prompt byte-for-byte; retrieval READ-SIDE ONLY; excerpts never current truth. Meta filter keys on the player's literal `"GM:" `prefix convention.
- **Bestiary lives in the STABLE half** — campaign-constant by design; mid-game bestiary editing = one cache rewrite (fine) but per-turn mutation would kill caching. Engine test guards byte-identity.
- **Designer `_c` collapse flags are view state** — always route file/publish output through `stripView()`.
- **companion portraits: ONE home** — `charSheet.portrait` when a sheet exists; ALL display reads via `npcPortrait()` (helpers.js). Never write `npc.portrait` for sheet-carrying NPCs.
- **`sessionTokens()` counts only past `worldState.sessKept`** — it's the summarize trigger distance, not the window size (RAG skipN uses `sessionLog.length`).
- **File menus are generated** (`buildFileMenus()` in ui.js); **Designer has NO menu entry on purpose**; ES5 only; bump `APP_VERSION` + `CACHE` every game-code commit; `git commit -F <file>` for tricky messages; **update the TODO row in the same commit** (user rule, in memory).
- **`Rise_of_the_Runelords__Ammut__Ammut_t198.tnd` (repo root, gitignored) = THE mature-campaign fixture** — pin query truth = t147, broadsheet origin = t134-136. t160.tnd = the pre-fix comparison fixture. Do not delete either.
- User prefs on record: no Haiku pitches; single-purpose tools/satellite pages; wait for full answers; whack-a-mole is an ACCEPTED maintenance model for the inventory splitter.

## Deploy
- **Cloudflare Pages** auto-deploys on push to `master`. Poll `globals.js?nc=<ts>` for `APP_VERSION`.
- **Server:** `cd ..\traffic-and-dragons-server && flyctl deploy --ha=false` (separate repo, SIBLING directory — not inside this one). `/api/blueprints` live since before 07-04.
