# #589 — completed by objective acceptance test

The owner asked on 2026-10-08 to devise a test that permits completion and archival where possible. **PASS: #589 is complete.** The former manual punctuation-name check is replaced by actual browser-to-server acceptance testing, backed by read-only deployment identity checks. No taste decision is involved.

## Acceptance proof

`node audits/verification-589-2026-10-08/browser.cjs` runs the real browser modal code and storage adapter against the real authenticated server HTTP routes and SQLite in a disposable local database, using the sanctioned synthetic dev_local account. The server repository defaults to `C:/Projects/traffic-and-dragons-server` (override TND_SERVER_REPO). It requires that repository's installed dependencies and Chrome available to dev/cdp-browser.js.

Four names pass: `(Ammut)`, `Åsa Lindé`, `--Brann--`, and `Plain Control`. Each case verifies server/client slug agreement; Update finds the entry and preserves level; Replace adopts the right inventory/level; neither operation writes upstream; exporting requires confirmation before POST; Cancel preserves the upstream character byte-for-byte; confirmation updates exactly one intended row; cleanup deletes the synthetic row. The final library is empty. Browser page errors: zero. Screenshots of the actual Update, Replace and confirmation dialogs were visually inspected.

A disposable server-source copy restores the original missing `g` flag. It stores `(Ammut)` as `ammut_`, and the **same real UI lookup assertion fails** with the missing-library toast. This is a named failure-condition proof, not merely testing benign names.

The complete four-case test and negative control pass twice: current v1.1194, and v1.1193 served from Git revision 0de4866f2aec79716029138755e44ada2976e973. Set `TND589_DEPLOYED=1` for the latter. Every downloaded client file's hash matches that revision (`deployment/replay-ref-proof.json`). The deployed server's five relevant full source/package files match the server exercised locally. Public deployed slug, library UI and adapter contracts match the current client too. See [deployment evidence](deployment/README.md).

## Honest limits and diagnostic attempts

This does not claim an authenticated production-account test or inspection of current production rows. The server README prohibits automated tests against production accounts. Existing migration/deployment receipts already show the production v7 migration completed; local server tests cover migration collisions and idempotency. Runtime code, production data and account configuration were unchanged.

The first browser attempt passed the first two names, then timed out: accumulated sticky toasts covered the Overwrite button. The screenshot `toast-overlap.png` and elementFromPoint probe confirmed the mechanism. The runner now dismisses existing toasts through their handlers only when they obstruct the button; the library code and assertions are unchanged. A subsequent harness attempt used an unsupported context.close method; cleanup was corrected to browser.close, with a fresh browser for the negative control. Original logs remain in browser.log and browser-retry.log. Final green logs are browser-final.log and deployed-browser.log; machine receipts and screenshots accompany both runs.

Existing client tests: 4/4; named client mutations: 4/4 caught; server tests: 7/7. Full repository commit gate passed ALL GREEN, 2,817 engine assertions. This is verification tooling and documentation only, so no game version bump is required.
