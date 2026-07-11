# RESOLVE_NPC_INVARIANTS.md — the NPC identity spine (UA12)

Written by Fable 2026-07-11 against **v1.260** (`memory.js`, `tag_table.js`, `api.js`).
⛨ **Drift surface.** This is *documentation + test spec* for `resolveNpcName` and the alias/merge
machinery — NOT a redesign. The heuristic is load-bearing (it is the anti-fork engine behind
every NPC-keyed write) and deliberately conservative; the point of this document is that its
exact behavior, including its known soft spots, is now pinned so nobody "improves" it by
accident. Any change to the behaviors documented here follows the full drift-protection
protocol (Fable tier, pre-review, engine tests + corpus replay).

Related rows: **UA12** (this doc), **UA29** (one-time merge script for already-forked saves —
§7), **UA40** (reveal-commitment gap — adjacent, not covered here), TODO Known-issue #3
(the original alias-drift finding, prevention shipped v1.62).

---

## 1. The machinery — where everything lives

| Piece | Location | Role |
|---|---|---|
| `_NPC_STOP` | memory.js:5–9 | stopword table: honorifics, titles, generic role nouns, articles |
| `npcCoreTokens(name)` | memory.js:10–15 | name → distinctive-token list |
| `resolveNpcName(name)` | memory.js:16–41 | THE resolver — every NPC-keyed operation routes here |
| `[NPC_ALIAS:canonical\|alias]` handler | tag_table.js:109 | writes `memory.npcs[canonical].aliases[]` (+ mirror on the worldState.npcs entry) |
| `[NPC_MERGE:canonical\|duplicate]` handler | tag_table.js:110–124 | absorbs duplicate into canonical across BOTH stores + graph + relationships; registers the dupe key as an alias |
| RAG merge-orphan bridge | memory.js:427–428 (`_res` / `_resolveIdx` inside `ragRetrieve`) | re-resolves write-time `e.n` index names whose key a later merge deleted; **memoized per retrieval call** |
| RAG scan-identity collapse | memory.js:232–260 (inside `ragKnownNames`) | separate consumer of `npcCoreTokens`: collapses token-subset duplicate KEYS into one scan identity for entity weighting (does not touch storage) |

### Resolver call sites (the resolution boundary)
Everything that keys into `memory.npcs`/`worldState.npcs` by a model-supplied name resolves
first. Enumerated so a new write path can be checked against this list:

- **Tag handlers** (tag_table.js): `NPC`, `PARTY_MEMBER`, `NPC_NOTE` (via `fileNpcEvent`),
  `NPC_FORGET`, `NPC_PRONOUN`, `NPC_LINK` (both endpoints, after player-name mapping),
  `NPC_FACTION`, `RELATIONSHIP`, `RELATIONSHIP_REMOVED`, `COMPANION_RELATIONSHIP`,
  `COMPANION_RELATIONSHIP_REMOVED`. All `COMPANION_*` tags additionally resolve through
  `findCompanionChar` (api.js:507–519), which tries raw AND canonical lowercased names (E16).
