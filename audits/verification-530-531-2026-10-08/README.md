# Objective acceptance — #530 / #531 and entry 38

Senior reviewer: Astra. Review baseline: `fa065e87f3e773fda88569109b114f4be0389eca`, engine v1.1194; the intervening #599a gate belongs to another session. Date: 2026-10-08 local / 2026-10-09 UTC. Synthetic data only, no runtime edits, credentials, owner-save writes or model calls. Read current AGENTS.md, CLAUDE.md, identity/tags contracts, TODO #530/#531/#534, queue entry 38, and both #504 audit records before testing.

**Verdict: #530 and #531 pass objective failure-condition acceptance, with independently attributed mutation proof. Do not archive them yet.** The independent objective review requested by entry 38 is completed for the current implementation with the evidence below; no new identity defect was found in the reviewed routes. Its separate live-GM answer remains unexecuted. The [#504 record](../AUDIT_2026_10_07_504_title_question.md) explicitly requires #504/#530/#531/#534 to close together and requires a live model answer before shipping. Neither a scripted engine response nor this independent review silently waives that binding completion condition. Whether a real GM answers the delivered note is behavioral integration, not prose taste. This report supplies the objective portion and leaves that exact remaining requirement visible.

## Exact failures and why the current code avoids them

**#530:** `npcMergeAnswer` reads the answer once for both W2 preflight and the handler. A new-name ANOTHER result bypasses the ordinary established-record proposal gate; an OTHER existing target queues exact record keys and requires the delivered exact-pair confirmation under scene refs. The current handler rechecks state after preceding tags. The independent runner exercises both scene-ref regimes, note cessation after later turns, carried event data, unchanged princess memory, successful OTHER confirmation and repeat behavior. Reintroducing the old gate catches `FAIL #530 ANOTHER lands and stays settled; refs=true`; making OTHER act as SAME catches its named confirmation assertion.

**#531:** `resolveNpcName` returns the titled person's own name while identity remains a question. Reported death, scene bind/reveal and combat presence then use that name. The independent runner asserts positive outcomes as well as the princess surviving: the queen actually dies in the reported-death case, actually dies through valid prior-turn scene envelopes (both named and `-` subjects; bind and reveal), and receives the combat presence stamp while the princess receives none. Same-turn evidence is a separate negative control that must refuse death. These are not green checks caused merely by an unrelated invalid envelope or an unfiled location.

Source inspected: memory.js title/exact/former-key/resolver and summary-extract paths; identity.js provisional stamping/note/merge-answer reader/W2 proposal gate/scene bind/reveal/death/presence; tag_table.js merge/alias/pronoun/death handlers and post-handler derivation; api.js exact-pair note arming, companion lookup and note-latch enrollment. The 31-line [tag routing census](tag-routing-sites.txt) supports source navigation; it is not claimed complete dynamic-alias coverage or 31 executed tests. Companion writers route through the shared companion resolver; alias operands now use the stricter #544 admission reader, preserving current independent identity protections.

## Commands and outcomes

All commands ran against the baseline above. Logs beside this report contain actual stdout.

| Command | Observed result |
|---|---|
| `node dev/run-tests.js "#504"` | FILTERED GREEN, one section, 16 assertions. Explicitly not the full suite. |
| `node dev/sabotage-504-title-question.js` | 56/56 attributed clauses: groups 18 + 20 + 16 + 1 + 1; scratch files restored byte-identical. |
| `node audits/verification-530-531-2026-10-08/acceptance.cjs` | 14/14 independent cases pass. |
| `node audits/verification-530-531-2026-10-08/prove.cjs` | 5/5 named mutations caught in scratch clones: ANOTHER gate, OTHER proposal, scene binding, combat presence, reported-death resolver. |
| `node audits/verification-530-531-2026-10-08/entry38-objective.cjs` | 13/13 additional objective cases pass. Nine initial-title writing routes, summary extraction, ordinary exact/case/separator/alias identities, refusal recovery and 200-NPC resolver measurement. |
| `node dev/fuzz-npc-identity.js 4000 4242` | 4,000 sequences / 17,918 replies, zero distinct violations. |
| `node dev/fuzz-npc-identity.js 2000 7 swap` | 2,000 / 8,889, zero. |
| `node dev/fuzz-npc-identity.js 6000 99 swap` | 6,000 / 26,691, zero. |
| `node dev/fuzz-npc-identity.js 4000 31337 swap` | 4,000 / 18,099, zero. Total 16,000 sequences / 71,597 replies. |
| `node dev/diff-replay.js dev/corpus_playtest_v1238.json --check` (also v1258, v1271, v1276) | All four end states unchanged, zero handler errors. |

