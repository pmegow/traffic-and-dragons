# Lane M report — satellite HTML pages + designer/admin helpers (HEAD d7ed4ea6)

## 1. Coverage

Read in full, line by line:
- blueprint-designer.html (all 1807 lines), blueprint-designer-drafts.js, blueprint-designer-autosave.js, designer-acts.js, designer-assistant.js, designer-assistant-ui.js, designer-creatures.js, designer-menu.js, designer-portrait-batch.js, designer-prose.js
- admin_console.html, admin-invitations.js, admin-mail.js, admin-release-notes.js
- signup.html, mementos.html, home.html, bug_tracker.html, story_compiler.html
- character_editor.html lines 60–386 (lines 1–59 are the head and CSS only; I did not read them)
- invitation.html and invitation.js (a tracked root page the prompt did not list)
- DOC/contracts/satellites.md

Read in part, then swept:
- map_viewer.html lines 130–509: the loader, the graph, every render and panel sink, and the export
- map_cleanup.html lines 84–191: the whole script
- faq.html lines 148–169: the whole script
- author_voice_lab.html lines 300–499: the UI, the transport and the row renderer
- piper-host.html lines 20–161: the RPC and postMessage protocol

Covered only by sink sweeps (innerHTML, insertAdjacentHTML, document.write, eval, new Function, postMessage/message, location, createObjectURL, and value='…'/title='…' attribute building), plus reading the code around each hit:
- speaker_browser.html: every innerHTML write only clears a node; I read the audition fetch, the token and server URL helpers, and object-URL revocation
- bible_editor.html: its esc wraps escHtml, which escapes `'`; `new Function` runs the bible source file the developer opens, which is the design
- todo-viewer.html: one innerHTML sink, fed by TODO.md from the repo; escaping not audited
- capability-names.html, bible_study.html, voice_picker.html, test.html: the document.write script loaders, and innerHTML over static data
- piper_test.html: no innerHTML sinks found

Not read: blueprint-edition.js and library-slug.js (not opened at all; other lanes or their pinned tests cover them); website/game-theme.js; storage-adapter.js internals beyond `authHeader`.

Probes written (all under `audits/audit-2026-11-19-evidence/M\`): `probe-ce-attr.js`, `probe-null-entry.js`, `probe-cleanup-migrate.js`, `probe-patch-proto.js`.

## 2. Findings

### F1. A `'` in a character's text breaks out of character_editor.html's attributes and lets a loaded .char run script (HIGH)
- **What.** The editor's own `esc()` escapes `& < > "` but not `'`. Every input is built with single-quoted attributes, and skill values are inserted with no escaping at all. A crafted .char file, library entry or draft can therefore add event-handler attributes. The page runs on the game's origin, where localStorage holds the API keys and the session token. A harmless apostrophe ("O'Brien") cuts the displayed value to "O".
- **Where.** character_editor.html:
  - `esc` at line 112: `function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;")…replace(/"/g,"&quot;");}`
  - `fieldHtml` line 212: `value='"+esc(v)+"'`
  - lines 208 and 211: select option values and number fields, the same way
  - `listHtml` line 250: `title='"+esc(warn)+"' … value='"+esc(v)+"'`
  - `skillsHtml` line 256: `value='"+n+"'` with `n=ch.skills[s.id]` raw. `healChar` only fills null skills (line 141), so a string survives.
- **Input.** A .char whose `name` is `Tsuto' autofocus onfocus='alert(document.domain)`, or whose `skills.<id>` is `0' autofocus onfocus='alert(1)`.
- **Status: REPRODUCED.** `probe-ce-attr.js` lifts the page's `esc()` verbatim. Output:
  - `<input type='text' id='f-name' data-k='name' value='Tsuto' autofocus onfocus='alert(document.domain)'/>`
  - `<input type='number' min='0' data-skill='x' value='0' autofocus onfocus='alert(1)'/>`
  - `<input type='text' value='O'Brien'/>`
  - Not run in a browser.
- **Refutation tried.** `loadObject` → `healChar` does not touch name or skills strings. No test in dev/tests-437/481-f10/545/221 uses an apostrophe.
- **Remedy.** Use helpers.js `escHtml`, which escapes `'`, as the blueprint designer already does (its comment at line 259 records the same bug fixed there in 2026-07). Escape `n` and `v` in the skills and stats rows too.

