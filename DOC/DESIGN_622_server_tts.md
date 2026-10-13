# #622 — Operator-paid narration for keyless players: the server TTS gateway (design, 2026-10-12)

Status (2026-10-12, later the same day): BUILT to this design as game v1.1249 + server 1.10.0; the
server deploy and the `SPEECHIFY_API_KEY` secret are the owner's (runbook: the server repo's
`DEPLOY_1.10.0_tts_gateway.md`). One deviation, recorded: the catalog endpoint serves the RAW vendor
voices and the client keeps the one actor mapper (the "compact list" wording below described the
client's stored shape, which is still what the client derives). The first outside beta tester (2026-10-12)
heard only Piper: Voice Settings is hidden from non-admins (owner ruling 2026-09-11, the modal carries
key fields), and the cloud readers (Speechify, Inworld, Gemini TTS) synthesize and load their actor
catalogs straight from the vendor on a key stored on the device. The same rider class as #621
(the portrait describer) — #288 §3.7 counted only STT and fal.

## Rulings (owner, 2026-10-12, through the question UI)

1. **Shape: (a) a server TTS gateway**, Speechify first (owner-validated 2026-09-11), Inworld later.
   Voice Settings shown to everyone; only the key fields stay `fm-dev-only`.
2. **Home: the GAME server** (traffic-and-dragons-server), beside the render proxy — not tnd-tts.
   Entitlement, the usage ledger, admin exemption and the account readout already live there; the
   proxy is an I/O passthrough with no CPU work, so the 256 MB VM and D2 ("narration bursts must
   never delay game-state saves") both hold.
3. **Cap: 250k characters per rolling week (product cap, ≈ $2.50 at Speechify's $10/M) plus 100k per
   rolling day (runaway insurance).** Admins exempt, as renders are. BYOK players never touch the
   route. Over the cap, narration falls to the connected Piper tier with ONE toast — no key pitch to
   a non-admin.
4. **Catalog: server-cached.** One vendor fetch a day for everyone, served to the client as the list
   it already stores.
5. **Non-admin Voice Settings lists only reachable readers:** Speechify (server), Piper, Device.
   Gemini TTS and Inworld stay hidden for a non-admin until they are proxied too. No dead controls.

## Cost basis

- Speechify API: per character, ≈ $10 per million pay-as-you-go ($6/M on the Scale tier)
  ([vendor page](https://speechify.ai/text-to-speech-api)).
- Measured narration volume (tts.js, the Gemini TTS note): ≈ $1.75 per 50 turns at $20/M audio tokens
  and 2.412 tokens per character → ≈ 36k characters per 50 turns ≈ 725 characters per narrated turn.
- A Tester tier (300 turns / 30 days) fully narrated ≈ 217k characters ≈ $2.20 per month. The weekly
  cap (250k) is above any honest week; the daily cap (100k ≈ 140 turns) is the runaway stop.
- Inworld TTS-2 lists at ≈ $15–25/M; the Builder-plan rate is unpublished — hence "later".

## Server design (traffic-and-dragons-server)

One new module `tts-proxy.js` with `registerTtsProxy(app)`, mounted after the `/api/*` requireAuth
gate, mirroring `render-proxy.js` line for line where the shapes match.

**The reader table — adding Inworld is adding an entry:**
```
TTS_READERS = {
  speechify: {
    keyEnv: "SPEECHIFY_API_KEY", auth: "Bearer",
    synth:   { url: "https://api.speechify.ai/v1/audio/stream", accept: "audio/pcm" },
    catalog: { url: "https://api.speechify.ai/v1/voices?locale=en&model=simba-3.2&limit=200", cursor: "cursor",
               next: (j) => j.has_more ? j.next_cursor : "", voices: (j) => j.voices },
    model: "simba-3.2", maxChars: 1200,  // the client group cap (900) + the SSML wrapper + a prosody tag
    chars: (body) => String(body.input || "").length   // what is metered: an upper bound on what the vendor bills
  }
}
```

**`POST /api/tts/:reader`** — the client's vendor-shaped body verbatim (`{input, voice_id, model, language,
output_format}`); the server never rewrites it. Gates in order, each a loud JSON refusal: unknown
reader (400) → key not configured (501) → entitlement (402, the §4.3 payload) → the weekly product
cap (429 `{error:"tts-allowance", used, cap, resetsAt, message}`) → the daily runaway cap (429) →
body is JSON, `model` matches the table, `input` ≤ `maxChars` (400). Then forward with the operator's
`Authorization` and the reader's `Accept`, under a 20 s AbortController (the client's own wrapper is
20 s; Fly's cutoff is ~60 s), and STREAM the upstream body back (`c.newResponse(upRes.body, status,
{content-type})`) — a 900-character group is ≈ 60 s of 24 kHz PCM ≈ 2.9 MB, never buffered on the
256 MB VM. Meter EVERY attempt including timeouts (the render lesson of 2026-08-31).

**Metering:** `usage_events` gains a nullable `chars INTEGER` column through the versioned migration
path (`addColumn`, db.js) — NOT `tok_in`: the admin console sums `tok_in` across every kind, so
characters there would read as tokens. Rows: `provider='speechify', model='simba-3.2', kind='tts',
chars, up_status`.

**`tts-allowance.js`** (the `render-allowance.js` twin): `ttsAllowance(userId)` →
`{used, cap: TTS_WEEKLY_CHARS, remaining, resetsAt, exempt}` as `SUM(chars)` of kind `tts` over 7
days where `up_status < 400`; `ttsAllowanceRefusal(userId)` → the 429 body or null; the daily
runaway `TTS_DAILY_CHARS` counts every attempt. Both env-overridable like `RENDER_WEEKLY_CAP`.
`GET /api/account` adds `narration: ttsAllowance(userId)` beside `renders`.

**`GET /api/tts/:reader/voices`** — entitlement-gated. The server walks the vendor's pagination on the
operator key (≤ 20 pages, cursor-loop guards as the client has), caches the RAW vendor voice objects
in memory for 24 h, and serves `{voices:[…], fetchedAt}`. The client keeps the ONE actor mapper
(`VOICE_MODELS[id].actor` + `_voiceCompactActors`) — the server stores vendor shape, the client
derives the compact list exactly as it does from its own key today (one mapper, two transports).
`?refresh=1` forces a re-fetch for an admin only.

**Secret:** `SPEECHIFY_API_KEY` — the owner's vendor credential, set by the owner with `flyctl secrets
set`. **Tests:** `test-tts-proxy.mjs` (gates, both caps, metering incl. failures, the stream
passthrough and the catalog cache against a local stub through `TTS_UPSTREAM_BASE`, the
`LLM_UPSTREAM_BASE` pattern), `sabotage-tts-proxy.mjs`. **Version:** server 1.10.0 + a
`DEPLOY_1.10.0_tts_gateway.md` receipt; the owner deploys.

## Client design (game)

**ONE route predicate** — `voiceRoute(id)` (tts.js, pure over `VOICE_MODELS`, `_voiceKey`,
`storageAdapter`, `serverAccount`): an own key wins (`{own:true, key}` — BYOK unchanged, the fal
precedent); else a signed-in entitled player on a reader whose entry declares `server:true` rides the
gateway (`{server:true}`); else `null`. Every key test in the voice stack dispatches through it:

- `VOICE_MODELS.speechify.server = true` — the only per-reader change; Inworld later = one flag once
  the server carries its entry.
- `_voiceFetch`: a server route posts the SAME body to `<server>/api/tts/<id>` with the session header
  and `Accept`; the audio decode is unchanged. A 429 `tts-allowance` refusal degrades the reader with
  the server's message (the one-per-session toast pattern) so the read falls to the Piper tier.
- `_voiceLoadCatalog`: a server route GETs `<server>/api/tts/<id>/voices` and maps the raw voices with
  the same `m.actor` path; the "Enter an API key before loading voices" guard becomes route-aware.
- `TTS_PROVIDERS[id].available()`: `!!_voiceKey(id)` → `!!voiceRoute(id)`.
- `_voiceValidate`: "Enter a … API key" fires only when there is no route at all.
- A parsing helper beside `renderAllowanceRefusal` (helpers.js) recognises the 429 body;
  `narrationAllowanceExhausted()` beside `renderAllowanceExhausted()` for the readout.

**Voice Settings (ui-voice-settings.js, ui-boot.js):** the menu row loses `fm-dev-only`; the key
block gets `class="fm-dev-only"` (the existing `!important` rule hides it for a non-admin); a server
route paints "Connected through the server · N of CAP characters this week" from
`serverAccount.narration`; the primary dropdown lists a model for a non-admin only when
`!m.key || voiceRoute(id)` (ruling 5) — admins see everything. The Account modal shows narration
beside images.

**Tests:** engine assertions for `voiceRoute` (own key wins; server only when signed in, entitled and
flagged; Gemini/Inworld unflagged → null) and the dropdown predicate; additions to
`tests-401-voice-settings.js` (non-admin: row visible, key block hidden, only reachable readers);
a standalone `tests-622-tts-gateway.js` over a scripted fetch (synthesis via the server with the
session header and no vendor key; catalog via the server; a 429 degrades to Piper with one toast;
an own key goes to the vendor; unsigned keyless → Piper only); `sabotage-622-tts-gateway.js`.

## What this does NOT change

The Piper tiers (tnd-tts server, offline wasm, device voice) and their ladder. The 2026-09-11 reason
for hiding the modal is honoured by hiding the key fields, not the modal. Gemini TTS stays BYOK and
hidden from non-admins. No prompt, parser or memory surface is touched — off the drift surface.
