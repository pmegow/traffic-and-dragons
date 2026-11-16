# Story-led maps (#771): plan

Status: **P0 accepted, P1 built (v1.1439 to v1.1441, TnD Maps 0.24.0), P2 caves built (v1.1442, TnD Maps 0.25.0)**; buildings (the rest of P2), P3 and P4 not built. Owner asked for it on 2026-11-15 after playing Petrified Mire › Shattered Ridge › the wyrm's lair on the pin sheets.

## What the owner asked for

> "What I want is an illustration of the area I'm in. The world above isn't really all that helpful. The hierarchy should be: Petrified Mire: Shattered Ridge: Wyrm lair."
>
> "The player's current location mapped with topological details (swamp reeds, patches, etc), including exits from the current location. The next location should have an exit back to the previous one. Multiple layers. There should be a region map that shows the overall topology of the campaign. The locations the player has entered (city, town, mire, whatever) and sub locations from there. We had all this working, when pre-generated."

## Rulings (owner, 2026-11-15, by chips)

1. **The generator invents ground only.** Unnamed terrain: reeds, pools, tracks, rock, cave walls. Every named thing on a sheet comes from the story.
2. **The region is generated at the start** and hidden by fog. Places the story visits are set onto it in the direction travelled, on matching ground.
3. **New and existing campaigns** get the new maps. An existing campaign is redrawn from its own record; the record does not change.
4. The two ready fixes (#768, #769/#770) ship now; they stay useful under this plan.

## Why the two earlier designs each failed

- **Pre-generated maps (#684, retired for new campaigns by #735).** Rich sheets, layers, fog, routes. But the generator named the places, so the GM had to use the map's exact names, and any place the story invented was "off the map" or bolted on beside the party.
- **Pin sheets (#733, #744, today).** Truthful: only what the story disclosed is shown. But a sheet is pins on blank paper, features pile up on one sheet, and there is no picture of the ground and no region.

## The principle

**The story decides what exists and where it leads. The generator decides only what the ground looks like.** Nothing drawn bears a name the story did not give.

This keeps what was right in each design: the pre-generated maps' drawing, the pin sheets' truthfulness.

## What already exists and is kept

- **The story's own record.** `memory.map` (places, sub-places, the ways between them) and the public map knowledge (features with a direction, seen or heard of). This stays the single source. No second copy of the facts.
- **The generators** in TnD Maps: region, wild (forest, marsh, desert, mountain, hills, heath), town, dungeon, interior. The wild generator already draws a sheet that stands alone from a seed, a terrain and the bearings it is given, and already takes named additions at a point (`edits`).
- **The old atlas machinery** in `atlas.js`: one recipe per sheet (bytes, never a stored drawing), the trail of sheets, the fog record, the pane.
- **This week's work:** the GM gives a direction for what the party sees (#766), declares a site it goes inside (#769), and scenery is not a feature (#770).

## The three layers

| Layer | Drawn by | What the story supplies |
|---|---|---|
| **Region** | region generator, once, at Begin; fogged | Each visited world place, set down in the direction the party travelled from the last one, on ground that matches its name |
| **Place** (Petrified Mire, Shattered Ridge) | wild or town generator, seeded by the place | The ground kind; an exit at the sheet's edge for every way the story has opened, the way back included; every named feature, pinned along its direction |
| **Site** (the wyrm's lair) | dungeon or interior generator | The chambers the story names; the way in, which is the exit back to the place around it |

- **Hierarchy.** The plaque shows the trail (Petrified Mire › Shattered Ridge › Wyrm Lair). A site's pin on its parent opens the site; the site's exit leads back.
- **Ground kind.** Read from the place's name first (a mire is marsh), the way #765 does. When the name does not say, the GM is asked for one word from the generator's list.
- **Features with no direction** stay listed, as today, until #766 settles them.
- **Stability.** A sheet's recipe is its seed, ground, exits and additions. Adding an exit or a feature must not move anything already drawn.

## What this costs per turn

No new model calls. The asks that feed it exist already (#766 directions; the ground-kind word rides the GM's own turn).

## Phases

Each phase ends with something the owner can look at, and nothing later starts until the one before is accepted.

- **P0. Pictures first (no engine change).** Draw Kaelon's three places with the existing generators from his campaign's record, as images. The owner looks. This decides whether the generators' drawing is what is wanted before anything is built on it.
- **P1. Place sheets.** The current place is an illustrated sheet with its exits and pinned features, replacing the pin sheet.
- **P2. Sites.** A den, cave or building is a dungeon or interior sheet; its parent's pin opens it; it has its exit back.
- **P3. Region.** Generated at Begin, fogged, places set onto it as visited. The journey sheet (#757) retires into it.
- **P4. Existing campaigns and cleanup.** Recipes are built from the record at load. The landscape adapter (#744, #765) and the journey sheet are removed once nothing reads them.

## P1 as built (v1.1439)

- `atlas-public-sheet.js` turns one place's public record into the recipe the library draws; `atlas-public.js` draws it in place of the pin sheet and gives exits and places inside their cards. Nothing is stored: the sheet is read from the record at every draw.
- **Ground:** the place's own name (head noun, one row of nouns per ground; a way wears the ground it runs through), else a plain observed feature. No ground known: the pin sheet stays.
- **Ground asked of the story (v1.1441, owner 2026-11-15 on The Ironwood Heart: "There should be some topology here I'd hope"; ruling: ground for every place).** Only 2 of the 10 places of his campaign have a ground word in their name. `atlas-ground.js` asks once per place, after the turn commits, over the turn's public narration: one of the library's six terrains, or `other` (not open country: the pin sheet stays until P2 draws sites). Kept in `atlas.grounds`, never replaced. Order of sources: name, answer, then a feature only while nothing was answered.
- **Exits:** a world place has one for every way the party travelled; a place inside another has the way back out. A direction is the story's (a feature of one end bearing the other's name); an unstated one is dotted, laid south onward and north back so the two ends agree.
- **Features:** toward their bearing, in the order disclosed, on ground that fits the mark their plain noun earns. A name is never typed by its last word; a report is a ring; the ground's own noun ("mire" on a mire) and the place an exit leads to are not pins.
- **Listed, not drawn:** what has no direction, and a visited place inside this one that no feature names.
- **Not in P1:** the GM's one-word ground when the name does not say it; drawn tracks and rivers for the ones the story names; towns; sites (P2).

## P2 as built: caves (v1.1442)

- **What is a site:** a place whose name's head noun says so (lair, den, cave, caverns, grotto, burrow, warren, tunnels, mine), or whose ground the story answered `cave` (the ground ask's vocabulary gained the word; an `other` answered before is asked once more). One table row per site kind; a building is the next row.
- **The drawing:** TnD Maps 0.25.0's story sheet for a natural site. The generator digs the rock and names nothing. The first way the party came in is the mouth, named for the place it leads back to, toward that place (unstated: south). Each feature with a bearing names the free chamber toward it from the middle chamber, in the order disclosed; one with no free chamber within 67.5 degrees, one with no direction, and a later way out are listed. No scale and no level.
- **Stability:** the rock is the seed's alone; a later thing never moves an earlier one; a second way is listed, never a second mouth (it would redraw the rock). The one redraw left: a way back whose direction is first stated AFTER the party entered turns the cave to face it.
- **Hierarchy:** a bare `[SUBLOCATION:X]` written inside a sub-place is filed INSIDE it when that sub-place's sheet already shows X (the lair pinned on the ridge), and a known place is found where it is; `[SUBLOCATION_LEAVE]` steps out one place; the plaque reads Petrified Mire › Shattered Ridge › Wyrm Lair and each tier opens its sheet. The GM's map rules say both.
- **Not drawn:** a cave nobody travelled into (no way on record; the start of a campaign inside a cave) keeps its pin sheet.
- **Known limits:** a site first disclosed and entered in the SAME reply is filed beside the place, not inside it (the sheet does not show it yet), unless the GM writes the path; features the story filed on the ridge before the lair was declared stay on the ridge; buildings, built vaults and towns still answer `other`.

## Known gaps to close in the map library

- ~~A standalone wild sheet takes one road.~~ Closed in 0.24.0: `site.exits`, up to sixteen.
- ~~An addition only at a computed point.~~ Closed in 0.24.0: an `add` takes a `bearing` and stands on the best free ground of its kind in that eighth.
- ~~Adding an exit redraws the ground.~~ Closed in 0.24.0: a story sheet's relief and placed things do not move (pools and cover give way locally to the new track).
- Node and Chrome draw one seed slightly differently (#698). A sheet must look the same wherever it is drawn.

## Open questions (for the owner, when their phase comes)

1. **Blueprint locations.** Should a blueprint's named locations be set onto the region at Begin, hidden under fog, or only when visited?
2. **Towns.** "Ground only" for a town means streets and unnamed houses; named buildings only as the story names them. Is that the wanted town sheet?
3. **A direction the story later contradicts.** Today a settled direction cannot move. On an illustrated sheet a wrong one is more visible.
4. **The old campaigns on pre-generated maps** (legacy mode): leave as they are, or convert?
