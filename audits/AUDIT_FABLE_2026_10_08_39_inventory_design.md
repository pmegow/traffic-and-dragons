# Entry 39 — inventory-row design review

Date: 2026-10-08. Senior adjudicator: Astra, eligible under AGENTS.md. Invoked workflow: .agents/skills/fable-review/SKILL.md. Baseline 8715997f6ce1837c032867d4de8477d718dc5b64, tree 3aa32e6c4cb53220ca3efb46eee03d3400829474. Scope: review the #599 design, correct its requirements/evidence, and harden only the development census. No inventory.js, runtime version gate, row migration, tag/UI behavior, #518 transfer fix or rollout is implemented by this review.

## Verdict

**REVIEW COMPLETE — direction affirmed; remaining engineering contracts must be resolved before implementation.** The revised [design](../DOC/DESIGN_599_inventory_rows.md) preserves all ten owner rulings in §9 verbatim. The one-module row model, single item key with an explicit provenance-free variant, whole-row equipped flag, permanent WORN input alias, chosen counter wording, retained storage key and gate-first release are affirmed. Neither this verdict nor a green legacy census makes #599 implemented or ready to ship. The gate release and later migration each require their own implementation and independent verification.

Entry 39 questions (a) version/admission, (b) row normalization, (c) match compatibility, (e) reader/writer coverage and (f) proof sensitivity were reviewed; (d) the #518 boundary received targeted checks. Historical one-release WORN and fixed-week schedule text is superseded by §9, not a reopened owner question. No hardening of excluded runtime issues was authorized.

## Confirmed findings and dispositions

| Finding | Mechanism and load-bearing evidence | Review-only disposition |
|---|---|---|
| R1 — Admission must precede effects | ui-campaigns.js:324 writes live keys before loadState. Independent scratch interception returning false from loadState still produced four writes, stored W11, live W10 and wrapper true. ui-browsers.js:704 extracts character and discards envelope ver; checkpointAcceptable at state.js:760 checks checkpoint v independently of nested world ver. Fallen/rejoin, editor, imported Play and tools are additional doors. | Design §5.3/5.4/11 now require pre-side-effect world AND sheet checks, preserved source, envelope/stamp transport and later autosave/push proof. Missing/malformed/inconsistent version policy and publication behavior remain explicit build contracts. No gate implemented. |
| R2 — The dry-run is not a general row specification | Original census lines 24–45 reconstruct object rows and lose unknown fields; Infinity survives then JSON null is normalized to 1. Idempotence still passes after initial loss. Nonarray containers, counted object-row names, conflicting extras, coercion and overflow are unsettled. Independently reproduced field loss and Infinity→JSON→1. | Remove claims that the field tool implements full §5.2. Scope it to legacy strings; preserve I5 and finite integer intent in design, but do not invent an upper bound, coercion or duplicate-conflict policy. Specify API/result/junk ownership before implementation. |
| R3 — Shared row objects change transaction semantics | game.js:380 and tag_table.js:540 preflight .slice copies; game.js:4394 Sync snapshot. Strings are immutable; object rows remain shared. Synthetic decrement of a sliced row changes live qty 3→2. | Add detached-copy/writer-ownership requirement and refusal atomicity sabotage to design map/gates. No production row writer exists yet; this is a design hazard, not a shipped row-runtime regression. |
| R4 — Present census can falsely approve equipment loss or incomplete input | Actual scratch mutant clears every equipped flag yet exits 0; text and unit comparisons do not observe equipment. Unreadable/no-world/nonarray/junk cases can also exit0. Reversing inventory does fail text order. | Narrow failing-first DEV census correction: independent equipped-membership oracle and explicit legacy input/coverage failures. Authorized equipped line uses pack order; ordinary inventory order stays exact. Tool proof receipt is recorded below after verification. |
| R5 — One key is intentional behavior change, not universal parity | 20 observed pairs: Wolf pelt/pelts now converge where wants/catalog/place folds differed. Provenance-free callers intentionally differ from pack/chest. Current _invNorm strips count-like suffixes (Modelx3, Model x01) that the proposed parser can treat as literals. Natural-s conflation already exists. | Design records changed-match matrix and requires literal/count/provenance contracts before code. No normalizer rewrite or new linguistic policy here. |
| R6 — Coverage and proof statements need boundaries | Three silent string guards confirmed; Table Talk lacks a design-table row; merge preimages/mpFallen are opaque inventory carriers; __ceTest already exists. Source census of 2,077 sites / 147 files is mechanical, not exhaustive runtime coverage. Frozen test-title changes lose detailed diff diagnostics, not the underlying failure. | Refresh map and gates; retain immutable preimages, normalize copies on reactivation, include loaders and indirect readers. Future static/module/replay/skew/live gates remain unimplemented and cannot be reported passed. |
| R7 — Server opacity wording is too broad | Local server 025877ac parses JSON and reads turn/CAS/identity/quota metadata; campaign and character inventory entries are not interpreted by inspected persistence handlers. | Correct “parses neither” to inventory-schema opacity. No server implementation needed is asserted beyond inspected scope; deployment parity remains unverified. |

