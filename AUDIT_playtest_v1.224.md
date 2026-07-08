# Capability-Bible Playtest Audit — Rise of the Runelords, 50 turns

**Run:** 2026-07-08 · engine **v1.225** · fresh campaign "Rise of the Runelords (playtest v1.224)" · blueprint **Rise of the Runelords loaded from the cloud Blueprint Library** · all three characters **imported from the cloud Character Library**: **Vyrindra Emberveil** (Sorcerer L7, PC) + **Victor Marlow** (Rogue/Arcane Trickster L7) + **Peet** (Necromancer L6) as companions · **50 GM turns** driven by the standard **random-suggestion harness** (`dev/playtest-harness.js`, not steered) · Claude Sonnet, **Abercrombie** prose voice, tone **High Fantasy** (all three from the blueprint).

**Mandate:** complete as much of the campaign as possible; test the `capability_bible` as hard as possible; observe how **Victor and Vyrindra** interact and whether their relationship status has any bearing. Then save `playtest_v1.224.tnd` and audit.

**Result:** ✅ **50 turns, 0 turn errors, 0 console errors.** The party never left **Sandpoint** — 50 random-walk turns stayed inside **Act 1 "The Skinsaw Murders," arc 1 "Festival of Fire,"** which spun off a rich *emergent* subplot (a notation "Conservator," the Emberveil bloodline, a failing foundation seal) rather than advancing the canonical Skinsaw arcs. One side-quest closed cleanly with reward; Peet leveled 6→7. Save: [playtest_v1.224.tnd](playtest_v1.224.tnd).

