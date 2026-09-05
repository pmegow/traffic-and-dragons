# #334 isolated cache-creation probe — FAIL, 2026-09-04 PDT

Owner approved one temporary Gemini cache and two test generations, with production caching
off and no live campaign changes. The probe stopped on its first provider operation: no cache
was created and neither generation was attempted. This is a live integration failure, not a
successful cache/reuse test or an approval to enable production caching.

## Isolation and reproduction

- Executed 2026-09-05 05:30:22 UTC against the deployed v1.4.0 `gemini-cache.js`, model
  `gemini-3.7-flash`, in a separate SSH-launched Node process on the existing server.
- `GEMINI_EXPLICIT_CACHE=0` was asserted before execution. The probe did not change any
  environment setting, server file, deployment or production database. Its cache manager
  used a new `:memory:` database and fictional `isolated_probe_334` user only.
- The existing Gemini key stayed in the executing environment; it was neither copied nor
  printed. The supplied prompts were an invented catalog and two room/turn test states.
- [One-off probe source](../testRuns/probe334_cache_20260904.mjs). Explicit mode required;
  one count, one create, at most two generations, no generation retry, owned-handle-only
  cleanup plus a subsequent GET check. Run with `TND_PROBE_SERVER_ROOT` pointing to the
  server checkout and `--dry-run` for the non-network harness check. Live mode additionally
  requires an existing Gemini key and the production flag to be exactly `0`.
- The dry run passed setup, two changed-state responses, reuse, and cleanup. Like the earlier
  server tests, its fake provider did not validate the real count-request schema. It is a
  harness check, not independent evidence that the vendor accepts that request.

## Live receipt

Request: `POST /v1beta/models/gemini-3.7-flash:countTokens`.
HTTP 400 after 183 ms; exact provider error:

```text
* CountTokensRequest.generate_content_request.contents: contents is not specified
```

The deployed request shape is:

```json
{"generateContentRequest":{"model":"models/gemini-3.7-flash","systemInstruction":{"parts":[{"text":"<stable text plus fixed layout directive>"}]}}}
```

`gemini-cache.js:72` supplies system instructions but omits the `contents` required by this
live `generateContentRequest` validation. The manager caught the HTTP failure, logged it and
returned `status:"fallback"` with the original request. The probe then failed its assertion
that preparation must return `cached`; it deliberately did not spend a generation on fallback.

Counts: count **1**, create **0**, generate **0**, delete **0**, inspect **0**. No cache resource
or storage exposure was created, and there was nothing to delete. The in-memory event table
contained only a candidate entry (zero tokens/token-seconds); it vanished when the process ended.

## Why the green tests missed it / next gate

Both `test-gemini-cache.mjs` and `test-gemini-gateway.mjs` return a canned token count without
checking whether `generateContentRequest.contents` exists. The mocks accepted the invalid
shape. The [official countTokens reference](https://ai.google.dev/api/tokens) distinguishes
the direct contents form from the overall GenerateContentRequest form; the actual response
above is the decisive evidence for the failed payload.

Before retrying: add a regression that rejects this exact payload, correct the stable-only
count request without introducing volatile state into cache admission, prove the guarding
test by sabotage, rerun the full server suite, then repeat the isolated live probe. No
production code fix or redeployment was performed in this verification turn.

Cache creation acceptance, actual cached-token usage, reuse, expiry/renewal, narrative drift,
secret obedience and total-cost savings all remain unverified. Production caching stays off.
