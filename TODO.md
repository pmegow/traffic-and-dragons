# Traffic and Dragons — TODO

## Feature backlog

| # | Task | Status |
|---|---|---|
| 1 | Cloud sync | ✅ Done — OAuth ticket polling, per-campaign push/pull, server campaign list sync |
| 2 | Multiplayer — 2-player co-op, alternating turns, shared world state but per-player character. Split-party supported. | Unblocked — needs HUD (#26) first |
| 3 | File menu on all screens | ✅ Done |
| 4 | Load campaign from tone step | ✅ Done |
| 5 | Module system | ✅ Folded into #18 |
| 6 | Load character / skip char creation | ✅ Done |
| 7 | Name campaigns + file organization | ✅ Done — campaign name field on Review step |
| 7a | File/download folder structure | ✅ Done — File System Access API, folder prompt on game start |
| 8 | Alternative starting worlds | ✅ Folded into #18 |
| 9 | Companions system — campaign start only, max 3 | ⚠ Partially done — import-as-companion and ▶ play switch exist; campaign-start companion selection still needed |
| 10 | Narrative flavor / prose style | Pushed to bottom |
| 11 | File menu cleanup for release | ✅ Mostly done |
| 12 | Multiple active campaigns review | |
| 13 | Legacy characters — past player characters from other campaigns appear as NPCs. 5% chance per session load. Scan other campaign slots in localStorage for worldState.character. Once appeared in a campaign, flagged so they can't appear again in that campaign. Inject into system prompt for organic GM introduction. | Design done — not implemented |
| 14 | Text to speech | |
| 15 | Persistent image gallery | ✅ Covered by campaign folder structure |
| 16 | Narrative knowledge graph | ✅ Done — NPC↔NPC links, factions, faction relationships, sidebar + NPC sheet UI |
| 17 | Game document | |
| 18 | Campaign designer (+ module system + alternative worlds) — guided UI for creating campaign settings, world presets, factions, plot hooks. Large scope, low priority. | |
| 19 | Player takeover | ✅ Done — ▶ button on NPC sheets switches active player character |
| 20 | Tweak img2img weighting — expose strength slider in Render Options | Low priority |
| 21 | Racial benefits wiring | ✅ Done — pick limit increases per racial spell, "+N racial bonus" shown in spell picker |
| 22 | Font size option | ✅ Done — "Large text" in Admin, defaults to large on iOS |
| 23 | Names list — locate, expand, improve | ✅ Done — doubled to ~240, shuffled, rotating index, full names with surnames |
| 24 | Map node dimensions | ✅ Done — [LOCATION_SIZE:scale|travelMins] tag, injected in buildGeoBlock |
| 25 | iOS notch gutter | ✅ Done — deployed, needs phone verification |
| 26 | Multi-player HUD layout — needed before #2 | |
| 27 | Char creation AI assist | ✅ Done — ✦ per field + ✦ Randomise button on Review step |

---

## Known issues

- **Campaign UI issues** — server campaign sync timing unreliable; 3s timeout fallback added but needs proper hardening. Server campaigns not always appearing in picker when connected.
- **Portrait drag** — implemented, needs browser verification
- **iOS notch** — deployed to Netlify, needs phone verification after cache clear
- **F-11** — `window._sbPicks` namespace pollution, deferred, low risk
- **`index.html` redirect is stale** — redirects to `dnd_game_20_4.html` (in BAK); should point to `dnd_game_1_0.html`
- **Local folder rename pending** — `dnd_rpg` → `traffic-and-dragons`

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
