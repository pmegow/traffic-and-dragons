# #545 browser fixture follow-up

CI run 37855518657 passed Catalog, then failed at My Library because `accept545` read a null pending blueprint. This follow-up changes only the browser test and its evidence.

## Cause and reproduction

The blueprint button listener and `_applyBlueprint` are synchronous. The trusted CDP click uses the button center without checking whether another element covers it. After Catalog starts its synthetic campaign, real sticky notifications remain above the modal at z-index 10000. At an explicit 800×600 viewport, the Camp saved notification covers My Library's Use this blueprint button center. `elementFromPoint` identifies the toast; the trusted click dismisses it instead of selecting the blueprint. The next engine helper therefore reads null.

The old test passed with the local default viewport. Pinning 800×600 reproduced the same Catalog-pass / Library-null failure with normal production notification timing, without delaying any callback or changing product code. The [red screenshot](verification-next-ten-2026-10-08/stores-545/browser-followup/library-before.png) was visually inspected and confirms the overlap. This establishes the mechanism without assuming the CI runner's unrecorded viewport dimensions.

## Correction and proof

The test pins the failure viewport, clicks notifications through their real dismissal listeners, and waits for actual removal after the existing fade. It does not remove nodes directly, force-click the blueprint button, or add a fixed sleep. It checks that no prior blueprint remains, verifies the button center is the actual hit target, performs the trusted click, and checks the expected name, starting location, NPC and arc before every existing start/tag/prompt assertion.

The corrected test passes Catalog, My Library, Import File, Home handoff, Quick Start, Designer load/render/validation and character-editor admission. The [green screenshot](verification-next-ten-2026-10-08/stores-545/browser-followup/library-after.png) was visually inspected: the button is unobstructed. Removing only dismissal and its wait in a frozen negative probe fails specifically at “library blueprint button is occluded” after Catalog passes.

The receipt directory retains red and green probes, logs, screenshots, the dismissal mutant and hashes. From the repository root:

```powershell
node audits/verification-next-ten-2026-10-08/stores-545/browser-followup/red-probe.js
node audits/verification-next-ten-2026-10-08/stores-545/browser-followup/green-probe.js
node audits/verification-next-ten-2026-10-08/stores-545/browser-followup/dismissal-mutant.js
```

Red and mutant runs are expected to exit nonzero at the failures described above. The optional first argument selects another checkout. All data is synthetic; local assets and remote responses are intercepted and storage is disposable.

## Review and resources

Independent critical pre-review and final post-review approved this fixture-only correction. The reviewer independently ran the corrected browser test successfully, reproduced the named occlusion failure with the dismissal mutant, and visually inspected both screenshots. Only focused browser/probe checks were run here; the parent owns the commit hook and CI rerun. Per call/turn/session, the added checks retain no state and dismissal uses the existing bounded fade timer. Per campaign/device, no production data, storage key, cache or listener is added. No production file, task status or release marker was changed.
