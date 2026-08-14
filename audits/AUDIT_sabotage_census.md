# AUDIT — sabotage-coverage census

**Known issue:** #18
**Census baseline:** `e91c1c6` (v1.621), 2026-08-14
**Scope:** verification only — `dev/`, `.claude/hooks/`, `.github/workflows/`; no game-code changes
**Method:** read every `dev/run-tests.js` source-contract block; enumerate all 145
`dev/engine-tests.js` sections; inspect every living sabotage battery, standalone verifier,
workflow, and hook; cross-check retained commit messages/audit receipts; run the living batteries
and standalone suites against the baseline. No live save or localStorage was read.

## Finding

The project's verification culture is strongest where the current drift campaign has forced it
to be strong, but “no guard trusted until sabotage proves it” is not yet a property of the whole
stack.

- The main gate is large and green: **145 behavioral sections / 1,405 assertions**, plus **24
  top-level source-contract blocks**.
- The eight living sabotage batteries contain **157 mutations**. All 157 were caught on this
  pass and every target was restored byte-identical. **145/157 carry `mustFail` attribution;
  12/157 remain exit-status-only.** Those 12 are the already-filed #183 residual, not a new row.
- Living attributed mutations currently touch **15/145 behavioral sections**. That is section
  reach, not assertion coverage: the recent #156/#158/#168 surfaces are deep; most older sections
  have no retained mutation.
- Of the 24 source-contract blocks, 15 have complete historical kill receipts, seven are mixed,
  and two have no located kill receipt. Much of the historical proof was a one-session scratch
  harness: real evidence, but not living/re-runnable evidence.
- The filing-day exhibit was valid: the old `dev/lint-todo.js` passed a moved row truncated from
  5,492 to 3,878 bytes because it checked table shape, not moved-row identity. #20 has since made
  that exact class living and sabotage-proven.

The census also found two verifier defects and two enforcement gaps:

1. `dev/tests-b9-transport.js`, `dev/tests-c13-adapter.js`, and `dev/tests-dedup-a.js` are labelled
   **UNWIRED** and currently fail before their first assertion: their copied engine lists omit
   `identity.js`, so `api.js` loads with `buildProvisionalNudge is not defined`.
2. `.claude/hooks/stop-check.js` still reads deleted root `ui.js`; the surrounding catch swallows
   the error, so its version-drift half is inert.
3. The installed `.git/hooks/pre-commit` is not byte-identical to tracked `dev/pre-commit`. The
   installed copy benefits from `lint-todo`'s new git-aware default, but does not request staged
   mode and does not run the six #20 acceptance fixtures. A repaired working file can therefore
   disagree with the staged blob without that local hook noticing.
4. TODO #25 records a one-off baseline failure in the #156 Phase B canonicalization test followed
   by four clean runs. That section is sabotage-proven, but nondeterminism is a separate trust
   defect until reproduced or retired.

## Remedy

Do not retrofit 1,405 one-mutation-per-assertion tests. Keep direct, deterministic unit tests in
the ACCEPT class and spend sabotage on silent boundaries: cache identity, tag stripping, canon
isolation, persistence, loaders, enforcement wiring, and the sabotage harness itself.

Execute the NEEDS-PROOF queue below in order. A queue item is complete only when its mutation is
retained, changes bytes, fails on the named guard, and restores the target byte-identically.
Drift-surface items route to a Fable session; tooling/voice/UI items route to their owning lane.

## Living status

This audit is a **closed census, not a claim that the queue is closed**. The tables are the living
status as of `e91c1c6`. When a queued guard gains proof, update its row here or supersede this
audit with a dated census. No fixes were made in this lane.

## PROVEN — demonstrated kills located

### Living sabotage batteries

| Battery | What it actually covers | Result on this pass | Attribution |
|---|---|---:|---:|
| `sabotage-bibpick.js` | Only the eight BIB PICKER source clauses in `bible_editor.html`; not the rest of BIBLE EDITOR | 8/8 | 0/8 `mustFail` |
| `sabotage-phase.js` | Only #158 phase recognition plus the two game wiring calls | 10/10 | 8/10 `mustFail` |
| `sabotage-identity.js` | #156 Phase A/B identity and location-repair seams; not every `identity.js` contract | 22/22 | 22/22 |
| `sabotage-drift-hardening.js` | Selected W4/W5 recognizers and later #187/#188 seams; not “all drift hardening” | 15/15 | 15/15 |
| `sabotage-w2.js` | W2 transaction/refusal/receipt boundaries; `--focused` is only the section-scoped subset used by CI | 44/44 | 44/44 |
| `sabotage-w6.js` | W6 summary-identity validator, retry lifecycle, import receipt; not all summarization/memory | 21/21 | 20/21 |
| `sabotage-w7.js` | W7 relationship axes, migration, merge, and nudge authority | 27/27 | 26/27 |
| `sabotage-todo-hygiene.js` | #20 moved-row identity and warn-only session advisory | 10/10 | 10/10 |

