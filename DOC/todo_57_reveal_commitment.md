# #57 — Reveal-commitment gap: design (pre-build)

> Status: SHIPPED v1.306 (2026-07-16) — all four §6 forks user-ratified as recommended
> (all three legs v1; new tag; replacement required; knowledge-only scope).
> Tier: Fable. ⛨ Drift surface: memory tiers + extraction prompt + one stable-half doc line.
> Case study: t378 woman-in-bronze (UA40; saves t359/t378 preserved).

## 1. The failure, restated as mechanism

An identity reveal (Daeris IS the woman in bronze, confirmed ~t328) lived only in
compressible narrative tiers (chapter summary). The authoritative structured tiers never
committed it:

1. `memory.npcs["Daeris"].knowledge[]` kept the pre-reveal hedge ("has not confirmed or
   denied") — **extraction only appends** (`applySummaryExtract` → `knowledgeGained` push,
   cap 12); nothing ever retires a fact a later reveal obsoletes.
2. A forked `"Woman in Bronze"` entry survived as a separate person — merge/alias emission
   at reveal moments leans on GM judgment, the historically spotty class.
   `resolveNpcName`'s token-subset consolidation can't help: "Daeris" and "Woman in
   Bronze" share zero distinctive tokens (that consolidation only heals *name-variant*
   forks, by design).
3. The prompt then served contradictory canon every turn (ACTIVE NPC DETAILS "Knows:" line
   vs STORY SO FAR), and the model amplified the contradiction.

The commitment failure is ours: no write path exists for "this recorded fact is now wrong."

## 2. Design principles carried in

