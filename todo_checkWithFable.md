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

## Off-Fable log
- 2026-08-28 (dev-only): `bug_tracker.html` gained `window.__bugTrackerTest`; its own run-tests contract bans executable-HTML sinks and pins filed/feed/findings text through the shared `textContent` boundary (f75; sabotage 6/6). Satellite seam + additive security coverage only.
- 2026-08-28 (v1.718): browser-file failures now release restored-render URLs, separate picker cancellation from real selection/permission errors, and report a failed persistent folder clear honestly; service-worker runtime writes and Piper revision GC are event-owned and loud on cache failure (9 probes; sabotage 10/10). Browser I/O only.
- 2026-08-28 (v1.716): TTS deadlines now own response bodies and preserve/drain timeout remainders explicitly; STT uploads have full-response deadlines and generation-owned base text so stale recordings cannot write or send (5 failing-first assertions; retained sabotage 6/6). Transport ownership only; no prompt, parser, memory, or transcript-integrity path changed.
- 2026-08-24 (v1.711): Druid archetype swap — Circle of the Land → Circle of Stars, Circle of Spores → Circle of Flame (owner-ruled: Spores' decay collided with the Necromancer's Entropist; its L14 rot-stone-wood-iron was the Entropist's literal signature). 12 new level rows written to the house voice, no spell-list references (coverage guard N/A), canonical-form edit, suite 1671 green. Registry-entry content per the safe-changes map.
- 2026-08-24 (v1.709): level-up gain toasts — checkLevelUp/checkCompanionLevelUp now toast the level + each gained ability by name (presentation-only additions over the existing bible-row grants; 2 failing-first tests, suite 1668 green); companion gained-features also get their missing system feed line.

Safe-changes-map work (#21, CLAUDE.md ▸ Dev workflow): ONE line per shipped change —
`- vX.YYY <commit> — <what> (<shape from the map>)`. Batch-skimmed by Fable; if the skims stay
clean, this log graduates away. Anything that outgrew a line belongs under Pending Fable review.

- unversioned · 2026-08-14 — Bible editor toolbar removed Download copy, Capability additions, and Discard draft; source contract + 4/4 sabotage + rendered localhost check (read-only satellite UI + additive dev coverage)
- unversioned · 2026-08-14 — Add to Bible routes through an explicit create-or-replace boundary; missing-add and existing-update contracts + 4/4 sabotage + rendered localhost check (read-only satellite logic + additive dev coverage)
- unversioned · 2026-08-14 — Bible Editor.cmd starts the helper and opens the served editor; offline install alert retired, status made truthful, 10/10 fixtures + 6/6 sabotage + rendered localhost check (satellite UI + additive dev tooling/coverage)
- unversioned · 2026-08-14 — Bible Editor write-token prompt/retry deleted; localhost Origin remains the write authority, direct-file/foreign pages refuse without credentials; 11/11 fixtures + 7/7 sabotage (satellite UI + additive dev coverage)
- unversioned · 2026-08-14 — Shared Bible Editor v1.0.0 label + helper/launcher compatibility handshake; stale helper/page writes refuse, 19/19 fixtures + 13/13 sabotage + rendered check (satellite UI + additive dev tooling/coverage)
- unversioned · 2026-08-15 — Bible Editor v1.1.0 made project-file saving the only workflow: no Save As/download/file-handle writes, loud draft-preserving writer failure, success closes Add form, and launcher lifecycle is exercised; 24/24 fixtures + 17/17 launcher sabotage + 27/27 remaining sabotage + disposable add/update/failure browser run (satellite UI + additive dev tooling/coverage)
- unversioned · 2026-08-15 — Bible Editor v1.1.1 gives the unavailable-writer state the explicit READ ONLY / launch-via-cmd instruction; 25/25 fixtures + 18/18 sabotage + rendered disabled-Save check (satellite UI + additive dev coverage)
- unversioned · 2026-08-15 — Bible Editor v1.1.2 makes write readiness origin-aware: file:// stays read-only even with a healthy helper, Save/Add/Update disable, and capability writes refuse before fetch; 28/28 fixtures + 21/21 launcher sabotage + 27/27 remaining sabotage + disposable disabled-control render (satellite UI + additive dev coverage)
- unversioned · 2026-08-23 — Bible Editor v1.1.3 makes Martial mutually exclusive with arcane/divine/primal/necromantic in both checkbox directions, with validator backstop, failing-first contract, and 4/4 mutation proof (thin satellite DOM shell over a tested pure rule + additive dev coverage)
- unversioned · 2026-08-23 — Bible Editor v1.1.4 adds inclusive-OR category filters to the spell browser and limits free text to name/effect, with failing-first contract and 5/5 mutation proof (thin satellite DOM shell over a tested pure rule + additive dev coverage)
- unversioned · 2026-08-23 — Bible Editor v1.1.5 keeps the capability dependency coherent across open/reload/save and refreshes it before every class spell-browser candidate build, with loud refresh failure, failing-first contract, and 6/6 mutation proof (thin satellite DOM shell over a tested pure rule + additive dev coverage)
- unversioned · 2026-08-23 — Bible Editor v1.1.6 separates the visible UI revision from helper protocol v1.0.0, reuses compatible detached writers, and auto-replaces true stale helpers only after PID/executable/checkout ownership proof; 37/37 lifecycle fixtures + 26/26 mutation proof (satellite UI + additive dev tooling/coverage)
- unversioned · 2026-08-28 — Performance benches now derive the complete engine order from `dev/load-engine.js` and compare honest memo-reset CONTROL vs memo-live CURRENT paths; loader/label source contract + 4/4 disposable mutation proof (additive dev tooling/coverage)

**How to review:** `/fable-review <entry>` (validated workflow — see `.claude/skills/fable-review`).
When Fable is satisfied (or files follow-ups), move the entry's full record to
[audits/FABLE_REVIEW_RECORDS.md](audits/FABLE_REVIEW_RECORDS.md) and add one line to the
**Reviewed index** below. This file stays lean; the archive holds the receipts.

---

## Pending Fable review

### 27 — SPELL_DEF may not shadow curated spell canon (#253, v1.720; Opus lane A, owner-ruled)

**Filed:** 2026-08-28. **Tracker:** TODO #253 (JP0-8 / Fable f51). **Touched:**
`capability_bible.js` (`capIsBaseCatalog` — new predicate beside `capabilityLookup`),
`tag_table.js` (the SPELL_DEF handler's new on-catalog refusal), `game.js` (cross-reference
comment at `canonizeCompanionSpellDefs`), `dev/engine-tests.js`,
`dev/sabotage-drift-hardening.js`.

**What shipped.** The handler's write-once check consulted only `worldState.capabilityBible`, so
a `[SPELL_DEF:]` naming a curated base entry filed a permanent shadow that `capabilityLookup`
then preferred everywhere — including `manaSpellCost`/`manaMax`, so a tier=1 redefinition of a
tier-3 spell silently repriced the whole pool. Now an on-catalog name is REFUSED: loud console
warn, a `⚠ Spell canon NOT redefined:` muts line, zero writes. Off-catalog spells keep the
overlay-wins write-once flow byte-for-byte. Per the owner ruling, overlay entries that already
shadow a base entry are left as-is — no migration, historical canon stands (pinned by a test).

**Verification.** 3 engine assertions; the refusal one was RED first, and the other two are
deliberate green regression pins (the emergent path and the no-migration path must NOT change —
a red there would mean I broke something, not that a defect existed). 4 new sabotage clauses in
`dev/sabotage-drift-hardening.js`, all proven, whole battery green.

**What the reviewer should probe:**

1. **Two predicates, deliberately different widths.** `capIsBaseCatalog` is the STATIC half;
   `canonizeCompanionSpellDefs` keeps `capabilityLookup` (base ∪ overlay) because at its call
   site the union is the right question. I documented the asymmetry at both sites rather than
   forcing one shared predicate. Confirm that reading, or collapse them.
2. **The `capability_bible.js` addition sits below the data block.** The BIBLE EDITOR CONTRACT
   round-trip carries `prefix` and `suffix` verbatim, and the suite is green, so an editor save
   is still a no-op — but the file is machine-touched by a satellite and now holds one more
   hand-written function. Worth one look.
3. **`ABILITY`-shaped entries are covered too.** The bible holds abilities under the same keys,
   so `[SPELL_DEF:Power Strike|…]` is now refused as well. That follows the unified-bible design
   (`kind` is cosmetic) and I believe it is right, but it was not explicitly ruled.
4. **No repair path for the shadows already in the field.** The refusal is forward-only. If a
   live save carries a bad shadow, the only exit remains an operator console
   `delete worldState.capabilityBible[key]` (Fable f51's own verifier note). If the owner wants a
   player-facing repair, that is a separate design.

### 26 — WHO abandoned it: the quest archive's `by` field (#252, v1.719; Opus lane A, owner-ruled)

**Filed:** 2026-08-28. **Tracker:** TODO #252 (JP0-3 part A). **Touched:** `helpers.js`
(`questArchiveWording` — new pure renderer), `api.js` (`abandonQuestState` stamps `by:"player"`),
`tag_table.js` (the #231 wall archive write stamps `by:"wall"` + `wasOffered`; the QUEST reopen
guard's warn + muts line now render through the helper), `ui-modals.js` (Quest Journal History
label), `dev/run-tests.js` (#144A contract clauses ③ and ④), `dev/engine-tests.js`,
`dev/sabotage-231-arc-wall.js`.

**What shipped.** Three authors, one status. `abandonQuestState` and the arc wall now sign their
archive records; the wall additionally marks a swept OFFERED hook `wasOffered:true` (owner's
"opportunity lapsed" reading — a hook the player never accepted was the third semantic hiding
under the same label). `questArchiveWording(rec)` is the ONE renderer for every reader, returning
`{origin,label,phrase}`: "abandoned by you" / "closed with the arc" / "opportunity lapsed", and
"abandoned" for a LEGACY record with no `by` — which must never be read as a player drop. The
reopen guard's hardcoded "the player dropped it" (false for every wall sweep, and surfaced in the
console, the provenance ring, the turn's system message and the #229 decisions modal) is gone.

**Verification.** 7 failing-first engine assertions (all confirmed RED before implementation;
1691→1698 green). Sabotage `dev/sabotage-231-arc-wall.js` extended 16→22 clauses, 22/22 proven
byte-identical. The pre-existing clause quoting the wall's archive write was re-pointed in the
same commit (Fable f3's own verifier warning). Every prove block gained `also:["ui-modals.js"]` —
the new History-label source clause reads a ui shard that is NOT in the engine manifest, so
without it the clone's baseline reds and every clause misattributes (this actually happened on
the first run: 0/9 misattributed).

**What the reviewer should probe:**

1. **The History modal is a DOM shell I could not drive.** `ui-modals.js` has no test seam, so the
   three renderings are proven only at the pure helper plus a source clause pinning that the
   modal calls `questArchiveWording(aq).label`. A reviewer should eyeball the live journal once —
   the label sits inside the collapsed `<summary>` beside the turn stamp.
2. **`wasOffered` is written as a boolean on every wall record** (`false` for active threads), so
   a save now carries an explicit `false` where nothing existed. It is falsy everywhere it is
   read, but if a future reader does `"wasOffered" in rec` it will see a difference between wall
   records and player records. Decide whether the field should be omitted when false.
3. **Only "abandoned" got provenance.** `declined`, `completed` and `failed` archives still carry
   no author, and `archiveQuest` (the completed/failed writer) is untouched. If the wider JP0-3
   bundle (status validation, the declined reopen hole, archive-overwrite protection) lands later,
   it should decide whether `by` generalizes to every archive write or stays abandoned-only.
4. **No migration.** Pre-v1.719 abandoned records stay authorless forever and render neutrally.
   That is the deliberate honest choice (the author is genuinely unknowable), but it means the
   #231 field watch cannot count wall sweeps that happened before this commit — Fable f12's
   measurement gate only opens from here forward.

### 23 — The arc wall: emergent thread scoping (#231, v1.714; Opus, owner-ruled)

**Filed:** 2026-08-24. **Tracker:** TODO #231. **Touched:** `helpers.js` (`skeletonArcTitles`,
`questIsEmergent`, `currentArcTitle`), `tag_table.js` (QUEST creation stamp, ARC_COMPLETE sweep),
`api.js` (`buildArcWallNudge`, NOTE_BUILDERS + NOTE_LATCH_FIELDS), `globals.js`.

**Why this is here.** Quest lifecycle teeth + an applyMuts write path that DELETES live quests +
a new prompt channel. The destructive half is what wants the hardest look: no prior engine path
archives a quest the player never touched.

**What the reviewer should test hardest, in order:**

1. **The sweep is the first engine path that destroys player-visible state on a schedule.** I made
   it narrow three ways (spine-titled never stamped, unstamped immune, parallel acts stamp
   nothing) and each is sabotage-pinned, but a reviewer should hunt for a fourth hole — especially
   a quest whose title later CHANGES, or an arc whose title is edited by a repair tool: the stamp
   is a title string, so a renamed arc orphans its progeny into permanent immunity (fails safe,
   but silently). Consider whether the stamp should be an arc index or id instead.
2. **`abandoned` now has two authors** (#229's player button and this sweep) and they are
   indistinguishable in the archive. If the History UI or a future Table Talk answer needs to say
   "you dropped this" vs "the story moved on", it cannot. A `by` field may be wanted.
3. **The warning's runway may be wrong.** ARC_WALL_WARN_LEAD=15 fires relative to
   ARC_TURN_BUDGET, but the #23 pacing nudge only fires when the arc is ALREADY over budget — so
   a fast arc completes with no warning at all, and its threads die unannounced. That is arguably
   correct (short arc, short leash) but it was not a deliberate design choice, it fell out of the
   arithmetic. Decide.
4. **Interaction with `[ARC_CONTINUE:]`.** An arc the GM legitimately keeps open never triggers
   the wall, so a thread can still outlive its nominal budget indefinitely as long as the GM keeps
   re-affirming the arc. #127's escalation is the only brake. Whether that is a loophole worth
   closing is a judgement I did not make.

### 22 — Define item: player-initiated item canon (#230, v1.710; Opus, owner-requested)

**Filed:** 2026-08-24. **Tracker:** TODO #230. **Touched:** `game.js` (`buildItemDefinePrompt`,
`defineItemFromStory`), `ui-sheets.js` (the 📖 row button), `item_bible.js` (one static entry —
Karzoug's greed-signet ring, owner-worded canon).

**Why this is here.** Shares entry 21's exact review-call shape and therefore its open question:
the response runs the FULL applyMuts, so a hallucinated non-ITEM_DEF tag would land. If entry
21's adjudication decides a tag whitelist for review calls, this caller joins it — one decision,
two sites (syncCharSheet is the third precedent, pre-dating both). Beyond that: the button gates
on `itemLookup` misses, so a classification-only entry (effect N/A) suppresses Define — decide
whether that is right (such an entry organizes but never injects, so the GM can still drift on
the item's nature; arguably Define should offer for effect-N/A non-mundane entries too, but
write-once means the def could then never land without an editor flow).

### 21 — Quest journal buttons: Suggest completion + Abandon (#229, v1.708; Opus, owner-requested)

**Filed:** 2026-08-24. **Tracker:** TODO #229. **Touched:** `api.js` (`abandonQuestState`, the
volatile abandonBlock), `tag_table.js` (QUEST reopen guard — one added clause), `game.js`
(`buildQuestSuggestPrompt`, `suggestQuestCompletion`, the 2-turn clear), `ui-modals.js` (buttons,
confirm modal, decisions modal).

**Why this is here.** A new prompt-injection block in buildSysPrompt's volatile half, a reopen-guard
clause in the QUEST handler, and a new GM call whose response mutates quest state through applyMuts.
Owner-requested mid-session; shipped on Opus under the standing budget rule.

**What the reviewer should test hardest, in order:**

1. **The suggest call's blast radius.** Its response goes through the FULL applyMuts — any tag the
   model emits lands, not just QUEST_STEP/QUEST/rewards. syncCharSheet has the same shape and that
   precedent is why I did not build a filtered parser, but a quest-review prompt that hallucinates
   an [NPC:|dead] would be worse than one that hallucinates an inventory line. Decide whether the
   review response should be restricted to a quest-tag whitelist before applyMuts.
2. **"abandoned" is a NEW archive status.** Everything that reads memory.quests statuses should be
   swept: Table Talk answers, the history modal (handled), the #17 quest indicator (counts
   complete-but-uncredited — abandoned quests are archived so they leave that census naturally),
   and the reopen guard's completed/failed clause (untouched). I checked the renderer and guard;
   a reviewer should grep for status equality tests I missed.
3. **The 2-turn abandonBlock vs the reopen guard's permanence.** The block also tells the GM not to
   |offered re-raise immediately; the guard permanently blocks only non-offered. After the block
   expires, an immediate |offered re-raise is legal by design (owner's gate is the player). If the
   field shows the GM re-offering on turn 3 every time, the shelf may need to be longer for this
   marker than for recentlyLeft.
4. **Busy-flag discipline in suggestQuestCompletion** — set true before the await, false in both
   paths, same as syncCharSheet; and the decisions modal falls back to a toast if ui-modals is
   absent (headless). Verify no path leaves busy stuck on a thrown callGM.

### 20 — The split re-affirm loop (#228, v1.707; Opus, owner-ruled)

**Filed:** 2026-08-24. **Tracker:** TODO #228. **Touched:** `tag_table.js` (the `[PARTY_SPLIT:]`
handler only).

**Why this is here.** An `applyMuts` write path, and it changes what a tag DOES on a re-emit.
Owner-ruled live from a field save; shipped on Opus under the standing budget rule.

**What the reviewer should test hardest, in order:**

1. **The `_freshSplits` grant inside the no-op is load-bearing and easy to "clean up".** It looks
   redundant sitting in a branch that otherwise does nothing. It is not: without it the #133b
   co-location fold dissolves a same-node stay-behind on the very next response, which is exactly
   the case owner ruling ⓑ protects. The sabotage clause pins it, but a reviewer should confirm
   the interaction is right rather than merely tested.
2. **`splitLoc.turn` now freezes at the original split turn for a re-affirmed split.** #133
   documented the re-affirm as "resets the clock", and one existing test asserts exactly that —
   it still passes only because its fixture is the LEGACY unstamped shape, which deliberately
   falls through. That is a genuine near-miss: the old contract line and the new behaviour
   disagree, and the test that should have caught it did not, for an incidental reason. Decide
   whether the #133 comment and the audit note's "re-affirming resets this check" wording should
   be corrected (I left both alone as prompt-surface risk not worth taking mid-fix).
3. **The residue is the actual trigger.** `buildSplitAudit`'s same-world waiver (api.js:514–515)
   fires every turn for ANY split inside the party's own world node. #228 makes that cheap rather
   than harmful. Whether the waiver should itself be age-gated once a sublocation is present is an
   open design question I did not take.
4. **Presence evidence now ages where it used to refresh.** A re-affirmed split no longer re-stamps
   `lastSeenTurn`/`lastSeenSrc`. I believe that is strictly more honest under #194 gate ③ (nobody
   re-witnessed them), but it does mean a long stay-behind's evidence can age out of
   `SPEECH_EVIDENCE_TURNS`-adjacent windows. Worth a second opinion on the death-gate interaction.

### 19 — Combat narration/tracker reconcile + the reward-claim modal (#214/#215, v1.699; Opus, owner-ruled)

**Filed:** 2026-08-22. **Tracker:** TODO #214, #215. **Touched:** `tag_table.js` (COMBAT_END,
post-handler seam), `api.js` (`buildCombatStaleNudge`, NOTE_BUILDERS/latch registry, the shelve
site), `helpers.js` (rewardClaim writers), `ui-modals.js`, `game.js`/`ui-boot.js` (resurface),
`globals.js`.

