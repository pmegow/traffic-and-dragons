# #534 direction 5 — a live model answers the name-collision note (2026-10-12)

**Run.** Throwaway campaign `PlaytestHarness-534-live` (local-only: the preview at localhost:8123 was not signed in to the server,
so nothing synced; the harness deleted the campaign afterwards, the owner's Village save untouched). Game v1.1226, GM
gemini-3.8-flash (the owner's own current model, set in memory for the run), 8 real turns through `sendAction`, two collisions
staged through the engine's own tag path (`applyMuts`) between turns. Corpus: [live-534-2026-10-12/corpus.json](live-534-2026-10-12/corpus.json).
Commissioned by the owner's 2026-10-11 ask to test and close the remaining Known issues; this is the one check no scripted test
could supply (audits/AUDIT_2026_10_07_504_title_question.md §5).

**Verdict: both answer shapes have now been seen from a live model, and the engine read both exactly as designed.** The GM answered
the delivered NAME COLLISION note with `[MERGE:npc|Lord Mordrath|Lord Mordrath]` (another person — the provisional kept its name,
Jareth Mordrath untouched). Earlier, before any note could fire, the same GM resolved "Queen Underbough" onto Wilhelmina on its own
with the exact form `[NPC_MERGE:Wilhelmina Underbough|Queen Underbough]` (merged; the alias recorded), after one wrong-direction
`[NPC_ALIAS:Queen Underbough|Wilhelmina Underbough]` that the engine refused loudly ("needs exact confirmation"). No fork, no
fusion of an established record, no silent outcome. Direction 5 is met.

| Check | Result |
|---|---|
| A real GM brings "Queen Underbough" on stage when asked | ❌ twice it refused to invent a queen and pointed at Wilhelmina in prose only (turns 1–2) — honest GM behaviour; the collision was then staged through `applyMuts` at turn 2 |
| The staged title write files a PROVISIONAL, never a merge | ✅ `{of:"Wilhelmina Underbough", called:"Queen Underbough", title:"queen"}`; receipt "⚠ possible name collision … filed separately; the GM is asked" |
| The GM's unprompted alias in the wrong direction is refused | ✅ turn 4: "⚠ NPC alias merge proposed, not applied: 'Wilhelmina Underbough' into Queen Underbough needs exact confirmation" |
| The GM resolves SAME with the exact established name | ✅ turn 5: `[NPC_MERGE:Wilhelmina Underbough|Queen Underbough]` → "Merged: Queen Underbough -> Wilhelmina Underbough"; `memory.npcs["Wilhelmina Underbough"].aliases = ["Queen Underbough"]`; the provisional gone |
| The engine note is DELIVERED and answered | ✅ turn 8 (staged at turn 7): `worldState.provisionalNudged = {"Lord Mordrath": 7}`; the note's text in the user turn; answer `[MERGE:npc|Lord Mordrath|Lord Mordrath]` → "Lord Mordrath: another person — keeps the name"; Jareth Mordrath's record untouched |
| No console errors, no harness errors | ✅ `__pt.errors = []` throughout |
| Cleanup | ✅ `__ptDeleteRun` → deleted this device's copy; the Village campaign is the only one left; nothing in the cloud |

**Findings, recorded not built.**

1. **The note's first delivery waits for turn 5 of a campaign.** `buildProvisionalNudge` (identity.js) skips a provisional while
   `worldState.turn - last < PROVISIONAL_NUDGE_COOLDOWN` (5) with `last` defaulting to 0, so a collision filed at turn 2 is not asked
   until the prompt built at turn 5. In this run the GM resolved the Queen on its own at turn 5 before the note ever fired (the latch
   stayed empty until the Lord Mordrath case at turn 7). Real campaigns are past turn 5 almost always; a one-line change (`last`
   undefined → fire now) would close it. Row #534 carries the line.
2. **Occupational titles are outside the question's vocabulary — by design.** `_NPC_ASK_TITLES` (memory.js) holds kin and rank
   words only (king … mistress, father … wife). `[NPC:Captain Mordrath|barking orders|unknown]` resolved straight onto the only
   Mordrath on file (Jareth, the dockhand) and overwrote his status and relation; the GM then named the captain "Holt Vareth"
   anyway. Whether "captain", "sergeant", "sheriff" and the like should raise the same question is the owner's call; a false question
   costs one note, a false merge costs a record.
3. The GM's first instinct on seeing two roster names for one person was `NPC_ALIAS` in the WRONG direction (the established name as
   an alias of the provisional). The #534 alias-handler closure held; the refusal is said in the mutation log, and the GM corrected
   itself with `NPC_MERGE` on the next turn without being told.

**Not in this evidence:** a provisional born of a GM-written title tag (both collisions were staged by hand because this GM would not
invent a queen or a lord on request — the engine path from a GM tag is the same `npcUpsertTarget` boundary the scripted tests cover);
the "loose form refused and said back" branch (the GM never wrote a loose form); any prose or taste judgement.
