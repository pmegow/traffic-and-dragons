# Lane A report: api.js (HEAD d7ed4ea6)

## 1. Coverage

- **Contracts:** DOC/contracts/prompt.md and DOC/contracts/tags.md, both read in full.
- **api.js (4,076 lines, 436 KB).** The file was NOT read whole. I read these ranges in full:
  - 1–381: buildGeoBlock, buildChangedLocationsBlock, getRulesBlock, condInjectFmt, the expired-thread, location-state and retcon nudges, buildDeepTimeBlock, buildErasBlock, buildCoreMemoryBlock, saveRules/loadRules.
  - 686–810: _agendaAnchor, buildAgendaOfferNote, buildRecordPeopleBlock, buildPartyHistoriesBlock.
  - 946–954: CHECK_NO_NARRATION, diceStakeText, diceFloorText.
  - 2282–2512: snapshotNoteLatches, restoreNoteLatches, NOTE_BUILDERS, NOTE_SHAPES, the notes ring, buildEngineNotes, the form helpers.
  - 2513–2911: buildSysPrompt, every line.
  - 3160–4076: stripCodeFences/repairModelJson, cleanTxt, diceRollHtml, diceRevealCardHtml, diceTxt, parseActions, findCompanionNpc, attire, rewardAwardTargets, duplicateItemGrantWarning, _stampItemKept, _w2StageEffects, _w2CopyWorldStateDetached, applyMuts, __mpBareTagScan, the refusal detector, usageCost, recordUsage, _checkStablePurity, the credit/HTTP error shaping, gmViaServer, gmTransport, the fal seams, gmServerRefusalMessage, _fetchTextDeadline, callGM, the portrait vision route, describePortraitImage.
- **Not read: lines 382–685, 811–945 and 955–2281.** That is about 1,800 lines of quest-block and engine-note builders (the per-note nudges). For that region I only grepped for `new RegExp(` built from model or player text (two sites at 695–696, both escaped or [a-z]-only) and for HTML sinks (none). The lens did not point there.
- **Tags outside the lane:** I read the tag_table.js parts that decide strip-versus-parse parity: buildCtTags, buildCtBare, tagRestoreBareMarkers, the applyMutsTable handler loop and its post-handler seam, __tagUnknownScan, and the handler regexes that carry `/i`.

## 2. Findings

### F1. An unclosed tag inside a review call (Define / Suggest-completion) carries a forbidden tag past the #264 whitelist, and the party is teleported. (medium)

- **Where:** api.js `applyMuts`, line 3481. The whitelist strip is `/\[([A-Z][A-Z_]{1,})(?::[^\]]*)?\]/g`. Its body `[^\]]*` runs across a `[`.
- **Failing input:** a review-call reply with an allowed tag left unclosed (for example `[QUEST:Find the cat|completed`) followed by a forbidden tag.
- **What goes wrong:**
  - The regex reads the unclosed allowed tag and the forbidden tag as ONE match named QUEST, and keeps all of it.
  - The table's LOCATION handler then parses the inner `[LOCATION:Magnimar]` and moves the party.
  - #264 exists to stop exactly this ("a hallucinated [LOCATION:] teleported the party").
- **Callers:** game.js:4564 and game.js:4593 pass model output with `allow:REVIEW_CALL_TAGS`.
- **Status: REPRODUCED.** Script: `audits/audit-2026-11-19-evidence/A\p4-whitelist-nest.js`. Output:
  ```
  location before: Ashfen
  location after whitelisted review call: Magnimar
  muts: ["-> Magnimar","⚠ Quest 'Find the cat': unknown status 'completed the cat purrs. [location:magnimar' not applied — ..."]
  control (closed tag) location: Magnimar ["⚠ review-call whitelist: out-of-scope tags stripped — LOCATION"]
  ```
  The control shows a closed `[LOCATION:Korvosa]` correctly refused.
- **Refutation tried:** no upstream sanitiser. W2 preparation runs after the whitelist.
- **Remedy:** match the body as `[^\]\[]*`, so a tag span never contains `[`. Better: strip every tag OCCURRENCE by scanning `\[([A-Z][A-Z_]+)[:\]]` openers, not whole spans.

### F2. Tag names the parser reads case-insensitively ([REST:], [ALIGNMENT:], [COMPANION_ALIGNMENT:]) are applied when written lowercase, but they slip past the review whitelist, stay visible in the story and are missing from the provenance ring. (medium)