- **Engine applies, model proposes from a served list** — the #29 `resolvedEvents` pattern
  (hand the extractor the on-file list, it echoes EXACT text of what's finished; the
  engine's match is exact-then-substring, deterministic). Never free-form deletion.
- **Never destroy — archive** (the P12 lesson): retired facts move to `memory.archive`,
  they don't vanish.
- **GM-decides for identity merges** (the #61 downgrade-nudge philosophy): a model
  proposal that could fuse two real people is never auto-applied; it becomes a one-shot
  engine-note nudge the GM confirms in-fiction via the battle-tested `[NPC_MERGE:]`.
- **Zero parser contact except one new table entry**; engine notes ride the outgoing user
  message (`NOTE_BUILDERS`), never `buildSysPrompt`.

## 3. The three legs

### Leg A — knowledge supersession via the extractor (the workhorse)

Runs every `summarize()` cycle; sees the whole window; has the on-file list in hand.

**Serve:** `summarize()` gains a `RECORDED FACTS` section — for each NPC *detected in the
extraction window* (existing `ragScanNames` over the window text — deterministic, cheap),
list that NPC's `knowledge[]` lines verbatim. Budget-capped (~2,000 chars total; NPCs in
detection order; truncation noted in the prompt so the extractor knows the list is
partial). Wording, mirroring the ANTICIPATED EVENTS block:

> RECORDED FACTS currently on file — if this session REVEALS one of these is now wrong,
> outdated, or superseded (an identity confirmed, a secret exposed, a belief corrected),
> copy its EXACT text into supersededFacts with the replacement fact.

**Extract:** new output field `supersededFacts:[{"name":"","old":"","new":""}]`.

**Apply** (in `applySummaryExtract`, array-guarded per E43, BEFORE `npcUpdates` so a
same-window supersede-then-learn lands in order):
- `resolveNpcName(name)`; find `old` in that NPC's `knowledge[]` exact-then-substring
  (the `resolveFutureEvent` discipline). No match → no-op + `console.warn` (the extractor
  can only retire what exists).
- Matched line MOVES to `memory.archive.superseded` (`{npc, fact, turn, replacedBy}`) —
  new archive bucket beside lore/decisions/chapters; storage-only, never injected.
- `new` files through the existing knowledgeGained path (dedupe + cap 12).
- Requires BOTH `old` and `new` (fork §6.3): supersession is *replacement*, not deletion —
  bare removal stays `NPC_FORGET`'s job (Oubliate semantics untouched).
- Visibility: the "Memory updated" system line appends "N fact(s) superseded (names)".

**Scope: `knowledge[]` only** (fork §6.4). `events[]` are turn-stamped history — true at
their time, they don't assert current truth, and scrubbing history is Oubliate's domain.
`attitude`/roster `status`/`rel` are already last-write-wins — no supersession needed.

### Leg B — turn-time `[NPC_SUPERSEDE:name|outdated fact|current truth]` tag

The extractor leg has up-to-a-window latency and only fires when summarize does; the tag
commits a reveal THE TURN it lands, at the ceremony moment when the GM's attention is on
it. One `TAG_TABLE` entry — parse + strip + doc land together (phantom class impossible).

**Handler** (placed adjacent to NPC_FORGET in table order):
- `resolveNpcName`; substring-scrub matching `knowledge[]` lines (NPC_FORGET's matcher,
  knowledge ONLY — events stay); matched lines archive to `memory.archive.superseded`.
- Append `current truth` to `knowledge[]` (dedupe + cap 12) **whether or not anything
  matched** — the reveal is canon even when the hedge never made it to file; a no-match
  scrub warns to console but still commits the new fact.
- Muts line: `"Name: superseded — <current truth>"`.

**Doc line** (STATE TAGS stable block, directly after NPC_FORGET's line):

> [NPC_SUPERSEDE:name|outdated fact|current truth] -- when a revelation makes something
> on an NPC's record WRONG (an identity confirmed, a lie exposed, a belief corrected):
> the engine retires the outdated fact and records the truth so the two can never be
> served side by side. If the reveal shows two known NPCs are the SAME person, also emit
> [NPC_MERGE:canonical|duplicate].

⛨ Stable-half growth = this one line: one-time cache invalidation, frozen doc-hash
re-baselined consciously, golden diff must be exactly the line.

### Leg C — fork healing: extractor-proposed, GM-confirmed merge

The "Woman in Bronze" fork class. Name-based consolidation can't see it; only the model
can — but a model-written merge can fuse two real people (the two-Aldaras hazard, UA29's
E4 guard), so the model only ever *proposes*.

- Extractor field `sameNpc:[{"canonical":"","duplicate":""}]` (prompt: "only if this
  session's events CONFIRM they are the same person").
- Engine validation before queueing: both resolve to existing, DISTINCT `memory.npcs`
  keys; neither is the player; not both party members. Fails → dropped with a warn.
- Queued to `worldState.pendingMergeHints`; **new 8th `NOTE_BUILDERS` entry
  `buildMergeConfirmNudge`**: once-per-pair latch (the `reciprocityNudged` pattern, lazy
  init, no migration), silent mid-combat without consuming:

  > [ENGINE NOTE: the record suggests "X" and "Y" may be the same person. If the story
  > has confirmed this, emit [NPC_MERGE:X|Y] (and [NPC_SUPERSEDE:] for any outdated
  > facts). If they are different people, emit nothing — this note will not repeat.]

- The existing NPC_MERGE handler does all surgery. Zero prompt contact — rides the
  outgoing user message like all engine notes.

## 4. Explicitly out of scope

- `[CORE_MEMORY:]` GM tag (#40 Phase 2) — a reveal is also a defining moment, and UA40
  called revelations the strongest argument for it. Separate single-concern task; Leg B
  gives it a natural future pairing ("emit both at a reveal").
- Existing forks in old saves — UA29's merge studio/CLI already shipped and ran in the
  wild; this design prevents NEW forks and heals them in live play.
- Untagged prose corrections pre-`[RETCON:]` — known residual, unchanged.

## 5. Failure modes & validation plan

| Failure | Containment |
|---|---|
| False supersession retires true canon | Archived, never deleted; only on-file text can be retired (exact/substring against served list); loud system-line + console attribution |
| Extractor invents a fact via `new` | Same exposure as today's `knowledgeGained` (no new trust granted); dedupe + cap unchanged |
| False merge proposal | Never auto-applied — GM confirms in-fiction or stays silent; once-per-pair latch prevents nagging |
| GM misuses NPC_SUPERSEDE | Worst case = a knowledge line archived + one line added; recoverable from archive |
| Extractor returns junk shapes | E43 array/shape guards on both new fields |

**Tests (test-first):** supersession exact / substring / no-match-warn / archive shape /
replacement filing / cap; served-facts builder (detection, budget, truncation note);
NPC_SUPERSEDE handler (match-scrub-append, no-match-append-warn, events untouched); merge
hint validation (unknown key / player / both-party dropped); nudge latch / combat-silent /
consume; **the t378 fixture end-to-end** (hedge on file + forked entry → extraction
supersedes hedge + proposes merge → nudge fires → `[NPC_MERGE:]` heals the fork).
**Invariants:** stable-half golden diff = exactly the one doc line; all replay corpora
end-state byte-identical (no historical corpus emits the new tag or fields); summarize
prompt is sysOverride/uncached (zero cache impact); frozen strip/doc hashes re-baselined
consciously.

## 6. Forks for the user

1. **Ship all three legs in v1, or stage A → B/C?** Rec: all three — B and C are small
   once A exists, and t378 needed all three (hedge retirement AND fork merge).
2. **Leg B as a new tag vs an NPC_FORGET+NPC_NOTE prompt convention?** Rec: new tag.
   The convention muddies Oubliate semantics, scrubs `events[]` as collateral, and can't
   guarantee the retire/replace pairing.
3. **Require a replacement fact (`new`) for extractor supersession?** Rec: yes —
   replacement-only keeps it honest; bare removal remains NPC_FORGET's job.
4. **Retirement scope `knowledge[]` only?** Rec: yes — events are history, not standing
   claims.
