# Fable approval — the Opus 5.5 audit of 2026-09-29

**What this is.** The owner asked (2026-09-29) that [AUDIT_2026_09_29_Opus5.5.html](AUDIT_2026_09_29_Opus5.5.html) and its 13 owner rulings be approved by Fable before anything is built.
- Three Fable reviewers split the work: A+B, C+D, and E+F+G.
- Each re-ran the evidence against a frozen HEAD (6dbb0eb, v1.1017) and the owner's saves.
- Each returned approve, approve-with-changes or flag for every row.

**Result:** all 68 rows approved — 11 as written and 57 with binding changes. None flagged. Opus 5.5 builds them under the probation (CLAUDE.md ▸ Opus probation).

**Binding.** The "changes" column is binding on the builder. Where a change overrides the audit's own fix text, the change wins.

Items that need the owner, audit corrections, and cross-row build order are summarised at the end of the audit ("Fable review — annotations"). This file is the full record.

## Reviewer 1 — sections A and B

| ID | Verdict | Binding changes |
|---|---|---|
| A1 | APPROVE WITH CHANGES | (a) null = "no known match". The SUBLOCATION arrival still MINTS on null; `fileLocationItem`'s place operand refuses loudly on null (today's #6E3). (b) Precedence is fixed: identity overlay (compose parent\|name → locResolve) → kind table (house owner, commons, hall words, in that order) → case/article-insensitive leaf match against the parent's children → null. (c) The kind table is data on the kind def; the if-chain at tag_table.js:539-542 is deleted, not duplicated. (d) Tests: the three namings file on the canonical node (red at HEAD); an unknown place is still refused; #6G6/#6E2/#6E3 stay green. Sabotage: bypass the resolver in `fileLocationItem`, on a unique anchor. |
| A2 | APPROVE WITH CHANGES | (a) Resolver order: exact (`_invNorm`) → UNIQUE `itemBaseName` match → ambiguity refuses loudly with no removal. Applies to ITEM_LOST, COMPANION_ITEM_LOST and the pairing pass. (b) Name-keyed pairs (stow, give, take) withhold on a miss in every kind. (c) The sale pair (GOLD + ITEM_LOST) withholds ONLY in a `tradeOnlyInShops` kind. In the adventure, a sale whose loss still misses after the resolver KEEPS the gold, prints "⚠ … '<item>' is not on the sheet — coin kept" and arms a one-shot ping (the trade-refused shape): never a silent mint, never a withheld reward. (d) Stow put-back: a refused placement (any reason, including a trade-gate rider refusal) re-adds the unit only when THIS reply's ITEM_LOST removed it (R tracks hits), and says so. (e) A refused trade rider counts as a miss for pairing. (f) Fourth red-first test: adventure `[GOLD:+30][ITEM_LOST:Torch]` with no torch → gold lands, ⚠ line, ping armed. Build after A1. |
| A3 | APPROVE WITH CHANGES | (a) Household proxy: at a node whose `owner` is the hero, the hero AND every living unsplit `partyMember` may take (`[COMPANION_ITEM_GAINED:]` runs the gated `autoTakeLocationItem`). At another resident's house only that owner takes. (b) Register `stashRefusedPing` in NOTE_SHAPES / NOTE_LATCH_FIELDS / NOTE_BUILDERS; combat-silent; one-shot. (c) The note lists the legal place names (display leaves of the sub-locations under the current world, capped at about 12). (d) Tests: a refused `placed` and a refused `taken` each arm it; the next notes carry it once; the companion take from the hero's chest lands and decrements the row. |
| A4 | APPROVE WITH CHANGES | (a) `R.placeAt(offset)` keyed by tag OFFSET. One helper hands handlers their occurrences with offsets. Filers take an explicit optional node key and NEVER mutate `worldState.world` mid-parse. (b) ONE timeline: `villageTradeContext(text)` and the SUBLOCATION_LEAVE handler read it (no second text parse). The F10 keeper rule stays. (c) The sequencer runs per `applyMutsTable` call: the ordinary stream first, then each CANON_TXN body on the already-moved state. Document it; a reward inside an envelope is judged at the end state. (d) Passed-through arrivals file through A1's resolver (A5's first bullet lands here). (e) Per move: the twin-conflict check, the #260 combat-clear/defer, edge chaining and the guestbook queue run per place; two `[LOCATION:]` tags end at the second. (f) A test pins `[SUBLOCATION:x]…[LOCATION:Y]` as x under the OLD world, with the party ending at Y with no sub. (g) `hoursAsk.node` keeps answering to its own node. (h) Sabotage: `placeAt` returns the end state. |
| A5 | APPROVE WITH CHANGES | (a) `[LOCATION_STATE:…\|place]` is ENGINE-ONLY tier: no standing-doc change and no stable-half touch. An unresolvable place is refused loudly and NEVER stored as text. (b) The pass-through composer ships inside A4's sequencer; `fileSubLocation`'s key and the soundscape target ship with A1. (c) Existing twins in saves are a map_cleanup repair. (d) Test as written. |
| A6 | APPROVE WITH CHANGES | (a) Decide by NODE: `owner === hero` → "Here: chest (N items)"; every other node names its items. (b) The tavern pin (engine-tests.js:24087) and any house pin are re-baselined under the ruling; say so in the commit. (c) Tier: Fable-under-probation, not Off-Fable (a pure function plus byte pins). |
| A7 | APPROVE WITH CHANGES | (a) Mark refusals at the SOURCE: every refused or ignored push in tag_table.js starts with "⚠ ", and the renderer keys on the leading glyph, not on vocabulary. (b) The #431/#452 byte pins change only for glyph lines. (c) One "Sub:" line per arrival; no arrow for a case-only rename. (d) Tier: Fable-under-probation for both halves. |
| B1 | APPROVE WITH CHANGES | (a) The SCENE_CAST doc line lives in the STABLE half (`buildStateTagsDoc`). Flag the stable-half touch, re-baseline `dev/golden/tag-table-doc.golden` in the same commit, and bump APP_VERSION/CACHE. (b) Put the "standing where THIS reply ENDS, party members included" wording ALSO in `buildSceneCastNote` (volatile). (c) Withhold NODE presence only (lastSeenAt, guestbook stamp, frame observation). The transcript speech record is untouched. The "Present:" summary shows withheld names as "(spoke, not in cast)". (d) `[SCENE_CAST:none]` = no cast. (e) The combat clause depends on A4's `combat.node`. (f) t198 (cast names the pre-move speakers) is a documented residual; only the wording can fix it. (g) The "X spoke but your cast leaves them out" note is one-shot, with a registered latch, combat-silent. (h) Sabotage: drop the `R.castSet` check. |
| B2 | APPROVE WITH CHANGES | (a) The HERO is exempt; companions only (living, unsplit `partyMember` NPCs); `none` excluded. (b) Withheld stamps are LOUD: an R.muts line "Cast omits X, Y — arrival not stamped". (c) The ping is its own builder and latch (e.g. `castOmitPing`, registered) with a cooldown: no re-arm for the same member set within PRESENCE_AUDIT_TURNS. The GM decides; the engine never splits. (d) `guestbookCommitArrivals` must receive the parse's cast set; amend the memory.md guestbook clause. (e) Sabotage: drop the exclusion. Build after B1. |
| B3 | APPROVE WITH CHANGES | (a) The gate is "both observed in the active frame with `lastTurn === worldState.turn`". Name it separately (e.g. `sceneOnStageNow`) beside B4's predicate. (b) The exchange note is REMOVED from B4's consumer list; B3 owns it. (c) Sabotage: revert to `manifest.local`. |
| B4 | APPROVE WITH CHANGES | (a) The predicate also honours the latest cast, as B1 does: a rostered name omitted from the latest non-`none` cast emitted AFTER its last observation is not present. (b) ONE boundary: change `addLocal` in `buildSceneManifest`, so every `man.local` consumer changes at once. The trade gate gets a second manifest field (e.g. `man.seenHere`, the stale-tolerant exact-spot list), so `villageTradeContext` is behaviour-identical. (c) Tests: Victor is not local, is listed in RESIDENTS ABOUT and gets no "plays as" (red at HEAD); a shop whose keeper was last seen 100 turns ago still trades; the exchange note is not on this predicate. (d) Build after B1. |
| B5 | APPROVE | Include the participle case ("residue left along") among the six negatives. |
| B6 | APPROVE | `residentWhereabouts` stays pure and deterministic with the closed-shop filter. The travel suppression reads the PLAYER's action only. Build after B4. |
| B7 | APPROVE | — |