- **Where:**
  - tag_table.js handlers use `/\[REST:\s*long\b[^\]]*\]/i` (690, 1549), `/\[REST:\s*short…/i` (1550), `/\[ALIGNMENT:(law|good)([+-]\d+)\]/gi` (1430) and COMPANION_ALIGNMENT `/gi` (1925).
  - Every api.js net is upper-case only: the whitelist (3481), `_CT_TAGS` from buildCtTags (`"g"`, no `i`), the cleanTxt catch-alls at 3212 and 3216 (`\[[A-Z]…`), the provenance-ring scan at 3558, and __tagUnknownScan.
- **Failing input:** `[rest:long]` or `[alignment:good+2]`, in a review call or any GM turn.
- **What goes wrong:**
  - The whitelisted review call performed a full long rest: healed to full, clock +480 min.
  - It also shifted alignment.
  - cleanTxt leaves both tags in the displayed and spoken prose.
  - The tagLog entry does not name them.
- **Status: REPRODUCED.** Script: `audits/audit-2026-11-19-evidence/A\p1-case.js`. Output:
  ```
  TOAST: Rested eight hours — Day 1, 08h 00m elapsed. Healed, mana restored.
  hp after whitelisted review call: 20 / 20
  muts: ["Align: Neutral Good","Item canon proposed: Rope (awaiting your confirmation)","Rest: healed to full, spell slots restored; slept eight hours (+480m, ...)"]
  cleanTxt: "You sleep. [rest:long] You wake. [Alignment:Good+1] [hp:-3]"
  ```
  Starting HP was 1/20.
- **Remedy:** make the strip, whitelist and scan regexes case-insensitive on the NAME (`[A-Za-z][A-Za-z_]+`). Or drop the `i` on the tag-name half of those handler regexes. Pick one rule and pin it.

### F3. An unclosed tag silently eats all the prose up to the next tag's `]`, possibly paragraphs, from the display and the narrator, while every tag still applies. (medium)

- **Where:** tag_table.js `buildCtTags` (line 97) produces `\[(NAMES):[^\]]*\]`, which api.js `cleanTxt` applies at line 3209. The body crosses newlines and `[`.
- **Failing input:** `"The blade bites your arm. [HP:-3\n\nThe goblin flees into the dark, dropping its purse. You count the coins by torchlight.\n\n[GOLD:+5]"`
- **What goes wrong:**
  - The player sees only `"The blade bites your arm."`.
  - Both tags apply (HP 10 to 7, coin +5 gp).
  - The `_CT_TAGS` pass emits no warning, so nothing says that prose was dropped.
- **Status: REPRODUCED.** Script: `audits/audit-2026-11-19-evidence/A\p3-unclosed.js`. Output:
  ```
  cleanTxt: "The blade bites your arm."
  hp 7 coin before 2500 after 3000
  muts ["Took 3 damage","+5 gp"]
  ```
- **Scope:** display and TTS only. The transcript keeps the raw text, so this is not data loss, but the player loses narration silently.
- **Remedy:** body `[^\]\[]*` in buildCtTags and in the cleanTxt catch-all. Then a loud end-of-line fragment strip for an opener with no close. The frozen strip hash would need a deliberate re-baseline.

### F4. A handler that throws in the ordinary tag stream leaves its partial write in live state, and applyMuts tells nobody but the console. (medium-low, silent failure)

- **Where:**
  - tag_table.js `applyMutsTable` (2149–2160) catches each handler and pushes the message to `R.errors`.
  - api.js `applyMuts` uses `R.errors` only for envelope bodies (3524–3527). For the ordinary stream (3499) it never moves `R.errors` into `R.muts`, never toasts, and never writes it to the tagLog ring.
  - The only reader of `.errors` in game.js or ui-*.js is the audio gate (game.js:2798).
- **Failing input:** any handler bug that throws after its first write. Simulated by wrapping the GOLD handler to throw after it applies.
- **Status: REPRODUCED.** Script: `audits/audit-2026-11-19-evidence/A\p5-handler-throw.js`. Output:
  ```
  R.errors: ["GOLD: simulated handler bug after write"]
  muts shown to player: ["Took 2 damage","+5 gp"]
  any muts line with the warning glyph: false
  toasts: []
  tagLog last entry: {"t":5,"tags":["GOLD","HP"],"m":["Took 2 damage","+5 gp"]}
  ```
