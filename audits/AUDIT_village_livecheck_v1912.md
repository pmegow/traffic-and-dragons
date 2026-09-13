# AUDIT — THE VILLAGE (#6), first live check: phases A + B + Pax against the real GM (v1.912, 2026-09-12)

**Run.** Seven real GM turns plus one synthetic parser probe, in the owner's signed-in preview (localhost:3000, account "P M", gateway transport, `anthropic/claude-sonnet-5`), a fresh campaign `camp_1789278439673_7523` ("VillageLiveCheck") started from `samples/village.blueprint` with a level-1 Rogue, Tobin Vell. The library READ went to the real endpoint (`/api/characters`, 0 characters on this account); the residents were three fixture heroes lifted from the t2097 Runelords save (`testRuns/fixtures/village_library.json`: Frizwick, Daeris, Morwen Zethran, all L11) and merged through the real `importVillageResidents` core; `villageWriteBack` was replaced by a log-only twin so the swap could never POST a fixture hero into the account's library. Commissioned by the owner ("run the check") to close the evidence hole the 2026-09-12 handoff declared. Corpus: [`dev/corpus_village_livecheck_v1912.json`](../dev/corpus_village_livecheck_v1912.json) (transcript, tag log, note log, whispers, chapters, roster, map). **Cost:** $0.25 on the owner's subscription (8 turn calls + 2 summaries); the week's allowance is untouched by BYOK spend.

**Verdict.** **The village holds as built: the mode, the peace, the residents and the swap all behaved as the record says, in the fiction and in the engine, and the state survived a reload.** The GM opened on a person and a change with no quest and no threat; two deliberate attempts at violence (a stabbing, a bar fight with "roll for initiative") were both intercepted in prose exactly as the Pax clause asks, with NO harm or combat tag emitted; the synthetic probe proved the engine gates independently (HP, COMPANION_HP, COMBAT_START, NPC_DEATH_REPORTED refused with the registry copy; a loose SCENE_DEATH and a bare death claim dropped/quarantined; healing landed); whispers fired at t2 from the resident pool, about a resident, distorted the way the note allows; the free hero swap put Tobin in the street as a resident and Daeris behind "you" with the switch-POV block honoured on the very next turn; the write-back seam fired once (stubbed). **Four things to carry into the E/F build and one transport gap** are listed below; none is a contract break.

## Checks

| Check | Result | Evidence |
|---|---|---|
| Blueprint validates, `kind:"village"` stamps the save, adventure untouched | ✅ | `validateBlueprint` falsy; `worldState.kind==="village"`, `kindDef().label==="Village"`; after reload `getRulesBlock()` contains "DRIVE THE VILLAGE" |
| Library moves in BEFORE the opening scene | ✅ | villageLog: library-read (real endpoint, err null, 0 real) → populate added 3 → opening at t0 names Frizwick's chimney |
| Residents are outside the party, with houses | ✅ | 3 × `resident:true, partyMember:false, rel:"resident"`; nodes `The Village\|<Name>'s house` with `owner`; party panel shows only the hero |
| Opening: a person, a change, no quest, no threat | ✅ | t0: the rusted latch on his own door, Frizwick's smoke; `threat:"low"`, questLog empty |
| Village DRIVE rule holds under provocation (fiction) | ✅ | t3 stabbing → "The blade never arrives… Pax holds this place the way a hand holds still water"; t4 bar fight → table settles back, cup stops short, "Pax does not punish. It simply does not permit." No HP/COMBAT tag in either raw response |
| Engine gates (synthetic `applyMuts` probe at t4) | ✅ | `[HP:-3]`, `[COMPANION_HP:Frizwick\|-4]`, `[NPC_DEATH_REPORTED:Old Tam\|…]` → "Harm refused — the peace of Pax holds…" ×3; `[COMBAT_START:…]` → "Combat refused — the village has no dangers"; `[SCENE_DEATH:]` and `[NPC:Morwen\|dead]` in the pre-pass `refused` list (Morwen quarantined: no scene binding); `[HP:+2]` → "Healed 2 HP". HP 9→9, Frizwick 70→70, combat null, roster 3→3 |
| Whispers re-aimed at residents | ✅ | t2 `[WHISPER:]` about Daeris from her own campaign's defining moment, delivered by Frizwick; `worldState.whispers[0]` filed as rumour |
| A cost in coin | ✅ | t5 `[GOLD:-2]` for stew and a round (25→23) |
| Free hero swap, no GM turn, switch-POV on the next turn | ✅ | `_switchPlayerCharacter("Daeris")`: hero Daeris L11, Tobin → `resident:true`, `recentSwitch{from,to,kind:"village"}`, no handoff call; t6 narrates Daeris as "you" and Tobin by name in the third person |
| Library write-back fires on demotion | ✅ (seam) | villageLog `writeback-STUBBED Tobin Vell` — the real POST was deliberately not exercised (owner account) |
| Sub-location merges onto the owner node | ✅ | t7 `[SUBLOCATION:Morwen Zethran's house]` landed on the existing `owner:"Morwen Zethran"` node (visits 0→1), no duplicate |
| Chapter summaries in the village | ✅ | summaries at t3 and t6 read as a village day ("the village's protective pax preventing any harm") |
| Montage / wildcard off | ✅ (unobserved) | no `[village] montage would be due` console line in 7 turns — the rung never came due; the OFF-but-measured branch is engine-tested, not live-seen |
| Reload persistence and cloud sync | ✅ | after `navigate` reload: kind, hero, 3 residents, 3 owner nodes, turn 7 intact; toast "Last session's final turns synced now" |
| Signed-out empty-village toast | ➖ not exercised | the preview was signed in; the branch is engine-tested only |
| Combat panel, foes, death envelope with a real transaction id | ➖ not exercised | the envelope refusal (`w2PrepareResponse`) is pinned by the 6-village-mode battery; no GM turn produced an envelope |

