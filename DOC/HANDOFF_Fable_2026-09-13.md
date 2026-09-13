# Handoff — Fable session 2026-09-12/13 → next window

**Read this when** picking up TODO #6 (THE VILLAGE) after its build, or the day's loose ends. Ephemeral per the
trackers rule: open items live in TODO.md; this file archives as DOC/HANDOFF_v<ver>.md when superseded (the previous
one is DOC/HANDOFF_v1912.md).

## State

- **Live:** v1.914 (`APP_VERSION`, `sw.js` CACHE `tnd-v3-20260913a`), master pushed, tree clean except the owner's
  untracked files (DOC_TTS_2026_9_11.html, DOC/Research/tabletop_vs_traffic_and_dragons.html, audits/FeatureUsage_*.html,
  testRuns/*). Never stage those.
- **Suite:** 2157 engine assertions + the standalone suites green; goldens intact (the adventure prompt is byte-identical
  through every village phase). Batteries: 6-village-shape, 6-village-mode, 6-village-stash (34 cases), 6-village-hall
  (29 cases), 309-note-shapes — all caught.

## THE VILLAGE — built end to end

All phases of the ratified design are built: A shape, B prompt mode + Pax (v1.910–912), E houses/stash + F shops
(v1.913), C arrival/return + D residents + G the Hall + H rewards (v1.914). The record
(`audits/RECORD_6_village_design.md`) carries a **Built** marker under each phase and list I in full; the TODO #6 row
is the summary. Live receipts on the "P M" account campaign `VillageLiveCheck` (t0–t12): the audit
`audits/AUDIT_village_livecheck_v1912.md` (phases A/B/Pax), then the shop turns (t8–t11: the trade-refused note fired,
the shelf landed on the tavern, "Buy the Honeyed barley (3 sp) from Frizwick.") and the Hall turn (t12: the GM's
"Village Hall" canonicalised to the one Hall key, the wall served, "Call on Frizwick — tavern common room.").

**Not yet seen live:** a return after a real absence (C1/C2 — play the village tomorrow and the greeting note fires on
the first turn), a two-resident exchange (D2, needs two residents in one scene), a fate stamped at a real ending (G1 —
close an adventure through File ▸ Close this campaign, then move that hero into the village and look at the Hall), the
player's Hall line from the sheet button (G5), Car Mode's state recap spoken (C3), the eight-resident listening test.

**Open notes for the village (small, filed in the #6 row):** the opening-weather leak ("cold wind carrying ash" is the
adventure default; add an opening weather to the kind), `[NPC:]` downgrading a resident's `rel` to "acquaintance"
(cosmetic — readers test `.resident`), the Hall's wall entries read "an unfinished tale" because library sheets carry
no origin campaign (stamp `originCampaign` when a sheet is saved to the library from an adventure), and H's re-cut (a
rate-limited XP list) if play wants rewards.

## Mechanics the next window must know

- Every kind-aware site reads a field off `kindDef()` (data.js `CAMPAIGN_KINDS`): the E/F axes (`stashQuantities`,
  `tradeOnlyInShops`, `waresPerShop`, `pinPrices`, `sellRung`, `shopWords`, `hallWords`) and the C/D/G/H axes
  (`returnGreeting`, `villageRung`, `residentExchange`, `roam`, `hall`, `xp`, `commons`, `recap`, `closable`).
- The trade gate is `villageTradeContext(text)` (helpers.js) — the GOLD handler passes the response text so the
  response's own `[SUBLOCATION:]` and `[SAY:]` speakers count (the table runs GOLD before SUBLOCATION). A refusal arms
  `tradeRefusedPing` → `buildTradeRefusedNudge` next turn.
- `[SUBLOCATION_LEAVE]` clears only when it follows the last `[SUBLOCATION:]` in the text (F8). A Hall-named
  sub-location canonicalises to `villageHallKey()` (G6).
- The clock counts ELAPSED minutes from dawn: hour of day = elapsed + `DAWN_OFFSET_MIN` (residentWhereabouts,
  villageRecapText use it; the first cut got this wrong).
- `dev/sabotage.js` copies `dev/village-measure.js` into the clone because run-tests.js geval-loads it; a file
  run-tests loads must ride into the clone or every baseline reds (the #194L6 class).
- Preview: sign-in and "New Campaign" clicks are the owner's; the classifier refuses a script that wipes `tnd_*` keys
  in a signed-in preview. Unregister the service worker before reloading localhost to see new code.

## Loose ends filed, not done

- #406 gateway error responses carry no CORS headers (found in the live check). #403–#405 voice residues. #397 waits
  on the owner's composition lesson; #400 render engine phase A ready on the owner's word.