**Why this is here.** Combat write paths plus a new NOTE_BUILDERS entry plus a new payout path.
Owner-ruled in the moment; shipped on Opus under the standing budget rule.

**What the reviewer should test hardest, in order:**

1. **#214① changes the meaning of an existing tag.** `[COMBAT_END:victory]` over living foes used
   to discard them; it now kills them. Three pre-existing tests already exercised that shape and
   silently changed behaviour without breaking — I added a death-gate test proving a rostered foe
   is still refused, but a reviewer should decide whether the victory-word regex
   (`/^(victor|won|win|slain|kill|rout|triumph)/i`) is the right boundary, and what a GM writing
   an unlisted outcome word should get. Today an unrecognised word silently resolves nothing.
2. **Is `propagateSlainFoes` really gated for every foe shape?** My safety test covers one case
   (rostered, no scene evidence). I did NOT enumerate foe shapes — aliased names, a pooled
   "Goblin pack" entry that matches a roster name, a foe whose name collides with a party member.
3. **#214② fires DURING combat**, unlike every sibling note, all of which are combat-silent by
   deliberate design. That inversion is intentional and argued in the row, but it is exactly the
   kind of "one exception to a house rule" worth a second opinion — mid-fight note volume was
   part of what #211 was about.
4. **#215 pays out through `applyMuts`.** Reusing the one path is right, but it means a claim
   accepted while a NEW dispute is live could be re-stripped. I made the award measured so it
   fails loudly rather than lying — the failure mode is a claim that closes unpaid and toasts.
   A reviewer should decide whether closing it is correct or whether it should re-queue.
