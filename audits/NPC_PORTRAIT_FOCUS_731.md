# NPC portrait focus and shared material cues (#731)

Designer v0.71; engine v1.1396; cache tnd-v3-20261111c.

The NPC portrait builder lacked the creature builder's lens/depth-of-field guidance. Separately, `generatePortraitImage` appended the global `IMG_STYLE_SUFFIX`, which prescribed leather, cloth, skin pores and fabric weave even for an authored tree-shaped being.

The requested changes are narrow: Designer NPC portraits now append the same 55mm/f1.8 instruction through `DesignerCreatures.portraitFocus(subject)`, using “character” in its subject references. Creature prompts use “creature” and remain byte-identical before the shared image suffix. The exact phrase “ultra-detailed leather and cloth textures, realistic skin pores and fabric weave” was removed from the shared suffix, affecting every image path that uses it. Authored material descriptions are never removed or rewritten. The suffix still appends only once.

NPC names, role, pronouns and notes are retained. Private secrets and abilities remain excluded. Creature names remain excluded. No gameplay prompts, schema, campaign data or existing portraits are changed. Refresh the app and generate a portrait to use the changes.

## Explicit test-contract change

At the owner's request, the old #729 browser assertion forbidding lens instructions on NPC portraits was deliberately replaced. It now requires at least one actual NPC request, exactly one 55mm/f1.8 clause, and blurred-background wording on every such request. This is an intentional behavior change, not an assertion removed to hide a failure. The separate NPC-name and privacy assertions remain. No frozen hash was rebaselined.

## Verification

- Independent pre-review approved shared focus wording, retained identity/privacy, suffix idempotence and a nonempty outgoing NPC request set. Independent post-review approved the diff and independently passed two engine assertions, 26 creature test groups and the actual browser request suite.
- Failure first: the style guard caught the unwanted material phrase; the NPC unit and actual outgoing-body guards caught the missing lens instruction. An initial test regex escaping typo was corrected before accepting those attributed red results.
- Final targeted checks: two #731 engine assertions, all 26 creature groups, and the real Designer browser suite pass. The engine checks also preserve explicit author-written skin/fabric descriptions and suffix idempotence.
- All five #731 deliberate mutations were caught by their named assertions. All four existing #729 creature-focus mutations were re-proven. Every mutated file was restored byte-identically. The existing browser workflow entry runs the extended request assertions in CI and the mandatory pre-push gate.
- `testRuns/portrait-731/build-requests.cjs` assembled requests with the actual NPC prompt, `withImgStyle`, model registry and `portraitRenderBody`. It also compared both raw creature prompt branches before/after and required byte identity.
- Four authorized paid calls succeeded: before and after on GPT Image 2.5 Flare and GPT Image 2.6 Sunburst. They use the shipped Willow Mother NPC notes, 3:4 portrait output, and each model's existing defaults. Requests and receipts are in ignored `testRuns/portrait-731/`.
- Visual inspection: both after images have visibly softer backgrounds and clearer subject separation. Both still interpret the Willow Mother as a clothed humanoid; this limited comparison does **not** establish that deleting the material phrase alone yields the tree-bodied interpretation in the owner's ChatGPT example. The remaining NPC “appearance and clothing” instruction and other unchanged art direction were not altered in this task. No seed-controlled causal claim is made.

No retained state, queue or resource growth is added: the shared function constructs a prompt string per request. Full engine/standalone and browser gates remain mandatory at commit/push, followed by a live version, asset-byte and prompt check.
