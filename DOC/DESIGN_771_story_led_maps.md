# Story-led maps (#771): plan

Status: plan, not built. Owner asked for it on 2026-11-15 after playing Petrified Mire › Shattered Ridge › the wyrm's lair on the pin sheets.

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

## Known gaps to close in the map library

- A standalone wild sheet takes **one** road, from one bearing to another. A place with three exits needs several ways out.
- Whether an addition (`edits`) can be placed "along bearing SW on wet ground" or only at a point the caller computes.
- Whether adding an exit later redraws the ground. If it does, the library must change so it does not.
- Node and Chrome draw one seed slightly differently (#698). A sheet must look the same wherever it is drawn.

## Open questions (for the owner, when their phase comes)

1. **Blueprint locations.** Should a blueprint's named locations be set onto the region at Begin, hidden under fog, or only when visited?
2. **Towns.** "Ground only" for a town means streets and unnamed houses; named buildings only as the story names them. Is that the wanted town sheet?
3. **A direction the story later contradicts.** Today a settled direction cannot move. On an illustrated sheet a wrong one is more visible.
4. **The old campaigns on pre-generated maps** (legacy mode): leave as they are, or convert?
