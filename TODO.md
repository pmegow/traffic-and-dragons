# Traffic and Dragons — TODO

## Feature backlog

| # | Task | Status |
|---|---|---|
| 1 | Multiplayer — 2-player co-op, alternating turns, shared world state but per-player character. Split-party supported. | Unblocked — needs HUD (#26) first |
| 2 | Multiple active campaigns — each player runs their own campaign simultaneously (e.g. two household members on separate devices). Currently works if each person uses their own GitHub account for server sync. Becomes a first-class requirement when the subscription model lands — subscription accounts replace GitHub accounts as the isolation boundary. | Works today via per-user GitHub auth; revisit at subscription launch |
| 3 | Legacy characters — past player characters from other campaigns appear as NPCs. 5% chance per new npc. Scan other campaign slots in localStorage for worldState.character. Once appeared in a campaign, flagged so they can't appear again in that campaign. Inject into system prompt for organic GM introduction. | ✅ Done — ready to test. Enable via Admin menu checkbox + chance % input. Set to 100% to force on next session load. |
| 4 | Text to speech — separate voices for GM, player, NPCs, and system. Car audio is a primary use case. | ⚠ Partially done — GM voice working, per-character voices pending |
| 5 | **[subtask]** Table Talk voice — voice for out-of-character tab | Deferred to second pass |
| 6 | **[subtask / reach]** Car Mode — dedicated UX: large touch targets, auto-play on, voice input, suggested actions read as numbered list | Reach goal |
| 7 | **[subtask]** Per-character voices — GM, player, NPCs each get an assigned voice ID stored on the character/NPC object | Pending |
| 8 | Game document |  |
| 9 | Campaign designer (+ module system + alternative worlds) — guided UI for creating campaign settings, world presets, factions, plot hooks. Large scope, low priority. |  |
| 10 | Multi-player HUD layout — needed before #2 | Ready to test — compact party cards (name + HP bar) appear as a second topbar row when party members exist |
| 11 | Swappable LLM support — provider adapter in `callGM()`, key storage per provider, provider selector in Admin menu |  |
| 12 | **[subtask]** ChatGPT (OpenAI) — `api.openai.com/v1/chat/completions`; messages format nearly identical to Anthropic; lowest-effort, highest-value first target | Pending |
| 13 | **[subtask]** Gemini (Google) — `generativelanguage.googleapis.com`; different body schema (`contents`, `generationConfig`), different response path; moderate adapter work | Pending |
| 14 | **[subtask]** Grok (xAI) — OpenAI-compatible endpoint (`api.x.ai/v1`); adapter nearly identical to ChatGPT subtask; add after #14 | Pending |
| 15 | **[subtask / exploration]** Local LLM (Ollama) — OpenAI-compatible localhost API; near-zero adapter work after #14; CORS friction on https origin; tag system reliability is the real risk — 70B+ needed, rules out most consumer hardware including 16GB VRAM; revisit when quantized 70B quality improves | Exploration only |
| 16 | Per-turn relationship and XP tracking for all party members — relationship status and XP for companions and player should update on the character sheet after significant events (combat, key decisions, major NPC interactions). Both tracked per-turn, visible on the sheet without opening a modal. | ✅ Done — XP in HUD (pulse on change), companion XP in party cards, relationship toasts (add/update/remove) for player + companions |
| 17 | Create story compiler, to take the narative sumaries and weave them together into a short story.  PDF final project, or html as a fallback |  |
| 18 | Add a necromancer class | ✅ Done — data.js: CLSS, ABILS, ARCHETYPES, CLASS_FEATURES, SPELLS, STAT_PRIORITY |
| 19 | NPC first-encounter memory — always preserve the full details of a player's first meeting with each NPC. Player should be able to ask "remember when we met [name]?" and get an accurate, vivid answer. Store in `memory.npcs[name].firstEncounter` as a dedicated prose field written once on first contact, never overwritten. Inject into the NPC detail block in `memoryNpcDetail()`. | ✅ Done — auto-captured from cleanTxt on first NPC tag; injected as "First met:" in memoryNpcDetail |
| 20 | Voice-to-text input — investigate options for speech input on the text field. Candidates: Web Speech API (built-in Chrome, zero dependencies), Whisper via fal.ai (high accuracy, latency cost), hex or similar. Car Mode (#7) is a primary driver — hands-free play. Evaluate accuracy, latency, and offline/mobile support. | Pending — needs investigation |

---

## Known issues

- **Campaign UI issues** — ✅ Fixed: `onServer` flag stripped on save (root cause), modal now shows instantly from local data and syncs in background, 10s fetch timeout added, double-sync on connect removed.
- **Portrait drag** — implemented, needs browser verification
- **iOS notch** — deployed to Netlify, needs phone verification after cache clear
- **F-11** — `window._sbPicks` namespace pollution, deferred, low risk
- **`index.html` redirect is stale** — redirects to `dnd_game_20_4.html` (in BAK); should point to `dnd_game_1_0.html`
- **Local folder rename pending** — `dnd_rpg` → `traffic-and-dragons`
- **Qwen render bug** — Qwen model appears to be rendering the portrait image instead of the scene prompt. Investigate `doRender()` img2img path for Qwen: check whether the `image_urls` field is being sent when no portrait-seeded render is intended, or whether the model selection logic is falling through to img2img incorrectly.
- **Character import (setup) skips steps** — importing a character file during character creation jumps straight to the review step (step 7), bypassing companion selection and starting environment. User should land on step 7 but still be able to navigate back to earlier steps, or the import should at minimum ask about companions and starting location before finalising.
- **Companion import dumps narrative text** — adding an imported character as a companion injects unwanted raw text into the story narrative. May already be fixed — verify the companion-import flow end-to-end and confirm no spurious `addMsg` calls fire during `sendAction` companion introduction.
- **Welcome back screen — blank narrative** — on reload/resume, if the session log has no re-renderable messages the narrative area is blank. Always print the last GM response (or last two turns) when reopening a campaign so the player has context. See `init()` reload logic in `game.js`.

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
