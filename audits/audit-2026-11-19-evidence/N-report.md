# Lane N — the gates (CI, hooks, harnesses, dev servers) — evidence report, HEAD d7ed4ea6

Probe scripts are in `audits/audit-2026-11-19-evidence/N\`. I modified nothing in the repo. I did not run run-tests.js, any battery, run-sabotage-diff or any browser suite.

## 1. Coverage

| File | Read | Notes |
|---|---|---|
| .github/workflows/engine-tests.yml, release-notes.yml, sabotage-weekly.yml, server-health.yml | all | |
| dev/pre-commit, dev/pre-push | all | the installed .git/hooks copies were confirmed byte-identical by check-hook-parity (run) |
| dev/run-tests.js | harness (2599–2681) in full; the contract preamble skimmed (grep of every exit/exitCode/catch arm and SKIPPED path) | engine-tests.js (3.5 MB) is not in this lane and was not read |
| dev/run-standalone-suites.js, run-browser-suites.js, sabotage.js, run-sabotage-diff.js, battery-pool.js, prove-before-push.js, check-sabotage-applicability.js, ci-range.js, ci-per-commit.js, ci-status.js, session-check.js, check-enforcement.js, class-guards.js, check-hook-parity.js, check-es5.js, check-doc-links.js, check-doc-facts.js, docs-only.js, lint-todo.js, check-todo-columns.js, engine-manifest.js, load-engine.js, storage-keys.js, static-server.js, bible-server.js, install-bible.js | all | battery-verdict.js and battery-targets.js were also read in full (both are used by the lane's runners) |
| Batteries (dev/sabotage-*.js, 456 files) | not read one by one | scanned by probes: return-code use, mustFail presence, `only:` suites, targets |

Ran: check-hook-parity, check-es5, check-doc-links (all green), and the probes listed below.

## 2. Findings

### F1. The CI range sweep never schedules 18 battery/target pairs (94 clauses) because battery-targets.js only recognises a wrapper named exactly `prove(`
- **Summary:** batteries that wrap `sabotage.prove` in a helper called `proveV`, `proveU`, `proveE`, `proveF` or something similar (or that put the target in a variable) are invisible to `run-sabotage-diff.js`. A push that changes their target files runs none of those clauses. Since the owner's 2026-11-18 ruling this sweep is the only proof each push gets.
- **Where:** dev/battery-targets.js `targetsOf`, the line `var wrapped = /(^|[^\w$.])prove\(\s*["']([^"']+)["']/g;` (and `keyed`, which needs a literal string). Consumers: dev/run-sabotage-diff.js line 22, and dev/prove-before-push.js `sweepSize`, which reports a matching undercount in its "left to CI" line.
- **Input:** an edit to memory.js. `sabotage-b38-extractor-refusal.js` holds 19 clauses on memory.js through `proveE("memory.js", …)` / `proveF(...)`, and none of them is due. Other examples: `sabotage-427-library-upstream.js` (`proveV`/`proveU`: game.js ×10, state.js, ui-browsers.js, ui-modals.js, ui-sheets.js), `sabotage-b39-resume-observed.js` (sound.js ×6, helpers.js ×4, tts.js, stt.js, ui-ambient.js, error-report.js), `sabotage-528-portrait-boundaries.js` (admission.js ×4, helpers.js ×3, state.js), `sabotage-bible-editor-remaining.js` (bible_editor.html ×27, `file: page`), `sabotage-bible-editor-toolbar.js` (4), `sabotage-story-compiler.js` (8).
- **Outcome:** these guards are proven only by the weekly job, which has a 180-minute timeout across 456 batteries. memory.js is on the drift surface.
- **Evidence:** REPRODUCED. `untargeted.js` collects each battery's real targets through check-sabotage-applicability's own stub collector and compares them with `targetsOf`. Output: `batteries 456; (battery, target) pairs invisible to the range sweep: 18 covering 94 clauses`, listed above.
- **Severity:** medium.
- **Remedy:** derive the targets from the same stub collector that check-sabotage-applicability uses (it records `opts.file` per prove call), not from source regexes.

### F2. mustFail attribution is vacuous wherever the guarded suite prints a test's name when the test PASSES
- **Summary:** sabotage.js attributes a red with `out.indexOf(c.mustFail) >= 0` over the whole output. 155 of the 215 test suites log `PASS <name>` (or `✓ <name>`), so a mustFail that is a bare test name is present whether that test passed or failed. Any unrelated red is then scored "caught", and MISATTRIBUTED can never fire.
- **Where:** dev/sabotage.js `prove`, the line `var attributed = !c.mustFail || out.indexOf(c.mustFail) >= 0;`.
- **Input:** `dev/sabotage-221-capability-names.js` has `mustFail:'usage includes class levels'`. `dev/tests-221-capability-names.js` prints `console.log('PASS #221 ' + name)` for that same test.
- **Outcome:** a mutation that breaks a different test in the suite is reported as proving this guard.
- **Evidence:** REPRODUCED, both the mechanism and a census. `no-baseline.js` runs a command that prints `PASS guarded rejects zero` and exits 1, with `mustFail:"guarded rejects zero"`. Result: `✓ caught … mustFail that appears on a PASSING line`, `prove() returned 0`. `mustfail-on-pass.js` found 671 of 3,353 mustFail strings verbatim in a pass-printing suite that the same battery names. This is a heuristic upper bound: it checks that the suite file is named in the battery, not which command each clause runs. Clauses that use a `FAIL …` prefix (the #684/#733 `only:` style) are safe and were excluded.
- **Severity:** medium (the gate proves less than it reports).
- **Remedy:** match mustFail only on failure lines. For example, require the matched line to start with `FAIL`, `✗` or `not ok`, or the suite's failure marker. Or have batteries pass the `FAIL ` prefix.

### F3. sabotage.js never runs the guarded command on the unmutated file, so a command that is red anyway proves every clause without mustFail
- **Summary:** there is no baseline run. If the command fails for a reason unrelated to the mutation, every clause that has no mustFail reads "caught". Examples of such reasons: a section already red at HEAD, an input the scratch clone lacks, or a timeout under pool load.
- **Where:** dev/sabotage.js `prove` (the loop at lines 221–280: write the mutation, run, then `verdict: failed ? … "caught"`). Neither battery-pool nor run-sabotage-diff checks a baseline.
- **Input:** 27 batteries declare clauses with no mustFail at all, about 150 clauses. Examples: sabotage-750-stake.js (15), 671-synopsis (13), 424-cloud-rewind (11), bibpick (8). Many of these run `run-tests.js <section>`, whose source-contract preamble runs before the filter and exits 1 on any contract break.
- **Specific risk:** the scratch clone mirrors only untracked files that are not ignored (`ls-files --others --exclude-standard`). A test that reads a gitignored input is red in the clone, so every clause without mustFail on it passes.
- **Evidence:** REPRODUCED. In `no-baseline.js`, a command that always exits 1 gives `✓ caught no mustFail: the guard is deleted`, `2/2 clauses proven`.
- **Severity:** medium.
- **Remedy:** run the command once on the clean clone before the first mutation of each group. A red baseline should make the group UNOBSERVED.

### F4. dev/static-server.js serves files outside the repo, listens on every network interface, and dies on a malformed URL
- **Summary:** the containment check is a string prefix, not a path boundary. `.listen(8123, cb)` passes no host argument, so the server binds `::`, which covers the LAN as well as loopback. Anyone on the same network can read the repo, including `.git` and the gitignored owner saves under `Campaigns/` and `testRuns/`. A path starting `/..%2f<repo-name>-…` also reaches sibling folders. Three such folders exist on this machine: `C:\Projects\traffic-and-dragons-server`, `-admin-console` and `-next-ten-ending`.
- **Where:** dev/static-server.js, the anonymous request handler: `var file = path.normalize(path.join(ROOT, p)); if (file.indexOf(ROOT) !== 0) …` and `}).listen(8123, function () {`. In the same handler, `decodeURIComponent(...)` throws URIError on `/%`, and nothing catches it, so the process exits.
- **Input:** `GET /..%2ftraffic-and-dragons-server%2f<file>`. A browser does not normalise `%2f`, and the handler decodes it after the fact.
- **Outcome:** a file outside ROOT is served with 200.
- **Evidence:** REPRODUCED. `static-prefix.js` copies the handler verbatim onto a scratch fixture. Output: `listen() with no host binds address "::"`, `GET /..%2frepo-server%2fsecret.txt -> 200 "OUTSIDE THE REPO"`, `GET /..%2f..%2frepo-other -> 403`. `decodeURIComponent('/%')` → `URIError: URI malformed` was confirmed in node.
- **Severity:** medium. The tool is dev-only, but it is the documented way to serve the game (CLAUDE.md, Dev workflow step 1), and it exposes saves and history to the LAN.
- **Remedy:** `listen(8123, "127.0.0.1")`. Use `path.relative(ROOT, file)`, and refuse anything that starts with `..` or is absolute. Wrap the decode in try/catch and answer 400.

### F5. install-bible.js cannot install an item bible: the item type falls into the capability branch and crashes
- **Summary:** the #72 overhaul added `item` to TYPES and to the content sniff. The structural check is `if (typeKey === "class") … else { Object.keys(ctx.CAPABILITY_BIBLE) … }`, so an item file reaches `Object.keys(undefined)`.
- **Where:** dev/install-bible.js, top-level validation, line 123: `var keys = Object.keys(ctx.CAPABILITY_BIBLE);`.
- **Input:** the real item_bible.js, run as `node dev/install-bible.js <copy> --dry-run`. The bible editor's item Save posts the same text to bible-server `/install` (bible_editor.html `serverSaveBible` → `srvInstall`).
- **Outcome:** `TypeError: Cannot convert undefined or null to object`, exit 1. Every item save from the editor is "REFUSED" with a stack trace. CLAUDE.md says install-bible "validates class/capability/item by content".
- **Evidence:** REPRODUCED. A dry run on a scratch copy printed `✓ parses, and defines ITEM_BIBLE`, then the TypeError at install-bible.js:123. dev/tests-install-bible.js has no item case (grep).
- **Severity:** medium (the dev workflow is broken; nothing is lost, because the refusal happens before any write).
- **Remedy:** add an `item` branch with its own structural check (entry count, key shape), and add an item case to tests-install-bible.js.

### F6. TODO_Atlas.md is outside every TODO gate in CI, and outside the shape, column, size and move checks everywhere
- **Summary:** CI's per-commit lint passes `--file` (a temp file), so `opts.file !== DEFAULT_FILE` and `_atlasTodoText` stays `""`. A TODO.md row that reuses an id from TODO_Atlas.md passes CI. Only the local hook (`--staged`) reads the atlas file, and only for the id pass. Nothing anywhere runs shapeErrors, rowSizeErrors, movedRowErrors or check-todo-columns on TODO_Atlas.md. archiveMoveErrors also takes TODO.md alone as the head, so a row moved from TODO_Atlas.md into the archive is never byte-checked.
- **Where:** dev/lint-todo.js `main`, lines 278–281 (`/* … a --file run (CI, fixtures) has none */`), `archiveMoveErrors(headText, …)`. dev/check-todo-columns.js reads `:TODO.md` only. In the workflow, the line-60 step passes no atlas argument.
- **Input:** a commit adding `| 775 | … |` to TODO.md (775 is TODO_Atlas.md's first row). Such a commit lands without the hook in three ways: a cloud session, `--no-verify`, or a QA-routine branch.
- **Evidence:** REPRODUCED. `atlas-dup.js` runs the exact CI argument shape and gets `exit 0 :: TODO.md tables OK`. The control, with two copies inside TODO.md, gets exit 1 with `row #775 is used 2 times`. A shape-broken copy of TODO_Atlas.md is checked by nothing the gates invoke. (check-todo-columns passes the live file only when given `--file` by hand.)
- **Severity:** low–medium (tracker integrity; CLAUDE.md does say "checks in the hook", but CI exists to cover a bypassed hook, per #G1).
- **Remedy:** add `--atlas-file {file:TODO_Atlas.md}` / `--head-atlas {parentFile:…}` to lint-todo and the CI step. Run the shape, column and move passes over the atlas file as well.

### F7. ci-status.js reports GREEN when the newest runs timed out or failed to start
- **Summary:** `summarize` keeps only `success` and `failure`. `timed_out`, `startup_failure` and `cancelled` are skipped, so an older green becomes "the" verdict. The Engine tests job sets no `timeout-minutes`, so a hung browser suite runs to GitHub's 6-hour cap and ends `timed_out`.
- **Where:** dev/ci-status.js `summarize`: `var done = runs.filter(function (r) { return r && (r.conclusion === "success" || r.conclusion === "failure"); });`.
- **Input:** a run list of `[timed_out, startup_failure, success]`.
- **Outcome:** `green — CI GREEN — Engine tests passed on master at aaaaaaaa`. session-check relays this as healthy, which is the blind-gate failure #646 was written to end.
- **Evidence:** REPRODUCED (`ci-timeout.js`). `grep timeout .github/workflows/engine-tests.yml` finds no match.
- **Severity:** medium–low.
- **Remedy:** treat any conclusion other than success, skipped or neutral (in particular `timed_out`, `startup_failure`, `action_required`) as red, or at least as unknown. Add `timeout-minutes` to the job.

### F8. The CI range after a force-push to master probably shrinks to HEAD~1
- **Summary:** ci-range.js uses event.before only when the commit can be resolved (`commitOf(git, p.before)`). After a force-push the old tip is no longer referenced by any branch, and `actions/checkout` with `fetch-depth: 0` fetches refs only. The old tip is therefore absent, and the ladder falls to `merge-base(origin/master, HEAD)`. On a push to master, origin/master is HEAD, so that rung is "unusable" and the ladder lands on HEAD~1. Every rewritten commit except the last then skips the per-commit version-bump, TODO-lint and identity checks, and the sabotage sweep covers only the last commit's files.
- **Also:** ci-per-commit uses `rev-list --no-merges`, so conflict resolutions inside a merge commit are never version- or lint-checked.
- **Where:** dev/ci-range.js `ciBase`. The header comment says "(a force push is fine)".
- **Evidence:** SUSPECTED. This rests on checkout's fetch behaviour, which I did not run. It would be settled by a CI log line `CI range: … — HEAD~1` on a force-push run, or by a fixture in which the before commit is absent from the clone. tests-481-g2-ci-range.js builds fixtures locally, where the old commit still exists.
- **Severity:** low–medium.
- **Remedy:** when before cannot be resolved on a push, fetch it explicitly (`git fetch origin <before>`). If that fails, fail loudly instead of falling to HEAD~1.

### F9. run-sabotage-diff.js exits green when it cannot read its range
- **Summary:** `if(diff.status!==0){console.log("… no diff available … — nothing to run");process.exit(0);}`. The sibling tools refuse the same condition: ci-per-commit exits 1, and prove-before-push exits 2 with "never a green over nothing". This is now the only per-push run of the sweep.
- **Where:** dev/run-sabotage-diff.js line 13.
- **Input:** a malformed or unreachable `$CI_RANGE`.
- **Outcome:** the step is green with zero batteries run. An empty CI_RANGE is a separate case: it falls back to `HEAD~1..HEAD`, by the `||` on line 11.
- **Evidence:** READ. I did not run it; the brief forbids run-sabotage-diff.
- **Severity:** low.
- **Remedy:** exit 1 (or 2) on an unreadable range, matching ci-per-commit.

### F10. The pre-commit gate tests the working tree, not the commit
- **Summary:** run-tests.js, check-es5 and the contracts read files from disk (`fs.readFileSync(path.join(ROOT, …))`). Only lint-todo, check-todo-columns and check-shell-markers read the index. The project shares one working tree across sessions, and its memory rule is `git commit --only -- <paths>`. Under those conditions the bytes tested routinely differ from the bytes committed.
- **Input:** stage game.js version A (broken). Another session's unstaged fix B is on disk, or an unstaged helper that A needs exists only on disk.
- **Outcome:** the suite is green on B, the commit lands A, and CI goes red after the push.
- **Where:** dev/pre-commit lines 34 and 56. dev/docs-only.js judges the staged set, which is correct, but the suite it gates does not.
- **Evidence:** READ.
- **Severity:** low (CI catches it after the push).
- **Remedy:** run the suite in a `git worktree`/`checkout-index` export of the index, or at minimum fail when a staged path differs from its working copy (`git diff --name-only` ∩ staged).

### F11. bible-server.js: any website can read `/health` and the worksheet stores, and can crash the server
- **Summary:**
  - **Reads:** the CORS header is `Access-Control-Allow-Origin: *` on every JSON reply. Any page can GET `/health` (which carries `root: C:\Projects\traffic-and-dragons`, including the Windows user name, and the pid), `/bible` and the worksheet GETs (capability-names, review and redraft contents).
  - **Crash:** `serveEditorAsset` calls `decodeURIComponent` unguarded, so `<img src="http://127.0.0.1:7373/%">` from any page kills the server.
  - **Upload race:** `/install` stages every upload at one fixed path, `os.tmpdir()/capability_bible_upload.js`. Two concurrent saves race, and the first install can validate and write the second's body.
  - **Writes are guarded:** a missing or `null` Origin, or a foreign one, needs the token. DNS rebinding yields a foreign Origin. See Affirmed.
- **Where:** dev/bible-server.js `CORS`, the `/health` branch, `serveEditorAsset`, and the `/install` handler `var tmp = path.join(os.tmpdir(), "capability_bible_upload.js")`.
- **Evidence:** READ. URIError on `decodeURIComponent('/%')` confirmed in node. The server has no uncaughtException handler (grep).
- **Severity:** low.
- **Remedy:** reflect only local origins in CORS, try/catch the decode, and give each upload a unique temp name (mkdtemp).

### F12. The storage-key census misses keys used only in satellite pages, while CLAUDE.md calls it "the full list"
- **Summary:** storage-keys.js scans `^(?:website\/)?[^/]+\.js$` only. Ten `tnd_…_v1` keys live only in root HTML inline scripts and are absent from DOC/contracts/sync.md: `tnd_bible_editor_draft_v1`, `tnd_bible_fs_v1`, `tnd_bugfeed_secret_v1` (bug_tracker, a secret stored per device), `tnd_capability_names_v1`, `tnd_ce_draft_v1`, `tnd_grow_log_v1`, `tnd_soak_crumb_v1`, `tnd_speaker_gender_overrides_v1`, `tnd_voicelab_v1`, `tnd_voicepick_v1`.
- **Where:** dev/storage-keys.js `census`. CLAUDE.md Conventions says "The full list is generated into sync.md by dev/storage-keys.js". (sync.md's own heading says "in the root .js files", which is accurate.)
- **Evidence:** REPRODUCED by grepping the tracked root *.html for `tnd_` literals and checking each against sync.md.
- **Severity:** low (contract drift).
- **Remedy:** include the inline scripts of the root *.html pages in the census (class-guards.js `scriptText` already extracts them).

## 3. Monotonic resources

| Resource | Scope | Bound | Enforced? |
|---|---|---|---|
| sabotage.js `process.on("exit"/"SIGINT"/"uncaughtException")` listeners, 3 per `prove()` call, never removed; each closure retains the target's original Buffer | per battery process | number of prove groups × target size (sabotage-w2 has dozens of groups and game.js-sized targets); Node prints MaxListenersExceededWarning beyond 10 | no (the process ends) |
| `sabotage-rescue-<basename>-<length>` in os.tmpdir() | per run; left behind on a crash, per device | one per (basename, length). Under battery-pool, TEMP is a per-battery dir that is removed. A direct run leaves one per crash, and two concurrent direct runs on the same file share one name (one deletes it while the other relies on it) | partially |
| Scratch clone `tnd-sabotage-proof-*` | per battery | 1; removed on exit, and a failed rmSync is said | yes |
| battery-pool `tnd-battery-*` temp dirs, ci-per-commit `tnd-per-commit-*` | per battery / per run | removed in finish/finally; a failure is said | yes |
| battery-pool, run-browser-suites, run-standalone-suites output chunk arrays | per child process | the child's whole output, held until exit (an unbounded log stays in memory) | no cap |
| check-doc-links `_anchorCache` | per process | number of linked docs | yes (process ends) |
| bible-server `worksheetStores` | per server process | 3 fixed keys | yes |
| bible-server request body strings | per request | 5e6 chars (/install) and 1 MB (worksheets) | yes |
| bible-server upload temp file | per device | 1 fixed file, overwritten | yes (but races, F11) |
| install-bible | per run | writes no backups | yes |
| Installed .git/hooks copies | per clone, forever | 2 files, checked by parity | yes |

No unbounded accumulation in this lane beyond the listener and buffer growth per battery process, which ends with the process.

## 4. Affirmed (tried to break, could not)
1. **check-sabotage-applicability, regex finds:** of 5,090 clauses, 21 use a RegExp find and none of those matches more than one site (`regex-ambiguity.js`), so the ambiguity check's exemption of RegExp finds hides nothing today.
2. **Orphan suites:** every one of the 215 dev/tests-*.js files is run by some gate: the standalone list (173), the derived browser list (41, each a CI step), or the workflow (`orphan-suites.js`: 0 orphans).
3. **Browser-suite derivation:** the only tests-*.js that mention cdp-browser without a real `require('./cdp-browser.js')` are four meta tests that build the string on purpose (tests-252, 481-g6, 652, verification-enforcement).
4. **Engine manifest vs index.html:** the 54 shared files appear in the same order. The 21 files the game loads but the engine never does are exactly the documented DOM-wiring set (`manifest-diff.js`).
5. **`only:` with a name that matches nothing:** suites without a "matched 0" line (tests-733-map-exits, -extract, -source) throw `No matching … test`. The output then lacks the `FAIL #733 …` mustFail, so the verdict is MISATTRIBUTED (loud), never caught.
6. **docs-only.js:**
   - Refused, so the full suite runs: deletions (D), renames (R; the tool uses `--no-renames`), DOC/contracts/, TODO_Atlas.md, dev/*.md, and DOC/beta-guide.html (named in run-tests).
   - Skipped, correctly: a path with spaces (`-z` handles it).
   - The case variant `DOC/Contracts/tags.md` was refused only because the base name occurs in tests-docs-only.js. On Windows, git's ignorecase keeps the index's casing, so I found no realistic path to stage that variant.
7. **Inline classic scripts in the 25 root .html pages:** 0 ES5 violations under check-es5's own lexer (`es5-html.js`), even though no gate scans them.
8. **Dropped return codes:** a heuristic scan found no battery whose prove() return code fails to reach its exit status (`dropped-rc.js`: 0 of 456). Note that battery-verdict's MISFIRE regex does not match MISSED, NOT APPLIED or UNOBSERVED, so this rests entirely on each battery's exit code.
9. **bible-server write guard:** `Origin: null` and foreign origins (including a DNS-rebound one) need the per-run token. The token never appears in a response.

## 5. Undetermined
- **F8:** whether CI really computes HEAD~1 after a force-push. It needs a CI log or a fixture without the before commit.
- **Weekly job:** whether sabotage-weekly finishes 456 batteries inside `timeout-minutes: 180`. A timeout there ends `timed_out`, which is not "failure" and may go unnoticed.
- **Ignored inputs (F3):** whether any guarded test reads a gitignored input (Campaigns/, testRuns/, renders/). If one does, its clauses without mustFail are proven vacuously in the scratch clone.
- **Side effects of the "dry" scan:** check-sabotage-applicability requires every battery file. At least one battery runs a #733 suite at require time (the probe printed `ALL GREEN — 3 historical/private-boundary checks`), so the dry scan executes test code. I did not find which battery.
- **Pre-push ref handling:** the pre-push hook ignores the refs git hands it on stdin and always proves `origin/master..HEAD` from the working tree. Pushing a branch other than HEAD, or deleting a remote branch, proves the wrong set or runs needlessly. I did not exercise this.
- **Inaccurate comment in docs-only.js:** the comment "a page cannot read the repository's documents" is wrong, because bug_tracker.html fetches DOC/BUGS.md and DOC/QA_ACTIVITY.md. Both are named in dev scripts, so the tool's verdict is still right today.
- **todo-viewer.html:** it opens any file through its picker, and nothing hard-codes TODO.md, so TODO_Atlas.md can be opened by hand. I found no defect, only that the viewer's labels say "TODO.md".
