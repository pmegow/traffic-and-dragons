# AUDIT — #684 atlas live spot-check, v1.1353, gemini-3.8-flash

**Run.** 12 real GM turns plus the opening (13 GM responses) in a throwaway mapped campaign, 2026-11-05, in the signed-in preview (server route, the owner's go: "Run the spot-check", "Signed in"). Campaign `camp_1793941431361_5759` (`PlaytestHarness_atlas684`), the Korrag template, tone `gritty`, Abercrombie voice, a fresh skeleton, **Draw a world map on** (atlas seed `qy49avnujq7o`, realm *Wralsol*). Actions were scripted to steer into map cases; the pane was driven by a real click on the location name and on **We are here**. Corpus: [dev/corpus_spotcheck_684_v1353.json](../dev/corpus_spotcheck_684_v1353.json) (every raw response, the MAP block the GM was sent each turn, the atlas after each turn). Cleanup: `__ptDeleteRun()` → `deleted, checked absent` on the first attempt; the owner's active campaign was snapshotted on the device first (no sync) and is back at its own turn after the reload. Cost not measured (13 turn calls, the skeleton and its review pass, all gemini-3.8-flash). No game code changed.

**Verdict.** **The atlas works with the real GM: on 6 of 6 moves to a place the map names, the GM wrote the exact map name in `[LOCATION:]` / `[SUBLOCATION:]` and the atlas followed — five zones across four scales (realm → village → building → crypt, then a second village), with no error, no failure toast and no redraw.** The GM also wrote from the sheet (rooms, exits, shop names, distances inside a building). **Three defects surfaced that no gate could see**, all at the seam between the story's places and the map's: the GM is never told a We-are-here tie (#692), same-named rooms of different buildings share one location node in the game's own graph (#693), and a settlement is described before its sheet exists (#694). Two known gaps showed their cost: the opening ignores the map, and travel time ignores map distance.

## Checks

| Check | Result | Evidence |
|---|---|---|
| The Begin switch draws a realm | ✅ | `worldState.atlas` at turn 0: seed `qy49avnujq7o`, one zone (region *Wralsol*), console `[atlas] drew Wralsol (region)`; `pendingAtlas` consumed |
| The door | ✅ | `#hud-loc` is a button ("Open the map — The Crossroads of Ashenveil"); a real click opened the pane on the realm with the status line |
| Off the map at the start, with the reason | ✅ | "The party is not on the map yet. "The Crossroads of Ashenveil" is not on the map (no place on the map has that name)." — pane status and MAP block agree |
| We are here | ✅ | card for Hushwick → real click → `names` holds the one tie, toast `"The Crossroads of Ashenveil" is on the map.`, Hushwick's sheet drawn, marker "The party (somewhere here)" |
| **The GM uses exact map names** | ✅ **6/6** | t6 `[LOCATION:Hushwick]` · t7 `[SUBLOCATION:The Red Abbey]` · t8 `[SUBLOCATION:Chancel]` · t9 `[SUBLOCATION:Crypt Stair]` · t10 `[SUBLOCATION:The Lower Chapel]` · t12 `[LOCATION:Gremgamouth]` |
| **The atlas follows** | ✅ | t7 enters the interior at `door-front`; t8 spot `chancel-1`; t9 enters the dungeon *The Crypt* at `cryptstair-1`; t10 spot `chapel-1`; t12 enters town `…/p10`. Where-lines: "The party is in The Red Abbey, at Chancel." … "The party is in The Crypt, at The Lower Chapel." |
| The GM writes from the sheet | ✅ | Hushwick: the Green, the Red Abbey beside the market, the Harbour east ("ninety paces" for the sheet's 90 m). Abbey: "Fourteen empty pews", exits Nave / Transept 2 / Crypt Stair "currently locked". Crypt: the Lower Chapel "at the south end". `[WARES:]` at Drasdur's Fish and Wrathaes's Smithy |
| An invented place stays off the map | ✅ | t11 `[LOCATION:The Salt-Pits]` → `off` with the reason, marker "Last mapped place", the MAP block falls back to the realm brief |
| The pane in a dungeon | ✅ | trail Wralsol › Hushwick › The Red Abbey › The Crypt; fog reveals only `cryptstair-1` (then `chapel-1`); screenshot taken |
| MAP block size | ✅ | 1,121–1,598 characters over the run (cap 3,600) |
| Transport and errors | ✅ | 12/12 turns landed, 5–11 s each; `errors[]` empty; no atlas toast other than the tie |
| **The GM is told a tie** | ❌ **#692** | After the tie the block said only "The party is in Hushwick." The GM kept the crossroads as its own place: t1 "Hushwick lies east, past Bleakford", t6 a two-hour march to `[LOCATION:Hushwick]`. Two story places now sit on one map zone |
| **Rooms keep their building in the game's graph** | ❌ **#693** | `memory.map` filed `Hushwick\|Chancel`, `Hushwick\|Crypt Stair`, `Hushwick\|The Lower Chapel` beside `Hushwick\|The Red Abbey`. In this same village the library draws a Kitchen in both The Grey Lion and Neirgear's Cellar, a Hall in three buildings, a Passage in five: one node for several rooms. Not reproduced in play; derived from the keys this run filed and the library's room lists |
| **Arrival is described from the sheet** | ❌ **#694** | t12 `[LOCATION_DESC:]` for Gremgamouth was written with the realm brief only: "black cliff shelves… paths lead west toward Hushwick". The sheet drawn on that turn: a river mouth among woods, roads NE / S / SE, none to Hushwick |
| The opening uses the map | ⚠ known gap | The skeleton and opening are written around the preset start (*The Crossroads of Ashenveil*, region *The Blighted Reach*): no map name in the opening, an invented *Bleakford*, the quest named for it. This is "placed preset starts" and "the skeleton written onto the map" on row #684's open list |
| Travel time follows the map | ⚠ known gap | The block said Gremgamouth lies "145 km to the E as the crow flies (5 days), across ocean and forest"; the GM walked an "east road" in `[TIME_ADVANCE:2d]`. It also wrote a western cart track out of Hushwick where the sheet has roads E and S |
| "Last mapped place" after a walk out | ⚠ low | t11 left the crypt through the abbey and the village in one response; the committed pointer went crypt → The Salt-Pits, so the block says "The party's last mapped place is The Crypt" |

## What graduates

- **TODO #692** — the where-line states a player's tie. Needs the owner's word on what a tie means when the story place is not the settlement itself.
- **TODO #693** — sub-location identity for map chambers in `memory.map`.
- **TODO #694** — the arrival turn's sheet.
- **Row #684** — the live evidence is recorded there; the row stays ◉ until the owner's own mapped campaign.
- **Stays on the play checklist:** the opening and travel-time gaps (already on #684's open list); the "last mapped place" wording.

## Re-test after the #692 fix (2026-11-05)

Same realm (seed `qy49avnujq7o`), same tie (The Crossroads of Ashenveil → Hushwick), a fresh skeleton, the candidate atlas.js evaluated into the signed-in page before any version was committed. Campaign `camp_1793944511915_3637` (`PlaytestHarness_atlas692`), deleted and checked absent. Corpus: [dev/corpus_spotcheck_692_retest.json](../dev/corpus_spotcheck_692_retest.json).

| Turn | Before the fix (this audit's run) | With the fix |
|---|---|---|
| The where-line the GM was sent | "The party is in Hushwick." | "The party is in Hushwick. The story's "The Crossroads of Ashenveil" is at Hushwick on this map: the player placed it there." |
| "Which way is the nearest town?" | "Hushwick lies east, past Bleakford." | answered from the story's own places (Redford Crossing, Oakhaven); Hushwick not mentioned, and not put elsewhere |
| "How far is Hushwick from this crossroads?" | (not asked; the march took `[TIME_ADVANCE:2h]`) | "Ashenveil is no lost valley. It is the dead scrub wrapping around Hushwick itself. The village lies barely a mile north-east toward the coast." |
| Walking in | `[LOCATION:Hushwick]` after two hours | `[LOCATION:Hushwick]` after `[TIME_ADVANCE:25m]`; the description and exits are the sheet's (no wall, the sea to the north-east, The Green, The Grey Lion, Neirgear's Cellar, The Harbour on the eastern shore) |

One sample each way; the GM is not deterministic. The opening still ignores the map (the known gap): with the tie said, the GM folds its own geography around the map place instead of contradicting it.

## Method notes

- The spot-check steers; it does not sample. A scripted player who names map places is the easy case — the owner's own play is the test of an unsteered table.
- The first three turns were a fight the opening started (one failed attack, one failed escape, a truce by parley); no map behaviour in them.
- Harness nits seen, not atlas: a scripted start over a loaded campaign leaves the old story in the DOM until the first repaint; the campaign-folder picker toasts "must be handling a user gesture"; toasts pile up while the Browser pane's timers are paused; t4's raw response opens with the `[DICE:]` record twice.
- Driver and probes: `spotcheck-684.js` (session scratch, not committed); raw capture is the playtest harness's.