The 12 exit-only cases are exactly the eight BIB PICKER cases, the two #158 game wiring cases,
W6's `ui-files` rejected-summary import receipt, and W7's failed-provider nudge consumption. They
stay cross-referenced to **TODO #183**; this audit does not duplicate or edit that row.

### Source contracts and standalone guards

| ID | Guard or clause | Demonstrated kill | Status |
|---|---|---|---|
| P01 | Runner fails on a red assertion; zero-match filters fail; `mustFail` rejects the wrong red | Every living battery; #170/#183 found two stale and two misattributed clauses | Living |
| P02 | NARRATION PERSON: turn-count retirement forbidden | `8a19360` isolated battery re-added the old retirement line and the source contract failed by name | Historical |
| P03 | TRANSCRIPT SEAM regex recognizes an assignment and rejects an equality fixture | Built-in self-fixture executes on every `run-tests` call | Living |
| P04 | VOICE DELETE: swallowing delete, Safari primitive, assigned-voice/LRU/row caps, speaker/base normalization, local strip, picker wiring | v1.420 four-tripwire battery; v1.440 14/14; v1.462 review hardens | Historical |
| P05 | #144A archive import whitelist and write-site eviction-to-archive | `7b701ac`: whitelist sabotage plus behavioral write-site mutants; W6 retains one import-receipt case | Mixed living/historical |
| P06 | #151 latch registry's write census, including both builder regions | `3bfd09e`: first one-region mutation was missed, widened census then caught by name | Historical |
| P07 | STARS PORTABILITY + DEFAULT BENCH contracts | #95.4 introduction proof and v1.462 seven additional source mutants | Historical |
| P08 | BIBLE EDITOR: class/item serializer markers and canonical output | `851426e` serializer drift, marker loss, and hand-format mutants | Historical |
| P09 | BIBLE EDITOR: item-bible fixed schema / category / alias macro-guards | `4c76234` 3/3 source mutations | Historical |
| P10 | BIBLE EDITOR: #158 phase wiring and derived vocabulary | `sabotage-phase.js` 10/10; two wiring cases are exit-only per #183 | Living |
| P11 | BIBLE EDITOR: CAP VALIDATOR | `a713d35` 6/6, including a no-op mutation caught by the harness | Historical |
| P12 | BIBLE EDITOR: BIB PICKER | `sabotage-bibpick.js` 8/8; all eight remain exit-only | Living |
| P13 | BIBLE EDITOR: dead-handle purge, activation ordering, draft debounce | `32a26f5` 4/4; `1e71e6a` 6/6; `e9edc2a` 2/2 | Historical |
| P14 | BIBLE EDITOR: download-only write route | `b6ec450` four named source mutations | Historical |
| P15 | VOICE LAB: pure seam, dial shape, author lockstep, name-free arms, control, SW route, browser seam | `86698a4` six cases plus `b0656eb` S7/S8; S3 exposed a vacuous whole-file check | Historical |
| P16 | #92 SYNC COMPRESSION source hops and pure behavior | `4608577` 6/6 scratch mutations, restored byte-identical | Historical |
| P17 | AUDIO RECOVERY clauses 1–7 | v1.421 three, v1.437 three, v1.438 one scratch mutation | Historical |
| P18 | RESPAWN ORDERING, init sharing, published swap, waiter | v1.424 two and v1.429 two source mutants | Historical |
| P19 | PLAYBACK RECYCLE: buffer detach, recycle threshold, idle gate | `739fed3` 3/3 | Historical |
| P20 | APPEARANCE durable writer and close-time repaint | `536cb0f` raw-write mutant; `fa3b546` repaint mutant | Historical/partial |
| P21 | UNLOAD STAMP | v1.432 retained tripwire; re-homed without weakening in `e66c62f` | Historical |
| P22 | WORK-BUDGET GOVERNOR start/order/hard gates | `6251fcc` two tripwire groups covering all three conditions | Historical |
| P23 | INJECTION SINK: dead narrative sink, fallback, `.message` scan, `escHtml` behavior | `7d9a676` 4/4; first scanner mutation exposed a naive-semicolon miss | Historical |
| P24 | BIBLE-SERVER auth chain | `ce6da17` 5/5 plus live 403/422 checks | Historical |
| P25 | ENGINE MANIFEST: shell order, `sym`, generated browser load, no static tags | `42344f6` 5/5 (drop, reorder, blank symbol, static tag, unloaded manifest) | Historical |
| P26 | PENDING ACTION wiring | `02f0515` 4/4; first slice matched a helper definition and was tightened | Historical |
| P27 | STT upgrades source wiring | `d3d84c2` 5/5 | Historical |
| P28 | CONFIRM GATE source wiring | `e2d61bf` 3/3, named failures | Historical |
| P29 | Stable-half byte identity in prompt caching | v1.501 review: 17 state-mutation classes plus S4/S5 test hardens | Historical |
| P30 | Frozen STATE TAGS documentation hash | First live catch: #175's doc edit failed until the hash was intentionally re-baselined | Historical/live incident |
| P31 | `lint-todo` moved-row identity + session advisory | Exact 809c9fa #175 truncation fixture; 6/6 acceptance; 10/10 living sabotage | Living |
| P32 | Shell-marker pre-commit guard | `99b16e1` disposable clone: shell asset alone blocked; both markers passed; TODO-only passed | Historical |
| P33 | `install-bible` central refusals | Empty and invalid JS refused with target hash unchanged; four-slot stale class draft refused by name; real install byte-restored | Historical/manual |
| P34 | `sabotage.js` rejects no-op and wrong-red evidence, restores normal runs | Multiple real vacuous mutations; #170/#183 MISATTRIBUTED findings; every living battery restores byte-identical | Living behavior/history |
| P35 | Pre-commit propagates engine red | `ba4bff0` live failing hook blocked the introducing commit | Historical |

