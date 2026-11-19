# Lane C report — helpers.js (HEAD d7ed4ea6)

Probe scripts: `audits/audit-2026-11-19-evidence/C\probe1.js` … `probe5.js` (each loads the real engine through `dev/load-engine.js`, `loadEngine()` + `makeTestWorld()`).

## 1. Coverage

- `helpers.js`: read IN FULL, lines 1–4440, in sequential chunks. Nothing skipped.
- `DOC/contracts/render.md`: read in full.
- `DOC/contracts/character.md`: read the "Creature disclosure", "Two forms (#743)" and "Creature and NPC abilities" sections (lines 120–134), plus a grep for every helpers.js function it names (`classDef`, `foePublicName`, `formOf`, `formView`). I did not read the rest line by line.
- Outside the lane, I read only enough to settle a finding: the `CHECK`, `SPELL_DEF` and `COMPANION_AGENDA` handlers (tag_table.js 523–530 and 1481–1504), api.js 2645–2652 (the party block that lists queued wants), ui-panels.js 207–208 and 494–505, ui-mobile.js 123–124, and the callers of `elapsedTicker`, `accountDoorsHtml` and `tableTalkWelcome`.
- I ran no suite and no battery.

## 2. Findings

### F1. Model text in the modifier field of `[CHECK:]` has all its digits glued into one number, so a roll can come out as d20+515 (medium)
- **File and line:** helpers.js line 234, `parseCheckTag`.
- **Code:** `var mod=parseDamageExpr(p[1])?0:parseInt(String(p[1]||"").replace(/[^-+\d]/g,""),10);`
- **Failing inputs (REPRODUCED, probe1.js and probe4.js):**
  - `Attack|+5 vs DC 15` gives mod **515**.
  - `Stealth|DC 14` gives mod **14**, and the DC is also 14.
  - `Attack|+5 (Str 3, prof 2)|DC 15` gives mod **532**.
  - `Save|Wis +2 DC 13` gives mod **213**.
  - `Attack|+1d4|DC 10` gives mod **14**. The leading `+` defeats the "dice first" read.
  - `Attack|5/3|DC 10` gives mod **53**.
- **Wrong outcome:** `resolveCheck(parseCheckTag("Stealth|DC 14"),1).diceTag` is `[DICE:Stealth|d20 = 1 + 14 = 15|success]`. A natural 1 becomes a success.
  - The GM's note says "SUCCESS" and "the roll is final".
  - The roll modal shows `d20+515 vs DC 15` (`rollModalHtml`).
  - The tag handler (tag_table.js 523) accepts the result with no bound.
- **This is the same class as the #654 comment at line 228** ("1d4+2" stripped to its digits read as +14). That fix covered unsigned dice only.
- **Refutation tried:**
  - The engine tests (engine-tests.js 2280–2286, 19536–19543, 36124–36129) cover `+3`, `-1`, `you are seen`, `1d4+2`. None covers a DC or extra numbers in the modifier field.
  - A grep of local corpora found only canonical `|+N|DC n|` forms, about 60 tags. **This is latent: no field occurrence was seen.**
- **Smallest remedy:** read the modifier as the field's leading signed integer, e.g. `/^\s*([+-]?\d+)/`. Refuse or zero any field that is a `DC n` or that carries more than one number. Treat `+NdS` as dice. Clamp to about ±30 and say so loudly.

### F2. `agendaSheetHtml` puts `since` and `done` into the sheet HTML unescaped, and nothing on the import path type-checks them (medium, security)
- **File and line:** helpers.js lines 605–607.
- **Code:** `"… · since t"+cs.agenda.since+"</span>"` and `"…t"+cs.agendaHistory[i].done+"</span>"`.
- **Failing input (REPRODUCED, probe1.js and probe4.js):** `agenda.since="<img src=x onerror=alert(1)>"` produces `… since t<img src=x onerror=alert(1)></span>` in the output.
- **Path (READ):**
  - `portableSheet` deep-copies every sheet field, `agenda` included, into `.char` files and library saves.
  - `sheetAdmit` has no agenda rule: a grep of admission.js and state.js finds no `agenda`.
  - ui-sheets.js:201 paints `agendaSheetHtml(c)` on the NPC sheet.
  - So a crafted `.char` or library sheet runs script in the page, where the API key and token are in localStorage.
