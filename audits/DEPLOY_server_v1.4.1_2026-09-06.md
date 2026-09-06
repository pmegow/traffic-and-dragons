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

## Expiry → recreate verification (2026-09-06 16:02 UTC, read-only)

After the owner played two more turns (Runelords t2436–t2437) ten hours later:

| Table | Finding |
|---|---|
| `gemini_prompt_caches` | still ONE row — the 05:21 handle expired at 06:21 UTC and was replaced in place; new handle 13,520 tokens, created 15:54:45 UTC, expires 16:54:45 UTC; no orphans |
| `gemini_cache_events` 3–4 | `candidate` → `create` ok at 15:54:45 UTC under the SAME `key_hash` as the 05:21 create — the stable half was byte-identical across the whole night's play |
| `usage_events` 857–858 | both turns read `cache_read` 13,520 (`tok_in` 32.3k / 32.4k, status 200); every turn since the flip (845–858, ten turns) read the full stable half |

Verdict: the expiry gate is closed — an expired handle is recreated cleanly on the next turn, one owned handle at a time.

The on-use RENEWAL is a separate path and has not fired, by design: `RENEW_MS` (15 min) only runs it when a turn lands inside the last fifteen minutes of a handle's life, and the 05:21 handle's turns all landed 39–49 minutes before expiry. A turn between 16:39 and 16:54 UTC on the current handle (or the same window on a later one) exercises it.

Break-even on PUBLISHED Flash rates (assumption — 3.7-flash billed like 2.5-flash: input $0.30/M, cached $0.03/M, storage $1.00/M-tokens/hour):

| Quantity | Value |
|---|---|
| Storage per handle-hour (13,520 tokens) | ≈ $0.0135 |
| Input saved per turn | ≈ $0.0037 |
| Turns per handle-hour to break even | ≈ 3.7 |
| Window 1 (05:21 handle, 8 turns) | ≈ +$0.016 net |
| Window 2 (15:54 handle, 2 turns so far) | ≈ −$0.006 net unless two more turns land before 16:54 |

The cache pays when a sitting runs four or more turns inside an hour and loses a fraction of a cent on a one- or two-turn session. The invoice must confirm the storage rate before the total-cost gate closes.

## Still open on #334

Second model, gameplay drift and secret obedience over a session with the cache live, expiry and
renewal behaviour, and the total-cost gate. Rollback is one machine update with the flag at 0.