### F2. Designer Generate replaces the working copy even after the author dismissed the modal and kept editing (MEDIUM-HIGH, data loss)
- **What.** The Generate handler awaits `generateBlueprintDraft` (about a minute) and then does `bp=normalizeBlueprint(draft…); markDirty(); render();`. It has no `bp!==target` or content-stamp guard. The modal closes on any click outside it (`wrap.addEventListener("click",…closeGenerate)`). The unsaved-changes confirm runs only once, before the await. Edits made after closing the modal are therefore overwritten, and `markDirty` → `saveDraft` writes the generated draft over the IndexedDB working copy.
- **Where.** blueprint-designer.html, `openGenerate`, lines 1215 and 1217–1246.
- **Contrast.** Every sibling model path guards staleness: `genCreatureBatch` (line 1098), `generateDesignerPortrait` (line 1180), `fitDesignerText` (`current()`, line 875), and `DesignerAssistant.current` (line 120).
- **Sequence.** Clean draft → Generate → click the backdrop → edit fields for 30 s → generation returns → the edits are gone, from memory and from the durable draft. A second Generate opened meanwhile also races the first; the last to finish wins.
- **Status: READ.** Not run in a browser. dev/ has no test of this path; tests-481-g5-waits-browser.js only checks the ticker.
- **Remedy.** Capture `target=bp` and a content stamp before the await. Refuse to install the result (say so on the status line) if either changed or the modal was closed, or cancel the job when the modal closes.

### F3. A .blueprint with a null entry half-loads: the status says "Failed to read file", but the working copy is already replaced and is persisted on the next keystroke (MEDIUM)
- **What.** `loadBlueprintObject` assigns `bp=normalizeBlueprint(obj)` first, then runs the review fix-up, `validateBlueprint` and `collapseAll`. Any of those can throw on an array entry that `normalizeBlueprint` lets through: `acts:[null]`, `npcs:[null]`, or `review.findings:[null]`. The FileReader catch (line 823) reports failure, but `bp` now holds the broken file while the screen still shows the old blueprint. The next `input` event goes onField → markDirty → saveDraft and writes the broken object over the IndexedDB draft. On reload the draft no longer opens (render throws), and the earlier content survives only on screen. The library Open path (line 1717) calls the same function.
- **Where.** blueprint-designer.html:
  - `loadBlueprintObject`, lines 801–808
  - `collapseAll`, line 253: `bp.npcs[i]._c=1`
  - line 804: `f.fixes` read on a null finding
- **Status: REPRODUCED for the engine half.** `probe-null-entry.js` output:
  - `acts:[null] normalize -> "ok"`, then `validate THROWS Cannot read properties of null (reading 'title')`
  - `npcs:[null] normalize -> "ok"`, `validate -> null`; collapseAll would then throw on line 253
  - `review.findings:[null] normalize -> "ok"`
  - Page behaviour after the throw is READ (not run in a browser).
- **Mitigation.** The Load button asks "Discard unsaved changes?" when the draft is dirty. Even so, the author is told the load failed and keeps editing a form whose model is now the other file.
- **Remedy.** Build and validate into a local variable; assign `bp`/`editionBaseline` only after `collapseAll` and `validate` succeed. Alternatively, keep the old `bp` and restore it in the catch.

### F4. Review results and Apply patches land on whatever blueprint is open when the model answers (MEDIUM-LOW)
- **What.** Neither the Review handler (`bp.review={findings:…}`, line 1355, after `await Promise.all`) nor `applyFinding` (applyPatches onto `bp` after `await callGM`, lines 1483–1489) checks that `bp` is still the blueprint the request was built from. Only the Review button is disabled; New, Load and Library stay usable. If the author opens blueprint B during a Review of A, A's findings are written into B and saved. If B has a review with the same index, an Apply of A's finding can add A's NPCs to B and mark B's finding applied. Without a review on B, the TypeError at line 1494 rolls the change back, with a misleading error message.
- **Status: READ.**
- **Remedy.** Use the same `target`/stamp guard as `genCreatureBatch`.

### F5. map_viewer.html writes an imported save's `visits` value into innerHTML unescaped (LOW-MEDIUM, security)
- **What.** `buildGraph` copies `visits:src.visits||0` straight from the file. `nodeRecordHTML` prints `(n.visits||0)+' visit'` into the panel's innerHTML (line 374). `nodeSVG` prints it into the SVG `<title>` (line 348). Every other field there goes through `esc`.
- **Input.** A .tnd with `memory.map.nodes["X"].visits = "<img src=x onerror=alert(1)>"`. Clicking node X runs the handler on the game's origin.
- **Status: READ.**
- **Remedy.** `Number(src.visits)||0` at the boundary.

### F6. Story Compiler: loading a save while a compile is running kills Compile until reload, with nothing shown (LOW)
- **What.** `compileUI` slices with `setTimeout` and reads the global `MODEL`. `normalize()` (file pick, drag and drop, Load live) sets `MODEL=null` and re-enables Compile. The pending `slice()` then calls `buildDoc(MODEL,…)` → `model.title` TypeError inside a timer, so `BUSY` stays true. Every later Compile click returns at `if(!CUR||BUSY)return;` with nothing said.
- **Where.** story_compiler.html: `compileUI` lines 606–635; `normalize` line 213.
- **Status: READ.** Needs more than 8 chapters, so that there is a second slice.
- **Remedy.** Capture the model in the closure, or have `normalize` bump a generation the slices check.

