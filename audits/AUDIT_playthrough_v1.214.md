# Goal-Focused Playthrough Audit — Tomb of Annihilation, Act 1 in 36 turns

**Run:** 2026-07-07 · engine **v1.214** (cleanTxt leak fixed to **v1.215** mid-run — see F1) · fresh campaign "Playthrough v1.214" · blueprint **Tomb of Annihilation** loaded from the repo file · Kael Duskhunter (human Southron Ranger, **level-3 start** for survivability margin) · **Azaka Stormfang + Artus Cimber + Dragonbait** recruited in-story · 36 GM turns driven by a **goal-directed** action script (directive free-text pushes toward the Act 1 arcs, NOT random suggestion-picking) · Claude Sonnet, Howard prose voice, tone "swords".

**Mandate:** complete **Act 1** in ≤100 turns, focus on goal completion, add ≥1 party member, then save + audit.

**Result:** ✅ **Act 1 completed at turn 36 of 100.** All four Act-1 arcs completed, all five quests closed and archived, three party members recruited (all sheeted + leveled), rewards paid throughout. Save: [playthrough_v1.214.tnd](../testRuns/playthrough_v1.214.tnd).

**Cost:** $1.54 · 37 turn calls · 0 turn errors · 0 console errors.

---

## Direct answers to the four questions

| Question | Answer |
|---|---|
| **Did any quests resolve properly?** | **Yes — all five.** `memory.quests` archived: The Dying Patron · Navigate Port Nyanzaru · Recover Azaka's Mask from Firefinger · The River of Teeth · Road to Omu — every one `[completed]`. (Diagnostic baseline: **zero** quests ever resolved, `memory.quests` empty.) |
| **Did arcs complete properly, and were rewards given?** | **Yes.** All 4 Act-1 arcs `completed` in order (Dying Patron t2 → Merchant Princes t11 → A Guide into the Green t18 → The River of Teeth t32); Act 2's arcs advanced to `active`. Rewards flowed **at completion**: XP 900→3125 (+2225), Kael L3→L4, Syndra's advance coin +50 gp, arc-completion XP bursts (Merchant Princes paid +300 at t11, the siege victory +450 at t32). |
| **Did Act 1 complete?** | **Yes — turn 36.** `skeleton.acts[0].status === "completed"`, party arrived at **Omu**, Act 2 "The Forgotten City" now active. |
| **Story goals — expressed / accomplished / rewarded?** | **All three, and recorded this time.** 7 story beats logged (vs 1 in the 75-turn diagnostic), quests closed with rewards, act advanced. See below. |

---

## What passed (invariants + goal lifecycle, checked live)

- **Zero errors** across 36 turns (harness + console).
- **Quest lifecycle closes AND archives** — the headline fix. Every quest reached `completed`, archived to `memory.quests`, removed from the live log. This is the exact failure the diagnostic's P3 documented going silent; here it fired five times.
- **Arc lifecycle** — `[ARC_COMPLETE:]` fired for all four arcs and the engine advanced each to the next arc; `[ACT_COMPLETE:Port of Last Hope]` fired on arrival at Omu.
- **Story beats flowing (P11 fix live)** — 7 beats at the right moments: meeting Syndra, accepting the charge, Azaka joining, charter sealed, mask reclaimed, holding the Camp Vengeance wall, reaching Omu.
- **Movement upkeep (P4 fix live)** — the party actually **left Port Nyanzaru** (the diagnostic never did in 75 turns). `[SUBLOCATION:]` fired for named venues (Wakanga's Villa, Sylvie Pallwick's warehouse), `[LOCATION:]` on each leg; the map grew a real spine: Port Nyanzaru → Tiryki River → Camp Vengeance → Omu (3 edges).
- **`[TIME:]` / `[WEATHER:]` (R2 fix, this engine version) live** — the clock advanced from "dusk" through midday/late-afternoon/"midday, second day", weather evolved ash-wind → river mist → heavy rain → oppressive heat. First real proof R2 works in play.
- **Companion sheet auto-gen at join (P2 fix live)** — all three companions carry a full `charSheet`; none stayed sheet-less.
- **XP mirror to companions live** — Azaka, Artus, and Dragonbait all leveled to L4 alongside Kael.
- **Level-up correct** — Kael crossed 2700 XP → L4, HP 36 max.
- **Prose voice held** — Howard register steady t1→t36 ("guards with the flat, patient eyes of professionals who have killed without ceremony"; dead "like sodden sentinels … with the slow mechanical patience of millstones"). No drift to the diagnostic's noir-hedging — consistent with P5's finding that voice follows scene variety (city → river → siege), not prompt plumbing.

---

## Findings

