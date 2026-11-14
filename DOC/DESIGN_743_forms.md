# #743 — Two forms: a true form and an alternate form for creatures and NPCs

*Read this when you build or change the alternate portrait, the form tag, or the designer's second portrait slot.*

Status: **design ruled, not built** (owner, 2026-11-13). Nothing below is in the code except what #741 and #742 shipped.

## Why

#741 put a creature's portrait on its combat card. A disguised creature then showed its true image: a plot spoiler in a
picture. The owner's ruling widened the fix from "a disguise slot" to a general second form: a disguise this time, but
also a character who advances or changes state (Gandalf the Grey and the White; a villain who becomes a lich).

## Owner rulings (2026-11-13)

| # | Ruling |
|---|---|
| R1 | Every creature and NPC has two portrait slots in the designer. **Slot 1 is always the true form.** Slot 2 is the alternate. |
| R2 | The alternate is not only a disguise. It is any second state the story calls for. |
| R3 | If the story calls for the alternate and no second image exists, the first image is shown marked ALTERNATE. The first slot's image is never altered or moved. |
| R4 | A switch changes the **portrait and the description**. The identity (canonical name) does not change; the on-screen label does (R13). |
| R5 | The **GM** switches the form, on a cue the author wrote. |
| R6 | A switch works **either way** (true to alternate and back). |
| R7 | NPCs get the same pair as creatures. |
| R8 | An existing disguised creature's single Description is **read as the alternate's**. The designer offers a one-click move; nothing changes silently. |
| R9 | The starting form is a three-way choice per entry: **Starts as true**, **Starts as alternate**, **As serves the story**. The story is not limited by an arbitrary starting point. |
| R11 | An individual whose entry is **As serves the story** shows **no portrait and no description** until the GM states its form. |
| R10 | The form belongs to the **individual in play**, not to the bestiary entry. Three hags from one entry: the first lures the hero as a beautiful woman; the other two are women or hags as the story needs. |
| R12 | **A group row shares one form.** Individuals of one entry in different forms are separate rows: one hag as a woman and two as hags is `Hags (2)` and `Woman`. |
| R13 | **The on-screen label follows the form.** A row shows the entry's public name (`displayName`) while alternate and its canonical name while true. Identity in combat tags stays the canonical name. This replaces today's rule that display labels do not track revelation (character.md) and is a contract change made with the build. |

## Blueprint fields (creatures and NPCs)

