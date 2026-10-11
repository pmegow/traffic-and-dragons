# Identity acceptance — #504, #530, #531 (2026-10-10)

Senior reviewer: Astra; frozen runtime `08faa2c45b09d00f92d767ee8c78ddea2cc7d3fb`, v1.1220 (includes the mirror implementation shipped at v1.1214). Synthetic fixtures only; no production-account access, runtime edits, tracker edits or commits by this reviewer. Read the current task rows, identity contract, both title-question audit records and the previous independent acceptance record. Applied the repository fable-review workflow for adjudication and playtest skill for live-test safety.

**Verdict: deterministic failure-condition acceptance PASS; completion remains pending the actual live-GM decision gate.** This is behavioral integration, not taste. #534 direction 5 and the 2026-10-07 audit require a real model to answer the delivered collision note and require #504/#530/#531/#534 to close together. The current user asks to replace subjective observation waits with tests; that does not make a scripted reply an actual model response. If the prepared live cases pass, the deterministic evidence below supports closing the three requested rows and their umbrella #534.

## Objective contract and mechanism

The original forward ambiguity must create an independent Queen record while protecting Wilhelmina; the new mirror ambiguity must create an independent Wilhelmina while protecting the Queen. Exact SAME must merge with alias continuity; ANOTHER must preserve separate records and settle the question. Active scene references must not discard a valid new-person answer (#530). Reported death, prior-turn bound/revealed scene death and combat presence must reach the called person, with a positive assertion that the intended death/presence actually happened (#531). Same-turn death evidence must still refuse. A settled question must stop reappearing.

The current single resolver returns the questioned name itself; post-handler stamping keeps its natural key; `npcMergeAnswer` supplies the same exact reading to gate and handler. The mirror branch asks using the existing record's title and refuses to form a second question of an open provisional.

## Executed evidence

| Check | Observed result |
|---|---|
| Prior independent `acceptance.cjs` | 14/14 pass, including ANOTHER/OTHER with and without scene refs, positive actual queen deaths, combat presence, same-turn refusal and 100 settled repeats |
| Prior `entry38-objective.cjs` | 13/13 pass: nine initial routes, summary extraction, case/alias control, refusal recovery, pure fixed-input resolution at 200 NPCs |
| `node dev/run-tests.js "#504"` | FILTERED GREEN; one section, 20 assertions; explicitly not the full suite |
| New `independent.cjs` | 10/10 pass: forward/mirror SAME, keep-name ANOTHER, new-name ANOTHER; mirror reported death, bound/revealed prior-turn death and combat presence |
| Prior `prove.cjs` | 5/5 attributed scratch mutations caught: ANOTHER gate, OTHER proposal, binding, combat presence, title resolver |
| New `prove-new.cjs` | 2/2 attributed scratch mutations caught by named independent assertions: disabled mirror question and ignored resolver question |
| `dev/sabotage-504-title-question.js` | 61/61 clauses proven, scratch sources restored byte-identical |
| Fuzzer seeds 4242/7-swap/99-swap/31337-swap | 4,000 + 2,000 + 6,000 + 4,000 = 16,000 sequences; zero distinct violations |
| Replay v1238/v1258/v1271/v1276 | All four committed end states match; exit 0 |
| Prepared browser setup, four directions/decisions | Genuine note registry delivers NAME COLLISION; full prompt builds (51,550 stable / 4,007 volatile chars each). This is a setup smoke check, not a live-model pass. |

`run-existing.cjs` preserves actual stdout/stderr in separate UTF-8 logs and execution statuses/timings in `summary.json`. The new independent and mutation logs and four replay logs are alongside this report. No assertion, source pin, golden, replay baseline or runtime was loosened.

## Initial unsuccessful checks

The first two mutation executions were blocked before any mutation by Git `.git/config: Permission denied` in sandbox temporary clones. Re-running with approved escalated scratch execution succeeded; no denied action was bypassed and no product failure is inferred from the setup error.

The first new independent runner was 7/10: direct scene bind/reveal and combat start do not create NPC records, so its death/presence positive assertions dereferenced missing records. `independent-initial.log` retains those failures and the actual handles, which already pointed at the correct new name. Corrected fixture stages the arriving person through `[NPC_NOTE:]` before those three positive-control checks, exactly as the previously validated forward scenario does. All actual death and presence assertions remain intact. No runtime code changed.

## Remaining live protocol and provider discovery

`live-fixture.json` holds one minimal synthetic world with a healed row inventory. Install `live-browser.js` in an isolated signed-out visible preview, then call `__identityAcceptanceInstall(fixture)`. For each pair `(mirror,same)` in `(false,true)`, `(false,false)`, `(true,true)`, `(true,false)`, call `.prepare(mirror,same)` and await `.run()`. Persist `__identityAcceptance.output` after every case.

The driver refuses signed-in or server routes, never returns a credential, stages the collision via real `applyMuts`, obtains the note from real `buildEngineNotes`, supplies clear synthetic story context, calls unmodified `callGM` with normal `buildSysPrompt`, and parses the actual returned response with `applyMuts`. It checks the exact SAME/ANOTHER tag, final identities/aliases and no later repeated collision note. It creates no saved campaign. A network error, omitted/incorrect answer, unresolved provisional or wrong identity is a failing/incomplete live case, never a pass.

Oct9 is newer than the old missing-provider record: `DOC/todos_completed/todo_599_status_history.md:30,42` records an owner-configured Gemini key in a signed-out preview and real gemini-3.8-flash turns. Parent's fresh read-only metadata check found no available preview tool, expected listener or browser CDP port today. Existing permission to use that safe isolated path persists, but no secret is searched for, read, copied or pasted; the playtest skill requires the owner to configure a visible preview if absent. Parent owns the live receipt and final adjudication after its result.

## Resource scope

Pure resolution leaves world/memory byte-identical after 5,000 calls plus warmups at 200 NPCs. Fixed settled decisions re-fire no collision note and add no merge-archive entries. Open questions remain capped. Historical cooldown/name-pair dictionaries and accepted-merge preimages retain O(history) data by existing design; no false claim of a global lifetime cap. This test adds no persistent production state, workers, caches or wasm realms. No unrelated audio/device soak is claimed.

## Senior adjudication: delegated #518

**FAIL — leave #518 open.** Independently reran the delegated ledger probe on the same frozen runtime: 47 passed / 2 failed, exit 1 (`senior-ledger.log`). Original examples pass, but these valid transfer boundaries lose inventory:

1. Hero has Torch qty3; `[ITEM_LOST:Torch x3][COMPANION_ITEM_GAINED:Absent|Torch x3]` leaves Torch qty1. `tag_table.js:1682` restores one `ilHits` unit on the missing-companion branch and continues; it neither restores the whole count nor carries all detached row fragments.
2. Hero has Torch qty1; two adjacent `[ITEM_LOST:Torch][COMPANION_ITEM_GAINED:Bram|Torch]` pairs leave both inventories empty. `tag_table.js:550-551` first records a successful hit then a shared block-level miss; `:1681` consults that miss and withholds both gains, losing the successful unit.

These are conservation failures within the retained two-tag protocol. They do not reopen taste or the owner's decision to retain paired tags. The review requests no runtime fix in this acceptance-only work.

## Senior adjudication: delegated #434 and #552

**Objective mechanisms PASS; leave both rows open under the user's taste exception.** Independently reran `persona/probe.cjs`: 16/16 checks, exit 0; `senior-persona.log` retains stdout. Spot-checked the complete task rows and delegate source: own-speaker capture, 2/3 threshold, hero exclusion, detached carried data, fresh admission, both campaign kinds, presence/absence serving and stable-byte behavior are exercised through shipping functions. The delegate separately records the editor, intercepted library adapter, rendered screenshots and attributed batteries; parent owns actual isolated-server transport proof.

#434 explicitly still asks the owner to author Nyla's foulmouthed/feral register, select a memory reset and talk with her. That is owner canon and desired characterization. #552 still asks the owner to listen to a familiar resident after export/import and judge the remembered voice. Correctly preserving verbatim evidence is objectively testable; desired likeness is a taste judgment. No owner canon was rewritten and no taste verdict is fabricated.

## Senior adjudication: delegated #517

**PASS — eligible to complete/archive after the coordinating full gate.** Read the complete current task row and ledger report and independently reran its 49 probes: all #517 cases pass; the two failures above are separate #518 conservation failures. The current Arrow bundle, per-N want and empty-paid-take failures are tested through actual filing/catalog/plan/application, along with prior mixed sale/buy, plural/unit and compound-price shapes, wanted allowance and atomic-refusal controls. The delegate reports all six attributed batteries green (68 clauses); the senior stdout/state evidence is in `senior-ledger.log`. No taste hold or required actual-model gate is stated for #517. The objective state checks replace its generic ready-to-test-in-play wait.
