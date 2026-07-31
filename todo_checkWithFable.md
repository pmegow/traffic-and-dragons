# todo_checkWithFable.md

**Purpose:** work done by a **non-Fable model** (Opus, Sonnet, Haiku) that deserves Fable-eyed
review lands here with its supporting documentation. Two intake classes:

1. **Drift-surface tasks** (CLAUDE.md ▸ drift-protection policy) built by a lighter session —
   always filed, however small.
2. **Fable-budget-exhausted mode (user rule 2026-07-29): while the Fable budget is out, ALL
   Opus work is documented here** — every substantive task, not just drift-surface — so that
   when the budget renews, the whole batch can be triaged in one pass.

**How to file:** one `###`-headed entry under **Pending Fable review** — what shipped (versions,
commits), what it touches, why it's risky or not, supporting docs/tests, and what a reviewer
should probe first. Self-contained enough that a Fable session needs no other context.

**How to review:** `/fable-review <entry>` (validated workflow — see `.claude/skills/fable-review`).
When Fable is satisfied (or files follow-ups), move the entry's full record to
[audits/FABLE_REVIEW_RECORDS.md](audits/FABLE_REVIEW_RECORDS.md) and add one line to the
**Reviewed index** below. This file stays lean; the archive holds the receipts.

---

## Pending Fable review

### 8 — Campaign-clock work: instrumentation, player-facing time, 1-based days, and the TIME_ADVANCE scene rewrite (v1.496→v1.499, all Opus 5, 2026-07-30)

**TLDR:** a field report ("game time feels WAY too slow") turned into a measurement, then three shipped changes and one prompt rewrite. The prompt rewrite is the drift-surface item and is where a reviewer should start; the rest is additive or display-only.

**Origin (the measurement, not a guess).** The user asked for a per-turn breakdown of Day 1. It could not be produced: `[TIME_ADVANCE:]` is stripped before `logTranscript` writes, and the `"Time +Xm"` line the handler builds into `R.muts` is discarded (`applyMuts` returns `R`; `commitGmTurn` never captured it). Only the running total `worldState.clock.min` survived. So Day 1 was reconstructed from prose by 8 parallel Sonnet agents pricing each turn under the GM's own reference scale, deliberately unaware of the real total. Result, from the live save `Ammut_t1265.tnd`:

- Day 1 = **turns 1050–1265** (anchored on the t1049 `[REST:long]`, which rolls the clock to the 1440 dawn boundary; corroborated by t1003, where the GM states "20 hours 2 minutes elapsed since epoch")
- clock actually advanced **1043 min** (4.8/turn) · narration describes **~2332 min** (10.8/turn) → **2.24×**
- conversation was **100 of 216 turns** (46%), priced by the old scale at 1–5 min
- ⚠ the clock started **mid-campaign** (v1.389 ≈ t917; `migrateWorldState` starts an old save at Day 0 on load), so this is NOT the campaign's first day
- evidence artifact: **[timeline_day1.html](timeline_day1.html)** (216 line items, banner notes the later renumbering)

**What shipped, in order:**

| ver | commit | change | risk |
|---|---|---|---|
| v1.496 | `a7709d1` | `.ta` — minutes the clock moved, stamped per GM transcript entry | additive field, turn path |
| v1.497 | `088134f` | player-facing `Turn N \| Day D, h:mm am`; `.ck` absolute clock stamp | display only |
| v1.498 | `1e13293` | day labels 1-based (first day = Day 1) — **changes GM prompt text** | label layer |
| v1.499 | `a62a6bf` | `[TIME_ADVANCE:]` reference rewritten to price SCENES, not actions | ⚠ **drift surface** |

**① v1.496 — `.ta` (the receipt).** `logTranscript(role,text,raw,taMin)` stamps minutes the clock ACTUALLY moved, measured as a clock delta around `applyMuts` in `commitGmTurn` rather than parsed from the tag — so a `[REST:long]` dawn roll is captured too. Stamped **even when zero**, because a tagless turn is the silent-failure class the field exists to expose and a missing key is indistinguishable from a pre-feature entry. Lands at push time, so `transcript.length` changes and the compression memo misses on its own — **the `.sp` post-stamp trap (needing `invalidateTranscriptMemo`) does not apply**; a reviewer should confirm that reasoning. 4 tests red-first, 3 sabotage clauses proven.

**② v1.497 — player-facing clock.** `clockTimeOfDay` implements the projection already fixed by #89 and written in clock.js's own header: `(clock%1440)+6h`, dawn=6am. Computed every render, never stored. `clockStamp` is the single formatter feeding BOTH the turn caption and the session bar. `.ck` (absolute clock at narration time) is stamped so a rebuilt transcript captions past turns correctly; entries predating it render the bare turn number rather than a guess (verified against that failure condition). An engine test asserts **no clock face reaches either half of the system prompt**.

