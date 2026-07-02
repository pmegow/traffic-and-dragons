# Traffic and Dragons — AUDIT (Fable)

Audit of the full project at v1.143 (2026-07-01). Scope: inefficiencies, drift vulnerabilities (narrative inspiration + story/state), and general kruft. **Fix batch shipped as v1.144** — statuses below updated; deferred items say why. Read HANDOFF.md and TODO.md first; findings already tracked there are referenced, not duplicated.

## Drift — narrative inspiration (prose voice)

| # | Task | Effort | Status |
|---|---|:---:|---|
| 1 | **Prose author silently dropped by three creation paths.** `startGame()` (game.js:14) only stores the author when called with 4 arguments, but `showCreationSpellPick` early-exit (char-creation.js:352), `confirmCreationSpells` (char-creation.js:395), and `cbConfirm` (char-creation.js:479) all call `startGame(c,pendingTone,pendingVoice)` — 3 args. So ANY caster (goes through the spell picker) and ANY level ≥4 start (goes through stat bumps) loses the author picked in Step 1; the campaign silently inherits the device default from `PROSE_K`, which may be a different voice or none. Only the no-spells/no-bumps paths (char-creation.js:299, :334) pass `pendingAuthor`. This is a direct "the author's voice evaporated" vector that no prompt tuning can fix. **Remedy:** pass `pendingAuthor` at all four call sites. `_startImportedCampaign` (ui.js) passes 3 args by design (import flow has no author picker) — now commented as intentional. | S | ✅ Done (v1.144) — all three paths pass `pendingAuthor`; intentional 3-arg import call commented |
| 2 | **Tone voice and author voice are two competing style directives.** `buildSysPrompt` injects the TONE block (`tone.voice`) AND the STYLE block with the author `vc`. Both are style instructions; the model averages them, diluting the author voice — the same failure mode old TODO #27 ("voice mostly evaporated by turn 32") was about. **Remedy:** subordinate tone style explicitly when an author is set. | S | ✅ Done (v1.144) — when a prose author is set, a NOTE after TONE declares tone governs CONTENT only and the VOICE directive wins on style |
| 3 | **`summarize()` reads only the first 300 chars of each message.** memory.js sliced every sessionLog entry to 300 chars before extraction — a 1,000-token GM turn is ~4,000 chars, so the extractor saw ~7% of each scene, always the opening. Chapter summaries, NPC knowledge, decisions, and future events were extracted from scene openings only; mid/late-scene events silently never entered long-term memory. **Remedy:** raise the slice substantially. | S | ✅ Done (v1.144) — GM turns now sliced at 4,000 chars (near-whole), player turns at 500 |
| 4 | **Action-suggestion call has zero character context — root cause of Known issue #4.** `generateActions` (game.js) used a bare `sysOverride` with no character sheet, so the model invented actions from prose alone — "Cast Magic Missile" for a character who doesn't have it. **Remedy:** append a sheet digest to the override. Cross-reference: TODO Known issues #4. | S | ✅ Done (v1.144) — override now carries level/class/HP, abilities, available spells + "never suggest what isn't listed"; TODO #4 marked done, ready to test |

## Drift — story/state desync

