# #334 — Gemini stable-half explicit cache (design, 2026-09-04)

Status: owner approved the disabled-flag build on 2026-09-04; implementation follows this design.
Production enablement is not authorized by that approval. The local server environment has no Gemini key, so the
current deployed model/API behavior has not been live-probed here.

## The decision that changes the build

Google's cache resource makes system instructions immutable, and its SDK repository records
rejection of a generate request combining cached content with another system instruction.
The current client concatenates stable and volatile halves into one system instruction.
Reusing only the stable half therefore requires a different prompt-role layout; it is not
byte-verbatim transport caching. Sources: [cache resource](https://ai.google.dev/api/caching),
[reported API restriction](https://github.com/googleapis/python-genai/issues/348).

Recommendation: build a disabled-by-default gateway feature. Cache the stable rules as system
instructions plus one fixed layout directive. Send the changing state in a clearly delimited
message block; the fixed system directive identifies that block as authoritative current engine
state, overriding stale history. This preserves the data but changes its role. Do not claim
behavioral equivalence from string tests; live drift checks must precede enablement.
If the owner retains the existing prompt roles, defer stable-only explicit caching rather than
re-cache the entire changing system prompt on every turn and defeat the intended economics.

## Proposed implementation contract

| Concern | Proposed behavior |
|---|---|
| Scope | Account-mode Gemini gameplay turns only, with a real stable/volatile split. Other providers, BYOK, string overrides and suggestion calls remain byte-verbatim. |
| Client metadata | A versioned stable-prefix length header on the existing vendor-shaped body; the raw body remains a complete valid uncached request. Client never supplies a cache resource name. |
| Rollback | `GEMINI_EXPLICIT_CACHE=0` by default. Disabled/missing metadata sends the original body byte-for-byte. Enable only after live verification. |
| Key | SHA-256 over authenticated user ID, exact model, operator-key fingerprint, exact stable bytes and layout-directive version. No cache sharing between users, models or rotated keys. |
| Durable handles | Dedicated SQLite migration: hash/resource name, expiry, token count, attempt/renewal metadata. No prompt text or API key stored. Persistent handles prevent every cold start creating another billed cache. |
| TTL | 3,600 seconds; renew on use only when less than 15 minutes remain. No idle refresh. A pause over an hour recreates the cache on the next eligible turn. |
| Token floor | Exact provider `countTokens` on a cold candidate, model-specific admission floor (initially conservative 4,096 for the allowlisted 3.7/3.6 models). Provider validation remains authoritative; undersized/unsupported candidates fall back and are negatively cached. |
| Cost bounds | Per-user active-handle and creation-rate limits, a stable-prefix size ceiling, and single-flight cold creation. Expired local entries are swept; replacement deletes only owned cache resources. Failed deletion retains expiry/accounting so orphan storage is not invisible. |
| Authorization | Existing auth, subscription, turn allowance and daily circuit breaker checks precede count/create/renew calls. Reject caller-supplied cachedContent handles on account-mode Gemini. |
| Failure | Cache preparation failure logs an attributable reason and sends the complete original request. Only an explicit cache-not-found/expired rejection permits one uncached retry; ambiguous transport failure or generation timeout never triggers an extra generation. |
| Metering | Preserve actual generation usage, including cachedContentTokenCount. Record cache creates/renewals, cached tokens and TTL exposure separately; storage cost is not free and must not vanish from operator accounting. |

Google documents a default one-hour TTL, TTL-only updates, storage-duration billing and cached
token usage metadata. The advertised approximate 70% reduction is a hypothesis, not an
acceptance result; compare total input savings **and** cache storage charges over real sessions.
[GenerateContent caching guide](https://ai.google.dev/gemini-api/docs/generate-content/caching).

## Required failure-first gates

- Client: BYOK/off path byte identity; exact Unicode prefix split; string overrides excluded;
  provider fallback rungs retain the metadata and remain isolated by model.
- Server: disabled passthrough, no-entitlement zero cache calls, wrong-account/foreign handles,
  short stable content, malformed headers, single-flight concurrency, restart reuse, changed
  stable bytes, model/key rotation, renewal boundaries and bounded cache-creation churn.
- Fallback: count/create/renew errors; explicit stale-handle recovery exactly once; no duplicate
  generation after timeout, network failure or unrelated 4xx; metering truthful across retries.
- Prompt layout: stable rules remain system instructions, current state appears exactly once,
  no volatile bytes enter the cached resource, full original body survives as fallback.
- Live: one throwaway campaign on each allowlisted Gemini model; paired before/after state and
  secret-gate checks, cached-token receipt, subsequent-turn reuse, expired-handle recovery and
  total-cost observation. Keep the feature off until this evidence exists.

Deployment is separate from committing: the server already contains undeployed schema-v3/v4
work. Review that deployment bundle, take the required backup, then verify login/load and cache
behavior. Do not deploy an older schema reader against a migrated production volume.
