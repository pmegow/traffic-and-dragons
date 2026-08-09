# AUDIT — #148 Recall Gate (era summaries vs archived-chapter retrieval), v1.573

**Run:** 2026-08-09, live on the player's key via `dev/recall_gate.html` at pages.dev (test-browser profile; corpus staged from the t1549 export, campaign state untouched — the page is read-only by construction). Model: `claude-sonnet-4-6`. Cost: ~26 calls (11 era compilations + 20 answers + 1 extractor probe).
**Corpus:** `testRuns/recall_gate_results_t1549.json` (gitignored, complete — eras, both arms' full answers, probe raw). 216 archived + 10 live chapters, t100–t1545.
**Judge:** Fable, against 10 expected-answer keys authored from the real archived chapters *before* the run.

## The two arms

- **Arm A — ERAS:** 11 era summaries (~150 tok each, 20-chapter batches) compiled live from the full chapter archive, served as the only context.
- **Arm B — RETRIEVAL:** top-3 archived chapters by lexical token overlap with the question (the feTokens shape), served verbatim.
- Both arms answered under "use ONLY the context; if absent, say CANNOT ANSWER."

## Question-by-question verdicts

| # | Question (short) | Arm A (eras) | Arm B (retrieval) | Win |
|---|---|---|---|---|
| 1 | Daeris's ledger years / contract holders | ✓ correct | ✓ correct (T100 served) | tie |
| 2 | What the charmed goblin saw | ✗ only "wrongness" — compression lost the images | ✓ full (water stood upright, too many joints) | **B** |
| 3 | Whose letters in Frizwick's satchel | ✗ CANNOT | ✓ full (Foxglove + the flowers plan) | **B** |
| 4 | Rinn Toldrath + the three desk items | half — death yes, items honest-CANNOT | ✓ full (key, iron disc, Edric's name) | **B** |
| 5 | Hemlock's catacombs instruction | ✗ CANNOT (explains exactly what the era lacks) | ✓ verbatim | **B** |
| 6 | Korunn's charmed revelation | ✓ full (Third, Aunt, spiral) + flags the unconfirmed "consent" premise | ✗ CANNOT — **lexical whiff**: served t304/t814/t1049, missed t1056 | **A** |
| 7 | Luring the built creature | ✗ CANNOT | ✗ CANNOT — whiff (missed t1218) | both fail |
| 8 | The Sleeper's interrogation | half — burned ✓, content honest-CANNOT | ✗ **confident misattribution** — answered from t1159 (Yassa's corpse), fluent, specific, wrong event | **A** |
| 9 | The replacement Third + how learned | ✓ Vareth via cipher (missed the overheard scene) | ✓ full — both sources incl. the t587 storeroom | **B** |
| 10 | Chask Haladan's death + confession | ✓ near-complete | ✓ complete + the fire | B by a nose |

**Tally:** B 5–6 clean wins · A 2 · 1 tie · 1 both-fail.

## Failure-mode census (the load-bearing finding)

- **Arm A missed 5 times — every miss was an honest CANNOT ANSWER.** Zero confabulation across the run, and in Q6 it proactively flagged an unsupported premise in the question itself. Compression loses fine detail (expected); it never invents.
- **Arm B failed 3 times — two lexical gate whiffs (CANNOT) and one confident misattribution (Q8):** it answered the Sleeper question with a different corpse's interrogation, fluently and specifically. In a forced-answer frame this is the worst drift class: plausible, grounded-looking, wrong-event.

## Ruling

**No single winner — the arms cover each other's failure modes, and both ship, retrieval first:**

1. **Phase 1 — index archived chapters into RAG** (Sol's "safer first experiment", read-side): the measured recall yield is decisively higher when the gate hits, and the product's existing guardrails (excerpts under the "current blocks override" header, turn-stamped, episodic-texture-never-truth) are precisely the mitigation for the Q8 misattribution class — the gate's forced-answer frame has no such guardrails, the product does. The two whiffs argue for widening the gate beyond pure lexical overlap (the existing RAG entity/location/quest gate + lexical ranking is already richer than the test's scorer).
2. **Phase 2 — the ERAS block** as the bounded always-on spine: it answered the arc-scale questions, never confabulated (the property an always-injected tier must have), and it serves the passive-context need (the GM reading "how did we get here" every turn) that a question-answer gate structurally under-measures. Provenance per the ruled spec: turn ranges + source chapters, rebuildable, budget-capped.

## Rider: #144B extractor probe — VALIDATED in substance

The live model, given the v1.572 typed schema over the real session tail, emitted **exactly the typed shape with correct classification on the first try**: Wyla's watcher arrangement as `durable`; her sealing-a-box moment and Morwen's in-progress errand as `scene`. The probe's own `parsed:false` is an instrument artifact — the model prefixed `[PARTY_SPLIT:]` tags before a fenced JSON block because the mini-probe prompt lacked the real pipeline's B11 note-stripping and full anti-markdown enforcement; `summarize()` proper carries both plus the 3-strike retry machinery. Watch in the field: the first real summarize after v1.572 should file scene facts into events (visible as `[memory]` history lines rather than Knows growth).