- **Smallest remedy:** `escHtml(String(…))` on both numbers, or coerce them with `Number(...)|0`.

### F3. `agendaFile` queues every repeated want, with no dedupe and no cap; the whole queue goes to the GM every turn, and a completed want's duplicate is promoted again (medium)
- **File and line:** helpers.js line 572, `agendaFile`: `if(!cs.agendaQueue)cs.agendaQueue=[];cs.agendaQueue.push(rec);return "silent";`
- **Writer:** the `COMPANION_AGENDA` handler (tag_table.js 530) has no cap and no dedupe either.
- **Failing input (REPRODUCED, probe5.js):** the same `Avenge the mill` filed 50 times gives `agendaQueue.length === 50` and 51 sheet rows.
- **Wrong outcomes:**
  - Re-filing the ACTIVE want also queues a copy. `agendaComplete` (line 580) then promotes that copy as the "new" want, so a fulfilled want comes back.
  - api.js:2649 joins the entire queue into the companion's prompt line ("Later (silent …)"). The prompt grows without limit.
  - The queue lives on a portable sheet, so it travels across campaigns forever.
- **Remedy:** skip a want equal (case-insensitive) to the active want or to any queued one, and say so. Cap the queue (e.g. 5) and refuse loudly past the cap.

### F4. `elapsedTicker` writes its status text into `innerHTML` without escaping (low, latent)
- **File and line:** helpers.js line 419: `else el.innerHTML="<span style='"+style+"'>"+s+"</span>";` where `s` contains `cur`, the caller's base text, and `set(b)`.
- **Probe (REPRODUCED, probe1.js):** base `<img src=x onerror=alert(1)>` lands raw in `innerHTML`.
- **Current callers (READ):** every non-text-mode caller passes a literal (char-creation.js 134/163, ui-portrait.js 307/348/367, ui-modals.js 1242, game.js 4627). The text-mode callers are safe. **So nothing is exploitable today.** It is a trap for the next caller who builds a base from a model name; `set()` is the likeliest door.
- **Remedy:** `escHtml(s)` in the HTML branch.

### F5. `bibleCardHTML` prints `e.tier` unescaped (low)
- **File and line:** helpers.js line 2871: `("Tier "+e.tier)`, later concatenated raw into the badge.
- **Probe (REPRODUCED, probe1.js):** `tier:"<img…>"` reaches the output.
- **Path (READ):** the `[SPELL_DEF:]` writer coerces tier with `parseInt` (tag_table.js 1501), so the model cannot reach it. The remaining door is a crafted save's `worldState.capabilityBible` entry, which `capabilityLookup` serves.
- **Side issue:** a string `category` iterates character by character and gives one badge per letter (probe: `>a<` …). That is cosmetic.
- **Remedy:** `escHtml(String(e.tier))`, and `Array.isArray(e.category)`.

### F6. `synopsisBlockHtml` prints the item turn numbers `it.from` and `it.turn` unescaped (low)
- **File and line:** helpers.js line 4389: `(it.era?"t"+it.from+"–"+it.turn:"t"+it.turn)`.
- **Contract drift:** the contract comment at line 4378 says "every text is escaped".
- **Path:** the values come from `memory.eras[].turnRange` and `chapters[].turn` through `synopsisBasis`, which does not coerce them (`tr[0]||0`).
- **Probe (REPRODUCED, probe1.js):** a string turn reaches the output. The door is a crafted `.tnd`.
- **Remedy:** `Number(x)|0` in `synopsisBasis`, or escape at paint.

