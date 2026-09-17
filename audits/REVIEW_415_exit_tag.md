# #415 critical review — the narrated door (`[EXIT:]` tag)

Fable-tier review before code, per the drift-protection decree (2026-07-09). Reviewed 2026-09-16 against
v1.948. Owner rulings of 2026-09-15/16 are the spec (TODO.md row 415). Every finding below was resolved
confidently; nothing is left for the owner unless marked **owner call**.

## What it touches

| Surface | Change | Drift class |
|---|---|---|
| `tag_table.js` | one handler `EXIT` (after LOCATION/SUBLOCATION, like LAYOUT); `TAG_STRIP_NAMES` gains `EXIT`; `TAG_DOC_ENGINE_ONLY` gains `EXIT`; **no standing doc line** | parser + strip; stable STATE TAGS doc byte-identical |
| `memory.js` | `fileExit(name,note,turn)` (write-once on the current node, `node.exits[]`), `resolveExitsAfterMove(R)` (post-handler, the #173 commit pattern) | memory tier, map |
| `api.js` `buildGeoBlock` | one volatile line: the open exits on record here + the teaching sentence (the COMMONS line is the precedent for teaching a tag inline) | volatile half only, zero cache cost |
| `game.js` | `waysFromHere` lists exits; the manifest gains `man.doors` (not `man.exits`) | suggestion validator |
| `identity.js` | `locMerge` unions the duplicate's open exits into the canonical; `locSplit` keeps them with the primary successor (the layout rule) | W2 integrity |
| `api.js` `applyMutsTable` | `R.departKey = currentNodeKey()` captured at parse start | parser context |

Not touched: the transcript, `serializeWorldState`, the stable prompt, the STATE TAGS doc, Car Mode.

## Findings and their resolutions

1. **Ruling ④ said `man.exits`; that list is the wrong vehicle.** `man.exits` is filled only outside a
   sub-location and out of combat (B24) and the fallback phrases it as overland travel ("Press on toward X").
   A door inside the nave would either vanish (inside) or be offered as a road. **Resolved:** a sibling list
   `man.doors`, filled wherever exits are on record, fallback phrase "Go through <name>."; rule ⑤ already
   passes it (a door is not a known world node). Same legality the owner asked for, its own verb.

2. **"Next new place after taking it" cannot read the departure node after the move.** The SUBLOCATION
   handler overwrites `worldState.world.sublocation` before it calls the filer, and the exits live on the
   node the party LEFT. **Resolved:** `applyMutsTable` captures `R.departKey` before any handler runs;
   `resolveExitsAfterMove(R)` runs post-handler and resolves an exit on the departure node when (a) a node
   was CREATED this parse under the same parent (or, for a world-node exit, a new edge from it), and (b) the
   player's own `lastAction` names that exit (the `named()` substring test `fileLayout` already uses for the
   voice gate — the same evidence standard). Without (b) a new room filed for any other reason leaves the
   door listed; that is correct, the door is still untaken.

3. **Name-match resolution.** Case-insensitive on the display leaf, leading "the " stripped, through
   `locResolve`/`locDisplayLeaf` so an aliased name matches. Scope: siblings under the exit node's parent
   (for a sub-location exit), children and edge-neighbours (for a world-node exit). The map is two levels
   deep (`fileSubLocation` composes only `world|leaf`), so "same parent" is well defined.

4. **A floor plan is already a door record.** The LAYOUT doc says "never narrate a door the record does
   not hold"; an `[EXIT:]` on a node with `node.layout` would contradict the plan. **Resolved:** refused
   loud ("this place has a floor plan; the plan is its door record"). Village houses all carry plans, so the
   village interior is untouched by construction.

5. **The over-filing lever is three guards, not one.** (a) The teaching sentence: a door, stair, passage or
   path the party COULD take that has NO place on record; never a window or decoration. (b) The filer refuses
   a name that already matches a filed sibling place ("already a way") — otherwise the GM re-files every
   known place and the row doubles. (c) The cap: five OPEN exits per node, the sixth refused with ⚠ in the
   mutation log and a console warn (LAYOUT's refusal shape). A duplicate name is a benign skip (debug log,
   "Exit already on record" mut line), never an error.

6. **Resolution REMOVES the exit; it does not tombstone.** Bounded by the cap, freed on resolution, nothing
   accumulates (monotonic-resources pass: per-node ≤5, nodes bounded by the map).

7. **Merges and splits (#156B).** `locMerge` today carries no map-node fields (the duplicate record stays,
   resolution maps reads to the canonical) — its open exits would silently vanish from the row. **Resolved:**
   union the duplicate's open exits into the canonical (dedupe by name, cap respected); a split keeps them with
   the primary successor exactly as the layout does. Pinned by a test.

8. **The `state` operand (owner call, resolved here unless overturned):** `[EXIT:name|note]` where the note
   is optional free text ("ajar", "locked", "a dark stair down") shown in the geo block and as the chip's
   title. It is DISPLAY only: the parser never branches on it (the shared-stem rule — an `open`/`locked`
   enum invites a substring misfile), and a "locked" door is still a legal move; the player may try it.

9. **Stable-half byte identity.** Engine-only tier: no STATE TAGS doc line, so the stable hash test stays
   green; the teaching rides the volatile geo block (~60 tokens/turn, in line with COMMONS/HOUSES). The
   #311 tier test needs `EXIT:` to appear in api.js — the geo line satisfies it.

10. **Row order and styling** (ruling): after sibling sub-locations, before roads; `kind:"exit"`,
    `unexplored:true` (dashed), action "Go through <name>.". Mid-combat inside a sub-location the row is
    still the one honest move out (B24, unchanged); outside, exits show like siblings.

## Test plan (test-first; each fails red before the code)

Engine (`dev/engine-tests.js`): parse + file on the current node with turn; duplicate = benign skip; sixth
refused loud; refused where `node.layout` exists; refused when the name matches a filed sibling; name-match
resolution on `fileSubLocation` under the same parent (article and case insensitive; alias via the identity
table); next-new-place resolution ONLY when `lastAction` names the exit (negative case pinned); world-node
exit resolves on a new edge after taking it; `waysFromHere` order/kind/action; `man.doors` inside a
sub-location and "Go through the back door." passing the validator; `cleanTxt` strips the tag; merge union
and split carry; STATE TAGS doc hash unchanged (existing contract).

Sabotage (`dev/sabotage-415-exit.js`): the cap, the layout refusal, the sibling refusal, the lastAction
gate — each mutation must change bytes and turn the suite red.

Live: one 20-turn gemini playtest on the model-test campaign counting `[EXIT:]` filings per new scene
(expect ≤1) and one church-shaped scene (nave, narrated door, rectory) walked by hand: the door appears
dashed, the tap prefills, the arrival resolves it to "the rectory".
