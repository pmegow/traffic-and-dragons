# Fine-tooth comb — The Iron Meridian (Gazz Quickfuse), save t147, 2026-09-03

Owner request: "Go over the latest save with a fine tooth comb, look for issues I may have missed." Playtest of
`samples/the_iron_meridian.blueprint`, 148 GM turns, gemini-3.7-flash throughout, engine versions v1.759 → v1.799
during play (the save's own turns carry their version stamps). Method: `scratchpad/comb.js` dumped every store
(character, roster vs memory, quests, skeleton, receipts, conflicts, rings, notes, map, chapters, usage) and the
full transcript; each anomaly was traced to its mechanism before it was called a finding.

## Findings that became fixes today

| # | Finding | Mechanism | Fix |
|---|---|---|---|
| #326 | Two of four canon receipts quarantined "quest outcome must not claim an NPC identity" (`txn_core_breach` t122, `txn_consolidate_power` t137); each quest then sat active until the owner ran Suggest completion (t131, t141). | gemini fills the evidence slot with the relevant NPC as a habit; the #175 partition refused the whole claim although a quest-outcome envelope can carry no death and no NPC write. | The identity is ignored with a console warning; both slots record `-`; the outcome commits. v1.802. |
| #325b | Act 3 closed at t145 ("Campaign complete!") on v1.795 — no `spineComplete` stamp, so the v1.800 ending offer would never appear in this save. | The stamp is written by the ACT_COMPLETE handler; the close ran before the handler learned to write it. | `endingOffered` derives the told spine from the skeleton and backfills the stamp. v1.802. |
| #327 | Chapter summaries drift in voice: ch0–3 "Quickfuse …", ch4 "brought us", ch8 "We dropped". | The summarizer's instruction pinned length and prose voice, not person. | Third person, past tense, the hero by name (never "I"/"we"). v1.802. |

## Findings already fixed earlier today (the save shows them landing)

- **#324** — Lyle DEAD t144 via `[NPC_DEATH_REPORTED:]`, the conflict healed, The Descent completed at t144: the owner's unstick line worked on v1.799 (the save's last turns carry v1.799).
- **#318** — `shrike_kill_sump` / `enforcer_fall_sump` false receipts remain in the record (receipts never retire); harmless.
- **#320** — the four unchosen spells (Ray of Frost, Prestidigitation, Magic Missile, Shield) remain on the sheet, as documented.
- **#322/#323** — turns 140/141 (the refusal) are not rf-marked (they predate the widened detector); no further refusals after v1.797.

## Observations, no engine change

- **Gemini prompt cache barely hits on turns.** `usage.byKind.turn`: 3.40M input, 93.5k cache-read (2.7%); `actions`: 3.15M input, 1.43M cache-read (45%); the health log shows cache reads on 3 of the last 40 turns. Gemini's implicit cache honours a byte-identical prefix only inside its own TTL — the suggestion call fires seconds after the turn and hits; the next turn, minutes later, misses. Cost this run: $5.42 for 338 calls. A Gemini explicit cache (cachedContents with a TTL for the stable half) is the only lever; a design question for the owner, not a defect.
- **Prose length** (chars per GM turn by decile): 598, 614, 989, 737, 572, 799, 671, 743, 911, 842. No trend after the #316 clause landed (v1.784, ~t20 of this run); the clause is soft by design.
- **`[LOCATION_HOURS:]` never emitted** in 148 turns (`hours: null` on every node). The market tags (`[WARES:]`) were used at three nodes. Watch: the GM may need the hours ask surfaced the way the market ask is (#303's note shape).
- **Seeded principals never staged:** The Cartographer (intro undefined, nudged twice, never appeared); Vessa Corrow last seen t33. The principal-stage nudge did its job and stood down as designed.
- **Stale statuses:** Ratchwick Pallwick "unconscious, bleeding" since t58, Halvorn since t96 — true to the story (left where they fell); the mood audit fired twice, no contradiction.
- **The supersede archive** holds Kolm's and Lyle's authored dossiers twice (t27, t144) — the open ruling on un-retirable authored notes stands; nothing new.
- **`memory.futureEvents`** carries one `when:"soon"` entry duplicating the live quest's objective (Deadman's Reach safe harbour). Harmless; the resolve nudge fired once.
- **Quest `paid` records** exist only for GM-tagged rewards; #302 milestone XP (300 per quest, 200 per act) is not written to `paid`. Bookkeeping only — the journal does not render `paid`.
- **XP/level** consistent with `CLASS_XP_LEVELS`: 7,420 XP → L7 (7,000–11,000). Thessa L7 46/46 via the shared mirror.
- **Whispers** (8 filed, cap 12): every one is about the rogue gnome — the reputation the run earned. Working as intended.

## What the owner may want to look at

1. The Gemini turn-cache miss rate (above) — an explicit-cache design conversation if Gemini stays the writing model.
2. The two open rulings from the t28 comb: un-retirable authored dossiers, and the secret-pacing gate.
