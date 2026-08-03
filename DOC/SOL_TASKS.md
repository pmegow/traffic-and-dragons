# SOL_TASKS.md — current assignments for Sol (Codex)

Read [AGENTS.md](../AGENTS.md) first (boundaries + conventions), then [CLAUDE.md](../CLAUDE.md)
for the systems each task touches. Each task below is self-contained, off the drift surface,
and has a mechanical acceptance criterion. Work them in order; push after each. When a task
lands, update its TODO.md row's Status cell in the same commit (the full row text is the
authoritative spec — the briefs here are orientation, not replacements).

Owner contact point: if anything requires touching a read-only file, contradicts the TODO row,
or forks into a design decision, stop and leave a clear report of where and why.

---

## Task 1 — TODO #116: shell-asset-vs-marker pre-commit guard

**Problem.** The rule "every commit that changes game code bumps `APP_VERSION` (globals.js) and
`CACHE` (sw.js)" has no mechanical enforcement, and exactly this class slipped past twice in one
evening (commits `038a57f`, `ff69782` changed the shell-cached `capability_bible.js` with no
bump — installed clients would have served stale mechanics indefinitely).

**Where.** The tracked pre-commit hook is `dev/pre-commit` (git executes the installed copy at
`.git/hooks/pre-commit`; reinstall line is documented in the hook header). Add a new check —
recommended as a small node script `dev/check-shell-markers.js` called from the hook, beside
the existing `lint-todo.js` and `run-tests.js` calls.

**Spec.**
- Determine the staged file set (`git diff --cached --name-only`).
- Determine the shell-precached asset list by PARSING `sw.js`'s precache array — do not
  hardcode a copy of the list (a copy is the exact rot class this project kills on sight).
- If any staged file is in the precache list, require that the STAGED contents of `globals.js`
  (`APP_VERSION="..."`) and `sw.js` (`var CACHE = "..."`) both DIFFER from HEAD's values —
  merely staging the files without changing the constants does not count.
- On failure: exit non-zero with a message naming the changed shell assets and exactly what to
  bump. On a repo with no HEAD (fresh init), pass.
- sw.js/globals.js themselves changing counts as "shell asset changed" only via the constants
  rule above — don't create a circular requirement.

**Verify (sabotage-style, by hand).** ① Stage an edit to `capability_bible.js` alone → commit
must be BLOCKED with the clear message. ② Add both marker bumps to the stage → commit passes.
③ A docs-only commit (TODO.md) → untouched by the check. Record all three results in the
commit message.

**Notes.** This is `dev/` tooling — no APP_VERSION/CACHE bump for this commit itself. Update
TODO row #116 in the same commit. The row's stretch goal (generated shell fingerprint) is OUT
of scope — note it as still-open in the row.

---

## Task 2 — TODO #93: TTS splitter — an unclosed quote voices narration as a character

**Problem.** `splitSentences` (tts.js) tracks dialogue/narration state with a quote-parity
flag; a stray unclosed quote inverts the `spk` labels for the rest of the paragraph. Since the
v1.451 deterministic deriver (`deriveSpeakerMapFromTags`, game.js — read-only context for you:
game.js is ask-first, but the fix belongs in tts.js; if you conclude game.js must change, stop
and report first), inverted NARRATION units get the segment's CHARACTER voice — narration read
aloud in an NPC's voice.

**The TODO #93 row is the full spec** — read it top to bottom; it encodes probe names (W1, Y8),
the ratified fix direction, and one retirement. Summary of the work items:

1. **Parity fix (①):** reset the dialogue state at a paragraph boundary only when quote parity
   CLOSED at that boundary. The continued-speech convention (an unclosed quote legitimately
   continues across paragraphs) must keep working — the existing B14c tests pin it.
2. **Quote-aware key matching (①b):** `_sayNorm` strips quote marks, so the deriver is
   quote-blind inside a segment — narration that happens to contain another speaker's line
   text steals that line's voice (probe W1). Require a key's hit to start inside a quoted run
   of the raw segment.
3. **Junk tail (③):** a lone `"` fragment can reach synthesis as an audio blip — forward-fold
   punctuation-only fragments (the fold loop's `k > 0` bound skips index-0 pieces).
4. **Retirement (②):** `speakerSpans` is dead code (zero live callers) — delete it and retire
   its tests in the same commit.

**Verify.** Test-first in `dev/engine-tests.js`: the existing B14* tests are the bed; add
failing tests for the parity-inversion case (narration after a stray quote must NOT carry a
character voice), probe W1, probe Y8 (stray CLOSING quote), and the lone-quote fragment. All
existing B14c continued-speech tests must stay green — they are the regression guard for the
convention you must not break.

**Notes.** ⚠ Any splitter change that alters unit counts makes STORED speaker maps degrade to
mono-voice replay via the `sp.n` fuse — that is the DESIGNED behavior (v1.423 precedent), note
it in the commit message, don't fight it. Game-code commit → bump `APP_VERSION` + `CACHE`.
Update TODO row #93 in the same commit.

---

## Task 3 — TODO #94: Piper "high" voice A/B listening artifacts

**Problem/scope.** The speed half is ALREADY ANSWERED (see the row: high ≈ RTF 1.0 on the
server box, ~6× medium's cost, measured from live logs). What remains is a JUDGMENT call that
belongs to the owner's ear. Your deliverable is the material for that judgment — **do not
change any defaults or ship any code.**

**Produce:**
1. A/B audio samples: the SAME 4–6 test passages (pick varied ones — narration, dialogue,
   names-heavy) synthesized in `en_US-libritts_r-medium` (the current default) and a high-tier
   voice (`en_US-libritts-high` first; `en_US-lessac-high`/`en_US-ryan-high` if practical).
2. A small self-contained HTML index page under `DOC/` (e.g. `DOC/piper_high_ab.html`) with
   paired play buttons per passage, medium left / high right, no external assets — follow the
   house doc style (dark, amber `--acc`).
3. A short findings section on that page: file sizes, subjective observations, and the row's
   open questions restated for the owner (default-vs-casting economics at 6× CPU).

**How.** Local generation via `piper_test.html` (the vendored WASM runtime at `/vendor/piper/`;
voices download once and cache in OPFS — a high model is a several-hundred-MB download, say so
before pulling it). ⚠ Do NOT benchmark against the live `tnd-tts` Fly box — the #91 run proved
sustained CPU exhausts its burst balance and corrupts both the benchmark and live narration.
Server-side numbers already exist in the row; you don't need new ones.

**Verify.** The page opens from `file://`, both columns play, passages are byte-identical text
across engines. Update TODO row #94's Status with a pointer to the page. Docs-only commit → no
version bump.
