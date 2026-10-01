# Server v1.7.1 deployment — the Gemini explicit cache is ON again (2026-09-30 PDT)

A mirror of the server repo's `DEPLOY_1.7.1_2026-09-30.md` (commits `517bc54` and `96f2d7a`), kept here because the game's docs caused the mistake it corrects.

**Owner ruling 2026-09-30, on #334:** "Turn it on, I think gemini is going to end up being our go to."

## What had happened

| Date | Event |
|---|---|
| 2026-09-06 | The cache is enabled by owner-authorized rollout (server v1.4.1). |
| 2026-09-08 | v1.5.0 deploys with the flag at `1`. |
| 2026-09-10 | **v1.5.1 deploys with `--env GEMINI_EXPLICIT_CACHE=0`.** Its receipt says "Gemini explicit caching stays disabled". It was enabled. |
| 2026-09-24 | v1.5.3 finds the flag empty and pins `"0"` into `fly.toml`. |
| 2026-09-30 | v1.7.0 ships with that pin. The playtest that day reads 0 cached tokens on 11 turn calls. |

So account-mode Gemini turns paid full input price for twenty days, and nothing failed.

**Root cause.** Two game docs still said the cache was off after the rollout: `DOC/contracts/prompt.md` ("the flag is off and live enablement is pending") and `DOC/DESIGN_334_gemini_explicit_cache.md` ("Production remains v1.4.0 with flag 0"). A deployer believed them. Nothing compared the deployed switch with the owner's ruling. And the game's health dot judged the prompt cache for Anthropic only, so a dead Gemini cache showed as "not enough calls to judge".

## What changed

- **Server `fly.toml`:** `[env]` pins `GEMINI_EXPLICIT_CACHE = "1"`. It is the one switch; a deploy passes no `--env` for it.
- **Server `test-deploy-config.mjs`** (new, in `npm test` and CI): the pin is `"1"` exactly once inside `[env]`, `gateway.js` still enables on that exact string, and the README's deploy command carries no flag. It failed first on the `"0"`, and it names nine broken inputs.
- **Game docs:** the prompt contract and the design doc now state the live state and point at the server's pin as the one source of truth; `dev/check-doc-facts.js` keeps the "pending" sentence from coming back.

## The deploy

- Backup: [off-Fly backup run 36819723137](https://github.com/pmegow/traffic-and-dragons-server/actions/runs/36819723137), success; volume snapshot `vs_2PAK3P8DLa0hxjnXlqQB`.
- CI: [run 36819695414](https://github.com/pmegow/traffic-and-dragons-server/actions/runs/36819695414), green.
- Command: `flyctl deploy --app traffic-and-dragons-server --ha=false --remote-only --wait-timeout 180s`, from a clean checkout of `517bc54`.
- Fly release v51, machine `48ee379bd62728`, schema v7 (no change).
- Postflight: `/health` 200; unauthenticated `/api/account` 401; the machine config and the running process both read `GEMINI_EXPLICIT_CACHE=1`; `/app/package.json` says 1.7.1.

## Live verification

[The cache-on playtest](AUDIT_playtest_v11078_gemini37_cache.md), on the same campaign as the flag-off run an hour earlier:

- One handle was created on the first call (server receipt: one `candidate`, one `create`, 13,614 tokens).
- All 20 cache-on turn calls, across two campaigns, read 13,614 cached tokens each. The server's usage rows for the evening: 31 turn calls, 582,534 input tokens, 272,280 cached.
- In the 10-turn run, 72% of the turn input came from the cache (149,754 of 208,026 tokens). The flag-off run: 0 of 206,741.
- The prose voice, the buttons and the invariants matched the baseline.

## Not measured

The invoice. The game's dollar readout prices cached Gemini tokens at the full input rate, so it shows no saving. Storage is billed per handle-hour; one handle serves every campaign of an account.

## Rollback

An owner ruling, then `"0"` in the server's `fly.toml` together with `test-deploy-config.mjs`, and a plain deploy.
