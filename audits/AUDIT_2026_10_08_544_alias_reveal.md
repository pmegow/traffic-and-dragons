# #544 — aliases propose identity reveals; accepted sheets keep the survivor's name

Baseline runtime: b154db6b, v1.1189. Root separately shipped the #333 fixture correction in ee60011f during this work. Root owns release markers, tracker, full gate, commit and push. No live provider calls, personal-save writes, library writes or deployment were performed by this lane.

## Cause and final behavior

The existing-record alias guard refused a reveal without entering the existing merge confirmation protocol. Accepted merges could transfer a companion sheet while leaving its duplicate name on that sheet, so later voice lookup and hero promotion disagreed with the survivor's roster identity. A no-scene merge bypassed confirmation, and generic ALIAS runs after the legacy merge handler, so a co-emitted merge could act before an alias handler queued its proposal.

One classified operand reader now distinguishes hero, known, new and ambiguous operands. It preserves canonical primary and active-hero precedence, reads exact memory/row/sheet aliases and former filing-key ownership, and does not infer identity from name tokens. Both alias writers and response planning use this result. Typed reads preserve malformed legacy containers; selected owner/destination shape validation refuses before any partial alias, sheet or proposal write.

Existing-record aliases enter the established exact-pair queue without registering the alias or transferring voice/sheet state. One response-local plan covers known pairs and planned new NPC introductions across legacy/generic tag order. New introductions finalize only after producer handlers actually create the records; failed or absent introductions cannot leave an unreachable queue. Shared merge admission consults pending, nudged and armed pair history, even without scene references. Same-response proposals do not self-confirm, but a valid earlier delivered exact arm authorizes the merge even beside a repeated alias. Unrelated never-proposed no-scene merges retain their prior behavior. Owner-ruled provisional same/new/keep answers retain their existing route.

Accepted handoff archives the duplicate before modification, preserves the called name for both memory-backed and roster-only identities, and renames a transferred sheet before voice handling. Existing survivor sheets retain authority over their resources and pins.

## Class census and review

Writers examined: legacy NPC_ALIAS; generic ALIAS through IDENTITY_DOMAINS.npc.registerAlias/_identityRouteLegacy; direct adapter calls; legacy NPC_MERGE and generic MERGE; parser pre-gate and the final handler recheck; shared w2MergePropose queue admission. Adopters/readers examined: response claim planner and deferred finalizer; exact memory/row/sheet/former-key operand classification; buildMergeConfirmNudge; accepted memory and roster folds; sheet handoff; speakerSubjectOfRow/voicePinsFill; actual swapPlayerCharacter; relationship/graph/guestbook rekeying; immutable merge archive.

Variants covered: both-memory, roster-only and sheet-bearing endpoints; existing survivor sheet vs transferred duplicate sheet; exact primary/case variants, memory aliases, sheet-only aliases, ambiguous multi-owner aliases and active hero epithets; selected hero/memory/row/sheet malformed containers; former-key redirection to a malformed survivor; planned/absent/refused introductions; both tag vocabularies and textual orders; scene references present/absent; pending, same-turn, reversed, expired and valid prior-turn confirmation.

Astra reviewer supplied critical pre-review throughout and approved the final runtime. Independent evidence: initial 18-shape matrix / 156 assertions plus alias/rawhero/swap and ambiguity probes brought that checkpoint to 188 assertions. Later review added 36 malformed atomic cases, five former-key/failed-producer negatives and a final 32-case scene/known-vs-planned/vocabulary/order matrix. The final matrix preserved both records during proposal, then accepted the exact next-turn merge even beside a repeated alias, retaining identity/resources and leaving no orphan queue.

## Failure-first evidence

- Initial five groups: four failed (missing proposal, same-reply merge, stale transferred sheet name, roster-only proposal lost); ordinary hero/new-alias control passed.
- Reviewer direct-adapter hero-epithet bypass: exact red fixture, then green after raw identity stayed inside the shared classifier.
- Roster-only accepted reveal lost its old-name lookup: red then green after common post-preimage name retention.
- Sheet-only and case-normalized operands failed before the shared exact reader.
- Ambiguous sheet aliases were mistaken for unregistered names: direct/generic/legacy red fixture, then classified refusal.
- An absent canonical produced an undeliverable queue: red, then truthful refusal; root required the separate planned-introduction positive in both text orders.
- Malformed selected alias containers produced handler exceptions and partial writes: red across selected layer shapes, then pre-write refusal. Archived former-key redirection had its own red fixture before classification moved ahead of shape checking.
- Failed planned introductions with scene references retained a pre-gate phantom queue: red then green after shared proposer existence validation.
- Generic ALIAS plus legacy merge self-confirmed due handler order: red then green after the single response plan covered known pairs too. The positive prior-turn confirmation remains tested.

Final focused engine section: **17 groups green**. The proposal delivery test uses real note builders, a consumed first budget slot, latch snapshots and rollback/retry. Its first fixture incorrectly assumed a zero budget would suppress an indivisible first note; that fixture was corrected to exercise the actual deferral policy, without changing runtime budgets.

## Mutation and retained proof

**23/23 new named mutations caught**, each against the stated failing group, with source restored byte-identically. They cover proposal creation/nonmutation, handler and pre-gate admission, direction/turn matching, roster-only nudge and old-name retention, sheet naming, raw hero ownership, exact sheet alias operands, ambiguity, missing records, malformed writes, response planning/finalization, and failed introductions.

**167 retained mutations caught:** #504 55; W7 26; #542 25; #532 10; W2 focused 50 plus the one changed shared-merge-gate clause executed against its actual W2 section. The remaining W2 full-suite-per-clause cases were not rerun by this lane. Equivalent retained anchors were updated where logic moved: former-key alias reading moved to identity.js; the merge handler gate no longer requires sceneRefs; accepted sheet assignment now names its survivor; the #542 claim helper accepts an explicitly identified merge owner. The #504 missing-canonical receipt assertion now requires truthful refusal/no unreachable queue while retaining its original no-fold oracle.

Two first-pass new mutations were masked by independent guards. A proposal-write mutation now actually registers the forbidden alias rather than merely removing a redundant continue. The no-scene handler check now has an actual direct-adapter pending-merge fixture that bypasses the outer parser. Both final mutations fail their named tests.

The #532 renamed-sheet lookup mutation initially became redundant for newly correct merges. Its retained test now also supplies an explicit pre-#544 saved sheet-name mismatch, preserving the old reader's required compatibility; all ten clauses catch.

Last applicability: **2757/2757 clauses across 309 batteries** (dry applicability, separate from executed mutation proof). ES5 checker: eight passed. Root's separate #333 reset: seven engine groups and unchanged nine-clause secret battery pass; root committed that one reset separately in ee60011f, not as runtime scope here.

## Corpus and release verification

Root reports all four replay corpora unchanged and passing, and all three standard campaigns' stable and volatile prompt hashes identical to 5751f292 with source save hashes unchanged. Stable prompt instructions were not edited. Root's ee60011f commit hook, run with this runtime working set, passed 2791 engine assertions and 107 standalone suites. The final #544 release hook remains root-owned.

## Monotonic resources

Per call: classified operands, typed views and the response-local pair plan are temporary and bounded by current actor aliases and response tags. Per turn: no new persisted latch; pending/deferred note state uses the existing shared snapshot registry. Per session: no new listener, timer, cache or request handle. Per campaign: existing pending pairs dedupe, delivered pair history remains once-per-pair, and accepted merge archives retain the complete preimage under the existing policy; the change adds no per-turn history. Per device: no new store or automatic library writes. No WASM/media path changed.
