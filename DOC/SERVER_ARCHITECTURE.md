# Server architecture — design (UA33, opening with the UA32 survey)

**Status: ✅ RATIFIED (2026-07-11, all §8 decisions walked with the user one-by-one — outcomes
recorded in the §8 table).** Headline outcomes: own private server repo · streaming deferred ·
billing provider DEFERRED to build time (shape identical either way) · **NO FREE TIER at launch**
(paid-only; BYO-key remains the manual try-out path — supersedes this doc's free-tier sketches in
§3.5/§4.2, which are retained as the design for IF one is added later) · paid price/cap set at
build time · hard stop + top-up packs · data-free-forever on lapse · Google login next, magic-link
later, never passwords · **state authority = staged path C** (7a launch doesn't wait · 7b BYO-key
mode survives indefinitely · 7c shadow-parse starts early). UA19 closes as absorbed into §6
Phase 2 per §6.3. The §9 build order stands with one edit: step 3's "free-tier allowance live"
drops out (no free tier).

Sources read for this draft: the live server code (`traffic-and-dragons-server/index.js` + `db.js`
+ `Dockerfile`/`fly.toml`), `storage-adapter.js` (client sync + CAS), `tag_table.js` (the
authoritative parser, portability claims verified), TODO.md ▸ Architecture decisions (Subscription
model · Provider adapter · Server & services shape · JSON-vs-SQLite · Stable entity IDs),
Fable_UberAudit.md rows UA19/UA28/UA32/UA33, Known issues #5 and #7.

---

## 1. UA32 — survey of the existing server (the never-audited surface)

### 1.1 Inventory

> **Survey snapshot (2026-07-11).** The rows below record the PRE-exodus survey; only the **Location** row was updated in place. Since 2026-07-12 the server IS a git repository (remote `pmegow/traffic-and-dragons-server`, see §2 item 3 ✅) at the new path outside OneDrive, so the **Version control**, **Secrets**, and **Local dev artifacts** rows no longer describe the current world (`.env` and the dev database left the OneDrive-synced tree with the move — DOC/todos_completed/PROJECT_ONE_DRIVE_EXODUS.html).

