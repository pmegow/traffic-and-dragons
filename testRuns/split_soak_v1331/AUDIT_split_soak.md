# Split-soak playtest — 25 live turns on the ten-file UI build (v1.331, 2026-07-17)

**Purpose:** soak the #54 ui.js decomposition (v1.325/v1.326) on real GM turns before running the
dedup companion pass (#14/#15 + UA21 §4.2), per the seam map's own after-it-soaks instruction and
the user's go ("run 25 turns off the back of the latest save; if everything seems fine, pull the
trigger").

**Setup:** `Rise_of_the_Runelords_t755_REPAIRED2.tnd` imported into the preview (importSave's own
statements, replicated); `dev/playtest-harness.js` installed; 25 turns driven by random taps of the
LIVE suggestion buttons (zero scripted actions); Sonnet, anthropic provider.

## Verdict: GREEN — trigger pulled.

| Invariant | Result |
|---|---|
| Console errors during the run | **0 new** (pre-run buffer artifacts only) |
| Harness turn errors | **0 / 25** |
| Suggestion buttons | **live on all 25 turns** (0 fallback actions — generateActions + prompt-cache path healthy on the split build) |
| Summarize cycles | **4 completed** (sessionTokens 2845→474, 2805→330, 2444→471, 2450→324 — threshold/tail-retention behaving) |
| Tags applying | gold/import-migration deltas landed; dice blocks rendered; tags stripped from display |
| HP/gold/XP sanity | 75/75 HP, 303gp, 50,700 XP stable (no combat, no rewards this stretch — GM narrative choice, not engine fault) |
| Combat | none occurred (surface covered by the 4 replay corpora, not this run) |
| Live feature sightings | **#61 relationship audit fired on import pull-forward and the GM answered it** (t756: "All bonds read correctly against the fiction. No changes needed.") · **#60 consumable nudges answered correctly all run** ("Blasting charges were packed and carried, not detonated", "fuel block… a time reference, not consumed" — zero false decrements) |

## Evidence
- `corpus_turns_756-769_partial.json` — first-half corpus (turns 756–769, full narrations + vitals).
- Full 25-turn corpus durable in the preview profile's `localStorage['tnd_pt_corpus_v1']`
  (recovery: install dev/playtest-harness.js, `__ptLoad()`); the per-turn vitals table for all 25
  turns is embedded below.

```
turn | hp    | gold | xp    | sessTok | action (truncated)
756  | 75/75 | 303  | 50700 | 1222 | Slip out quietly and get breakfast from Ameiko
757  | 75/75 | 303  | 50700 | 1372 | Lie still and let them sleep a little longer.
758  | 75/75 | 303  | 50700 | 1669 | Check horses and gear before the others come d
759  | 75/75 | 303  | 50700 | 2031 | Listen at the shutters for anything unusual.
760  | 75/75 | 303  | 50700 | 2399 | Ask Frizwick if she's ready for the road.
761  | 75/75 | 303  | 50700 | 2845 | Head out — no sense waiting in the cold.
762  | 75/75 | 303  | 50700 |  474 | Head out — no sense waiting in the cold.   ← summarize cycled
763  | 75/75 | 303  | 50700 |  930 | Scout the road ahead for ambush points.
764  | 75/75 | 303  | 50700 | 1278 | Ride hard through the cut before it closes.
765  | 75/75 | 303  | 50700 | 1780 | Push through the cut fast, deny ambush time.
766  | 75/75 | 303  | 50700 | 2308 | Push on hard — reach the mountains before dark
767  | 75/75 | 303  | 50700 | 2805 | Signal Morwen to scan the ridgeline for magic.
768  | 75/75 | 303  | 50700 |  330 | Scout the shelf's perimeter in the dark.   ← summarize cycled
769  | 75/75 | 303  | 50700 |  859 | Ask Morwen what the ward perimeter means for e
770  | 75/75 | 303  | 50700 | 1193 | Press my ear to the crack and listen.
771  | 75/75 | 303  | 50700 | 1553 | Rest until dawn, then ride hard.
772  | 75/75 | 303  | 50700 | 1911 | Mark the crack's location on the operative's m
773  | 75/75 | 303  | 50700 | 2444 | Draw a weapon before entering the shadow path.
774  | 75/75 | 303  | 50700 |  471 | Head to the shaft entrance via the switchback  ← summarize cycled
775  | 75/75 | 303  | 50700 |  811 | Signal Frizwick to flank left silently.
776  | 75/75 | 303  | 50700 | 1289 | Throw a knife to draw it off the shelf.
777  | 75/75 | 303  | 50700 | 1657 | Slip past the warden while it stays fixed.
778  | 75/75 | 303  | 50700 | 2103 | Enter the shaft and descend.
779  | 75/75 | 303  | 50700 | 2450 | Have Morwen examine the lintel ward first.
780  | 75/75 | 303  | 50700 |  324 | Check how far behind us the warden is.     ← summarize cycled
```

Prose spot-read (turns 756–769): voice holding — terse declaratives, character-true companion
behavior (Frizwick "doesn't perform readiness", Morwen checks the bags anyway), no drift flags.
