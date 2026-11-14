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
| R4 | A switch changes the **portrait and the description**. The name does not change. |
| R5 | The **GM** switches the form, on a cue the author wrote. |
| R6 | A switch works **either way** (true to alternate and back). |
| R7 | NPCs get the same pair as creatures. |
| R8 | An existing disguised creature's single Description is **read as the alternate's**. The designer offers a one-click move; nothing changes silently. |
| R9 | The starting form is a three-way choice per entry: **Starts as true**, **Starts as alternate**, **As serves the story**. The story is not limited by an arbitrary starting point. |
| R11 | An individual whose entry is **As serves the story** shows **no portrait and no description** until the GM states its form. |
| R10 | The form belongs to the **individual in play**, not to the bestiary entry. Three hags from one entry: the first lures the hero as a beautiful woman; the other two are women or hags as the story needs. |

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

## Suggested build order

1. Engine read side: `startsAs`, `altDesc`, per-individual form, the card and sheet (display only where possible).
2. The `[FORM:]` tag and the GM's instructions (the drift-surface step, reviewed on its own).
3. The designer: second slot, fields, radio, batch render, legacy move.

## Open

- Whether a group foe ("Hags (3)") is one form for the group or needs one row per individual.
