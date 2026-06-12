# Traffic and Dragons — TODO

## Feature backlog

| # | Task | Effort | Status |
|---|---|:---:|---|
| 1 | Multiplayer — 2-player co-op, alternating turns, shared world state but per-player character. Split-party supported. | XL | Unblocked — needs HUD (#10) first |
| 2 | Multiple active campaigns — each player runs their own campaign simultaneously (e.g. two household members on separate devices). Currently works if each person uses their own GitHub account for server sync. Becomes a first-class requirement when the subscription model lands — subscription accounts replace GitHub accounts as the isolation boundary. | — | Works today via per-user GitHub auth; revisit at subscription launch |
| 3 | Legacy characters — past player characters from other campaigns appear as NPCs. 5% chance per new npc. Scan other campaign slots in localStorage for worldState.character. Once appeared in a campaign, flagged so they can't appear again in that campaign. Inject into system prompt for organic GM introduction. | — | ✅ Done — ready to test. Enable via Admin menu checkbox + chance % input. Set to 100% to force on next session load. |
| 4 | Text to speech — separate voices for GM, player, NPCs, and system. Car audio is a primary use case. | M | ⚠ Partially done — GM voice working, per-character voices pending |
| 5 | **[subtask]** Table Talk voice — voice for out-of-character tab | S | Deferred to second pass |
| 6 | **[subtask / reach]** Car Mode — dedicated UX: large touch targets, auto-play on, voice input, suggested actions read as numbered list | XL | Reach goal |
| 7 | **[subtask]** Per-character voices — GM, player, NPCs each get an assigned voice ID stored on the character/NPC object | M | Pending |
| 8 | Game document | L |  |
| 9 | Campaign designer (+ module system + alternative worlds) — guided UI for creating campaign settings, world presets, factions, plot hooks. Large scope, low priority. | XL |  |
| 10 | Multi-player HUD layout — needed before #1 | S | Ready to test — compact party cards (name + HP bar + XP) appear as a second topbar row when party members exist |
| 11 | Swappable LLM support — provider adapter in `callGM()`, key storage per provider, provider selector in Admin menu | M |  |
| 12 | **[subtask]** ChatGPT (OpenAI) — `api.openai.com/v1/chat/completions`; messages format nearly identical to Anthropic; lowest-effort, highest-value first target | M | Pending |
| 13 | **[subtask]** Gemini (Google) — `generativelanguage.googleapis.com`; different body schema (`contents`, `generationConfig`), different response path; moderate adapter work | M | Pending |
| 14 | **[subtask]** Grok (xAI) — OpenAI-compatible endpoint (`api.x.ai/v1`); adapter nearly identical to ChatGPT subtask; add after #12 | S | Pending |
| 15 | **[subtask / exploration]** Local LLM (Ollama) — OpenAI-compatible localhost API; near-zero adapter work after #12; CORS friction on https origin; tag system reliability is the real risk — 70B+ needed, rules out most consumer hardware including 16GB VRAM; revisit when quantized 70B quality improves | M | Exploration only |
| 16 | Per-turn relationship and XP tracking for all party members — relationship status and XP for companions and player should update on the character sheet after significant events (combat, key decisions, major NPC interactions). Both tracked per-turn, visible on the sheet without opening a modal. | — | ✅ Done — XP in HUD (pulse on change), companion XP in party cards, relationship toasts (add/update/remove) for player + companions |
| 17 | Create story compiler, to take the narative sumaries and weave them together into a short story.  PDF final project, or html as a fallback | L | Planning doc written ([STORY_COMPILER.md](STORY_COMPILER.md)) — chunked compile, standalone HTML first, ~5.5h build estimate. Ready to build. |
| 18 | Add a necromancer class | — | ✅ Done — data.js: CLSS, ABILS, ARCHETYPES, CLASS_FEATURES, SPELLS, STAT_PRIORITY |
| 19 | NPC first-encounter memory — always preserve the full details of a player's first meeting with each NPC. Player should be able to ask "remember when we met [name]?" and get an accurate, vivid answer. Store in `memory.npcs[name].firstEncounter` as a dedicated prose field written once on first contact, never overwritten. Inject into the NPC detail block in `memoryNpcDetail()`. | — | ✅ Done — hardened in v1.26 review: suggestion line stripped, sentence-boundary cut, captured from [NPC:] or [PARTY_MEMBER:] whichever first, preserved across NPC_MERGE |
| 20 | Voice-to-text input — investigate options for speech input on the text field. Candidates: Web Speech API (built-in Chrome, zero dependencies), Whisper via fal.ai (high accuracy, latency cost), hex or similar. Car Mode (#6) is a primary driver — hands-free play. Evaluate accuracy, latency, and offline/mobile support. | S | Pending — needs investigation |

**Effort:** S < 1h · M 1–3h · L 3–8h · XL multi-session · — done or no work currently needed

---

## Known issues

- **Campaign UI issues** — ✅ Fixed: `onServer` flag stripped on save (root cause), modal now shows instantly from local data and syncs in background, 10s fetch timeout added, double-sync on connect removed.
- **Portrait drag** — ✅ code verified (mouse + touch handlers both wired, offset persists); phone verification after next deploy
- **iOS notch** — ✅ +5px added (topbar safe-area padding 13px → 18px, v1.28); verify on phone after deploy
- **F-11** — ✅ Fixed v1.28: `_sbPicks` now a declared global in globals.js
- **`index.html` redirect** — ✅ already fixed (points to dnd_game_1_0.html); known issue was stale
- **Local folder rename pending** — `dnd_rpg` → `traffic-and-dragons`. Do in Explorer BEFORE opening Claude Code; then update hardcoded paths in `.claude/settings.local.json` + `.claude/hooks/stop-check.js` as the first act of the next session.
- **Qwen render bug** — ⚠ Probable fix v1.28: `qwen-image-edit` is edit-style and preserves the input image at low strength; bumped 0.6 → 0.9. **Needs one live Qwen render with a portrait set to confirm.**
- **Character import (setup) skips steps** — ✅ Fixed v1.28: "Play as X" now opens a campaign-setup modal (campaign name, world tone, starting location) instead of hardcoding Sword & Sorcery and skipping everything. Companions are added in-game via Import Character → Add as companion.
- **Companion import dumps narrative text** — ✅ Fixed v1.28: the GM intro instruction now goes through `sendAction(intro,{silent:true})` — it reaches the GM but no longer renders as a player chat bubble.
- **Welcome back screen — blank narrative** — ✅ Fixed v1.28: when sessionLog is empty (e.g. cleared by summarization), the reload path now shows "*Previously:* [last chapter summary]" so the player always has context.
- **Service worker pinned stale deploys (root cause found during v1.28 batch)** — ✅ Fixed: `sw.js` was cache-first keyed on a manually-bumped `CACHE` constant (last bumped 2026-06-04), so installed browsers never saw new deploys without "Clear cache & reload". Now network-first with cache fallback; `tts.js` added to the offline shell. Browsers with the old SW need one manual Clear cache & reload to pick up the new SW; self-healing after that.

---

## Architecture decisions

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
