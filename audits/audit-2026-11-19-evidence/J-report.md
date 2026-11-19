# Lane J report — UI shells (HEAD d7ed4ea6)

Probes: `audits/audit-2026-11-19-evidence/J\probe1.js` and `...\J\probe2.js` (engine + ui-shell/ui-panels/ui-sheets/ui-character-voice/ui-modals loaded headless with DOM stubs, the dev/tests-429 pattern; `modalShell` wrapped to capture the HTML it is given).

## 1. Coverage

| File | Read | Skipped |
|---|---|---|
| DOC/contracts/render.md | whole | — |
| ui-shell.js (395 lines) | whole | — |
| ui-modals.js (1312 lines) | whole | — |
| ui-sheets.js (755 lines) | whole | — |
| ui-panels.js (604 lines) | whole | — |
| ui-dice.js (370 lines) | whole | — |
| ui-mobile.js (137 lines) | whole | — |
| index.html (667 lines) | lines 1–14, 426–667 whole: the head script, import map, all markup, the inline handlers and the SW/manifest script | the CSS block (lines 15–425) only grepped for z-index and pointer-events. I did not read it line by line. |

I also read these outside the lane to settle findings: helpers.js (escHtml, escProse, safeImgSrc, the #772 console ring, clampImportedCharacter, genderLabel, vitalSpanHtml), inventory.js (invMarkResolve, invDropToggle, itemKey), admission.js (the registry rows), game.js (ensureV10Arrays, the blueprint rules import at 3618–3630, rollPendingCheck 3080–3103, and the openings of defineItemFromStory, syncCharSheet and refreshSynopsis), ui-browsers.js (385–405) and dev/tests-677-roll-modal-browser.js (line 45).

## 2. Findings

### F1 — A .blueprint's rules become stored HTML that runs every time Narrative Rules is opened (HIGH)
- **Where:** ui-modals.js `showRulesModal` line 119: `"...<span>"+customRules[i]+"</span>..."`. This goes into `inner.innerHTML`.
- **Source:** game.js 3624–3629 (blueprint import). It runs `customRules.push('Blueprint rule (quoted from the campaign file): "'+bp.rules[ri]+'"')` and then `saveRules()`, which writes to localStorage (`RLK`). A blueprint is a shareable file: samples/, the curated shelf, other people's designs.
- **Failing input:** a blueprint with `rules:["<img src=x onerror=alert(1)>"]`. Start a campaign from it, then open Narrative Rules.
- **Outcome:** the handler runs in the game origin, where the API key and session token live. The rule is device-wide and permanent, so it fires on every later open, in every campaign. The player's own rules render the same way (self-XSS).
- **Evidence:** REPRODUCED for the render (probe1 §5: `rules raw custom rule: true`). READ for the blueprint→customRules path; I did not import a real blueprint.
- **Remedy:** `escHtml(customRules[i])` at line 119. The DEFAULT_RULES line (118) is constants and is safe.

### F2 — A model-generated companion sheet's alignment and spell level are painted as raw HTML (HIGH)
- **Where:**
  - ui-sheets.js `showNpcSheet` line 513: `"<span style='color:var(--t2)'>"+(sheet.actualAlignment||sheet.statedAlignment||"Neutral")+"</span>"`
  - `csSheetSections` line 157: `stag=sp2.lvl===0?"C":String(sp2.lvl)` then `"["+stag+"] "` unescaped
  - ui-panels.js `updateSpPanel` lines 453/459, the same raw `[tag]`
  - The hero's sheet line 309 also paints alignment raw.
- **Source:** `generateNpcSheet` (ui-sheets.js 405–433) `JSON.parse`s the model reply. It coerces stats, hp, level and xp, and passes `statedAlignment`, `actualAlignment` and `spells[].lvl` through verbatim. `sheetAdmit` does not coerce them either: clamp only cuts length, and ensureV10Arrays only fills arrays.
- **Failing input:** the model's sheet JSON contains `"actualAlignment":"<img src=a onerror=alert(5)>"` and `"spells":[{"nm":"Spark","lvl":"<svg onload=alert(6)>"}]`. This can be reached through prompt injection in story text.
- **Outcome:** markup runs when the NPC sheet opens. The spell panel runs it too once that companion holds the spotlight.
- **Evidence:** REPRODUCED (probe2). Output: `stored actualAlignment: <img src=a onerror=alert(5)>`, `npc sheet raw alignment: true`, `npc sheet raw spell lvl: true`, `spell panel raw lvl: true`.
- **Remedy:** escHtml the alignment at lines 309, 513 and 744. Coerce `lvl` to an integer at the faucet, or escHtml `stag` in both renderers.

### F3 — The read-only library/local-character preview paints age, deity, alignment and stats as raw HTML (HIGH/MEDIUM)
- **Where:**
  - ui-sheets.js `showReadOnlyCharSheet` line 738: `(c.age?" · "+c.age:"")+(c.deity?" · "+c.deity:"")`. The live sheet escapes both at line 292; this host does not.
  - Line 744: alignment raw.
  - `csSheetSections` line 110: `v=(c.stats&&c.stats[s])||"—"` raw.
- **Source:** ui-browsers.js `inspectAndImport` (line 401) opens this viewer on a character-library snapshot (server-held) or another campaign's character, BEFORE the player accepts the import. Nothing types these fields: clampImportedCharacter cuts length only.
- **Failing input:** a snapshot with `age:"<img src=x onerror=alert(1)>"`, or `stats.STR` set to markup.
- **Evidence:** REPRODUCED (probe1 §1: `ro-sheet raw age img: true`, `raw deity: true`, `raw alignment: true`, `raw stat: true`).
- **Remedy:** escHtml at 738/744 (this is a duplicate renderer whose copy disagrees with line 292). Coerce stats to numbers, or escHtml `v` at line 110.

### F4 — The read-only preview's ×, ✎ and epithet × act on the LIVE hero (MEDIUM)
- **Where:** ui-sheets.js line 751 calls `csSheetSections(c,null,true)`. Inside, `_canDrop=(invOwner!==undefined)` (line 166) and `_canRej=(invOwner!==undefined)` (line 195) are true for `null`. The buttons are written with `data-own="'+escHtml(null)+'"`, which is `data-own=""`, and `""` is the hero's owner id. The comment at line 101 says "undefined = read-only viewer … no drop buttons".
- **Failing sequence:**
  1. Character browser → click a library row that carries an item the hero also carries.
  2. Click its ×. `markInvItem("",0,ev,"Longsword")` marks the hero's row, then `_csReRender()` opens the hero's sheet with a Delete button.
  3. Alternatively, the epithet × calls `rejectEpithet("",idx)`, which removes the hero's alias at that index after a confirm that names the hero's epithet, not the snapshot's.
  4. The ✎ quill runs `defineItemFromStory` against this campaign.
- **Evidence:** REPRODUCED (probe1 §1–2):
  - `ro-sheet inv-x buttons (should be 0 for read-only): 2`, with data-own `""`
  - `ro-sheet epithet x buttons: 1`
  - `csSheetSections(c,undefined) inv-x: 0`
  - `hero marks after a click in the read-only preview: {"0|Longsword":true}`
  - `hero aliases after the preview's epithet ×: []`
- **Why the tests miss it:** dev/tests-429-inventory-drop.js:196 tests the preview with `undefined`, while the real caller passes `null`.
- **Remedy:** pass `undefined` at line 751, or test `invOwner==null` at lines 166/195.

### F5 — The NPC sheet's "Bond from <hero name>" label is unescaped (MEDIUM)
- **Where:** ui-sheets.js `showNpcSheet` lines 540–541: `csKv("Bond from "+worldState.character.name, …)` and `csKv("Current dynamic from "+worldState.character.name, …)`. `csKv` (line 17) does not escape its key.
- **Failing input:** a hero (an imported .char or .tnd, or a library pull) named `<img src=y onerror=alert(2)>` who has a bond to an NPC. Open that NPC's sheet.
- **Evidence:** REPRODUCED (probe1 §3: `npc sheet raw hero-name key: true`).
- **Remedy:** `escHtml(worldState.character.name)` at both lines.

### F6 — #772: a toast fired while a modal is open is collected, not shown, so the modal's own refusals are invisible (MEDIUM, contract drift)
- **Where:** ui-shell.js `consoleDoorOpen` line 67 returns `b.offsetParent!==null`. That holds while any fixed modal overlay covers the page, so `toastPops` returns false and the line goes only to the console. The dot that turns green is under the modal's .88 black backdrop.
- **Failing sequences:**
  - The roll modal's Roll or Hold back while `busy` (ui-modals.js 1268: `showToast("One moment — the turn is still landing.")`). render.md says the modal "keeps the modal and says so". The player now sees a dead button.
  - Dice appearance → Roll a test d20 after the dice failed (ui-dice.js 338: "asked for on purpose: say why again"). The reason goes to the console behind the modal.
  - Health modal "Report failed: …" (ui-modals.js 1199).
  - Item card "Wait for the turn to finish" (ui-sheets.js 228).
  - The sync badge's tap, whose only job is a toast explaining the badge (ui-panels.js 595). Here the tap shows nothing at all, only the dot.
- **Why the tests miss it:** dev/tests-677-roll-modal-browser.js:45–49 counts calls on a `__toasts` stub, so it cannot see that nothing popped.
- **Evidence:** READ. I did not run a browser.
- **Remedy:** treat the door as closed while `modalTopOpen()` is truthy, or give these refusals a popping kind.

### F7 — Hand-rolled modals are not dialogs to the focus contract, so Enter can send a turn behind them (MEDIUM)
- **Where:** ui-modals.js:
  - `showRespawnModal` (1104)
  - `showOnwardConfirmModal` (1115)
  - `showCampaignEndedModal` (1142)
  - `showHealthModal` (1153)

  Each builds its own `div` with no `role/aria-modal` and never moves focus into itself. `modalTopOpen()` (ui-shell.js 201) only sees `[aria-modal='true']`, so `focusStoryBox()` (game.js 3062, at every turn end) focuses `#action-input` behind them, and there is no Tab containment.
- **Failing sequence:** type "back" in the death scene and press Enter. The respawn modal opens over a still-focused story box, and a second Enter sends a turn behind "You died". Likewise, open the health modal during a turn: when the turn lands, focus goes to the hidden input.
- **Contract:** CLAUDE.md Conventions says Enter can never send a turn from behind a popup.
- **Evidence:** READ.
- **Remedy:** move these four onto `modalShell`, or at least set `aria-modal` and focus the button.

### F8 — The usage modal paints an imported save's usage kinds and counters raw (LOW/MEDIUM)
- **Where:** ui-modals.js `showUsageModal` lines 413–420. `row(kinds[i],…)` puts the `u.byKind` KEY into `<td>` unescaped, and `n(v)=(v||0).toLocaleString()` returns a string counter unchanged.
- **Source:** `worldState.usage` rides the save.
- **Failing input:** a .tnd with `usage.byKind["<svg onload=alert(3)>"]={calls:"<b>9</b>",…}`, then File ▸ Usage & cost. This is a dev-tier row, but it is visible to every player in local or unsigned mode.
- **Evidence:** REPRODUCED (probe1 §4: `usage raw kind label: true`, `usage raw calls string: true`).
- **Remedy:** escHtml the label, and `Number(v)||0`.

### F9 — Two sheet buttons that start model calls refuse silently while busy (LOW, silent failure; the copies disagree)
- **Where:**
  - ui-sheets.js line 182: the inventory ✎ calls `defineItemFromStory(this.dataset.raw,event)` directly. game.js 4552 has `if(busy||!worldState)return;` with no word.
  - Line 326: the sheet's ⟳ Sync calls `syncCharSheet()`. game.js 4665 has `if(busy||!worldState)return;`.
- **Disagreement:** the item card's Define button for the same action toasts "Wait for the turn to finish" (ui-sheets.js 228), and the quest journal gates with `_questJournalBusy()` and a toast.
- **Failing sequence:** open the sheet during a turn and click ✎ or Sync. Nothing happens.
- **Evidence:** READ.
- **Remedy:** one click-time gate with a toast, like `invLedgerOpen` or `_questJournalBusy`.

### F10 — Numeric sheet fields are concatenated raw across the sheet, the party panel and the Sync modal (LOW, SUSPECTED)
- **Where:**
  - ui-panels.js `_ppHpHtml` line 22 `(hp||0)`, line 181 `pmSheet.xp`
  - ui-sheets.js:
    - line 118 `"t"+_cd.turn`, `"expires ~t"+_cd.until`
    - lines 138/144 `"Turn "+_sb.turn`
    - line 126 `sm.amount`
    - line 200 `l.turn`
    - line 520 `wsNpc.met`
    - line 550 `memNpc.events[i].turn`
  - ui-modals.js lines 211–219, `value='"+c.hp+"'` and others, inside a single-quoted attribute.
- **Why it matters:** nothing I read coerces these on import: clamp only cuts strings, ensureV10Arrays only fills.
- **What would settle it:** run a .tnd/.char with `hp:"1<img src=x onerror=…>"` through importSaveData → syncUI. I did not run the import path.
- **Remedy:** coerce at admission, or `Number()` at the renderers.

### F11 — In Car Mode every toast pops and stays on screen until tapped (LOW, monotonic)
- **Where:** ui-shell.js `showToast`. `consoleDoorOpen()` is false in Car Mode (line 66), so every line pops. Without `ms` it is sticky (line 104), stacked 42 px higher each (line 92) at z-index 10000 over `#car-overlay` (500).
- **Failing sequence:** a long drive. Toast nodes accumulate with no bound and climb over the car screen's controls, and a driver cannot tap them away.
- **Evidence:** READ.
- **Remedy:** an auto-dismiss `ms` while `carMode`, or a cap on live toasts.

## 3. Monotonic resources

| Thing | Scope | Bound | Enforced in code? |
|---|---|---|---|
| `_consoleLog` (helpers.js, fed by showToast) | session | CONSOLE_CAP 300, oldest dropped and counted | yes |
| `.tnd-toast` DOM nodes (sticky without `ms`) | session | none; removed only by a tap | **no** (F11; in Car Mode every toast is one) |
| Story `.msg` nodes | session | STORY_DOM_CAP 30 (+ the reader's allowance + 10) | yes (`trimStoryDom`) |
| modalShell MutationObserver + keydown listener | per modal | disconnected when the modal leaves the body; disconnected on same-id re-creation | yes |
| `FRAME_BUTTONS` wrappers | per paint | stale wraps removed each `syncFrameButtons` | yes |
| `renderWaysRow` document click listener | page | once (`_closer`) | yes |
| Long-press tip listeners and `_lpTipEl` | page | once (`_lpWired`) | yes |
| Combat scratch `.cname` span | per paint | appended then removed in the same call | yes |
| HUD party cards, sidebar party buttons | per paint | parent `innerHTML` replaced | yes |
| `window` resize listener, AudioMaster.onChange (ui-mobile) | page | once (`mobileUI.ready`) | yes |
| `window` storage listener (ui-modals theme) | page | once at load | yes |
| `_diceLive.overlay` (WebGL context, sound engine) | page | one | yes |
| `_diceLive.waiting` closures | page | cleared on ready or on script error; grows by one per roll or per Dice-appearance open while the module stays in "loading" and neither event fires (a stalled fetch) | partly (no timeout) |
| Dice start tries | page | DICE_START_TRIES 3 | yes |
| `_invDropMarks.by` | campaign | reset on a campId change; keys bounded by sheet owners | yes |
| `_invSecOpen` | page | category registry ids | yes |
| Sound modal "Play all" timers | per click | one per sound | yes |
| localStorage `tnd_dice_look_v1`, `tnd_dice_exit_v1`, `tnd_firstturn_seen_v1`, FONT/THEME keys | device forever | one value each | yes |
| `RENDER_STR_K` map | device forever | one entry per model id ever chosen; departed ids stay | effectively bounded (tiny) |
| `customRules` (RLK) | device forever, across campaigns | grows by every rule of every blueprint ever started; dedupe by exact wrapped string only | **no** (out-of-lane writer game.js 3624; a prompt-side cap `IMPORT_CAPS.rule` exists per engine-tests; the rules modal lists them all) |

## 4. Affirmed (tried to break, could not)

1. `escProse` (helpers.js 37): escape first, then `*…*`→`<em>` and `\n\n`→`</p><p>`. The escaped text has no `< > " '`, so the emphasis pass cannot reopen markup.
2. `showToast`'s entity decode (`&#NN;`, `&amp;`) feeds `textContent`, so model text cannot become markup there. The console row escapes it with `escHtml`.
3. The sheet and panel action buttons (`inv-x`, `inv-def`, `epi-x`, `cs-cap`, `inv-name`, `ii`, `inv-ledger`, `sp-item`, `ai`) all pass the name through `data-*="escHtml(x)"` plus `this.dataset.*`. There is no JS-string-in-attribute concatenation, so a `'` or `"` in a name cannot break out. The quest panel's `onclick='showQuestModal()'` is constant.
4. `modalShell` same-id re-creation (ui-shell.js 149–150) disconnects the old observer before removal and inherits the original opener. `restore()` acts only when focus was lost and never behind an open aria-modal.
5. Every concatenated `<img src>` in the lane goes through `safeImgSrc`: sheets, NPC, read-only, bug report, enemy card.
6. `rollPendingCheck`'s reveal cannot stay hidden forever when the dice never settle. The `DICE_REVEAL_MAX_MS` guard timer (game.js 3096) reveals the card.
7. The dice start retry cap: `diceLiveStartFailed` reaches `DICE_START_TRIES`, then the state goes to "failed" and the message is said once more. `reportError` fires once per session.
8. The roll modal's double-click: `take` removes the modal before running the action, so a second click has no target. Busy is checked first.

## 5. Undetermined

- Does mobile.css hide `#console-btn` on phones? If it does, `consoleDoorOpen` is false there and F6 applies on desktop only.
- Does `importSaveData` or the .char door coerce `hp`, `xp` and the turn stamps anywhere I did not read? That would settle F10.
- `showAccountModal` (ui-modals.js 491–500) prints server-authored `a.username`, `a.tierLabel`, `a.status` and the fetch `err` raw. Exploitability depends on what the server lets a username or display name contain. Not checked.
- `generateNpcSheet` across a campaign switch during its `await callGM`: it writes into the captured `wsNpc` of the old world, and `sheetAdmit` canon writes go to the new global world. Whether `busy=true` blocks a campaign load was not checked.
- ui-modals.js 795 `k.replace(/'/g,"\\'")` in a querySelectorAll. An item key ending in a backslash (itemKey keeps backslashes) would produce a non-matching selector, and the player's extra category ticks would be dropped silently. Not probed.
