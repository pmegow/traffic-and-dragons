# Mature-Campaign Audit — Ammut / Rise of the Runelords, turn 308

**Save:** `testRuns/Rise_of_the_Runelords_t308.tnd` (the real in-the-wild campaign that hit the mobile storage-full, v1.227). **Ammut** — Half-Fey Half-Blood Rogue [Arcane Trickster] **L8**, XP 39,850, at **Thistletop**, Rise of the Runelords blueprint. **Turn 308**, 617 transcript entries, 37 memory NPCs, 3 party members. **RAG episodic memory: ON** (`ragMemory:true`).

**Method:** offline, file-based forensic audit (node/grep on the `.tnd`) — no live turns, no browser. This audits **outcomes and persisted state** (final quest/memory/NPC state + the cleaned transcript + its entity index). It does **NOT** see raw per-turn tags (a save keeps cleaned prose, not raw responses), so tag-*emission rates* aren't measurable here — only their results. This is the mature-campaign case the #23 / #20 / #29 checks were written for and rarely get.

**Headline:** the anti-drift lifecycle machinery is **holding at 308 turns** — quest lifecycle closes, NPC registration is 97%, prose is stable, futureEvents is clean. The user's "characters recall 100+-turn-old events" is **evidenced on the page**. The two real defects — NPC naming forks and the cap-30 memory window — are both **structural-memory** problems that **RAG is currently masking**; they'd surface as visible degradation with RAG off.

---

## Direct answers (the #23 mature-campaign checklist)

| Check | Result |
|---|---|
| **Quest lifecycle closes + archives?** | ✅ **Yes — 3 closed & archived** (The Scarred Man, The Glassworks, The Living Machine, all `completed` in `memory.quests`). The exact failure the t198 audit caught going silent (0 closes) — the #20 teeth (v1.172) are working in the wild. 2 live (Assault on Thistletop 1/2, Aldus Vareth 0/0). |
| **NPC registration rate?** | ✅ **97%** — 301 of 309 GM entries carry ≥1 entity-indexed NPC (matches t198's 97%; the mandatory-registration rule holds under a saturated mature prompt). Location stamped on 55%. |
| **Naming stability?** | ⚠ **Forked** — see F1. Several one-person-multiple-keys clusters (Morwen ×3, Hemlock ×3, + Nualia/Nualia Tobyn, Shalelu/Shalelu Andosana, Ameiko/Ameiko Kaijitsu, Durdun/Durdun Pallwick, Bruthazmus dup, The Scarred Man dup). |
| **Prose-length drift?** | ✅ **Stable** — avg chars/GM entry by 60-turn bucket: 1339 → 902 → 1200 → 1150 → 1158 → 1177. No runaway growth or collapse across 308 turns. |
| **futureEvents hygiene?** | ✅ **Excellent** — 8 pending, **all** stamped t287–t304 (the last ~20 turns). Zero stale ancients. The #29 expire(>40)+dedupe (v1.166) is working — t198 was pegged at the 30 cap with long-dead items; this is clean current business. |
| **RETCON handling?** | ✅ 4 `rc`-flagged transcript entries — the `[RETCON:]` de-index (§8b) fired and marked them out of RAG. |
| **Long-range recall / "feels alive"?** | ✅ **Evidenced** — at t306–308 the GM narrates with Frizwick (first t0), Daeris (t68), Morwen (t34) in continuity. Party companions span the whole campaign (Frizwick t0→308). |

---

## What passed (holding at scale)

- **Quest lifecycle** — 3 quests completed + archived with the live log pruned. The headline t198 fix, live.
- **NPC registration 97%** — no collapse (the historical mature-campaign failure was 0/54; here 301/309).
- **futureEvents 8, all recent** — the strongest single validation this run: the #29 hygiene took a system that pegged at 30 with dead events (t198) to a clean 8-item current window at t308.
- **Prose length steady** — no drift to bloat or terseness across 300 turns.
- **RAG on + entity index intact** — every GM entry carries `e:{n,l,q}`; retrieval has a clean index to work from, and the RETCON/meta exclusions are marked.
- **Long-range continuity real** — the thing the whole memory stack exists for, demonstrably working at 308 turns.

---

## Findings

| # | Finding | Effort | Status |
|---|---|:---:|---|
| **F1** | **NPC naming forks fragment structured memory — RAG is masking it.** One person is split across multiple `memory.npcs` keys, splitting their knowledge/events: **Morwen** = `Morwen` (23 knowledge, went dormant at t166) + `Morwen Zethran` (3 knowledge, but what t308 narration references) + `Morwen (Ammut's wife)` (1); **Hemlock** = `Sheriff Hemlock` (8) + `Hemlock` (5) + `Sheriff Belor Hemlock` (4) = 17 knowledge fragmented; plus Nualia/Nualia Tobyn, Shalelu/Shalelu Andosana, Ameiko/Ameiko Kaijitsu, Durdun/Durdun Pallwick, Bruthazmus, The Scarred Man. This is **Known issue #3** (alias drift): `resolveNpcName` PREVENTS *new* single-word→existing-full-name forks, but the reverse (a full name emitted after a short key is established) still forks, and the **one-time merge of existing dupes was deferred** (never built). **Why it hasn't hurt the felt fidelity: RAG.** Episodic retrieval reads the verbatim transcript regardless of NPC key, so the narration stays continuous even though the structured lookup for `Morwen Zethran` returns only 3 of ~27 real knowledge items. **The risk this exposes:** with RAG **off** (the default), this campaign's structured memory would serve the GM a fragmented, mostly-empty Morwen — visible degradation. So F1 + RAG-default-off compound. **Note:** some first-name collisions are legitimately *distinct* people the guard correctly keeps separate — the merge must not blindly collapse same-first-name entries (the exact reason it was deferred as risky). | M | 🔲 Open (Known issue #3 residual). Remedies: the deferred **one-time save-side merge** (absorb short→full, combine knowledge/events/aliases/relationships, guard same-first-name distinct people) — highest impact; and/or GM-side `[NPC_MERGE:]` prompting when a fork is detected. Compounds with turning RAG on by default. |
| **F2** | **`lore` and `keyDecisions` are pegged at the 30-cap — a narrow structured window at 308 turns.** Both are FIFO-evicted at 30 (audit E50/E51), so early-campaign lore and decisions have aged out of *structured* memory; they survive only in the transcript (RAG) and the 10 compressed chapters. At 308 turns a 30-item window is thin — the structured tiers cover only recent history. Mitigated by RAG + chapters today, but it's another case where structured memory alone would feel shallow on a long campaign. | S–M | 🔲 Watch. Options: scale the cap with campaign length, or explicitly hand these tiers to RAG on a mature save (they're episodic anyway). Ties to Core Memory (#40) — a permanent tier for load-bearing facts is the coordinated answer. |
| **F3** | **308 turns and still in Act 1 ("The Skinsaw Murders").** `skeleton.acts[0]` is `active`; acts 2–3 pending. Either the campaign is deeply sandboxing or the plot isn't advancing the authored spine — the same pattern the v1.224 Vyrindra audit flagged (emergent play drifting from the blueprint's arcs). Consistent with **#43 (blueprint fidelity)** and **#23 (guided path)** both being unbuilt. Not necessarily wrong (the player may be enjoying the sandbox), but a Runelords player 308 turns in who's still in Act 1 arc 1 is a strong signal for the steering work. | — | 🔲 Evidence for #43 / #23. |
| **F4 (minor)** | **A quest with no objectives.** `Aldus Vareth` is `active` with 0/0 objectives — a bare NPC-goal quest the #20 ALL-OBJECTIVES-COMPLETE teeth can't reason about (0/0 reads as "all done" or "none" ambiguously). Low impact; note for the quest-teeth logic. | S | 🔲 Watch. |