5. **Player-gated payout is a canon write the engine previously refused.** The owner ruled it;
   the modal states the doubt. Worth confirming the framing does not read as the engine
   endorsing an unearned reward.

**Verification:** 11 engine tests, each confirmed red first (1615 → 1621 green); 8 sabotage
clauses; #215's award/decline/re-render loop driven in a real browser against a seeded state.
**Not done:** no live playtest — both paths need a model to misbehave to fire; no diff-replay (the
corpora contain no victory-close-over-living-foes response, so byte-identical would prove nothing).

### 18 — W2 withhold toasts now carry the refusal reason and an honest status (#213, v1.698; Opus, owner-ruled)

**Filed:** 2026-08-22. **Tracker:** TODO #213. **Touched:** `identity.js` (`w2PrepareResponse`
withhold sites, new display helpers), `api.js` (`buildIdentityConflictNudge` shelve notice),
`globals.js` (`W2_WITHHELD_CAP`).

**Why this is here.** It sits on the drift surface by location — the two edits are inside
`w2PrepareResponse`, the function that decides which tags survive to `applyMuts` — so the decree
says Fable regardless of how display-shaped the intent was. It shipped on Opus under the standing
"Fable budget exhausted, document it here" rule, after an owner ruling on scope.

**What the reviewer should test hardest, in order:**