**Build order for A and B:**
1. A1 → A5 (the key and soundscape parts) → A2 → A3.
2. A4, which carries A5's pass-through part and B1's combat clause.
3. B1 → B2 → B4 → B3 → B6.
4. A6, A7, B5 and B7 are independent.

## Reviewer 2 — sections C and D

| ID | Verdict | Binding changes |
|---|---|---|
| C1 | APPROVE WITH CHANGES | (a) Select by campaign only, unconditionally. Do NOT route through `pastHeldNow`: it releases the past in the Hall and when the hero raises it. Candidates are this campaign's moments (an UNSTAMPED moment counts as this campaign's, which keeps #6C1 passing), then the last key decision, then the last chapter's first sentence, using C8's comparator. Skip `kind:"party"`/`"bond"` filings. (b) Reject a candidate that `registerScan` hits, that `momentEchoWords` flags against `heldPastParty().prior`, or whose gist key is in `motifNudged`. On null, the note omits the fact clause. (c) Note text: the fact is named "in the neighbour's own words, one passing clause, never the record's wording". Staging: "when the hero steps out or someone calls at the door — never through a window or shutters". (d) Sabotage: remove the camp filter. Build after C8, together with C2. |
| C2 | APPROVE WITH CHANGES | (a) No filing ask in ANY branch: the change is shown, never filed. The ack list becomes `["SAY"]`; no `tag` field. (A `[WARES:]` ask would misfire outside the shop.) (b) Re-baseline the #6C2 pin in the same commit and say so. (c) No migration for the house's wrong notes; A5 owns the pipe refusal. |
| C3 | APPROVE WITH CHANGES | (a) The landed tick gets the ORDINARY receipt ("X ✓ objective"), no ⚠. (b) Document the cross-envelope limit in the test. (c) Sabotage as proposed. |
| C4 | APPROVE WITH CHANGES | (a) Apply `skeletonTitleKey` to BOTH sides everywhere a title is compared: the ACT_COMPLETE active-act compare, ARC_COMPLETE's `_pre` snapshot keys and `_seen`, and ARC_CONTINUE. (b) The one-shot mismatch note is a NOTE_SHAPES row with a declared latch; combat "fires". |
| C5 | APPROVE WITH CHANGES | (a) `worn` is NOT cleared. The registry is `outfit` plus the relationship `dynamic`/`dynamicTurn`; bond is untouched. (b) ONE boundary helper at the five adoption/import sites: game.js startGame, importVillageResidents, adoptLibraryHero, adoptLibraryCompanion, and ui-browsers `_addImportedCompanion`. (c) NO same-campaign age gate. Only the campaign boundary and the negative-age omission ship; the adventure prompt is pinned byte-identical for same-campaign data. (d) Stamp `outfit.camp` via C8's stamper. |
| C6 | APPROVE WITH CHANGES | (a) ONE gate function used by BOTH buildSysPrompt's splice and `buildCarriedRecordNote`, applied OUTSIDE the memoized retriever. (b) Gate = small-talk kind AND not in the Hall AND !pastRaisedByHero(action, userTurns, party names ∪ named residents, party prior ∪ those residents' carried pool). (c) Adventure kinds stay byte-identical (pin). Sabotage: drop the gate. |
| C7 | APPROVE WITH CHANGES | (a) ONE pure masking helper (e.g. `registerScanProse`): exact whole-phrase, case-insensitive masking of the record's names before `registerScan`. Used by the record guard, C9's narration scan and the #372 chapter guard. (b) The rewrite prompt LISTS the exempt names and says every other clerical word must go, hyphenated coinages included. (c) The deferral queue is bounded (cap, loud eviction), persisted on the save, re-guarded next summarize, and counted as its own census outcome. Sabotage: skip the mask. |
| C8 | APPROVE WITH CHANGES | (a) Stamp BOTH `camp` and `campId`; compare by id when both sides carry one, else by name. ONE stamper at every stamp site and ONE comparator at every reader (api.js:345-347, helpers.js:842, ui-sheets.js:201/209, C1, C5). (b) `campSaveRename` re-stamps name-only legacy entries that equal the old name. An already-renamed legacy save gets no automatic repair. (c) Build FIRST among C1/C5/C8. |
| C9 | APPROVE WITH CHANGES | (a) The narration-scan exemption uses C7's helper. (b) The scrub walks `worldState.questLog` AND `memory.quests`; the pin moves in the same commit. (c) The RETOLD MEMORY note keeps the gist as its `motifNudged` KEY but no longer quotes it in the text. |
| C10 | APPROVE WITH CHANGES | (a) Gate the volatile `cache_control` on the `suggestInband` SETTING: present when OFF, absent when ON. (b) `buildSuggestionSys` unchanged. (c) Record it as an amendment to #304 C. Test: one vs two `cache_control` blocks by setting. |
| C11 | APPROVE WITH CHANGES | (a) Rule 18 and the `tagDocNote` glue are in the STABLE half; the village's cached prefix changes once, and the adventure's stable half is pinned byte-identical. (b) Split by surface: stable text / notes and volatile text / the start-node stamp. (c) The start stamp lands in startGame even when the node was pre-created. (d) The ~730 characters of duplication is left for a separate row. |
| D1 | APPROVE WITH CHANGES | (a) Busy gate: refuse while a turn is in flight ("wait for the turn to finish"). (b) The pointer records what actually moved — `{name, units, action, key, pack, turn}` — and the inverse derives from the halves that landed. Build AFTER A2. (c) The auto-take path writes the pointer too; a ledger plan of N units is ONE move. (d) The inverse applies through `applyMuts` with D6's source flag. (e) The pointer is the tail of D9's move record. Sabotage: drop the inverse re-add. |
| D2 | APPROVE WITH CHANGES | (a) `stashKey` also keys the ledger rows and marks, so every stash consumer goes through the one key. (b) The heal runs only where `stashQuantities`; adventure toggle rows stay byte-identical; idempotent, loud once. (c) Auto-take takes n units and the receipt names n. Build after A2 and D3, before D1/D9. |
| D3 | APPROVE WITH CHANGES | (a) The bound is a refusal or a clamp, receipted either way. (b) The same grammar feeds the QUEST reward item count and `rewardAwardTargets`; `shopTradeTagText`'s 9-chunking may go (round-trip test at qty 13). (c) The companion duplicate warning counts n per base. (d) "x1" = one unit. |
| D4 | APPROVE WITH CHANGES | (a) The counter pays the parsed offer (D5's `parseCoin`). An offer that isn't a coin amount makes the row unsellable at the counter with the reason. (b) Retire on the counter sale and on an ITEM_LOST of the wanted item in that shop, receipted "Want met: X (keeper)". Expiry on the clock via `nodeWantedLive`. (c) Amend #407 ruling ① in the TODO row. |
| D5 | APPROVE WITH CHANGES | (a) GOLD REFUSES a non-gold unit with a receipt; never converts. (b) `parseCoin` also feeds the QUEST reward parse (tag_table.js:909/945) and `rewardAwardTargets` (api.js:3088). (c) "per N"/"each" is a per-unit price; the counter multiplies by quantity. (d) The overspend receipt changes; the floor stays. |
| D6 | APPROVE | Add a sabotage clause. |
| D7 | APPROVE WITH CHANGES | (a) Apply on the LINE total (qty × unit). Two 0.3 gp items sell for 1 gp; a lone one is refused with the reason and stays in the pack. |
| D8 | APPROVE | — |
| D9 | APPROVE WITH CHANGES | (a) ONE village move record, a `worldState.stashMoves` ring `{name, units, action, key, at, turn}`, written by LOCATION_ITEM and the auto-take path. It is also D1's pointer source. Replay applies entries with `at > entry.updatedAt`. (b) Legacy moves are not replayed; counted once, loudly. (c) Capped with loud eviction. |
| D10 | APPROVE | Clear the owed queue and the owner's #429 marks in `adoptLibraryHero`; add an assertion in the #428 group. |

**Build order for C and D:**
1. C8 first.
2. C1 + C2 together.
3. C7 before C9.
4. A2 → D3 → D2 → D6 → {D1, D9}.
5. D5 before D4 and D7.
6. C3, C4, C6, C10, C11, D8 and D10 are independent.

## Reviewer 3 — sections E, F and G

| ID | Verdict | Binding changes |
|---|---|---|
| E1 | APPROVE WITH CHANGES | (1) Strip `^(mood\|emotion\|tone)\s*[:=]\s*` (case-insensitive) BEFORE the 40-character cap and the shape test. The #458 refusals stay refused. Add the four real forms to the #458 group and assert the Inworld prefix. (2) The SAY doc line is in the STABLE half and must NOT ride this commit (optional separate commit). (3) One toast per session with the drop count. (4) Sabotage on the strip line. |
| E2 | APPROVE WITH CHANGES | (1) Keep the `quiet:hushed` gain halving. (2) Take a seed's accent list whenever the plan chose a registry seed, still subject to the profile's `forbid`. (3) Tests: the t218 exterior profiles at 06:00/12:00/16:40 (red at HEAD); the t218 tavern → hearth (forbid wins); the t202 tavern → crowd bed plus footsteps. Sabotage: restore the `profilePolicy` gate. |
| E3 | APPROVE | — |
| E4 | APPROVE WITH CHANGES | (1) The boundary is `setActiveCampId(id)`'s id-change branch, not `loadState`. (2) Key the replay by campaign id. (3) Tests: the repro, plus "new campaign stops the read". |
| E5 | APPROVE WITH CHANGES | (1) Filter in `audioParseProfile` only, for both `allows` and `forbid`. An `allows` list that is ENTIRELY unknown words is still refused. (2) `v.dropped` reaches the turn summary line. (3) The six enum refusals remain refused. (4) Tests and a sabotage clause. |
| E6 | APPROVE | A hidden sheet row leaves a one-line hint. A directed group on Gemini either composes or drops the direction, never sends the bare sheet text as the whole prompt. |
| E7 | APPROVE | Assert that the re-ask still fires on staleness. |
| E8 | APPROVE WITH CHANGES | While held, ALL four Media Session commands are no-ops, each landing a `media-action <kind> held` crumb. The hold clears only via spoken resume, the tap, or `hideCarMode`. tests-19b group. |
| E9 | APPROVE WITH CHANGES | SKIP the warm-up while `TTS.isPlaying()` (a deferred warm-up would fall outside the gesture), with a console.info. Update the tts-stt.md "#19 fourth pass" line. |
| E10 | APPROVE | The #454 pin must keep passing by absence. |
| F1 | APPROVE WITH CHANGES | (1) KEEP `renameCampaignFolder` and the #438 refusal semantics. On success the stored slug becomes the new folder name; on refusal it is untouched. (2) Legacy adoption rule: no stored slug → candidate `slug(campName)`; folder absent → create it with a marker; present without a marker → ADOPT and write the marker; marker with a foreign id → `_2`, `_3`…; never move files. (3) The slug survives `mergeCampaignLists`; `rehomeCampaign` re-stamps a marker it owns. (4) Re-baseline tests-336 deliberately. (5) Build after F6. |
| F2 | APPROVE WITH CHANGES | (1) `safeImgSrc` admits `^data:image/(png\|jpeg\|jpg\|gif\|webp);base64,[A-Za-z0-9+/=]+$`, `https://…` and `blob:`. Anything else → "" plus one console line. (2) Also covers character_editor.html:224; the contract scan covers root *.html as well as *.js. (3) Import boundaries (importSaveData, .char import, library adopters, `fillPortraitsFromBlob`, the quick-start payload) drop a failing portrait with a toast. (4) Sabotage: `safeImgSrc` returns its input. |
| F3 | APPROVE | The new test must use the microtask observer model. |
| F4 | APPROVE | — |
| F5 | APPROVE WITH CHANGES | (1) Collision-safe migration: rename `x_` → `x` only when `x` is free for that user; otherwise leave the row and log it. (2) The shared function reproduces the designer's slice rule. (3) A server-side test, plus a client pin that the vendored copy is byte-identical. (4) The server half needs `flyctl deploy --ha=false`, an owner-visible step. |
| F6 | APPROVE | Build before F1. |
| F7 | APPROVE | — |
| F8 | APPROVE | — |
| F9 | APPROVE | Tier: storage-adapter reconcile logic is Fable-tier (probation log), not Off-Fable. |
| F10 | APPROVE | — |
| F11 | APPROVE | — |
| F12 | APPROVE | Build after F7. |
| G1 | APPROVE | — (built 2026-09-29, 2b4598e) |
| G2 | APPROVE WITH CHANGES | (1) ONE base at one step: on a PR, `base.sha`; on a push, `event.before` only when non-zero and reachable, via merge-base; else merge-base with origin/master; else HEAD~1. (2) `run-sabotage-diff` gets the range once; check-shell-markers and lint-todo run PER COMMIT. (3) Pin the range step in check-enforcement. Build before G6. |
| G3 | APPROVE | The read handle stays; the contract bans `createWritable`, `showSaveFilePicker`, `renumber(` and `_downloadMd`. |
| G4 | APPROVE WITH CHANGES | Ship the lint with #264 on the grandfather list, with a note, until the owner rules on the renumber. |
| G5 | APPROVE | Designer edits bump `BP_DESIGNER_VERSION`. |
| G6 | APPROVE | Build after G2. |
| G7 | APPROVE WITH CHANGES | Drop the archive size cap (or grandfather what's there). CI needs a `--head-archive` twin of `--head-file`. |
| G8 | APPROVE | — |
| G9 | APPROVE | The applyMuts/api.js description edit is Fable-tier. |
| G10 | APPROVE | The editor hook CALLS `dev/check-es5.js` (one rule set: const/let/arrow/template/class). Build EARLY. |
| G11 | APPROVE WITH CHANGES | (1) Split the Playwright→CDP port into its own row, or delete the unused qa scripts. (2) Drop the gate-logs bullet (moot after G1). (3) The overdue playtest is an allowance spend, not code. (4) reviews/ → audits/ fixes all ten citing files in one commit. |

**Build order for E, F and G:**
1. G1 and G10 first.
2. G2 → G6; G4 → G7 (G3 can ride along).
3. E7 → E2 → E3; E1 on its own; E6 before E10; E8 then E9.
4. F6 → F1; F2 before F3/F8; F7 → F12.
5. F5's server half deploys after the client.
6. G5 after the E/F builds; G8/G9 last.