**③ v1.498 — 1-based day labels (user call).** `clockDayNumber()` is the only 1-based producer; both `clockFmt` (GM clock block) and `clockStamp` (player) route through it, so the surfaces cannot end up a day apart. `clockParts().d` stays a pure 0-based elapsed decomposition on purpose. Pure relabel over the same scalar — no migration, and `.ck` written under the old label still renders right. **This DOES change GM-visible prompt text** (the clock block reads Day N+1 now); mid-campaign that shifts the GM's day number by one against any day reference in older prose. Judged low-impact because the GM is instructed never to restate or compute these numbers, and the block is recomputed every turn — **worth a second opinion.** 4 sabotage clauses, including both half-renumbered states.

**④ v1.499 — the TIME_ADVANCE scene rewrite. ⚠ THE DRIFT-SURFACE ITEM — START HERE.**
Touches `tag_table.js` TAG_DOCS → `buildStateTagsDoc()` → the STATE TAGS block in the **STABLE (cached)** half of `buildSysPrompt` (api.js:673). New "CHARGE THE WHOLE SCENE" rule plus scene-inclusive values (word in passing 5–10m · real conversation/interrogation/negotiation 20–45m · searching a room 30–60m · errand or asking around town 1–2h · combat round unchanged at ~1m) and an instruction to charge the gap when the prose implies one.
Pre-code review recorded in the commit: one-time prompt-cache invalidation on deploy, re-warming next turn (**verified the stable half is still byte-identical across a turn + clock move**); `scheduleDue()` is threshold-based (`now >= due`) and already jump-safe, so larger advances cannot skip a deadline; `CLOCK_MAX_RESPONSE_ADVANCE` (30 days) is far from scene-scale.
Frozen doc hash **deliberately re-baselined** (−1634278882/16673 → −1271027224/17350, +677 chars) with the reason logged inline.
Values were anchored to the measured 10.8 min/turn rather than chosen — **the real risk of this change is overshoot (days flying past), not undershoot.**

**Testing note a reviewer should weigh.** The frozen doc hash catches ANY byte change, so a normal one-file sabotage would have "caught" every mutation while proving nothing about the new clause guard — the exact fake-coverage the harness refuses. So the sabotage is **two-file**: it mutates the prompt text AND re-baselines the hash the way a careless commit would, then asserts the clause guard still fires. 4/4 caught (scene framing, "EVERY turn", the `[REST:long]` carve-out, the no-arithmetic line), both files restored byte-identical. Harness: scratchpad `sab_scene.js` (not committed — reproduce or ask).