### F7. `accountDoorsHtml` prints server-provided provider names unescaped (low)
- **File and line:** helpers.js lines 2522–2523: `String(x)` for an unknown provider goes into `<b>…</b>` raw.
- **Probe (REPRODUCED, probe1.js):** `providers:["<img…>"]` reaches the output.
- **Source:** `/api/account`, which is server-authored. It is reached only if the server, or a proxy, is compromised.
- **Remedy:** `escHtml`.

### F8. `worldStateNpcRows` throws on a null faction entry, which breaks the World State panel repaint (low)
- **File and line:** helpers.js line 3916: `facs.map(function(e){return e.faction+…})`.
- **Probe (REPRODUCED, probe4.js):** `npcFactions={Bram:[null]}` throws `Cannot read properties of null (reading 'faction')`. The caller is ui-panels.js:207 inside syncUI.
- **SUSPECTED:** whether real state can hold a null entry. I did not trace the `[NPC_FACTION:]` writer or the load heal. A hand-edited or old save is the plausible door.
- **Remedy:** filter falsy entries.

### F9. Allow-lists and lookup tables kept in plain objects match prototype names (low)
- **Cause:** `SAY_STEER_WORDS` (line 4118, `var o={}`), `VOICE_AGES` (line 4198) and `STT_COMMON` (line 2984) are plain objects read with bracket lookups. All other name-keyed tables in the file use `keyedDict` or `ownValue`.
- **Results (REPRODUCED, probe4.js):**
  - `sayMoodSteer("constructor")` returns `"constructor"`. The #555 allow-list is bypassed, and `sayMoodShape` admits the word.
  - `voiceAgeLabel("constructor")` returns the `Object` function itself; `voiceAgeLabel("__proto__")` returns `[object Object]`. Either would be printed as a voice label.
  - `STT_COMMON["constructor"]` is truthy. This only suppresses a correction, the safe direction.
- **Remedy:** `ownValue(...)` at the three reads, or build the tables with `keyedDict`.

### F10. `coinNarrationAmounts` takes quadratic time on long runs of number words (low)
- **File and line:** helpers.js lines 2262–2277 (`COIN_NARRATION_RE`). The number-word chain and the `{0,4}` filler words can both consume the same words, so the regex backtracks at every start position.
- **Timings (REPRODUCED, probe2.js and probe3.js):**

  | Input | Time |
  |---|---|
  | `"twenty "` × 571 (4 KB) | 17 ms |
  | 16 KB | 232 ms |
  | 64 KB | 3743 ms |
  | `"one "` × 4000 | 644 ms |

- **Exposure:** it runs on every GM reply (`coinNarrationCheck`). Real narration does not contain such runs, so it needs pathological model output.
- **Remedy:** cap the scanned text, or exclude number words from the filler group.

## 3. Monotonic resources (helpers.js)