- **Expected:** a `⚠ <TAG> handler failed: …` mutation line plus a tagLog `errors` field. Project policy is "failures loud, visible, attributable".
- **Remedy:** in applyMuts after line 3499, `R.errors.forEach(e => R.muts.push("⚠ tag handler failed — "+e))`, and record `errors` in `_tlEntry`. The partial write itself is the deliberate per-handler isolation; only the silence is the defect.

### F5. The geography block's "Elsewhere" lines list every living NPC ever sighted, on every turn, with no cap. The roster rule folds those same NPCs everywhere else. (medium-low, monotonic resource)

- **Where:** api.js `buildGeoBlock`, lines 123–137. It loops over every key of `memory.npcs` and filters only dead, present-party and here.
- **What goes wrong:**
  - buildSysPrompt's NPCs line folds long-unseen NPCs into "+N others on record" (the audit B2 roster rule).
  - The same NPCs return one geo line each ("Elsewhere, by sighting / by old word only").
- **Failing input:** a campaign with 300 living NPCs last seen elsewhere, long ago (turn 2000; sightings at t1–t300).
- **Status: REPRODUCED.** Script: `audits/audit-2026-11-19-evidence/A\p2-geo-age.js`. Output:
  ```
  geo block chars, 0 NPCs elsewhere: 428   300 long-unseen NPCs elsewhere: 17442
  NPCs roster line folds them: true
  Elsewhere line names Villager Number5 (seen t6, 1994 turns ago): true
  ```
  That is about 4.3k uncached volatile tokens per turn, growing with campaign age.
- **Remedy:** apply `_rosterKeep` (or the same recency/here predicate) to the Elsewhere lists, with a "+N more on record" count.

### F6. Contract drift: the LEGACY CHARACTER block puts the character's age into the gameplay prompt. The owner ruling says age goes into ZERO gameplay prompts. (low)

- **Where:** api.js `buildSysPrompt`, line 2733: `+_lc.cls+" (Level "+_lc.level+")"+(_lc.age?", "+_lc.age:"")+".\n"`.
- **The ruling:** prompt.md ("Age is cosmetic-only … injected into ZERO gameplay prompts") and TODO.md:93. The code comment at 2621–2625 restates it for the identity header and party sheets.
- **Status: REPRODUCED.** Script: `p2-geo-age.js`, tail. Output: `"A figure from another story walks this world: Daeris, (female, pronouns she/her) a Human Cleric (Level 9), 67 years.\n…"`.
- **Remedy:** drop the `_lc.age` clause, or amend the ruling to name this block as an exception.

### F7. When the public-map path withholds a reply's tags, no provenance-ring entry is written for that turn. (low)

- **Where:** api.js `applyMuts`, lines 3491–3495. When `atlasKnowledgeMovementProblem` returns a reason, applyMuts returns before the tagLog write at 3557–3574.
- **Why it matters:** `tagLogRefusal` exists for the #197 path precisely because "absence must never be ambiguous". This withheld path has no equivalent, so a forensic read of tagLog cannot tell a withheld turn from a turn that emitted nothing.
- **Scope:** only when `atlas.knowledge === 1` is on. The mutation line and console warn do fire.
- **Status: READ.** Not run: it needs an atlas-knowledge fixture.
- **Remedy:** push `{t, tags, m:[the withheld line], withheld:1}` to tagLog before returning.

### F8. The legacy `[ACTIONS:]` replay is greedy to the last `]` on its line, so a tag after it becomes part of the third button. (low)

- **Where:** api.js `parseActions`, line 3262: `raw.match(/\[ACTIONS:(.+)\]/i)`.
- **Failing input:** `[ACTIONS:Run|Hide|Fight] [HP:-2]` on one line. The third option becomes `Fight] [HP:-2` (escaped, so it is cosmetic).
- **Scope:** pre-v1.110 saves only.
- **Status: READ.** Established by the regex semantics; no probe run.
- **Remedy:** `/\[ACTIONS:([^\]]+)\]/i`. The comment says greedy is deliberate, so that brackets inside an action survive; that is a trade-off, so this stays low.

## 3. Monotonic resources