1. **Did a display change alter what commits?** The claim is that it did not: the only new writes
   are `c.withheld` (a bounded array on an existing conflict record) and the reason/record locals
   threaded to the toast. But site A now calls `_w2CollectStripped` and `_w2RefuseLog` where it
   previously called neither, and `_w2RefuseLog` feeds `w2RefusedThisResponse()`. **I did not
   fully trace every consumer of `_w2RefusedNow`** — I reasoned that adding the reward tokens
   there makes site A match site B's long-standing behaviour (provenance parity), and the suite
   stayed green, but "green plus a plausible story" is exactly what this queue exists to catch.
2. **`W2_REWARD_RES` is now module-level shared regex objects with the `/g` flag.** `String.match`
   with a global regex ignores `lastIndex`, so reuse is safe as written — but if any future caller
   reaches for `.exec()` or `.test()` on these, the shared `lastIndex` becomes a state bug across
   responses. Worth a judgement on whether the sharing is worth that trap.
3. **The reason→copy table is ordered, and order is load-bearing** (the unmasking clause must be
   tested before the broader no-binding clause). One test pins the discrimination; a reviewer
   should decide whether ordered-regex dispatch is the right shape here at all, versus giving each
   refusal an explicit code at its call site (rejected during the build as ~10 call sites of churn
   plus the transaction-preflight reasons that arrive as variables, not literals).