- **Memory writers**: `fileNpcEvent` (memory.js:63), `mapNpcLocation` (memory.js:115),
  `applySummaryExtract` npcUpdates (memory.js:653 — the extractor freely returns variants like
  "Morwen (Ammut's wife)", audit #6).
- **RAG**: `ragEntitiesFromRaw`'s `addN` (memory.js:292, write-time index stamping) and
  `ragRetrieve`'s `_resolveIdx` (scoring-time bridge).
- **UI**: `partWaysWithCompanion` (ui.js:1467).

Deliberately NOT resolving: `NPC_ALIAS` and `NPC_MERGE` themselves take their name arguments
literally (the GM names the canonical explicitly), and quest/faction titles are not NPC keys.

Prompt-side prevention half: the `DEFAULT_RULES` "NPC NAMES / NPC NAMING IS STABLE" rule
(data.js:154) tells the GM to reuse canonical names and emit `[NPC_ALIAS:]` for new titles.

---

## 2. The exact resolution algorithm (as implemented, memory.js:16–41)

`resolveNpcName(name)` — pure function of `(name, memory.npcs)`; **never mutates anything**.

1. **No store** — if `memory.npcs` is falsy, return `name` unchanged.
2. **Exact key** — if `memory.npcs[name]` exists, return `name`. (Identity: an existing key
   never redirects — see E3 for why this matters on already-forked saves.)
3. **Alias scan** — iterate `memory.npcs` keys in object insertion order; the FIRST key `k`
   whose `aliases[]` contains `name` (**exact, case-sensitive string match** via `indexOf`)
   is returned.
4. **Distinctive-token subset consolidation** (the v1.62 heuristic):
   - `inCore = npcCoreTokens(name)`:
     lowercase → strip `(...)` parentheticals → replace every non-`[a-z0-9\s]` char with a
     space → split on whitespace → drop tokens in `_NPC_STOP`. **No length filter, no
     dedupe** (see E6 for the consequences).
   - If `inCore` is **empty** (role-only name: "The Innkeeper", "Barkeep (Rusty Dragon)"),
     return `name` unchanged — anonymous functionaries are deliberately unmergeable.
   - For every key `k` (skipping `k===name`, defensively — step 2 already handled it):
     compute `kCore = npcCoreTokens(k)`; skip if empty. Let `shortT` be the smaller token
     list and `longT` the larger (`inCore` counts as shorter on a tie). If **every** token
     of `shortT` occurs in `longT` (`indexOf`; multiplicity ignored), `k` is a candidate.
   - Count candidates, breaking as soon as a second one is found.
   - **Exactly one candidate → return it. Zero or ≥2 → return `name` unchanged.**

Key properties that fall out of the implementation (each is an invariant in §3):

- The subset test is **bidirectional**: a short incoming name resolves to a longer key
  ("Hemlock" → "Sheriff Belor Hemlock") AND a long incoming name resolves to a shorter key
  ("Sheriff Belor Hemlock" → "Hemlock" if the short form registered first). The canonical key
  is *whichever spelling arrived first*, not whichever is fuller — a policy the UA29 script
  intends to normalize (short→full), which the resolver itself does not enforce.
- Stage 3 (aliases) always beats stage 4 (tokens): an explicit `[NPC_ALIAS:]`/`[NPC_MERGE:]`
  is a stronger commitment than the heuristic and permanently pins a resolution that the
  heuristic might later refuse (once a second token-sharing NPC appears).
- Resolution is computed **per call and never cached in storage** — the answer for the same
  input string can legitimately change as `memory.npcs` grows (see E1). Every consumer must
  tolerate that; the durable fix for any specific pair is an explicit alias/merge tag.

---

## 3. Invariants — what must stay true

Each invariant names the behavior, why it is load-bearing, and its pinning test (§5).

| # | Invariant | Why it's load-bearing | Test |
|---|---|---|---|
| **I1** | **Identity**: an exact `memory.npcs` key resolves to itself; no token logic runs. | Writes to an existing NPC must never be redirected — and on an already-forked save, writes keep landing on the fragment (prevention ≠ repair; the honest behavior UA29 exists to fix). | T3 |
| **I2** | **Alias supremacy**: a registered alias resolves before (and regardless of) token matching. | `[NPC_MERGE:]` leaves the dupe key as an alias — this is the ONLY thing that makes merged identities and the RAG bridge permanent. If tokens could override aliases, a merge could silently un-merge. | existing test (engine-tests.js:121), T8 |
| **I3** | **Role-only names are unmergeable**: empty `inCore` → input returned unchanged; empty `kCore` keys are never candidates. | "The Innkeeper" must never absorb (or be absorbed by) a real NPC; a campaign has many anonymous functionaries. | existing test (engine-tests.js:120), T10 |
| **I4** | **Single-candidate rule** (the two-same-token guard): token-subset auto-resolve fires ONLY when exactly one existing entry matches; two or more candidates → no resolution. | Distinct people sharing a distinctive token (the Kaijitsu siblings; two Aldaras) must never be fused by the heuristic. False merge is the worst failure mode of this system — worse than a fork, because it destroys information. | existing test (engine-tests.js:119), T1 |
| **I5** | **Bidirectionality**: the subset test works in both directions (short incoming → long key; long incoming → short key). | The GM varies names freely in both directions; killing the reverse direction would re-open the fork class for campaigns whose canonical key happens to be the short form. | T2, existing test (engine-tests.js:118) |
| **I6** | **Stopword semantics**: honorifics/titles/roles/articles (`_NPC_STOP`) never count as distinctive tokens; parentheticals are stripped before tokenizing. | "Sheriff Belor Hemlock" ≡ tokens `[belor, hemlock]`; "Morwen (Ammut's wife)" ≡ `[morwen]`. This is what makes honorific drift and extractor parentheticals resolvable at all. | existing tests (117, 118), T6 |
| **I7** | **Determinism**: pure function of `(name, memory.npcs keys + aliases)`. No turn/time/RNG dependence. | Prompt-cache stability, shadow-parity replays, and the RAG memo all assume repeated calls with the same store give the same answer. | T7 (covers with I8) |
| **I8** | **Non-mutation**: `resolveNpcName` never writes to any store. Writes happen only in callers, only under the RESOLVED name. | This is what makes memoization safe (§6) and what lets `ragRetrieve` call it from a read path without dirtying state. | T7 |
| **I9** | **Instability is a feature-with-teeth, not a bug**: adding a second NPC sharing a distinctive token demotes future auto-resolves of the shared short form (I4 kicks in) — previously-clean names begin returning unchanged, forking a NEW bare-name entry on the next keyed write. | Documented so nobody "fixes" I4 to break ties by recency/first-match — that would trade an obvious fork for a silent false merge. The correct response to E1 in play is an explicit `[NPC_ALIAS:]`. | T1 (asserts the demotion) |
| **I10** | **Alias uniqueness across keys**: no alias string may appear in two different keys' `aliases[]` (stage 3 is first-match-wins in insertion order, so a duplicated alias makes resolution order-dependent). The merge machinery must never create this state. | Object-key insertion order is stable per ES spec but is NOT a semantic anyone should depend on; a duplicated alias is a data-corruption state where identity depends on registration history. | T9 (merge post-condition; also a UA29 script post-check) |

---

## 4. Edge cases, with concrete examples

### E1 — Second NPC sharing a distinctive token appears mid-campaign (the I9 demotion)
- t10: store holds `"Aldara Perdrath"`. `[NPC_NOTE:Aldara|…]` resolves → `"Aldara Perdrath"`
  (single candidate). Clean for 40 turns.
- t50: a blueprint import (or a GM ignoring the name-reuse rule) adds `"Aldara Voss"` — a
  *different person*.
- Now `npcCoreTokens("Aldara") = [aldara]` is a subset of BOTH keys → 2 candidates → `"Aldara"`
  returns unchanged → the next keyed write **creates a third entry `"Aldara"`** in
  `memory.npcs`, and RAG write-time stamps begin splitting across it.
- Mitigation is procedural, not code: the GM (or player, via Table Talk) emits
  `[NPC_ALIAS:Aldara Perdrath|Aldara]` — after which stage 3 pins "Aldara" forever (I2)
  regardless of how many Aldaras exist.

### E2 — Reverse-direction fork: the short key registered first
- t5: `[NPC:Hemlock|gruff|neutral]` creates key `"Hemlock"`.
- t40: the GM upgrades to `[NPC:Sheriff Belor Hemlock|…]` → tokens `[belor, hemlock]` ⊇
  `[hemlock]` → resolves TO `"Hemlock"`. **No fork** (good) — but the canonical key stays the
  impoverished short form forever, and every prompt block, npcGraph edge, RAG stamp, and
  relationship entity says `"Hemlock"`.
- Consequence for UA29: normalizing short→full **changes the canonical key**, which is a
  rename of every reference. The merge handler's alias trail is what keeps old references
  resolvable (§7 item 2) — a script that renames without leaving the alias breaks the bridge.

### E3 — The already-forked save is NOT self-healing (why UA29 exists)
The t1392 audit found `"Aldara"` / `"Aldara Perdrath"` / `"Aldara of Perdrath"` — one person,
three keys (pre-v1.62 damage). With all three present:
- `resolveNpcName("Aldara")` → **exact key hit (I1)** → returns `"Aldara"`. Writes keep
  fattening the fragment. The heuristic never even runs.
- `resolveNpcName("Perdrath")` → `[perdrath]` ⊆ both full keys → 2 candidates → unchanged.
- Note `npcCoreTokens("Aldara of Perdrath") = [aldara, of, perdrath]` — **"of" is not in
  `_NPC_STOP`** and there is no token-length filter, so it counts as a distinctive token.
  `[aldara, perdrath]` ⊆ `[aldara, of, perdrath]` still holds, so the two FULL forms would
  pair-resolve if either were incoming — but three-way, everything is ambiguous.
Prevention (v1.62) stops NEW forks; it cannot repair existing ones. That repair is UA29.

### E4 — The two-Aldaras hazard (UA29's ⚠ guard, stated precisely)
Nothing *structural* distinguishes E3 (three keys, one person) from E1's endpoint (three keys,
TWO people, one of them bare-named). Token-subset chains look identical in both. Therefore any
merge script keyed on token evidence alone WILL eventually fuse two genuinely distinct NPCs.
This is why UA29 mandates: run on an exported copy, emit a human-reviewed merge report (with
knowledge/events excerpts per candidate group) BEFORE applying, keep the original. The script
may *propose* by token-subset chain; only a human (or, later, model review with human sign-off)
may *confirm*.

