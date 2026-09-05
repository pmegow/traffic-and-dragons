# #334 isolated cache-creation probe — failure and fix receipts, 2026-09-04 PDT

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

## Follow-up fix and isolated retest — server v1.4.1, not deployed

The sections above preserve the original v1.4.0 failure. The owner then requested the fix
before moving the game project out of OneDrive. No project move or production deployment
was performed in this follow-up.

Server fix commit: `2c82d2a` (`traffic-and-dragons-server`, package v1.4.1).

Review: this changes only cold-admission token counting. The documented direct-contents
request contains exactly `stable + CACHE_LAYOUT`, once; it does not count live state, history
or the player's action. Cache-create system instructions, prompt roles, identity hashes,
TTL, bounds, schema and byte-verbatim fallback remain unchanged. This avoids adding a dummy
message or the real conversation solely to satisfy GenerateContentRequest validation.

Regression `token admission counts stable text through valid contents without live history`
first failed on the original implementation: actual `fallback`, expected `cached`. Both server
provider stubs reject missing contents; the regression also rejects the original request
explicitly and pins the corrected count body to the cache-create text. The probe's fake
provider enforces the same missing-field rejection and its request guard pins stable-only
contents before any provider call.

- Server `npm test`: **174 checks passed** (78 + 56 + 13 + 11 + 16).
- `dev/server-proofs/334-gemini-cache.js`: **19 attributed mutations caught** in disposable
  copies, including the original missing-contents request and live/history contamination.
  Every mutated file restored byte-identical; the real server checkout was not sabotaged.
- Game `node dev/run-tests.js`: **ALL GREEN, 2,007 engine assertions plus standalone suites**.
  These are local gate results, not a claim that the separate historical replay CI is green.
- Source uploaded only as an in-memory module to the existing server's separate probe
  process, SHA-256 `46fcef70c90a5cb5a43cabe91c5edeab5ce0dfe17ffd29ad7bd1b0033949a13e`.
  The probe supports `--cache-source-base64=` for this purpose and stamps the bytes it tests.
  Its database remained `:memory:`; the production flag was asserted `0`. No deployed module,
  database or secret file was changed. The key stayed inside the executing environment.

### Live transport receipt

Started 2026-09-05 **05:52:20.225 UTC**, finished **05:52:25.026 UTC**, `gemini-3.7-flash`.
The first SSH attempt found no started VM and executed no probe. A health GET woke the
auto-stopped VM and returned 200 before the successful SSH execution.

| Operation | HTTP | Result |
|---|---|---|
| countTokens | 200 | 9,769 tokens, 231 ms |
| cachedContents create | 200 | 9,769 tokens, 509 ms; expiry 06:52:20.592060370 UTC |
| Generation 1 | 200 | Fixed marker RIVET-334, Blue Workshop, turn 1; 2,110 ms |
| Generation 2, reconstructed manager / same handle | 200 | Fixed marker RIVET-334, Amber Observatory, turn 2; 1,668 ms |
| DELETE owned test cache | 200 | 184 ms |
| GET deleted cache | 403 | "CachedContent not found (or permission denied)", 83 ms |

Both generations reported promptTokenCount **9,797**, cachedContentTokenCount **9,769**,
candidatesTokenCount **33**, finishReason **STOP**. Their thoughtsTokenCount was 90 / 61 and
totalTokenCount 9,920 / 9,891 respectively. Exactly one count, one create and two generations
ran, with no generation retries. Reserved create exposure was **35,168,400 token-seconds**
(9,769 × 3,600), not a storage invoice; cleanup ended the test resource early.

Owned handle: `cachedContents/vcwhijnxf9wow68ajga69ee1ekpaf3e7vwtybq4d`.

### Cleanup verification and honest verdict

The probe exited **1**, despite passing every count/create/reuse/state assertion: its strict
post-delete check expected 404, and Google returned the ambiguous 403 above. Its then-current
error output incorrectly labeled `removed:false` even though DELETE succeeded. The probe
now records deletion acceptance separately from absence verification; it still fails loudly
on an unverified 403 rather than treating any permissions error as proof of deletion.

A separate read-only listing at **2026-09-05 05:53:10.198 UTC** traversed the provider's
cache list to its end (one page, no next page), checked only this exact handle and printed
`found:false`, `productionFlag:"0"`. No other cache data was retained or printed. The test
cache was removed and its absence is independently verified; no further paid generation ran.

**Verdict: the count-request defect is fixed; live 3.7-flash creation, cache-token reporting,
reuse and changed-state transport passed, with cleanup verified separately.** Not a fully
green original probe exit, not a deployment, and not a gameplay drift/cost certification.
Production remains v1.4.0 / schema 5 / cache flag `0`; v1.4.1 deployment, the second allowlisted
model, expiry/renewal, real narrative/secret obedience and total-cost gates remain pending.
