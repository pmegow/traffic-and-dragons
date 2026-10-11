# Persona acceptance evidence — #434 and #552

Frozen engine: `08faa2c45b09d00f92d767ee8c78ddea2cc7d3fb` (2026-10-10). Evidence only: no runtime, canon, production account, tracker, or saved campaign changed. Senior closure adjudication belongs to the independent reviewer.

## Contract and remaining requirements

Read AGENTS.md, CLAUDE.md, full TODO rows, DOC/contracts/prompt.md and DOC/contracts/character.md, shipping capture/admission/prompt/editor/library paths, and existing named engine and sabotage tests.

#434's shipping repair serves a present non-party character's authored trait, flaw, appearance and motivation; absent or merely mentioned characters remain bare; companions use their own block. Its remaining row explicitly asks the owner to rewrite Nyla's trait/flaw/motivation to the remembered foulmouthed/feral register, reset her campaign memory, import that reset, refresh from the library, and talk. Choosing those words and judging that voice is user canon/taste. No rewrite or reset performed.

#552's final build decision differs from the original proposal: `voiceLines[{text,turn,camp}]` plus owner-written `manner`; no generated manner; no attitude seeding. Resident serving is volatile; companion serving is deliberately stable with its backstory (#341); legacy serving is volatile. The original row phrase “volatile half only” is superseded by its explicit build account and current prompt contract. Remaining owner check ends “listen to them talk,” a likeness judgment. Objective capture/transport/admission/serving can be assessed separately from that judgment.

## Executed checks

| Command / artifact | Result |
|---|---|
| `node dev/run-tests.js "#434 roster"` | 1 section, 1 assertion passed |
| `node dev/run-tests.js "#552 the portable persona"` | 1 section, 5 assertions passed |
| `node dev/sabotage-434-roster-personality.js` | 3/3 named mutation clauses caught; byte-identical restoration |
| `node dev/sabotage-552-persona.js` | 13/13 named mutation clauses caught (11 helpers, 2 prompt); byte-identical restoration |
| `node audits/acceptance-2026-10-10/persona/probe.cjs` | 16/16 additional checks passed |
| `node audits/acceptance-2026-10-10/persona/editor.cjs` | Actual editor field/list edits, actual storageAdapter POST/GET and library Load passed; zero page errors |

The additional probe builds an independent synthetic transcript using the shipping TTS splitter and a speaker-map oracle with another speaker in every entry. It checks four exact captured lines with source camp/turn, live-sheet detachment, hero exclusion despite four usable lines, exactly two usable lines preserving the old list and exactly three replacing it. Its `captured-sheet.json` is the output of real `portableSheet`, not a hand-built expected sheet.

That captured sheet is JSON transported into a fresh campaign through real `importVillageResidents` / `sheetAdmit`. Both registered campaign kinds (adventure and village) preserve voiceLines and manner exactly and leave the fresh memory attitude empty. Present roster serving contains the trait/flaw/look/motivation, last three lines and manner; absent but recent/mentioned roster serving omits them and leaves the stable bytes identical. Companion serving places voice in stable and omits roster duplication, and its stable bytes stay identical across a changed turn, action and weather. Pending legacy serving includes lines/manner in volatile only.

The browser uses a fresh headless Chrome context, actual character_editor.html and storage-adapter.js. All HTTP is intercepted: only static frozen-repo assets, a synthetic account display and an in-memory synthetic character library are supplied; every other request aborts. It loads the real captured sheet, renders all four voice-line rows, edits the manner and one line through actual change events, clicks Save to library, empties the editor, then clicks Load from library and the entry's Load button. POST body, GET response and loaded sheet retain the edited voiceLines/manner byte-exact. `editor-roundtrip.json` records the payload and counts (one POST, one GET). This is a browser/transport-boundary check, not physical server persistence; the parent's separate disposable-server proof covers that boundary.

`editor-manner.png` and `editor-lines.png` were visually inspected: the editable manner field and all four line/campaign/turn rows render and display the synthetic edits. Narrow input boxes clip the long campaign name horizontally as normal inputs; stored text remains exact. No likeness or generated dialogue is evaluated.

## Failure sensitivity and limits

The existing mutation batteries deliberately break ownership filtering, joined speech, alias attribution, minimum speech length, deduplication, hero exclusion, quiet-cameo preservation, camp stamps, camp-stamped registry membership, serving cap, blank manner exclusion, roster voice serving and companion voice serving. Each was caught by its named assertion; #434 additionally catches dropped personality, removed presence gating and doubled party personality.

The first sandbox mutation launch failed to initialize Git scratch-clone config, and the first sandbox Chrome launch failed to initialize Crashpad. Both were environment startup failures, not product failures. Scratch-only elevated reruns passed. No production connection was attempted. No real GM generation, owner save reset, newly authored personality, paid model call, or “sounds like the person” judgment was performed. No full-suite result is claimed by this subtask (the parent runs the full acceptance gate).

## Monotonic resources

Captured evidence is bounded to five lines, each at most 200 characters; served evidence is bounded to the last three, each at most 120 characters. Refresh replaces the carried list once at export when the threshold is met; it does not append indefinitely. At fewer than three usable lines it preserves the existing list. Capture scans the existing transcript but stores only the bounded list; manner is owner-authored and not synthesized per turn. The browser's only test-library state is one overwritten sheet. Disposable browser contexts/processes are closed in `finally`.

Facts support the objective mechanisms above. Taste/canon closure decisions remain for the reviewer under the user's exception.