4. **The honest-status claim itself.** The shelve notice tells the player the reward "will not
   arrive". That is true as far as I traced it — nothing replays a stripped reward — but it is an
   assertion about the *absence* of a mechanism, which is the harder thing to verify. If some path
   does re-pay, the new toast is now confidently wrong at the player.

**Verification done:** 8 engine tests, each confirmed red on v1.697 before the fix (suite 1605 →
1610 green); 10 new `dev/sabotage-w2.js` mutation clauses; a new REFUSAL COPY CONTRACT source
guard in `dev/run-tests.js` which caught two uncovered reasons my own enumeration had missed.
**Not done:** no live-play spot check (these paths need a model to misbehave to fire), and no
diff-replay over the playtest corpora — the corpora do not contain a refused-death-with-reward
response, so a byte-identical result would have proved nothing about the changed lines.

**Known residue, filed in the row, not fixed:** the withheld reward is still never recovered. The
toast is now honest about the loss instead of repairing it; actual payout-on-resolution is a new
canon write path and was deliberately left for its own design pass.

### 16 — Gemini pinned to thinkingLevel "low" on every call kind (#22, v1.645; Opus, owner-ruled)

**Filed:** 2026-08-16. **Tracker:** TODO #22. **Commit:** the v1.645 promotion.
**Evidence:** corpus `dev/corpus_playtest_v1644_gemini37low.json` (50 turns, standard Korrag
campaign), save + memento in `testRuns/modelTests/` (gitignored).