### Behavioral sections with a retained attributed mutation

The current living batteries name tests in these 15 sections:

| Engine section | Living proof reach |
|---|---|
| E010 `applyMuts` | W2 transaction application |
| E029 `RAG episodic memory` | W6/name-retrieval cases |
| E055 `relationship grounding` | W7 authority cases |
| E071 `Core Memory` | W7 durable-bond authority |
| E085 `#96 [SAY:] dialogue attribution` | W2 quotation/voice cases |
| E113 `mood/relation separation` | W7 axis authority |
| E135 `identity (#156 Phase A)` | identity registry/provisional/tag cases |
| E136 `identity (#156 Phase B)` | location resolution/repair cases; see TODO #25 flaky residual |
| E138 `clock phase-mismatch detector (#158)` | seven attributed recognition mutants |
| E139 `#168 drift-hardening recognizer receipts` | four attributed mutants |
| E140 `#168 W4/W5 remaining drift axes` | ten attributed mutants |
| E141 `#168 W2 referential-integrity transactions` | 27 attributed mutants |
| E142 `#168 W6 summary identity validation` | 16 attributed mutants |
| E143 `#168 W7 relationship axes` | 17 attributed mutants |
| E144 `#168R review hardening` | eight attributed boundary mutants |

E019 (`prompt caching split`) and E024 (`#92 sync payload compression`) also have retained
historical mutation receipts. E039 is mixed: its frozen documentation hash is proven, while its
strip-source hash and broad derivation census remain in the queue.

## NEEDS-PROOF — ordered queue

