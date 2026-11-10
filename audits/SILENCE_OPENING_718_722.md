# Silence opening disclosure boundaries — #718–722

Owner request, 2026-11-10. Baseline engine b8123445 / v1.1387; diagnosis anchors verified against that checkout. No paid model calls. TnD_Maps was not touched. The pre-existing untracked website illustration is outside this work.

## Diagnosis and critical pre-review

The original `ui-mobile.js` card copied notes verbatim. `api.js` injected every bestiary entry into its cached half and urged the GM to use them. `memory.js` already gated NPC secrets by exact act status; creatures had no equivalent. Rule 26 expressly blessed narrating true nature, and the skeleton fence omitted narration. `memoryTOC` treated every unvisited blueprint node as known. The blueprint offered no honest opening patrol combatant and exposed its disguised Raider from the start.

Independent Astra review examined cache ownership, canonical combat identity, schema producer/consumer paths, aliases, node provenance and transcript branches before implementation. No new retained collections are needed. A creature gate reads only its target act status; a public combat label never renames parser identity or implies an unmasking. Existing fields settle the schema: `desc`, `displayName`, `revealAct`, with existing `notes` remaining private.

Owner ruling: fix 4 applies **only to new campaigns**. No legacy location migration is authorized. Public labels remain the label throughout an encounter, even after the fiction exposes its nature; there is no new automatic rename/reveal lifecycle.

## Verification record

- #718 / v1.1388: the real renderer test and actual browser card failed first on GM notes. Removing the row passed both. Restoring it in the sabotage scratch clone failed the named test; original bytes restored. Full gate: 3,201 engine assertions plus 134 standalone suites. Browser gate: 27 suites passed. The first push encountered only a release-ledger commit; it was integrated without overwriting it.
- #719 / v1.1389, Designer v0.63: engine tests failed first on the withheld gate, numeric normalization, public labels, core-memory leakage and alias collisions; card and designer tests failed first too. Independent review added explicit victory/unknown-outcome closure, armored refusal and generated out-of-range gate tests; the browser found a raw name in the multi-foe statistics header. These failures were corrected at their presentation/admission boundaries. Canonical tag operands, armor state and slain identity remain intact. Fifteen named sabotage mutations cover the gate, completion, ordinary-turn cache stability, invalid gates, appearance, identity routing, ambiguity, close/refusal text, private card classification and generator admission.

No frozen hash was re-baselined. No existing assertion was loosened. Existing sabotage anchors in #508, #612, #718 and W2 were retargeted to equivalent refactored code; their failures and test names remain intact.

## Real-save captures

Local evidence is in `testRuns/silence-opening/` (ignored personal artifacts). `original-t7.tnd` is an untouched backup. `dev/capture-prompt.js` captured the real supplied save before code changes and after #719:

| Half | Before chars / SHA-256 prefix | After #719 | Explanation |
|---|---|---|---|
| Stable | 58,894 / `9cbd041167fa` | Identical | Legacy bestiary has none of the optional fields. |
| Volatile | 26,648 / `0dec5be9a74a` | Identical | No historical save rewrite. |

The original opening was reconstructed separately from the same hero and authored v1.0 blueprint with a fresh world/memory, turn 0 and start-place stamp. It is not a claim to recover lost initial hero statistics. Captures omit device-local customRules, as the stock capture tool does; the actual-blueprint engine test must separately apply the blueprint to include all nineteen rules.

Comparison captures also exist for Runelords t2477, Iron Meridian t207, Princess t89 and Village t291. All changed prompt hunks will be accounted for below when the remaining prompt changes are applied.

- #720 / v1.1390: failure-first assertions cover Rule 26, the conflicting first-sight kind instruction, the skeleton narration fence and the retained hero-stake exception. Two deliberate reversions fail their named guards. Intentional prompt changes: two stable rules (apparent-kind qualifier and perception boundary), and one volatile skeleton sentence (narration added). No hashes or existing assertions changed.

- #721 / v1.1391: only newly created blueprint world nodes carry `blueprintSeeded`; no load migration. Seven failure-first guards and eight deliberate regressions cover turn 0, visible GM narration, hidden tags/player guesses, retcons/dead branches/rewinds, exact aliases and merge/split provenance. Existing saves remain byte-identical to #720. The P9 fixture now explicitly narrates Omu before expecting it under KNOWN OF; its assertions are retained. The #464 sabotage anchor was retargeted to the new branch with the same intended failure and assertion. No frozen hash changed. This commit also restores UTF-8 metadata in this audit and release-next.json after the preceding edit used the Windows default encoding.

## Final capture hunk accounting

Captured with stock `dev/capture-prompt.js`, using the untouched supplied t7 save:

