# Server v1.4.1 deployment + Gemini explicit-cache enablement — game-repo mirror

The deployment itself was performed by a parallel session on 2026-09-06 (05:18 UTC deploy, 05:21 UTC
flag flip) under owner authorization; its full receipt lives in the server repo as
`DEPLOY_1.4.1_2026-09-05.md` (committed 2026-09-06). This file is the game-side pointer plus the
post-enable verification done from this checkout.

## What is live

- Fly release 43, machine `48ee379bd62728`, volume `vol_re15k01g06675pl4`, package v1.4.1, schema 5.
- `GEMINI_EXPLICIT_CACHE=1` — a machine-level override, not a code default. Any future
  `flyctl deploy` must pass the intended value explicitly and verify the runtime afterward.
- Recovery points before the change: nightly backup run 33960982117 (2026-09-05 10:33 UTC) and
  Fly snapshot `vs_2PAK3P8DLa0h4a93P19` (2026-09-06 05:17 UTC, five-day retention).

## Post-enable verification (2026-09-06 06:10 UTC, read-only over `flyctl ssh console`)

| Table | Finding |
|---|---|
| `gemini_prompt_caches` | one handle, `gemini-3.7-flash`, 13,520 tokens, created 05:21:49 UTC, expires +1h |
| `gemini_cache_events` | `candidate` → `create` ok at 05:21:49 UTC, 13,520 tokens |
| `usage_events` 851–856 | four `turn` calls 05:37–05:42 UTC, each `cache_read` 13,520, `tok_in` 31.7k–33.9k, status 200; `summarize`/`era` read no cache (expected) |

Verdict: created once, reused on every subsequent turn — the receipt the rollout asked for.

## Measurements that change the picture

- The cached share is the stable half only: ≈30% of a ≈45k-token request, not the ≈70% the
  design row projected. This campaign's volatile half (party block, memory, quests, recent
  exchanges) is larger than its stable half. The cost estimate in the 2026-09-05 Runelords
  comparison ("≈$18 with the cache on") assumed the 70% figure and should read closer to $38–40.
- After four reuses inside the hour, `updated_ms` still equals the creation time: the on-use
  renewal has not been observed yet. The expiry/renewal gate stays open until a turn lands after
  06:21 UTC and the handle either renews or is recreated cleanly.

## Still open on #334

Second model, gameplay drift and secret obedience over a session with the cache live, expiry and
renewal behaviour, and the total-cost gate. Rollback is one machine update with the flag at 0.
