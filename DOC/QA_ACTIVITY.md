# Traffic and Dragons — QA Agent Activity

One entry per run of the cloud QA routine (the protocol: `dev/qa-routine.md`; TODO #651), newest
first. The routine appends its entry as the last step of every run and commits this file to master;
`bug_tracker.html` reads it into the **QA Agent Activity** section between Open and Completed. A run
that found nothing still logs one entry — a quiet log is how a dead routine shows.

**Format contract (the viewer parses this — keep the shape):**

- Each entry starts with `## <UTC time, e.g. 2026-10-21T05:05Z> · <run session id>` — the `·`
  separator is what the parser keys on; prose headings without it are ignored.
- Under it, one `- key: value` bullet per line. `summary` always (the counts line, or what stopped the
  run); then any of `filed`, `bumped`, `skipped`, `investigated`, `fixed`, `awaiting`, `failures`,
  `master`. A run that changed nothing writes `master: unchanged`. A `failures` line marks the run in
  the viewer; `fixed` carries a PR url or a branch name with "PR owed".
- The text is the routine's OWN words — a bug's id and its derived TLDR, never report text (report
  bodies live in `DOC/BUGS.md` inside fences). The viewer renders every value as inert text anyway.
- Entries are never edited or removed; a correction is a new line in a later entry.

---

## 2026-10-21T08:40Z · cse_01Fm9kJUBos8Hf95uMRwNjCR
- summary: feed 375 · new 2 · filed 2 · bumped 0 · skipped 0 · investigated 2 · fixes 0 · awaiting owner 2
- filed: B50 — the stacked dice clip was aborted before it played on an iPhone (v1.1290, Frizwick t70); B51 — a VP9 dice clip failed to load in the desktop app's Chromium on a localhost preview (v1.1293)
- investigated: B50 — probable-cause · drift-surface NO · medium-high: a play the overlay itself superseded (tap, second roll, or the pre-v1.1291 auto-close) is reported as a failure; likely a test roll, not a real check; B51 — probable-cause · drift-surface NO · dev-preview noise, most likely a clip rewritten in place during the re-renders; asset since replaced
- awaiting: B50 — needs-live-repro (confidence below the high bar; the same AbortError quieting was left for the owner on B49); B51 — low-confidence on the mechanism, product path needs nothing (likely an ignore)
- failures: gh unauthenticated (the environment's GH_TOKEN is still invalid) · the copied pre-commit hook was not executable, so the first tracker commit skipped the gate and was redone with it · the hook-parity gate also needs dev/pre-push installed, and tests-652-pre-push fails without a Chrome binary until CHROME_PATH points at /opt/pw-browsers/chromium-1194/chrome-linux/chrome — bootstrap step 0.1 should name both
- master: f817e6c7

## 2026-10-21T05:05Z · cse_018erYSzQqW4Pmjz3yJ8fM75
- summary: feed 373 · new 3 · filed 1 · bumped 0 · skipped 0 · investigated 1 · fixes 0 · awaiting owner 1
- filed: B49 — A rolled die clip refused to play on a phone-emulated page; play() was interrupted by a fresh load of the clip (v1.1287, localhost, Count 3)
- investigated: B49 — probable-cause · drift-surface NO · the [object Object] detail is root-caused, the AbortError trigger needs a live repro
- awaiting: B49 — needs-live-repro; half the fix sketch is in error-report.js, the app-wide crash channel, outside the safe-changes map
- failures: gh unauthenticated (the environment's GH_TOKEN is invalid) · the first tracker commit was blocked by the shallow checkout (the hook reads 93c182f^), deepened with git fetch --unshallow and retried
- master: 9f61d15c

## 2026-10-21T04:37Z · cse_01KXhPrRynZK1fZP5jGM8Ap3
- summary: stopped at bootstrap — TND_BUGFEED_SECRET was not set in the TnD environment; nothing synced
- failures: TND_BUGFEED_SECRET missing · gh unauthenticated (the environment's GH_TOKEN is invalid)
- master: unchanged
