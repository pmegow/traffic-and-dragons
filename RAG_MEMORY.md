# RAG-Based Episodic Memory — Design Doc

**Status:** Design locked 2026-07-03 (TODO #27 discussion). **Build queued AFTER the Blueprint Designer.**
**Effort:** M (Phase 1). **Kill switch required** — see §6.

---

## 1. Problem

Two documented drift classes in mature campaigns:

1. **Summary-loss drift** — `summarize()` compresses sessions into chapter summaries; detail
   (an NPC's exact promise, the phrasing of a prophecy, an item's provenance) vanishes. The GM
   then invents or contradicts. The `firstEncounter` snippet (one stored verbatim excerpt,
   injected on relevance) was the first patch for this and demonstrably works — this design
   generalizes it.
2. **Saturation drift** — `memoryTOC()` injects EVERY known NPC/location every turn, forever
   growing. Rule compliance collapses under saturated context (naming rule: 0/54 at turn ~1300,
   AUDIT_FABLE #19). Prose voice degrades the same way.

Prerequisites that already exist: the append-only verbatim transcript (`worldState.transcript`,
v1.62 — `{t,r,x}` per turn, campaign-scoped, rides the sync blob) and deterministic entity
annotation on every turn (the state tags `applyMuts` already parses).

## 2. Core doctrine — AUGMENT, DON'T REPLACE

Every anti-drift fix that has worked in this project injects **authoritative data,
deterministically, every turn** (quest block, char sheet, geo block, party sheets). RAG is the
opposite: conditionally present, query-dependent, historically stale. Therefore:

> **Structured memory stays authoritative for CURRENT TRUTH. Retrieval carries EPISODIC
> TEXTURE only** — what happened, the exact words, how the scene felt. Never state.

Violating this creates two NEW drift classes, both worse than what RAG fixes:

- **Retrieval-miss drift** — canon exists but wasn't retrieved this turn; the GM confidently invents.
- **Stale-chunk drift** — a turn-40 excerpt ("Veyra despises you") outranks the turn-400 truth
  (she's an ally) because vivid verbatim prose beats a terse data block for model attention.

If retrieval ever carries state, this feature becomes a load-bearing wall. Kept as texture,
it's an ornament that unscrews. That line IS the back-out guarantee (§7).

## 3. Locked design decisions

1. **Read-side only.** No write-side changes anywhere in Phase 1 — `summarize()`, chapter
   cadence, lore/decision caps all untouched. Rationale: write-side weakening ("RAG has the
   detail now") is the ONE irreversible failure — sessions played with degraded summaries can
   never be re-summarized richer. The transcript captures everything verbatim regardless, so
   read-side-only means full recoverability.
2. **Entity-keyed retrieval, NOT vectors.** Tag each transcript entry at write time with
   `{npcs:[], location, quests:[]}` parsed from the same tags `applyMuts` already handles —
   a free, deterministic episodic index. Retrieval query = entities in the current scene
   (location, NPCs present, active quests — known deterministically) ∪ entities named in the
   player's input, ranked by recency/salience. The player's input alone is a terrible query
   ("I attack the guard"); scene entities are the real signal — another point against
   embeddings. Vectors are Phase 2, server-side, and may never be needed.
3. **Injection: volatile half only, budget-capped, turn-stamped, subordinated.** A single
   block, ≤ ~600 tokens, each excerpt stamped with its turn number, framed:
   *"PAST SCENE EXCERPTS (from earlier in this campaign, oldest first; the CURRENT state
   above overrides anything here)."* Never touches the stable half — the byte-identical
   cache invariant is unaffected by design.
4. **The `memoryTOC()` diet ships in the SAME change, behind the SAME flag.** Full detail for
   retrieved-relevant entities; one line (or omission) for the long tail. This is where the
   real anti-drift win lives — prompt DECONGESTION in mature campaigns, the condition under
   which rules and voice historically collapsed — and it's what pays for the excerpt tokens
   (target: cost-neutral or better per turn). Flag OFF must reproduce today's TOC
   **byte-for-byte** (engine test, same pattern as the stable-half invariant).
5. **Index is additive.** Extra fields on transcript entries that nothing else reads. No
   schema version bump, no migration; old saves work without it (index backfills lazily or
   applies to new turns only), new saves work if the feature dies.
6. **Kill switch: Dev Mode toggle, per-campaign on `worldState`** (the `proseAuthor` pattern —
   rides the sync blob, read live each turn, A/B-able mid-campaign via ↻ Re-roll).
7. **Chunk grain: turn-pair** (player action + GM response) — matches transcript structure;
   revisit toward scene-grain only if excerpts read as truncated.

## 4. Phases

- **Phase 0 — baseline (analysis only; the data already accrues).** Cost side: `worldState.usage`
  telemetry (v1.150) accumulates automatically. Corpus side: the transcript accumulates
  automatically. What Phase 0 actually is: ONE analysis session — when a real campaign passes
  ~turn 50, export the save and run the TODO #23 compliance checklist (NPC registration rate,
  naming stability, quest tags on crises, future-event resolution, prose length drift) +
  record 📊 turn-bucket In/call. This is the same run #23 already wants; it does double duty
  as the RAG before-number. No new collection infra.
- **Phase 1 — the build (M).** Write-time entity tagging on transcript entries → retrieval
  (scene ∪ input entities, recency-ranked) → capped excerpt block in the volatile half →
  TOC diet, all behind one flag. Engine tests: flag-off TOC byte-identity; retrieval
  determinism given fixed state; budget cap; stale-framing present.
- **Phase 2 — semantic layer (only if Phase 1 misses show up in real play).** Thematic queries
  ("anyone connected to the Brotherhood?") where entity/lexical retrieval misses paraphrase.
  Server-side under the subscription pivot (Anthropic has no embeddings endpoint — Voyage/OpenAI
  key or Fly server; SQLite + brute-force cosine is sufficient at this corpus size). Do not
  build speculatively.

## 5. Measurement (all tools already exist)

- **Cost:** 📊 Usage modal — `turn` bucket In/call, flag on vs. off, same save, same turn count
  (the exact protocol that measured the caching −29%). Excerpts are full-price volatile tokens;
  the TOC diet must pay them back. Watch that the caching win isn't silently eaten.
- **Drift:** #23 checklist as harness A/B on a MATURE save.
- **Echo amplification (#31):** feeding the GM its own old prose invites metaphor reuse
  ("older than X" retrieved and re-absorbed). Grep the corpus for recurring structures; if it
  fires, mitigation is excerpt count/recency tuning or paraphrased-not-verbatim excerpts.

## 6. Back-out analysis (why this is safe to try)

- **Flag flip** restores today's prompt exactly (decision #4's byte-identity test is the proof).
  Mid-campaign safe: nothing downstream depends on the block existing.
- **No migration to revert** (decision #5). **No cache re-measurement** (volatile-only).
- **No data loss window** (decision #1): write-side untouched, so sessions played with RAG on
  lose nothing if it's later removed. Worst case = flip off, campaign continues as if it never existed.
- The two lines that keep it this way: **never write-side, never state-in-retrieval.**

## 7. Judgment caveat — payoff is BACK-LOADED

On a fresh 20-turn campaign RAG does ~nothing: no episodic history to retrieve, no TOC bloat
to diet. **Do not evaluate on a fresh harness run** — it will look like dead weight and get
killed for the wrong reason. Judge on the mature save (Runelords t54+, or any real campaign
past ~turn 50).

## 8. Gameplay upside (why bother)

- **Callbacks** — the innkeeper remembers you stiffed her 300 turns ago, in her own words.
  The single biggest delight feature; `firstEncounter` proves the mechanism.
- **Table Talk as lore oracle** — "what do I know about the Runelords?" answered from actual
  play history instead of compressed chapters.
- **Future-event resurfacing** — returning to a location retrieves its unresolved threads.
- **Shared infra with the Story Compiler (#5)** — "skeleton selects transcript stretches" IS
  a retrieval problem; build the retrieval layer once, both features use it.
- **Future spice:** legacy characters (5% cross-campaign cameo) retrieving *shared scenes*
  from their original campaign — a returning PC who quotes what you actually said to them
  two campaigns ago.
