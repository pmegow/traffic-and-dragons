# AUDIT — Identity Hardening Phase A: spine + npc domain (TODO #156, v1.581)

**TLDR: the Savah fusion class is structurally over — a name-collision write now lands in a provisional identity instead of the established record, the GM settles same/distinct through one nudge, and every merge is reversible; shipped failing-tests-first with 12/12 sabotage proofs, byte-identical legacy replay on 5 corpora, and a live replay on the real t1593 save.**

- **Date:** 2026-08-09 · **Version:** v1.581 · **Tier:** Fable (drift surface)
- **Mandate:** [DOC/Research/identity_hardening_fable.html](../DOC/Research/identity_hardening_fable.html) §7.3
- **Order of work (user-directed):** critical review → failing tests → implementation → verification.

---

## 1. Critical review (recorded before code)

**Touched drift surfaces:** tag_table (parse paths: new `[ALIAS:]`/`[MERGE:]` entries, the `[NPC:]` upsert boundary, `[NPC_MERGE:]` pre-image + alias suppression, `[LOCATION:]`/`[PARTY_SPLIT:]` normalization) · memory.js (#128 scan, suggestion pool) · api.js stable half (NAMING clause) + NOTE_LATCH_FIELDS + notes registry · new engine file identity.js · strip/doc frozen goldens · sw.js/index.html/engine-manifest shell wiring.

**Material calls, each with the silent failure it guards against:**

1. **npc stays NAME-KEYED in Phase A.** A0 ruled IDs for *location* and corroborated the npc lean, but an npc-ID migration in the same phase as the spine + provisional build multiplies risk (Sol §8); the provisional record works name-keyed via unique `"Name °tN"` keys with the display name preserved. The npc-ID decision is a post-Phase-B call with the location migration as the proven template.
2. **Legacy `resolveNpcName` call sites NOT rewired to `resolveEntity`.** Zero behavior delta for real churn on THE parser path; new machinery uses the shared entry; Phase B rewires when location tags actually need it. (Deliberate deviation from §2.2's letter, faithful to §7.3's "legacy NPC tags reroute unchanged.")
3. **The provisional predicate is narrow on purpose** — a false provisional costs one nudge round; a missed fusion is permanent corruption, but an over-eager guard would *itself* fragment canon. All of: introduction-shaped rel (`NPC_INTRO_REL_RE` — the t1530 "unknown, not yet met" signature), history-rich record (knowledge+events ≥ 2), living, non-party, under `PROVISIONAL_CAP`. Location mismatch is nudge *evidence*, not a gate (travel is legitimate — Sol §6). **Honest limit, recorded:** the t988 class — the model *falsely asserting familiarity* — is not engine-detectable; the NAMING clause and suggestion filter attack that side's base rate instead.
4. **Cap degrade = status quo, loudly.** At `PROVISIONAL_CAP`(4) outstanding, a suspect write falls back to today's direct write with a warn — the guard can never be worse than what it replaced (runaway-model bound).
5. **Pipe refusal, no escaping grammar** (Sol §5): a `[MERGE:]`/`[ALIAS:]` payload that doesn't split into exactly `domain|a|b` is refused loudly with zero mutation. Real location keys carry pipes; they route through the Phase B cleanup tool.
6. **`provisionalNudged` joins NOTE_LATCH_FIELDS** — without it the #14 suggestion prompt build consumes the one-shot latch and the collision fork silently never reaches a real turn (the exact latch-eating class the registry exists for).
7. **#128 scan excludes `°` keys** — "Savah °t1530" token-contains "Savah", so the variant scan would propose exactly the merge the provisional exists to gate, through a channel with no same/distinct fork (dueling nudges).
8. **Resolution vocabulary reuses shipped machinery:** same person → `[NPC_MERGE:canon|prov]` (the battle-tested handler; its absent-canonical-creates semantics double as the rename flow for `[MERGE:npc|New Name|prov]`). A provisional key never becomes a permanent alias (it never recurs in prose; a live-key-as-alias is the corruption class npc-merge-core flags).
9. **Pre-images to `memory.archive.identityMerges`** on every npc merge (P12 — reversible by construction), import-whitelisted in the same commit. Append-only per house archive policy; entries are small (capped knowledge/events ride along).
10. **Road normalization is gated on route nouns and dash discipline** (en/em dash or *spaced* hyphen only), so hyphenated names ("Xin-Shalast", "Half-Sunk") and ordinary parentheticals are never rewritten; applied at the `[LOCATION:]` + `[PARTY_SPLIT:]` write boundary only.
11. **Dead-name reuse stays with B3** (intro-shaped writes on dead records do not mint provisionals) — evidence-gated follow-up, noted.
12. **Monotonic resources:** provisionals bounded by the cap + re-firing nudge; identityMerges append-only by policy; the suggestion filter's token set is rebuilt per call from memoized tokens (no new retained state).

## 2. Failing-first evidence

17 engine assertions written before identity.js existed — all red with meaningful diagnostics, including two live-fire proofs on real machinery: the #128 scan **actually proposed** the provisional pair, and the pre-Phase-A NPC path **actually fused** the canonical ("CANONICAL RECORD MUTATED — the fusion happened anyway"). Plus one red source contract (`identityMerges` missing from the .tnd import whitelist).

## 3. Verification

| Check | Result |
|---|---|
| Engine suite | **ALL GREEN — 1163 assertions** (1144 pre-existing + the #156 battery) |
| Frozen goldens | `_CT_TAGS` re-baselined (+12 = `ALIAS\|`+`MERGE\|`), STATE TAGS doc golden re-baselined (+257 = the one generalized-pair doc line) — deltas documented at the test sites |
| diff-replay | all 5 committed corpora (playtest v1238/v1258/v1271/v1276 + tagsoak v1241) replay **byte-identical** end states — zero legacy behavior change on real transcripts |
| Sabotage ([dev/sabotage-identity.js](../dev/sabotage-identity.js)) | **12/12 caught** across identity.js/memory.js/tag_table.js/api.js/helpers.js. One case initially MISSED — the route-noun gate had no input actually exercising it (the dash rule alone protected the old test input); the test was strengthened ("Festival Grounds (Day - Night)") and the case now catches. That miss is the sabotage discipline working. |
| Stable half | pre (git worktree @ HEAD) vs post capture-stable diff = **exactly** the doc line + the 6-line NAMING clause; byte-stability across calls engine-tested |
| Live t1593 replay | the t1530 apothecary write replayed against the REAL fused Savah record (knowledge=8): provisional `Savah °t1593` minted, canonical byte-untouched, nudge fires with both forks + the lastSeenAt evidence line, `[MERGE:npc\|Vessa Wormwood\|…]` rename-resolution clean, pre-image archived, no `°` alias pollution |
| Browser boot | fresh index.html parses with identity.js in the shell; all identity surfaces live in-page; zero console errors. (The version *label* lagged on file:// — documented Chrome subresource-cache behavior, CLAUDE.md's own hard-refresh rule; the deployed site invalidates via this commit's SW `CACHE` bump.) |

## 4. What did NOT change

Legacy `[NPC_ALIAS:]`/`[NPC_MERGE:]` behavior (parity-tested, modulo the additive pre-image archive) · `resolveNpcName` and its call sites · every non-suspect `[NPC:]` write (byte-parity asserted) · the #128 scan for non-provisional keys · applyMuts order for existing tags.

## 5. Carried forward

- **Phase B (location domain):** additive-ID migration per the A0 ruling; the A0 battery becomes the migration test seed; `map.ids` joins the import whitelist; the legacy call-site rewire decision; the cleanup tool.
- **Post-B:** the npc-ID representation call (this review's call #1).
- **Evidence-gated:** dead-name-reuse provisionals (call #11); per-domain thresholds if the intro-shape predicate over/under-fires in the field — watch the `[identity]` console warns and the ⚠ toasts.
