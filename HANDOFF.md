# Traffic and Dragons — Session Handoff

**Date:** 2026-06-23
**Deployed version:** v1.97 (string in `updateMemStatus()` in `ui.js`)
**Branch:** `master` — committed, not yet pushed.
**SW cache:** `tnd-v3-20260620y` (`sw.js`).
**Host:** **Cloudflare Pages** — `traffic-and-dragons.pages.dev`.

> Read `CLAUDE.md` first for architecture. This file is just "where we left off."

---

## What shipped since last handoff (v1.83 → v1.97)

| Ver | What |
|---|---|
| 1.83 | **Suggested actions 2nd→1st person** — `toFirstPerson()` converts "Gather your belongings" → "Gather my belongings" when a suggestion button transfers into the input or is sent. |
| 1.84 | **Prose voice mandate + em-dash strip** — forceful voice directive; `cleanTxt` strips em-dashes from display. |
| 1.85 | **Re-roll** — ↻ button regenerates the last scene in the current voice with no side effects. |
| 1.86 | **Prose voice directives** — dialled up to concrete sentence-level rules per author. |
| 1.87 | **Per-campaign prose voice** — stored on `worldState.proseAuthor`, syncs across devices. Device default is fallback for new/unset campaigns. |
| 1.88 | **GM error UI** — Retry stacks below the error message at matched width. |
| 1.89 | **Grok model update** — current xAI model IDs; surface provider error messages. |
| 1.90 | **#14 close-out: structured `[ACTIONS:]` tag** — replaces fragile prose-parsing. `parseActions(clean,raw)` reads `[ACTIONS:first\|second\|third]` from raw response. Legacy `*You could...*` parsing kept as fallback for old saves. Label-strip regex requires a delimiter (`[A-C][)\].:]\s*`) so real words like "Call" survive. |
| 1.91 | **#21: First aid kit** — every new character starts with a first aid kit in inventory. |
| 1.92 | **Poe + Lovecraft** — two public-domain prose-inspiration voices added to AUTHORS. |
| 1.93 | **Quest bug fix** — anti-administrative rule ate supernatural "inheritance" quest hooks; carved out supernatural-legacy exceptions. |
| 1.94 | **Party-join + intimacy fade fixes** — DEFAULT_RULES now mandate `[PARTY_MEMBER:name\|true]` on joins (with "INVISIBLE to the roster" warning). Adult block adds explicit anti-fade instruction. |
| 1.95 | **Party size cap** — `PARTY_MAX=4` (player + 3 companions). Enforced in prompt (`partyCapBlock`), engine backstop in `applyMuts`, and import guard in UI. |
| 1.96 | **Part ways button** — NPC sheet gets "Part ways with X" for party members. Flips `partyMember` off, sets `worldState.recentlyLeft` (transient marker, auto-cleared after ~2 turns), and `buildSysPrompt` injects a "PARTY DEPARTURE" note. |
| 1.97 | **Gemini model update + button fix** — retired models (1.5/2.0) replaced with current (3.5-flash/2.5-pro/2.5-flash/lite). Tolerant `parseActions` catches bare `[a\|b\|c]` without `ACTIONS:` prefix. `TAG_REINFORCE` extended with `PARTY_MEMBER` and `ACTIONS` instructions for non-Claude providers. `launch.json` switched to `autoPort` (fixes port-3000 orphan collisions). |

---

## Key architectural additions

### Party system (v1.94–v1.96)
- `PARTY_MAX=4` global, `partyCompanionCap()` and `partyCompanionCount()` in `helpers.js`
- Triple enforcement: prompt awareness (GM told party is FULL) → engine backstop (over-cap join refused, NPC kept as non-party ally) → UI import guard
- Departure uses transient `worldState.recentlyLeft` array, same pattern as `worldState.recentSwitch` — auto-cleared in `sendAction` after ~2 turns

### Structured action suggestions (v1.90/v1.97)
- GM emits `[ACTIONS:first|second|third]` tag (instructed in STYLE rule)
- `parseActions(clean, raw)` — three-tier: (1) `[ACTIONS:]` from raw, (2) tolerant bare `[a|b|c]` for non-Claude, (3) legacy prose fallback
- `TAG_REINFORCE` (non-Claude providers) includes explicit ACTIONS tag instructions

### Provider state
- `activeProvider`, `providerKeys`, `providerModels` in `globals.js`
- Gemini models: `gemini-3.5-flash` (default), `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`
- All non-Claude providers carry `TAG_REINFORCE`; Claude needs none

---

## ⚠ Still owed: verification

1. **v1.97 deploy** — committed but not pushed. Push to master → Cloudflare auto-deploys. Verify Gemini model dropdown + button rendering on a non-Claude provider.
2. **Live tag-fidelity tests** — Grok, Gemini, and Ollama adapters are shape-verified but need a real-play "money turn" test with each provider's key to confirm tags (especially `[ACTIONS:]` and `[PARTY_MEMBER:]`) are emitted consistently.
3. Carried forward: mobile topbar notch, 2-device portrait propagation, Library tab live-populate, legacy character full-sheet.

---

## Open items (from TODO.md)

- **#24 Token economy / brevity** — deliberate replacement for the removed sentence cap. Options: per-voice length character, or a Brevity dial. Load-bearing under subscription cost model.
- **#25 Prompt caching** — reorder `buildSysPrompt` stable-before-volatile, cache prefix via Anthropic `cache_control`. Logged as standalone task.
- **Car Mode** (`CAR_MODE.md`) — TTS drain → STT start → auto-send loop.
- **Story Compiler** (`STORY_COMPILER.md`) — weave from verbatim transcript prose.
- **Server architecture** — evolve Fly server into subscription API gateway. Tabled.

---

## Conventions / "don't get burned"

- **ES5 only** — `var`, no arrow/const/let/template-literals. `async/await` only in API-facing funcs.
- **Always commit; don't push until told.** Pushing to `master` auto-deploys via Cloudflare Pages. User tests locally. Batch commits, push on explicit go.
- **Bump BOTH** the version string in `updateMemStatus()` (`ui.js`) AND `CACHE` in `sw.js` on every code-changing commit.
- **Three file menus** (`fm-`, `cs-fm-`, `api-fm-`) must stay in sync when adding items.
- Personal save files (`*.json` game exports) are **not committed**.
- **Model string:** confirm `claude-sonnet-4-6` is current before API work.

## Deploy

- **Cloudflare Pages** auto-deploys from `pmegow/traffic-and-dragons` on push to `master` (no build, output = root). Unlimited bandwidth. `_headers` keeps sw.js/shell fresh; hard-refresh on device after deploy.
- **Server:** `cd traffic-and-dragons-server && flyctl deploy --ha=false`.