| Field | Meaning |
|---|---|
| `portrait` | The true form's image (exists today). |
| `desc` | The true form's appearance. For a legacy disguised creature with no `altDesc`, read as the alternate's (R8). |
| `altPortrait` | The alternate form's image. The game already reads it (#742). |
| `altDesc` | The alternate form's appearance. The alternate portrait is rendered from this text alone. |
| `altWhen` | The author's cue for the GM: when this entry takes or drops its alternate form. GM-only. |
| `startsAs` | `"true"`, `"alternate"` or `"story"`. Absent: `"alternate"` for a creature with a public name (today's behaviour), otherwise `"true"`. |

## In play

- **Where the form lives.** On the individual: the roster record for an NPC, the foe row for a creature in combat. The
  bestiary stays campaign-constant, so the stable half of the prompt does not change when a form does.
- **The tag.** `[FORM:<name>|true]` and `[FORM:<name>|alternate]`. The name is an NPC or a foe in the current combat.
  A foe introduced by `[COMBAT_START:]` takes its entry's `startsAs`; for `"story"` the GM states the form.
- **Undeclared `"story"` form (R11).** The card shows no portrait and no description until the GM states the form, and
  the engine says so on the console. Guessing either form risks a spoiler.
- **What the GM is told.** That the entry has an alternate form, its appearance and the cue, beside the GM-only notes it
  already sees for that entry. The appearance the GM narrates is the current form's.
- **What the player sees.** The enemy card and the NPC sheet show the current form's portrait and description. A missing
  alternate image is the first image marked ALTERNATE (R3).

## Designer

- A second portrait slot on every creature and NPC card, with Alternate appearance, the cue, and the three-way starting
  form (radio buttons).
- The alternate portrait prompt uses `altDesc` only. Kind, threat and GM notes stay out of it.
- Render all missing portraits (#732) fills a missing alternate when an alternate appearance is written.
- A legacy disguised creature shows "Move description to alternate" (R8).
- `BP_DESIGNER_VERSION` versions separately.

## Risk and review

The tag, its prompt text and the per-individual form store are **drift surface** (tag vocabulary, STATE TAGS doc,
canon injection). Fable tier; critical review before code; engine tests, stable-half byte identity and a prompt diff on
real saves after; one independent review before the push.

Silent failures to guard against:

- A form written onto the bestiary record would change the stable prompt half every switch and kill the cache.
- A `[FORM:]` naming something not present must be refused loudly, never filed against a look-alike name.
- A true portrait or true description reaching a card whose individual is in its alternate form.
- `altWhen` or `altDesc` leaking into Table Talk or the companion-talk persona.

## Step 2 review (2026-11-14, before code)

What it touches: the tag vocabulary (one new tag), the strip regex, the bestiary line in the stable half, the combat line and one new block in the volatile half, and the engine's words for a foe.

| Question | Decision | Why |
|---|---|---|
| Where is the tag taught? | Only where an alternate exists: the entry's bestiary line, the combat line, the characters' FORMS block. Engine-only in the standing list. | A campaign with no alternate keeps a byte-identical prompt and never emits a tag it has no use for. |
| Who may a tag name? | A foe of the current fight by its row's own name, else a character by its own name or registered alias. Exact only. | A form filed on a look-alike is a silent spoiler; `combatFoeByName`'s containment fallback is deliberately not used. |
| A target with no alternate? | Refused loudly. | There is nothing to switch to; accepting it would mark a true portrait ALTERNATE for no reason. |
| How does a group split? | By the grammar that exists: `[COMBAT_GROUP:]` lowers the one row, `[COMBAT_START:]` under the public name starts the other, which is alternate by its name. | Two rows need two tag names; the entry's public name is already a second exact name for it (`bestiaryRecord`). No new tag, no HP arithmetic by the engine. |
| Where does a form live? | On the foe row or the roster row. | The bestiary is the stable half: a form written there would rewrite the cached prefix at every switch. Tested: a switch leaves the stable half byte-identical. |
| An unstated as-serves-the-story foe? | The combat line asks for its form every turn until the GM files it. | The #612 headcount channel: an ask in the live state line is acted on; a standing rule is not. |
| The label pin ("keep the public label throughout the encounter")? | Retired for entries with a public name (R13). | The label now follows the form; the sentence would contradict the tag. This changes the stable half of a campaign that has a disguised creature, once. |

Verified after: 27 tests (failing first), 39 sabotage clauses, the frozen strip literal re-frozen on a diff of exactly one added name, the GM prompt byte-identical on six real saves (none has a disguise), the four replay baselines.

## Step 2 independent review (2026-11-14, after the push, owner's instruction)

One reviewer read both commits. Seven defects confirmed, none reached by the 27 tests; all fixed in v1.1420.

| # | Defect | Fix |
|---|---|---|
| 1 | The GM was taught `[FORM:Marsh Hag|true]` in the stable half while the row was named `Woman` (and the reverse): the tag was refused. | `formTarget` accepts the entry's other name when exactly ONE living row of that entry exists (two are ambiguous and refused); the combat line prints the row's own tag every turn. |
| 2 | A character with an alternate who fights as a foe could not change form. | A foe row whose entry has no alternate falls through to the roster; the form lives on the roster row. |
| 3 | A second foe started under a slain one's name was spoken of by the slain row's form (the true name leaked), and a tag reached the corpse. | The living row is preferred by `creaturePublicName` and `formTarget`. |
| 4 | The first statement of an as-serves-the-story form was announced ("Woman → alternate" says the woman is a mask); the note asked for a tag before any row existed, which is always refused. | A first statement says nothing; the note asks once the creature is in a fight; the refusal no longer mentions an alternate form. |
| 5 | An accepted NPC merge dropped the form and the alternate while carrying the true portrait. | The merge folds `form` and `NPC_FORM_FIELDS`; the survivor's own values win. |
| 6 | Table Talk was given a disguised foe's canonical name (older than #743). | It names a foe as the tracker does (`foePublicName`). |
| 7 | The NPC sheet's portrait editor opened and overwrote the true portrait whatever the form. | The editor is held while a character with an alternate is not in its true form (`npcPortraitEditorHeld`), with a toast. |

Also: a row in its true form that bears the public name is told to the GM as "Shown to the player as", not "Public name".

Known limits left as they are: a scene render seeds a party member's true portrait, and a generated sheet's own appearance text shows in either form.

Verified: 35 tests, 53 sabotage clauses, the full suite, the GM prompt on six real saves, the four replay baselines.

## Suggested build order

1. Engine read side: `startsAs`, `altDesc`, per-individual form, the card and sheet (display only where possible).
2. The `[FORM:]` tag and the GM's instructions (the drift-surface step, reviewed on its own).
3. The designer: second slot, fields, radio, batch render, legacy move.

## Open

- Nothing. (A group that splits needed no new tag: see the step 2 review.)