| # | Task | Effort | Status |
|---|---|:---:|---|
| 5 | **A failed `summarize()` permanently destroys the session log.** The catch block did `sessionLog=[]` — one bad JSON parse or network blip discarded up to ~1,200 tokens of unarchived events from long-term memory forever. **Remedy:** keep the log and retry; degrade gracefully after repeated failures. | S | ✅ Done (v1.144) — log kept + retried next turn; after 3 consecutive failures a raw excerpt is archived as a degraded chapter, then cleared |
| 6 | **`summarize()` NPC updates bypass `resolveNpcName` — re-opens the v1.143 fork fix.** The extractor freely returns variants ("Morwen (Ammut's wife)"), forking NPCs exactly the way the v1.143 rewrite prevents for tags; entries also created without `aliases:[]`. **Remedy:** resolve before writing; standard blank shape. | S | ✅ Done (v1.144) |
| 7 | **`[XP:+25]` is silently swallowed.** XP parser required `\[XP:(\d+)\]` — no sign — while GOLD/HP formats invite signed values; `cleanTxt` stripped the unparsed tag so the award vanished invisibly. Same gap in `[COMPANION_XP:]`. **Remedy:** tolerate `+` and trailing junk, mirroring the v1.32 GOLD/HP loosening. | S | ✅ Done (v1.144) — both parsers loosened |
| 8 | **Blueprint-seeded locations crash `fileLocation` on first travel.** `applyBlueprint` seeded `{visits:0,notes:[]}` but `fileLocation` runs `.visited.push(turn)` → TypeError inside `applyMuts` on the first `[LOCATION:]` into a seeded location (e.g. Sandpoint), aborting ALL remaining tag processing for that response. **Remedy:** seed the right shape + defensive guard. | S | ✅ Done (v1.144) — seed fixed to `{visited:[],notes:[]}` AND `fileLocation` self-heals missing `.visited` |
| 9 | **Re-roll and retry desync the transcript (story compiler's source of truth).** `rerollLast` swapped the displayed narration + sessionLog but never `worldState.transcript`; `retryLast` re-logged the player line, duplicating it. **Remedy:** replace the last gm transcript entry on reroll; skip the duplicate player log on retry. | S | ✅ Done (v1.144) |
| 10 | **"Update & Retry" API-key box writes a key slot that's never read.** `_attachGMErrorUI` stored the pasted key into `apiKey`/`AKK` only, but `callGM` reads `providerKeys[activeProvider]` first — the stale invalid key kept winning; retry failed forever. **Remedy:** write the active provider's slot + persist. | S | ✅ Done (v1.144) |
| 11 | **Summarization threshold was three different numbers** (trigger 1000, gate 1200, membar red 1000, docs 1000). **Remedy:** one constant. | S | ✅ Done (v1.144) — `SUMMARIZE_AT`(=1200) in globals.js drives sendAction, summarize(), and the membar (amber at 80%); CLAUDE.md §8 updated |
| 12 | **The "USED NAMES list" rule points at a list that never exists** — nothing populates `memory.usedNames` and no such block is injected; dead rule text. Related: `getNameSuggestions(10)` was called INSIDE `buildSysPrompt` and mutated `memory.nameIdx` — a write side-effect in the prompt builder that burned names on internal calls and breaks prompt-caching stability (TODO #11). **Remedy:** fix the rule text; make the builder side-effect-free. | M | ✅ Done (v1.144) — rule rewritten against the real KNOWN NPCs list; `getNameSuggestions` gained a peek mode used by buildSysPrompt; the cursor advances once per narrative turn in sendAction. `memory.usedNames` field kept for save-shape compat. |
| 13 | **NPC detail injection misses alias mentions.** Hot-NPC scan matched canonical names only; an NPC referenced by alias in recent prose got no ACTIVE NPC DETAILS block. **Remedy:** match aliases too. | S | ✅ Done (v1.144) |
| 14 | **Engine doesn't enforce the offered-quest gate it promises.** `applyMuts` applied `[QUEST_STEP:]` to offered quests despite the rules forbidding it. **Remedy:** engine backstop — ignore steps on offered quests. | S | ✅ Done (v1.144) — QUEST_STEP now skipped while `status==="offered"` (GM self-activation via `[QUEST:\|active]` still allowed — in-story acceptance is legitimate) |
| 15 | **`importSave` skips the loadState migration battery.** Older exports ran unmigrated until the next full reload. **Remedy:** shared migration function. | S | ✅ Done (v1.144) — migrations extracted to `migrateWorldState()` (state.js), called from both loadState and importSave |

## Inefficiencies

| # | Task | Effort | Status |
|---|---|:---:|---|
| 16 | **Every turn POSTs the full state to the server 2–3×, including the entire story DOM.** `saveAll()` → `syncToServer()` fires from `applyMuts` AND sendAction each turn; each POST ships worldState + memory + sessionLog + the complete `#story-narrative` innerHTML (storage-adapter.js), which grows without bound. **Remedy:** debounce syncToServer (one POST per turn); cap or drop narrativeHtml in favor of `worldState.transcript` (see #18). | M | **Deferred** — touches the cross-device sync path; needs a real 2-device test session before shipping |
| 17 | **Action-suggestion call resends the entire session history** (~1,200 tokens for 3 short strings, every turn) + a completion race could write stale `lastActions`. **Remedy:** last scene only + turn-stamp race guard. | S | ✅ Done (v1.144) — sends latest cleaned GM scene (≤2,400 chars) via new `callGM` `opts.noHistory`; result discarded if the turn advanced mid-flight |
| 18 | **The same prose is stored four ways** — transcript (by design), sessionLog (by design), narrativeHtml DOM copy (derivable!), chapter summaries (by design). **Remedy:** rebuild the story pane from `transcript`; stop persisting DOM HTML. | M | **Deferred** — bundle with #16 as one sync-payload rework + 2-device test |
| 19 | **DEFAULT_RULES has grown to 28 rules (~1.6k words) re-sent every turn**, with heavy overlap (4/5/14, 17/18, 9/10, 25/26). Long lists cost tokens and dilute per-rule compliance. **Remedy:** editorial merge to ~18–20 rules; then freeze as the cacheable prefix for TODO #11. | M | **Deferred** — behavior-affecting prompt surgery; wants its own session + playtest-harness run to compare rule-following before/after |
| 20 | **`buildSysPrompt` stable/volatile interleave blocks TODO #11 (prompt caching).** Tracking link only. | — | ⚠ Partially resolved (v1.144) — the #12 side-effect blocker is gone; the reorder itself remains with TODO #11 |

## Kruft

| # | Task | Effort | Status |
|---|---|:---:|---|
| 21 | **Dead `API` global** (globals.js:1, referenced nowhere). | S | ✅ Done (v1.144) — deleted |
| 22 | **Blank-memory literal duplicated 8× with drifting shapes** (most omitted map/npcGraph/nameIdx); blank-NPC literal similarly scattered, several missing `aliases`. **Remedy:** factories. | M | ⚠ Partially done (v1.144) — `blankMemory()` in state.js now used by all 8 reset paths; NPC creation sites in api.js/memory.js got `aliases:[]` added but a full `blankNpc()` factory refactor was skipped (10+ dense call sites, low payoff vs. churn risk) |
| 23 | **`getDefaultDeity` dead ancestry branches** (`halfling`, `dragonborn` don't exist in ANCS). | S | ✅ Done (v1.144) — deleted |
| 24 | **`_applyBlueprint` still targets the dead `#tone-grid .card` selector** (ui.js; broken since v1.133). | S | Pending — tracked in BLUEPRINT_EDITOR.md §5.2; fix belongs to the Blueprint Designer build |
| 25 | **`logoutFromServer` never tells the server who is logging out** (no Authorization header → session never invalidated). | S | ✅ Done (v1.144) — token captured before clearing and sent as Bearer |
| 26 | **Replay logic duplicated** (`_applyLoadedCampaign` vs `initReplaySession`). | S | ✅ Done (v1.144) — campaign load now calls `initReplaySession()` (bonus: campaign loads with an empty sessionLog now get the "Previously:" recap too) |
| 27 | **Sticky Cartesia error downgrades TTS for the whole session** after one transient blip. | S | ✅ Done (v1.144) — recorded failure auto-expires after 5 minutes; Cartesia retried |
| 28 | **`loadState`'s local `_m` shadows the module-level `_m` fallback store.** | S | ✅ Done (v1.144) — migration flag renamed `_mig` (inside the new `migrateWorldState()`) |
| 29 | **`parseActions` legacy three-tier parser** — retained deliberately for pre-v1.110 save replay (ui.js call sites). Delete once pre-v1.110 saves are judged extinct. | — | Pending — keep until old saves age out |

## Documentation drift (CLAUDE.md vs code)

| # | Task | Effort | Status |
|---|---|:---:|---|
| 30 | **CLAUDE.md drift:** (a) "17 rules" → ~28; (b) "8 classes" → 9 (Necromancer); (c) summarize "1000" → `SUMMARIZE_AT` 1200; (d) gemini/grok stale default models; (e) Qwen render id/strength; (f) "Current: v1.114" version rot. | S | ✅ Done (v1.144) — all six corrected; version line now points at `APP_VERSION` so it can't rot again; membar threshold text updated; `callGM` signature updated |

**Effort:** S < 1h · M 1–3h · L 3–8h · XL multi-session · — no code work / tracking only

---

## What remains after v1.144

1. **#16 + #18 — sync payload rework** (debounce + transcript-driven replay). One M-sized task; requires a two-device test to verify cross-device replay and portrait reconcile still work.
2. **#19 — DEFAULT_RULES editorial merge.** Behavior-affecting; do in its own session with a playtest-harness before/after comparison, then feed directly into TODO #11 (prompt caching) as the frozen cacheable prefix.
3. **#24** rides with the Blueprint Designer build; **#29** stays until old saves age out.

## Suggested verification (v1.144)

- New caster character with a prose author picked in Step 1 → after spell pick, confirm `worldState.proseAuthor` is set (Dev Mode ▸ Prose inspiration shows "· this campaign").
- Load the Runelords blueprint, travel to a seeded location → no "GM error", location files normally.
- Action buttons over several turns → no spells the character doesn't have.
- Force a summarize failure (bad key mid-session) → "will retry next turn" toast, session log intact.