**Why this is here, not in the Off-Fable log.** It is not a safe-changes-map shape. The change is
one line of `PROVIDERS.gemini.buildBody`, but what it alters is how much the GM model *reasons
before answering* — and canon obedience is precisely what the anti-drift stack protects. The
sweep already proved tag syntax and canon obedience are separable capabilities (3.5-flash held
the first and failed the second), so a knob on the reasoning budget is drift-adjacent by
construction. Per the decree, ambiguous defaults to Fable; the owner ruled the adoption, so it
shipped, and this is the standing non-Fable log entry.

**What was measured.** `thinkingLevel:"low"` accepted; `"minimal"` rejected by this model with
HTTP 400 ("Thinking level MINIMAL is not supported"), so low is the floor. 50/50 turns, run-scoped
in-page patch (no repo edit until this promotion). Both contract halves held: 0/50 zero-tag turns,
39 distinct tags (vs 36 thinking-on), 366 total (vs 274), 0 unknown (census derived from
tag_table.js); dead-actor scan clean across 4 deaths, and all 4 death tags landed the same turn as
the prose kill — the thinking-ON sibling is the arm with the premature-tag blemish (t42 tag / t46
prose), not this one. Premise retention >= baseline. Paired A/B on one identical 17,305-token live
gameplay prompt: thinking-ON median 275 thought + 178 visible (~453 billable) @ 4.9s (n=5);
LOW 0 thought + 296 visible (296 billable) @ 2.5s (n=2). Owner read the compiled memento and
judged it good — the prose half of the verdict, consistent with 727 chars/turn vs 647.

**What a reviewer should probe first.** (1) The A/B's thinking-on side is n=5 against n=2 — a 503
load-shedding storm ate samples; re-measure if the cost claim is load-bearing for pricing.
(2) The config now rides EVERY call kind including `summarize()` — the run filed 6 chapters across
5 summarize calls with clean JSON, but extraction quality under low reasoning deserves a harder
look than one campaign. (3) One campaign, one tone, one voice, one seed — the #22 field-validation
width caveat applies to this arm exactly as it does to the others. (4) The guard is a pinned engine
test (`#22 gemini buildBody pins thinkingLevel 'low'`), verified red before the change; it pins the
value but cannot detect the model silently reinterpreting "low".

### 14 — TTS splitter cross-assignment (#93) and narration stuck in third person (#172), both drift-surface (Opus)

