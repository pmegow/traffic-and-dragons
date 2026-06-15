# Story Compiler — Planning Doc

> **⚠ DIRECTION REVISED (2026-06-15) — read before building.**
> Decision: the keepsake is woven from **verbatim prose**, not chapter summaries. The body of this doc below still describes the original summaries-first design (`memory.chapters` as "the spine") — treat that as superseded for the *source* question.
> New architecture: **complete append-only transcript = the flesh** (real prose/dialogue the player actually saw); **`memory.chapters` + `storyBeats` + `keyDecisions` = the skeleton** (arc shape, pacing, and which transcript stretches to pull verbatim — to control token cost on long campaigns).
> **Hard dependency:** this needs a complete, ordered, durable transcript that does **not** exist yet. The auto-export `.txt` files cannot serve as the source — desktop-only trigger, DOM-snapshot that reloads truncate, scattered per-device. **Build append-only transcript capture first**, then this compiler. The chunking loop / voice / output sections below are still valid; only the input source changes.

## What it is

A standalone `story_compiler.html` that takes a Traffic and Dragons save file and uses Claude to weave the campaign's chapter summaries into a readable short story. Output is a styled, downloadable HTML document. PDF via browser print.

No build step. No dependencies. Same stack as the main game.

---

## Input sources

The compiler needs two things: an API key and a save file.

**API key:**
- First checks `localStorage` under `tnd_ak_v1` (same key the game uses — auto-populated if opened in the same browser)
- Falls back to a visible input field if not found
- Never stored by the compiler itself — it reads, doesn't write

**Save data:**
- Primary: file upload (drag-and-drop or file picker), accepts `.json` game exports
- Secondary: "Load from browser" button that reads `tnd_core_v10` directly from localStorage — zero friction if opened locally after a session

---

## What data gets used

From the save file:

| Source | Used for |
|---|---|
| `worldState.character` | Byline, consistent naming, class/ancestry flavour |
| `worldState.campName` | Story title |
| `memory.chapters[]` | Primary narrative source — `{summary, turn}` |
| `character.storyBeats[]` | Key moments to weave in — `{text, turn}` |
| `memory.keyDecisions[]` | Moral pivot points |
| `memory.lore[]` | World flavour available to the GM |
| `worldState.eventHistory[]` | Fallback if `memory.chapters` is sparse |

`memory.chapters` is the spine. Everything else is colour the GM can pull from when relevant.

---

## Narrative voice — decision needed

This is the most important choice before writing a prompt. Options:

| Voice | Feel | Notes |
|---|---|---|
| **Third-person chronicle** | "Kaelan descended into the vault..." | Most readable, easiest to prompt reliably |
| **In-world document** | A bard's ballad, a guild report, a tavern tale | Fun, but riskier — GM may lose the thread |
| **First-person memoir** | "I remember the night the fire started..." | Intimate, but can feel jarring vs. the second-person game |
| **Player's choice** | Dropdown in the compiler UI | Adds one decision but satisfies all cases |

**Recommendation:** Default to third-person chronicle. Offer a dropdown with 3-4 options. The prompt changes per selection — the chunking logic doesn't.

---

## Chunking architecture

Chapter summaries are processed in groups rather than all at once. Reasons: no token ceiling issues on long campaigns, each call is predictable and cheap, easier to retry a failed chunk.

### The loop

```
chunks = split(memory.chapters, size=4)

for each chunk:
  input  = character_brief + bridge_text + chunk_summaries + position_hint
  output = prose_segment (~800 words)
  bridge = last 300 chars of output  (carries voice into next chunk)

final_story = join(all prose_segments)
```

### Position hints

Each call knows where it sits:
- **First chunk:** "Open the story. Establish the world, the character, the stakes."
- **Middle chunk:** "Continue. Do not recap. Pick up from the bridge text."
- **Last chunk:** "Close the story. Resolve the arc. End with weight."

### Chunk size

Default 4 chapters per chunk. Configurable in the UI (2–6). Smaller = more API calls but better per-chunk quality. Larger = fewer calls but risks losing thread on dense campaigns.

### Token budget per call

- System prompt: ~300 tokens (character brief + voice directive + rules)
- Input (bridge + summaries): ~400–600 tokens
- Output target: 800–1000 tokens (`maxTok: 1200`)
- Total per call: well under 4K. Safe.

---

## The system prompt (per chunk)

