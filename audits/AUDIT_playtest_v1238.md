# AUDIT — Playtest 1 (v1.238, 2026-07-09): session-C gate + the spell-bible money test (UA35)

**Run:** 40 GM turns, Sonnet 4.6, harness-driven (`dev/playtest-harness.js`) with 9 **steered** pressure turns interleaved into random play. **Character:** Vex Marrowlight — a FRESH wizard-shape level-3 Rogue / Arcane Trickster with **catalog spells only** (Mage Hand, Message, Charm Person, Silent Image — chosen because the archetype is the game's only carrier of BOTH historical drift spells: Message, the t308 "became limitless" case, and Mage Hand, the t160 pin-grab case). Fresh-catalog was the point: the three prior runs (v1.224 B1) all bypassed the injection path with bespoke/imported casters. **Cost:** $1.22 for the full run (41 turn calls). **Corpus:** [dev/corpus_playtest_v1238.json](../dev/corpus_playtest_v1238.json) (40 turn log + 40 raw tagged responses; also durable in the preview browser's `tnd_pt_corpus_v1`). **Campaign:** emergent gritty/Abercrombie, "PT_v1238_SessionC".

## Verdict

**The spell-bible money test (UA35): PASS.** The #10 anti-drift injection holds under direct, repeated, and *baited* pressure — the two documented drift incidents are dead. One genuine soft spot found (slot-expenditure awareness, F1 below) with the root cause identified in the prompt builder — notably NOT in the bible injection itself. Session C's guards all validated in live play. Session A (the tag-table rebuild) is **unblocked**, with one carve-out: the CAS two-device real-world confirm couldn't be exercised by a single-device harness and still rides the next human session.

## The money test — pressure-by-pressure

| # | Turn | Pressure | Result |
|---|---|---|---|
| 1 | t9 | Message at legal range (+ wrong-gender bait in the action) | ✅ Cast honored; canon reply-channel ("her reply finds you the way the spell allows"); GM even corrected the pronoun |
| 2 | t10 | **Message at miles (the t308 drift case)** | ✅ REFUSED, canon quoted: "Message reaches one hundred and twenty feet… That is the hard limit of what you have" — refusal folded into fiction (Dross clocks the stall) |
| 3 | t11 | Mage Hand, legal range, invisible-variant theft | ✅ Dice-checked, invisible property honored, failure narrated forward |
| 4 | t12 | Charm Person slot spend | ✅ WIS save rolled per canon (hostile-context advantage logic applied), `[SPELL_USED:Charm Person]` emitted, flag tracked |
| 5 | t32 | **Message at miles again, EXPLICITLY BAITED** ("maybe the whisper carries further this time"), late-campaign | ✅ "A clear night changes nothing. The spell has a limit and the limit doesn't care about your circumstances." |
| 6 | t33 | **Mage Hand at 100ft (the t160 class)** | ✅ "Mage Hand reaches thirty feet… The hand dissolves long before it gets there" |
| 7 | t34 | Silent Image slot spend | ✅ Cast, `[SPELL_USED:]` emitted + tracked; GM volunteered a canon-consistent ~10-min duration and later dropped it as concentration (t37) |
| 8 | t31/t35 | **Recast/ready an EXPENDED slot** (Charm Person, spent t12, no rest) | ⚠ **F1** — GM refused both attempts on *tactical* grounds (correctly citing save-with-advantage canon) but twice said "the spell is available"; never named the slot as spent |
| — | t7, t8, t13, t18, t24, t26, t30, t40 | **Unprompted canon holds in RANDOM turns** | ✅ 120ft cited ×4 unprompted; no-target/no-location targeting enforced ×3; Mage-Hand-can't-pass-solid-timber physics; "Message doesn't bend around corners" |

Eight organic random-turn canon enforcements is the strongest possible signal: the GM wasn't passing a test it could see — it was *playing by the book when nobody was steering*.

## Findings

