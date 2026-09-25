---
name: thursday
description: The Thursday burn ladder — "/thursday" spends leftover Fable budget on review-shaped work that needs no owner ruling, in a fixed order — ① the weekly commit review (everything since the last receipt), ② read the week's play (the owner's real saves, scanned for unreported drift), ③ the prompt diff of those saves at HEAD vs last Thursday's engine, ④ the deferred Fable-tier smalls. Every rung writes its receipt before the next begins. Use when the user invokes /thursday, says Fable time is left on the board, or asks to burn or spend the remaining Fable budget usefully.
---

# /thursday — the Fable burn ladder

**Why it exists.** The weekly Fable budget kept expiring unspent because nothing on the board was
shaped "start without the owner, finish in one sitting, leave a receipt" (owner, 2026-09-24). This
ladder is that shape: four rungs, fixed order, each self-contained. Stop at any rung when the
budget runs out; the receipt says which rungs ran. The owner chose the four rungs and the skill
trigger on 2026-09-24 (TODO #448).

**Tier: Fable.** Rungs 1–3 issue verdicts on the drift surface (applyMuts write paths · memory
tiers · buildSysPrompt canon blocks + the stable/volatile split · cleanTxt + tag vocabulary ·
transcript integrity · quest/skeleton teeth) and every rung-4 row lives on it. If this session is
NOT on Fable: rung 1's censuses, rung 2's transcript read and rung 3's captures may run as
EVIDENCE only — no verdict, no fix, no row that names a mechanism. Park the evidence in the
receipt, log the run to `todo_checkWithFable.md`, stop.

**Never, on any rung:** resolve a design fork (an XL row, an owner-ruling item — file the question
as a row and move on; naming a todo is not a green light); explain a divergence with "cache /
environment" before reproducing it; ship a fix for a symptom without stating the mechanism; write
to an owner save (every read here is a copy or read-only node); load an owner save into the
preview browser while it is signed in (it would sync); run a funded playtest (that is `/playtest`,
under its own budget rule); `git add -A` (parallel sessions share this tree — stage explicit files).

## Rung 0 — anchor and receipt skeleton

1. **Anchor** = the commit the last receipt ended at:
   `grep -ho 'name="anchor" content="[0-9a-f]*"' DOC/Review_fable_*.html | tail -1`.
   None yet → `git log --before="7 days ago" -1 --format=%h`. Record `ANCHOR..HEAD` and
   `git log --oneline ANCHOR..HEAD | wc -l` in the receipt's Method section.
2. **Fetch first**: `git fetch origin master` — row numbers and APP_VERSION are claimed against
   origin (the double-v1.546 incident), and today's HEAD is what the receipt reviews.
3. **Open the receipt BEFORE any analysis** — a closed window must never cost the run. Copy the
   head and styles of the newest `DOC/Review_fable_<date>.html`, title it
   `Fable review — <date> (Thursday ladder)`, and lay down sections **1 Method · 2 Rung 1 — commit
   review · 3 Rung 2 — the week's play · 4 Rung 3 — prompt diff · 5 Rung 4 — smalls · 6 Checked
   and clean · 7 Files changed**, each body reading "not run" until it is. Put
   `<meta name="anchor" content="<ANCHOR>">` in the head now; overwrite it with HEAD at the close.
   Commit it: `docs: Thursday ladder <date> — receipt opened`.

## Rung 1 — the weekly commit review

Reproduce the 2026-09-24 method ([DOC/Review_fable_2026_09_24.html](../../../DOC/Review_fable_2026_09_24.html) §1):

- **Scripted, read-only censuses** — churn (`git diff --numstat ANCHOR..HEAD`); a dead-symbol
  census over every top-level definition in the engine files, checked against every root
  `.js`/`.html` and `dev/` file (it OVER-reports: a comment stripper swallows code between a `/*`
  inside a regex literal and the next `*/` — re-check every candidate with a whole-word search
  including comments; report only what occurs exactly once anywhere); empty-catch and
  `setInterval` counts per file; CLAUDE.md's file table against the files on disk; every `tnd_*`
  storage-key literal against `DOC/contracts/`; TODO rows by status glyph; `DOC/BUGS.md` rows by
  status (run `/bugs sync` first when the feed is older than the anchor); the live server's
  `/health` and Fly's release list.
- **Read every diff that touched a drift-surface file** (`tag_table.js`, `api.js`, `memory.js`,
  `identity.js`, `state.js` serialize/parse, `campaign_generator.js`, `clock.js`, `game.js` note
  builders) as a reviewer would: what silent failure could this cause, and was the decree's
  verification actually done — failing test first, stable-half byte identity, a sabotage clause
  that changes bytes? A commit message that claims a check the diff does not contain is a finding.
- **Hand-verify every candidate** before it becomes a finding.
- **Findings → TODO rows**: TLDR-first plain sentence, mechanism with `file:line`, evidence,
  remedy, tier; bottom of its table, next global number (grep TODO.md AND DOC/TODO_ARCHIVE.md).
  Confirmed + S-sized + no ruling needed → fix now: failing test first, one row per commit,
  APP_VERSION + sw.js CACHE bumped, the row updated in the same commit. Needs a ruling → row with
  the question, status ○. Correct-as-designed → one line under Checked and clean so nobody
  re-litigates it.
- Fill §2 and §6, commit the receipt.

## Rung 2 — read the week's play

The anti-drift stack fails SILENTLY; only a transcript read finds what the owner did not report.

1. **Which saves**: `find Campaigns -path "*/saves/*.tnd" -newermt "<anchor date>"`; the newest
   per campaign is the read; the window starts at the turn of the newest save OLDER than the
   anchor (or turn 1). Village saves are disposable for migrations but they are the owner's most
   played surface — read them too.
2. **Dump the window**: `node dev/dump-transcript.js <save.tnd> a-b` (clean text with the
   bookkeeping / refusal / retconned / denouement flags); `--raw` prints the sessionLog with tags
   intact when a tag question comes up.
3. **What to look for** — the product's own failure classes: a dead or absent NPC acting or
   speaking · two NPCs fusing, or one splitting under an alias · place contradictions (an exit
   that never existed, travel that skips the graph, a sublocation on the wrong parent) · gold, HP
   or inventory narrated differently from the tags that landed · the clock or phase contradicted
   · a companion acting out of trait, or unbidden outside #386's cadence · the register guard
   losing (modern idiom, a ledger driving the story, the antiquity ratchet) · an engine note
   visibly ignored (CARRIED RECORD, a refusal path, the stake line) · verbosity creep (prose
   length is never a positive; TTS bills by duration) · a retcon that did not take · Table Talk
   answered in character.
4. **Each candidate runs the `/field-finding` procedure** — ground it, reproduce the failure
   condition through the real engine (`dev/load-engine.js`), state the mechanism, classify (drift
   surface? silent? a CLASS?), sketch the remedy, land the row. Investigation only on this rung;
   a confirmed S-sized fix may follow under rung 1's fix rules.
5. **Honest negatives are results**: "read t77–t89 of the Village, nothing found" goes in §3 with
   the window and what was looked for. A vague suspicion that would not survive grounding is
   recorded as a watch, not a row.

## Rung 3 — the prompt diff on real saves

The decree asks for a prompt/mutation diff against real transcripts after every drift-surface
change; per-change sessions verify their own change. This rung diffs the WEEK on the owner's own
campaigns — the interaction of everything that shipped.

```
S=<scratchpad>
node dev/capture-prompt.js <save.tnd> $S/now/<slug>
git worktree add $S/then ANCHOR
cp dev/capture-prompt.js $S/then/dev/          # the tool is version-independent; the anchor may predate it
( cd $S/then && node dev/capture-prompt.js <absolute save path> $S/then-out/<slug> )
git worktree remove --force $S/then
diff $S/then-out/<slug>/stable.txt   $S/now/<slug>/stable.txt
diff $S/then-out/<slug>/volatile.txt $S/now/<slug>/volatile.txt
```

Run it for each rung-2 save (two or three campaigns, different shapes: a young campaign, a mature
one, the Village). Rules:

- **Every hunk is attributed** — a table in §4: hunk → the TODO row that shipped it. A hunk no
  row claims is a finding (rung-1 shape, drift-surface tier).
- **No prompt-changing row shipped → the stable half is byte-identical** (compare the sha lines).
  A mismatch is a finding even when it reads as harmless — the cached half is money, and the
  frozen-hash test only sees the fixture world, not a real save.
- **Growth is a finding class**: a stable half that grew without a row that budgeted it is the
  cache-cost class; say the delta in characters.
- The captures are deterministic (no wall clock, no provider branch in `buildSysPrompt`, checked
  2026-09-24) — a diff that differs between two runs of the same engine is itself a finding.

## Rung 4 — the deferred Fable-tier smalls

The fall-through list when rungs 1–3 came up clean and budget remains. Re-read each row first (it
may have closed or changed). Suggested order, smallest and most self-contained first:

`#420` dedupe the never-emit-MANA rule in the frozen STATE TAGS doc · `#421` lazy latch
snapshots in `buildEngineNotes` · `#387` the clock block speaks the phase word · `#405` voice
test-coverage residues · `#419` stt · `#403` cloud fallback routing and the Piper ceiling ·
`#404` voice pipeline structure and resources · `#417` unify the OpenAI TTS transport ·
`#418` extract the three-copy audio schedule-and-retire block · `#65` memory-archive size
telemetry.

Each row under the decree in full: the critical review BEFORE code (what it touches, what silent
failure it could cause, the test plan — recorded in the row; to the owner only when a confident
answer cannot be reached), failing test first, new guards sabotage-proven on a SCRATCH copy (never
the working tree — the CRLF incident), the full gate (`node dev/run-tests.js`), APP_VERSION +
CACHE, the row updated in the same commit. One row per commit. A row half-done at budget's end is
reverted, not committed. A fix that fails twice is a STOP — file what was learned, move on.

## Receipts and stop rules

- The receipt is filled as each rung ends and committed then; push at each commit. Explicit
  files only.
- Stop when: the budget is gone · a rung needs a ruling that blocks the rest (file it, continue
  with the next rung) · a second failed fix on one symptom.
- **Close**: overwrite the anchor meta with HEAD's sha; §1 states the rungs run, findings filed,
  fixes shipped, and the ◉ rows the owner must validate (the Saturday delegation routine reads
  those); update TODO #448's status line with the date and one line of outcome; commit
  `docs: Thursday ladder <date> — closed at <sha>`.
- The last message to the owner: rungs run, rows filed (numbers + TLDRs), fixes shipped (version),
  what needs their eyes, then the version line.
