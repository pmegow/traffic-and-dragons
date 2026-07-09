# RAG-Based Episodic Memory — Design Doc

**Status:** Design locked 2026-07-03 (TODO #27 discussion). **Phase 1 BUILT — v1.154 (2026-07-03),
user-pulled ahead of the Blueprint Designer.** Verified live on the Runelords t54 save: retrieval +
TOC diet net −480 chars/turn WITH 1,360 chars of excerpts included (the diet paid for the excerpts,
§4's cost-neutral target met); stable half byte-identical flag on/off; flag-off volatile
byte-identical to pre-feature baseline (§6's back-out guarantee, proven not promised). 7 engine
tests (79 total). Toggle: **Dev Mode ▸ 🗂 Episodic memory…** Phases 0 (baseline analysis) and 2
(semantic layer, maybe never) unchanged below.
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
- **Retcon pollution (noted 2026-07-04, t160 analysis → BUILT v1.167):** in-prose OOC corrections
  leave BOTH versions of a scene in the transcript (t153's impossible punch + t154's rewind; t160's
  false pin recollection) — and by t198 the false correction was serving ALONE (truth displaced).
  A sibling defect surfaced with it: **quiz-echo displacement** — the t164-167 memory-quiz turns
  were themselves indexed and outranked the origin scenes they quoted. Mitigation shipped (v1.167),
  three parts: ① `[RETCON:what]` tag — GM emits on any correction/rewind; `logTranscript` marks the
  correcting entry + the preceding GM entry `rc:1`, retrieval skips both; ② meta-exchange filter —
  GM entries whose player half opens with `"GM:"` (the OOC convention; ALL observed polluters had
  it) are excluded from candidacy and the IDF document set; ③ merge-orphan bridge — write-time
  `e.n` names deleted by a later `[NPC_MERGE:]` re-resolve via `resolveNpcName` at scoring time
  (the t198 Hemlock merges had silently orphaned the t134-136 broadsheet origin's index). Verified
  on t198: pin query serves the true t147 altar scene top-ranked with the t160 falsehood gone;
  broadsheet serves the t136 origin cluster with the echoes gone. RESIDUAL: untagged prose
  corrections predating the tag (t35 debt correction) stay indexed — historical, bounded.
  Related: the engine's ↻ Re-roll already replaces the transcript entry; prose retcons don't.
- **Stale-chunk drift detection (protocol parked 2026-07-03 — build only if real play shows the
  symptom).** Two mechanical tripwires: ① GM emits `[QUEST:X|offered]` while X is in
  `memory.quests` (archived) = drift, no judgment needed; ② prose names a dead NPC on a turn
  whose excerpt featured them = high-precision candidate. The semantic forms (attitude
  regression, scene snapback) need a judge pass over per-turn evidence triples (injected
  excerpt block + response + state digest) — **enabler: the harness must capture the rag block
  per turn** (e.g. dev-only `window.__lastRagBlock`), which is discarded today. ~30 min build.
  Escalation dials if confirmed, in order: annotate excerpt NPC names with current truth
  ("(now: ally)"), filter excerpts featuring dead NPCs, shrink to 2 excerpts / stronger recency
  bias, kill switch. Subtle tone-coloring is only detectable in aggregate (flag on/off A/B on
  the same save), not per-turn.

## 5b. First live failure + fix (2026-07-04, t162 quiz — SCORING REVISED v1.162)

Two Story-window quizzes on the t160 Runelords save failed ("where did I retrieve Daeris' pin?"
→ GM repeated the t160 confabulated retcon; "where did I meet Daeris?" → invented a Rusty
Dragon story). Forensic replay against the save showed retrieval FIRED but served the wrong
excerpts, through a three-link chain:

1. **Party members index on nearly every entry**, so entity-overlap scores were FLAT across
   the whole Glassworks arc (Morwen+Frizwick+Daeris ≈ +7 everywhere) — ranking degenerated
   to pure recency.
2. **The query's topical words carried all the signal and were discarded** — "pin", "clasp",
   "retrieve" played no part in scoring.
3. **The 3-turns-apart dedupe then EXCLUDED the true scene** (t147, the altar grab) as a
   "neighbor" of the higher-recency t149.

**Fix (v1.162), still vector-free and deterministic:** ① lexical query boost — rare input
words (≥4 chars, stopworded, cap 8) matched against entry + its player line, +2 per distinct
hit (cap +6), gated on a nonzero entity score so it stays entity-keyed; ② party members
demoted to weight 1 as scene-presence (input-NAMING an entity still scores 3). Replayed
against the same save: the pin quiz now serves t147 verbatim. Engine tests cover both.

Residual: "where did I first meet X" can't win on lexical grounds (scenes don't contain the
word "meet") — that case leans on `firstEncounter` (already injected) and correct aliasing;
the t160 save's Daeris had NO aliases (the Woman-in-Bronze merge never landed), so her
pre-reveal history was invisible. Reveal-merges matter to retrieval quality.

**Round 2 (same session, v1.163 — the broadsheet quiz).** "Why did Hemlock keep the
broadsheet?" surfaced four more scoring defects, each verified by forensic replay:
① **full-key name scanning** — prose says "Hemlock", the key is "Sheriff Belor Hemlock",
no match: every honorific-keyed NPC was invisible to the index → scan now matches
`npcCoreTokens` distinctive tokens, word-bounded (`ragHasWord`);
② **duplicate NPC keys** (Hemlock stored 3×, the known alias-drift disease) tripled entity
scores → token-subset duplicates collapse to ONE scan identity (`others[]` ride along for
weight-aliasing old write-time indexes; one score per person per entry);
③ **hand-tuned stoplists lose to common words** ("keep" matched everywhere) → lexical term
weight is now **IDF** computed over the eligible entries in the same pass (rare words
dominate, no stoplist maintenance; entity-name tokens excluded from terms — they already
score as entities); ties break OLDEST-first (origin scenes beat their echoes);
④ **the 3-turn proximity dedupe kept eating the answer turn** (Q&A exchanges span adjacent
turns) → near-par neighbors (≥75% of the picked score) now BOTH serve; only clearly-weaker
same-scene filler is dropped. Also: party-member scene-weight drops to 0 when the input
names an entity (directed question ⇒ companions-nearby is noise), stays 1 for ambient turns.
`ragRetrieve._cands` retains the top-12 scored candidates as a forensics hook.
After: broadsheet serves the full t134–136 exchange incl. the quote; pin serves t147 top;
debt serves the ORIGINAL t68–71 revelation (oldest-first working); first-meeting remains
the documented residual. 4 new engine tests (90 total).

**Round 3 (v1.164 — the Frizwick quiz): the DEAD ZONE.** "Why was Frizwick outside?" (event
8 turns back) failed because the fixed 10-turn recent-skip assumed sessionLog covers 10 turns
— false in mature campaigns (summarize fires every ~2 turns, TODO #28), leaving turns ~3–10
back in NEITHER the live context NOR retrieval. The GM "checked the record" by reading the
[T157] chapter/decision stamp from the TOC and glossing — confident paraphrase, wrong quote.
**Fix: the skip window is now DYNAMIC** — `skipN = max(2, ceil(sessionLog.length/2)+1)`,
i.e. skip exactly what the conversation actually covers. Verified: the t155–157 band becomes
eligible and the quiz serves the correct scene cluster (t155+t156).

**Known frontier (documented, not chased):** single-turn QUOTE precision. The ranker reliably
finds the right 2–3-turn scene CLUSTER; whether the specific turn holding the money quote
makes the cut depends on near-par margins that reshuffle as eligibility shifts turn to turn.
Hand-tuning thresholds past this point is overfitting — if real play shows cluster-correct
answers are still unsatisfying, the principled next step is scene-stitching (render a picked
entry's within-radius near-par neighbors as ONE merged excerpt) or Phase 2 semantics.

**Retcon pollution went live (2026-07-04):** with t160 eligible, the pin query now serves BOTH
the true t147 altar scene AND the t160 false correction — oldest-first renders truth first and
the framing subordinates both to current state, but the GM must arbitrate. The `[RETCON:]`
de-index marker (watch-list) is now the top candidate for the next RAG change.

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

## 9. Model-tier note — Haiku benefits MORE than Sonnet (2026-07-03)

Relevant to the subscription tier map (free = Haiku, paid = Sonnet/Opus). Both RAG mechanisms
are worth more to a smaller model:

- **Decongestion is regressive.** Instruction-following under saturated context is where small
  models degrade first — Sonnet held the rules to ~turn 1300; Haiku would collapse much earlier.
  The TOC diet + retrieval is plausibly what makes a Haiku free tier viable on long campaigns at all.
- **Served facts beat found facts.** A strong model can excavate a detail from a bloated TOC;
  a small model hallucinates a plausible substitute. Retrieval does the finding outside the
  model; verbatim anchor text also suppresses hallucination. On fact-continuity, Haiku-with-RAG
  on a mature save may beat Sonnet-without.

Counterweights, both amplified on Haiku: **stale-chunk subordination** ("current state
overrides") is a soft priority rule small models fumble — expect per-model tuning (fewer
excerpts, stronger recency bias; same philosophy as per-provider `reinforce`); and **echo
amplification (#31)** — small models parrot context harder. RAG fixes fact-availability,
not writing skill: voice/tag-discipline gaps remain whatever the memory does.

**Test plan:** when Phase 1 lands, run the harness matrix {Sonnet, Haiku} × {flag on, off}
on the mature save — four runs, and the free-tier value of RAG is a measured number.