| Rank | ID | Guard(s) without a demonstrated kill | Why it is high in the queue | Remedy / route |
|---:|---|---|---|---|
| 1 | N01 | `sabotage.js` crash/interrupt restore and direct NOT-APPLIED/MISATTRIBUTED unit cases | The proof system can leave source sabotaged or bless the wrong red; every other result depends on it | Synthetic temp-repo meta-suite; tooling lane |
| 2 | N02 | Installed-hook parity and staged-blob enforcement; CI workflow step topology | The tracked hook is newer than the installed hook, and deleting a workflow step has no local guard | Session/pre-commit parity check plus a YAML contract; tooling lane |
| 3 | N03 | E039 frozen strip-source hash, full tag derivation/coverage, E041 full-vocabulary behavior, E044 stable-purity tripwire | A green-but-vacuous tag/cache guard silently leaks tags, changes stable bytes, or loses canon | Two-file mutations that re-baseline hashes so the semantic guard must catch them; **Fable drift-surface session** |
| 4 | N04 | TABLE TALK ISOLATION clauses other than `lastAction` | 12 source predicates can silently let OOC text mutate canon/cache; only the original `lastAction` negative control is retained | Living `sabotage-table-talk.js`, one named mutation per clause; **Fable drift-surface session** |
| 5 | N05 | SERVER TTS source clauses 1–6 | A dropped zero-wasm/ladder/handoff/prewarm clause reintroduces phone deaths or lost narration; no named sabotage receipt was located | Retained TTS source battery; voice/tooling lane |
| 6 | N06 | TRANSCRIPT SEAM direct-write scan + sanctioned-bypass marker; E017/E042/E090 compression, rescue, and memo boundaries | The class corrupts both disk and sync silently; only the regex self-fixture is living | Mutate each write hop and old-entry memo invalidation; drift surface routes to Fable |
| 7 | N07 | `run-tests.js` historical source contracts as a living battery | Historical scratch proof cannot be rerun and may stale as source anchors move | Migrate source-block cases into retained per-surface harnesses; do not make one un-attributable mega-battery |
| 8 | N08 | #144A extraction-schema phrase and #151 sendAction snapshot/restore wiring | Missing archive typing or a dropped restore silently loses/consumes canon | Named source mutants plus real failed-turn behavioral mutation; **Fable drift-surface session** |
| 9 | N09 | E033 summarize-tail retention, E062 summarize extractor, E112 engine-notes silence | Summary/prompt failures corrupt long-lived memory while ordinary turns stay green | Retained output-boundary mutants; **Fable drift-surface session** |
| 10 | N10 | The three dead UNWIRED standalone suites | They currently provide zero protection while their comments advertise a manual battery | Replace copied lists with `load-engine.js`/manifest where possible; prove a deliberate regression goes red; tooling lane |
| 11 | N11 | `.claude/hooks/es5-check.js`; stop-hook touched-file warning; dead stop-hook version check | Hook catches are silent and one branch is confirmed inert | Synthetic hook JSON fixtures, then replace the retired `ui.js` source or delete the obsolete check; tooling/docs lane |
| 12 | N12 | `file-forensics.js` anomaly verdicts | It was created after a three-hour wrong diagnosis, but has no retained fixture and a fresh fixture always trips the “<90s” heuristic | Temp files for missing/zero/BOM/mixed-EOL/invalid/untracked/temp-sibling/lock plus a controlled clean case |
| 13 | N13 | `install-bible` schema refusals, dry-run/no-op/write boundary beyond the three live/manual refusals | It writes tracked canon after validation; partial proof focuses on empty/garbage/stale only | Synthetic valid/invalid bibles in a temp repo; assert target hash on every refusal |
| 14 | N14 | Remaining BIBLE EDITOR FEAT MOVE and CAP EDIT clauses, capability serializer dirty-path | Only one named mutant is retained for each larger clause family | Recreate per-clause mutations; UI/FSA-independent source seam only |
| 15 | N15 | Remaining APPEARANCE source clauses | Durable write and repaint were killed, but refusal, NPC target, onClose routing, and six dirty paths were not individually receipted | Retained UI-source battery; UI lane |
| 16 | N16 | E083 sync-size sentinel, E110 eviction/quota, E111 reconcile identity | Data loss and split-brain are silent, but no retained mutation was located | Mutate thresholds/adopt identity/refusal paths against exact boundary fixtures |
| 17 | N17 | E145 drift-health readout | The monitor is itself a guard; a stuck-green threshold defeats the whole feature | Mutate each cache/RAG/tag/quest/anomaly threshold and require its named failure; non-drift helper side can stay tooling, prompt consumers route by surface |
| 18 | N18 | TODO #25 flaky E136 canonicalization assertion | A nondeterministic guard cannot be trusted red or green | Reproduce by seeded/order-isolated runs; do not weaken the identity assertion to make it quiet |

## ACCEPT — owner veto list

These are intentionally accepted without one-mutant-per-assertion proof. Each line is one vetoable
batch and lists every behavioral section placed in ACCEPT.

