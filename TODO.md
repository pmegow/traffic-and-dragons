# Traffic and Dragons — TODO

## Feature backlog

| # | Task | Effort | Status |
|---|---|:---:|---|
| 1 | Multiplayer — 2-player co-op, alternating turns, shared world state but per-player character. Split-party supported. | XL | Unblocked — needs HUD (#10) first. **When built, decide stable entity IDs here** — see "Stable entity IDs" in Architecture decisions. |
| 2 | Multiple active campaigns — each player runs their own campaign simultaneously (e.g. two household members on separate devices). Currently works if each person uses their own GitHub account for server sync. Becomes a first-class requirement when the subscription model lands — subscription accounts replace GitHub accounts as the isolation boundary. | — | Works today via per-user GitHub auth; revisit at subscription launch |
| 3 | Legacy characters — past player characters from other campaigns appear as NPCs. 5% chance per new npc. Scan other campaign slots in localStorage for worldState.character. Once appeared in a campaign, flagged so they can't appear again in that campaign. Inject into system prompt for organic GM introduction. | — | ✅ Done — ready to test. Enable via Admin menu checkbox + chance % input. Set to 100% to force on next session load. |
| 4 | Text to speech — separate voices for GM, player, NPCs, and system. Car audio is a primary use case. | M | ⚠ Partially done — GM voice working, per-character voices pending |
| 5 | **[subtask / reach]** Car Mode — dedicated UX: large touch targets, auto-play on, voice input, suggested actions read as numbered list | XL | Reach goal |
| 6 | **[subtask]** Per-character voices — GM, player, NPCs each get an assigned voice ID stored on the character/NPC object | M | Pending |
| 7 | Game document | L |  |
| 8 | Campaign designer (+ module system + alternative worlds) — guided UI for creating campaign settings, world presets, factions, plot hooks. Large scope, low priority. | XL |  |
| 9 | Multi-player HUD layout — needed before #1 | S | Ready to test — compact party cards (name + HP bar + XP) appear as a second topbar row when party members exist |
| 10 | Swappable LLM support — provider adapter in `callGM()`, key storage per provider, provider selector in Admin menu | M | ✅ Done (v1.30) — `PROVIDERS` table in globals.js (provider object w/ headers/buildBody/parseResponse, no if-branches); `callGM()` routes through `activeProvider`; per-provider key + model persisted; 🧠 Language Model modal in all 3 Dev menus; legacy AKK key auto-migrated. Abstraction transfers to server-side routing. |
| 11 | **[subtask]** ChatGPT (OpenAI) — `api.openai.com/v1/chat/completions`; messages format nearly identical to Anthropic; lowest-effort, highest-value first target | M | ✅ Done + live-confirmed on gpt-4o (v1.30→v1.32). ✅ response parsing, ✅ summarize() JSON, ✅ suggestion buttons (added un-asterisked parse fallback — gpt drops the `*...*`), ✅ state-mutation tags after fix — verified 3 consecutive gold turns (−2, −1, −3) across BOTH typed and pill-button input paths. **The gotcha:** gpt narrated changes without emitting `[GOLD:-N]`; fixed via per-provider `reinforce` block (openai only — a forceful MANDATORY-TAG-DISCIPLINE prompt suffix appended in callGM for gameplay turns) + loosened GOLD/HP regex. Earlier apparent misses were stale-file SW caching, not the model. |
| 12 | **[subtask]** Gemini (Google) — `generativelanguage.googleapis.com`; different body schema (`contents`, `generationConfig`), different response path; moderate adapter work | M | ✅ Adapter built + shape-verified (v1.37) — `PROVIDERS.gemini`: endpoint is a `function(model)` (model in URL), `x-goog-api-key` header, system in `systemInstruction`, `contents[]` with role `model`, parse `candidates[0].content.parts[0].text`. callGM resolves function-endpoints. ⏳ Needs a live key + money-turn tag-fidelity test (verify model names current too). |
| 13 | **[subtask]** Grok (xAI) — OpenAI-compatible endpoint (`api.x.ai/v1`); adapter nearly identical to ChatGPT subtask; add after #12 | S | ✅ Adapter built + shape-verified (v1.37) — `PROVIDERS.grok`, OpenAI-compatible (copy of openai shape), `api.x.ai` endpoint, shared `TAG_REINFORCE`. ⏳ Needs a live `xai-…` key + money-turn test. |
| 14 | **[subtask / exploration]** Local LLM (Ollama) — OpenAI-compatible localhost API; near-zero adapter work after #12; CORS friction on https origin; tag system reliability is the real risk — 70B+ needed, rules out most consumer hardware including 16GB VRAM; revisit when quantized 70B quality improves | M | ✅ Adapter built (v1.37) — `PROVIDERS.ollama`, OpenAI-compatible, `localhost:11434`. **Caveat baked in:** http localhost is mixed-content-blocked from https (Netlify) and dead from file:// — only works when the game is served from localhost. Exploration tier; tag fidelity is the real risk (heavy `reinforce` + extraction-pass backstop if needed). |
| 15 | Per-turn relationship and XP tracking for all party members — relationship status and XP for companions and player should update on the character sheet after significant events (combat, key decisions, major NPC interactions). Both tracked per-turn, visible on the sheet without opening a modal. | — | ✅ Done — XP in HUD (pulse on change), companion XP in party cards, relationship toasts (add/update/remove) for player + companions |
| 17 | Add a necromancer class | — | ✅ Done — data.js: CLSS, ABILS, ARCHETYPES, CLASS_FEATURES, SPELLS, STAT_PRIORITY |
| 18 | NPC first-encounter memory — always preserve the full details of a player's first meeting with each NPC. Player should be able to ask "remember when we met [name]?" and get an accurate, vivid answer. Store in `memory.npcs[name].firstEncounter` as a dedicated prose field written once on first contact, never overwritten. Inject into the NPC detail block in `memoryNpcDetail()`. | — | ✅ Done — hardened in v1.26 review: suggestion line stripped, sentence-boundary cut, captured from [NPC:] or [PARTY_MEMBER:] whichever first, preserved across NPC_MERGE |
| 19 | Voice-to-text input — investigate options for speech input on the text field. Candidates: Web Speech API (built-in Chrome, zero dependencies), Whisper via fal.ai (high accuracy, latency cost), hex or similar. Car Mode (#6) is a primary driver — hands-free play. Evaluate accuracy, latency, and offline/mobile support. | S | ⚠ v1.40 — Web Speech API shipped (`stt.js`): 🎤 mic in `#inrow` dictates into the field, support-gated (hidden in Firefox). Foundation only — review-and-Send, not yet auto-send. Needs a real-device accuracy/latency test (Android Chrome) before judging the API good enough for hands-free. |
| 20 | Character rename / add surname — let players change or add a last name to an existing character (e.g. earn a surname, take a title). Mechanically low-pain: name is a label in HUD/sheet/system-prompt (auto-refresh) but a *key* in the NPC relationship graph, companion charSheet relationships, and NPC back-references — those need a migration sweep OR, cleaner, reuse the existing `[NPC_ALIAS:]`/`resolveNpcName()` machinery and register the old name as an alias of the new. Baked prose (chapter summaries, lore, firstEncounter) keeps the old name — accept as narrative drift, optionally drop a one-line "formerly known as" note into GM context. See memory.js alias system. | M | Pending — design noted |
| 21 | Add "Mind Wipe" and "Mind Wipe II"  to the arcane trickster's list of spells:  Mindwipe: Alter the target's memory removing up to 15 minutes * caster's int modifier.  "Mind Wipe II" remove specific events or characters from target's memory.  Both SAV vs WIS | — | ✅ Done (v1.35) — renamed: **Lethe's Kiss** (t3, narrative, 15min × INT mod, WIS save) + **Oubliate** (t4, WIS save). Oubliate has engine teeth: new `[NPC_FORGET:name\|what]` tag scrubs matching entries from `memory.npcs[name].knowledge[]`/`.events[]` so the wipe sticks against re-injection. Verified surgical removal in preview. |
| 22 | Quest system — emergent, player-gated quests with objectives, journal UI, anti-drift re-injection | — | ✅ Built (v1.34) — `questLog[]` {title,status,desc,objectives}; offered→active→completed/failed/declined; `[QUEST:title\|status\|desc]` + `[QUEST_STEP:]` tags; accept/decline gate (anti-fatigue); `buildQuestBlock()` re-injects authoritative active+offered each turn (anti-drift); archive to memory.quests; Quest Journal modal + sidebar indicator. Verified in preview; **needs live play-test** (see Known Issues). |
| 16 | Story compiler — weave the campaign into a cohesive short story the player can keep and read later. PDF final, HTML fallback. | L | Planning doc written ([STORY_COMPILER.md](STORY_COMPILER.md)) — chunked compile, standalone HTML first, ~5.5h build estimate. **DECISIONS (2026-06-15):** ① **Weave from VERBATIM PROSE, not chapter summaries** — the keepsake must preserve the actual told story (real dialogue / GM prose), not re-inflated summaries (this supersedes the doc's "memory.chapters is the spine"). ② Architecture: complete append-only **transcript = the flesh** (source prose), `memory.chapters` + `storyBeats` + `keyDecisions` = the **skeleton** (arc shape, pacing, and which transcript stretches to pull verbatim). ③ **Hard dependency — blocked on #25:** needs a complete/ordered/durable transcript that doesn't exist yet; the auto-export `.txt` files can't serve (desktop-only trigger, DOM-snapshot truncated by reload, scattered per-device). Build transcript capture FIRST. ④ Cost: skeleton must *select* transcript stretches, not feed all ~1200 turns. Chunking/voice/output sections of the doc still valid; only the input source changed. **Build parked** (user's call). |
| 25 | Append-only campaign transcript — capture a complete, ordered, durable record of every narrative turn (player action + GM prose), campaign-scoped, surviving reloads/device-hops. Cheap version: append in `addMsg` to a localStorage store (reload-proof, unlike the truncating DOM), ride along in the sync blob. Real version: server-side append-only log keyed by campaign+turn (ties to server-authority arc). Replaces the scattered per-device `.txt` auto-exports. | M | Pending — **prerequisite for #16** (verbatim-prose story compiler) and the fix for cross-device "complete set" of session logs. |
| 23 | Headquarters — a stable, customizable home base with persistent stash + residents. **"Stable" = anti-drift:** store HQ state as authoritative data, re-inject a "HEADQUARTERS — stash/residents" block into the prompt when `location===hq.node` (same pattern as quests/char-sheet). Reuses 3 systems: map node (HQ = node flagged home), companion system (resident = benched companion — alive, out of active party, persistently at HQ), inventory (stash = 2nd container). Model: `worldState.hq = {node, name, desc, stash:[], residents:[]}`. Tags (lean): `[HQ_SET:name]`, `[HQ_STORE:item]`/`[HQ_TAKE:item]`, `[HQ_RESIDENT:name\|true/false]`. Sub-feature worth building standalone: a **party bench/roster** (swap companions in/out) that HQ leans on. v1 = name+desc+stash+residents; base-building (rooms/upgrades/crafting/defenses/quartermaster) is phase 2, overlaps Campaign Designer (#9). Decide later: single HQ vs multiple safehouses (v1: one); bench via UI + narrative (like quest accept). | L | Pending — design noted |

**Effort:** S < 1h · M 1–3h · L 3–8h · XL multi-session · — done or no work currently needed

---

## Known issues

| # | Task | Effort | Status |
|---|---|:---:|---|
| 1 | Local folder rename — `dnd_rpg` → `traffic-and-dragons` | S | Pending — do in Explorer BEFORE opening Claude Code, then update hardcoded paths in `.claude/settings.local.json` + `.claude/hooks/stop-check.js` as the first act of next session |
| 3 | Test quest system (v1.34) — full live play-test with a real GM: GM offers a quest (⚑ toast + Opportunities), accept via journal AND via in-story agreement, confirm offered quests are NOT steered until accepted, objectives advance via `[QUEST_STEP:]`, completion archives + awards reward, decline archives. Watch for GM drift / hallucinated quest state across a summarization cycle. Also verify the GPT provider emits quest tags (reinforce covers it). | S | Ready to test |

---

## Architecture decisions

### Stable entity IDs vs. names-as-keys (2026-06)
**Decision:** Keep names as the internal key for now. Do NOT introduce hex/UUID entity IDs as a standalone refactor. Fold identity-by-ID into Multiplayer (#1) or the server-canonical model (subscription) — whichever lands first — where it becomes a near-free side effect instead of a project.

**The load-bearing constraint:** the GM is the dominant consumer of identity and it speaks in *names*, not IDs. Every state tag is `[NPC:Veyra|…]`, `[COMPANION_HP:Lyra|…]`, `[RELATIONSHIP:Veyra|…]`. The model can't reliably emit or track hex IDs, so name→ID resolution would still have to run on every tag at the parse boundary. IDs therefore don't *delete* `resolveNpcName()` — they demote it to a name→ID lookup we still own. The fuzzy part (aliases, "the merchant" vs. "Veyra", misspellings) lives in that layer either way.

**What IDs actually buy (narrow):** (1) two entities can share a display name simultaneously — twins, a reused "Guard," two Kaels — which aliases genuinely can't disambiguate; (2) rename/surname (#21) becomes a one-attribute flip with all edges surviving.

**What they cost (broad):** every `memory.npcs` key, `worldState.npcs[].name` comparison, relationship `entity`, graph edge, `findCompanionChar`, the save schema (v10→v11), plus a migration for every save already in players' localStorage — in an ES5, no-test codebase.

**Asymmetry = the answer:** broad cost, narrow payoff, *because the name-resolution layer stays regardless.* So IDs only pencil out when something else (multiplayer name collisions; server primary keys) needs them anyway and is already touching the save format.

**Today's 80/20:** make the existing alias/resolution layer (`[NPC_ALIAS:]` / `resolveNpcName()` in memory.js) the canonical identity mechanism — rename = register old name as alias of new. Covers #21 with no schema change. Optional low-regret hedge: start stamping an unused `id` on character/NPC nodes at creation so future ID-keyed code has them — but only worth it once #1 is real (otherwise YAGNI).

### Subscription model (2026-06)
**Decision:** Traffic and Dragons will ship as a subscription service. Users will not bring their own API keys.

**Rationale:** Broader audience requires abstracting away the Anthropic API key. Subscription revenue funds the API costs and server infrastructure.

**What this means architecturally:**
- All Claude API calls move server-side. `callGM()` in `api.js` will hit the T&D server instead of `api.anthropic.com` directly.
- The server holds the Anthropic key and proxies requests. It also handles rate limiting and usage tracking per subscription tier.
- `anthropic-dangerous-direct-browser-access: true` header goes away entirely.
- GitHub OAuth is already in place on the server — add subscription tiers on top of it.
- Migration path is clean: `callGM()` is a single function. Pointing it at the server unlocks the whole model.
- Client wraps in Electron for desktop app distribution. File System Access API works natively in Electron.

### Provider adapter & forward compatibility (2026-06)
**Decision:** Build swappable-LLM support (#11) as a clean provider abstraction, ChatGPT first. The abstraction is forward-compatible with the subscription model — it is *not* throwaway work despite the BYO-key vs. server-key tension.

**The shape:** a provider object — `{ id, label, endpoint, headers(key), buildBody(msgs, sys, maxTok), parseResponse(json) }`. `callGM()` selects the active provider and calls `buildBody`/`parseResponse`. NO `if(provider==="openai")` branches sprinkled through the code.

**Why it survives the subscription pivot:** the subscription model moves `callGM()` server-side with the Anthropic key on the server — which superficially looks like it obsoletes client-side multi-provider. It doesn't: (1) the server will need the *same* provider-routing table to offer model choice across tiers, so the abstraction transfers from client to server almost verbatim; (2) until subscription ships, BYO-key multi-provider is a real feature for current power users. Build the abstraction once, move it server-side later.

**Why ChatGPT first (de-risk, not just lowest-effort):** the #1 unknown for *all* multi-provider work — client or server — is whether a non-Claude model reliably emits the state-tag grammar (`[NPC:…]`, `[COMPANION_HP:…]`, the trailing `*You could…*` line, JSON-only `summarize()` output). The OpenAI adapter is the cheapest probe of that question. If GPT respects the tags, the whole #11/#12–15 line is green-lit; if it mangles them, far better to learn it in one evening than underneath a finished Car Mode. OpenAI's `messages` format is nearly identical to Anthropic's, so the adapter is small and the signal is almost pure "does the model follow the tag contract."

**OUTCOME (v1.32, confirmed live):** de-risk landed **positive, with one caveat**. gpt-4o handles everything structural (response parsing, JSON `summarize()`, the suggestion line — though it drops the `*asterisks*`, so `parseActions` gained an un-asterisked fallback). The gotcha: gpt treats *inline state tags as optional* — it narrates "you pay 5 gold" without emitting `[GOLD:-5]`, because OpenAI models are trained against leaking bracket-codes into prose. **Fix that worked:** a per-provider `reinforce` string (a forceful tag-discipline suffix) appended in `callGM()` for gameplay turns, OpenAI only — Claude stays lean. Live-verified across 3 consecutive gold turns on both input paths. **Implications:** (1) the abstraction earned its keep — the entire fix lived in the provider object; (2) every future non-Claude provider (#13–15) will likely need its own `reinforce`, now a known cheap step; (3) if reinforcement ever proves insufficient for a weaker model, the backstop is an **extraction pass** — a second `summarize()`-style call that pulls tags from the prose (structured extraction is the one thing every model does reliably).

### Server & services shape — START THINKING (2026-06, not yet decided)
**Status:** Open thinking, not a decision. Seeded so the design has a home. There is already a server — `traffic-and-dragons-server` on Fly.dev (GitHub OAuth, campaign + character + state sync, SQLite/Turso). Today it's a sync backend; under subscription it becomes the core service.

**The shift:** sync backend → **API gateway + account system + billing**. The server stops being optional.

**Open questions to resolve before building:**
- **LLM proxy:** server holds the Anthropic (and other-provider) keys, proxies `callGM()`. Needs streaming passthrough, per-tier rate limiting, usage metering (tokens in/out per user per turn), and abuse/runaway-cost guards. This is where the provider-adapter table (above) lands server-side.
- **Billing:** Stripe? Tiers (free trial / monthly / annual)? Metered overage vs. hard caps? Tier → model mapping (e.g. free = Haiku, paid = Sonnet/Opus). How does a lapsed subscription degrade — read-only, or locked?
- **Auth evolution:** GitHub OAuth is the current isolation boundary. Subscription accounts must replace/augment it (#2 note). Email+password? Keep OAuth as a login option but make the subscription the entitlement? Migration path for existing GitHub-keyed campaigns.
- **State authority:** today the client owns `worldState`/`memory` and syncs up. Does the server stay a dumb blob store, or become authoritative (needed for multiplayer #1 and anti-cheat)? Authoritative state is a much bigger build but unlocks multiplayer + server-canonical entity IDs.
- **Cost model sanity:** a single long campaign turn can be ~2–4k tokens system prompt + response; summarize() spikes to 2k output. At scale this is the dominant cost — metering and prompt-size discipline are load-bearing for unit economics, not nice-to-haves.
- **Deploy/scale:** Fly.dev single-region today (`flyctl deploy --ha=false`). Multi-region? DB scaling (Turso edge replicas)? Secrets management for N provider keys.
- **Electron desktop wrapper:** how does the desktop build authenticate to the same subscription backend?

**Next step (a future session, not tonight):** draft `SERVER_ARCHITECTURE.md` — survey the existing server's actual endpoints/schema first, then design the gateway + billing + auth layers against it. Same planning-doc pattern as STORY_COMPILER.md.

### Narrative knowledge graph (2026-06)
**Decision:** Build a structured NPC relationship index injected into every system prompt.

**Rationale:** As sessions get long and chapters compress, the GM loses fidelity on NPCs — hallucination and character drift become frequent. A machine-readable relationship web gives the GM a stable anchor that survives context compression better than prose summaries.

**Design:**
- NPC↔NPC edges via `[NPC_LINK:]` tag, stored in `memory.npcGraph.edges[]`
- Factions via `[FACTION:]`, `[NPC_FACTION:]`, `[FACTION_REL:]` tags
- `buildNpcGraph()` injects compact block into system prompt
- Faction display in world state sidebar, NPC faction membership on NPC sheet

### File System Access API for campaign folders (2026-06)
**Decision:** Use `showDirectoryPicker()` to let users set a campaign root folder at game start. All exports route into organized subfolders (`saves/`, `logs/`, `renders/`, `characters/`).

**Rationale:** Browser can't auto-create folders without user permission. One prompt at game start is less disruptive than prompting mid-game. Chrome-only but acceptable given target audience.

### Campaign name field (2026-06)
**Decision:** Add explicit campaign name field to Review step (step 7) of character creation, defaulting to character name.

**Rationale:** `worldState.campName` is the stable identifier used in all file exports and folder naming. Previously defaulted silently to char name which meant renaming a character didn't update file naming. Now set intentionally at campaign creation.

### Legacy characters (2026-06)
**Decision:** 5% chance per session load that a past player character from another campaign appears as an NPC.

**Rationale:** Rare enough to be surprising and feel meaningful. Once per campaign per character to prevent repetition. Sourced from other campaign slots in localStorage — no separate storage needed.

### OAuth for file:// origin (2026-06)
**Decision:** Replace postMessage with server-side auth ticket polling.

**Rationale:** Chrome blocks `postMessage` from `https://` to `file://` origin. New flow: server creates short-lived ticket in `auth_tickets` table after OAuth, client polls `/auth/ticket/:ticket` to claim it. Also listens for postMessage as fallback (works on Netlify). Ticket auto-expires after 5 minutes.

### Module system → Campaign designer (2026-06)
**Decision:** Folded module system (#5) into campaign designer (#18).

**Rationale:** Module system (alternate campaign settings) is naturally a subset of the campaign designer feature. No point building them separately.

### Character import flow (2026-06)
**Decision:** Import Character shows preview modal with two options: "Play as [name]" (new campaign) and "+ Add as companion to current campaign".

**Rationale:** Adding a character as a companion is a natural use case especially in multiplayer prep. Companion is added to `worldState.npcs` with full `charSheet` and introduced into the current scene via `sendAction`.
