# The atlas — TnD Maps in the game (integration plan)

**Status: BUILT 2026-11-05 (TODO #684, ◉ ready to test).** Approved 2026-11-04. Owner rulings, by question chips: the door is **the location name**; the
order is **pane before prompt**; the scope is **new campaigns, opt-in**; placement is **exact names + We are here**.

TLDR: the game vendors `tndmaps.js`, keeps a small per-campaign **atlas** (the recipes of the zones the party has
entered, and where the party stands), redraws every map from those recipes, tells the GM what the map says each turn,
and shows the map in a pane.

## The name

The game already calls its location graph "the map" (`memory.map`, `map_viewer.html`, `map_cleanup.html`). The drawn
maps are therefore the **atlas**: `atlas.js` (engine), `ui-atlas.js` (pane), `worldState.atlas` (store). The vendored
library keeps its own name, `tndmaps.js` / `TnDMaps`.

## What was measured (library 0.12.0, this machine, Node)

| Zone | Generate | Document | Recipe | Digest |
|---|---|---|---|---|
| region | 130–265 ms | 303 KB (81 KB gzipped) | 249 B | 3,636 chars |
| city | 93–137 ms | 134 KB | 668 B | 2,518 chars |
| village | 21 ms | 37 KB | — | 577 chars |
| inn interior | 11 ms | 13 KB | 362 B | 1,923 chars |
| sewer | 22 ms | 38 KB | derived from the town | 1,549 chars |
| wild zone | 85 ms | 18 KB | 606 B | 1,031 chars |

`tndmaps.js` is 718 KB of ES5. Documents are far too large for the save (localStorage and every cloud sync), so the
campaign stores **recipes only**, as the brief says.

## The crux: the game's places are narrative, the map's are geographic

The game's location pointer is whatever the story named — "The Salted Wound Tavern", "A shipwreck on the Blighted
Coast" are *world* locations today. The map knows Great Brem, its tavern `tavern-1`, the wild zone `z202_178`. Nothing
ties one to the other, and a guessed tie is worse than none: a ruin pinned as a town of 600 houses would be served to
the GM as canon. So the rule is **the engine never guesses a binding**. A place is on the map only when:

1. the story's name **is** a map name (exact, after case and a leading "the" are folded) — the GM is shown the map's
   names every turn and told to use them, so ordinary travel binds by itself; or
2. the player says so in the pane (**We are here**, one tap on a place).

Anything else is honestly **off the map**: the pane lists it, the GM is told the party's last mapped position, nothing
is invented. Adopting the story's names onto the map (renaming a tavern, placing a preset start) is later work, below.

## Design

- **Store** (`worldState.atlas`, about 1 KB, rides saves, sync and checkpoints):
  `{v, seed, at, zones: {<zoneId>: {kind, parent, via, params, lib, fp, turn}}, names: {<location key>: {zone, id}}}`.
  A zone id is the library's own derived seed (`<campaign seed>/p0`, `…/p0/inn-1`, `…/p0/sewer`), unique by
  construction. `params` holds only what was authored; everything else derives from the parent through the portal `via`.
- **Zone builders are one table** keyed `parentKind>childGenerator` → the library's nesting function
  (`region>town: town.fromRegion`, `town>interior: interior.fromTown`, `town>dungeon: dungeon.fromTown`,
  `region>dungeon: dungeon.fromRegion`, `region>wild: wild.fromRegion`, `dungeon>dungeon`, `interior>dungeon`).
- **Entry**: after a turn commits (never inside the tag parser), `atlasFollow()` reads the location pointer, resolves it
  through `names` or an exact name in the current zone, and enters the zone behind that portal — generating it once.
  Idempotent, so it also runs at load.
- **Documents** are rebuilt lazily from the recipes and held in memory only. Each recipe carries the library version
  and a fingerprint of the document it drew.
- **Version drift** has two guards. At vendoring time a test holds fingerprints for fixture seeds: a re-vendor that
  redraws any of them fails until the upgrader accepts it on purpose. At play time a rebuilt zone whose fingerprint
  differs is said out loud (toast, log, a `redrawn` record on the zone) — never silent.
- **Party marker** is derived from `atlas.at` at paint time, never stored.
- **Prompt**: one `MAP` block — where the party is on the map, the current zone's digest and the current place's
  neighbours with bearings, distances and days — with an explicit cut. Volatile half only; a campaign without an atlas
  is byte-identical. This is drift-surface work: review before, prompt diff on real saves after.
  **As built, two changes from this plan.** The block sits right AFTER `buildGeoBlock()` in `buildSysPrompt`, not
  inside it: Table Talk reuses `buildGeoBlock`, and a dungeon's digest would hand the help desk the chambers the
  player's sheet keeps fogged. The cap is 3,600 characters, not 2,400: a city's digest alone is about 2,500 and its
  list of trades is what sub-locations bind to, so 2,400 would have cut exactly the names the GM needs.
- **Pane** (`ui-atlas.js`): `TnDMaps.view` on a canvas, ink style, a breadcrumb up and down the entered zones, a card on
  a tapped place, **We are here**. Only entered zones can be opened (no peeking into an unvisited dungeon); a dungeon
  shows its way in and nothing else until room tracking exists.

## Proposed order (one commit each, version bumped, tests with it)

1. **Vendor**: `tndmaps.js` byte-identical, `dev/tndmaps.sha256`, load order, service-worker shell, engine manifest.
2. **Atlas engine**: `atlas.js` — store, recipes, rebuild, fingerprints, follow by exact name, and the
   fixture-fingerprint gate (it uses the engine's own fingerprint). No prompt, no UI.
3. **Pane and door**: `ui-atlas.js`, the opt-in at Begin, We are here.
4. **The MAP block** in the geo block — last, on proven ground.

## Independent review (2026-11-05, before the push; owner's ruling)

One read-only reviewer read the four commits and reproduced its findings against the real engine. All were fixed in a
fifth commit, each with a test and a battery clause:

- **The rule was broken (high).** A name match was recorded as a tie and kept for ever, and a sub-location was
  looked for on every sheet entered beneath the town. So "Common Room" in a second inn put the party in the first
  inn's, a room of an invented house became a room of an inn, and a tavern's name used in another town jumped the
  party back — and the MAP block told the GM so. Now only the player's taps are ties; a name is looked up afresh, on
  the sheet the party stands on and the sheets above it, never beside or beneath.
- **A stale card** tied whatever the story named when the button was pressed, not what the button said. The tap now
  carries what it showed and is refused when the story has moved on; a turn that lands repaints an open pane.
- **A party off the map** was still drawn as standing in the place it left, and that place's card withheld We are
  here. The marker is now "Last mapped place" and the card offers the tap.
- **Two false exact positions**: a wild zone entered through its north edge arrived at the next zone's own north
  edge; the sheet above marked the first way the party ever used. Both now use the way that points back, and say
  "somewhere here" when several ways lead in.
- **Smaller**: a store whose zones loop is set aside at load; the once-only notices are per campaign; a merged place
  keeps its tie; the quick start clears a Begin switch an abandoned Review step left on.

Known and left as they are: the HUD's location label follows the spotlight character while the atlas follows the
hero's pointer (a split party); a world place whose name contains `|` shares a key with a sub-location.

## The live spot-check and the tie that was never said (2026-11-05, #692)

The first real GM turns in a mapped campaign ([audit](../audits/AUDIT_684_atlas_spotcheck_v1353.md)) confirmed the design — the GM wrote the exact map name on 6 of 6 moves and the atlas followed across four scales — and found what no gate could: **a tie was kept and never said.** The player placed the story's "The Crossroads of Ashenveil" on Hushwick; the MAP block said only "The party is in Hushwick."; the GM kept the crossroads as its own place and put Hushwick two hours east of it.

**The fix (owner rulings by chips, 2026-11-05).** The where-line says the tie for the place the party stands in: `The story's "<story place>" is at <map place> on this map: the player placed it there.` Ruled "is at" over "is the same place" (which would have the GM re-describe a crossroads as a village and needs a rule about which name its tags keep) and over "lies within" (wrong when the story place IS the settlement under another name). Ruled the current place only over a list of every tie (the prompt would grow with every tap; a far-off tied place is still resolved by the engine when the story goes there).

**The live re-test** (same realm, same tie): the GM answered that the crossroads is "the dead scrub wrapping around Hushwick itself", a mile from the village, and walked in in 25 minutes with the sheet's own layout.

**The independent review before the push** found no high defect and two medium ones, both fixed: a tie to a wild sheet's edge was said as "is at north on this map" (an edge's name is a bearing; it is now said as the edge of its sheet, `ATLAS_TIE_AT`), and the commonest tie — a building the GM invented in a town the map names — had no test. It also showed that the battery's attribution could not fail (the suites print a test's name on PASS too): every clause now requires the named test's own FAIL line. One finding is its own row (#695): a sub-location can be tied to a sheet outside its world place, and the where-line then says two placements that contradict. "The current place only" is read as the place the story's pointer names.