### E5 — Alias matching is case-sensitive; token matching is not
Alias `"The Grey Blade"` registered on `"Veyra"`. Incoming `"the grey blade"`:
- Stage 3 misses (exact-string `indexOf`).
- Stage 4: `npcCoreTokens("the grey blade") = [grey, blade]` vs `npcCoreTokens("Veyra") =
  [veyra]` — no subset → **unresolved**.
Pinned as current behavior (T4). In practice tag names arrive with the GM's own casing, which
tracks the alias's original casing, so this rarely bites — but it is a real asymmetry and any
"fix" (lowercasing the alias scan) is a behavior change requiring corpus replay.

### E6 — Tokenizer quirks: punctuation splits, no length filter, no dedupe
- `"Hemlock's"` → non-alnum replaced by space → `[hemlock, s]` — the orphan `"s"` IS a token
  (no length filter, `"s"` not in `_NPC_STOP`). So incoming `"Hemlock's"` against key
  `"Sheriff Belor Hemlock"` (`[belor, hemlock]`): shorter list `[hemlock, s]`, and `"s"` ∉
  `[belor, hemlock]` → **not a subset → unresolved**. Possessive-form names do not resolve.
- Hyphens/apostrophes split: `"Vex-Ahlia"` → `[vex, ahlia]` (helps: `"Vex"` resolves to it).
- `npcCoreTokens` does not dedupe, but the subset test's `indexOf` ignores multiplicity, so
  duplicate tokens are harmless.
