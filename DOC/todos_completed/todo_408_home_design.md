# TODO #408 — Home design: a geometric description of a place, and the player's hand in it

**Status:** ◉ Ready to test — all six owner rulings built (v1.926–v1.928, 2026-09-14). Needs an owner village session.
**Origin:** owner field report 2026-09-13 — the prose gives a perfect homey sense (hearth, hanging herbs, cedar) but never the shape: how big, which rooms, where the doors go. Table Talk rightly answered "no floor plan is recorded". Two halves were filed: ① a standard way to force a GEOMETRIC description the engine keeps and serves back; ② the player designs their own house.
**Tracker row:** TODO.md #408 keeps title + TLDR + verdict + a link here (the row-size cap moved the record to this file).

## The six rulings (design conversation 2026-09-14, one question at a time)

1. **The record is a ROOM GRAPH, no coordinates.** Per room: a name, a size word (tiny/small/medium/large), one line of fixed features, the rooms it opens onto, `outside` for a door to the open air. Prose can honour "the kitchen is off the main room", never "3 m east". One shape that the GM files, a player authors, and the prose is checked against.
2. **The ask fires for village houses automatically; anywhere else on request.** A one-shot engine note (the #207 ③ hours-ask pattern) on first entry to a village house. Elsewhere, Table Talk's "no floor plan is recorded" answer offers one click, "Ask the GM to record it", which arms the ask for the next turn. No prose sniffing; no tavern gets a floor plan nobody wanted.
3. **The player's hand: a form is the authority; voice edits are gated on the player's own words.** The GM may file a change to the hero's house, but the engine applies it only if the player's own action text named that room. The GM can never redecorate unasked (Bert B5); Rosa can still say "put a workbench in the back room".
4. **Furnishings are stash rows pinned to a room.** A placed item is the SAME stash row with an additive `room` field, same count, same name. **Owner rule: a placement never rewrites the item's identity — "Cleaver" stays "Cleaver" with room "main room, on the mantle"; the name and the #81 canon entry are untouched; a rename remains its own explicit `ITEM_RENAMED` act.** Fixed furnishings (bed, hearth) are features text on the room, never counted.
5. **Served every turn while inside, as a compact LAYOUT block** beside the description and the stash: one line per room, one per placed item, roughly eighty tokens for a six-room house in the volatile half, so the GM cannot invent a cellar the record lacks.
6. **The design surface is an in-game modal opened from the stash panel** (ui-modals, over the live node, phone-friendly). A satellite can come later and reuse the registry.

**Build classification:** the tag, the parser write path, the geo-block LAYOUT block and the one-shot ask are drift surface → Fable, failing test first, doc golden re-baselined deliberately; the modal is a thin shell over the record; sabotage proves the identity rule in ④.

## What shipped

### Slice 1 — v1.926: ① ② ④ ⑤ (tag, ask, block, placement)
- `[LAYOUT:room|size|features|opens onto; …]` → `parseLayout`/`fileLayout` (memory.js). Loud refusals: bad size, dangling connection, no connections, empty record, duplicate room, and a second GM filing (GM filings are write-once). Stored as `node.layout={rooms:[{name,size,features,to[]}],by,turn}`.
- **ENGINE-ONLY tier:** the standing doc never carries LAYOUT, so the doc golden and the stable prompt half are byte-unchanged. The strip vocabulary grew by `LAYOUT|` (+7); the strip golden was re-baselined deliberately with a dated comment (a leaked floor plan would be read aloud in TTS).
- `buildLayoutNote` (api.js): one-shot-ask, combat-silent, latches `layoutAsk` / `layoutAskArmed`; fires unasked at a village house (a node with `owner`), anywhere else only after `armLayoutAsk(key)`; it is the only place the GM learns the syntax and the room operand.
- `buildGeoBlock` serves the LAYOUT block every turn inside: a line per room, a PLACED line per room-pinned item, the do-not-invent clause.
- `[LOCATION_ITEM:name|placed|place|room, spot]`: the fourth operand pins `row.room` (additive; `villageStash` and the STASH row carry it). The part before the first comma must name a listed room when a record exists, else the room is refused loudly and the placement still lands roomless; without a record the text is kept.

### Slice 2 — v1.927: ⑥ the design modal and the Table Talk arm
- `showHouseDesignModal` (ui-modals.js), opened from a "✎ Design your house" row in the stash panel (village only). Rooms with name, size, features and connections; each stash row gets a room picker and a spot.
- A thin shell over two pure writers in memory.js: `layoutSetByPlayer(key,rooms)` (ONE validator `validateLayoutRooms` shared with the tag; replaces any GM record; stamps `by:"player"`) and `stashSetRoom(key,item,room)` (pins or clears `row.room`, never touches the name; a room off the record and an unknown item refuse).
- Every refusal shows inline in the modal and changes nothing (verified in the preview: "Not saved — 'cellar' opens onto 'garden', which is not a listed room"). A failing persist or panel refresh after the write is logged as an error and reported in the toast; it never leaves the form stuck open (found in the preview against a synthetic state).
- `layoutAskOfferFor(question,key)` (helpers.js) offers the one-click arm after a Table Talk answer only for a SPATIAL question at a place with no record — decided from the player's own words, never by sniffing the model's answer (game.js).

### Slice 3 — v1.928: ③ the voice gate
- `fileLayout` takes the player's last action (`lastAction`). On the hero's OWN house with a player record, a GM `[LAYOUT:]` applies only where that text names every room the filing adds, changes or removes. A connection lost only because its room is removed is judged with the removal. A room holding a pinned item cannot be removed ("Cleaver sits there; move them first"). Any other house with a player record is never GM-editable. An applied change keeps `by:"player"` and stamps `voiced`.
- `locSplit` (identity.js) carries `layout` to the primary successor (the gap slice 1 named).

## Verification
- Five tests in the "#408 home design" section, each written failing first. Full suite ALL GREEN, 2174 assertions.
- `dev/sabotage-408-layout.js`: 19 clauses across memory.js, api.js, tag_table.js and helpers.js. Two were MISSED on the first run (the write-once probe was refused for a different reason; the re-placement path was never exercised) and one MISATTRIBUTED; all three tests were tightened and every clause is proven. The retained-proof wiring gate caught a stale find target after the branch was restructured.
- Contract paragraphs in `DOC/contracts/tags.md`.

## Owner test script
1. Enter your house in the village: the LAYOUT ask fires once; the GM files the room graph; the geo block serves it from then on.
2. Say "put a workbench in the kitchen" and watch the record change (voiced); say something that names no room and watch a GM redecoration get refused in the mutation log.
3. Open ✎ Design your house from the stash panel; add a room, pin an item, save; try a dangling door and read the inline refusal.
4. Ask Table Talk "is there a cellar?" at the tavern and click the offer; the next story turn files the tavern's layout.

Village saves need no migration.
