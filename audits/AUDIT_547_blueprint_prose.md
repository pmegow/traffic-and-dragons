# Blueprint prose revision — task 547

Owner approved the game.js normalization change on 2026-10-02. Diagnosis reproduced the screenshot's exact ending: the 836-character example becomes 800 characters ending “in p” through normalizeBlueprint → clampStr. It is a character clamp, not the LLM output-token ceiling.

## Review before implementation

Keep the runtime import caps and their existing tests. Add an explicit authoring mode that preserves full field strings; all Designer normalization paths use it, including file load, AI generation/fixes and local-draft recovery. A single field registry in game.js supplies both runtime clamps and authoring revision limits. No parser, memory, prompt-builder, generator or gameplay call sites are changed.

Revision is separate from normalization and asynchronous. Only overlong fields are sent to the selected authoring model. The request asks for preserved meaning, complete sentences and unchanged names/numbers/conditions; a response must be nonempty, within the character limit and have sentence-ending punctuation. Two attempts maximum. These checks cannot prove semantic fidelity, so originals are retained for comparison.

All candidate revisions are staged; none replace the editor until the entire pass succeeds and the live draft still matches the request. Provider failure, invalid output, cancellation or user edits preserve the full working draft. Identity labels must be shortened manually so a model cannot silently rename cross-referenced entities.

AI generation and completed Apply operations trigger revision. Apply-all keeps its synchronous per-finding merges and revises once after the batch. File loading does not spend model calls. Typed/imported text can use Shorten long text. Save remains nonblocking/offline; an oversized saved draft is explicitly not publish-ready. Library/catalog publishing is blocked until text fits.

Resource scope: one revision job per editor, one field request at a time, at most two attempts per field. A cancelled in-flight request may finish but cannot write. Only the latest pass's original overlong fields are retained in _textOriginal, saved with the local draft and downloadable as JSON, excluded from playable files and LLM review payloads. No accumulating revision history.

## Verification

- Engine assertion red before implementation: authoring amputated the full original.
- Existing runtime-cap and short-field identity assertions remain.
- Seven focused revision checks cover no clipping, failure on a later field, length, sentence endings, identity protection and late cancellation.
- Actual Chrome tests cover the reported 836-character notes in the breakout editor, shortened complete text, invalid revision retention, late manual edits, lossless draft reload and the two-call Apply flow.
- Mutation proofs target the authoring option, unchanged runtime bound, revision gates, lossless load and automatic Apply revision.
- Model responses are deterministic test fixtures; these checks do not claim live model quality or recovery of text already removed from an older file.
- Full gate: 2,592 engine assertions and 93 standalone suites passed before upstream integration. All 48 due mutation batteries passed with no skips; every mutated file restored. Thirteen sample blueprints produced byte-identical default normalization against the baseline.
- Integrated upstream voice-preservation commit 429ad6d7 before shipping; its changes are outside blueprint normalization. Shipping uses Designer v0.58 / engine v1.1113 and reruns the full commit gate on the combined tree.