---

## Confidence — what this audit can and can't claim

- **File-based, so it measures OUTCOMES, not per-turn tag discipline.** A `.tnd` holds cleaned prose + final state, not raw responses — so "did the GM emit `[GOLD:]` every time" isn't answerable here (that needs a live corpus, e.g. the durable harness). What *is* answerable — did quests end up closed, did NPCs get registered, did futureEvents stay clean, is the prose stable — all passed.
- **RAG is ON, so the felt fidelity is partly RAG-driven.** The single most important read of this audit: the campaign feels alive **and** its structured memory is fragmented (F1) + windowed (F2) — which means **RAG is doing heavy lifting**, exactly as designed (augment structured memory with episodic retrieval). This both validates RAG in the wild and argues for **defaulting it on** — the campaigns that most need it (mature, forked, cap-evicted) are precisely where it's currently off by default.
- **Single campaign, single player, single model (whatever Ammut ran on).** F1/F2 are the carry-forward defects; the lifecycle/registration/hygiene wins are scene-independent and strong.
- **⚠ This save spans MANY engine versions — read it as a palimpsest.** A 308-turn campaign accumulated state across a long run of engine versions (well before the v1.62 naming rule through v1.225+). Recent state = current engine; deep history = archaeology. This materially reframes **F1**: the naming forks are very likely **pre-v1.62 scar tissue** (the t198 audit found all its dupe clusters predated the naming-rule era), NOT evidence the *current* engine still forks — so F1 is best read as "the deferred one-time merge of EXISTING dupes is still undone," a data-cleanup task, not a live-behavior regression. Conversely the **wins are safe to attribute to the current engine** because they concern recent behavior + continuously-running teeth (quest closes, the futureEvents expire sweep that only leaves the recent window, 97% registration on recent turns). `migrateWorldState` heals schema forward on load, so a multi-version save runs correctly today regardless — the only residue is content cruft (F1). Behavioral "does it do X now" reads are reliable; "why does this old fork exist" is unattributable archaeology.