```
You are compiling a chronicle of [campName].

CHARACTER: [name], a [subrace] [ancestry] [class] [archetype], Level [level].

VOICE: [third-person chronicle / selected voice]

RULES:
- Write vivid prose. No bullet points, no headers, no meta-commentary.
- Use the character's name, not "the hero" or "the adventurer".
- Weave in specific details from the summaries — names, places, choices.
- Do not pad. Every sentence should earn its place.
- If this is not the first section, continue seamlessly from the bridge text.
  Do not reintroduce the character or recap what came before.

[IF FIRST]: Begin the story. Establish the world and the character.
[IF MIDDLE]: Continue the chronicle.
[IF LAST]: Bring the story to a close. Let the ending carry weight.

BRIDGE (end of previous section):
[last 300 chars of previous output, or empty if first]

THIS SECTION covers:
[chapter summaries for this chunk, numbered]

KEY MOMENTS to weave in if relevant:
[story beats that fall within this chunk's turn range]
```

---

## Progress UI

Multiple API calls means visible progress. A centred modal overlay:

```
┌─────────────────────────────────────┐
│  Compiling your story...            │
│                                     │
│  ████████████░░░░░░  3 of 5         │
│  Weaving chapters 9–12...           │
│                                     │
│                        [Cancel]     │
└─────────────────────────────────────┘
```

- Progress bar fills as chunks complete
- Status line names the current chunk
- Cancel button aborts mid-compile (partial story discarded)
- On error: show which chunk failed with a Retry option

---

## Output document

A self-contained HTML file that downloads as `[campName]_story.html`.

### Structure

```html
<title>[campName] — A Chronicle</title>

Cover section:
  Campaign title (large, amber)
  Character name, class, ancestry
  "A [N]-chapter chronicle"
  Session count / total turns

Story body:
  Prose paragraphs, no headers mid-story
  Dropped capital on first paragraph
  Page break hints for printing

Colophon (end):
  "Generated from [N] chapters of play"
  Date compiled
  [Print / Save PDF] button  ← triggers window.print()
```

### Styling

Match the game's aesthetic:
- Background: `#0d0d0d`
- Text: `#c9b99a` (warm parchment)
- Accent: `#b8935a` (amber)
- Font: Georgia serif, ~17px, generous line-height
- Max-width: 680px centred — readable like a book

For print: white background, black text, standard book margins. The `[Print / Save PDF]` button hides itself in `@media print`.

---

## Edge cases to handle

| Case | Handling |
|---|---|
| No chapters yet (new campaign) | Show warning: "Your campaign needs at least one summarised session before compiling." |
| Only 1–2 chapters | Skip chunking — single call, no bridge needed |
| Very long chapter summaries | Truncate each summary to 300 chars before sending — full text is for the game, not the compiler |
| API error mid-compile | Show which chunk failed. Offer retry from that chunk (preserve completed chunks). |
| Empty storyBeats / keyDecisions | Omit those sections from the prompt gracefully — don't send empty arrays |
| Campaign with 20+ chapters | Chunking handles it. No cap. Just more calls and a longer progress bar. |

---

## File structure

```
story_compiler.html   ← single self-contained file
                        inline CSS + inline JS
                        no external dependencies
                        reads tnd_ak_v1 from localStorage
```

No server required. Works from `file://` or Netlify.

---

## Integration path (later, not now)

When it's proven to work, adding it to the game File menu is trivial:

1. Add "📖 Compile Story..." to all three file menus
2. On click: call the compiler with `worldState` directly (skip file upload step)
3. Open the progress modal, run the same chunking loop
4. On complete: trigger download

The standalone version *becomes* the integration — same function, different entry point.

---

## Open decisions before building

1. **Narrative voice** — third-person only, or dropdown selector?
2. **Chunk size** — fixed at 4, or user-configurable?
3. **Story beats** — always included, or optional toggle?
4. **Output** — HTML download only, or also offer "open in new tab" for instant preview?
5. **Title page** — full cover page with character portrait (if `character.portrait` exists), or keep it text-only?

The portrait question is interesting. The save file includes `character.portrait` as a base64 JPEG. Dropping it on the cover page of the HTML document would make it feel like a real artifact. Zero extra API calls — it's already there.

---

## Estimated build time

| Phase | Time |
|---|---|
| File upload + localStorage loader + API key UI | 1 hour |
| Chunking loop + prompt construction | 1.5 hours |
| Progress modal | 30 min |
| Output HTML template + styling | 1.5 hours |
| Edge case handling + polish | 1 hour |
| **Total** | **~5.5 hours** |
