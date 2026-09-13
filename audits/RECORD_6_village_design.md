# TODO #6 — The Village: the ratified design (2026-09-12)

**Read this when** building any part of the village, or re-deriving its mute/mode list. This is the full
record behind the TODO #6 row; the row carries the TLDR, the owner's rulings and the feature column.
Sources: the [nine-lens panel review](../DOC/panel/reviews/village/village_panel_review.html) and the
[Panel of Players review](../DOC/panel/reviews/village/village_players_review.html); both syntheses were
endorsed in full by the owner on 2026-09-12.

**TLDR.** One campaign in the picker that never ends; you play it as whichever library character you load;
the value is meeting the people you used to be, and a place that ran while you were away.

**Owner rulings (2026-09-12).** All Panel of Players ideas endorsed; the nine-lens convergence endorsed.
Forks settled: own campaign (not an attachment); the library is the source of truth with write-back on
every switch and departure; shop wares live and restock on the campaign clock (7 days), not on leaving or
resting.

## A. Shape

- Own campaign, `kind:"village"`, created from a shipped village blueprint; a departure/return beat into
  other campaigns is phase 2.
- Residents = library characters imported as NON-party NPCs with full sheets (the party cap of four must
  not gate residency).
- "Load character" = promote a resident to the hero slot and demote the old hero to residency; no billed
  GM turn; the handoff beat is the encounter with the character you were, not a resumption.
- Leaving the village or switching characters writes the sheet back to the library, with a visible receipt.

## B. The prompt mode (Fable — drift surface)

- Substitute, never subtract: a village DRIVE replacement in the same slot — a scene offers a person, a
  change, or a cost in coin or time, and ends on motion, never on danger — plus a preamble variant chosen
  from a table (a second push directive lives in the stable preamble, outside the note registry).
- One registry axis: the note-shapes `combat:` field widens to `modes` (combat, village); no per-site checks.
- ON: agenda births and beats, whispers re-aimed at residents talking about each other's finished
  campaigns, companion initiative, presence/mood/relationship audits, location items, the clock, hours,
  wares, rest.
- OFF: the DRIVE rule and telegraph, deadline and commitment observers, combat and death propagation (a
  loud refusal that says what the village permits instead), the reckless wildcard. Montage off in v1 but
  logged.
- A village chapter prompt: who was seen, what was said, what was decided (the era prompt asks for plot
  movements the village never produces).

## C. Arrival and return

- A return greeting keyed on real elapsed time, rendered as prose in the first turn, naming one specific
  fact from this player's record; the Car Mode recap speaks state (who greeted you, your quarters, gold)
  instead of a chapter.
- At least one visible change per return: wares thinned, an hour shifted, a relationship axis moved.

## D. Residents

- Residents may refuse: a fifteen-turn run counting refusals, grudges and "not today" is an acceptance
  test; zero fails.
- A village rung on the fourth button ABOVE buy — call on a resident, ask what they have been doing, a
  round at the tavern — so the ladder never falls through to commerce.
- One village ask for an exchange between two residents with the hero as witness.
- **Residents roam (owner, 2026-09-12).** A resident is not only at home: they may be at the tavern, in any shop,
  at the Hall or in any common area, so the village reads as lived in. Presence is filed per sub-location as
  today; the village mode places residents across the commons, not only in their houses.

## E. Houses and the stash

- Per-house nodes with an owner; items carry quantity or instance keys and a turn/provenance stamp; a
  placement at a missing node is refused loudly, never dropped.
- In village kind `taken` is refused outright (the tag carries no actor) and the `[ITEM_GAINED:]`
  auto-take path is gated too; an identity-layer merge must keep a house's items.
- The stash is SEEN: rendered in the inventory panel's grouped view, and a placement updates the house's
  own description so the prose names the object unprompted. The HOME block is data; the GM names at most
  two or three objects by what happened to them.
- Car Mode: a spoken "never mind" scoped to the last item move; a full-room listening test with eight
  residents before shipping.

## F. Shops

- Wares scoped to the shop sub-location with a per-shop cap and a loud eviction (today: one
  settlement-wide list of 2–6, evicted silently).
- Restock on the campaign clock; prices pinned to the bible value or anchored on the last quote; supply,
  not risk, is the constraint.
- **Transactions happen in the shop, with the shopkeeper (owner, 2026-09-12).** The buy and sell rungs of the
  fourth button are active only when the hero stands in a shop sub-location — never at the Hall, never on
  the street. Every transaction names both parties: the player character and the NPC they transact WITH; a
  purchase or sale with no named counterparty is refused.

## G. The Village Hall (a degraded v1, not phase 2)

- Seeded on day one from the library: one object per retired resident; a wall for the unfinished, named
  not resolved; a File-menu "close this campaign" so a stopped campaign can be deposited (today "finished"
  fires only on the fourth death or the accepted ending).
- The primary content is a fate line per resident from the denouement companions block; objects are
  decoration; every memento names one thing the campaign never resolved.
- One optional player-authored line per retired resident, stored on the library character as canon.

## H. Rewards and tempo

- Either a small village XP list, rate-limited, or an explicit "the village pays nothing" in the fiction;
  the quest log may hold village goals the DRIVE rule cannot touch.

## I. Pre-build failing tests

- Permanence: two same-named items stay two; an item files to the house named, not where the hero stands;
  a missing node refuses loudly; owner on the node; the auto-take path gated; wares survive one per shop; a
  node merge keeps the chest.
- Three swaps in ten turns with the person-drift check; the fourth button non-null on a full-HP,
  zero-gold, zero-quest state.
- Twenty-turn runs counting GM-invented threats, words per turn, refusals, unprompted resident actions and
  companion-initiative filings.

## J. Sequencing and the declared hole

- A → B → E, F → C, D → G → H; Car Mode items ride C and E.
- No independent account of low-stakes AI-GM play exists in the reachable corpus; the core thesis is
  tested in the wild on the owner's campaigns before the second act is built.

## History

The 2026-07 sketch (worldState.hq, [HQ_SET:]) and the 2026-08-24 attached-mini-skeleton framing are
superseded by the own-campaign form; the party-bench idea survives as a phase-2 standalone. The panel
rubrics live in `DOC/panel/` (designers) and `DOC/panel/players/` (the Panel of Players).