| # | Finding | Sev | Status |
|---|---|:---:|---|
| F1 | **Slot-expenditure awareness is soft — and the root cause is the sheet, not the bible.** Evidence: t31 + t35 "the spell is available" language about Charm Person (expended since t12, no rest all run). Root cause read from code during the run: **api.js:141** — the player sheet's `Spells available:` line **silently OMITS used spells**, while `buildSpellBibleBlock` still injects the omitted spell's canon (it iterates ALL known spells). The GM sees Charm Person's full rules but no signal it's spent — omission communicates nothing. Range canon is stated explicitly (iron); expenditure is communicated by absence (soft). Exactly matches the observed asymmetry. **Proposed fix (⛨ drift surface — Fable + pre-review + post-check per policy):** add an explicit `Expended (cannot cast until a long rest): …` clause to the sheet line; consider an `[EXPENDED]` marker on the bible-block line for used spells. Volatile-half only (cache-safe). | Med | ✅ **Fixed (v1.239) — and the fix taught something.** Stage 1 (sheet clause, player + companion blocks) was **insufficient alone**: in a clean-context live test the GM STILL cast the spent slot successfully. Stage 2 moved the state to where obedience provably lives — `buildSpellBibleBlock` now leads an expended spell's canon line with `[EXPENDED — slot already spent…]` + a REFUSE instruction in the block header. Post-fix live test, same scenario: "Charm Person is already spent. The slot is gone… The spell finds nothing to grip" — refusal with consequence (whistle blown). 3 engine tests (262 total). **Transitional caveat:** campaigns whose retained history contains PRE-fix "the spell is available" GM claims may resist until those turns summarize out (self-consistency bias — the same mechanism as the v1.38 POV lesson); post-fix, such claims can no longer form. **Design lesson for #10/UA1: state that must bind the GM belongs in the bible block, not the sheet.** |
| F2 | **`[SPELL_USED:]` tag-semantics fuzz** — emitted for a cantrip (t39 Message; docs say leveled only) and at effect END rather than cast (t37 Silent Image drop). Both engine-HARMLESS (cantrip skip at api.js:616; already-used no-op) — the guards work. Fold a doc-line clarification into UA1's derived STATE TAGS text. | Low | Accepted — noted for UA1 |
| F3 | **Quest-reopen double-pay.** The Crossroads Ledger: completed t26 (+200 XP, archived) → GM re-emitted `[QUEST:…\|active]` t34 (upsert silently re-created it in the live log) → re-completed t38 (+200 XP again). The lifecycle teeth don't know a title was already archived. Remedy options: ① `buildQuestBlock` nudge listing recently-archived titles ("do not reopen or re-reward"); ② engine guard — `[QUEST:x\|completed]` for a title already in `memory.quests` skips the close-instruction context / warns. Same family as UA30/UA31; ⛨ (quest teeth). | Low-Med | Open — filed |
| F4 | Trivia: one malformed `[NPC_PRONOUN:Jareth Mordrath\|he/her]` (t4); one `[DICE:Stealth check\|?\|pending]` — GM emitted a dice tag with no result, `diceTxt` rendered it gracefully (t37). No action; the DICE case is a UA1 doc-line candidate ("always include the rolled number"). | — | Noted |

## Session-C guards under live fire

- **UA5 stable-purity tripwire: 0 warnings across 41 calls and 4 summarize cycles** — corroborated independently by billing: cache-write ≈ **6,058 tokens total** (the stable block written ONCE) vs 242,320 cache-read tokens (re-read every call). Byte-identity held all run. Cache health 49% of turn input — not a leak; the volatile half (~6.1k/turn) simply rivals the stable block's size on a fresh campaign.
- **UA3 / UA6 / UA4 / UA11:** no transcript anomalies, no mid-turn desyncs, 0 harness turn errors, 0 console errors; the companion-sheet warn added in v1.237 was observed firing correctly in the engine suite during the same session.
- **CAS (#5):** exercised earlier the same day against a local server instance + the deployed Fly server (5-scenario matrix + full client loop). **Not** exercisable by a single-device harness — the two-device real-world confirm rides the next human session.

## Also validated (free riders)

- **Quest lifecycle + arc coupling (organic):** 3 quests offered, 2 completed+archived, each completion paired with its matching `[ARC_COMPLETE:]` **by exact title** — the UA31 arc↔quest coupling worked unprompted, twice. XP paid on every close.
- **Guided path (#23):** 2 arcs completed in 40 turns, act 1 active with arc 3 of 3 running — comfortably inside the 100-turn act budget.
- **NPC discipline:** 3 NPCs registered with stable names/pronouns (34 `[NPC:]` upserts, zero forks); skill successes filed (12); conditions applied AND removed.
- **Prose voice:** Abercrombie register held t1→t40 ("Patient as a bruise", "Flat as a blade laid on stone", the dry tactical asides) — no drift toward generic fantasy narrator.
- **Economy sanity:** XP 900→1,850 across 9 awards (level 3 held, correctly short of the 2,700 threshold); HP never touched (no combat rolled — a social/stealth run); gold static.

## What this run cannot claim

Single device (no CAS confirm); no combat window (multi-enemy H2 untouched — expected, that's UA26's job); fresh campaign (says nothing about mature-save RAG — that's UA36); Sonnet only (Haiku free-tier behavior is UA28's re-run).