| Thing | Scope | Bound | Enforced in code? |
|---|---|---|---|
| `worldState.tagLog` (provenance ring) | per campaign | TAG_LOG_CAP = 40; per entry m ≤ 11, stripped ≤ 10, refused ≤ 7 | yes (3573, 3652) |
| `worldState.healthLog` | per campaign | HEALTH_LOG_CAP = 40 | yes (3694) |
| `worldState.noteLog` | per campaign | NOTE_LOG_CAP = 40 | yes (2453) |
| `worldState.usage` totals and `byKind` | per campaign | kinds are a fixed caller vocabulary | yes, by vocabulary |
| `_unpricedWarned` | per session | one key per distinct model id | effectively yes |
| `_sheetlessWarned` | per response | reset at the top of applyMutsTable | yes |
| `_lastTurnSys`, `_stableHash`, `__lastRagBlock`, `__lastChapRagBlock`, `_notesBuilt` | per session | single slot | yes |
| `worldState.consumableKept` | per campaign | keys pruned to live inventory (game.js:2463) | yes |
| `worldState.dupItemPending`, `agendaOfferAsk` and other latches | per campaign | single record | yes |
| snapshotNoteLatches clone (JSON of every NOTE_LATCH_FIELDS entry) | per builder, per turn | about 80 builders × all latch fields, transient | transient (CPU, not memory) |
| `memory.eras` (prompt) | per campaign | ERAS_BUDGET_CHARS = 4000, merge on overflow | yes. Note: `sourceChapterTurns` grows by union, but it is not in the prompt. |
| CHANGED LOCATIONS block | per turn | CHANGED_LOC_MAX with an overflow line | yes |
| Guestbook attendance line | per turn | GB_PROJ_MAX with an overflow line | yes |
| DECEASED line | per turn | 10 plus a count | yes |
| **Geo "Elsewhere, by sighting / by old word" lines** | **per turn, growing per campaign** | **none: every living NPC ever sighted** | **NO (F5)** |
| **Geo "Items previously here (now gone)" line** (buildGeoBlock line 57) | per turn, growing per node | every distinct item name ever placed at that node | NO. node.items has no cap in fileLocationItem (memory.js). Low impact. |
| ACTIVE NPC DETAILS (hotNpcs) | per turn | every memory.npcs name found by raw `indexOf` in the last 6 messages | bounded by the window, but the match is case-sensitive substring ("Ash" hits "Ashes"), so false hits add detail blocks. Not quantified. |
| `_w2CopyWorldStateDetached` clone | per envelope | transient | yes (discarded or swapped) |

## 4. Affirmed (tried to break, could not)

1. **diceTxt, diceRollHtml, diceRevealCardHtml markup injection.** Every model field reaches the HTML through `escHtml` (which escapes `& < > " '`). The bold face is digits only by regex. In the pending-check branch, mod, DC and damage are rebuilt from parsed integers (`parseCheckTag` uses parseInt and `parseDamageExpr`), never model text.
2. **parseActions button attribute.** The `data-action` and button text both go through `escHtml(punctuateAction(...))`, so a quote cannot break out of the attribute.
3. **callGM retry and fallback.** The payload is serialized once and the retry is byte-identical. `noRetry` disables both the retry and the fallback rung. Credit exhaustion is checked before retry on a 429. The gateway `retryable:false` is honoured. An AbortError message is not auth-shaped. Usage is recorded to the world captured before the await (`_usageWorld`, 3903/4009), so a campaign switch mid-call does not write into the new world.
4. **API key and token exposure in callGM, gmTransport and describePortraitImage.** Keys ride headers only. The gateway URL carries only provider id and `encodeURIComponent(model)`. Error strings carry the provider's message and status, never headers. The erCrumb payloads carry provider, status, count and kind only. No `?key=` exists anywhere in the engine files (grep).
5. **The stable half.** I read every term of the `stable` expression (2828–2848) and each builder it calls: getRulesBlock, the kind preamble, tone, narrativeDesign, bestiary (act-gated), MECHANICS with diceStakeText/diceFloorText (settings only), buildSkillMechanicsDoc, buildStateTagsDoc (settings plus kind), naming, deepTime (write-once), party histories, record people. None reads turn, clock, HP, location or sessionLog. `voiceLines` in personaPromptBits are written only at export (`personaCapture`, helpers.js:2444), not per turn. STYLE is last in the volatile half, and the MAP block follows buildGeoBlock directly (2877–2878), as the contract says.
6. **W2 envelope rollback.** On a staged failure, a receipt failure or a transcript-tripwire hit, `worldState` and `memory` are restored to the pre-envelope objects (3525, 3531). Staged UI effects replay only after commit (3537). The shared transcript is truncated back on an append (3520). I found no live-state write from an envelope body that survives rollback, except module-level counters and console output (by design).
7. **`_agendaAnchor` RegExp construction from a companion name or want text.** The name halves are escaped. The want words are `[a-z]+` only, so no regex injection can throw and brick the note build.
8. **usageCost model-prefix matching.** The MODEL_PRICING keys contain no key that is a prefix of another, so first-match iteration order cannot misprice.