| Item | Finding |
|---|---|
| **Location** | `C:\Users\hannu\Projects\traffic-and-dragons-server\` — **outside the OneDrive-synced tree** since 2026-07-12 (DOC/todos_completed/PROJECT_ONE_DRIVE_EXODUS.html Phase 4), so no longer a sibling of the game repo. (Original finding: it sat at `OneDrive\Documents\Projects\traffic-and-dragons-server\`, OneDrive-synced, and CLAUDE.md §22's bare `cd traffic-and-dragons-server` read as if it were a subdirectory.) |
| **Version control** | **(corrected 2026-09-03: the server has been a private GitHub repo since 2026-07-12 — `pmegow/traffic-and-dragons-server`, with CI batteries since #313.)** Original survey text: NONE. `git status` → "not a git repository." The only copies of the production server code are this OneDrive folder and whatever Docker image Fly currently holds. A `.gitignore` exists (node_modules, .env, db files) but there is no repository behind it. This is the single most urgent finding — see §2. |
| **Stack** | Node 22 (slim Docker), Hono 4 + `@hono/node-server`, `better-sqlite3`, `dotenv`. ESM. ~500 lines `index.js` + ~88 lines `db.js`. No framework beyond Hono, no ORM, no test file, no lint. |
| **Naming rot** | `package.json` name is still **`ashen-crown-server`** (the project's pre-rename identity). Dockerfile sets `ENV DB_PATH=/data/ashen.db` while `db.js`'s fallback default is `/data/traffic.db` — **the Dockerfile ENV wins in production, so the live data lives in `ashen.db`.** ⚠ Do NOT "fix" this name without a copy/migration step — pointing the code at `traffic.db` on the volume would silently boot an empty database (a total-data-loss trap wearing a cleanup's clothes). |
| **Secrets** | `.env` with the live GitHub OAuth client id + secret sits **in a OneDrive-synced folder** (i.e. replicated to Microsoft's cloud). It also defines `SESSION_SECRET`, which **nothing in the code reads** — dead config (sessions are random UUIDs, no signing). Fly presumably holds its own copies via `fly secrets`. |
| **Local dev artifacts** | `ashen.db` + `-shm`/`-wal` files in the folder (a dev database, also OneDrive-synced). |
| **DB** | Single SQLite file on one Fly volume (`tnd_data` → `/data`), WAL mode. No Turso, no replicas — TODO.md's Architecture line "SQLite/Turso" overstates it (doc drift, see §1.6). |
| **Hosting** | Fly.dev app `traffic-and-dragons-server`, region `ord`, one 256MB shared-CPU VM, `auto_stop_machines`, **`min_machines_running = 0`** (cold starts — the documented "waking server up" UX and half the 2026-07-03 dead-host pain), deployed `--ha=false`. |
| **Monitoring** | `/health` does a real SQLite read (dead/corrupt volume fails the check, not just a dead process) and is pinged every 15 min by `.github/workflows/server-health.yml` in the game repo — verified present. Good bones. |

### 1.2 Endpoints (complete enumeration — 20 routes)

| Route | Auth | Purpose | Notes |
|---|---|---|---|
| `GET /health` | none (by design) | uptime + DB-read probe | |
| `GET /auth/github` | none | redirect to GitHub authorize | **No `state` parameter** — see risks |
| `GET /auth/github/callback` | none | code→token exchange, user upsert, session + ticket mint | Sets `HttpOnly; SameSite=Lax` cookie (no `Secure` flag); redirects to `/auth/done?ticket=` |
| `GET /auth/done` | none | popup landing page; postMessages the ticket to opener | Ticket also claimable by poll (file:// path) |
| `GET /auth/ticket/:ticket` | none (ticket IS the secret) | one-shot claim → returns sessionId | Deleted on claim; 5-min sweep — clean design |
| `GET /auth/me` | session | whoami | |
| `POST /auth/logout` | cookie only | delete session | Reads the **cookie**, not the Bearer header — a Bearer-authed client's logout deletes nothing unless the cookie rode along (the client sends the token; storage-adapter's logout works because the popup set the cookie on the server origin — fragile) |
| `GET /api/state` | session | load **the user's most-recently-updated campaign** | Ignores which campaign is active — legacy single-campaign shape; the client defends with a campaign-identity guard (audit E4). Server-side fix: accept `?campaignId=` |
| `POST /api/state` | session | upsert whole campaign blob | **Carries the CAS turn guard** (Known issue #5, shipped v1.238): if `body.campaignId` present and `baseTurn` numeric, `json_extract($.turn)` on the stored blob; stored turn > baseTurn → **409 {serverTurn}**. Legacy clients (no baseTurn) pass. `narrative_html` COALESCEs (never nulled by the now-empty client field) |
| `GET /api/campaigns` | session | list campaigns (parses every full blob to build the list — O(total state size) per call) | |
| `GET /api/campaigns/:id` | session | load specific campaign | JSON.parse failures degrade to nulls silently |
| `DELETE /api/campaigns/:id` | session | delete | **No tombstone** — deleted campaigns resurrect from any device still holding them (UA20) |
| `PUT /api/campaigns/:id/portrait` | session | store PC portrait + NPC portrait map | `if (!body.portrait) → 400` means a portrait can never be **cleared** through this endpoint |
| `GET/POST /api/characters`, `DELETE /api/characters/:slug` | session | character library | slug = name, upsert by (user, slug) |
| `GET/POST /api/blueprints`, `DELETE /api/blueprints/:slug` | session | blueprint library | `public` column dormant by decision (community sharing scrapped) |
| `GET/PUT /api/prefs/:key` | session | account-level pref blobs (#95.5 — star-bench sync) | Key allowlist (`speaker_stars` only today); value must be a JSON array ≤100KB; `rev` increments per write (clients adopt on rev change — whole-value LWW, no tombstones) |

**`GET /api/messages` — documented in CLAUDE.md §22, DOES NOT EXIST in the code.** Doc drift
(§1.6).

### 1.3 Schema (SQLite, created idempotently in `db.js`)

- `users (id PK "gh_<id>", github_id UNIQUE, username, avatar_url, created_at)`
- `sessions (id PK uuid, user_id FK CASCADE, created_at, expires_at)` — **fixed 30-day expiry, no
  sliding renewal** (Known issue #7①: an active phone silently 401s monthly)
- `campaigns (id PK, user_id FK, name, world_state TEXT, session_log TEXT, memory TEXT,
  updated_at)` + bolted-on `portrait`, `npc_portraits`, `narrative_html` (try/catch ALTERs)
- `auth_tickets (ticket PK, session_id, username, avatar_url, created_at)`
- `characters (user_id, slug) PK` and `blueprints (user_id, slug) PK` — mirror-pattern libraries

The three JSON columns are opaque blobs — the server never validates or interprets game state
beyond the CAS `json_extract`. That is the "dumb blob store" of §6, stated as schema.

### 1.4 Auth flow (as-built)

GitHub OAuth (scope `read:user`) → callback upserts user, mints a 30-day UUID session row +
a one-shot auth ticket → popup postMessages the ticket (https origins) or the opener polls
`/auth/ticket/:ticket` (file://, the documented Chrome postMessage block) → client stores the
sessionId as a Bearer token in `tnd_server_tok_v1`. `getSession()` accepts Bearer **or** cookie;
every endpoint inlines its own `getSession`+401 (a `requireAuth` middleware exists at index.js:60
but is **never used** — 12 copies of the same conditional, the exact scattered-conditionals
pattern the project's own design rules forbid).

### 1.5 Failure paths & risks

| # | Risk | Severity | Detail / remedy |
|---|---|:---:|---|
| R1 | **No version control** | **Critical** | §2. One OneDrive sync glitch or fat-fingered save away from unrecoverable production code. |
| R2 | **No off-volume backups** | **Critical (pre-revenue: High)** | All user data = one SQLite file on one Fly volume. Fly's automatic volume snapshots (daily, ~5-day retention) are the only net, and they've never been test-restored. Paid customers make this untenable — see §7 (Litestream). |
| R3 | **OAuth login CSRF — no `state` param** | High | The authorize URL carries no `state`; an attacker can complete an OAuth dance and splice their code into a victim's flow (or vice versa), logging the victim into the attacker's account — the victim's campaigns then sync to the attacker. The client's postMessage origin check (audit E7) narrows but does not close this. Add `state` (random, stored in the ticket table or a short-lived cookie, verified at callback). Cheap. |
| R4 | **No request body size limit** | High | `POST /api/state` accepts arbitrarily large JSON into a 256MB VM and a TEXT column. A malicious (or just portrait-bloated) client can OOM the machine or balloon the DB. Cap at ~4MB (a mature save with portraits is ~1MB). |
| R5 | **No rate limiting anywhere** | High today, **Critical the day the LLM proxy lands** | Currently bounded by "it's a sync API"; a proxy holding OUR Anthropic key without per-user limits is an open wallet (§3.6). |
| R6 | **No schema validation of blobs** | Med | Any JSON is accepted as `worldState`. Fine as a dumb store for your own client; becomes an injection/abuse surface when server code starts *reading* the blob (the CAS `json_extract` already does, harmlessly). Validate top-level shape + reject absurd sizes when authority grows (§6). |
| R7 | **Fixed session expiry** | Med | Known issue #7① — sliding renewal (touch `expires_at` ~daily on authenticated use), bundle with next deploy. |
| R8 | Session tokens stored plaintext in DB | Low-Med | A DB leak = live sessions. Hash tokens at rest (store SHA-256, compare hashes) when convenient; 30-day expiry bounds the blast. |
| R9 | Unguarded upstream fetches in the OAuth callback | Low | `tokenRes.json()` / GitHub user fetch failures throw → Hono's generic 500. Functional but opaque; wrap and message. |
| R10 | Delete-resurrection (no tombstones) | Low (solo) | UA20 — becomes wrong under any server-authority model; cheap `deleted_at` column. |
| R11 | Logout ignores Bearer | Low | §1.2 note — unify `getSession` source for logout. |
| R12 | `min_machines_running = 0` | Low-Med (UX) | Cold starts caused the "waking server, hang tight" class and contributed to dead-host confusion. Costs ~$2-3/mo to pin one machine — flip when paying customers exist (§7). |
| R13 | `GET /api/campaigns` parses every blob per listing | Low | Extract list metadata to columns on write (name/level/location already computed client-side) when it ever measures slow. |

**What's genuinely good and should be kept:** the ticket-claim auth pattern (one-shot, swept,
origin-independent — it will carry Electron nearly unchanged, §5.3); the `/health` DB-read probe +
external GitHub Actions monitor; WAL mode; per-user scoping on every query (`AND user_id = ?`
everywhere — no cross-tenant read found in the survey); the CAS guard's backward-compatible
design; CASCADE deletes.

### 1.6 Doc drift found by this survey (fix in CLAUDE.md/TODO.md when convenient)

- CLAUDE.md §22 lists `GET /api/messages` — no such endpoint exists.
- CLAUDE.md §22 omits the blueprint endpoints, `PUT .../portrait`, `DELETE /api/campaigns/:id`,
  `/auth/done`, `/auth/ticket/:ticket`, and `/health` — the real surface is ~18 routes, not 9.
- TODO.md Architecture ("Server & services shape") says "SQLite/**Turso**" — there is no Turso;
  it's better-sqlite3 on a Fly volume.
- CLAUDE.md §22 describes auth as pure postMessage of `{sessionId}`; the shipped flow is
  ticket-based (postMessage carries only the ticket; the sessionId comes from the claim endpoint).

---

## 2. Version control & immediate hardening (do FIRST — independent of every decision below)

This section costs ~an hour total and none of it waits on any ▶ DECISION.

1. **`git init` in the server folder, initial commit, push to a PRIVATE GitHub repo** (the
   existing `.gitignore` already excludes `.env` and the db files — verify before the first
   commit; `fly.toml` and `Dockerfile` SHOULD be committed).
2. **Rotate the GitHub OAuth client secret** after the repo exists (it has lived in OneDrive's
   cloud for six weeks; rotation is a 2-minute GitHub settings action + `fly secrets set`).
   Delete the dead `SESSION_SECRET` line while there.
3. ✅ **DONE 2026-07-12** — ~~Move the dev `.env` and `ashen.db*` out of the OneDrive-synced tree~~
   The whole server folder moved to `C:\Users\hannu\Projects\traffic-and-dragons-server`
   (DOC/todos_completed/PROJECT_ONE_DRIVE_EXODUS.html Phase 4), taking `.env` and `ashen.db*` with it; the OAuth
   client secret was rotated a second time after the move (ROTATION.md in the server repo).
4. **Test-restore a Fly volume snapshot once** — a backup that has never been restored is a hope,
   not a backup. Document the restore commands in the new repo's README.
5. Cheap code fixes to ride the next deploy (each is a 1-5 line change, no design dependency):
   OAuth `state` param (R3) · body-size cap (R4) · sliding session renewal (R7 / Known issue #7①)
   · logout reads Bearer too (R11) · rename `package.json` to `traffic-and-dragons-server`
   (leave `DB_PATH` pointing at `ashen.db` — see the §1.1 trap; a deliberate `/data` file rename
   with a copy step can happen someday, or never).

▶ **DECISION 1 — where does the server repo live?**
- **(a) Its own private repo** *(recommended for now)*: zero risk, matches the current sibling
  layout, independent deploy cadence, nothing about the game repo's Cloudflare Pages hosting
  changes.
- **(b) Subdirectory of the game repo (monorepo)**: makes single-sourcing `tag_table.js` +
  `helpers.js` to the server trivial (just `require` up the tree), which §6 will eventually want
  badly. BUT the game repo root IS the Cloudflare Pages deploy — a server subdirectory would be
  served publicly as static files (code only, no secrets, but sloppy), and Pages' git integration
  has no exclude mechanism without introducing a build step, which the project constitutionally
  refuses.
- Recommendation: **(a) now**; revisit monorepo only when Phase 2 of §6 makes engine-sharing a
  real requirement, at which point the options are npm workspace, a deploy-time copy with a
  byte-identity check in the pre-commit gate (the project already runs exactly this kind of
  guard), or restructuring Pages to deploy a subfolder. Don't pay that design cost before the
  sharing need exists.

---

## 3. LLM proxy / gateway design

The Subscription-model decision (TODO ▸ Architecture) already fixed the endpoint of this arc:
**users will not bring keys; all Claude calls move server-side; the server holds the keys, meters
usage, and rate-limits per tier.** This section designs that gateway.

### 3.1 Shape

New route group on the existing server (it stays ONE service — at this scale a separate
"gateway" deployment is ceremony):

```
POST /api/llm          — the proxied model call (all kinds: turn/summarize/actions/skeleton/sync)
POST /api/render       — fal.ai proxy (portraits + scene renders)
POST /api/tts          — Cartesia/Inworld proxy (#41's provider table lands here too)
GET  /api/usage        — the user's metered usage + remaining allowance (feeds the Usage modal)
```

**The client's `PROVIDERS` table moves server-side almost verbatim** — this was the explicit
forward-compatibility promise of the provider-adapter decision and it holds: the server keeps a
`PROVIDERS[id]` object per upstream (endpoint/headers/buildBody/parseResponse/parseUsage), holds
the keys in `fly secrets`, and `callGM()` in the client shrinks to "POST my messages + system
blocks + kind to `/api/llm`." No `if (provider === …)` anywhere — the same one-boundary dispatch
rule, now enforced where the money is.

Request contract (Phase 1 — client still builds the prompt, see §3.2):

```
{ kind: "turn"|"summarize"|"actions"|"skeleton"|"sync"|"other",
  system: string | [{text, cache_control?}, {text}],   // the two-block split passes through
  messages: [...], maxTok: N, modelPref?: "sonnet"|"opus" }
```

Server responsibilities per call: authenticate → entitlement check (tier active, allowance
remaining) → **clamp** (`maxTok` ceiling per kind: turn 1000, summarize 2000, actions/skeleton
200-500; model resolved from tier, `modelPref` honored only if the tier allows it) → forward →
**meter from the provider's own usage block** (server-side `parseUsage` — authoritative, unlike
the client's `worldState.usage`) → return response + a usage receipt.

Prompt caching survives the proxy unchanged — Anthropic's cache is keyed on content+model within
our org, so forwarding the `cache_control` blocks as-is preserves the −29% turn economics. The
gateway MUST forward the system array untouched (a gateway that flattens it would silently kill
every cache hit — the UA5 failure mode reborn server-side; add a gateway test for two-block
passthrough).

### 3.2 The honesty clause: Phase 1 is a metered passthrough, not a security boundary

While the client builds the prompt (today's architecture), a paying user can script arbitrary
Claude calls through `/api/llm` within their allowance. **Accept this.** The allowance bounds the
cost exactly as it bounds gameplay; prompt-shape sniffing ("must contain STATE TAGS") is theater
that breaks the first time the prompt legitimately changes. The structural fix is server-built
prompts, which is §6 Phase 3 — the gateway should not pretend to solve it earlier. What Phase 1
DOES enforce: who may call, how much, at what model, with what token ceilings, logged per user.

### 3.3 Streaming

Recommendation: **defer streaming; ship the proxy non-streaming.** Grounds: the client is
non-streaming today (`callGM` awaits one JSON body); a 1000-token Sonnet response completes well
inside Fly's proxy idle timeout; and streaming touches `callGM`, `addMsg`, TTS chunking, and the
tag parser's "whole response" assumption (tags can split across chunks — `applyMuts`/the table
must only ever run on the COMPLETE text, so streamed display would need a buffer-then-parse step:
real design work, zero billing value). When it's wanted for UX polish, Hono does SSE cleanly and
the gateway adds a `stream: true` flag — additive. ▶ **DECISION 2** (recommend: defer).

### 3.4 Usage metering (builds on `worldState.usage` / #30)

Two meters, one truth:

- **Server meter (new, authoritative):** a `usage_events` table — `(user_id, ts, kind, model,
  tokens_in, tokens_out, cache_read, cache_write, cost_usd)` — written per call from the
  provider's usage block, priced server-side from one pricing table. Monthly rollup per user
  drives entitlement checks and (if ever) overage billing. This is billing-grade: the client
  never influences it.
- **Client meter (existing `worldState.usage`, #30/UA13):** stays as the player-facing per-
  campaign display. **Do #30's fixes anyway** (per-provider pricing, cache-token unit
  normalization, "unpriced calls: N" line) — the client meter is the UX and the cross-check;
  a persistent client/server divergence is a bug detector for free.

Precondition worth stating: UA13's unit normalization (Anthropic `input_tokens` EXCLUDES cached;
OpenAI-family INCLUDES) must be encoded in the server's pricing layer from day one, or the
billing dataset is poisoned the way the client meter was.

### 3.5 Per-tier rate limits

Single machine (post-R12 pin) makes this easy — in-memory token buckets for burst control,
SQLite counters for the billing-grade monthly allowance:

| Control | Free | Paid | Purpose |
|---|---|---|---|
| Turn allowance / month | ~80 lifetime OR ~25/mo (▶ DECISION 4) | e.g. 300/mo (▶ DECISION 4) | the billed unit |
| Requests / min / user | 6 | 12 | burst + script abuse |
| Concurrent LLM calls / user | 1 | 1 | mirrors the client `busy` flag server-side; a turn is single-threaded by design |
| maxTok clamp per kind | fixed table | fixed table | §3.1 |
| Model | Sonnet only | Sonnet default, Opus if tier allows | UA28 verdict — see §4.2 |

A "turn" for allowance purposes = one `kind:"turn"` call. Sidecar calls (actions ~200 tokens,
summarize every ~10 turns) ride along unmetered-but-clamped — they're ~15% of turn cost and
metering them separately complicates the player-facing story for pennies. They ARE counted in
`usage_events` (cost truth) even though they don't decrement the allowance.

### 3.6 Runaway-cost guards (defense in depth, cheapest first)

1. **Per-call clamps** — maxTok by kind, model by tier (above). Caps the worst single call.
2. **Per-user daily ceiling** — e.g. 3× the prorated daily allowance; a stolen token or a bug
   loop hits this wall inside a day, not a month.
3. **Global monthly circuit breaker** — one number: projected provider spend for the month; past
   the threshold the gateway returns a maintenance error for `kind:"turn"` and the health workflow
   emails. This is the "wake the operator" guard — it should never fire, and it's 20 lines.
4. **Anomaly log** — any user exceeding N× median daily usage gets a log line; no automation,
   just visibility (no-silent-failures applies to money too).
5. Fly-side: the 256MB VM is itself a bound — the gateway holds no state per call, so scale
   pressure shows as latency, not spend.

### 3.7 Non-LLM keys

The Clear-for-Release row is explicit: fal.ai (renders) and TTS keys move behind the server too.
Same gateway pattern, same metering table (kind `render` / `tts`), same tier gating (e.g. renders
per month — an image is ~the cost of several turns). The `RENDER_MODELS` and TTS provider tables
migrate server-side exactly like `PROVIDERS`. Build these as part of the same route group but
AFTER `/api/llm` proves the pattern — renders/TTS are optional features with graceful client
fallbacks already.

---

## 4. Billing

### 4.1 Provider

▶ **DECISION 3 — Stripe direct vs merchant-of-record.**

| | **Stripe** (Checkout + Billing + Customer Portal) | **Merchant of record** (Paddle / Lemon Squeezy) |
|---|---|---|
| Integration | Best-in-class; Checkout session + one webhook endpoint + Customer Portal ≈ a weekend | Similar surface, slightly clunkier APIs |
| Fees | ~2.9% + 30¢ (+0.5% Billing) | ~5% + 50¢ |
| **Sales tax / VAT** | **You are the merchant.** Stripe Tax computes it, but registration/remittance obligations in each jurisdiction are yours as thresholds trip | **They are the merchant** — tax is entirely their problem |
| Control / data | Full | Less (their checkout, their invoice) |
| Fit | Standard choice; enormous documentation gravity | Built exactly for solo-operator digital subscriptions |

Recommendation: **evaluate honestly, lean merchant-of-record (Paddle or Lemon Squeezy) for a
solo operator.** Stripe is the better product; the MoR is the better *liability shape* — global
digital-services tax compliance is a permanent administrative tail exactly like the moderation
tail that killed community sharing, and the same asymmetry argument applies. The ~2% fee delta on
a small subscriber base is noise next to one tax registration. If the user prefers Stripe (fair —
it's the default for a reason and migrating later is possible if painful), take Stripe Checkout +
webhooks and turn on Stripe Tax from day one.

Either way the server-side shape is identical: a `subscriptions` table
`(user_id, provider_customer_id, tier, status, current_period_end, updated_at)` written ONLY by
the provider's webhook (signature-verified), read by the entitlement middleware. The webhook
endpoint is the one new unauthenticated route; verify signatures, store raw events for replay.

### 4.2 Tier shape

Grounded in the **2026-07-10 UA28 verdict**: *Haiku is NOT viable as GM* (canon ignored under
pressure, fences ignored, contradictions amplified — four independent legs). **Free tier =
capped Sonnet turns, not a weaker model.** Quality constant, quantity limited — the free taste
plays like the paid product. The tier→model mapping sketched in the old Architecture note
("free = Haiku") is dead; do not resurrect it.

Cost basis (UberAudit, billing-corroborated): Sonnet ≈ **$0.036/turn** with prompt caching
healthy. That number is load-bearing for everything below — the UA5 cache tripwire and the
gateway's two-block passthrough test (§3.1) are what keep it true.

| Tier | Price | Allowance | Model | Notes |
|---|---|---|---|---|
| **Free** | $0 | ~80 turns **one-time** (≈ $2.88 COGS, ≈ one short arc) — or a small monthly drip (~25/mo, ≈ $0.90/mo forever) | Sonnet | ▶ DECISION 4a: one-time trial vs monthly drip. Recommend **one-time 80** — bounded acquisition cost per signup, and "finish your first arc" is a natural conversion moment; a drip invites permanent free-riding at unbounded aggregate cost |
| **Standard** | ~$10/mo | ~250 turns/mo (≈ $9 COGS at cap — but median players won't hit cap; expected margin healthy) | Sonnet | ▶ DECISION 4b: price + cap. 250 turns ≈ 2-3 real play sessions/week |
| **Premium** (later) | ~$20/mo | ~500 turns + Opus option + premium blueprint packs (#44's hook) + higher render quota | Sonnet/Opus | Ship after Standard proves; #44 gates on this existing |
| Overage | — | ▶ DECISION 4c: hard stop vs metered top-up packs ($5 → ~120 turns) | | Recommend **hard stop + top-up packs** — never an open-ended metered bill on a family product; a surprise invoice is a churn machine |

Honest margin note: a maximal Standard user costs ~90% of revenue before fees — the tier works on
the usual utilization curve, not per-user worst case. The `usage_events` table (§3.4) is what
lets these numbers be re-fit from reality after a month of data instead of argued from priors;
resist tuning prices before that data exists.

### 4.3 Lapse behavior

▶ **DECISION 5.** Recommendation, stated plainly:

- **Their data is theirs, forever.** Sync, load, export, character/blueprint libraries keep
  working on a lapsed account indefinitely. Never hold campaigns hostage — it's both the decent
  move and the cheapest goodwill available (storage cost ≈ nothing).
- **Turns stop** when `current_period_end` + a 3-day grace passes with `status != active`.
  If the free tier is a monthly drip, lapsed accounts simply become free accounts; if one-time,
  lapsed = 0 turns until resubscribe.
- Client UX: the gateway returns a distinct `402` payload; the client shows a "subscription
  lapsed — your story is safe, resubscribe to continue" state rather than a generic error
  (no-silent-failures: the player must know exactly why the GM went quiet).

---

## 5. Auth evolution

### 5.1 GitHub OAuth → subscription entitlement

Keep the working thing; layer entitlement on top. **Auth (who are you) and entitlement (what may
you do) stay separate columns of the design:**

- `users` stays the identity root. Add nothing to it for billing.
- `subscriptions` (§4.1) keys entitlement off `user_id`; the middleware chain on gated routes
  becomes `requireAuth → requireEntitlement(kind)` — and building `requireAuth` for real finally
  retires the 12 inline copies (§1.4).
- Existing GitHub-keyed campaigns migrate by doing nothing — same user id, new columns.

### 5.2 Broader login options

GitHub OAuth selects for developers; the stated audience (family car trips) largely doesn't have
GitHub accounts. ▶ **DECISION 6:** add **Google OAuth** (same ticket flow, second provider config,
~a day) and/or **email magic-link** (no password storage — one more ticket-shaped table + an email
sender; Resend's free tier is already contemplated for #16 error reporting). Recommend Google
first (covers most of the audience, zero new infrastructure), magic-link second, and **never
passwords** (prohibited-by-design: no credential storage liability on a hobby-scale operator).
The `users` table generalizes: `github_id UNIQUE` → a `(provider, provider_id)` identity table
when the second provider lands — do that small migration once, when Google is actually built.

### 5.3 Electron

The ticket-poll flow was accidentally designed for this. Electron auth = open the **system
browser** at `/auth/github` (never an embedded webview — GitHub actively blocks them and it
trains bad credential habits), then get the ticket back by either:
- **(a) Loopback redirect**: the app listens on `127.0.0.1:<random>` and `/auth/done` redirects
  there — the standard native-app OAuth shape; or
- **(b) Display-code + poll**: `/auth/done` shows the ticket as a short code, the app polls
  `/auth/ticket/:ticket` exactly as the file:// path does today — **zero new server code**.

Recommend (b) to start (it exists), (a) as polish. The only server change either way: `/auth/done`
learns to render the no-opener case (today it assumes a popup). Custom protocol handlers
(`tnd://auth`) are a third option but bring installer/registry complexity for no gain over (a).

---

## 6. STATE AUTHORITY — the big decision

**The question:** does the server remain a dumb blob store the client syncs to, or does it become
the authority that runs the game? This decides multiplayer (#1), the CAS guard's future, where
`tag_table.js` runs, and how much of the drift surface acquires a second runtime.

### 6.1 What each pole actually is

**Option A — dumb blob store (status quo + hardening).**
Client owns everything; server stores JSON and arbitrates writes with CAS.
- ✅ Zero new drift-surface exposure; the engine stays one codebase in one runtime.
- ✅ Offline/local play keeps working; `file://` dev mode untouched.
- ✅ Already built. Hardening (§2) is all it needs for solo play at launch.
- ❌ **Multiplayer is effectively impossible** — two clients mutating cloned states and racing
  whole-blob POSTs cannot be merged after the fact; CAS can only refuse, not reconcile.
- ❌ Read side stays LWW (UA19's documented lossy window).
- ❌ Anti-cheat/anti-abuse nil (irrelevant solo; relevant the day anything competitive or shared
  exists).
- ❌ Billing meters calls, not game semantics — fine (§3.2), but permanently so.

**Option B — fully authoritative server, big-bang.**
Server owns state; client is a renderer posting player intents.
- ✅ The clean end-state: multiplayer, merge-free concurrency, server-canonical entity IDs
  (the Stable-IDs decision explicitly waits for exactly this), prompt built where the keys are.
- ❌ The entire drift surface — tag table, memory tiers, summarize, RAG, prompt build — acquires
  a server runtime **in one step**. The standing policy exists because these failure modes are
  silent; a big-bang port is the maximum-blast-radius version of the most protected surface in
  the project. Rejected on those grounds alone.

### 6.2 Recommendation: staged authority — the turn pipeline, in shadow first (Option C)

The same discipline that shipped UA1 (shadow → soak → cutover, one block per playtest) applied to
the client/server boundary. The engine is *already provably portable*: `dev/run-tests.js` runs
the real engine files headless in Node on every commit, and `tag_table.js`'s handler contract
(globals-swapped, clone-and-diff) was built precisely so the parser could run against state it
doesn't own. The hard part — a server-runnable engine — is, unusually, already done.

**Phase 0 (now):** §2 hardening + §3 gateway. Client authoritative. CAS as shipped. This is the
launchable subscription product for SOLO play — nothing below blocks revenue.

**Phase 1 — server-side shadow parse.** The client, when POSTing state after a turn, also posts
the raw GM response text. The server loads the same `tag_table.js` (see 6.4), runs it against its
stored blob copy, and **diffs the resulting state against the blob the client posted** — exactly
UA1's shadow mode with the roles distributed. Divergence = loud log + telemetry, zero player
impact. What this buys: proof, accumulated from real play at zero risk, that the server can
reproduce the client's mutations byte-for-byte — the precise evidence standard the drift policy
demands before any cutover. (It also incidentally detects tampered client blobs.)

**Phase 2 — the authoritative turn endpoint.** `POST /api/turn {campaignId, playerAction}`:
server loads state, **builds the prompt server-side** (buildSysPrompt + memory tiers move over —
this is the big port, gated on Phase 1's soak), calls the model, runs the table, persists, and
returns `{narrative, stateDelta or full state}`. The client keeps a local mirror for rendering
and offline reads. Turn writes are now **server-sequenced: the CAS guard becomes obsolete on the
turn path** (the server assigns turn numbers; there is nothing to compare-and-swap) and survives
only for the legacy blob-push path (manual imports, `campCloudPushSilent`-class rescue tools,
offline catch-up). This also closes §3.2's honesty clause — the prompt is now built where the
key lives, and the proxy abuse window shuts structurally.

**Phase 3 — multiplayer (#1) on top.** Only possible here, and here it's *natural*: a
`campaign_members` table (campaign_id, user_id, character_name, role), a server-held turn
pointer (alternating turns = the design already chosen in #1), and a turn queue — the server
serializes writes per campaign, so concurrency stops being a merge problem and becomes a
scheduling one. Notification of "your turn" starts as polling (the campaign picker already
polls-ish), upgrades to SSE if it ever feels bad. Stable entity IDs land HERE as the near-free
side effect the Architecture decision predicted (server primary keys + a save-format touch that
multiplayer forces anyway).

▶ **DECISION 7 — ratify the staged path (C), and specifically:**
- **7a.** Does solo LAUNCH wait for any authority phase? Recommendation: **no** — Phase 0 ships
  the subscription; Phases 1-3 run behind it.
- **7b.** In Phase 2+, does client-authoritative local/BYO-key play survive as a mode (dev mode,
  power users, offline)? Recommendation: **yes, indefinitely** — it's the dev/test harness's
  substrate and the offline story; the two modes share one engine by construction (6.4), so the
  cost of keeping it is near zero and it de-risks every server outage.
- **7c.** Timing of Phase 1: it can start any time after the gateway exists — it's cheap
  (an endpoint + the Node engine loader that already exists) and every week it runs builds the
  cutover evidence base. Recommend early.

### 6.3 What this does to UA19 (the sync rewrite)

UA19 is gated on this document; the answer it was waiting for: **do not build a merge/changeset
sync layer.** Under staged authority, the LWW read side gets its real fix in Phase 2 (server
sequences turns; clients pull, never race), and until then the shipped CAS + conflict-pause is
the correct interim. The JSON-vs-SQLite decision's "changesets" temptation is explicitly
superseded by the turn pipeline — changesets solve concurrent *editing*, and the game's write
model is turn-*taking*, which a queue solves more simply than a merge ever could. UA19 closes as
"absorbed into §6 Phase 2."

### 6.4 Where the tag table runs — single source, two runtimes

`tag_table.js` ultimately runs **in both places, from ONE file**. The mechanism already exists:
the headless test runner loads the engine files in Node today, and the handler contract
(globals-as-interface, per-handler isolation, ordered array) was designed for exactly this
transplant. The new risk to name honestly — **version skew** is the server-era phantom-tag class:
a client on `sw.js` cache N while the server parses with N+1 is the triple-source drift problem
reborn across the network. Guards, all cheap:
- The engine version stamps that already exist (per-turn ENGINE VERSION, `APP_VERSION`, the `m:`
  model stamp) extend naturally: the client sends its engine version with each turn; the server
  logs (Phase 1) or refuses politely (Phase 2) on mismatch.
- One file on disk feeding both runtimes (monorepo or copy-with-byte-identity-gate per
  ▶ DECISION 1) — never two maintained copies.
- Phase 1's shadow diff IS the standing tripwire: skew shows up as divergence before it shows up
  as corruption.

⛨ Standing-policy note: Phases 1-2 touch the drift surface (the parser gains a runtime; prompt
construction eventually relocates). Each phase gets its own pre-review + playtest gate per the
decree — this document is the map, not the pre-review.

---

## 7. Deploy & scale on Fly.dev

| Concern | Now | At paid launch | Later trigger |
|---|---|---|---|
| **Version control** | §2 — this week | — | — |
| **Backups** | Test-restore a volume snapshot once | **Litestream** sidecar → object storage (Tigris is Fly-native, S3/B2 equivalent): continuous WAL replication, restore-to-point-in-time, ~zero code. Paid-customer data on one volume without it is negligence | — |
| **Machines** | `min_machines_running=0` (cold starts) | **=1** (~$2-3/mo) — kills the cold-start UX class and shrinks the dead-host window; keep `auto_start` as the failover | Second machine only if latency data demands it — note better-sqlite3 = single-writer, so scale-out means LiteFS/Turso, a real project; don't drift into it |
| **Regions** | `ord` only | unchanged — LLM latency (seconds) dwarfs geographic RTT (tens of ms); multi-region is cost without benefit here | A real EU user base + measured complaint |
| **Health** | `/health` + 15-min GitHub Actions ping (exists) | Add fly.toml `[[http_service.checks]]` so Fly itself restarts a sick machine between pings; wire the §3.6 circuit breaker into the same email path | — |
| **Secrets** | `fly secrets` for GitHub OAuth (+ rotate, §2) | + Anthropic key, billing webhook secret, fal/TTS keys — all `fly secrets`, never in the repo, `.env` for local dev only and outside OneDrive | — |
| **Deploy** | `flyctl deploy --ha=false` by hand | Fine. A GitHub Action deploy-on-push from the new repo is a nicety, not a need | — |
| **DB growth** | ~MB scale | Blobs at ~1MB × campaigns × users — SQLite is comfortable into tens of GB; the R13 listing fix matters before the storage does | The JSON-vs-SQLite revisit triggers stand |

---

## 8. ▶ DECISIONS — collected for the user

| # | Question | Options | Recommendation |
|---|---|---|---|
| 1 | Server repo home | own private repo / monorepo subdir | **Own private repo now**; revisit at §6 Phase 1 when engine-sharing is real (§2)  **2026-07-11: Ratified: own private repo.** |
| 2 | Streaming in the LLM proxy | ship now / defer | **Defer** — client is non-streaming, tags need whole-text parsing, additive later (§3.3)  **2026-07-11: Ratified: defer.** |
| 3 | Billing provider | Stripe direct / merchant-of-record (Paddle, Lemon Squeezy) | **Lean MoR** for the tax-liability shape, same asymmetry logic that scrapped community sharing; Stripe acceptable if preferred, with Stripe Tax on from day one (§4.1)  **2026-07-11: Deferred to build time (user call - shape identical either way; the MoR-vs-Stripe leaning stays open).** |
| 4 | Tier shape | a) free = one-time ~80 Sonnet turns vs monthly drip · b) Standard price/cap (~$10 / ~250) · c) overage = hard stop + top-up packs vs metered | **One-time 80 · $10/250 as the opening hypothesis · hard stop + packs**; re-fit all numbers from `usage_events` after a month of real data (§4.2)  **2026-07-11: Ratified with amendments: NO free tier at launch (user call, supersedes 4a); price/cap set at build time (4b deferred); overage = hard stop + top-up packs (4c as recommended).** |
| 5 | Lapse behavior | lock / read-only / data-free-forever + turns stop | **Data (sync/export/libraries) free forever; turns stop after 3-day grace; loud, specific client message** (§4.3)  **2026-07-11: Ratified: data free forever, turns stop after 3-day grace, loud specific message.** |
| 6 | Login breadth | GitHub only / +Google / +magic-link | **Add Google** (audience fit), magic-link later, **never passwords** (§5.2)  **2026-07-11: Ratified: Google next, magic-link later, never passwords.** |
| 7 | State authority | A dumb store / B big-bang authoritative / **C staged** | **C**: gateway-only launch (7a: don't wait), server shadow-parse early (7c), authoritative turn endpoint after the soak, multiplayer on top; local/BYO-key mode survives indefinitely (7b) (§6)  **2026-07-11: Ratified: staged path C - 7a launch on Phase 0, 7b BYO-key mode survives indefinitely, 7c shadow-parse early.** |

Not decisions but commitments this doc makes if ratified: §2's hardening list happens first and
unconditionally; UA19 closes as absorbed into §6 Phase 2; the free tier is Sonnet-capped per the
UA28 verdict (already decided 2026-07-10, restated here as design input, not reopened).

## 9. Build order (assuming §8 ratified as recommended)

1. **§2 hardening** — repo, secret rotation, backup restore test, the 5 cheap server fixes
   (bundle with Known issue #7①'s deploy). No dependencies.
2. **§3 gateway** — `/api/llm` + metering + limits + circuit breaker; client `callGM` grows a
   server-provider entry in `PROVIDERS` (it's just another adapter — the abstraction pays again).
   BYO-key path untouched.
3. **§4 billing + §5.1 entitlement** — webhook, `subscriptions`, middleware; free-tier allowance
   live. ← **This is the launchable subscription.**
4. **§6 Phase 1 shadow parse** — cheap, starts accumulating cutover evidence immediately.
5. **§5.2 Google login · §3.7 render/TTS proxy · §5.3 Electron auth** — independent, any order.
6. **§6 Phase 2 authoritative turns** — gated on the Phase-1 soak + its own ⛨ pre-review.
7. **§6 Phase 3 multiplayer (#1)** — with stable entity IDs riding along, as long promised.
