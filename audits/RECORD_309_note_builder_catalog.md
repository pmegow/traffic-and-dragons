# RECORD #309 — NOTE_BUILDERS catalog (2026-09-03)

Evidence for the #309 ruling. Produced by a read-only catalog pass over `NOTE_BUILDERS` (api.js:1541) on v1.769; nothing was edited. Ruling drawn from it: **one-in-one-out is REJECTED** — builders are six shapes, not fungible units; the review's merge groups are mostly frame-only; the cost is delivered bytes per turn, not function count. Adopted instead: the notes ring first, a shape-registry contract, shared frames for the two template families at their existing registry positions, a per-turn delivery cap decided from ring data, the #297 routing scan, and the defects in the last section.

48 of 49 builders are defined in `api.js`; one (`buildProvisionalNudge`) lives in `identity.js`. Constants are in `globals.js` unless noted. Size buckets: short <300, medium 300–800, long >800 chars of emitted text.

| # | name | file:line | TRIGGER | LATCH / COOLDOWN | COMBAT-SILENT? | SHAPE | ACK | SIZE |
|---|---|---|---|---|---|---|---|---|
| 1 | buildArcWallNudge | api.js:1485 | active arc within `ARC_WALL_WARN_LEAD` of `ARC_TURN_BUDGET` AND ≥1 open quest with `bornArc`==arc | `arcWallWarned[arcTitle]=turn`; re-fires every 15 (`ARC_WALL_WARN_LEAD`=15, doubles as cooldown) | yes | cooldown-reminder | `[QUEST:…\|completed]` / arc completion | medium (~534) |
| 2 | buildOrphanCombatNudge | api.js:474 | `worldState.orphanCombat` armed (tag_table.js:1447 — combat tags after encounter closed) and not `.delivered` | `orphanCombat.delivered=true`; one-shot; moot-clears if combat re-opened | **no** (deliberate, #225) | one-shot-ask | `[COMBAT_START:]` re-open, or silence | medium (~542) |
| 3 | buildCombatStaleNudge | api.js:482 | combat open, living foes, no combat tag for `COMBAT_STALE_TURNS`=2 | `combatStalePing=turn`; re-fires every 2 turns | **no** (deliberate, #214②) | cooldown-reminder | `[ENEMY_SLAIN:]`/`[ENEMY_HP:]`/`[COMBAT_END:]` (bumps `combat.lastTouch`) | medium (~645) |
| 4 | buildUndefinedItemNudge | api.js:1302 | `itemDefCandidate` armed at acquisition (api.js:1290) for an item with no bible effect | consumes `itemDefCandidate`; stamps `itemDefAsked[key]` — **once per item per campaign**, cap 60 keys | yes | one-shot-ask | `[ITEM_DEF:]` (or the ever-latch) | medium (~600) |
| 5 | buildQuestEscalation | api.js:421 | active quest with `allDoneSince` ≥ `QUEST_ESCALATE_TURNS`=3 turns ago | **none** — fires every turn while the stamp holds | yes | cooldown-reminder (degenerate N=1) | `[QUEST:…\|completed]` or `[QUEST_STEP:]` (clears `allDoneSince`) | medium (~427) |
| 6 | buildQuestObjectiveNudge | api.js:440 | active quest with `noObjSince` ≥ `QUEST_OBJECTIVE_NUDGE_TURNS`=3 and zero objectives | **none** — fires every turn while the stamp holds | yes | cooldown-reminder (degenerate N=1) | `[QUEST_STEP:]` | medium (~340) |
| 7 | buildQuestStaleNudge | api.js:497 | active quest, no `lastTouch` for `QUEST_STALE_TURNS`=30 (legacy unstamped = infinitely old) | `questLog[].staleNudged=turn` — **nested**, not in flat NOTE_LATCH_FIELDS; snapshotted title-keyed at api.js:1522/1544 | yes | cooldown-reminder | `[QUEST_STEP:]`/`[QUEST:…\|active]` (tag_table.js:659,697 clear `staleNudged`) | medium (~529) |
| 8 | buildSplitAudit | api.js:551 | `splitLoc` older than `SPLIT_AUDIT_TURNS`=10, or same-world waiver (any age) | `splitLoc.audited=turn` — **nested**, snapshotted via `snap.split`; per-member re-fire every 10 | yes, without consuming | audit + fork | `[PARTY_SPLIT:…\|rejoin]` or re-affirm | long (frame 672 + one line/member) |
| 9 | buildReunionNote | api.js:589 | `pendingReunion` armed by the co-location fold (tag_table.js:1374) | consumes `pendingReunion`; 3-turn shelf then silent discard | yes, without consuming | transient (3-turn shelf) | narration, or re-emit `[PARTY_SPLIT:]` | medium (~495) |
| 10 | buildPresenceAudit | api.js:606 | `turn - lastPresenceAudit` ≥ `PRESENCE_AUDIT_TURNS`=12 and ≥1 with-party companion | `lastPresenceAudit=turn`; global cooldown 12 | yes, without consuming | audit | `[PARTY_SPLIT:]` or `[NO_CHANGE]` | long (frame 575 + name list) |
| 11 | buildStayBehindNudge | api.js:751 | `presencePing` armed by `detectStayBehind` (game.js:1715) | consumes `presencePing`; 2-turn shelf | **no** | transient (2-turn shelf) | `[PARTY_SPLIT:]` | medium (~436) |
| 12 | buildPlayerSplitNudge | api.js:770 | `playerSplitPing` armed from player input (game.js:1722) | consumes `playerSplitPing`; 2-turn shelf | **no** | transient (2-turn shelf) | `[PARTY_SPLIT:]` | medium (~490) |
| 13 | buildDeityDriftNudge | api.js:623 | divine-class sheet whose `actualAlignment` is off its `DEITY_MAP` grid (player or companion) | `deityDriftNudged[who]=turn`; `DEITY_DRIFT_COOLDOWN`=25 | yes | cooldown-reminder | none — GM-decides, `[NO_CHANGE]` | medium (~418) |
| 14 | buildReconcileSkipNudge | api.js:741 | `reconcileSkip` armed by clock.js:440 (phase already passed today) | consumes `reconcileSkip`; 2-turn shelf | **no** | transient (2-turn shelf) | `[REST:long]`/`[TIME_ADVANCE:]`/`[TIME:]` | medium (~518) |
| 15 | buildPhaseMismatchNudge | api.js:1216 | `phaseMismatch` armed (clock.js:505/620) and band distance still ≥ `PHASE_MISMATCH_MIN`=240 min | consumes `phaseMismatch`; moot-clears if band healed | yes, without consuming | one-shot-ask | `[TIME:]` | medium (~362) |
| 16 | buildLocationFilingNudge | api.js:1224 | `locationFilingPing` armed (game.js:1631, `LOCATION_FILING_TURNS` untagged turns at a place) | consumes `locationFilingPing`; pure one-shot | yes, without consuming | one-shot-ask | `[LOCATION:]`/`[SUBLOCATION:]`/`[NO_CHANGE]` | medium (~412) |
| 17 | buildTravelPriceNudge | api.js:1228 | `travelPricePing` armed (game.js:1639, days-priced journey, minutes elapsed) | consumes `travelPricePing`; pure one-shot | yes, without consuming | one-shot-ask | `[TIME_ADVANCE:Nm]` | medium (~476) |
| 18 | buildCommitmentNudge | api.js:1232 | `commitmentPing` armed by `detectDatedCommitment` (game.js:1646) | consumes `commitmentPing`; pure one-shot | yes, without consuming | one-shot-ask | `[SCHEDULE:]`/`[FUTURE_EVENT:]`/`[QUEST:…\|offered]` | medium (~464) |
| 19 | buildFutureResolveNudge | api.js:1236 | `futureResolveHints` queue non-empty (memory.js:672, summary contains an outcome) | shifts one hint per turn; queue is the latch | yes, without consuming | one-shot-ask (per hint) | `[FUTURE_EVENT_RESOLVED:]` | medium (~356) |
| 20 | buildLocationTwinNudge | api.js:1240 | `locationTwinConflicts` queue non-empty (tag_table.js:325, refused `[LOCATION:]`) | shifts one per turn; queue is the latch, cap 4 | yes, without consuming | fork-note (after a refusal) | `[SUBLOCATION:]` or a distinct world name | medium (~404) |
| 21 | buildLocationDescNudge | api.js:523 | party settled (past `firstVisit`) at a node with `description` null | `locDescNudged[key]=turn`; `LOC_DESC_NUDGE_COOLDOWN`=10 | yes | cooldown-reminder | `[LOCATION_DESC:]` (ends it permanently) | medium (~407) |
| 22 | buildLocationStateNudge | api.js:213 | `pendingLocState.node` armed at combat close (tag_table.js:869/887) and party still at that node | sets `pendingLocState.fired=turn`; **consumed at commit** (game.js:1701); departure deletes silently | yes, holds without consuming | one-shot-ask | `[LOCATION_STATE:]` or silence | medium (~373) |
| 23 | buildScheduleEscalation | api.js:784 | a `scheduleDue()` entry with elapsed between `SCHEDULE_ESCALATE_MIN`=3h and `SCHEDULE_EXPIRE_MIN`=2d | **none** — fires every turn while an entry sits in band | yes | cooldown-reminder (degenerate N=1) | `[SCHEDULE_RESOLVED:]`/`[SCHEDULE_CANCEL:]` | medium (~484) |
| 24 | buildExpiredThreadNudge | api.js:197 | any `memory.futureEvents[]._asked === worldState.turn` (set by the pre-request sweep) | latch is `futureEvents[]._asked`, **outside worldState** — deliberately unsnapshotted (header api.js:193) | **no** | one-shot-ask (single-fire by turn stamp) | `[FUTURE_EVENT_RESOLVED:]` / re-file | medium (~393) |
| 25 | buildConditionAudit | api.js:805 | any condition ≥ `CONDITION_AUDIT_TURNS`=12 old/unstamped, **or** any `until` elapsed | `lastConditionAudit=turn` + `CONDITION_AUDIT_COOLDOWN`=12; expiry branch bypasses both gates and deletes `cd.until` | yes for staleness, **no** for expiry appointments | audit | `[CONDITION_REMOVED:]`/`[COMPANION_CONDITION_REMOVED:]`/`[NO_CHANGE]` | long (282 frame + one line/condition) |
| 26 | buildHpZeroNudge | api.js:653 | player at exactly 0 HP for ≥ `HP_ZERO_NOTE_TURNS`=3 (counts through combat) | `hpZero={since,notedTurn}`; `HP_ZERO_NOTE_COOLDOWN`=5; healing deletes the record | yes (counter still accrues) | cooldown-reminder | `[HP:+N]`/`[REST:long]` | medium (~625) |
| 27 | buildReciprocityNudge | api.js:844 | player holds a `WEIGHTY_REL_RE` bond with a companion whose own sheet has no bond back | `reciprocityNudged[entity\|bond]` — **one-shot per pair, ever** | yes, without consuming | one-shot-ask | `[COMPANION_RELATIONSHIP_BOND:]` | medium (~409) |
| 28 | buildArcQuestNudge | api.js:871 | skeleton arc `completed` while a title-matching quest is still active/offered | `arcQuestNudged[arc\|quest]` — one-shot per pair, ever | yes, without consuming | one-shot-ask | `[QUEST:…\|completed]`/`[QUEST_STEP:]` | medium (~456) |
| 29 | buildArcStagingNudge | api.js:963 | active arc in an active act with **no** matching live or archived quest | `arcStaged[arcTitle]=turn`; `ARC_DRIFT_RECHECK`=50 | yes, without burning the window | cooldown-reminder | `[QUEST:…\|offered]` | medium (~663) |
| 30 | buildPrincipalStageNudge | api.js:704 | turn ≥ `PRINCIPAL_STAGE_TURNS`=25 and a premise principal / untouched seeded NPC is unstaged | `principalNudged[name]={n,t}`; `PRINCIPAL_NUDGE_COOLDOWN`=30, cap `PRINCIPAL_NUDGE_MAX`=2 then never again | yes | escalation (capped, silence = ruling) | `[NPC:name\|status\|relation]` | medium (~542) |
| 31 | buildArcDriftNudge | api.js:900 | active arc whose same-name quest already completed (or was abandoned/declined) and no live quest tracks it | `arcDriftNudged[key]={t,n}`; `ARC_DRIFT_RECHECK`=50; at n≥3 the note becomes a forced fork | yes, without resetting the timer | escalation | `[ARC_COMPLETE:]` or `[ARC_CONTINUE:]` | medium (506–657) |
| 32 | buildRelationshipAxisNudge | api.js:1029 | any entry in `relBondChanges`, `relAxisChoices`, or `relationshipAxisReviews()` past cooldown | per-entry `lastFire` / `relAxisReviewFired[key]`; `REL_NOTE_COOLDOWN`=3 (identity.js:398) | yes, without stamping | cooldown-reminder (queue-driven) | the exact `[RELATIONSHIP_BOND:]`/`[…_DYNAMIC:]`/`[…_PAIR_REMOVED:]` tag quoted | medium (~600–700) |
| 33 | buildRelationshipDowngradeNudge | api.js:995 | `relDowngrades` entry (weighty bond overwritten outside the axis adapter, game.js:1438) | per-entry `lastFired`/`fired`; `REL_DOWNGRADE_COOLDOWN`=3, `REL_DOWNGRADE_MAX`=3 → muted, `REL_DOWNGRADE_EXPIRE_TURNS`=60 → archived | yes (sweep still runs in combat) | escalation (mute + archive) | any rewrite of that pair's descriptor (game.js:1433) | medium (~502) |
| 34 | buildRelationshipAudit | api.js:1043 | `turn - lastRelAudit` ≥ `REL_AUDIT_TURNS`=40, **or** `relAuditDue` set by a party join/leave | `lastRelAudit=turn`, deletes `relAuditDue`; empty-window still consumes | yes, without consuming | audit | `[RELATIONSHIP_BOND:]`/`[…_DYNAMIC:]`/`[NO_CHANGE]` | long (632 frame + one line/bond) |
| 35 | buildDeathEvidenceNudge | api.js:1117 | `deathEvidencePing` armed (identity.js:1159) by a refused named death | consumes the ping; `deathEvidenceNudged[name].count` capped at `DEATH_EVIDENCE_NOTES`=2; also defers the sibling conflict for the same subject | yes, without consuming | fork-note (after an engine refusal) | `[SAY:]`/`[SCENE_CAST:]` + CANON_TXN, or `[NPC_DEATH_REPORTED:]` | long (~845) |
| 36 | buildIdentityConflictNudge | api.js:1154 | unresolved, non-stale `identityConflicts` entry with `lastFired` ≥3 turns old | per-entry `lastFired`, fixed 3-turn cadence; `attempts > IDENTITY_CONFLICT_STALE_ATTEMPTS`=5 → shelved stale (+ reward claim) | yes | escalation (shelve at cap) | `[SCENE_REVEAL:]`/`[SCENE_REF:]`/`[NPC_DEATH_REPORTED:]` + CANON_TXN | long (~750–870) |
| 37 | buildMergeConfirmNudge | api.js:1069 | `pendingMergeHints` entry whose pair is still unhealed (memory.js:125) | shifts the queue; `mergeHintNudged[pair]` = once per pair **ever**; arms `mergeConfirmArmed` for next turn | yes, without consuming | one-shot-ask | `[NPC_MERGE:]` (or silence — "will not repeat") | medium (~417) |
| 38 | buildProvisionalNudge | **identity.js:695** | any `memory.npcs[k].provisional` unresolved (oldest wins) | `provisionalNudged[key]=turn`; `PROVISIONAL_NUDGE_COOLDOWN`=5 | yes, without consuming | cooldown-reminder | `[NPC_MERGE:]` or `[MERGE:npc\|…]` | medium (~488) |
| 39 | buildDupItemNudge | api.js:1315 | `dupItemPending` armed at a stacking grant (api.js:2280) | consumes `dupItemPending`; pure one-shot | yes, without consuming | one-shot-ask | `[ITEM_LOST:]`/`[ITEM_RENAMED:]` or silence | medium (~472) |
| 40 | buildItemMisNudge | api.js:759 | `itemMisPing` armed by the attribution detector (game.js:1758) | consumes `itemMisPing`; 2-turn shelf | yes, without consuming | transient (2-turn shelf) | item transfer tags, or silence | medium (~476) |
| 41 | buildConsumableNudge | api.js:1325 | `consumableChecks` queue (game.js:1531) or a `consumablePending` record past cooldown | `consumablePending[].attempts` (cap 3) + `lastFired`; `CONSUMABLE_NUDGE_COOLDOWN`=6; `consumableNudged[key]` stamped | yes, without consuming | escalation (3 attempts) | `[ITEM_LOST:]` or `[ITEM_KEPT:]` (tag_table.js:324/1269) | medium (~615) |
| 42 | buildDeadStatusNudge | api.js:1343 | `deadStatusConflicts` queue non-empty (tag_table.js:471, refused status write on a dead NPC) | shifts one per turn; queue is the latch | yes, without consuming | fork-note (after a refusal) | `[NPC:…\|resurrected\|…]` or silence | medium (~430) |
| 43 | buildMpEndNote | api.js:1360 | `mpEnded` set (ui-sheets.js:551) and `playerCount() <= 1` | `mpEnded` cleared only by **compliance** (api.js:1393, a second-person response) — fires every turn until then | **no** | cooldown-reminder (compliance-boxed, N=1) | none — prose compliance clears it | medium (~454) |
| 44 | buildMoodAudit | api.js:1440 | any party mood ≥ `MOOD_AUDIT_TURNS`=12 old or empty, and `MOOD_AUDIT_COOLDOWN`=12 elapsed | `lastMoodAudit=turn`; empty roster still consumes the window | yes | audit | `[NPC:Name\|new mood\|]` / `[NO_CHANGE]` | long (580 frame + one line/member) |
| 45 | buildSayComplianceNudge | api.js:1463 | newest non-bookkeeping assistant response has dialogue with a missing `[SAY:]` (via `sayTagCoverage`) | **none** — reads `sessionLog` only; fires every turn until compliance | **no** | cooldown-reminder (self-silencing, N=1) | `[SAY:]` tags in the next response | medium (~580) |
| 46 | buildSceneCastNote | api.js:1134 | `castAsk` exists and either node changed or `CAST_REFRESH_TURNS`=12 elapsed; escalates if an ask went unanswered | `castAsk={node,askedTurn,complied,…}`; answered at identity.js:869-877 | yes, without consuming | one-shot-ask + one escalation | `[SCENE_CAST:Name,…]` or `[SCENE_CAST:none]` | medium (514 ask / 386 escalation) |
| 47 | buildPersonDriftNudge | api.js:1416 | `personDrift.count` ≥ `PERSON_DRIFT_MIN`=2 (api.js:1400) and `playerCount()<=1` and `mpEnded` unset | `personDrift` cleared by compliance (api.js:1391); `PERSON_DRIFT_GAP`=3 breaks a run | **no** | cooldown-reminder (compliance-boxed, N=1) | none — a second-person response clears it | medium (~463) |
| 48 | buildCanonContradictionNudge | api.js:1102 | `canonContradiction` armed (memory.js:1634 — roster-dead NPC with survival knowledge) | consumes the ping; stamps `canonContraNudged[name]=turn`, read by the armer with `CANON_CONTRA_COOLDOWN`=25 | yes | one-shot-ask (per NPC per 25 turns) | `[NPC_SUPERSEDE:]` or `[NPC:…\|resurrected\|…]` | medium (~631) |
| 49 | buildRecurringNameNudge | api.js:1092 | `recurringNamePing` armed (memory.js:1620 — unregistered name in ≥ `RECURRING_NAME_MIN_TURNS`=3 turns, mid-sentence) | consumes the ping; `recurringNameNudged[name]={count,turn}`, armer gates on `RECURRING_NAME_COOLDOWN`=30 and `RECURRING_NAME_MAX_NUDGES`=2 | yes | escalation (capped, silence = ruling) | `[NPC:name\|status\|relation]` or silence | medium (~482) |
| 50 | buildPlotArmorNote | api.js | `worldState.plotArmorPing` armed by `plotArmorRefuse` (any refused death of a load-bearing NPC — #319) | one-shot; cleared when built | **no** (a refused death mid-fight still needs its exit) | one-shot-ask | none | ~560 |
| 51 | buildHoursNote | api.js | at a sub-location of a SIZED settlement with neither `hours` nor `hoursNone` on record (#207 ③) | `hoursAsk={node,turn}` — once per node; `[LOCATION_HOURS:none]` closes it | yes | one-shot-ask | `[LOCATION_HOURS:]` | ~480 |

---

## MERGE CANDIDATES

### A. The four location pings — partial merge only

The review's grouping mixes three different mechanics.

- **Genuinely mergeable:** `buildLocationFilingNudge` (api.js:1224) and `buildLocationTwinNudge` (api.js:1240). Both are the same six-line frame: combat gate → read field → consume → return string. Shared: combat gate, one-shot semantics, no cooldown constant, the "leave state unchanged" close.
- **`buildLocationDescNudge` (api.js:523) does not fit.** Its trigger is a *state predicate* (node exists, `description` null, past `firstVisit`) rather than an armed ping, and it carries a real cooldown map (`locDescNudged` + `LOC_DESC_NUDGE_COOLDOWN`=10). It is a cooldown-reminder, not a one-shot-ask.
- **`buildLocationStateNudge` (api.js:213) does not fit either.** It is the only builder in the family whose latch is consumed **at commit** (game.js:1701) rather than at build, plus it has a departure-clears branch and a hold-through-combat branch.

**Stronger finding the review missed:** api.js:1216–1244 already contains a *six*-member family written to an identical template — `buildPhaseMismatchNudge`, `buildLocationFilingNudge`, `buildTravelPriceNudge`, `buildCommitmentNudge`, `buildFutureResolveNudge`, `buildLocationTwinNudge`. Shared: combat gate without consuming, pure one-shot, no cooldown constant, no escalation, ack is a single named tag. Differs only in: source field, scalar-vs-queue read, and text. They are **contiguous in NOTE_BUILDERS (positions 15–20)**, so a single table-driven builder emitting them in the same internal order is **behaviour-preserving for ordering**. Text preservation requires the table to carry six literal bodies (`buildPhaseMismatchNudge` also has a moot-check on `clockPhaseBandDist`, and `buildFutureResolveNudge`/`buildLocationTwinNudge` shift queues rather than delete scalars) — so the merge saves the frame, not the payload.

### B. The three quest nudges — merge preserves order, not mechanics

`buildQuestEscalation` (421), `buildQuestObjectiveNudge` (440), `buildQuestStaleNudge` (497) are registry positions 5, 6, 7 — contiguous.

- **Shared:** identical select-the-stalest-active-quest loop, identical combat gate, "one note per turn" rule, same `[QUEST:]`/`[QUEST_STEP:]` ack vocabulary.
- **Differs:** the *stamp* read (`allDoneSince` / `noObjSince` / `lastTouch`); the constants (3 / 3 / 30); and crucially the **latch model** — Escalation and Objective have *no* latch and re-fire every turn, while Stale writes a per-quest `staleNudged` cooldown. A parameter table would have to carry "latch: none | per-row" as a column, which is where it stops being a table.
- **Verdict:** because all three are contiguous, a merged builder that returns all applicable notes joined in the internal order 5→6→7 is ordering-preserving. Text is preserved only if three distinct frames are kept verbatim. Net saving is one loop, not one note.

### C. The two split audits — merge would change ordering and latch granularity

`buildSplitAudit` (551) and `buildPresenceAudit` (606).

- **Shared:** combat-silent *without consuming*, party scan, `[PARTY_SPLIT:]` ack, "engine detects / GM decides / the record must not command the story" frame, list-of-members text shape.
- **Differs:** SplitAudit's latch is **per-member and nested** (`charSheet.splitLoc.audited`, `SPLIT_AUDIT_TURNS`=10) with a same-world age waiver; PresenceAudit's is a **single global scalar** (`lastPresenceAudit`, `PRESENCE_AUDIT_TURNS`=12). They also cover disjoint sets (split members vs with-party members) — deliberately, per the api.js:600 comment.
- **Verdict:** **not behaviour-preserving.** They are registry positions 8 and 10 with `buildReunionNote` at 9 between them, so merging reorders. And unifying the latch to either granularity changes which members are audited on which turn.

### D. The relationship trio — not a merge; at most a shared queue driver

`buildRelationshipAxisNudge` (1029), `buildRelationshipDowngradeNudge` (995), `buildRelationshipAudit` (1043) — registry positions 32, 33, 34 (contiguous).

- **Shared:** combat-silent without stamping; all read `relationshipRows`; all teach the same BOND-vs-DYNAMIC distinction.
- **Differs fundamentally in shape:** Axis is a **queue-driven cooldown reminder** over three separate sources (`relBondChanges` / `relAxisChoices` / `relationshipAxisReviews()`) at `REL_NOTE_COOLDOWN`=3. Downgrade is an **escalation with mute-and-archive** (3 / 3 / 60 plus a `memArchive()` side effect that runs even in combat). Audit is a **periodic timer audit** (40 turns, plus event-pull via `relAuditDue`).
- **Verdict:** three of the six shapes in one group. The only honest factoring is a shared *helper* for "pick the first queue entry past cooldown and stamp `lastFire`" used by Axis and Downgrade. Merging the builders would change text and note count.

### E. The item trio — two of three merge cleanly

`buildDupItemNudge` (1315), `buildItemMisNudge` (759), `buildConsumableNudge` (1325) — registry positions 39, 40, 41 (contiguous).

- **Shared across all three:** combat-silent **without consuming** (the explicit "spends happen in combat" doctrine), one item per turn, the same "check your own narration / the engine never writes inventory unattended" frame, ack in the `ITEM_LOST` family.
- **DupItem + ItemMis:** near-identical. Both consume a scalar ping and emit once. The only mechanical difference is ItemMis's 2-turn shelf. Merge is behaviour-preserving if the shelf is kept as a per-row parameter.
- **Consumable does not fit:** it is an **escalation** with a persistent `consumablePending` array, `attempts<3`, `CONSUMABLE_NUDGE_COOLDOWN`=6, a bounded 6-entry ring, and a distinct **confirmed-negative ack** (`[ITEM_KEPT:]`) that no sibling has.
- **Also in this domain and unnamed by the review:** `buildUndefinedItemNudge` (1302), a one-shot with a per-item forever latch (`itemDefAsked`, cap 60) — it shares the frame with DupItem but sits at registry position 4, far from the trio, so folding it in reorders.

### F. Unnamed but the strongest merge in the file — the 2-turn-shelf pings

`buildReconcileSkipNudge` (741), `buildStayBehindNudge` (751), `buildItemMisNudge` (759), `buildPlayerSplitNudge` (770) are four consecutive functions at api.js:741–782 with a byte-identical body shape: `if(!p) return ""; if(turn - p.turn > 2){ clear; return ""; } clear; return "…"`. `buildReunionNote` (589) is the same with a 3-turn shelf. Shared: shelf mechanic, consume-on-fire, no cooldown constant. Differs: combat gate (only ItemMis and Reunion have one), shelf length, text. **These are not contiguous in the registry** (positions 14, 11, 40, 12, 9), so a merge changes note ordering unless the merged builder is registered five times with a parameter.

---

## DEAD BUILDERS AND UNDECLARED LATCHES

### Registered but effectively never fires

1. **`buildRelationshipDowngradeNudge` (api.js:995) — legacy-save-only.** Its sole armer is game.js:1438, gated on `!_explicit && WEIGHTY(prev) && !WEIGHTY(next)`. Since #168 W7, every sanctioned bond write goes through the axis adapter: an ambiguous/legacy write is queued to `relAxisChoices` leaving canon **unchanged** (identity.js:417-425), and a confirmed explicit BOND change stamps `relBondReceipts` (identity.js:516), which sets `_explicit=true`. So the arming condition now requires a bond rewrite that bypasses the adapter entirely (pre-W7 saves, sheet-editor edits, merge paths). The note's own text — "before relationship axes existed" — concedes this. Live as a backstop; dead on a new campaign.
2. **`buildRelationshipAxisNudge`'s third limb** (api.js:1034, the `relationshipAxisReviews()` loop) fires only on rows carrying `axisReview`, set by `relationshipMigrateSheet` — migration-only. The other two limbs are live; this one is legacy-save-only.
3. **`buildIdentityConflictNudge`'s overflow limb** (api.js:1160-1164): its own comment says the #175 stale cap makes it "near-unreachable". Code is live, output is a console warning + toast, never a note.
4. **`buildMpEndNote` (api.js:1360)** is not dead but is reachable only through one UI path — ui-sheets.js:551, demoting the last extra hot-seat PC. A campaign that never used multiplayer never arms it.

### Latch fields NOT in NOTE_LATCH_FIELDS (api.js:1513)

**No latch at all** (nothing to burn on a dead provider turn — correct by construction, but they re-fire every turn while the condition holds):
`buildQuestEscalation` (421), `buildQuestObjectiveNudge` (440), `buildScheduleEscalation` (784), `buildSayComplianceNudge` (1463).

**Nested, covered by the narrow snapshots** (documented at api.js:1509-1512):
- `buildQuestStaleNudge` → `questLog[].staleNudged` — snapshotted at api.js:1522/1544, pinned by dev/run-tests.js:458-461.
- `buildSplitAudit` → `charSheet.splitLoc.audited` — snapshotted via `snap.split`.

**Ruled exemptions in dev/latch-census.js:12-15** (undeclared by design, with verbatim rationales pinned at dev/run-tests.js:443-450):
- `buildIdentityConflictNudge` → `worldState.pendingRewardClaims` via `rewardClaimQueue` (helpers.js:1078).
- `buildScheduleEscalation` → `worldState.clock` via `scheduleDue` → `clockEnsure`.

**Genuinely uncovered — worth a look:**
- **`buildConditionAudit` (api.js:838-841)** deletes `cd.until` on `worldState.character.conditions` and every companion's conditions when it consumes an expiry appointment. That is a **nested, non-top-level write** — not in the flat registry, not in `snap.split`, not in `snap.quests`, and the census "scans TOP-LEVEL writes only" (dev/run-tests.js:455). A provider call that dies after `buildEngineNotes` therefore permanently consumes the expiry appointments while the audit note is never delivered — exactly the failure class #151 exists to close.
- **`buildExpiredThreadNudge` (api.js:197)** latches on `memory.futureEvents[]._asked`, outside `worldState` entirely. This one is *declared* deliberate in the header (api.js:193-196: "No latch state to snapshot; a transport loss costs only the courtesy ask") — flagged for completeness, not as a defect.

### Inverse gap

`retconPin` is declared in NOTE_LATCH_FIELDS (api.js:1513) but **no NOTE_BUILDERS entry reads or writes it** — its only consumer is `buildRetconPinBlock` (api.js:227), which is a system-prompt block, not a registered builder. The declaration is harmless (over-restoration) but it is the one entry in the registry with no builder behind it.