The existing fuzzer tests loose/reversed/repeated answers, same-response aliases/introductions/notes, established-record protection, hero swaps, orphaned/stale filing keys and ability to answer open provisionals. Its own documented bookkeeping limits remain: note travel through confirmed merge chains and canonicals created by aliases in the same response. Zero violations is evidence for those generated sequences, not every possible GM sentence. Existing #504 guards and the independently named acceptance mutations both exercised genuine byte changes; no assertion or anchor was loosened.

The broader objective review covers entry 38 (a) source routing plus nine runtime seams, summary and valid death/presence; (b) exact answer/proposal routes and randomized interleavings/hero cases; (c) existing-name/case/former-key tests and fuzzer; (d) loose-answer refusal recovery, answer reachability and note cessation; (e) the measurement below; (f) sensitivity of current guards plus stronger positive controls. No claim is made that every tag spelling was separately executed. Known deliberate language boundaries (multiword family shapes, the mirror given-name case) are unchanged and were not turned into new product choices.

## Harness failures, reported faithfully

The first acceptance run was **12 passed / 2 failed**, both with `positive control: queen present — undefined !== 86`. Its `makeTestWorld` fixture had no filed map node. `npcRecordPresence` deliberately writes no lastSeen stamp when that node does not exist. A first hypothesis that applyMuts omitted derivation was wrong: tag_table.js:2026 already calls `derivePresenceFromResponse`; manually repeating it produced the same two failures. Both logs are retained as `acceptance.log` and `acceptance-final.log` (the latter filename records that unsuccessful attempt, not final success). Source inspection then identified the exact map precondition. The corrected fixture adds the filed Ashfen node, removes the redundant derivation, and all 14 assertions pass in `acceptance-corrected.log`. The combat assertion was not weakened.

`node dev/file-forensics.js identity.js` also reported `npcWordTable is not defined` while evaluating the standalone file. That tool's missing engine-load context is not a JavaScript syntax defect: the complete canonical engine loader and every test above loaded the same file successfully. The source was clean and size-identical to HEAD. No runtime source was changed to accommodate either harness issue.

## Cost and monotonic resources

At 200 NPCs, 1,000 pure resolver calls took 0.3418 ms for an exact primary, 15.687 ms for a separator/case spelling, 99.4437 ms for a new title, 91.9704 ms for Old Queen, and 70.9077 ms for a missing traveller on this machine. State remained exactly 54,640 JSON bytes and byte-identical after all 5,000 calls plus warmups. This measures the current hot path, not a before/after speedup or mobile latency guarantee; no new cache is justified by it.

| Scope | Result / residue |
|---|---|
| Call | Tokenization and scans allocate transient arrays/maps; no retained resolver cache. Fixed-input call loop leaves world and memory identical. |
| Turn | Note builders intentionally mutate cooldown/refusal fields; NOTE_LATCH_FIELDS carries both through deferred/failed prompt builds. One refused reason is consumed once; repeated settled answers do not re-open a note. |
| Session | 100 settled repeat answers keep two identities and no new identity-merge archive entries. Existing tag/transaction diagnostics remain under their own caps; this is not a heap soak. |
| Campaign | Open questions cap at PROVISIONAL_CAP; excess titles fork loudly. Identity preimages accumulate per actual accepted merge and are intentionally retained. `provisionalNudged` and `mergeHintNudged` retain historical distinct-name/pair keys; fixed-input repetition does not grow them, but lifetime distinct collisions can. This existing O(history) residue is not falsely described as capped by current open questions. The review adds no persistent state. |
| Device | Saves/exports duplicate retained campaign history under existing storage lifetimes. No new storage key, background worker, wasm realm or device resource was created. No unrelated wasm/audio soak performed. |