The design now distinguishes proposed contracts from shipped behavior and observed legacy field data. §11 lists unresolved engineering decisions; they are future #599 work, not permission to silently choose lossy defaults.

## Affirmed boundaries

The unmodified field census independently reproduces all three documented totals: latest: 10 saves / 45 sheets / 1,102 entries; all owner saves: 77 / 507 / 11,490; test runs: 43 / 125 / 3,638. All 120 source-save hashes remain unchanged. No non-string inventory entries occur in those samples, so they cannot establish general row/mixed/junk behavior. Latest selection uses filesystem mtime per directory, not embedded campaign identity/turn. Only hero, NPC charSheet and pendingLegacy shapes were traversed by that tool; additional current object-tree inventory paths were not observed in this dataset, which is not a schema completeness proof.

The same-name #518 loot/throw failure remains: independent Dagger loot plus an untracked companion Dagger loss leaves hero 0 / Bram 0, with +Dagger followed by Nothing moved. Genuine missing take emits the same tags and state. A different-name Spear throw retains Dagger 1; six quantity/chest controls behave as previously claimed. Rows contain no source/destination/event identity. §7/§9 correctly leave explicit transfers to #518; no fix or closure of #518 occurs here.

The gameplay prompt already reaches relationshipMigrateSheet before its inventory line; one synthetic prompt invokes the adapter four times. This supports a normalization seam but also requires repeated-call stability. capture-prompt skips migrateWorldState; it does inflate before buildSysPrompt. Existing golden assertions remain green; EQUIPPED documentation/parser migration is future work.

## Evidence and independent checks

[Evidence directory](reviews/39_inventory_design_2026-10-08/README.md) contains independent reports A/B/C, synthetic results, public-source site indexes and aggregate receipts. Private save files, selected-path/mtime lists and per-save manifests/hashes remain in TEMP. All original runtime/source evidence is baseline-labelled. Copy probes to TEMP before running; some write adjacent JSON or retain original absolute paths.

Senior spot-checks directly verified manual-pull caller ordering, actual char-envelope loss, independent checkpoint versions, server parse/metadata reads, reference unknown-field loss despite idempotence, Infinity serialization loss and equipment erasure invisibility to text/units. A first senior char-import probe omitted an inert document stub and stopped before preview; correcting the harness reproduced the reported behavior. This was not a product finding.

The draft does not yet define safe numeric limits, invalid quantity/boolean treatment, conflicting unknown-field folds, count-bearing row names, malformed containers, invRows result/diagnostic ownership or junk dedup/retention. Those are not inferred from JavaScript coercion or the legacy reference model. Arbitrary dynamic-alias census completeness, live server parity, SW/update/device drill, future cloud roundtrip and stochastic live-GM behavior remain UNDETERMINED/unexecuted. No credentials or live provider calls were used.

## Development census correction receipt

The development checker now explicitly accepts only legacy string inventories. It rejects unsupported rows/mixed arrays, unreadable or malformed inputs, junk, unmatched worn items, grammar disagreement, unsafe quantities, text/order changes and zero usable coverage. Missing inventories are reported as skips; empty arrays remain valid. The safe-integer bound belongs to this checker and does not settle the future row API’s quantity policy.

