# Entry 41 evidence A: releases and parity

Read-only repository evidence; no verdict or repository edits. Parent initial HEAD 5360ba39, now 4b9d40a4 (unrelated #404 docs; engine unchanged per parent). Read AGENTS, CLAUDE, queue entry41, design, entry39 audit and receipt #design599. Actual engine probes use dev/load-engine; proposed code is not implemented or simulated as fact.

(a) String/prompt/replay parity: gaps. Design:57/67 makes invRows yield rows and writers normalize in place; :207 includes invHealSheet in b registry; :363 requires strings throughout b, but :364 activates that same heal in c. A phase-specific persistence adapter must preserve b inventory AND worn. No inspected reader makes a string bridge impossible; none proves it correct before implementation.

Current addInventoryItem(['Torch x1'],'Rope') yields ['Torch x1','Rope']. Proposed invRows→invText would canonicalize the untouched first item to 'Torch' (design:64), so whole-list projection cannot promise universal byte parity. Field evidence is limited to accepted legacy fixtures (design:274). attireLine reads worn order (api.js:3203): pack Shield,Sword + worn Sword,Shield produces 'Wearing: Sword, Shield'; row filtering produces Shield,Sword. b must retain old order until c.

Current api.js:3217–3218 QTY_MAX=999: _qtyParse('Arrow x1000') returns n:999,clamped:true. Receipt:111 recommends QTY_MAX=9999 for rows. Reusing that global widens tags despite frozen grammar. api.js:3269ff rename uses first provenance-free match; actual probe renames first of Signet ring (from A)/(from B) successfully. Routing through unique-base invFind refusal adds semantics beyond the scheduled key convergence. _invNorm('Modelx3') and ('Model x01') both return 'model', while _qtyParse treats both literals; itemKey's no-count-stripping rule needs its declared compatibility cases.

Four CI baselines (.github/workflows/engine-tests.yml:67–73) each have ws.ver and character.inventory, no worn/nested inventories. diff-replay:42 creates old fixture; :75 serializes all ws/mem. c's ver:11 changes another path beyond 'only hero inventory' checker (design:288,364). Full migration/admission may also add unrelated fields to deliberately old fixture; diff-replay:37–41 warns of this.

(e) Ordering: gaps.

| Contract | Evidence |
|---|---|
| b gate3 over strings and c gate12 | design:282/291 require EQUIPPED, but d installs parser/doc (:365). Actual current parser logs UNKNOWN and returns muts:[], errors:[], worn:null for EQUIPPED:Tess/Rope/on. |
| c prompt whitelist | :364 allows Equipped order change but :365 introduces label; c can reorder Wearing, label belongs d. |
| b delegates | :363 creates then deletes delegates while claiming mostly only delegate anchors change; direct tests still invoke retired APIs. |
| d checks | Row maps only EQUIPPED gate3 cases; prompt/golden/strip/alias and independent review obligations need explicit d coverage. |
| capture-prompt | design:183 promises inventory heal through relationshipMigrateWorld; :207 removes inventory heal from relationshipMigrateSheet in favor of admission. capture-prompt:21–22 only inflates and builds. Gate8 needs explicit detached preparation or read projection, not reliance on a removed hook. |

(f) Tests/anchors: partial classification; exact survival count UNKNOWN.

| Sites | Consequence |
|---|---|
| engine-tests:3622,7304–7328,12173,12216 | String-output assertions survive b with exact adapter behavior; must change at c. |
| engine-tests:12157–12208 | Direct sanitizer/fold/_invNorm calls cannot survive helper deletion unchanged; retaining compatibility exports preserves them. |
| tests-429-inventory-drop:264; tests-audit-ui:140,205 | Source pins require wornPrune; deletion breaks b regardless of output parity. |
| sabotage-481-d3-quantities:9–14 | Parser-body anchors need file retarget/reproof if parser moves. |
| same:18–28; sabotage-597-ledger-direct:13–15 | Per-unit handler/preflight loops disappear with count APIs; more than delegate-line reanchoring. |
| sabotage-429-inventory-drop:14–19,35–38 | String-equality, direct entry toggle, wornPrune anchors change with key routing/retirement. |
| sabotage-w2:502–503 | inventoryCountOf body cannot stay api.js target after move. |
| sabotage-597:17–24,30–35; sabotage-429:21–29 | Chest/purse checks, undo/ring effects, splice ordering, button grammar can survive if verbatim retained; conditional, not proven. |

90 clauses is historical scope, not measured survivors. ~100 string assertions are not 100 unavoidable b rewrites; direct API/source pins are separate workload. No moved-code applicability or attributed sabotage run; 31–44h remains an estimate.

(g) Owner rulings: no explicit reversal found. §12 preserves first-shipped gate, rows eventual format, indefinite WORN, eventual Equipped wording/order, whole-row flag, retained storage key, inventory module and excluded #518. Gaps concern sequencing/parity, not authority to reopen rulings. §10.1:338/receipt:119 saying c alone touches frozen artifacts conflicts with d golden edits; §12:358 correctly says two releases.

Metrics/limits: 14 exec/exec_command calls through final stable-TEMP save, no delegation. No start timestamp recorded: elapsed unavailable; tokens unavailable. Focused runtime probe completed. Parent separately reports ALL GREEN 2809 baseline; not this agent's test. Several guessed filenames/glob failed and were corrected by source search. Initial sandbox TEMP save succeeded but sandbox directory vanished before next command; this stable-TEMP copy replaces it. No real saves, live provider calls, full suite or future implementation mutation proofs run by this agent.