Pinned by T5 — these are *documented current behaviors*, not endorsements.

### E7 — Aliases three levels deep resolve in one hop or not at all
Stage 3 checks `aliases[]` membership only — there is no transitive closure. If "Hemlock" is an
alias of "Sheriff Belor Hemlock", and someone later merged THAT into a third key, the merge
handler copies all of the dupe's aliases onto the new canonical (tag_table.js:110), so the
chain flattens at merge time. The invariant that keeps one-hop sufficient: **merges always
flatten alias lists** (part of T9's post-condition).

### E8 — The RAG memo's safety window
`_resolveIdx` inside `ragRetrieve` caches `name → resolveNpcName(name)` for the duration of ONE
retrieval pass. Safe because retrieval is read-only (I8) — `memory.npcs` cannot change
mid-call. The memo is rebuilt every call, so cross-turn staleness is impossible. This is the
model for any future memoization (§6).

---

## 5. Engine tests that pin each invariant

Existing (dev/engine-tests.js:116–121, all green): parenthetical variant (I6), honorific +
surname (I5/I6), shared-surname siblings do NOT merge (I4), role-only unmergeable (I3),
registered alias wins (I2).

New tests to add — named, with exact inputs. All follow the suite's `memory=blankMemory();`
setup pattern and are DOM-free.

| Test name | Setup | Assertion | Pins |
|---|---|---|---|
| **T1** `mid-campaign token-share demotes auto-resolve` | keys `"Aldara Perdrath"`, then also `"Aldara Voss"` | `resolveNpcName("Aldara")==="Aldara Perdrath"` with only the first key present; `==="Aldara"` once both exist | I4, I9, E1 |
| **T2** `long incoming resolves to short existing key (reverse direction)` | key `"Hemlock"` only | `resolveNpcName("Sheriff Belor Hemlock")==="Hemlock"` | I5, E2 |
| **T3** `an existing fork is not self-healed` | keys `"Aldara"`, `"Aldara Perdrath"`, `"Aldara of Perdrath"` | `resolveNpcName("Aldara")==="Aldara"` (exact-key short-circuit) AND `resolveNpcName("Perdrath")==="Perdrath"` (2 candidates) | I1, E3 — the documented reason UA29 exists |
| **T4** `alias scan is case-sensitive (pinned quirk)` | key `"Veyra"` with alias `"The Grey Blade"` | `resolveNpcName("the grey blade")==="the grey blade"` | E5 |
| **T5** `tokenizer quirks pinned` | — | `npcCoreTokens("Hemlock's")` deep-equals `["hemlock","s"]`; `npcCoreTokens("Aldara of Perdrath")` deep-equals `["aldara","of","perdrath"]`; consequently `resolveNpcName("Hemlock's")==="Hemlock's"` with key `"Sheriff Belor Hemlock"` present | E6, E3 |
| **T6** `stopword stack strips to the distinctive core` | — | `npcCoreTokens("The Old Sheriff Belor Hemlock")` deep-equals `["belor","hemlock"]` | I6 |
| **T7** `resolver is pure and deterministic` | keys `"Sheriff Belor Hemlock"` (+alias `"The Sheriff"`), `"Ameiko Kaijitsu"`, `"Tsuto Kaijitsu"` | `s0=JSON.stringify(memory.npcs)`; call `resolveNpcName` on `["Hemlock","Kaijitsu","The Sheriff","Nobody New","Barkeep"]` twice; both passes return identical arrays AND `JSON.stringify(memory.npcs)===s0` | I7, I8 |
| **T8** `NPC_MERGE leaves the bridge intact` | keys `"Hemlock"` and `"Sheriff Belor Hemlock"`; run the NPC_MERGE handler (via `applyMuts` on `"[NPC_MERGE:Sheriff Belor Hemlock|Hemlock]"`) | `memory.npcs["Hemlock"]` gone; `memory.npcs["Sheriff Belor Hemlock"].aliases` contains `"Hemlock"`; `resolveNpcName("Hemlock")==="Sheriff Belor Hemlock"` (via stage 3, I2); AND a `worldState.transcript` GM entry stamped `e:{n:["Hemlock"]}` still surfaces from `ragRetrieve("ask Hemlock about the broadsheet")` — i.e. the orphaned write-time name scores through `_resolveIdx` | I2, §7 item 2, the t198 regression class |
| **T9** `merge never duplicates an alias across keys + flattens chains` | key `"A"` with alias `"x"`; key `"B"` with aliases `["x","y"]` is merged into `"A"` | after merge, exactly ONE key's aliases contain `"x"` (and `"y"`, `"B"`); `resolveNpcName("y")==="A"` in one hop | I10, E7 |
| **T10** `empty-core incoming vs empty-core keys` | key `"Barkeep (Rusty Dragon)"` only | `resolveNpcName("The Guard")==="The Guard"`; `resolveNpcName("Barkeep (Rusty Dragon)")==="Barkeep (Rusty Dragon)"` (exact key, I1) | I3 |

T8 is the load-bearing one: it converts the t198 merge-orphan incident (origin scenes going
invisible after user-issued Hemlock merges) into a permanent regression tripwire covering the
handler AND the retrieval bridge in one test.

---

## 6. Performance notes

### Cost model
One `resolveNpcName` miss (stages 3+4 both run) costs:
- Stage 3: O(K) alias-array scans (K = `|memory.npcs|` keys, alias lists are short).
- Stage 4: `npcCoreTokens` on the input once, then **`npcCoreTokens(k)` on EVERY key** — each
  is two regex passes + a split + a stopword filter — plus an O(T²)-ish `indexOf` subset test
  (T = tokens per name, ~1–4). The regex tokenization of every key is the dominant term.

### Where it sits in hot loops
| Caller | Frequency | Multiplier |
|---|---|---|
| `ragEntitiesFromRaw` (write-time index, `logTranscript`) | every GM turn | once per NPC-ish tag + once per name-scan hit (≤12 adds) |
| `ragRetrieve` scoring bridge | every gameplay turn (flag on) | once per DISTINCT orphaned `e.n` name — **already memoized per call** (`_res`, memory.js:427) |
| `ragKnownNames` | ≥2× per turn (query entities + write-time scan) | computes `npcCoreTokens` per key each call (its own cost, same shape) |
| tag handlers / `applySummaryExtract` / `findCompanionChar` | per tag / per summarize / per COMPANION_* tag | bounded, cold |

At t308 scale (dozens of NPC keys) none of this is the dominant per-turn term — the linear
transcript scan in `ragRetrieve` (UA15 watch) dwarfs it. Optimize only if profiling on a mature
save says otherwise (UA12's own framing: "if profiling warrants").

### If profiling warrants — the safe levers, in order
1. **Memoize `npcCoreTokens(string)` first.** It is a pure function of its input string alone —
   a plain `{string: tokens[]}` cache needs **no invalidation ever** and removes the regex work
   that dominates stage 4 and `ragKnownNames`. Zero drift risk. (Cap growth with a simple
   size check + reset if paranoid; key strings are NPC names, so cardinality is tiny.)
2. **Per-call memo for batch consumers** — the `_resolveIdx` pattern already in `ragRetrieve`:
   a local `{name: resolved}` map whose lifetime is one read-only pass. Safe by I8; copy it
   into `ragEntitiesFromRaw`/`ragKnownNames` if needed.
3. **Cross-call memo of full resolutions — LAST resort, drift-hazard.** A global
   `{name: resolved}` cache is only correct while `memory.npcs` **keys and aliases** are
   unchanged. Writers that must invalidate it: the `NPC` handler (new entry),
   `NPC_PRONOUN` (new entry), `PARTY_MEMBER` (new entry), `NPC_ALIAS`, `NPC_MERGE`,
   `fileNpcEvent` (new entry), `applySummaryExtract` (new entries), plus every wholesale
   `memory` replacement (importSave, `switchToCampaign`, server reconcile, blueprint seeding,
   `campNew`). The only maintainable scheme is a **generation counter** bumped inside
   `blankMemory()`-adjacent helpers and every add/alias/merge site, with the memo checking
   `gen` — NOT hand-enumerated invalidation calls, which will drift. A missed invalidation
   serves a **stale identity** (silently fused or forked NPC — the exact failure class the
   drift decree exists for), so this lever ships only with the T1–T10 suite extended to run
   against the memoized build and a corpus replay showing byte-identical end states.

---

## 7. Interaction with UA29's one-time merge script — what the script must preserve

The `NPC_MERGE` handler (tag_table.js:110–124) is the **reference implementation** — the script
is that handler generalized to run offline over an exported `.tnd`, plus the gaps listed below.
Per merged pair (canonical ← duplicate) the handler, and therefore the script, must:

1. **memory.npcs**: append dupe `events` (the 8-cap re-applies on the next `fileNpcEvent` via
   the E50 slice — the script may pre-trim to the newest 8 to match steady state); union
   `knowledge` (deduped); union `aliases` (deduped); adopt dupe `firstEncounter` only if the
   canonical lacks one; delete the dupe key.
2. **⚠ THE BRIDGE CONTRACT — register the dupe key itself as an alias of the canonical.**
   This single write is what keeps everything the script does NOT rewrite resolvable:
   transcript write-time `e.n` stamps, old chapter prose, any missed reference. Skip it and
   every pre-merge RAG index entry for that NPC goes invisible (the t198 regression, pinned by
   T8). **Post-merge verification (mandatory, per the UA29 guard): for every merged dupe D,
   `resolveNpcName(D) === canonical`, and a `ragRetrieve` probe naming the canonical still
   surfaces at least one pre-merge-stamped excerpt — verify the bridge, don't assume it.**
3. **worldState.npcs**: partyMember ORs; `charSheet`/`portrait`/`portraitOffset`/`pronouns`
   adopt-if-missing; `status`/`rel` adopt-if-unknown; `met` = earliest; dupe entry removed.
4. **memory.npcGraph**: rewrite `edges[].a/b`; move/concat `npcFactions[dupe]` into canonical.
5. **worldState.character.relationships**: rewrite `entity===dupe` → canonical, then dedupe.
6. **Beyond the live handler — gaps the script must ALSO cover** (the tag handler doesn't,
   because in-session those heal incrementally; a bulk offline merge must not leave them):
   - **`memory.map` residue**: node `npcs[]` arrays still list the dupe name, and the dupe's
     `lastSeenAt` dies with its entry. Rewrite node `npcs[]` (dedupe) and adopt the dupe's
     `lastSeenAt` onto the canonical if the canonical has none or an older one — the GEOGRAPHY
     block's "NPCs last seen elsewhere" reads these.
   - **Companion sheets**: `charSheet.relationships[].entity` on every party member may hold
     the dupe name (written before resolution existed) — rewrite + dedupe.
   - **`worldState.coreMemories[].who`** (#40) and `memory.keyDecisions`/`lore` prose: `who`
     fields rewrite; prose strings are LEFT ALONE (they are narrative record, and the alias
     trail makes the old name still resolvable when quoted).
7. **Merge-group ordering**: a 3-way group (E3's Aldara trio) merges sequentially into ONE
   chosen canonical; alias lists accumulate transitively (E7's flattening keeps stage 3
   one-hop). Canonical choice policy: the most token-specific key (`"Aldara Perdrath"` over
   `"Aldara"`), matching `ragKnownNames`' keep-the-most-specific collapse — after re-import the
   scan-identity grouping then reforms with zero extra work.
8. **The two-Aldaras discipline (E4)**: the script PROPOSES groups by token-subset chains +
   alias links; a human-reviewed merge report (per group: keys, alias evidence, knowledge and
   event excerpts, first-encounter snippets) gates the apply step. Run on an exported COPY;
   keep the original; re-import only after the report is signed off.
9. **Invariant re-check after apply**: run the §5 suite semantics against the merged store —
   in particular I10 (no alias claimed by two keys) and I1 (no dangling references: every
   `e.n`-stamped name, graph endpoint, relationship entity either IS a live key or resolves to
   one via stage 3).

What the script must NOT do: token-subset auto-apply without review (E4); rename a canonical
without leaving the old key as an alias (breaks item 2); "improve" `_NPC_STOP` or the tokenizer
in the same pass (behavior change → separate ⛨ commit with corpus replay).