Failure-first evidence recorded 5 passing and 19 failing assertions against the original tool; the original equipment-erasure mutant escaped its equipment checks. The final focused suite has 26 passing assertions. Four named scratch mutations are caught by their required failures: erased equipment membership, reordered inventory, filtered unsupported entries and lost units. Senior independent reruns confirmed 26/26 and 4/4, with source restored byte-identical. Temporary fixture/proof directories have checked, scoped cleanup. Final integration review caught missing repository-target metadata in the new scratch battery; four literal per-clause targets now support the unchanged discovery/applicability contracts while execution still mutates only TEMP. A checker-only diff selects this battery, all four original-source clauses are captured, and applicability passes 2,774 clauses across 311 batteries. Senior independently reran the discovery/capture probe; no central scanner was weakened.

The three field modes retain 10 / 45 / 1,102, 77 / 507 / 11,490 and 43 / 125 / 3,638 saves / sheets / entries, with equipment-order changes 4 / 29 / 0 and zero invalid diagnostics. All 120 input hashes remain unchanged. Curated aggregate and synthetic proof receipts are in the evidence directory; private manifests remain in TEMP. This is a legacy preflight proof, not implementation or validation of general object-row migration.

## Monotonic resources

| Scope | Evidence and required contract |
|---|---|
| Per call | Reference normalize/projection allocates a fresh array every call; 1,000 fixed-input iterations retain 3 rows and 124 JSON bytes in C (2.4623ms), or 126 bytes in B's different fixture (5ms). No heap/GC claim. A stable lossy result does not prove preservation. |
| Per turn | Prompt fixture calls sheet adapter 4 times. Future heal must avoid repeated junk insertion/warnings and must not mutate shared preflight rows. Temporary maps follow current keyedDict/own-field contracts. |
| Per session | Existing alias index is replaced; distinct-key warning/value caches can grow. No new row-index cache is authorized by the design. Measure new caches if introduced. |
| Per campaign | Inventory is O(items); version stamps O(sheets). Existing tag/note rings cap 40 and stashMoves 200. Define junk retention/serialization explicitly; preserve merge preimages and archived sheets. Event-driven archive growth differs from repeated-heal growth. |
| Per device | Retained storage key is ruled; editor draft is one slot. Campaign/checkpoint/library/history copies grow with retained data, not per-heal keys. No rollout or deletion performed. |

## Delegation receipts and quality

The skill's older Opus delegation wording was adapted to available tools: two existing Astra evidence agents and one default-model evidence-only agent; senior Astra alone adjudicates under current AGENTS eligibility. No delegated verdicts were requested or accepted. Tokens are UNAVAILABLE, not estimated. Tool counts use exec calls consistently; wrappers/messages are not added a second time.

| Brief | Agent role | UTC interval | Wall seconds | Exec calls | Evidence fed into review |
|---|---|---|---:|---:|---|
| A | Astra, admission/persistence |23:08:26.425Z–23:17:13.058Z|526.633|24|44 actual + 10 simulated observations;73 assertions;1,014 tracked sources unchanged; version/persistence/loader matrix and local server source |
| B | Astra, semantics/census |23:08:35Z–23:18:32.589Z|597.589|16|43 reference cases,20 match pairs,10 tag cases,9 synthetic census inputs,1,000 roundtrips;120 save hashes unchanged |
| C | Default evidence-only, coverage/proofs |23:08:54.312Z–23:19:41.041Z|646.729|22|9 actual #518/control cases,3 census sensitivity runs,7 reference checks,4 projection cases,5 golden assertions;1,466 sources unchanged |

A's original metric wallSeconds=-24672.9420295 is preserved in A/metrics.json. The table uses elapsed UTC endpoints (526.633s); documentation read before the start stamp is not included. This is a receipt arithmetic correction, not an evidence change.

A accurately separated actual routes, scratch gate simulations and source-only doors; its receipt arithmetic needed correction. B reconciled field totals and distinguished the reference wrapper from the proposed API, including invalid cases that a positive census cannot cover. C expanded readers/writers conservatively and explicitly labelled mechanical false positives and unprobed aliases; its initial replay filename error was corrected in scratch. All three stayed evidence-only, named harness failures and uncertainty, and avoided personal writes/live calls.

For the next review, request a dedicated pre-side-effect admission map before assuming a migration hook is sufficient, require independent preservation oracles in addition to idempotence, and distinguish current engine tests from promises about unimplemented gates. Record time with UTC/monotonic duration directly.

Root owns final TODO #599 and entry 39 queue/index updates, explicit staging, mandatory hooks and shipping. This reviewer made no runtime changes and did not commit or push.