| Resource | Scope | Bound | Enforced in code? |
|---|---|---|---|
| `_consoleLog` (#772 ring) | per session | `CONSOLE_CAP` 300 | yes (splice; probe: 305 pushes keep 300, dropped=5) |
| `_consoleNew`, `_consoleDropped` | per session | integers; `_consoleNew` can exceed the ring (305 vs 300) | n/a. Cosmetic: the dot only tests >0 |
| `worldState.diceLog` | per campaign | `DICE_LOG_MAX` 500 | yes |
| `worldState.registerCensus[channel]` | per campaign | `REGISTER_LOG_MAX` 50 per channel; channel names are internal | yes |
| `worldState.companionInitiatives` | per campaign | 20 | yes |
| `worldState.pendingRewardClaims` | per campaign | `REWARD_CLAIM_CAP` | yes (refuses loudly) |
| `worldState.residentRelChanges` | per campaign | `RESIDENT_REL_CAP` 8, plus expiry after 12 turns | yes |
| render pointer list (`renderPointerAdd`) | per campaign | `cap` default 60 | yes |
| localStorage `tnd_stt_log_v1` | per device forever | `STT_LOG_CAP` 100 | yes |
| `cs.agendaQueue` | per sheet, portable (forever) | **none** | **no** (F3) |
| `cs.agendaHistory`, `cs.growth`, `cs.motivationHistory` | per sheet, portable | one entry per completion, growth or settle/birth | no cap; bounded by story events (each birth also settles one) |
| `_coinValueCache` | per session | distinct bible `value` strings looked up | no; bounded by bible size plus loaded overlays |
| `_invCatWarned` | per session | distinct colliding alias keys | no; bounded by alias set |
| `_itemAliasMemo`, `_classDefsArr` | per session | one memo each | yes (replaced) |
| `_diceReveal` and its waiters | per roll | one reveal; waiters drained on finish; game.js guard timeout `DICE_REVEAL_MAX_MS` | yes |
| `elapsedTicker` intervals | per call | ends only by `stop()` or the host reporting `isConnected===false` | **partly**: with `el===null`, or a host that stays connected, the 1 s interval runs until `stop()` (probe3: `elapsedTicker(null,…)` leaves 1 live interval). Two tickers on one element both run and compete. Callers I saw stop on their paths; not traced exhaustively. |

## 4. Affirmed (tried to break, could not)

1. **`safeImgSrc` held** against `javascript:`, `data:image/svg+xml`, an https URL carrying `'`, and `"`. A query `&` comes out escaped. blob and uppercase HTTPS are admitted, as the contract says.
2. **The main escaping renderers escaped everything:** `rollModalHtml` (label, formula, stake, dmg text), `consoleRowsHtml`, `summaryLineHTML` (data-npc and labels), `itemCardHTML`, `skillCardHTML`, `racialCapsHtml` (quote breakout attempt), `vitalSpanHtml`, `escProse`. `foeLabel` returns raw text, and both of its callers escape it or use textContent.
3. **`keyedDict`, `ownAssign` and `keyedStores` were not polluted** by `JSON.parse('{"__proto__":{…}}')`. Each kept it as an own key; there was no `Object.prototype` pollution and the result prototype stayed intact.
4. **Name lookups returned nothing for `__proto__`, `constructor`, `toString` and `hasOwnProperty`:** `itemLookup`, `classDef`, `campaignKind` (gives "adventure"), `bestiaryRecord`, `worldStateNpcRows` (the "toString" Array.isArray guard), `partyUploadPlan` slug grouping, `toastPops`.
5. **`parseDamageExpr` boundaries held:** 0d6, 00d6, 11d6, d7, d20 and `+-2` give null; mod 1000 is refused; spacing is tolerated.
6. **Money parsing was correct:** `parseCoin` and `goldTagParse` read the lead sign, `-2 (2 sp change)` as -200, bundles, and commas. `fmtCoin` handles NaN, negatives and 1e21 without throwing.
7. **Regexes timed linear or near-linear up to 64 KB:** `checkStakeField` (89 ms at 16 KB), `detectStayBehind` (367 ms at 64 KB), `detectPlayerStayBehind`, `registerScan`, `registerMaskNames` with 200 names, `abilityCost`, `normalizeEndpointPair`, `snippetAtSentence`, `denouementSplit`, `toFirstPerson`, `sttCorrectNames`.
8. **The #759 dice reveal cannot hang a reply:** game.js arms a `DICE_REVEAL_MAX_MS` guard that advances to "all", and `diceRevealBegin` finishes any older reveal first.

## 5. Undetermined

- `escHtml(0)` returns `""` (`String(s||"")`). A numeric 0 passed through it paints blank; one site is `escHtml(c.age)`. I did not find a call site where this matters.
- `_itemAliasIndex` memoises on the two stores' entry counts. A campaign switch to another campaign with the same overlay count but different overlay `aliases` would serve stale aliases. The only overlay alias writer I found copies a prior entry's aliases (helpers.js 2745), so I could not tie this to a real input.
- F8: whether any writer or load path can leave a null in `memory.npcGraph.npcFactions[name]`.
- F1: how often models actually put a DC or a stat breakdown into the modifier field. The local corpora showed none.
