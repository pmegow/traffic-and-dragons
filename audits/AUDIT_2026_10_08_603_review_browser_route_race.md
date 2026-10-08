# #603 browser review test: request-arrival race

Date: 2026-10-08. Scope: verification tooling only.

## Cause and failure condition

The redraft fixture reused one `release` resolver across four intercepted requests. The test waited for the Redraft button to become disabled, but that browser state is set before the interception callback necessarily runs. A later click could therefore call the previous request's already-fulfilled resolver. The new request then installed a resolver nobody would call, leaving the expected draft update pending. This explains the intermittent line 77 failure without changing the application.

The unchanged ee60011f CI retry (run 37853339721) passed, as did the browser step in the subsequent release run. Those successes do not invalidate the race: the failure requires delayed route arrival.

## Failure-first evidence

Scratch probes compile the immutable ee60011f test with its original filename and module lookup paths, using the actual browser/server fixture. They change scheduling and logging only, isolate the redraft check, and shorten the expected failing wait to 2 seconds.

- `%TEMP%/tnd-603-route-arrival-red.cjs` and `.log`: delay request 2 until the old resolver is called again. The trace releases request 1 twice before request 2 arrives; the late-edit status assertion times out.
- `%TEMP%/tnd-603-route-fourth-red.cjs` and `.log`: delay request 4 until the old resolver is called again. The trace is `ARRIVED 1 / RELEASE 1`, `ARRIVED 2 / RELEASE 2`, `ARRIVED 3 / RELEASE 3`, then `RELEASE request 3 call 4` before `ARRIVED request 4`. The original `startsWith('Astra fixture:')` assertion fails at test line 77. Exit status 1.

The first deterministic reproduction preceded the tracked test edit. The fourth-request reproduction additionally pins the exact CI failure location.

## Correction

Each click prepares its own ticket containing the route-arrival notification and the held response's release resolver. The shared `startRedraft` helper preserves the disabled-button check, then waits for that ticket's actual route arrival before returning its resolver. The callback consumes the ticket and awaits its own held response. A missing route fails with an attributable arrival timeout; the timeout timer is cleared in `finally`.

All four redraft operations use this boundary. The existing call-count, replacement, decision, undo, late-edit preservation, error preservation, reload, Save and disk-content assertions remain unchanged. No production code or test timeout was relaxed, and no artificial delay was added to the tracked test.

## Verification

- Normal actual browser suite: all 16 checks pass.
- `%TEMP%/tnd-603-route-delayed-green.cjs` and `.log`: the final source runs the complete browser suite with a 250 ms delay before each of the four redraft route callbacks captures its ticket. All 16 checks pass, exit status 0. The trace records each request's own arrival before its release, including request 4.
- Test traffic is intercepted; no paid Astra calls or personal campaign saves are used. Existing scratch-directory cleanup remains intact. Tickets are per request; there is no accumulating registry, and arrival timers are cleared.
- Runtime, version/cache markers, TODO and release records are outside this change. The parent owns the mandatory commit gate and shipping.

Independent review: astra_nine_review APPROVED the final change after inspecting the immutable delayed-fourth-request red probe and complete delayed-green log. The reviewer confirmed the stale request 3 release, all four request-owned arrival/release pairs, all 16 passing checks, preserved original assertions, and no need for a runtime correction.

The exact fourth-request reproduction and delayed-route proof are retained in [the receipt folder](verification-next-ten-2026-10-08/review-603/). The scripts preserve the historical machine path used for these receipts.