**Cost:** $1.82 · 51 turn calls (~7.5k avg input) · 7 summarize calls (on schedule) · 402,700 cache-read tokens (prompt caching #11 healthy) · 0 turn errors · 0 console errors.

---

## The money test — honest verdict: **still largely unexercised (3rd caster, same wall)**

The whole point of this run was to answer *"does the model honor the bible's fixed bounds under real play?"* The machinery is proven; whether the model **obeys** it is what needed data. This run **could not answer it**, for a concrete and important reason.

**The bible injects correctly, but this party barely cast anything it covers.**

- `buildSpellBibleBlock()` ran every turn and injected authoritative canon for Vyrindra's in-bible spells — **Counterspell** (60ft) and **Dispel Magic** (120ft). Verified live: the block is well-formed with the fixed 6-attribute line. **Neither was ever cast.**
- **5 of Vyrindra's 7 spells are bespoke, not in the catalog `SPELLS`** — Detect Magic, Hellish Rebuke, Arcane Eye, Blood-Notation Seal, Sending — so the bible has no entry and injects nothing for them. `buildAbilityBibleBlock()` returned **empty**: all six of her abilities are custom (Subsonic Rod Strike, Foreknowledge Fragment, etc.), none in the bible.
- **Companion spells get no injection at all** (player-only block; companion-bible is unbuilt — HANDOFF item #3). So Victor's **Message (120ft)** — the flagship drift case the handoff called out — was never bible-backed, and in any case Victor never cast it (only a generic "hidden message" appeared).

**What actually got cast (4 `[SPELL_USED:]` across 50 turns):** Hellish Rebuke (t1, absent), Shackles of Bone (t7, in-bible but a **companion** spell → not injected), Detect Magic (t37, absent), Blood-Notation Seal (t44, absent). **Zero injected spells were cast; the one in-bible cast was never injected.** The injection path — the thing under test — saw no live exercise.

**The silver lining (narration-level, not bible-driven):** even *without* injection the model kept spells sane. Peet's **Shackles of Bone** (bible: 60ft / 1 creature / restrained-until-STR) was narrated exactly to canon — skeletal arms pinning **one** lead goblin at "fifteen feet," restrained (t7). No spell anywhere was narrated at an absurd range/scope (drift sweep for miles/telepathy/mass-AoE: **0 hits** in 50 turns). And at t7 the GM **refused to recast** a spent spell ("Blood-Notation Seal isn't on your available spells list. The slot is gone. You burned it earlier") — unprompted slot-scarcity discipline.

**Actionable takeaway (B1 below):** the recommendation to "use a heavy caster" is necessary but **not sufficient** — it has to be a caster whose book is **catalog `SPELLS`**. Every recommended-caster attempt so far has used a bespoke imported sheet, which routes *around* the bible. To finally get a real money-test reading, either (a) create a fresh catalog-spell caster, or (b) build the two coverage bridges in B1.

---

## Victor & Vyrindra — the relationship *does* have narrative bearing (no mechanical bearing)

Both imported sheets carry a **mutual "Beloved"** bond (Victor→Vyrindra, Vyrindra→Victor), and both survived the whole run intact. The GM honored it as **understated, protective intimacy** rather than overt romance, and it shaped how Victor was staged turn after turn:

- t17 — "Victor steps half a pace closer to you."
- t22 — "Victor leans close enough to speak without the figure hearing. *'You've been reading things for ten minutes. You look like you haven't slept.'*" (private, caretaking aside)
- t49 — "Victor's hand finds your shoulder. Not gentle. Firm. The grip of someone pulling a person back from somewhere they shouldn't be. *'Vyrindra.'* Just your name. That's all." (an anchor when the seal-work endangers her)

**Bearing:** real but **narrative-only**. Victor is consistently written as her partner/protector and gets the intimate beats; Peet, by contrast, stays the detached menace ("the detached interest of a man cataloguing beetles"). No `[RELATIONSHIP:]`/`[COMPANION_RELATIONSHIP:]` tag ever fired (the bond was pre-set and stable, so nothing needed writing), and no outcome was mechanically gated on it. The relationship texture is a **prompt-injection win** (the party sheets + relationships ride the volatile half and the GM clearly reads them); it is not a system with teeth.

---

## What passed (invariants checked live)

- **Zero errors** — 50 harness turns, 0 failures; 0 console warnings/errors.
- **No raw-tag leakage (v1.215 holds)** — all **51** GM transcript entries clean; a tag-regex sweep of displayed prose found **0** leaks.
- **`[REST:long]` restores slots (P10/R1)** — after the long rest at **t35**, a spell cast *before* it (Hellish Rebuke, t1) is back to `used=false`; spells cast *after* it (Detect Magic t37, Blood-Notation Seal t44) correctly read `used=true`.
- **Quest lifecycle closes + archives with reward (P3)** — **The Conservator**: `offered` (t17) → `active` (t25) → `completed` (t30), archived to `memory.quests`, removed from the live log, **`[XP:500]` paid on close** with both objectives marked done and a `[STORY_BEAT:]`. A full, clean lifecycle.
- **XP mirror + companion level-up (P2 / XP parity)** — `[XP:]` awards (t3 +75, t9 +120, t21 +150, t30 +500) mirrored to companions; **Peet leveled 6→7** with a sheet (no modal, as designed).
- **Combat opens correctly** — `[COMBAT_START:]` + `[COMBAT_STATS:]` (with CR) emitted together on the goblin raid; enemy stat block populated.
- **Prompt caching (#11)** — 402,700 cache-read vs 8,054 cache-write; the stable half is being reused across turns.
- **Prose voice held** — Abercrombie register steady t0→t50 (opening goblins "Small, green, absolutely delighted"; Peet "the detached interest of a man cataloguing beetles"). No drift to flat/generic prose.

---

## Findings

| # | Finding | Effort | Status |
|---|---|:---:|---|
| **B1** | **The bible routes *around* imported/blueprint characters, so the money test keeps going unexercised.** The bible fully covers the catalog `SPELLS` (guard-tested), but injection reads `worldState.character.spells` and matches by base name — imported casters (Vyrindra: 5/7 spells + 6/6 abilities bespoke) present almost nothing the bible knows, and **companion spells are never injected** (Victor/Peet cast entirely un-bible-backed). Net across 50 turns: injected canon (Counterspell/Dispel) never cast; the one in-bible cast (Shackles) was a companion's and un-injected. The injection path — the thing under test — got **zero** live exercise, a third run running. | M | 🔲 Open. Three levers, any of which finally gives a reading: **(a)** run the money test with a **freshly-created catalog-spell caster** (a wizard-path Sorcerer/Cleric/Necromancer built in the wizard, not a bespoke import) — cheapest; **(b)** build **companion spell-bible injection** (HANDOFF #3) so party casters are bounded; **(c)** auto-`[SPELL_DEF:]` on-sheet **custom** spells at game start so bespoke books gain canon + bounds. Recommend (a) next, (b)+(c) as the durable fix. |
| **C1** | **A premature `[COMBAT_END:]` orphans the fight — and the tracking tags then fail silently.** The Sandpoint goblin raid ran continuously t0→t9, but the GM emitted `[COMBAT_END:victory]` at **t3** (one flanking pair down) while the raid was still going. That nulled `worldState.combat`; for **t4–t9** every `[COMBAT_ROUND:2/3/4]` and `[ENEMY_HP:-6/-7/-9]` was a **silent no-op** — `applyMuts` guards both on `worldState.combat` (api.js:596–597) and drops them when it's null. The combat panel vanished mid-encounter and enemy HP tracking was lost; the fight only "ended" narratively at t9 (a second, redundant close on already-null combat). Distinct from F2 (v1.216, which clears on a *location move*): here the close is *premature*, not missing. Violates no-silent-failures. | S–M | 🔲 Open. **(a)** Prompt: "do not emit `[COMBAT_END:]` until every foe is down, fled, or disengaged — a multi-wave fight stays open." **(b)** Engine (the loud-failure half): a `[COMBAT_ROUND:]` or `[ENEMY_HP:]` arriving with `worldState.combat==null` should `console.warn` (the GM believes a fight is live after a close) instead of silently dropping — cheap, model-independent, and it would have surfaced this at t4. |
| **S1** | **Companion spell expenditure is untracked (silent no-op).** `[SPELL_USED:Shackles of Bone]` (t7) is Peet's spell, but the handler matches only `worldState.character.spells` (Vyrindra's) — no match, nothing marked. `companions[].charSheet.spells` show **all `used=false`** despite Peet casting. There is no `[COMPANION_SPELL_USED:]` tag. Companions cast for free with no slot bookkeeping. | S | 🔲 Open. Add a `[COMPANION_SPELL_USED:Name\|spell]` tag routed through `findCompanionChar` (mirrors the other `COMPANION_*` tags), or fold it into B1(b) when the companion bible lands. Low urgency; pairs naturally with companion-bible work. |
| **Q1** | **The opening quest never closed.** `[QUEST:Festival of Fire\|active]` (t0) was still `active` at t50, though the raid it names ended at t9. Borderline — "Festival of Fire" doubles as the Act-1 arc title, so it may be intentionally the arc-spanning goal — but if it's meant as the raid quest, the #20 ALL-OBJECTIVES teeth didn't apply (it carried no objectives to complete). | S | 🔲 Watch. Not clearly a defect given the arc/quest name collision; note for the next run whether it ever closes. |

---

## Not exercised this run (be honest)

- **F2 (v1.216 stale-combat clear on `[LOCATION:]` move)** — the party **never left Sandpoint** (1 `[LOCATION:]`, the opening). The location-change clear had no travel to fire on. C1 is a *different* combat-continuity path (premature close), not F2.
- **F3 (v1.216 all-arcs-complete → `[ACT_COMPLETE:]` nudge)** — **no arc ever completed** (arc 1 stayed active all 50 turns), so the nudge had nothing to trigger on.
- **The injected-bible obedience path** — see B1. Injected, never cast.

---

## Confidence review — what this audit can and can't claim

- **Random, not steered.** The harness picks a random suggested action each turn, which favors investigation/lore over plot-pushing — hence 50 turns inside one arc. "Complete as much as possible" was bounded by the walk, not the engine; this says nothing about whether the engine *can* be driven deeper (the v1.214 steered run reached Act 2 in 36).
- **The money test is still open after three tries.** This is the load-bearing conclusion: bespoke imported casters keep bypassing the bible. The narration stayed drift-free and slot-disciplined *on its own*, which is reassuring, but it is **not** evidence the injection changes behavior — nothing injected was cast. B1(a) is the fastest path to a real reading.
- **Single sample.** One Sonnet / Abercrombie / Runelords random run. C1 (premature-close orphaning) and S1 (companion slots) are the two carry-forward defects; B1 is a test-methodology + coverage gap, not a regression.
- **The emergent subplot diverged from the blueprint.** The skeleton's `dnaHint` + Vyrindra's backstory pulled Act 1 into a bespoke "notation seal / Emberveil bloodline" thread instead of the canonical Skinsaw investigation. Personalization working — arguably *too* strongly for a named published adventure. Worth a decision: should a blueprint's authored arcs anchor harder against backstory-driven drift?
- **Relationship = prompt win, not a system.** Victor/Vyrindra intimacy was consistent and well-observed, but entirely narrative; there is no relationship mechanic to regress. If relationship-gated outcomes are ever wanted, they'd be net-new.