| Half | Before | After v1.1392 | Every changed hunk |
|---|---|---|---|
| Stable | 58,894 chars / `9cbd041167fa` | 58,963 / `4eaa1d72b0ae` | Line 5: first-sight kind becomes apparent kind, with the disguise qualifier. Line 27: Rule 26 requires perceptible appearance until a story reveal. Both #720. |
| Volatile | 26,648 / `0dec5be9a74a` | 26,659 / `4a3212fda7c2` | Line 38: narration joins the skeleton secrecy fence (#720). |

No other t7 hunk changed. #718 is UI only. #719 preserves the saved legacy creature format. #721 deliberately does not migrate existing nodes. #722 changes the blueprint used for future campaign creation, not the blueprint already copied into the save.

The reconstructed fresh opening has six hunks: stable lines 5 and 27 are the same rules; stable line 42 is the bestiary, adding the two genuine patrols, splitting the Stalker's appearance/GM truth and omitting the gated Raider/Sentry. Volatile line 33 adds the fence; line 52 names the genuine patrol combatants in the opening directive while retaining both routes and noncombat choices; line 65 removes the never-named KNOWN OF list. No other hunk changed. Its final hashes are stable `e354973ffe78`, volatile `ca2a7fac74a7`. The live-schema integration test separately includes all nineteen blueprint rules; the stock capture omits device-local rules.

Four other real saves have exactly the same two stable rule changes, verified by comparing every removed/added line against the t7 diff. Runelords t2477, Iron Meridian t207 and Princess t89 also have exactly the narration-fence change. Village t291 has no skeleton fence and its volatile half is byte-identical (`7d9d2f4b9dae`). Their existing KNOWN OF lists are unchanged. All local full diffs and digest records are under `testRuns/silence-opening/`.

## Blueprint edition and restart behavior

The sample and live catalog baseline were content-identical at v1.0, revision 3. Edition v1.01 remains Release Candidate, with the same catalog ID, blank byline, blurb and ordering. Two genuine patrol records support either opening route. Raider availability starts in Act II with public label `Reed-cloaked Raider`; the royal-cell Sentry starts in Act III. The Stalker remains available in Act I, retaining its visible iron clue and private origin. No authored shortcuts, player choices, or other story rules were removed.

Nine actual-blueprint checks cover all nineteen rules, the turn-0/Act-II/Act-III boundaries, stable bytes across ordinary turns and completion, both honest patrols, Stalker privacy, actual enemy cards, new-campaign KNOWN OF, authoring text limits and edition/catalog identity. Six failed first on the old blueprint. Five deliberate blueprint regressions each fail their named test and restore byte-identically. Phone-width card screenshot inspected: only public name/appearance and live combat facts, no goblin classification or notes.

Existing campaigns receive the card and narration corrections after reloading the published app. Optional creature fields work wherever already present, but saved bestiaries are not replaced by later catalog editions. By owner request, location provenance is not retrofitted. A new campaign from v1.01 is required to receive this blueprint's patrols/gates and the new KNOWN OF behavior; the existing t7 transcript's disclosed plot cannot be undone by these fixes. No paid model playtest was run, so actual future model compliance has not been measured.

Independent final Astra review: no semantic blockers, independently executed the nine blueprint checks successfully. The public catalog update is prepared in local `catalog-publication.json`; its revision must be freshly checked at publication. App code publication and live catalog publication are separate operations.

## Publication receipt — 2026-11-10

The five fix commits are `92157921`, `bf8aefa8`, `3814bed2`, `e61f7735` and `57cf0e06`. App v1.1392 and the static blueprint v1.01 are deployed. All fourteen changed runtime/blueprint files served by Cloudflare match their committed Git blobs byte-for-byte. The initial comparison to the Windows working copy flagged `sw.js`; that difference was solely CRLF line endings, not deployed content.

Final full gate: 3,220 engine assertions, 135 standalone suites and 27 browser suites passed. All 268 required mutation batteries passed (267 in the range sweep plus the separately proven #722 battery). `sabotage-221-cambion.js` initially reported "failed beside other batteries" and passed its isolated retry; its ordinary browser suite also passed. No skips. The recorded v1276 playtest replay produced zero handler errors and exactly matched its committed end state. [CI for the five-fix push succeeded](https://github.com/pmegow/traffic-and-dragons/actions/runs/42872252896).

After the owner's explicit app-session-access approval, the existing application session was verified as an administrator and the unchanged reviewed payload was submitted through the normal `POST /api/admin/catalog` route with expected revision 3. No session was forged, printed, exported or retained. The public catalog now returns **The Silence Between Leaves v1.01 Release Candidate, revision 4**. Readback matches the committed sample exactly. The stable ID, blank author, blurb and ordering are unchanged; every other catalog entry is byte-equivalent as parsed JSON. Public before/after receipts remain in the ignored local evidence folder. The earlier pending-publication entries above describe the state before this receipt.

Publication is complete. The restart guidance above still applies: existing campaigns receive engine/card/narration fixes, but only a new campaign from v1.01 receives this edition's encounter roster/gates and the new location-knowledge behavior. No paid model playtest was run.