## Findings (carry into the build)

1. **The adventure default weather leaks into the village and colours every turn.** `startGame` seeds `weather:"cold wind carrying ash"` / `threat:"low"`; the village blueprint has no weather field, so the GM echoed it as `[WEATHER:cold wind carrying ash]` at t0 and then wrote ash into all seven turns ("ash-blown world", "grey flecks drifting like slow snow", the garden under ash). A home with no dangers should not open under a burning sky. Remedy: an `openingWeather` on the kind registry (or a `weather` field the blueprint may set) — one entry, adventure pinned. → #6 row, phase E/F pre-build list.
2. **The demoted hero gets no house.** `importVillageResidents` mints `<village>|<Name>'s house` with `owner`; `swapPlayerCharacter`'s resident demotion does not (Tobin has no node after the swap). Phase E's stash contract needs the node to exist the moment a hero becomes a resident. → #6 row, phase E.
3. **`[NPC:name|…]` downgrades a resident's `rel` to "acquaintance".** Both Frizwick and Morwen lost `rel:"resident"` on their first `[NPC:]` tag. Nothing reads `rel` for the village (every reader tests `.resident`), so this is cosmetic today — but the sheet/roster surfaces show "acquaintance" for a hero the player once was. Remedy: the NPC handler keeps `rel` when `npc.resident` is set. → #6 row.
4. **Trade happened at a doorstep and a hearth, with no named shopkeeper.** t1 `[WARES:]` from Frizwick's door, t5 coin pressed into Frizwick's palm for stew fetched "from whoever's tending the fire". Expected until phase F (buy/sell only in a shop sub-location, every transaction names both parties) — recorded here as the baseline the F acceptance test must flip.
5. **Transport gap (not the village): the first post-swap GM call failed and the client could only see "CORS".** The gateway returned an error response without CORS headers, so the browser reported `blocked by CORS policy` and `ERR_FAILED`; the status and body were unreadable. The pending action was preserved (`tnd_pending_act_v1`) and `retryLast()` succeeded (200, 93 KB body). A server error path that omits CORS headers turns every 4xx/5xx into an unattributable failure on the client — a no-silent-failures gap on the server. → new TODO row.

## Minor observations (no action)

- The rumour called Ammut, Daeris's former hero and companion, "some devil or demon" — the note permits distortion and this invented no event, but it recast a person's nature; watch whether the resident-pool whispers drift this way when the pool is the players' own heroes.
- Prose time drift on sonnet-5: "tending the fire tonight" and "the quiet of a tavern at midday" at 8:50 AM (t5); "before dark takes it" at 9:10 AM (t7, seeded by the player's own "tonight"). One model, one session — not filed.
- Fixture artefacts: Daeris (L11, empty archetype) triggered the level-3 archetype modal on reload and a "rest to claim Lv 13" toast; a real library hero would carry its archetype. The summariser ran at t3 and t6 (SUMMARIZE_AT 2400) — ordinary for this prose length, not a village effect.
- The 2026-09-12 handoff's "sign in with a throwaway account" is not a path this agent can take (OAuth sign-in is owner-only); the owner signed in and clicked New Campaign, the agent drove the rest. The classifier also refuses a script that deletes `tnd_*` keys in a signed-in preview — hand that click to the owner rather than scripting around it.

## What graduates

- TODO #6 row: the live check is recorded; findings 1–4 join the E/F pre-build list (I).
- New TODO row: gateway error responses must carry CORS headers so the client can read the status (finding 5).
- The check campaign remains on the "P M" account as `VillageLiveCheck` (7 turns) for the owner to play on or delete.