**What a reviewer should probe first:**
1. **④'s prompt text against a real transcript** — does the GM now over-charge? Measure off `.ta` (that is what ① exists for) before trusting the reconstruction's 2.24×.
2. **④'s stable-half placement** — confirm the cache contract genuinely holds and no volatile state leaked in with the rewrite.
3. **③'s mid-campaign day shift** — is the one-day jump in GM-visible text actually harmless in a mature save?
4. **①'s memo reasoning** — is "push-time stamping needs no `invalidateTranscriptMemo`" airtight, given the `.sp` incident?
5. **Cause ② is UNSHIPPED and still open** (TODO #106): a turn with no `[TIME_ADVANCE:]` advances zero, silently — `if(!ts.length)return;`, no warn, no floor, one caller. It is the larger error and a no-silent-failures violation; the remedy was deliberately deferred until ④ can be measured.

**Supporting material:** TODO **#106** (full root cause + both causes + every remedy note), TODO **#105** (unrelated, promoted from B17 the same session), **timeline_day1.html**, engine suite 895 → 905 assertions across these commits.

---

### 9 — Inventory acquisition toast (#107, v1.500, Opus 5, 2026-07-30)

**TLDR:** the sheet changed in silence, so the player could not tell a recorded pickup from a narrated-but-untagged one. A turn that grants items now says what landed. Not drift surface — zero parser contact — but it sits on the turn path and its absence is now load-bearing signal.

**Field report.** The GM narrated the garrison quartermaster *"handing over what's left of the blasting supplies, a few coils of rope, nothing fancy"* and the user had no way to know whether any of it reached inventory. Narration and sheet are separate channels: the prose can describe an acquisition the tags never made.

**As built.** `inventorySnapshot()` / `toastInventoryGains(pre)` (game.js) — a snapshot-diff at the TURN call site, the same idiom as core memories / conditions / relationships, **zero parser contact**. Toasts `🎒 Collected: Rope x3, Blasting charge`.
- Reports the **delta, not the stack total** — a rope stack going 5→7 says `x2`, because "did that land?" is answered by what you just got. Counts compare per `_invNorm` key.
- **Silent when nothing was gained, on purpose:** a narrated pickup with NO toast now means the tag never fired. That is the diagnostic the user was missing, so it must never toast speculatively.
- Capped at `INV_TOAST_MAX`=6 named items + "+N more" — never silently truncates.
- **Deliberately NOT a `showToast` inside the `ITEM_GAINED` handler:** `syncCharSheet` applies a batch of those tags during its audit and already owns a louder per-correction trail (#50a), so a handler toast would double-report there. Wiring at the turn site excludes the sync path for free (the #40 precedent).

**⚠ Testing note worth a reviewer's attention.** The first sabotage pass came back **3/4** — deleting the call from `commitGmTurn` entirely left every test green, because they all invoked `toastInventoryGains` directly and none proved it was **wired**. That is textbook fake coverage and the harness caught it. Two tests were added that drive the real `commitGmTurn` (grants → toast; grants nothing → silent); now 4/4, the other clauses being "reports the total instead of the delta" and "treats a loss as a gain (>= for >)". Harness: scratchpad `sab_inv.js`. Verified live in the browser (toast text + inventory panel agree).

**What a reviewer should probe:** (a) is player-only the right scope — companions gain items via `COMPANION_ITEM_GAINED` and are currently silent; (b) should losses get the same treatment, or is that toast noise (the #1 misroute-toast noise watch is precedent for restraint); (c) does the toast fire anywhere unintended — `rerollLast` re-narrates the same turn but never re-runs `applyMuts`, so it should not, and that is untested.

**Still open:** whether the reported turn (t1266+, past the exported save) actually emitted `[ITEM_GAINED:]` is UNKNOWN — it could not be checked. If the emission side is the real defect, this change only makes it visible, it does not fix it. Related unshipped work: #60 ghost-consumable detection already covers the narrated-but-untagged class for consumables.

---

### 10 — Parallel-act hook delivery (v1.495, Opus 5, 2026-07-30)

Filed under the standing budget-exhausted rule (ALL Opus work documented), not because it is drift surface — though it touches the skeleton lifecycle, which is.

**Field report:** the campaign spine leaked into party banter — t1244 named Turtleback Ferry and Jorgenfist unprompted, t1263 dropped "Mokmurian". **Root cause:** `buildSkeletonBlock`'s PARALLEL-act line said "weave hooks for the others into scenes naturally" with **no delivery guidance**, so the GM took the cheapest route and had party members simply know things. Reinforced by the bestiary block, which names Jorgenfist/Mokmurian every turn in the STABLE half, and by seeded `memory.npcs` knowledge.

**Change:** a HOOK DELIVERY constraint — foreshadowing for inactive arcs must arrive through a named NPC with a reason to know (a sheriff reporting trouble, a scholar with rumors, a merchant with road news), never narrator asides or party chatter; the hook must be something someone SAYS.

⚠ Prompt text in the **volatile** half (skeleton block), so no cache impact. **No new test** — a prompt-wording change with no engine behavior to assert; suite green but this one rests on field observation only, which is the weakest evidence in this batch. A reviewer may reasonably want the bestiary/seeded-knowledge channels examined too, since they were contributing causes left untouched.

---

## Reviewed index

Full records: [audits/FABLE_REVIEW_RECORDS.md](audits/FABLE_REVIEW_RECORDS.md). Queue drained to
zero 2026-07-27.

| # | Subject | Reviewed | Verdict |
|---|---|---|---|
| 7 | TODO #95 speaker casting — four-agent Opus 5 build (v1.440; scope widened to v1.440→v1.461 incl. #96 [SAY:]) | 2026-07-27 | All 5 filed items adjudicated (①②③ PASS, ④ token-half PASS, ⑤ CONFIRMED); 6 confirmed defects + 6 hardens fixed v1.462; 1 new class filed into #93 |
| 6 | B9/B10 voice-stack campaign — 9 versions in one session, all Opus (v1.416→v1.424) | 2026-07-23 | 3 PASS, 1 CONFIRMED finding (fixed v1.429) |
| 5 | #16c diagnostics — one touch inside `summarize()` (drift surface) | 2026-07-24 | v1.407 enrichment PASSES all three asks; 2 confirmed adjacent findings + 2 pre-existing defects fixed v1.439 |
| 4 | Voice/TTS rework — curated Piper set, per-character voice (TODO #9) | 2026-07-24 | 3 CONFIRMED findings fixed v1.439; ★ memo question answered; splitter edges filed (#93) |
| 3 | Campaign clock — new time subsystem + tags + injection + migration (TODO #73) | 2026-07-23 | PASS on 4 of 5; 1 CONFIRMED finding fixed v1.433 |
| 2 | NPC mood/relation separation — schema repair of the character-state tier | 2026-07-24 | Design + core semantics PASS under live fire; 5 confirmed finding groups fixed v1.439; 3 residues accepted |
| 1 | TODO #23 — per-arc pacing budget + inverse arc-drift detector | 2026-07-16 | PASS on all four verify items; no code changes needed (full record also in audits/AUDIT_ARC_NUDGES.md) |
