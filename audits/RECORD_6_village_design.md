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

**C4 (v1.915, owner field report 2026-09-13):** the first village the owner started opened on a fey-rot siege — the opening user message said "Open the adventure… Plant an immediate hook" for every kind and the hero's backstory fed it. `buildOpeningIntro` is now kind-dispatched: the adventure literal byte-identical, the village a HOMECOMING that names the residents and forbids a hook or a threat; the kind's `openingWeather` replaces the adventure's ash at blueprint time.

**Built v1.914 (2026-09-13)** — list-I lines C1–C3 green: `villageReturnObserve` + `buildReturnNote` (once per real absence, a fact from the hero's record, an engine-chosen change), `villageRecapText` behind `carRecapText` (kind `recap:"state"`).

- A return greeting keyed on real elapsed time, rendered as prose in the first turn, naming one specific
  fact from this player's record; the Car Mode recap speaks state (who greeted you, your quarters, gold)
  instead of a chapter.
- At least one visible change per return: wares thinned, an hour shifted, a relationship axis moved.

## D. Residents

**Built v1.914 (2026-09-13)** — list-I lines D1–D4 green: the village rung (`villageRung`, alternating with commerce by turn when a purchase or sale is possible right here), `buildResidentExchangeNote` on `EXCHANGE_EVERY`, `residentWhereabouts` + the geo block's RESIDENTS ABOUT line, and `dev/village-measure.js` (the refusal count and its siblings, run on the live corpus).

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

**Built v1.914 (2026-09-13)** — list-I lines G1–G6 green: `stampCampaignFates` at `fileDenouement`, `villageHallSeed` (mementos + the wall, idempotent, on import and swap), THE HALL / THE WALL in the geo block only in the Hall, `closeCampaign` + the File-menu row (`closeMenuVisible`) + its confirm modal, `villageHallLine` + the sheet's Hall-line button and modal, and one Hall key however the GM names it (G6, found while building).

- Seeded on day one from the library: one object per retired resident; a wall for the unfinished, named
  not resolved; a File-menu "close this campaign" so a stopped campaign can be deposited (today "finished"
  fires only on the fourth death or the accepted ending).
- The primary content is a fate line per resident from the denouement companions block; objects are
  decoration; every memento names one thing the campaign never resolved.
- One optional player-authored line per retired resident, stored on the library character as canon.

## H. Rewards and tempo

**Built v1.914 (2026-09-13)** — the v1 cut is "the village pays nothing": `[XP:]` refused loudly (kind `xp:"none"`), the tag doc says so, a `[QUEST:]` still lands as a village goal the silent escalation notes never push. The rate-limited XP list is the re-cut if play wants it.

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

**C — arrival and return (2026-09-13)**

- **C1 The return is observed, once per absence.** `villageReturnObserve(now)` arms `returnPing` when the last turn is older
  than `PREVIOUSLY_AFTER_MS` (village only), stamped so the same absence never arms twice; the ping carries the real time
  away, ONE fact from the hero's record (latest defining moment, else a decision, else a chapter) and ONE engine-chosen
  visible change (an expired shelf, a resident's whereabouts, the hour). Adventure never arms.
- **C2 The greeting reaches the GM.** `buildReturnNote` (one-shot, village:fires) names the time away, the fact and the
  change and asks for a greeting from a resident present and a filed change; burned after one turn.
- **C3 Car Mode speaks state.** `carRecapText()` in the village says who you are, where, the day and hour, your gold, your
  house's stash and who is about — no chapter summary; the adventure recap is byte-identical.

**D — residents (2026-09-13)**

- **D1 The village rung sits ABOVE buy.** `engineFourthAction` offers a resident call or a look-in at a commons before
  the buy rung, rotating by turn and skipping whoever is already in the scene; the adventure ladder is unchanged.
- **D2 One exchange between two residents.** `buildResidentExchangeNote` fires when two residents are present and no
  exchange was asked within `EXCHANGE_EVERY` turns, naming both and one record each; latch `exchangeAsk`.
- **D3 Residents roam by the clock.** `residentWhereabouts(name,min)` is pure and deterministic: home at night, else a
  commons drawn from the map's shops and the kind's list by name and hour; the geo block serves RESIDENTS ABOUT for
  residents not present, and asks the GM to place them with tags when they appear. Adventure geo block unchanged.
- **D4 The refusal count is a measure.** `dev/village-measure.js` reads a corpus and counts refusals, invented threats,
  words per turn and unprompted resident actions; exported for the suite and run on the live corpus.

**G — the Hall (2026-09-13)**

- **G1 Fates are stamped at the ending.** `fileDenouement` stamps `sheet.fate` (campaign, cause, the sentence naming
  them, the unresolved quest titles) on the hero and every living party companion, so the library carries the fate.
- **G2 The Hall seeds from the library.** `villageHallSeed()` (idempotent, called by import) mints the Hall node with one
  memento per resident with a fate — an object from their sheet, the fate line, one unresolved thing — and a wall entry
  for every resident without one, named not resolved.
- **G3 The Hall reaches the GM.** Standing in the Hall, the geo block serves THE HALL (mementos) and THE WALL OF THE
  UNFINISHED; nowhere else.
- **G4 Close this campaign.** `closeCampaign()` ends an open adventure campaign with cause "closed by the player" and
  owes the denouement (the existing epilogue path); `closeMenuVisible()` gates the File-menu row.
- **G5 One player-authored line.** `villageHallLine(name,text)` stores a clamped line on the resident's sheet as canon,
  refreshes the memento and requests the library write-back.

**H — rewards and tempo (2026-09-13)**

- **H1 The village pays nothing.** `[XP:]` is refused loudly in the village (kind field), the tag doc says so; adventure
  XP lands. `[QUEST:]` still lands as a village goal the DRIVE rule never pushes (the escalation notes are silent).

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

## D5 — neighbours talk small (v1.942, owner field report 2026-09-16)

**Report.** "The small talk from the residents is too defining-moment centric. I can't walk across the street without being called out for 'I still talk about how you and Daeris walked from A to B holding hands…'. A simple greeting would be fine. Or weather, just small talk. Referencing defining moments launches into a heavy conversation a normal person wouldn't immediately initiate."

**Mechanism.** Not the model's taste: two engine notes told it to. The village WHISPERS note (phase B, `whisperResidentPool`) listed every present resident's LAST defining moment as the facts a rumour must be drawn from, and fired whenever a resident was in the scene and the cooldown had passed — in a village that is nearly every social turn. The D2 resident exchange seeded both residents with their last defining moment ("drawn from what they lived"). The DEFINING MOMENTS block and the return greeting also carry the past, but the greeting fires once per real absence and the block says "when relevant"; the two notes were the openers.

**Rule.** The street belongs to the day; the past belongs to the Hall and to the player's asking. This is an identity rule (which place, which channel), not a cooldown.

**Change.** A `smallTalk` field on the kind registry (village true, adventure false). With it set: the whisper note becomes SMALL TALK — one resident greets or passes a remark about TODAY, drawn from the weather, the hour (`clockPhaseLabelAt`), where each present resident is bound (`residentWhereabouts`) and the hero's own recent village decisions; the hero's defining moment and finished quests are dropped from the pool; the note bars "a defining moment, an old campaign or a shared past unless the player raised it in this scene — that talk belongs to the Hall". The exchange seeds from the same present-day facts with the same bar. The village DRIVE rule gains NEIGHBOURS TALK SMALL. The adventure whisper path is untouched (its fallback wording is byte-identical and pinned).

**Kept.** The return greeting's one fact per real absence; the Hall's mementos and wall; the player may ask anyone about anything and the DEFINING MOMENTS block still lets the GM answer.

**Tests.** The #6B whisper test now asserts no resident memory text, the SMALL TALK shape, the hour and weather facts and the Hall clause; the #6D2 exchange test flips from "one record each must feed the exchange" to "must NOT draw on their past"; a new #6 D5 test pins the DRIVE sentence and adventure byte-identity. Sabotage: the facts fall back to memories, the Hall clause is dropped, the exchange seeds from the past, the DRIVE sentence is removed — each caught by its named test.