**Filed:** 2026-08-12. **Shipped:** v1.603 → v1.604 (#93, commits `43363ea`, `caa2a92`) and
v1.605 (#172, commit `8a19360`). **Trackers:** TODO #93, TODO #172.

Two drift-surface changes in one session, filed together because they touch the same week's
lesson from opposite ends.

**#93 — `splitSentences` / `deriveSpeakerMapFromTags`.** An unbalanced quote inverted the
dialogue/narration labels for the rest of a paragraph, and since the v1.451 deterministic deriver
that is audible: narration took the `[SAY:]` segment's CHARACTER voice. Also fixed the quote-blind
key match (probe W1 — a real field instance corrected in t1667: Frizwick's `"There,"` was being
spoken in Daeris's voice) and the punctuation-only audio blip. **v1.603 shipped a regression** —
the quoted-run mask was built from RAW text while the units come from CLEAN, so a tag alone on its
own line could hand a tagged line to the WRONG character. Caught by an adversarial review pass,
reproduced by hand against v1.602, and corrected in v1.604 (role-based fault detection, tag
stripping, a straddling-break seam, flattened units consuming the cursor, voice-aware folds).

**#172 — `buildSysPrompt` post-STYLE slot + a new engine note.** Field report: the campaign was
narrating in third person. Two causes: the multiplayer-exit correction was retired by a TURN
COUNTER (proven from the hot-seat `Name:` prefixes in the transcript — multiplayer ran t809–816,
the GM never complied, the counter fired, third person ran to t829), and ordinary single-player
carried NO end-of-prompt person directive at all while the prose voice held that slot
(`howard` campaigns measure 2.7–5.3% second person vs 98–100% for `abercrombie`; this campaign's
`proseAuthor` is `howard`). Now compliance-boxed, with a short unconditional person line, a
cause-agnostic drift detector on the engine-note channel, and a visible multi-PC chip.

**Why it is risky.** #93 touches the speaker-map producer and the splitter that persisted `sp.n`
maps key on. #172 touches `buildSysPrompt`'s volatile tail, `NOTE_BUILDERS`, `NOTE_LATCH_FIELDS`,
and adds a new per-response observer in `commitGmTurn` — the prompt channel the project has
already lost to twice (D12 rounds 1–2).

**Supporting evidence.** #93: corpus diff over 3,902 real GM documents (junk units 164→26, B14c
straddlers 1→0, zero narration→dialogue promotions); 18-mutation sabotage battery, each mutation in
its own process (these helpers are file-scope globals — in-process comparison silently
contaminates, a trap that bit both me and one review agent). #172: predicate measured over 10,043
judged responses with a ZERO false-positive rate, the hero-name-in-narration clause being what takes
it from 34% to 0; 9-mutation sabotage battery in an isolated tree; a NARRATION-PERSON source
contract that fails the build if the turn counter ever returns; live browser verification at v1.605.
The post-ship t1723 export supplies the missing field repro: its affected turns are stamped
v1.594–v1.604 despite the export occurring after the v1.605 commit, and show a single-player Howard
campaign slipping at t1697, then carrying zero second-person narration from t1699 through t1723.
The save has no `mpEnded` latch or companion `isPC`; its retained user messages contain no narration
directive. This is direct RC-B evidence from the pre-v1.605 browser session, not a recurrence under
the fix.
Suite: 1348 green.

**What a reviewer should probe first.**
1. **#172's baseline person line is unconditional** — it now appears in every single-player prompt.
   Confirm it cannot compete with the prose voice (it is deliberately terse) and that no author's
   voice is degraded by it. This is the one change with no measured before/after on live prose.
2. **#93's `_cutOff` fork, deliberately left open:** truncated speech whose cap lands on a period
   still flattens after its first closed quote. Widening the exemption to any trailing fault in a
   final paragraph zeroes the corpus label changes but retires the protection for most GM dialogue.
3. **The `paragraphGaps` detector defects** (findings 9/10/11/15/16 of the #93 review) — identical
   on v1.602 and v1.605, so #93 neither caused nor worsens them, but `buildSayComplianceNudge` fires
   on responses whose speaker map is 100% correct. Deliberately NOT folded into a regression fix;
   they want their own row.
4. Whether `personDrift` belongs in `NOTE_LATCH_FIELDS` (it was added) — the #151 contract passed,
   but the semantics of restoring a drift run after a dead provider turn deserve a second opinion.

---

## Reviewed index

Full records: [audits/FABLE_REVIEW_RECORDS.md](audits/FABLE_REVIEW_RECORDS.md). Queue drained to
zero 2026-07-27 and again 2026-07-30.

| # | Subject | Reviewed | Verdict |
|---|---|---|---|
| 17 | #175b structured presence as a positive death binding (v1.649) — six-brief delegated-evidence review | 2026-08-17 | Design AFFIRMED (owner-ruled; t1903 repair reproducible), implementation violated its own strictly-earlier contract — 7 confirmed defect groups fixed v1.650 failing-test-first: the unpinned executor's silent WRONG-VICTIM kill (a "Caul" envelope with handle "Vex" stamped Caulder Vex dead), the turn-blind lastSeenAt limb, the split-guard half-coverage, the frame-scan sourceTurn ignore, the heal asymmetry, the t1903 nine-record nudge factory + latch misattribution, and the ws-only handle/name disagreement; +13 tests (each red on v1.649) + 5 sabotage clauses; 7 residues accepted with rationale; descriptor fuzziness filed as TODO #193 |
| 15 | Per-character location-visit provenance gap (#173; Codex investigation) | 2026-08-14 | CLOSED outside the queue — guestbook adjudication (`6850d99`) authorized the build with seven pinned amendments; shipped v1.632–v1.633 + map-viewer panel; entry archived 2026-08-17 |
| 13 | Sol W1–7 drift-hardening handoff (v1.601) — six-brief delegated-evidence review, self-adjudicated on Fable | 2026-08-12 | 8 confirmed boundary defects fixed v1.602 failing-test-first — two resurrected origin incidents (stripped-tag reward leak; array-typed t1644 W6 bypass) plus receipt-cap permadeath, same-turn/quarantined-txn citations, latched-frame drop, over-length bond orphan, merge self-edges, eras import drop; +13 tests, +8 sabotage clauses (W2 15/15, W7 27/27), 3 tautological clauses repaired, counts corrected; follow-ups #169–#171 |
| 12 | Project-wide drift-risk audit against Runelords t1549 (Sol) | 2026-08-08 | CLOSED outside the queue — all four findings shipped as #144A/#145/#146/#147 (v1.564–v1.567) + #144B (v1.572), rulings recorded (`9a7bd6d`); entry archived 2026-08-17 |
| 11 | Runelords t1467 phantom-presence field analysis (Sol) | 2026-08-07 | CLOSED outside the queue — Fable×Sol reconciliation (`6bdfe42`) adjudicated purge-vs-non-emission; #137 phantom-presence teeth shipped v1.553; entry archived 2026-08-17 |
| 10 | Parallel-act hook delivery (v1.495) | 2026-07-30 | Placement PASS; 1 CONFIRMED wording defect (referent "inactive arcs" never renders in a parallel act) fixed v1.501 + pin test; untouched spine-name channels measured and filed as TODO #108 |
| 9 | Inventory acquisition toast (#107, v1.500) | 2026-07-30 | Behaviors affirmed with observed outputs; 1 CONFIRMED defect (non-string inventory entry killed the whole turn pre-applyMuts) fixed v1.501 at the _inv* primitives; 3 residues accepted |
| 8 | Campaign-clock batch (v1.496-v1.499 incl. the drift-surface TIME_ADVANCE scene rewrite) | 2026-07-30 | All 4 ship items PASS (cache contract runtime-proven, memo reasoning airtight, day relabel clean); 4 suite hardens + 2 doc fixes v1.501; overshoot measurement BLOCKED on post-v1.496 .ta field data (user action) |
| 7 | TODO #95 speaker casting — four-agent Opus 5 build (v1.440; scope widened to v1.440→v1.461 incl. #96 [SAY:]) | 2026-07-27 | All 5 filed items adjudicated (①②③ PASS, ④ token-half PASS, ⑤ CONFIRMED); 6 confirmed defects + 6 hardens fixed v1.462; 1 new class filed into #93 |
| 6 | B9/B10 voice-stack campaign — 9 versions in one session, all Opus (v1.416→v1.424) | 2026-07-23 | 3 PASS, 1 CONFIRMED finding (fixed v1.429) |
| 5 | #16c diagnostics — one touch inside `summarize()` (drift surface) | 2026-07-24 | v1.407 enrichment PASSES all three asks; 2 confirmed adjacent findings + 2 pre-existing defects fixed v1.439 |
| 4 | Voice/TTS rework — curated Piper set, per-character voice (TODO #9) | 2026-07-24 | 3 CONFIRMED findings fixed v1.439; ★ memo question answered; splitter edges filed (#93) |
| 3 | Campaign clock — new time subsystem + tags + injection + migration (TODO #73) | 2026-07-23 | PASS on 4 of 5; 1 CONFIRMED finding fixed v1.433 |
| 2 | NPC mood/relation separation — schema repair of the character-state tier | 2026-07-24 | Design + core semantics PASS under live fire; 5 confirmed finding groups fixed v1.439; 3 residues accepted |
| 1 | TODO #23 — per-arc pacing budget + inverse arc-drift detector | 2026-07-16 | PASS on all four verify items; no code changes needed (full record also in audits/AUDIT_ARC_NUDGES.md) |