- **A01 — E001–E009:** pure parse, helper, bible lookup, class/mana, name resolution, and text/action helpers; deterministic table-driven outputs make assertion-level mutation disproportionate.
- **A02 — E011–E016, E018, E020–E023:** sheet/migration/list/CAS/quota/telemetry/skills/blueprint/meta-knowledge direct cases; failures are local and visible, with no silent cross-surface wiring claim.
- **A03 — E025–E028, E030–E032, E034–E038:** location/arc/import/archive/item/quest/level/memory hygiene direct behavior; exact failure inputs already execute the state transition, and no extra source-contract claim is implied.
- **A04 — E040, E043, E045–E054, E056–E061:** death/cast/reroll/image/party/quest/economy/item/epithet/condition/distance behavior; direct before/after state assertions are adequate for these bounded transforms.
- **A05 — E063–E070, E072–E082, E084, E086–E089:** STT/spells/actions/combat/reinforcement/context/model/conditions/campaign/TTS/library/core-memory/consumable direct logic; mutation-per-branch cost exceeds the silent-risk reduction.
- **A06 — E091–E094, E097–E109:** memo/commit/factory/chapter/NPC/sheet/helper/report/sound direct units; retained expected-value assertions are the contract and do not depend on fragile source spelling.
- **A07 — E114–E134:** clock, schedule, multiplayer, presence, mana, alignment, suggestion, truncation, campaign stamps, naming, speech/audio/recovery/credit direct behavior; accept the unit/replay layer while source wiring remains separately queued where applicable.
- **A08 — `tests-dedup-b.js` and `tests-modal-shell.js`:** standalone deterministic render/scaffold batteries are green (20 and 14 assertions); wiring them into the main gate is a separate policy choice, not a sabotage obligation.
- **A09 — workflow syntax details:** GitHub trigger spelling, `actions/checkout@v4`, `setup-node@v4`, Node 22, and runner labels are declarative platform configuration; veto only if the owner wants workflow-schema testing.
- **A10 — `server-health.yml` retry cadence:** cron, three attempts, 25-second timeout, and email-via-failed-workflow are external operational policy; an end-to-end deliberate outage is too expensive for this repo's test gate.
- **A11 — `file-forensics` descriptive fields:** printing timestamps, permissions, first/last bytes, git metadata, and sibling names is diagnostic display; only anomaly classification/exit behavior needs proof (N12).
- **A12 — `install-bible` selection/reporting:** newest-download ordering, filename inference, and console prose are operator affordances; validation/refusal/write boundaries remain the only proof-worthy part (N13).
- **A13 — `session-check` clean output and prose formatting:** it is explicitly advisory and the dirty failure shape/exit-0 rule is already proven; exact wording beyond the loud advisory label is not a contract.

## Complete `run-tests.js` source-contract inventory

This is the clause-level sweep. `P` and `N` refer to the tables above; a slash means the block is
mixed rather than sampled.

