# TODO 702 — You are here: a place the GM names that the map does not know is ADDED to the map

The full record of TODO.md row 702, moved here on 2026-11-07 when the row passed the TODO.md row-size cap (6144 bytes). The row in TODO.md keeps the title, the TLDR, the verdict and the link; this file keeps everything the row said, as it said it. Size L, tier Fable.

## The row's description (rulings, design pointer)

**You are here: a place the GM names that the map does not know is ADDED to the map (owner 2026-11-06).** TLDR: "We are here" had the player point at the map and announce the party's place; the owner turned it around — the GM, told the map every turn, says where the party is, and a place it names that the map lacks becomes a place ON the map, stored as a delta in the zone's recipe.

**Rulings (chips):** add it (not tie it); the library learns to add a settlement; the player's tap wins over a later declaration by the GM; with no declaration the engine adds it beside the party; a town-level place takes its kind from its name, else a named feature; the GM may say where with `[MAP_PLACE:X|near A]`, `|between A and B`, `|at A` (a tie); rooms and chambers the GM invents are drawn too; legacy mapped saves are not migrated. Design: [DOC/DESIGN_684_atlas.md](DOC/DESIGN_684_atlas.md) ▸ "You are here".

## The row's status column (the build, the live spot-check, the four independent reviews, finding 8)

◉ v1.1362 — built with the #693 review round.

**Library 0.14.0** (`C:\Projects\TnD_Maps` 067bfbe, vendored): the region gains `edits` — `add` {id, name, kind, at} a settlement at a point (its site read from the ground, no road, a portal into its own town), `rename` by id without a reshuffle, `note`; laid over the finished drawing so nothing the seed drew moves; redraws none (the params echo gained `edits: []`, which is why the game's fingerprint now hashes the drawing WITHOUT the params echo — scheme 2, `rec.fpv`; old records are read under their own scheme with the recipe's params and settle silently).

