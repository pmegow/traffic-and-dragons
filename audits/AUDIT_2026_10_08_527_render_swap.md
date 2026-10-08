# #527(21): campaign-owned renders with captured subjects

Baseline 36f1d2a9 / v1.1185. Scope is the render job and its Save/Portrait continuation ownership. Root owns markers, TODO, mandatory full gate and shipping.

## Mechanism

_renderJobLive included the hero name, so a Village hero swap incorrectly discarded a scene even though its campaign stayed loaded. Merely removing that comparison would mix subjects: after the writer await, collectRenderSeeds read the live hero and shallow party objects, while the request described the old cast. Portrait also wrote worldState.character at its final compression callback; Save chose its filename and campaign writer after an unchecked fetch.

The scene now checks campaign identity. Before the writer await, doRender detaches the hero and selected party through one JSON snapshot; request, portrait references and reference legend share it. Historical party selection occurs before detachment and retains noHistory/frame context. Portrait captures the selected sheet at click time and checks campaign plus object identity at final compression before writing; a deliberate later click can choose the new hero. Save rechecks after blob completion and before its failure fallback. The real saveRenderImage funnel captures the same campaign identity and rechecks after folder permission, folder completion and share completion; explicit campaign arguments bind the file destination. An already-started write may finish in the original folder, with a receipt naming that actual folder, but it cannot record a pointer in the newly loaded campaign. Cancellation remains visible, and the render finally and Portrait completion restore their latches.

Independent Astra pre-review approved this design and the downstream save extension. Final post-review APPROVE: the 19 async cases pass, with 8 independent permission-race/same-campaign/unchanged-control assertions. The previously reported downstream blocker is resolved.

## Failure-first evidence

The real doRender and actual DOM toolbar listeners run with deferred transports, DOM/FileReader stubs and no paid requests. Before runtime edits, six new cases failed while all five existing #440 cases passed: hero swap at writer, hero swap at image, in-place portrait changes, actor swap during compression, campaign switch during compression, and Save campaign switch during blob. An initial test insertion landed inside the test-registration helper and threw; that test-only harness error was corrected before recording the six actual failures or editing runtime.

Final expanded suite: 19/19 pass. Independent review found a downstream Save gap after the initial 14 passed: deferred permission could write a pointer into the newly loaded campaign. Three additional actual save-funnel cases failed before ui-files.js changes, then passed; controls also exercise actual exportToFolder delayed write, truthful original-folder receipt, both share outcomes and same-campaign hero-swap completion. Additional controls cover historical-frame party/no-history, rejected Save fetch after switch and hero swap during Portrait fetch. Existing cross-campaign prompt/image drops and live Portrait/Save controls remain. No browser screenshots are claimed: this is asynchronous ownership logic exercised through the actual runtime and event callbacks, not a visual-layout change.

New named mutations: game.js 8/8 and ui-files.js 5/5, all caught and disposable clones restored byte-identical. Retained #440 6/6 and #206 5/5 passed. Retained #481 F1 folder proofs: 7/7 passed. Total retained named proofs: 18/18. Existing portrait admission suite: five boundary groups passed. Retained applicability: 2687/2687 clauses across 305 batteries. The #440 always-live mutant anchor is updated equivalently from the old campaign+hero predicate to the campaign predicate; its cross-campaign refusal oracle is unchanged.

## Prompt and resource scope

No stable GM prompt text changes. The image-writer text stays identical for unchanged inputs; the fix freezes which subjects supply later references. No personal saves or paid calls used. Root performs campaign prompt captures separately.

Per-call: one detached character+party snapshot, proportional to the selected sheets, replacing shared mutable references. Per-turn: no persisted state or new lists. Per-session: existing render DOM/callback lifetimes own the snapshot; closing the output releases that job's UI references, and no new global cache/listener/timer is created. Existing elapsed ticker and render finally remain. Per-campaign: no save schema additions or accumulated fields. Per-device: no new storage, workers or network endpoint. Portrait writes occur only for a still-current explicit click target; stale Save work stops before campaign file naming/writing.

Root integration: the Necrotic Dungeon, Village and Long Walk fixture prompts retain byte-identical stable and volatile halves against baseline 5751f292; source saves remain unchanged.
