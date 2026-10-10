# Handoff — Fable session 2026-10-10 (day) → the next session

**Read this when** picking up after the "finish 504, 517, 518, 527, 528" session. Ephemeral per the trackers rule: open items
live in TODO.md; this file archives as DOC/HANDOFF_v<ver>.md when superseded. The previous handoff is DOC/HANDOFF_v1.1210.md.

## State

- **origin/master** = the last docs commit, on top of the eight below (engine at **v1.1215**). Cloudflare serves it. Tree clean except
  `website/art/trafficAndDragons_close.png` (another session's; never stage it).
- **Shipped this session, one concern per commit:**
  - `4cf925bf` **#518 (v1.1211)** — an item pair is TWO TAGS IN ONE BLOCK: every pair note carries its tag's block
    (`tagBlockSpans`/`tagBlockIndex`, helpers.js; `rBlockAt`, tag_table.js; `itemPairNote/List/Count/Take/Miss/MissWhy/Missed`,
    inventory.js). The loot/throw collision closes inside the pair notes, as the owner ruled. Census tool
    `dev/census-tag-layout.js` (312 raw replies in the owner's saves, 95% in tag blocks, every real give pair in one block).
  - `5dc59c9d` **#517 (v1.1212)** — a counted ware name is the bundle the price buys (`fileWare`), a per-N want buys its bundle
    (`per` on the want row; the plan's allowance, the ledger maximum, the refusal), the coin a block spent comes back when the
    block's take moved nothing (`R.spendAt` in GOLD, `rBlockSpend`).
  - `1c022a18` **#527 lead (8) (v1.1213)** — the trade gate judges the hours at the coin's clock (`clockAtOffset`, clock.js;
    `shopOpenNow(node,min)`), an arrival is a change of place, `open === close` is round the clock (`nodeOpenAtHour`).
  - `511c1c90` **#528 (dev-only)** — 20 tests in `#528 proof`, the 27-clause battery, and
    [the record](../audits/AUDIT_2026_10_10_528_proof_gaps.md) of what already stood (nine lines caught by newer tests, three by an
    anchor only, fifteen green). Row ✅.
  - `d28f973c` **docs** — #527 lead (5) measured and closed (`dev/census-rag-echo.js`: the echo gate can hold in one campaign,
    withholds 3.2% of its excerpts, all the lien/tether retellings, on three or more shared words).
  - `d67953b4` **#504 mirror (v1.1214)** — a given name arriving beside the bare titled record is asked about (`npcTitleQuestion`'s
    mirror branch; the note's direction; a question is never stamped of an open question — the fuzzer found that one first run,
    STRANDED-SAME). Fuzzer 0 violations over 16,000 sequences; battery 61/61.
  - the next commit **#527 lead (23) (v1.1215)** — a companion's spell the sheet also holds as an ability gives its slot to the next
    same-tier bench spell (`spellAbilityOverlapHeal`, helpers.js; `healAbilitySheets` for companions; `companionAutoPickSpells`
    skips a held name). Row #527 ✅.
  - `1696204a` **#610 (v1.1216)** + `fc03e8e6` (v1.1217) — link a Google sign-in to the account you have; the provider-less
    reconnect uses the door used last. Server v1.7.5 → v1.7.7 (the link ticket, the link-aware door, `auth-identity.js`, the v8
    migration the baseline had left off production, stub adoption, a secondary door never renames the player). The owner's Google
    identity had owned the Google-born test account; it was merged into the main account by `ops-merge-google-account-2026-10-10.cjs`
    (the owner's live run) and the next Link adopted the emptied stub. #610 ✅; #451 needs a new second account.
  - this commit **docs** — the handoff after both rulings and #610.
- **Gates at each commit:** the hook's full suite green (2927 at the last); `check-sabotage-applicability` 3056/3056 across 328
  batteries; the new batteries `sabotage-518-pair-block.js` 5/5, `sabotage-517-counter-tail.js` 10/10, `sabotage-527-8-trade-hour.js`
  6/6, `sabotage-528-proof-gaps.js` 27/27; ten re-anchored batteries re-proven; the four replay baselines unchanged at every
  engine commit; `run-sabotage-diff origin/master..HEAD` before the push.

## Rulings answered during the session (owner, 2026-10-10)

1. **#504 mirror case — ask the GM** (built v1.1214, above).
2. **#527 lead (23) — substitute another same-level spell in the companion's list; leave the ability; leave the spell in the
   bible for the other classes** (built v1.1215, above). Not the recommended "one home": the owner keeps both homes and moves the
   companion's slot.

## Rows after this session

- #517 ◉ and #518 ◉ — ready to test in play (both change what the counter and the item tags do; reload every device once).
- #527 ✅, #528 ✅, #610 ✅ (the phone signs in with Google into the owner's own account).
- #504 ◉ — built; what remains is the live-GM answer to the name-collision note (owner-side, #534 direction 5).

## Hazards

- Never hand-mutate a working-tree file while a battery or sweep runs (the harness mirrors the whole working set into its clone
  before each prove group).
- A NEW battery's own anchors stale the applicability scan inside a sabotaged clone, so a plain discovery run (mustFail naming a
  section that does not exist yet) reads MISATTRIBUTED for every clause. The pattern that works: a scratch script that clones
  once, mirrors the working set, deletes the new battery from the clone, mutates, runs the full suite and prints the ✗ lines
  (this session's `who-catches.js`, in the scratchpad; worth a dev/ home if the pattern is needed a third time).
- A test placed before the section that assigns a shared `var` (e.g. the keeper section's `B4K_POST`) reads `undefined`; a scope's
  toast ring is fed by whichever `showToast` stub was installed last — a toast test installs its own stub.
- The two preview origins (`localhost:3000`, `localhost:8123` with the owner's Gemini key) carry throwaway Village imports only,
  signed out; nothing was opened in a browser this session.
