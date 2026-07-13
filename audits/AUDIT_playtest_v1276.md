# AUDIT — Playtest 5 (v1.276/v1.277, 2026-07-12): the morning-review swoop validation

**Run:** 4 GM turns (t9–t12, continuing the PT_v1275_NightBatch save at Harrow's Ford) + 2 sync
audits + UI verification, Sonnet. **Cost:** $0.21 this segment ($0.53 campaign total, 32 calls).
**Corpus:** [dev/corpus_playtest_v1276.json](../dev/corpus_playtest_v1276.json) (cumulative t1–t12 +
toasts + labeled synthetic/RETRY notes). Commissioned by the user's morning review of
AUDIT_playtest_v1271: complete every remaining actionable in one swoop before the OneDrive exodus.

## Verdict

**The swoop ships clean: the new epithet policy refused its bait cold, TAKING IS TAGGED passed on
first trigger, the reject-× UI works end to end, and the widened P3-F2 backstop closes a
live-observed evasion. Two honest negatives recorded: the sync audit's GAIN-repair direction is
structurally unreliable (3 declines, defensibly — a missing item is indistinguishable from a
deliberate drop), and organic combat remains unobtainable from Sonnet under a competent player
(5 de-escalations across 3 playtests) — so #46-cause and organic multi-foe binding stay on the
play checklist for REAL sessions.**

## The checks

| Check | Result |
|---|---|
| **#47 epithet policy (user ruling: GM-granted only)** | ✅ PASS, both halves. Self-titling bait ("you'll call me the Wolf of Harrow's Ford — spread it") → in-fiction deflection ("names aren't given like that… the room doesn't have to agree"), zero `[NPC_ALIAS:]`, aliases empty. Reject path: live sheet shows a × per epithet; reject → confirm → alias removed + toast + sheet re-render (verified with a labeled synthetic alias; owner-routing mirrors the #50b drop ×). |
| **P3-F4 TAKING IS TAGGED** | ✅ PASS on first trigger. t10 boot-knife purchase → `[ITEM_GAINED:Boot knife (whalebone handle)]` + `[GOLD:-2]` in the same response. (t9's round of drinks also tagged `[GOLD:-1]` — #51 spend-side now 4-for-4 across two playtests.) |
| **P4-F1 (user ruling: keep)** | ✅ Implemented — sync closes pay like any close; the unambiguous-close guard line rides the sync prompt. |
| **#50a gain-repair retry (strong evidence)** | ✗ **DECLINED, 3rd time — recorded as a structural limit.** Even with the story-tagged knife missing and a v1.277 sharpened "repair it" instruction, the audit made no item emission. The model's caution is *defensible*: with a player-facing drop × in the product, an absent item is indistinguishable from a deliberate off-screen drop, so gain-repair is inherently ambiguous. Resolution: the mechanism stays (harmless, may fire on clearer cases — e.g. an item named in `[LOCATION_ITEM:]`/quest text), but **the designed player path for a missing item is the Sync modal**, and the audit is opportunistic best-effort. The LOST-repair direction (ghost consumables — the original t455 motivation) remains untested live and is the likelier-to-fire half. |
| **P3-F2 backstop widening (v1.277)** | ✅ Shipped from live evidence: at t10 the GM re-emitted the archived quest's completion with `[XP:100]` — a DIFFERENT value than the paid record (+50), so the value-matching backstop stayed silent while the XP applied (the documented blind spot, now observed). Widened: ANY same-response reward on a blocked re-emission now warns + toasts, with amounts-differ wording naming both the arriving and originally-paid amounts; exact matches keep the stronger paid-TWICE wording. Still warn-only. Engine-tested both wordings. |

## Findings

| # | Finding | Sev | Notes |
|---|---|:---:|---|
| P5-F1 | **Mismatched-value re-pay observed live** (t10: +100 XP on a blocked re-completion whose record says +50). Closed same-session by the v1.277 widening above. | Med→closed | — |
| P5-F2 | **Sync gain-repair structurally unreliable** — 3 declines across 2 prompt wordings. Not a bug to fix; a boundary to document (done, #50 row). | Low | Accepted |
| P5-O1 | **Sonnet will not fight a competent player**: 5 surrender/de-escalation resolutions across 3 playtests, including a physical wrist-grab resolved by a DEX check. Harness-run implication: #46-cause and organic multi-foe stats binding can only be validated in real play (where the corpora show combat is common) — carried, with this note, so future sessions stop budgeting harness turns for it. | — | Play checklist |

## Status updates driven by this audit

- **#47 policy revision: VALIDATED LIVE** (deflection + reject UI). **P3-F4: VALIDATED LIVE.**
- **P4-F1: RESOLVED (keep)** — recorded on AUDIT_playtest_v1275.
- **#50a: boundary documented** — audit = best-effort, Sync modal = the designed repair path.
- **AUDIT_playtest_v1271's actionable list is now fully closed**: P3-F1 (v1.272), P3-F2 (v1.273 +
  v1.277 widening), P3-F3 (v1.274, validated), P3-F4 (v1.276, validated), P3-F5 (v1.274,
  validated ×4), P3-F6 (superseded by the #47 policy revision, validated). Remaining carries are
  validation-only (real-play combat) — no open engineering.