| Block | Clauses enumerated | Class |
|---|---|---|
| S01 Vendor patch/delivery | patch markers; non-OK download; same-origin phonemizer + two assets; dependency rev query; ORT import-map rev; runtime rev parity; session recycle export+caller; soak-page rev parity | N |
| S02 Narration-person retirement | no turn-count retirement; `personDriftDetect` remains called | P / N |
| S03 Transcript mutation seam | regex self-fixture; no direct `transcript[i].field=` outside `state.js`; sanctioned memory bypass marker | P / N / N |
| S04 Voice-deletion truthfulness | no swallowing `mod.remove`; standard `removeEntry`; assigned-voice eviction guard; failed-eviction LRU retention; all resident rows rendered; assignment helper exists; assignment/release/evict base normalization; only two `#` splits; local composite strip; sheet picker wiring | P |
| S05 #144A archive carry | import rebuild exists; 14 archive keys carried; no bare knowledge shift; NPC-event eviction archives; merge overflow archives; durable/scene extraction vocabulary | P / N |
| S06 #151 latch registry | both builder anchors; registry present; every write declared; snapshot before notes; failed-turn restore | P / N |
| S07 Stars portability/default bench | buttons; button handlers; star/gender edit pushes; boot pulls; both storage sync calls; cloud-adopt gender; both adopts use shared seam; override application/write; pending-timer cancels; boot-pull deferral; starred-gender propagation; both bench markers; byte equality; minimum size; entry shape; gender | P |
| S08 Bible editor | class serializer marker/parity/satellite isolation; item serializer parity and fixed schema/category/multi-category/alias/string/lowercase rules; #158 two game calls + derived phase vocabulary; validator cases; eight BIB PICKER cases; FEAT MOVE cases+wiring; dead-handle purge; activation and dirty guards; draft-timer ordering; CAP EDIT behavior+wiring; download-only flow; capability unedited and all-dirty byte parity | P / N residuals |
| S09 Voice lab | extractable pure core; 12×5 dial shape and mapping; two-way author/baseline/flavor/distilled lockstep; both prompts name-free and guarded; control embeds directive; SW regex route; browser seam; stub mode | P |
| S10 #92 sync compression | adopt inflates; both POST paths compress | P |
| S11 Audio recovery | rebuild context; tap handler; send gesture; second-attempt escalation; watchdog re-arm; zombie detector; in-flight requeue | P |
| S12 Respawn ordering | function exists; destroy+spawn both present; destroy first; init in-flight guard; published respawn promise; init awaits it | P |
| S13 Playback recycle | buffer detach; healthy-context threshold; idle gate | P |
| S14 Appearance write | no raw throwaway write; setter seam; refusal honored; NPC setter supplied; durable NPC target; sheetless loud refusal; close-time repaint; modal onClose route; six dirty paths | P / N |
| S15 Unload stamp | unload crumb survives | P |
| S16 Work-budget governor | start gate exists; it precedes init; hard mid-read gate exists | P |
| S17 Server TTS tier | zero local wasm; no governor; remainder handoff; ladder order; Test uses server; send gesture prewarms | N |
| S18 Table Talk isolation | lastAction; transcript; summarize; notes; multi-PC bypass; noHistory; cleaned response; TT retry; forced TT option; commit in else; one commit; no API references; one write/no other read; no date branch | P for `lastAction`; N for remainder |
| S19 Injection sink | no `narrativeHtml` innerHTML; escaped fallback present; no unescaped `.message` innerHTML; `escHtml` neutralizes payload | P |
| S20 Bible-server auth | per-run random token; 403 guard; guard before body; CORS header; exactly one authenticated install call in each client | P |
| S21 Engine manifest | index-derived ordered equality; every entry has `sym`; test page loads manifest; generated tags; no static tags | P |
| S22 Pending action | failed story save; committed clear; boot restore through refusal seam; own-key-only persistence | P |
| S23 STT upgrades | bias append; model constants+fallback; no hardcoded model; configurable cap; VAD teardown; mic telemetry | P |
| S24 Confirm gate | interceptor order; logprobs requested; confirmed send uses pending text | P |
| S25 Runner tail | engine load; escaped-payload behavior; section filtering; zero-match refusal; assertion exceptions/non-true values make exit non-zero | P |

## Complete behavioral-section classification

Section numbers are file-order stable only for this baseline. Names are copied verbatim from
`dev/engine-tests.js`.

### PROVEN sections

E010 `applyMuts`; E019 `prompt caching split`; E024 `#92 sync payload compression (pure)`;
E029 `RAG episodic memory`; E055 `relationship grounding (#61)`; E071 `Core Memory (#40/#63)`;
E085 `#96 [SAY:] dialogue attribution`; E113 `mood/relation separation`; E135–E144 (the complete
#156/#157/#158/#168 recent hardening run listed in the PROVEN table).

### NEEDS-PROOF sections

E017 `transcript compression`; E033 `summarize-tail retention`; E039 `tag table derivations +
coverage` (mixed: doc hash proven); E041 `full-vocabulary tag behavior`; E042 `transcript rescue`;
E044 `stable-purity tripwire`; E062 `summarize extractor hardening`; E083 `sync-size sentinel`;
E090 `transcript LZ memo`; E095 `B9 transport request shape`; E096 `B9 transport push body`;
E110 `local-copy eviction + quota`; E111 `reconcile identity`; E112 `engine-notes silence`;
E145 `drift health readout`.

### ACCEPT sections

E001–E009; E011–E016; E018; E020–E023; E025–E028; E030–E032; E034–E038; E040;
E043; E045–E054; E056–E061; E063–E070; E072–E082; E084; E086–E089; E091–E094;
E097–E109; E114–E134. The veto rationales are A01–A07 above.

## Verification receipts

- `node dev/run-tests.js` → `ALL GREEN — 1405 assertions passed (engine tests)`.
- Living sabotage → BIB PICKER 8/8; phase 10/10; identity 22/22; drift-hardening 15/15;
  W2 44/44; W6 21/21; W7 27/27; TODO hygiene 10/10; every file reported restored
  byte-identical.
- Standalone suites → `tests-dedup-b.js` 20 green; `tests-modal-shell.js` 14 green;
  `tests-b9-transport.js`, `tests-c13-adapter.js`, and `tests-dedup-a.js` each failed before tests
  with `ENGINE LOAD FAILED in api.js: buildProvisionalNudge is not defined`.
- Hook parity → tracked `dev/pre-commit` blob `4e1ddd6…`; installed hook blob `1276d307…`.
