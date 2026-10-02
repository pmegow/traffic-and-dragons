# Audit: #536 and #540 "a name that is one of JavaScript's built-in object keys" were built, reviewed, and held (2026-10-02)

**Verdict.** The build is not in the shipped code. Its two commits (`38868cf8` for #536, `fe60f3dc` for #540) are on branch `claude/536-reserved-words` and were never pushed to master. One independent review found that the approach works at the wrong layer: it takes a tag out of the reply's text before anything parses it, and the engine's handlers each split, normalise and pair tags in their own way. The poison is still reachable in three shapes, and removing a tag early causes five new wrong states. The work is held for a redesign (row #545).

**No urgency.** None of the twelve words occurs once as a whole word in 277 MB of real play text (212 files: the owner's saves, every corpus, test runs, samples, mementos). A GM writes one only if the player feeds it in. Nothing in existing play changes whether this ships or not.

**Session.** Fable 5.1, 2026-10-02. Builder and reviewer were separate agents. The reviewer got the code and the intent, never the builder's conclusions, and reproduced every finding through the real engine on both trees (before: `689c7f92`, after: `fe60f3dc`).

## 1. The defect

The engine keeps people, places and items in plain objects keyed by names an LLM writes (`memory.npcs[name]`, `memory.map.nodes[key]`, item tables). A name that is exactly `constructor`, `toString`, `__proto__` and the like reads the object machinery instead of a record.

- `[NPC:__proto__|dead|enemy]` writes `dead` onto `Object.prototype`: every NPC reads as dead until the page reloads.
- `[LOCATION:constructor]` makes every later prompt build throw. The place is saved, so the campaign stays stuck after a reload (probed on v1.1111).
- A census of 351 tag runs (9 words by 39 tag shapes) found 27 problems.
- The same names arrive without a tag: an `npcUpdates` entry named `__proto__` in the summary's extraction writes on `Object.prototype`; a blueprint whose starting place is `constructor` breaks the prompt from the first turn.

## 2. What was built

- **#536** `tagStripReserved(text)` in `applyMuts`: any tag whose operand (a piece between pipes or commas, trimmed, as written or lower-cased) is an own name of `Object.prototype` is removed and reported; a canon claim whose BEGIN or END marker carries one is removed whole.
- **#540** one list for every door (`RESERVED_KEY_WORDS`, `reservedKeyWord`, helpers.js); `summaryDropReserved` drops such entries from the summary's extraction; `validateBlueprint` and `validateSkeletonStructure` refuse such a file.
- Proof at the time: 10 tests red first, batteries 12/12 and 11/11, the full suite (2614), 92 standalone suites, the four replays, the 351-run census clean. The range-wide battery sweep had passed 106 of its 108 batteries when it was stopped; none had failed.

## 3. The review

| # | Finding | Label | Severity |
|---|---|---|---|
| 1 | An unclosed tag in front hides a reserved tag from the strip: `[TIME:dusk [LOCATION:constructor]` is one tag to the strip and two to the handlers. Eleven tags still write on the built-ins this way | Missed | High |
| 2 | An item whose NORMALISED name is the word still throws: "Constructors", "Constructor x2", "Constructor (from the smith)" all key as `constructor`. The tag beside it is lost with no line; inside a quest claim the claim is quarantined | Missed | Medium |
| 3 | A lone canon marker carrying the word is removed alone, and the claim's body then runs as ordinary tags: a death and its rewards land with no claim around them. Before, the orphan marker failed the reply closed | New | Medium |
| 4 | One half of a paired move is refused while the other half lands: a rope stowed at a place named by the word is gone; the Village counter takes the coin and gives no item | New | Medium |
| 5 | A name written as a one-element list passes the summary's check (`name:["__proto__"]`), and the extraction then uses it as a key: the #540 repro itself, through a list | Missed | High |
| 6 | A blueprint opened from My Library is never validated (an old gap in that path), so the refusal does not apply there | Missed | High |
| 7 | An arc titled "Arc 1: Constructor" can never be completed, in silence: the title's key drops the numbering and a plain-object set reads it as already seen | Missed | Medium |
| 8 | Smaller forms where a handler splits or normalises further: a spell or ability with a parenthetical, a party split, a layout list, an item definition's key, chained wares | Missed | Low |
| 9 | The transcript's entity index still records a refused name, and retrieval reads it as a key | Missed | Low |
| 10 | The provenance ring loses a refused tag on a busy turn (the label is appended last and the ring keeps ten) | New | Low |
| 11 | In the Blueprint Designer no review fix can be applied while one text field is exactly such a word (the role "Constructor") | New | Low |
| 12 | The summary's drop runs before the W2 preflight, so the preflight judges a different extraction than the model wrote | New | Low |
| 13 | Contract and comment lines the code contradicts ("never reaches a parser", "the two separators the handlers split names on", a deleted constant still named in the contract) | Docs | Low |
| 14 | A model-written companion sheet keeps item names verbatim; such an item can then not be removed by tag | Old | Low |
| 15 | `motivationChanges` with a list-valued name throws for any word | Old | Low |

The recorded limit was wider than the row said: the comma rule refuses ordinary sentences in thirteen shapes (a note "A mason, constructor, and father of three", a quest whose description lists the word, suggestion buttons, a defining moment, a place description, a mood or weather that is the word). Before the change all thirteen were filed with no error, because prose is not a key.

Checked and clean in the review: 223 real files (4,828,036 strings, 11,597 tags of 129 names) with no refusal and no byte difference; the four replays; all 30 corpora (1,236 raw replies, same summary lines and end state on both trees); every exact operand, also with spaces, a newline, a no-break space, a byte-order mark or capitals; 28 Array and Function names (the own names of `Object.prototype` are sufficient for the stores a tag keys into); well-formed claims; the Designer's Load, Save and Publish.

## 4. Why it is held, not patched

Every finding is another place where a handler reads the reply its own way: its own bracket scan, its own plural and parenthetical rule, its own list separator, its own pairing with a neighbouring tag. A filter over the text would have to know all of them, and each rule added to it either lets a shape through or refuses ordinary prose. That is the pattern of #504 and #525 earlier the same night: each patch moves the fault.

The build also changes what the engine does on such a reply (findings 3, 4, 10, 11, 12) while leaving the worst outcome reachable (findings 1, 5, 6). With no such word anywhere in real play, shipping it buys nothing today.

## 5. Direction for the redesign (not built; row #545)

Fix the stores, not the text.

1. **A name-keyed store has no prototype.** It is created with `Object.create(null)` and given a null prototype again at the one place a save is inflated, so `constructor` and `__proto__` are ordinary keys. A person may then be named Constructor. Stores the census touched: `memory.npcs`, `memory.locations`, `memory.map.nodes` and each node's guestbook, the graph's faction and adjacency tables, item and wares tables, the inventory fold's working table, the arc and custom-class "seen" sets, W2's planned-claims table, the retrieval scoring maps.
2. **A static registry read by a model-written key is read by own property** (the capability, item and class bibles): `capabilityLookup("constructor")` returned a function.
3. **Code that calls a method on a store** (`store.hasOwnProperty(k)`) or turns one into a string changes with it.
4. **No text is refused.** The tag boundary, the summary and the blueprint validators stay as they are on master.
5. **The oracle is the reviewer's census**, kept on the branch: 270 tag shapes by 43 decorations by 3 words (66,564 word and control pairs per tree). It reported 1,476 non-trivial results before the build and 230 after; the redesign is done when it reports none. Add the extraction lists (with list-valued names), every blueprint door (file, catalog, My Library, home handoff, quick start) and the Designer page.
6. **An independent review before the push**, as for every drift-surface change since this night.

Old gaps the review found on the way are filed on their own: the My Library path does not validate a blueprint (row #545 lists it as a door), and `motivationChanges` with a list-valued name throws (same row).

## 6. Evidence

- Branch `claude/536-reserved-words` (on origin; its last commit is marked to skip CI) holds both commits, their tests and batteries, and the reviewer's probes under `audits/reviews/536_reserved_words/`.
- Field: 14 blueprint files and 74 owner save files (16,798 names) hold no such name; 277 MB of real play text holds none of the words as a whole word.
- The builder's probes (`probe_other.js`, `probe_bp2.js`, `probe_stuck.js`, the first census) are in the same folder.