## Remaining completion gate and proposed status

Proposed #530/#531 status: **◉ Objective verification passed on fa065e87/v1.1194: independent acceptance, attributed scratch sabotage, #504 section/battery, 16,000-sequence fuzzer and four replays. Entry 38’s independent objective review recorded here. Keep open with #504/#534 until the explicitly required live-GM answer to the delivered name-collision note is observed; no taste-only acceptance requested.**

The parent owns the final full `node dev/run-tests.js` gate, tracker/queue updates and shipping receipt. This reviewer did not run a live provider or inspect a user browser profile. A bounded setup check found no ANTHROPIC_API_KEY, GEMINI_API_KEY, GOOGLE_API_KEY or OPENAI_API_KEY in the process environment (presence booleans only), no `.Codex/launch.json` at the current project, and no listeners on the legacy preview/CDP candidate ports 8123/9222/9223 or 8000/8080. This does not prove that the owner has no credentials elsewhere. A fresh isolated browser has no configured provider credential, and the sanctioned dev_local account has no provider key supplied. The exact missing setup is an authenticated/configured **isolated local test preview with a usable provider**, not a production login. No old historical receipt was rewritten, no runtime fix was made, and no commit was created by this reviewer.


## Live-test safety boundary and ready next step

The repository [playtest skill](../../.agents/skills/playtest/SKILL.md) says: **“Never type or paste an API key. If `tnd_ak_v1` is unset, stop and ask the user to enter it in the visible preview themselves.”** The server README at `C:/Projects/traffic-and-dragons-server/README.md:34` says: **“Automated test sessions must NEVER touch the production account”**; its local-dev instructions use a dedicated test DB and `dev_local`. No production account/profile was queried or borrowed to remove this setup gap.

Once the isolated test preview has a provider configured by the owner, use the existing #504 audit §5 recipe: create a disposable campaign with Wilhelmina, stage Queen Underbough, confirm the actual NAME COLLISION note reached the model, let its next real response choose SAME/ANOTHER, inspect the returned tag and resulting distinct/merged records, and preserve the synthetic corpus before deleting that test campaign. The scripted acceptance cases here supply the engine oracle; they are not substituted for that real model response. No prose-style preference or taste judgment is needed.

## Senior adjudication of delegated #577 evidence

**#577 FAILS objective acceptance; leave it open.** Senior independently reran the delegated probe and reproduced **19 passed / 5 failed, exit 1**. Four failures belong to #577: in either insertion order, the ledger pays one exact offer but retires the first same-base offer instead; the paid offer remains and can pay its premium again. The fifth is the separate already-recorded #591 unrelated-coin retirement and stays with #591. This does not reopen the preference between refusing excess quantity and selling overflow at ordinary value: the selected paid offer simply must be the offer retired.

Spot-checked cause: helpers.js:3429 carries exact `r.want.key`; helpers.js:3443 spends allowance by that key; sale-line construction at 3444 drops it; game.js:391 calls retirement using only item name; memory.js:797–801 strips provenance and removes the first live base-name match. With plain Warded ring at 40 gp followed by silver at 60 gp, selling silver pays 60 gp and removes plain, then silver pays 60 gp again. Reversing insertion order reverses which unsold offer is lost. The original three-decorated-row allowance refusal still works; this distinct-offer bug lies at the subsequent identity handoff. No runtime fix or loosened assertion was made.

Senior raw reproduction is [senior-577-output.log](senior-577-output.log) with [structured results](senior-577-results.json). It ran 2026-10-09T05:28:49.468Z, 37 ms inside the probe. Parent persists the delegate’s original report/probe and owns the #577 tracker update. Exact-offer identity must survive pricing through accepted retirement before a future green acceptance can close this task.