| # | Finding | Effort | Status |
|---|---|:---:|---|
| F1 | **New tags leaked into displayed prose.** `cleanTxt`'s `_CT_TAGS` allowlist never learned `[REST:]` (v1.213) or `[TIME:]`/`[WEATHER:]` (v1.214), so those tags rendered raw to the player — caught live at t12 ("`[TIME:dawn]`\n`[WEATHER:river mist]`The mist lies on the Tiryki…"). `applyMuts` consumed them correctly; only the display strip lagged. | S | ✅ **v1.215** — added `TIME\|WEATHER\|REST` to `_CT_TAGS`; kitchen-sink `cleanTxt` test extended; suite green (195). Committed mid-run. |
| F2 | **Combat state goes stale when an enemy is driven off (not killed).** The Firefinger pterafolk combat (`COMBAT_START` ~t16) stayed live at a frozen 14 hp for ~13 turns while narration moved on (t18 "back to the river", t21 "a scar already healing over"), through the entire Camp Vengeance approach, before finally clearing at t29. The `applyMuts` safety net catches a *narrated kill* but not "enemy flees / party disengages / party changes location" — so `worldState.combat` (and the combat panel) persists. It self-healed here, but a lingering phantom fight can mislead the GM and the UI. | S–M | ✅ **v1.216** — deterministic engine tooth: a `[LOCATION:]` world-location change clears `worldState.combat` (with a `console.warn`), unless the same response opens a fresh `[COMBAT_START:]`. Plus a stable-half prompt line: "CLOSE EVERY FIGHT — emit `[COMBAT_END:fled/truce/disengaged]` the moment combat ends by any means, not only a kill." 2 regression tests. Live compliance of the prompt half pending a post-fix playthrough; the location-change clear is model-independent. |
| F3 | **An act can sit "active" with all arcs completed until a separate trigger.** All four Act-1 arcs were `completed` by t32, but `acts[0].status` stayed `active` until t36 — the GM only emitted `[ACT_COMPLETE:]` on physically arriving at Omu, not when the last arc closed. It resolved on its own within 4 turns (milder than the diagnostic's arc↔quest desync, which never resolved), but the coupling is loose: nothing guarantees an all-arcs-complete act advances. | S | ✅ **v1.216** — `buildSkeletonBlock` now deterministically detects the all-arcs-`completed` state on the active act and prepends a "⚑ ALL ARCS COMPLETE — emit `[ACT_COMPLETE:title]`" nudge to the pacing note (volatile half), mirroring the quest ALL-OBJECTIVES-COMPLETE teeth (#20). Chose the nudge over engine auto-completion so the GM keeps the act's climactic timing. 2 regression tests. Live compliance pending a post-fix playthrough. |

---

## Regression scorecard vs the diagnostic (AUDIT_PLAYTHRU.md, v1.207)

The diagnostic was a *random-action* 75-turn run that never left Port Nyanzaru. This run is *steered*, so pacing isn't a clean apples-to-apples — but the **lifecycle bookkeeping** below is scene-independent, and every one of the diagnostic's open lifecycle findings fired correctly here:

| Diagnostic finding | v1.214/215 behaviour this run |
|---|---|
| **P3** quest lifecycle silent (0 closes, `memory.quests` empty) | **5 quests closed + archived** with rewards |
| **P11** beat starvation (1 beat / 75 turns) | **7 beats / 36 turns** at correct moments |
| **P4** zero `[LOCATION]`/`[SUBLOCATION]`; never left the city | **Left the city**; sub/loc tags firing; map spine built |
| **P2** sheet-less companions (silent no-op) | **3 companions, all auto-sheeted** at join |
| **XP starvation** (no quest rewards paid) | **+2225 XP**, arc/quest rewards paid; party XP-mirrored to L4 |
| **R2** world clock frozen at "dusk" | **`[TIME:]`/`[WEATHER:]` advancing** all run (the v1.214 fix) |

---

## Confidence review — what this audit can and can't claim

- **Steered, not random.** Actions were directive goal-pushes ("secure Wakanga's charter", "hire the guide", "hold the wall"), so the **36-turn pace is a product of steering**, not proof the engine self-drives to Act 1. The honest read: steering chose the *goals*; the engine still had to *record* completion — and the lifecycle (quests closing, beats, rewards, arc/act advance) fired correctly on its own. Lifecycle fidelity = real win; pacing = steered.
- **Level-3 start** gave a survivability cushion; combat was light (one pterafolk skirmish, one dead-siege) and no character ever dropped. A level-1 start or a lethal encounter could tell a different story.
- **The GM tells its own story.** "Arrive at Omu" commands did **not** teleport past the Camp Vengeance siege the GM invented — correct behaviour (it won't skip an active crisis), and the siege became a strong Act-1 climax. Worth remembering: directive actions are intent, not fast-forward.
- **Single sample** — one Sonnet/Howard/ToA steered run. F2 (stale combat) and F3 (act-completion lag) are the two defects worth carrying forward; F1 is already fixed.
- **Two extra companions were unplanned** — Artus Cimber and Dragonbait joined during the interior leg (canonical ToA allies), exceeding the ≥1 requirement and exercising the multi-companion sheet/XP paths (all three sheeted and leveled cleanly).