### F7. Character editor: draft saves fail silently, and a draft from a newer build leaves the page with no sheet behind working buttons (LOW)
- **Silent draft failure.** `saveDraft` (line 360) is `try{localStorage.setItem(…)}catch(e){}`. A full quota (a 400×600 portrait plus the game's stores) loses the draft with no message. Project policy is "no silent failures".
- **No sheet after a refused draft.** At boot (lines 372–374), when `charFileVersionIssue` refuses the draft, `ch` stays null and `render()` never runs. Save, Save to library and validate then throw `Cannot read properties of null` from their click handlers, with nothing shown on the page.
- **Status: READ.**
- **Remedy.** Report the setItem failure on the status line. Start a blank sheet (draft kept) when the draft is refused.

### F8. author_voice_lab.html's model wait never counts seconds (LOW, contract drift)
- **What.** The satellites contract says "Every model or image wait's status counts seconds (#356), on any page." The lab's `run()` paints `"calling "+model+" …"` and waits on a raw `fetch` (`realTransport`, line 349). The dev/class-guards.js derivation looks only for callGM, falFetch and falQueueRender, so this frozen wait is not caught.
- **Where.** author_voice_lab.html, line 386.
- **Status: READ.**
- **Remedy.** Use `elapsedTicker` (helpers.js is it loaded here? If not, a local counter), or widen the guard to raw fetches of provider endpoints.

### F9. The designer's review-apply merge resolves section names through inherited properties; its sibling, the assistant merge, does not (LOW)
- **What.** `applyPatches` tests `_PATCH_BYNAME[sec]`, `_PATCH_TOP[sec]` and `_PATCH_PRESERVE[sec]` on plain objects. A model patch with `section:"constructor"` is treated as a named list and writes an own `constructor` array into the blueprint, which `fileOut` then ships. `section:"__proto__"` and `"toString"` throw (a rollback, with a confusing reason). designer-assistant.js uses `owns(named,sec)` for the same decision, so the two merges disagree.
- **Status: REPRODUCED.** `probe-patch-proto.js` output:
  - `constructor labels: ["constructor: Ghost (new)"] | JSON out keys: name,acts,npcs,locations,creatures,rules,constructor`
  - `__proto__ … THROWS _PATCH_PRESERVE[sec] is not a function`
  - `toString … THROWS toString patch missing a name`
- **Remedy.** Use `Object.prototype.hasOwnProperty.call` on the three tables.

### F10. character_editor.html calls `relationshipMigrateSheet` behind a `typeof` guard, but identity.js is not loaded, so the migration never runs (LOW, misleading dead code)
- **What.** `healChar` line 153: `if(typeof relationshipMigrateSheet==="function")relationshipMigrateSheet(…)`. The function is defined only in identity.js:688, which the page does not load. The next line's comment says identity.js is absent, for coinHeal. A legacy .char therefore edits and re-saves with unmigrated relationships, and nothing says so.
- **Status: READ.** The game's own import probably migrates on admission; not verified.
- **Remedy.** Load identity.js, or delete the call and document that the game migrates.

### F11. home.html says "Signed in." when the account check fails, and shows no error (LOW, silent failure)
- **Where.** `renderWho` line 177: `storageAdapter.fetchAccount(function(err,a){if(err||!a)return;…})`. A failed or expired session leaves "Signed in." on screen, with no console line.
- **Status: READ.**
- **Remedy.** Paint the error, as the library path already does.

### F12. bug_tracker.html sends the feed secret in the URL query (LOW)
- **Where.** `loadFeed` line 341: `fetch(FEED_URL+"?s="+encodeURIComponent(sec))`.
- **Effect.** The secret lands in URL logs on Google's side and in any intercepting proxy or extension. It is the operator's own feed secret, not the game session token. A GAS `doGet` can only read query parameters, so moving it means a `doPost` with the secret in the body.
- **Status: READ.**

## 3. Monotonic resources

| Resource | Scope | Bound | Enforced? |
|---|---|---|---|
| Designer `bp` portraits (base64 JPEG data URLs, `portrait` and `altPortrait` per NPC or creature) | per session, carried in the draft | entry count × about 50–150 KB; no cap on entries | No cap. Each autosave deep-clones the whole bp twice (writer `JSON.parse(JSON.stringify())` and the IDB structured clone), debounced 400 ms. A CPU and transient-memory cost per edit, not growth. |
| IndexedDB `bpd_drafts_v1`: current, legacy and recovery keys | per device, forever | 3 keys | Yes, by design (a recovery slot is never overwritten; removing it needs confirmation) |
| `creaturePortraitJobs` array | per session | concurrent portrait jobs | Yes (spliced in `finally`) |
| `_batchDeleted` map | per apply run | the run's deletions | Yes (reset each run) |
| `designerAssistantSession`, `proseFitJob`, `creatureGeneration`, `designerPortraitBatch` | per session | one each | Yes |
| Breakout modal `keydown` listener (`onEsc`) | per open | 1 | Removed only by `done()`. `closeBreakout()` at the top of `openBreakout` removes the DOM, not a prior `onEsc`, but two breakouts cannot be open at once. Not a leak in practice. |
| Object URLs: designer Save and original-text download, character editor Save, mementos download, story compiler export, autosave recovery downloads | per click | 1 | Revoked (immediately, at 0 ms, 400 ms or 1 s) |
| Object URL in map_cleanup.html Apply (`a.href=URL.createObjectURL(blob)`, line 179) | per Apply | the whole .tnd blob per Apply | **Never revoked.** Grows per Apply for the page's lifetime (dev tool, low). |
| speaker_browser `curUrl` audition blob | per audition | 1 | Revoked in `stopAudition` |
| admin-invitations `requests` (idempotency ids) | per page session | send and revoke attempts | Deleted on success; kept on failure for an idempotent retry; bounded by operator clicks |
| admin_console `expanded` map | per visit | the roster size | Reset when the operator changes |
| mementos reader iframe | per open | 1 (the old frame is replaced) | Yes |
| map_viewer node click listeners | per render | the node count | The old nodes are dropped with innerHTML, so yes |
| localStorage keys (`bpd_llm_v1`, `tnd_ce_draft_v1`, `tnd_voicelab_v1`, `tnd_bugfeed_secret_v1`, `BPD_INCOMING_K`, `HOME_PENDING_BP_K`, `tnd_capability_names_v1`) | per device | a fixed key set, one value each | Yes. `tnd_ce_draft_v1` can be large (a portrait) and its write failure is silent (F7). |
| bug_tracker copy-button timers and hints | per click | 1 per click, removed after 2.6 s | Yes |

## 4. Affirmed

1. **admin_console.html and admin-mail/admin-invitations/admin-release-notes.** Every server-derived string goes in through `textContent`: username, email, approvalEmail.message, invitation subject, message and delivery, mail recipients, release actions. I found no innerHTML at all.
2. **bug_tracker.html.** Every report field goes through `el(...,text)` → `textContent`: message, detail, reporter, findings, tldr. Screenshot links are limited to http(s). A Reporter header that is not valid JSON is caught and shown as "Not recorded".
3. **mementos.html.** The stored HTML is shown in `sandbox=""` behind a prepended CSP meta that the stored document cannot relax. The same CSP is prepended to the download.
4. **piper-host.html.** Its message handler checks `ev.source===parent && ev.origin===location.origin`, and replies are posted to `location.origin`.
5. **Designer drafts writer** (`DesignerDrafts.writer`/`commit`):
   - The revision compare and the put happen in one readwrite transaction, and success is reported only on `oncomplete`.
   - A failed write paints an error, not "saved", and keeps `unsettled()` true, so beforeunload still warns.
   - The legacy localStorage copy is never deleted.
6. **map_cleanup.html `loadTnd`.** I tried malformed .tnd shapes after a live load: worldState undefined, `{}`, npcs:"x", memory null, character null. `migrateWorldState` never throws, so `MODE` cannot stay "live" pointing at the file's world (`probe-cleanup-migrate.js`: all "migrate ok").
7. **signup.html and invitation.js.** No redirect parameter is followed. The invitation token rides in the URL hash (never sent to a server by navigation; `no-referrer`) and must match `/^[a-f0-9]{64}$/`.
8. **story_compiler.html and home.html.** Every text and attribute value is escaped and every attribute is double-quoted, including a .tnd portrait limited to `data:`. Data-turn attributes are numeric by construction.

## 5. Undetermined

- **blueprint-edition.js and library-slug.js.** Not reviewed; they have pinned tests elsewhere.
- **todo-viewer.html.** Its innerHTML over TODO.md: field escaping not audited. The source is the repo.
- **Generate's overwrite (F2).** Not confirmed in a real browser. Settling it needs one browser run that closes the modal and edits during a stubbed slow `generateBlueprintDraft`.
- **Game import of the editor's .char (F10).** Whether the game's .char import runs `relationshipMigrateSheet`, which would make F10 cosmetic.
- **map_cleanup live Apply.** It calls `saveAll()` while the game tab may hold the same campaign in memory. The game's next save would undo the repair. The page tells the user to reload the game tab, so this looks deliberate.