## 5. Undetermined

- **A builder that throws bricks every turn.** `buildEngineNotes` has no per-builder try/catch. A builder that throws on a malformed latch fails the whole turn (sendAction's catch, game.js:2957 onward), and the bad latch persists, so every later turn fails the same way. That is loud, but nothing isolates it or can recover. I did not find a concrete malformed latch that throws.
- **`lastTurnSys()` campaign scoping.** It compares `campId||null`. Two campaigns that both lack a campId (fresh, unsaved, legacy) would share the captured system prompt for the suggestion call. I did not establish whether any reachable flow has two null-campId worlds in one session.
- **cleanTxt's dash normaliser.** `_CT_DASH` turns every en or em dash into ", ", including numeric ranges ("1914–1918" becomes "1914, 1918"). That follows from the STYLE rule against dashes, so it may be deliberate. It is listed here, not in findings, because it is plausibly intended.
- **The unread note-builder region (382–685, 811–945, 955–2281)** was not reviewed for latch-restore completeness. The #309 census tests claim to cover it.

## Addendum — ranges 382–2281

### Coverage
- **Now read in full:** api.js lines 382–685, 811–945 and 955–2281. With the main report, the whole of api.js has been read.
- **The region holds:** the quest block and lifecycle nudges, playerRollsBound, the combat, whispers, money, market, hours, keeper, soundscape and layout notes, the denouement builders, the montage, wrap-up, reckless, register, check, suggest-miss, downed, respawn and death notes, the split, presence, deity, HP-zero, principal, reconcile, stay-behind and item-misattribution notes, schedule, lasting ability, condition audit, reciprocity, the arc quest/drift/staging notes, the relationship notes, merge, motif, recurring-name, canon-contradiction, death-evidence, cast and identity-conflict notes, the oneShotPing and shelfPing notes, item definitions, dup item, consumables, dead status, the multiplayer-end and person-drift notes, mood, SAY compliance, elsewhere speech, the arc wall, and NOTE_LATCH_FIELDS.
- **Lens (e), turn-volatile state in the stable half:** none in this region. Its only prompt blocks are volatile: the quest block, buildWhispersBlock, buildDeathSceneBlock, the denouement prompt (its own call) and the initiative line.

### Findings

**A1. A failed turn can pay a withheld reward twice (medium).**
- **Mechanism:**
  - `buildIdentityConflictNudge` (1794–1813) shelves a stale conflict while the notes are being built. It queues the withheld reward as a claim (`rewardClaimQueue`, which writes `pendingRewardClaims`), empties `c.withheld`, and opens the claim modal. All of this happens before the GM request is sent.
  - If the request then fails before commit, `restoreNoteLatches` restores `identityConflicts` (the conflict is no longer stale, and `withheld` holds the tokens again). `pendingRewardClaims` is deliberately NOT a restored latch (run-tests.js:617, the f31 exemption).
  - The exemption's rationale is "subject+tokens dedupe prevents a duplicate claim". That holds only while the first claim is still queued. If the player accepts the modal during the wait (it appears exactly then), the claim is spent, so the next turn's re-shelve queues a fresh one, and accepting it pays again.
- **REPRODUCED.** Script: `audits/audit-2026-11-19-evidence/A\p7-claim-restore.js`. It runs the sendAction sequence by hand: snapshot, build notes, accept, restore, build notes again. Output:
  ```
  claims queued after shelve: 1 [ '[XP:50]' ]
  xp after first accept: 50
  conflict after restore: stale= undefined withheld= ["[XP:50]"]
  claims queued on the next turn: 1
  total xp paid for the one withheld reward: 100
  ```
- **Not run:** the browser timing. I did not check that the claim modal's Accept stays clickable while `busy` is set.
- **Remedy:** either make the shelve wait until commit (stage it, as `pendingLocState` is consumed at commit), or record the claim ids that have been paid on the conflict and have rewardClaimQueue refuse a claim whose tokens were already paid for that subject.

**A2. One null entry in a sheet's conditions list makes every gameplay turn fail; the load does not repair it (medium-low; the failure is reproduced, how a null gets there is not).**
- **Where:**
  - `condInjectFmt` (239–246) reads `x.duration` with no guard. It is called from buildSysPrompt at 2639 and 2689.
  - `buildConditionAudit` (1405–1427) reads `cd.turn` and `list[j].until` with no guard.
  - The load (`migrateWorldState`, then admission's `ensureV10Arrays`) heals only a missing array, never a bad entry in it.
- **REPRODUCED.** Script: `audits/audit-2026-11-19-evidence/A\p6-null-condition.js`. Output:
  ```
  after load, conditions = [{"name":"Poisoned","turn":1},null]
  buildSysPrompt THROWS: Cannot read properties of null (reading 'duration')
  buildEngineNotes THROWS: Cannot read properties of null (reading 'turn')
  ```
  A string entry does not throw; it renders as "undefined".
- **Effect:** sendAction's catch turns each turn into a GM error, and Retry fails the same way. The state persists, so the campaign cannot be played until the sheet is edited by hand.
- **Reachability: SUSPECTED.** No engine writer I read pushes null. Plausible ways in: a hand-edited .tnd or .char file, the character editor, or a server or cloud copy.
- **Remedy:** filter non-object condition entries at the admission door, loudly, and guard `condInjectFmt` and `buildConditionAudit`.
- **This settles the main report's first Undetermined item.** A concrete value that bricks every turn exists: `conditions: [null]` on the hero, or on any living companion with a sheet. The same unguarded pattern appears at `buildConsumableNudge` (`c.key` on a shifted queue entry), `buildMergeConfirmNudge` (`c.canonical`) and `buildDeadStatusNudge` (`d.name`), but those queues are engine-written only.

**A3. When a conflict is shelved inside the notes build, its toast and claim modal fire again after a failed turn. (low; READ)**
- **What happens:** the same mechanism as A1. Before the request, `buildIdentityConflictNudge` calls `showToast` and `showRewardClaimModal` (1810–1813). These are not staged. A failed turn restores the conflict, so the next turn repeats both, even when no double pay results (the claim was declined, or the dedupe hit).
- **Remedy:** the same as A1 (move the shelve to commit).

### Monotonic resources (additions)

| Thing | Scope | Bound | Enforced? |
|---|---|---|---|
| Once-ever latch dicts: consumableNudged, recurringNameNudged, locDescNudged, canonContraNudged, deathEvidenceNudged, mergeHintNudged, reciprocityNudged, arcQuestNudged, arcStaged, arcDriftNudged, arcWallWarned, principalNudged, motifNudged, deityDriftNudged | per campaign | one key per distinct item, name, pair or arc ever seen | NO cap or pruning. Most must persist for their once-ever semantics. consumableNudged is not pruned, although its sibling consumableKept is (game.js:2463). Growth is slow. |
| snapshotNoteLatches() (2282) | per builder, per turn | JSON-stringifies about 100 latch fields once per NOTE_BUILDERS entry (about 95) on every turn | Cost grows with the dicts above (O(builders × latch bytes)). Not measured. |
| itemDefAsked | per campaign | ITEM_DEF_ASKED_CAP 60, oldest evicted | yes |
| itemDefQueue | per campaign | ITEM_DEF_QUEUE_CAP 8, overflow announced | yes |
| consumablePending | per campaign | 6 (shift at line 2078) | yes |
| keeperAsk.nodes | per campaign | the shops the map retains | yes |
| registerSlips | per campaign | REGISTER_LOG_MAX | yes |
| buildDenouementPrompt input | once per campaign | every chapter, every archived quest and every defining moment, uncapped | NO (a single end-of-campaign call; low) |
| buildWhispersNote and buildWhispersBlock | per turn | slices of the last 3 to 5 | yes |

### Affirmed (addendum)
- **Rerolls and failed turns:** every builder in the region writes only keys in NOTE_LATCH_FIELDS or NOTE_NESTED_LATCHES. The one undeclared write is pendingRewardClaims (exempt; see A1).
- **No note that re-fires forever:** I checked every cooldown and one-shot builder for one that fires but never stamps its latch, and found none. Every return-with-text path stamps or consumes first.
- **The deferral restore matches what it guards:**
  - the quest latches are restored by title;
  - a condition's `until` is restored by owner, index and name;
  - an expired thread's ask is restored by what, setTurn and asked.
- **Sheet or kind fields that could be missing:** buildWhispersNote's small-talk path concatenates `kindDef().whisperSubject` without a fallback. Only the village kind sets `smallTalk`, and it defines `whisperSubject` (data.js:403).