**The game** (`atlas.js` ▸ "You are here"): `atlasAdopt` runs in the follow when the pointer's own place is absent (never a twice-borne name), once per story place (`A.adds`), up to three in one reply; the edit goes on `A.zones[z].params.edits`, the fingerprint is re-stamped on purpose; the kind table `ATLAS_ADD_WORDS` (inn, tavern, forge, shrine, …; a dwelling word → the library's house; anything else a named feature — which the library still gives a door and a house inside); a world place becomes a VILLAGE (the region knows no other kind of place — a wilderness name the GM invents becomes one too, said in the design as a limit); a room on the party's floor of the building; a chamber dug beside the party. The GM's `[MAP_PLACE:]` (tag_table, engine-only tier, taught by the MAP block) is read and cleared by the follow; a declaration the map cannot read, or on a place the player placed, is said on the MAP block for one turn (`A.told`). The tap (`atlasPlace`) removes an addition nothing hangs from — the interior opened through it goes too. `A.adopt` is the per-campaign switch (on; the engine suite's legacy groups turn it off to probe the off-map behaviour).

**Live 2026-11-06** (five gemini-3.8-flash turns, signed-in preview, [audit](audits/AUDIT_684_atlas_spotcheck_v1353.md) ▸ "Live spot-check of You are here"): the opening's crossroads became a village beside the capital; the GM wrote `[LOCATION:Bleakford][MAP_PLACE:Bleakford|between The Crossroads of Ashenveil and Hurdsea]` unprompted and Bleakford landed midway; it chose the village sheet's own inn over the player's invented name; "Harl's Forge" became a smith with an interior, its "at Bleakford" first refused in words — now read as "in this town".

**Not done:** additions in open country (a wild zone's features), a road to an added settlement (the library's row 1), a "landmark" kind for the region.

**Review 2 (2026-11-06, [audit](audits/AUDIT_2026-11-06_702_review.md)):** NOT READY TO PUSH — five highs (an added street thing bearing a room's name refiled every inn's room bare, the #693 fusion again; a one-reply building + room added the room as a house; an invented room displaced the temple's crypt stair; every undeclared world addition landed beside the capital; the tap on the added place's own card deleted it and left a dangling tie; the pair form indexed the inn under the room's key), five mediums, eight lows, 19 of 37 mutants alive.

**All fixed v1.1363** — the deepest sheet before rule (a), the reply's `fresh` sub as a container, per-thing add keys, the loss check (`atlasLost`), the party's last place, the roomiest house, ties marked `by:"gm"`, told lines true and for one prompt, every refusal said with the reason, `atlas.adds` a keyed store; 9 new engine groups (67), 37 new battery clauses (two retired as equivalent mutants — one wrongly, see review 3).

**Review 3 (2026-11-07, [audit](audits/AUDIT_2026-11-07_702_review3.md)):** NOT READY TO PUSH — two highs in the fusion class (a key could carry a ROOM in the middle, so a room re-stated by its own name landed on a twin node — the fresh path, rule (b)'s tail, a partial path, the three-pair from the street; a We are here tap on a room INSIDE an added building removed it with its rooms, and a tie beneath the home sheet left the chain empty so the rooms after it filed town-wide), the frame-margin mutant was NOT equivalent (the library accepts margin land), a stale `[MAP_PLACE:]` from a non-committing parse, one silent refusal, five test gaps, stale comments; 61 mutants, 40 caught.

**All fixed v1.1364** — a key is the zones beneath the world place then ONE name; `atlasChainBetween`; the inside tap refused and its card says so (`atlasAddHolds`, `added`); `atlasDeclsOfTurn`; the refusal said; `atlasRoomVariants`; the margin clause back with a test that sees it; 6 new engine groups (73), 18 new battery clauses.

**Review 4 (2026-11-07, [audit](audits/AUDIT_2026-11-07_702_review4.md), the two fix commits read):** NOT READY TO PUSH — the fresh path's re-statement guard compared the LAST unknown segment while the container had become the FIRST (the building re-stated became a room of itself; the room re-stated a town-level house that grew); `atlasKeyFromPosition` asked the store for a sheet the same reply had only peeked (the one-reply descent to the crypt threw and added the crypt as a town-level house); a pair opening with a spot of the home sheet left the party inside the inn with an empty chain; the growth's baseline held the failed room; a refused growth's reason was dropped; a sheet-sync `[MAP_PLACE:]` could be acted on by the pre-send follow; a tie onto a far sheet emptied the chain; 43 mutants, 21 caught.

**All fixed v1.1366** — the guard compares the container; `pos.know/sheet/enter` ride on the position; a spot with segments after it is passed through and a leading spot of the home sheet is stripped; the recipe is restored before the growth; the reasons said; game.js drops the declarations after the bookkeeping parse; a sub-location tie outside the world place is refused; 5 new engine groups (79), 13 new battery clauses.

**Finding 8 ruled (owner 2026-11-07, v1.1365):** a custom place is drawn medium (measured first: small held an invented room at 0 of 16 sites, medium at 10, large at 16; placement never refused) and, when a room the story names finds no room in it, is drawn large once (`atlasGrowHouse`) — the town's redraw must keep every thing and way and the house's own additions, else the growth is undone and the room refused with the reason.

**Owed:** the owner's live play.

## The audits

- [audits/AUDIT_684_atlas_spotcheck_v1353.md](../../audits/AUDIT_684_atlas_spotcheck_v1353.md) — the live spot-check (2026-11-05/06).
- [audits/AUDIT_2026-11-06_702_review.md](../../audits/AUDIT_2026-11-06_702_review.md) — the second independent review (18 findings, closed in v1.1363).
- [audits/AUDIT_2026-11-07_702_review3.md](../../audits/AUDIT_2026-11-07_702_review3.md) — the third (8 findings, closed in v1.1364; finding 8 ruled and built in v1.1365).
- [audits/AUDIT_2026-11-07_702_review4.md](../../audits/AUDIT_2026-11-07_702_review4.md) — the fourth, of the two fix commits (8 findings, closed in v1.1366).
- The design record: [DOC/DESIGN_684_atlas.md](../DESIGN_684_atlas.md) ▸ "You are here" and the review paragraphs.

## The fifth review and the end of the cycle (2026-11-07, v1.1367)

The fifth read ([audit](../../audits/AUDIT_2026-11-07_702_review5.md)) read the v1.1366 commit alone and ruled NOT READY TO PUSH on three findings: the fresh path read X as one name (a pair written under its own fresh container doubled the building and lost the reply's description; a pair of rooms kept a room in the middle); the strip of a leading spot named the rest as the town's only from the street (inside the inn, `Market Square — Fishmonger's Stall` became a room of the inn); a building the player placed on a spot, then the pair `Harl's Forge — Anvil Room`, had the reader stop at the landmark while the walk passed it and added a smith on the street. The owner ruled the third (keep the key, refuse the room) and closed the review cycle: five reads (16, 18, 8, 8, 3 findings), rounds 1–3 finding defects in the builds, round 4 finding two the round-3 fix introduced, round 5 at the margins. All three fixed as v1.1367 with tests and battery clauses; the owner's live play of a mapped campaign is the next read.