Two more findings from the same run are open rows: same-named rooms of different buildings share one `Town|Name` node in the game's own location graph (#693), and a settlement is described before its sheet exists (#694).

## The library's audit and the re-vendor rule (2026-11-05)

An independent audit of the map library (`C:\Projects\TnD_Maps\Audits\Audit_Astra_2026.11.05.html`, 16 findings) was read from the game's side. Six of its library reproductions were re-run against the vendored copy (the same SHA-256 as the library's `dist`) and all reproduce: the road seam between neighbouring wild zones (A03, 92 m), reads that write caches onto the caller's document (A05), a wide town whose sewer cannot be drawn (A06 — not reachable here: every town the game draws is 800×550), coast eligibility judged at a zone's centre (A07 — the game inherits it: a land tap in a zone whose centre is sea is refused as "that point lies in the sea"), a plain TypeError for an inherited generator name (A11), and a silent no-op removal (A14). The owner approved a plan: the library half is handed to a TnD Maps session; the game files #696 (a keyboard route to a sheet's places — the audit's A09 applies to the game's pane too) and #697 (own-property lookups in the atlas tables — A11's class).

**The re-vendor rule.** A03, A06 and A07 change what a seed draws, and the game stores recipes, never documents: each such fix redraws the affected zones of every saved mapped campaign. Take them in ONE library release, read its notes for which generators redraw, and accept the fixture table in `dev/tests-684-atlas-engine.js` once, on purpose, in the re-vendor commit — with the owner's go, because saved campaigns' maps change. A05 must leave the fingerprints as they are (`atlasFingerprint` already ignores the caches). When A07 lands, add a game test that a land tap in a coastal zone is accepted and that a refusal's words are true of the tap: the game shows the library's reason to the player verbatim.

## Deliberately later (each its own TODO row once this lands)

- **Placed starts**: a start preset carries where it sits on the map (a tavern, a cave mouth, wild coast) and the map
  takes the preset's name.
- **Adoption**: a place the GM invents in a mapped town takes a free building of its kind (town edits exist today).
- **The story written onto the map**: the skeleton generator is shown the region so its acts use real places.
- Travel time checked against map distance; fog of war from room tracking; shops bound by kind; the #408 room graph
  read from an interior; companions apart as their own markers; player notes and pins; a second region; the Blueprint
  Designer authoring on a map; existing campaigns.

## Notes for a TnD Maps session (the library is not edited from here)

- A region pin shifts every later place's name (names are dealt only to unpinned places) — so a region cannot be renamed
  mid-campaign. Wanted: names reserved before pins, and a region rename edit by id, as towns have.
- `digest()` and `wild.fromRegion()` write `_biomeBytes` / `_heightBytes` onto the document they read.
- The library-side half of the SHA-256 pin.
