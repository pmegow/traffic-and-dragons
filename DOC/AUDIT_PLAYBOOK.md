# Audit Playbook

Process lessons from the 2026-07 full-project audit (AUDIT_FABLE.md, 30 findings, 28 fully
closed, validated end-to-end). Follow this shape for the next audit pass. The findings file
it produces is disposable; this process is the asset.

---

## 1. Phases — find, then fix. Never both at once.

1. **Read pass.** Read every in-scope file end-to-end, in load order. Not grep-driven — the
   highest-value findings (state-tag gaps, duplicated blank-shapes, threshold drift) only
   show up when you hold whole files in your head at once. Note findings as you go; fix
   nothing yet. Fixing during the read pass anchors you on the first plausible cause and
   blinds you to the pattern repeating elsewhere.
2. **Triage.** Sort findings into: batchable-now (small, independent), belongs-to-a-future-
   feature (park with an explicit pointer — e.g. #24 → Blueprint Designer §5.2), tracking
   links for items that are really roadmap prep (#20 → TODO #11), and deliberate won't-fix
   (record the reasoning — #22's blankNpc factory: 10+ dense call sites, low payoff).
3. **Fix in batches.** One commit per coherent batch (the 24-finding v1.144 batch worked;
   30 one-line commits would not have). Regression tests ride in the same commit as the fix.
4. **Confidence review.** The audit is not done when the findings are fixed. End with an
   explicit "what can't this audit see?" pass. Last time this spawned usage telemetry (#21),
   the sanitization gate (#22), the lossy-sync known issue (#5) — and #5 and the missing
   telemetry both became REAL within two days (dead-Fly-host incident; caching baseline).
   The confidence review predicted the next two weeks better than the findings did.

## 2. Findings format

One table, TODO.md style, statuses updated IN PLACE so the file doubles as the work tracker
(renders in todo-viewer.html; completed rows move into `<!-- completed -->` blocks):

```
| # | Finding | Effort | Status |
```

Every finding must carry, in the finding cell itself:
- **Symptom** — what goes wrong, concretely ("[XP:+25] is silently swallowed").
- **Root cause** — the mechanism, not the vibe (parser regex lacks the sign; cleanTxt strips
  the unparsed tag so the loss is invisible).
- **Remedy** — a specific change, named files/functions. A finding without a remedy is a
  complaint; don't file it.

No vague code-smell entries. If it can't name a failure scenario, it doesn't go in.

## 3. "Done" requires evidence

A status flips to ✅ only with validation attached, matched to the claim type:
- **Parser/state fixes** → regression test in dev/engine-tests.js (commit-gated suite).
- **Behavioral claims** (rules compliance, prose voice) → live harness run
  (dev/playtest-harness.js), with the checklist results written into the status cell.
- **Cost/perf claims** → measured numbers, before AND after, same conditions
  (the telemetry #21 → caching #11 A/B is the template: identical save, identical turn
  count, deltas in the status cell).

The status cell is the permanent record — write it so a future session can trust it
without re-verifying.

## 4. Chain prep-work into the roadmap

Audit findings that unblock roadmap items are the highest-leverage kind. Cross-link them
explicitly both ways (finding status ↔ TODO item) so the dependency survives session
boundaries. Last time: #12 (side-effect-free prompt) + #19 (rules merge/freeze) + #20
(stable/volatile reorder) were the entire critical path to the measured 29% caching win.
Ask of every finding: "is this cleanup, or is this secretly a feature prerequisite?"

## 5. Scope of the NEXT audit

What the last audit never looked at, in rough priority:
- **traffic-and-dragons-server/index.js** — never audited; now battle-tested by the
  dead-host incident; carries the auth/session model and the no-turn-guard write path.
- **storage-adapter.js failure paths** — partially audited; the incident exposed the
  wedged `_syncing` class of bug. Audit every fetch for timeout/retry/visibility.
- **ui.js modal sprawl** — largest file, most copy-paste, least tested.
- **tts.js / stt.js / render paths** — never read end-to-end.
- **Security/trust boundary** — overlaps TODO #22; becomes mandatory before any public
  sharing feature ships.

## 6. Cadence

Re-run roughly every ~40 versions, or before a major push (subscription model, public
blueprint sharing, multiplayer). The audit → fix-batch → validate cycle last time was
~3 sessions for 30 findings; budget the same.
