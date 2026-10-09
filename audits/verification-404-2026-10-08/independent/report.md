# Independent review — TODO #404

**APPROVE.** Reviewed frozen baseline 02f4fa51 against the four final runtime files listed in receipt.json. No repository edits by this reviewer.

Baseline actual-engine probes reproduced lost added-provider credentials, imported male gender not recognized (and rendered Female), non-idempotent compact Speechify traits, excessive raw catalog persistence, queued ready timers, and finished cloud closure retention. Valid PCM followed by a controlled AudioBuffer allocation failure establishes closure reachability; invalid PCM transport data was not used to claim it. #456 had already removed the original throwing two-provider sheet map and literal Speechify map write; remaining Piper dispatch was reviewed as metadata conversion. Dead provider hint declarations are gone.

Final verification: **2046 independent assertions** (8 registry/rollback, 245 exact catalog, 703 cache/isolation, 1090 lifecycle) pass. The catalog probe compares every ID/order/label/gender/note/language and both present/missing cast pins for 8,000 actors over 30 fresh-module save/reload cycles. Canonical output remains 868,547 JavaScript code units / 876,547 UTF8 bytes; Unicode boundaries avoid splitting surrogate pairs. Oversized Save performs zero writes. This is a voice-settings budget, not a guarantee the entire origin has free localStorage quota.

Real disposable Chrome: 70 ready/destroy cycles over 35,847 ms before left 58 timers; 70 cycles over 35,996 ms after leave 0 timers and 0 frames. Screenshots final-gender-settings.png and final-gender-phone.png visibly show Deep reader · Male at 800×600 and 390×844; baseline-detail-settings.png shows the incorrect Female. Images inspected.

Two new recovery regressions found during review were repaired. An invalid inactive catalog now allows the modal to open and reports its provider; explicit refresh succeeds and Cancel retains exact stored bytes. With no provider key, explicit draft-only Clear cached catalog then local Save preserves narrator/cast pins. Individually valid banks above the aggregate budget have the same usable control; clearing one bank retains the other 4,000 actors and pins, saving 583,024 code units. A pending refresh is aborted and its late result cannot resurrect the cleared bank.

Performance: 4,000-actor pin lookup over 8 batches of 100 calls measured baseline 8–11 ms; uncached projection 49–60 ms; final bounded cache 24–29 ms. Sampled forced-GC heaps plateau around 13.10 MB baseline and 14.21 MB final. Cache replacement/isolation passes 100 imports, retained entries stay at the two registered remote models; there is no user-facing dynamic provider registration/removal lifecycle. Cost is acceptable for these bounded lookups.

Monotonic resources: per-call ready timers/RPC callbacks close; per-read cloud abort closes on no-audio completion; per-session projection caches replace one source/value per registered remote model and returned objects cannot mutate them; campaign actor fields remain unchanged; per-device settings have a 1,048,576-code-unit cap and atomic refusal/rollback. Unknown actor payload is projected away; legal actor IDs are never truncated or silently dropped.

Reproduce from repository root with node on registry.js, catalog-final.js, cache-final.js and lifecycle-final.js in this directory; performance.js requires --expose-gc. Browser scripts use a disposable CDP profile and block foreign requests; browser-final.js and browser-clear.js take the absolute current tts.js path. receipt.json enumerates source hashes and shareable synthetic/public artifacts.

Limits: no real provider audio, no WASM/phone heap claim, no full suite. The preexisting all-decode-failed audition native fallback remains outside this closure-cleanup change.
