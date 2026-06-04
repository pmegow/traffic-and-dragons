# Traffic and Dragons — TODO

## Feature backlog

| # | Task | Status |
|---|---|---|
| 1 | Cloud sync | ✅ Done |
| 2 | Multiplayer — 2-player co-op, alternating turns, shared world state but per-player character. Split-party supported. Companion system (#9) is a useful stepping stone. | Unblocked by #1 |
| 3 | File menu on all screens | ✅ Done |
| 4 | Load campaign from tone step — import button exists on step 1 | ✅ Done |
| 6 | Load character / skip char creation — character browser + preview modal | ✅ Done |
| 7 | Name campaigns + file organization | ✅ Done |
| 7a | File/download folder structure — File System Access API, subfolders per export type | ✅ Done |
| 8 | Alternative starting worlds — varied world presets at campaign start | Folded into #18 |
| 9 | Companions system — campaign start only, max 3, load saved char or random | |
| 10 | Narrative flavor / prose style — let player influence GM writing style beyond tone presets | 🟢 Low-hanging fruit |
| 11 | File menu cleanup for release | ✅ Done |
| 12 | Multiple active campaigns review | |
| 13 | Legacy characters | ⚠ Needs description — original intent unknown |
| 14 | Text to speech / voice commands | |
| 15 | Persistent image gallery | |
| 16 | Narrative knowledge graph | ✅ Done — `memory.npcGraph.edges[]` stores NPC↔NPC and NPC↔player links. `[NPC_LINK:name1\|name2\|relationship]` tag updates the graph. `buildNpcGraph()` injects a compact block into every system prompt after ACTIVE NPC DETAILS. Player→NPC relationships from `character.relationships` included automatically. |
| 17 | Game document | |
| 18 | Campaign designer (+ module system + alternative worlds) — guided UI for creating campaign settings, world presets, factions, plot hooks. Large scope, low priority. | |
| 19 | Player takeover | Low priority |
| 20 | Tweak img2img weighting — expose strength slider in Render Options | Low priority |
| 21 | Production/subscription architecture — move all Claude API calls server-side. `callGM()` hits the server, server proxies to Anthropic with shared key. Server handles auth, rate limiting, usage per subscription tier. GitHub OAuth already in place — add subscription layer on top. `anthropic-dangerous-direct-browser-access` header goes away. Desktop app via Electron (see #23). | |
| 23 | App distribution — get the game onto phones and desktops as a real installable app, not a browser page. **Phase 1 (now, no dependencies):** PWA — add a web manifest + service worker to the existing HTML. Users tap "Add to Home Screen" on iOS/Android, installs like an app, zero app store friction. **Phase 2 (after #21):** Capacitor — wraps the existing HTML/JS in a native shell, produces real iOS and Android apps for App Store / Google Play submission. Requires #21 first because direct Anthropic API calls from a packaged app are a security risk (key exposed in bundle). **Phase 3 (after #21):** Electron — Windows/Mac desktop app. Already called out in #21. Dependency chain: PWA has no deps; Capacitor and Electron both require #21. | |
| 22 | Multi-provider AI support — abstract `callGM()` into a provider adapter (endpoint, auth header, response shape, system prompt format differ per provider). Technical swap is 2-3 days. Real work is QA: the state tag system (`[HP:]`, `[NPC:]`, `[LOCATION:]` etc.) requires reliable structured output across 50+ turns — Claude handles this well, GPT-4o probably fine, Gemini inconsistent, Grok unknown. The location map and narrative knowledge graph (#16) both help weaker models by providing explicit structured world state rather than relying on prose reconstruction — completing #16 before attempting multi-provider is strongly recommended. Dependency of #21. Not worth attempting until #21 and #16 are done. | |

---

## Known issues

- **Relationships not populating on NPC sheets** — noticed, not investigated
- **`index.html` redirect is stale** — redirects to `dnd_game_20_4.html` (in BAK); should point to `dnd_game_1_0.html`
- **Local folder rename pending** — `dnd_rpg` → `traffic-and-dragons` (do in Explorer before opening Claude Code)
- **"↩ Import existing campaign" on tone step** — redundant with File menu; consider removing
- **Campaign name not set at creation** — defaults to character name; no prompt during char creation wizard. Add a name field to Review step (step 7).

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
- Nodes: NPCs + player character
- Edges: relationships (`[RELATIONSHIP:]` tags), shared locations, key events (`[NPC_NOTE:]`)
- Data already exists in `memory.npcs` and `character.relationships`
- Injected into system prompt alongside `memoryTOC()` — same pattern, richer structure
- Visual graph view is a bonus, not the primary goal

### File System Access API for campaign folders (2026-06)
**Decision:** Use `showDirectoryPicker()` to let users set a campaign root folder at game start. All exports route into organized subfolders (`saves/`, `logs/`, `renders/`, `characters/`).

**Rationale:** Browser can't auto-create folders without user permission. One prompt at game start is less disruptive than prompting mid-game. Chrome-only but acceptable given target audience.

**Rename behavior:** On campaign rename, copy all files from old folder to new folder (via async iterator + Promise chain), then `removeEntry()` on old folder. No file left behind in the old location.

### Module system → Campaign designer (2026-06)
**Decision:** Folded module system (#5) into campaign designer (#18).

**Rationale:** Module system (alternate campaign settings) is naturally a subset of the campaign designer feature. No point building them separately.

### Character import flow (2026-06)
**Decision:** "Import Character" opens a custom character browser (reads from campaign meta / server) rather than an OS file picker. Falls back to `.char` file import at the bottom of the browser.

**Rationale:** Cloud sync means all characters are already available without needing files. The browser works across devices once connected. `.char` file format kept for cross-user character sharing.
