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
- **The peace of Pax (owner, 2026-09-12).** The no-danger rule is symmetric: it protects the residents from the
  player as much as the player from the world. The settlement is under the protection of Pax, goddess of peace — no
  harm may befall those within its borders, nor be perpetrated by them. If the player attempts violence, theft or
  cruelty, Pax's peace intercedes in the fiction (the blow does not land, the hand is stayed) — never punished, never a
  fight. In the engine the harm tags (hero and companion HP loss, a scene death, a reported NPC death) are refused
  loudly like combat; healing always lands. A death ENVELOPE ([CANON_TXN_BEGIN … npc-death …]) is refused at the one W2
  gate every death passes, before evidence and before plot armor, with the reason "the peace of Pax: …" carried in the
  #213 refusal registry and its player copy ("no one in the village can be harmed or killed, so nothing happened").
- **Whispers are about anyone here (owner, 2026-09-12)** — the player, or a resident's own past — never only the party.

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

**Built v1.913 (2026-09-12)** — every list-I line E1–E9 is a green assertion; `dev/sabotage-6-village-stash.js` proves the guards. The Car Mode full-room listening test stays on the live checklist.

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

**Built v1.913 (2026-09-12)** — every list-I line F1–F7 is a green assertion, plus three found by the live shop turns the same day: F8 a leave-then-arrive response ends at the arrival (text order), F9 a refused trade is TOLD to the GM next turn (`buildTradeRefusedNudge`), F10 the gate judges the response's own arrival and speakers. Live receipt t11: the note fired, the GM re-filed the tavern, wares landed on the shop node, the button read "Buy the Honeyed barley (3 sp) from Frizwick." The shop-ness vocabulary is data on the kind (`shopWords`/`hallWords`); a blueprint may also flag a sub-location `shop:true` once sub-locations reach the blueprint schema (not yet).

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

Written 2026-09-12 after the first live check ([AUDIT_village_livecheck_v1912.md](AUDIT_village_livecheck_v1912.md)); each
line is ONE `t(...)` in `dev/engine-tests.js` under the section `#6 the village — phase E/F`, red before the code lands,
and every guard it pins gets a case in `dev/sabotage-6-village-stash.js`. Adventure stays byte-identical on the prompt
and unchanged on the ladder: every test that adds a village behaviour also asserts the adventure path did not move.

**E — houses and the stash**

- **E1 Permanence, two stay two.** In the village `[LOCATION_ITEM:Lantern|placed]` twice leaves ONE row with `qty:2` and
  a provenance stamp (`placed` turn, `by` the hero, `min` the clock); the adventure keeps its toggle semantics (a re-placed
  item flips `taken` back, no `qty`).
- **E2 Files to the house named.** `[LOCATION_ITEM:Lantern|placed|Frizwick's house]` lands on `The Village|Frizwick's house`
  while the hero stands in the tavern; the near-miss guard accepts the third operand; the STATE TAGS doc teaches it in the
  village line.
- **E3 A missing node refuses loudly.** A placement naming a place that is not on the map mutates nothing, puts a named
  refusal in the mutation log and warns on the console — never a silent drop (all kinds).
- **E4 `taken` has no actor.** In the village `[LOCATION_ITEM:x|taken]` is refused loudly and the stash keeps the item; the
  adventure still marks it taken.
- **E5 The auto-take path is gated.** `[ITEM_GAINED:x]` in the village auto-takes from the stash ONLY when the node's owner
  is the hero (or the node has no owner); from another resident's house the stash keeps the item and the log says whose
  house it is. Adventure auto-take is unchanged.
- **E6 Owner on the node, on every path.** `importVillageResidents` AND the swap's resident demotion both mint
  `<village>|<Name>'s house` with `owner` (the live check found the swap did not).
- **E7 A node merge keeps the chest.** `locMerge` of two houses sums same-named `qty` instead of collapsing twins and keeps
  the owner (the canonical's, else the duplicate's).
- **E8 The stash is SEEN.** `villageStash(key)` (pure) lists rows with qty and provenance; the geography block carries
  `STASH here` for the active node and a `YOUR HOUSE` line when the hero is elsewhere; the inventory panel's grouped view
  gets a `Your house` group over the same pure function; the adventure geo block is byte-identical.
- **E9 Car Mode undo.** `parseCarCommand("never mind")` → `{kind:"undoItem"}`; `undoLastItemMove()` reverses the last
  placement or take recorded in `worldState.lastItemMove`, once, and reports when there is nothing to undo.

**F — shops**

- **F1 A shop is a place, decided by data.** `isShopNode(key,node)`: village only, a sub-location with no owner that is not
  the Hall, matched by the kind's `shopWords` (tavern, smithy, trading post, alchemist, healer, guild, yard…) or
  `node.shop`; a house and the Hall are never shops; the adventure never has shop nodes.
- **F2 Wares live on the shop.** In the village `[WARES:]` files on the shop sub-location node (not the settlement), with
  `WARES_CAP_SHOP` per shop and a LOUD eviction (mutation log + console); a `[WARES:]` emitted outside a shop is refused
  by name. Adventure wares stay on the world node with the size cap.
- **F3 Restock on the clock, per shop.** A ware older than `WARES_RESTOCK_DAYS` is not served from that shop; the market
  ask (`buildMarketNote`) and the `FOR SALE HERE` line read the shop node in the village and fire per shop.
- **F4 Prices pinned.** A village ware with a bible value is recorded at the bible value (the quote noted beside it); a
  re-stated ware with no canon keeps its first quote. Adventure prices stay as narrated (the band warning only).
- **F5 Trade only in a shop, with a counterparty.** In the village `[GOLD:±N]` lands only when the hero stands in a shop
  sub-location with a present, living, non-party NPC; otherwise it is refused by name and an `[ITEM_GAINED:]`/
  `[ITEM_LOST:]` riding the same response is refused with it. The Hall, the street and a house refuse. Adventure gold is
  untouched.
- **F6 The fourth button names both parties.** The village buy rung reads `Buy the X (price) from Y.` and fires only in a
  shop with a keeper present; a village-only sell rung offers `Sell your X to Y (offer).` when the shop's WANTED row names
  an item the hero carries; the adventure ladder is byte-identical (no sell rung, same buy text).
- **F7 Suggestions obey the same rule.** The action validator rejects a buy/sell/pay suggestion outside a shop with a keeper
  in the village (`trade-outside-shop`); the adventure keeps `buy-without-seller` unchanged.

**Live measures (the playtest checklist, not node tests):** three swaps in ten turns with the person-drift check; the
fourth button non-null on a full-HP, zero-gold, zero-quest state; twenty-turn runs counting GM-invented threats, words per
turn, refusals, unprompted resident actions and companion-initiative filings; the full-room Car Mode listening test with
eight residents.

## J. Sequencing and the declared hole

- A → B → E, F → C, D → G → H; Car Mode items ride C and E.
- No independent account of low-stakes AI-GM play exists in the reachable corpus; the core thesis is
  tested in the wild on the owner's campaigns before the second act is built.

## History

The 2026-07 sketch (worldState.hq, [HQ_SET:]) and the 2026-08-24 attached-mini-skeleton framing are
superseded by the own-campaign form; the party-bench idea survives as a phase-2 standalone. The panel
rubrics live in `DOC/panel/` (designers) and `DOC/panel/players/` (the Panel of Players).
