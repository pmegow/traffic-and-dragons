# HANDOFF — the post-cutover additive batch (written at engine v1.260)

**Authorship & execution frame.** This is a Fable-authored implementation design, written for
execution by a later (Opus) session under the drift-protection policy's compensating controls
(CLAUDE.md ▸ Dev workflow ▸ Drift-protection change policy; Fable_UberAudit.md ▸ Standing policy).
Every item below touches the drift surface (tag vocabulary · `TAG_DOC_LINES` prompt docs ·
`applyMutsTable` write paths · `buildSysPrompt` injection blocks) — the policy's "critical
pre-review before any code" is THIS document; the executing session's job is faithful execution
plus the per-item post-verification specified in each ⑥. If execution reveals a fork this doc
did not anticipate, STOP and present it to the user — do not resolve design forks in-flight
(memory: no-work-with-open-questions).

**Commit discipline.** Each numbered item = ONE single-concern commit that:
- bumps `APP_VERSION` (globals.js) and `CACHE` (sw.js) — no exceptions;
- updates its TODO.md and/or Fable_UberAudit.md row in the same commit;
- runs `node dev/run-tests.js` green as the pre-commit gate (the hook enforces this);
- for any commit editing `TAG_DOC_LINES`: regenerates the stable-half golden in the SAME commit
  (see "Stable-half discipline" below).

**Ordering.** Items 1–9 are in the priority order recorded in the UA1 row's NEXT list
(Fable_UberAudit.md): UA25 → UA26+UA2 → UA38-① → UA39-② → #46-B → #47 → #50a → UA42
(F3 guard + completion toast) → UA41 (queued behind the batch per the user's 2026-07-10 call).
Item 0 is the **hard precondition** and gets its own dedicated session before anything else.

**The playtest gate (spine cadence).** The whole batch is ONE spine block: after it lands, a
playtest exercises companion casting, a 3-foe encounter with surrender, condition causes,
epithet grants, quest-close toasts, and the reciprocity nudge — before the next spine block.
Engine tests prove the injection is SENT; only live turns prove the model OBEYS.

---

## Current state the executor must internalize (v1.260)

- `TAG_AUTHORITY="table"` (globals.js:179): `applyMutsTable` (tag_table.js) is the authoritative
  parser. `applyMuts` (api.js:558) is a dispatcher; `applyMutsLegacy` (api.js:567–~805) is the
  frozen pre-cutover parser, retained only as the `TAG_AUTHORITY="legacy"` rollback target and
  the dev-replay comparison baseline.
- `TAG_SHADOW=false` in production (globals.js:175) — the per-turn reverse shadow was RETIRED at
  v1.260 after the soak passed (160+ scripted parity runs, 49 real v1.258 turns, zero diffs ever).
- **BUT the test suite still forces `TAG_SHADOW=true`** (dev/engine-tests.js:13) and carries an
  aggregate zero-diff parity gate (engine-tests.js:~1583). Parity against legacy is a tested
  invariant *for as long as legacy exists*.
- **This is exactly why item 0 must land first**: every mutation-behavior change in this batch
  (new tags, multi-foe combat, the F3 guard) would diff against the FROZEN legacy parser BY
  DESIGN and fail the parity gate. Deleting legacy first turns the batch into pure additive
  table work with no false alarms and no temptation to weaken the gate ad hoc.

### Stable-half discipline (applies to items 1, 2, 3, 4, 5, 6, 7)

`TAG_DOC_LINES` (tag_table.js:43–90) IS the STATE TAGS block in the cached STABLE prompt half.
Any edit to it:

1. **Update the frozen-doc engine test in the same commit** — engine-tests.js ~1512
   ("derived STATE TAGS doc block frozen") pins a djb2 hash (currently `1563084037`) and length
   (currently `8237`). Recompute both (the test's failure message prints the new values) and
   update the constants CONSCIOUSLY — the test exists so prompt-text changes are deliberate
   commits, never accidents.
2. **Regenerate the stable-half golden in the same commit**:
   ```
   node dev/capture-stable.js dev/golden_stable_PRE.txt   (run BEFORE the edit, from HEAD)
   node dev/capture-stable.js dev/golden_stable_POST.txt  (run AFTER the edit)
   ```
   Diff the two files by eye: the ONLY difference must be the intended doc line(s). Commit the
   new capture as the next commit's PRE baseline. This is the byte-level review of what every
   campaign's cached prompt will become.
3. **Cache-invalidation accounting**: each deployed stable-half change costs every live campaign
   ONE cache-write turn (~1.25× input price on that turn), and the UA5 purity tripwire
   (`_checkStablePurity`, api.js) will warn exactly once per campaign at the switch. Commits stay
   single-concern, but **push/deploy the doc-line commits together** — players only ever run the
   deployed state, so one deploy = one invalidation for the whole batch (this honors
   MULTI_ENEMY_COMBAT.md §4's "one stable-half invalidation for the whole batch" intent without
   compromising commit hygiene). After deploy, verify on a live campaign that the purity warn
   fires ONCE and byte-identity resumes on the following turn (Usage modal ▸ cache-health line
   returns to green).

### Shared verification kit (referenced by every ⑥)

- `node dev/run-tests.js` — full suite, pre-commit gated.
- `node dev/diff-replay.js dev/corpus_playtest_v1238.json` (and `_tagsoak_v1241`, `_playtest_v1258`)
  — after item 0 this is the **smoke-replay** (single parser, throw/handler-error/end-state
  assertions). For items that deliberately change mutation behavior (UA25, UA26, UA42), replay
  output diffs vs the pre-item end state are EXPECTED — the item's tests must pin exactly which
  turns change and why; anything unexplained is a defect.
- Preview spot-check: open index.html locally (unregister the SW if stale), run 1–2 real turns
  shaped to hit the new path, watch console for the tripwires (`[tags]`, `[combat]`,
  `[tag-shadow]` until item 0 removes it, `_checkStablePurity`).
- Tripwire inventory: **UA5 purity hash** (`_checkStablePurity`) catches stable-half leaks/edits;
  **`__tagUnknownScan`** catches vocabulary gaps (a new tag missing its strip entry, or a GM
  invention); **coverage guards** (engine-tests ~1516) structurally forbid a handler without a
  strip entry and a stripped name without a handler-or-exemption (the phantom class);
  **`__tagNoCombatWarns`** catches combat tags landing on dead combat (the C1 class);
  **frozen `_CT_TAGS` hash** (engine-tests ~1506) makes strip-regex changes deliberate.
  Items adding strip names MUST update the frozen `_CT_TAGS` hash/length constants consciously,
  same discipline as the doc-block hash.

---

## Item 0 — PRECONDITION: delete the legacy parser (dedicated session, before the batch)

The reverse-shadow soak is complete (zero diffs across the scripted battery, two corpora, and
~160 real turns). Carrying `applyMutsLegacy` into the batch would force every behavior change to
fight the parity gate. Retire it with the same rigor it was built with.

### ① Files & functions touched

- **api.js** — delete `applyMutsLegacy` (the ~230-line function starting api.js:567); replace the
  `applyMuts` dispatcher (api.js:558–566) with a thin veneer. **DO NOT touch the shared inventory
  helpers immediately above it** (`_qtyParse`/`addInventoryItem`/`removeInventoryItem`,
  api.js:543–551) — the table handlers call them.
- **tag_table.js** — delete the two-parser comparison machinery: `__tagCloneWS`, `__tagShadowRun`,
  `__TAG_DIFF_SKIP`, `__tagDeepDiff`, `__tagShadowDiff`, `__tagShadowToastShown`,
  `__tagParityRuns`, `__tagDiffCount`. **KEEP**: `__tagUnknownScan` + `__TAG_KNOWN` (a tripwire
  independent of the shadow), `__tagNoCombatWarns`, `TAG_NO_HANDLER`, and everything else.
  Update the file-header comment (it still narrates shadow mode).
- **globals.js** — delete `TAG_SHADOW` and `TAG_AUTHORITY`. Rollback story changes: from
  "one-line flag flip" to "git revert of this commit" — say so in the commit message.
- **dev/engine-tests.js** — remove the `TAG_SHADOW=true` force (line 13); delete the aggregate
  zero-diff test (~1583); convert the parity A–D battery into pure behavior tests (drop the
  `__tagDiffCount` bookkeeping lines, KEEP every sanity assertion — they are the full-vocabulary
  behavior spec now); update the parity-battery section comment; add the new tests in ④.
- **dev/diff-replay.js** — repurpose to **smoke-replay**: single-parser replay asserting no
  throws, empty `R.errors`, and printing/serializing the end state. Keep the three corpora as
  permanent regression assets.
- **CLAUDE.md / TODO.md / Fable_UberAudit.md** — update the tag_table + applyMuts rows (UA1 row
  gains its closing line), same commit.

### ② Code sketch (ES5)

```js
// api.js — applyMuts, post-legacy (UA1 closing commit). The table IS the parser; the
// unknown-tag scan survives the shadow machinery it used to ride on (it is a vocabulary
// tripwire, not a parity tool — losing it would silence the phantom-tag detector).
function applyMuts(text){
  var R=applyMutsTable(text);
  __tagUnknownScan(text);
  return R;
}
```

```js
// dev/diff-replay.js → smoke-replay (same file, repurposed; header comment rewritten).
// Core loop change only — setup/stubs/start-state unchanged:
var errTurns=[];
for (var i = 0; i < raws.length; i++) {
  worldState.turn = raws[i].turn || (i + 1);
  try {
    var R = applyMuts(raws[i].raw);
    if (R && R.errors && R.errors.length) errTurns.push(raws[i].turn + ": " + R.errors.join("; "));
  } catch (e) { errTurns.push(raws[i].turn + ": THREW " + e.message); }
}
console.log("── smoke-replay complete ── handler errors: " + errTurns.length);
for (var j = 0; j < errTurns.length; j++) console.log("  ✗ " + errTurns[j]);
// End-state serialization — the item-0 byte-identity evidence (see ⑥):
fs.writeFileSync(path.join(root, corpusPath + ".endstate.json"),
  JSON.stringify({ ws: worldState, mem: memory }), "utf8");
console.log("end state -> " + corpusPath + ".endstate.json");
process.exit(errTurns.length === 0 ? 0 : 1);
```

### ③ Doc lines

None — this commit must not change ONE BYTE of prompt text. The frozen doc-block hash test and
`dev/golden_stable_PRE.txt` stay untouched; re-run `node dev/capture-stable.js` after the
deletion and diff against the PRE capture — must be byte-identical (the deletion touches no
prompt construction).

### ④ Engine tests to add

- **"legacy parser fully retired — no symbols remain"** — asserts
  `typeof applyMutsLegacy==="undefined" && typeof TAG_AUTHORITY==="undefined" && typeof TAG_SHADOW==="undefined" && typeof __tagShadowRun==="undefined"`.
  Failure condition: a partial deletion leaving a half-wired parser or a dead flag someone could
  flip expecting a rollback that no longer exists.
- **"unknown-tag scan fires on every applyMuts call"** — stub `console.warn` into a counter, run
  `applyMuts("prose [TOTALLY_FAKE_TAG:x]")`, assert exactly one warn mentioning
  `TOTALLY_FAKE_TAG`. Failure condition: the scan's call site died with the shadow gate it used
  to live behind (it was only invoked when `_sh`/`_shadow` was truthy — the exact silent-failure
  this deletion could cause).
- **"handler isolation survives"** — a response where one handler throws (e.g. temporarily break
  `worldState.questLog=null` mid-fixture, or use a malformed payload known to throw) still
  applies the OTHER tags and records the error in `R.errors`. Failure condition: the veneer
  rewrite accidentally reintroducing all-or-nothing parsing.
- **Converted parity A–D battery** — keep all existing end-state sanity assertions (hp/gold/
  combat/merge/mirror numbers) as pure behavior tests. Failure condition: any table handler
  regressing once the legacy cross-check is gone — this battery IS the vocabulary spec now.

### ⑤ Hazard notes

- **Deleting the wrong span in api.js.** `applyMutsLegacy` is ~230 dense single-line parsers; the
  shared inventory helpers sit immediately before it and `recordUsage`/`usageCost` after. A
  mis-scoped deletion breaks table handlers that call `_qtyParse`/`addInventoryItem`. Tripwire:
  the full suite (parity battery exercises ITEM_GAINED stacking) + smoke-replay.
- **Losing `__tagUnknownScan`.** Its only call sites today are inside the shadow-gated branches
  of the dispatcher. Deleting "the shadow machinery" wholesale silences the vocabulary-gap
  detector with zero symptoms. Tripwire: the new engine test in ④ — write it FIRST (test-first:
  it fails against a naive deletion).
- **Stale references in the test suite / dev tools.** `TAG_SHADOW=true` in engine-tests, the
  `TAG_SHADOW=true;/*force*/` line in diff-replay, `__tagDiffCount` reads in the battery — any
  survivor is a ReferenceError that kills the whole suite (loud, but blocks the commit until
  found). Grep for `TAG_SHADOW|TAG_AUTHORITY|__tagShadow|__tagDiffCount|__tagParityRuns|applyMutsLegacy`
  across the repo before committing; expect zero hits outside comments/docs.
- **Rollback regression.** `TAG_AUTHORITY="legacy"` dies here. The compensating control is the
  end-state byte-identity evidence in ⑥ — captured BEFORE deletion, so the revert path is proven
  unnecessary before it is removed.

### ⑥ Verification steps

1. **Before touching anything**: at HEAD, run the CURRENT dual-parser `dev/diff-replay.js` on all
   three corpora; confirm 0 diffs; add the end-state serialization line (as a dev-only change)
   and save the three `*.endstate.json` files aside.
2. Execute the deletion; run `node dev/run-tests.js` — all green, count drops by the retired
   parity/aggregate tests and rises by the ④ additions (state both numbers in the commit).
3. Run the new smoke-replay on all three corpora; **byte-compare each end-state JSON against the
   step-1 capture** — must be identical. This is the proof the deletion changed nothing.
4. `node dev/capture-stable.js dev/tmp_stable.txt`; byte-compare against `golden_stable_PRE.txt`
   — identical; delete the tmp file.
5. Preview: one real turn on a throwaway campaign; console shows no `[tag-shadow]` lines ever
   again, `[tags]` unknown-scan still fires on a hand-injected fake tag (paste a response through
   the Table Talk debug path or use the console).
6. Commit (APP_VERSION+CACHE bump, UA1/TODO rows updated); push per the push-workflow memory.

---

## Item 1 — UA25: companion spell tracking (`[COMPANION_SPELL_USED:]` + companion canon injection)

Companions cast for free today (`[SPELL_USED:]` matches only the PC), and Haiku emitted
`[COMPANION_SPELL_USED:]` unprompted — the models are asking for this tag. Two halves, one commit:
the tag, and the canon injection for companion spells (their spells live on `charSheet.spells`
and currently get NO bible re-injection — the v1.224 B1(b) drift gap).

### ① Files & functions touched

- **tag_table.js** — new `COMPANION_SPELL_USED` table entry inserted **immediately after the
  `SPELL_USED` entry** (NOT at the end of the companion cluster: SPELL_USED runs before REST in
  table order, so a same-response cast-then-rest resolves rest-last; the companion tag must mirror
  that ordering or player and companion semantics diverge). Add `"COMPANION_SPELL_USED"` to
  `TAG_STRIP_NAMES` (place it just before `"COMPANION_XP"` in the list). New doc line in the
  COMPANION SHEET TAGS cluster of `TAG_DOC_LINES`.
- **api.js** — new `buildCompanionSpellBibleBlock()` beside `buildSpellBibleBlock` (api.js:404);
  wire its output into the VOLATILE half of `buildSysPrompt` directly after the existing
  spell/ability bible blocks. Update the stale "Player-only for now; companion spell canon is a
  follow-up" comment on `buildSpellBibleBlock` (api.js:403).
- **dev/engine-tests.js** — tests in ④; update the frozen `_CT_TAGS` hash/length and the frozen
  doc-block hash/length constants.
- `restSpells()` (game.js:1015) already restores companion slots (audit E84) and the table `REST`
  handler calls it — no change needed; pin with a test.

### ② Code sketch (ES5)

```js
// tag_table.js — insert AFTER the SPELL_USED entry:
{t:"COMPANION_SPELL_USED",apply:function(text,R){var csuTags=text.match(/\[COMPANION_SPELL_USED:([^|\]]+)\|([^\]]+)\]/g)||[];var csui;
  for(csui=0;csui<csuTags.length;csui++){var csum=csuTags[csui].match(/\[COMPANION_SPELL_USED:([^|\]]+)\|([^\]]+)\]/);if(!csum)continue;
  var csuCs=findCompanionChar(csum[1]);if(!csuCs||!csuCs.spells)continue;
  var csuNm=csum[2].toLowerCase().trim(),csuj;
  for(csuj=0;csuj<csuCs.spells.length;csuj++){var csp=csuCs.spells[csuj];if(csp.lvl===0)continue;/* cantrips never expend — same rule as the player */
    var cspBase=csp.nm.replace(/\s*\(.*\)/,"").toLowerCase().trim();
    if(cspBase===csuNm||csp.nm.toLowerCase()===csuNm){csp.used=true;R.muts.push(csum[1].trim()+" cast: "+csp.nm);break;}}}}},
```

```js
// api.js — the companion half of the #10 anti-drift injection (UA25). ONE canon line per spell
// across the whole party: bounds are identical for every caster, so spells the player's own
// block already covers are not repeated. Slot state is per-owner and stays on the party sheet
// (Spells available / EXPENDED lines) — this block is pure canon, deliberately without the
// player block's [EXPENDED] markers. VOLATILE half only (reads charSheets live).
function buildCompanionSpellBibleBlock(){
  if(!worldState||!worldState.npcs||!worldState.npcs.length||typeof capabilityLookup!=="function")return"";
  var seen={},i,c=worldState.character;
  if(c&&c.spells){for(i=0;i<c.spells.length;i++){if(c.spells[i]&&c.spells[i].nm)seen[capBaseName(c.spells[i].nm)]=1;}}
  var lines=[],pj,ps;
  for(pj=0;pj<worldState.npcs.length;pj++){var n=worldState.npcs[pj];
    if(!n.partyMember||!n.charSheet||!n.charSheet.spells)continue;
    if(/\bdead\b/i.test(n.status||""))continue;
    for(ps=0;ps<n.charSheet.spells.length;ps++){var sp=n.charSheet.spells[ps];
      if(!sp||!sp.nm)continue;
      var key=capBaseName(sp.nm);if(seen[key])continue;
      var e=capabilityLookup(sp.nm);if(!e)continue;
      seen[key]=1;
      lines.push(capBibleLine(String(sp.nm).replace(/\s*\(.*\)/,"").trim(),e));}}
  if(!lines.length)return"";
  return "CANONICAL COMPANION SPELL RULES (authoritative for PARTY MEMBERS' spells — the same fixed-bounds discipline as the player's list above; each companion's expended slots are listed on their party sheet; mark a companion's leveled cast with [COMPANION_SPELL_USED:Name|spell]):\n"+lines.join("\n")+"\n\n";
}
```

Design note (decided here, flag to the user in the pre-commit summary): companion canon lines
carry NO per-owner `[EXPENDED]` marker — the party sheet's "Spells EXPENDED" clause (v1.239 F1
fix) is the slot-state carrier for companions. If the playtest shows companions casting spent
slots anyway (the F1 pattern recurring on the companion side), the follow-up is per-owner
annotation in THIS block, not a new mechanism.

### ③ Doc-line text (stable half — golden regen in the same commit)

Insert into the COMPANION SHEET TAGS cluster, after the `COMPANION_ABILITY` line
(tag_table.js:86) and before the "Use the companion's exact name" line:

```
"[COMPANION_SPELL_USED:Name|spellname] -- when a PARTY MEMBER casts a leveled spell (cantrips never expend; use the exact spell name). The player's own casts keep [SPELL_USED:].\n",
```

Update the frozen doc-block hash/length test and regenerate the stable golden per the
Stable-half discipline above.

### ④ Engine tests to add

- **"COMPANION_SPELL_USED marks the named companion's spell used"** — 2-companion party, tag for
  Lyra's `Bless`; assert Lyra's `used:true`, Bram's and the player's identical-named spells
  untouched. Failure condition: `findCompanionChar` fuzzy match landing on the wrong sheet.
- **"COMPANION_SPELL_USED on a cantrip is a no-op"** — lvl 0 spell stays `used:false` (mirrors
  the player rule).
- **"COMPANION_SPELL_USED with no matching companion / no matching spell is a warned no-op"** —
  unknown name mutates nothing (exercise both misses).
- **"[REST:long] restores a companion slot spent via the new tag"** — cast then rest in separate
  responses; assert `used:false` after (pins the E84 behavior against the new write path).
- **"companion spell canon renders in VOLATILE, never stable"** — same shape as the existing
  player-block test (engine-tests ~86): header present in `s.volatile`, absent in `s.stable`.
- **"companion canon dedupes against the player's block"** — player and companion both know
  Message; assert exactly ONE `- Message` line across `buildSpellBibleBlock()+buildCompanionSpellBibleBlock()`.
- **"non-caster party renders no companion canon block"** — returns `""` (byte-neutral prompt
  for existing sword-only parties).
- **"strip + doc coverage"** — the existing coverage guard passes only once the strip entry and
  handler both exist; update the frozen `_CT_TAGS` hash/length constants in the same commit.

### ⑤ Hazard notes

- **Volatile prompt growth** (the guard note on the UA25 row): a 2-caster party adds one canon
  line per distinct companion spell (~40 tokens each). MEASURE before/after (see ⑥) — prompt
  saturation is the historical rule-collapse trigger. The dedupe against the player's block and
  the returns-"" empty path keep the common case cheap.
- **Stable-half edit** = one-time cache invalidation; a MISTAKE here (e.g. the doc line
  accidentally interpolating live state) would kill the cache permanently. Tripwires: the UA5
  purity hash (warns every turn if the stable half churns), the byte-identical-across-mutations
  engine test (engine-tests ~577), the golden diff.
- **Wrong-sheet marking**: `findCompanionChar`'s contains-matching can cross two similarly named
  companions; the exact-match-first test in ④ pins current behavior. A false mark shows as a
  companion unable to cast until rest — visible on the party sheet and in the EXPENDED line.
- **Coverage-guard interaction**: forgetting the strip entry fails the suite (handler-not-stripped
  branch); forgetting the handler while adding the strip name also fails (phantom branch). This
  is the UA1 payoff working as designed — do not suppress either.

### ⑥ Verification steps

1. Suite green (new tests failing first, then passing — test-first on the handler).
2. Smoke-replay all three corpora: **expected diffs = none** (no historical corpus emits the new
   tag; the Haiku corpus that does is not in dev/ — see item 2 ⑥). End states byte-identical to
   item 0's captures.
3. Golden diff shows exactly the one new doc line; frozen-hash constants updated.
4. Volatile-size measurement: in the node harness (or preview console), build the prompt for a
   party with 2 casters before/after; record `s.volatile.length` delta in the commit message.
5. Preview: recruit a caster companion, have them cast; watch the `Name cast: Spell` system line,
   the party sheet EXPENDED clause, and Rest restoring it.
6. Live-model validation rides the post-batch playtest (steered companion-cast scene).

---

## Item 2 — UA26 + UA2: multi-enemy combat + `[ENEMY_SURRENDERS]`

**The design is RATIFIED — [MULTI_ENEMY_COMBAT.md](MULTI_ENEMY_COMBAT.md) is the authority**
(all four §7 decisions user-ratified 2026-07-10: no engine initiative; bare `ENEMY_HP` routes to
the ENGAGED foe with first-living+warn fallback; ENEMY_SURRENDERS is IMPLEMENTED (resolves UA2);
foe cap 8). This item transcribes it into code. Read that doc in full before starting; the notes
below add executor-level specifics only.

### ① Files & functions touched

- **tag_table.js** — rewrite the `COMBAT_START`, `ENEMY_HP`, `COMBAT_END` entries; retarget
  `COMBAT_STATS`/`COMBAT_IMMUNE`/`COMBAT_RESIST`/`COMBAT_VULN` to the most recently added foe;
  new `ENEMY_SURRENDERS` entry (insert between `ENEMY_HP` and `COMBAT_ROUND` so COMBAT_END's
  all-down close sees surrender state in the same response); remove `"ENEMY_SURRENDERS"` from
  `TAG_NO_HANDLER` (it stays in both strip lists — already present, no strip change); update the
  `LOCATION` entry's stale-combat warn (reads `worldState.combat.name` — gone in the new shape);
  new local helpers `combatLivingFoes`/`combatFoeByName` above the table. Three doc-line edits.
- **state.js** — `migrateWorldState` wraps a flat legacy combat object (idempotent).
- **api.js** — `buildSysPrompt`'s combat block (`cb`, api.js:226) renders every living foe +
  a defeated/surrendered summary line.
- **game.js** — `detectCoreMoments` reads `worldState.combat.name` for its "fighting X" string
  (game.js:451) — convert to engaged-or-first-living.
- **ui.js** — `updateCombat` panel per MULTI_ENEMY_COMBAT §5 (one row per foe, down foes struck
  through, cap 4 rows + "+N more", round unchanged). `syncUI` truthiness check unchanged.
- **dev/engine-tests.js** — the §8 battery; update parity-battery sanity asserts that read
  `worldState.combat.hp` to the foes[] shape.
- **Before coding, grep the repo for every combat read**: `worldState.combat.` and `combat.name|combat.hp|combat.maxHp|combat.ac|combat.atk|combat.dmg|combat.morale`
  — the enumerated read sites above are from this review; the grep at execution time is the
  guard against a site added since v1.260.

### ② Code sketch (ES5) — key handlers (full semantics in MULTI_ENEMY_COMBAT §3)

```js
// tag_table.js — UA26 helpers (multi-foe shape: worldState.combat={round,engaged,foes:[...]})
function combatLivingFoes(){var out=[],i,f=(worldState.combat&&worldState.combat.foes)||[];
  for(i=0;i<f.length;i++){if(!f[i].down&&f[i].hp>0)out.push(f[i]);}return out;}
function combatFoeByName(nm){
  var f=(worldState.combat&&worldState.combat.foes)||[],i,t=String(nm||"").toLowerCase().trim();
  for(i=0;i<f.length;i++){if(f[i].name.toLowerCase()===t)return f[i];}
  for(i=0;i<f.length;i++){var fn=f[i].name.toLowerCase();if(fn.indexOf(t)>=0||t.indexOf(fn)>=0)return f[i];}
  return null;
}
```

```js
{t:"COMBAT_START",apply:function(text,R){
  var csTags=text.match(/\[COMBAT_START:([^|\]]+)\|(\d+)\|(\d+)\|([+-]?\d+)\|([^|]+)\|([^\]]+)\]/g)||[];var csi;
  for(csi=0;csi<csTags.length;csi++){
    var cs2=csTags[csi].match(/\[COMBAT_START:([^|\]]+)\|(\d+)\|(\d+)\|([+-]?\d+)\|([^|]+)\|([^\]]+)\]/);if(!cs2)continue;
    var foe={name:cs2[1].trim(),hp:parseInt(cs2[2]),maxHp:parseInt(cs2[2]),ac:parseInt(cs2[3]),atk:parseInt(cs2[4]),dmg:cs2[5].trim(),morale:cs2[6].trim()};
    if(!worldState.combat){worldState.combat={round:1,engaged:null,foes:[foe]};R.muts.push("Combat: "+foe.name);continue;}
    // dup guard: EXACT case-insensitive name while that foe is alive = re-emission, not a new foe
    var dup=null,di,fl=worldState.combat.foes;
    for(di=0;di<fl.length;di++){if(fl[di].name.toLowerCase()===foe.name.toLowerCase()&&!fl[di].down&&fl[di].hp>0){dup=fl[di];break;}}
    if(dup){console.warn("[combat] duplicate COMBAT_START for living foe '"+foe.name+"' ignored (re-emission)");continue;}
    if(fl.length>=8){console.warn("[combat] foe cap (8) reached — COMBAT_START '"+foe.name+"' ignored (runaway-model guard)");continue;}
    fl.push(foe);R.muts.push("Combat +foe: "+foe.name);
  }}},
```

```js
{t:"ENEMY_HP",nc:1,apply:function(text,R){
  var eTags=text.match(/\[ENEMY_HP:[^\]]+\]/g)||[];var ei;
  for(ei=0;ei<eTags.length;ei++){
    if(!worldState.combat)break;
    var named=eTags[ei].match(/\[ENEMY_HP:([^|\]]+)\|\s*([+-]?\d+)[^\]]*\]/);
    var bare=named?null:eTags[ei].match(/\[ENEMY_HP:\s*([+-]?\d+)[^\]]*\]/);
    var foe=null,dv=0;
    if(named){dv=parseInt(named[2]);foe=combatFoeByName(named[1]);
      if(!foe){console.warn("[combat] named ENEMY_HP target not found: "+named[1].trim()+" — no mutation");continue;}}
    else if(bare){dv=parseInt(bare[1]);
      var living=combatLivingFoes();if(!living.length)continue;
      if(living.length===1)foe=living[0];
      else{var eng=worldState.combat.engaged?combatFoeByName(worldState.combat.engaged):null;
        if(eng&&!eng.down&&eng.hp>0)foe=eng;
        else{foe=living[0];console.warn("[combat] ambiguous bare ENEMY_HP with "+living.length+" foes up — routed to "+foe.name+"; use [ENEMY_HP:Name|-X]");}}}
    else continue;
    foe.hp=Math.max(0,foe.hp+dv);
    worldState.combat.engaged=foe.name;/* engagement pointer: any damage sets it (§2) */
    if(foe.hp<=0){foe.down="slain";worldState.combat.engaged=null;}
  }}},
```

```js
// NEW — between ENEMY_HP and COMBAT_ROUND. Resolves UA2 as IMPLEMENT (user call 2026-07-10).
{t:"ENEMY_SURRENDERS",nc:1,apply:function(text,R){
  if(!worldState.combat)return;
  var nT=text.match(/\[ENEMY_SURRENDERS:([^\]]+)\]/g)||[];var si;
  for(si=0;si<nT.length;si++){var sm=nT[si].match(/\[ENEMY_SURRENDERS:([^\]]+)\]/);if(!sm)continue;
    var foe=combatFoeByName(sm[1]);
    if(!foe){console.warn("[combat] ENEMY_SURRENDERS target not found: "+sm[1].trim());continue;}
    if(!foe.down&&foe.hp>0){foe.down="surrendered";R.muts.push(foe.name+" surrenders");
      if(worldState.combat.engaged===foe.name)worldState.combat.engaged=null;}}
  if(/\[ENEMY_SURRENDERS\]/.test(text)){var lv=combatLivingFoes(),li;
    for(li=0;li<lv.length;li++){lv[li].down="surrendered";R.muts.push(lv[li].name+" surrenders");}
    worldState.combat.engaged=null;}}},
```

```js
{t:"COMBAT_END",nc:1,apply:function(text,R){
  var ce=text.match(/\[COMBAT_END:([^\]]+)\]/);
  if(ce){worldState.combat=null;R.muts.push("Combat: "+ce[1].trim());return;}
  // all-foes-down auto-close — the single-foe kill safety net generalized (§2): any surrendered
  // foe among the down set closes as "surrender" (≡ truce); otherwise victory.
  if(!worldState.combat)return;
  var f=worldState.combat.foes,i,anyUp=false,surr=false,names=[];
  for(i=0;i<f.length;i++){if(!f[i].down&&f[i].hp>0){anyUp=true;break;}
    if(f[i].down==="surrendered")surr=true;names.push(f[i].name);}
  if(anyUp)return;
  worldState.combat=null;
  R.muts.push(surr?"Combat: surrender ("+names.join(", ")+")":"Combat: victory ("+names.join(", ")+")");}},
```

```js
// COMBAT_STATS / IMMUNE / RESIST / VULN — retarget to the MOST RECENTLY ADDED foe
// ("alongside COMBAT_START" adjacency rule, §3). Pattern for all four:
{t:"COMBAT_STATS",nc:1,apply:function(text,R){var cstats=text.match(/\[COMBAT_STATS:STR:(\d+)\|DEX:(\d+)\|CON:(\d+)\|INT:(\d+)\|WIS:(\d+)\|CHA:(\d+)\|CR:([0-9.\/]+)\]/);
  if(cstats&&worldState.combat&&worldState.combat.foes.length){
    var lastFoe=worldState.combat.foes[worldState.combat.foes.length-1];
    lastFoe.stats={STR:+cstats[1],DEX:+cstats[2],CON:+cstats[3],INT:+cstats[4],WIS:+cstats[5],CHA:+cstats[6],CR:cstats[7]};}}},
```

```js
// state.js — migrateWorldState addition (idempotent: .foes presence short-circuits):
if(worldState.combat&&!worldState.combat.foes){var _oc=worldState.combat;
  worldState.combat={round:_oc.round||1,engaged:null,foes:[_oc]};_mig=true;}
```

```js
// game.js — detectCoreMoments foe string (line ~451), foes[]-aware:
var foe="";
if(worldState.combat&&worldState.combat.foes&&worldState.combat.foes.length){
  var _fn=worldState.combat.engaged||worldState.combat.foes[0].name;
  foe=" fighting "+_fn;}
```

**Deliberate behavior changes to state in the commit message** (each is a designed fix, not a
regression): `COMBAT_START` and `ENEMY_HP` become g-loop multi-match (legacy matched only the
FIRST occurrence — multi-foe responses need every tag applied); named `ENEMY_HP` mutates where
legacy dropped it; a second `COMBAT_START` adds where legacy overwrote.

### ③ Doc-line text (stable half — golden regen in the same commit)

Replace tag_table.js line 55 with:

```
"[COMBAT_START:name|hp|ac|atkbonus|dmgdie|morale] -- emitting it DURING an active fight adds ANOTHER enemy to the same encounter (one tag per distinct foe; a faceless group can be one pooled entry like 'Goblin pack'). [ENEMY_HP:-X] or [ENEMY_HP:Name|-X] -- use the named form whenever more than one enemy is up. [COMBAT_ROUND:N] [COMBAT_END:victory/defeat/fled]\n",
```

Add a new line directly after the CLOSE EVERY FIGHT line (tag_table.js:58):

```
"[ENEMY_SURRENDERS] (all remaining enemies yield) or [ENEMY_SURRENDERS:Name] (one enemy yields) -- the fight ends for that foe but they LIVE; when a surrendered foe is a speaking character, register them with [NPC:name|status|relation] in the same response so they enter the world properly\n",
```

(The pooled-entry sentence deviates slightly from §4's "do not spend stable-half tokens" note —
it is one clause, not a paragraph; if the executor prefers strict §4 compliance, drop the
parenthetical and keep the rest verbatim. Flag whichever was chosen in the commit.)

Update the frozen doc-block hash/length; regenerate the golden; diff by eye.

### ④ Engine tests to add (transcribe MULTI_ENEMY_COMBAT §8 — every line is a named test)

- "COMBAT_START during active combat ADDS a foe (the H2 fix)" — 2 foes tracked, first foe's HP
  untouched. Failure condition: the legacy overwrite (second foe silently lost).
- "duplicate living-foe COMBAT_START ignored + warn"; "9th foe ignored + warn (cap 8)".
- "named ENEMY_HP exact match"; "named ENEMY_HP case-insensitive contains (both directions)";
  "named ENEMY_HP no-match warns, mutates NOTHING" — the drop class, now loud.
- "named ENEMY_HP sets combat.engaged".
- "bare ENEMY_HP, single living foe → that foe" (the N=1 legacy case, preserved).
- "bare ENEMY_HP with 2+ living → the ENGAGED foe"; "engaged foe down → first living + warn"
  (assert the warn fired AND the mutation landed — narrated damage must not vanish).
- "foe at 0 HP marks down:'slain', stays in foes[] (not spliced)".
- "ENEMY_SURRENDERS:Name marks one foe"; "bare ENEMY_SURRENDERS marks all living";
  "all-surrendered auto-closes with outcome 'surrender'".
- "all-foes-slain auto-closes as victory"; "one-down-one-up does NOT close".
- "COMBAT_END closes mid-encounter regardless of foe states".
- "F2 location-change clear with 2 foes live (whole encounter clears; same-response
  COMBAT_START exempts)".
- "COMBAT_STATS/COMBAT_IMMUNE bind to the most recently added foe".
- "migrateWorldState wraps a flat legacy combat object; idempotent on re-run" — run twice,
  assert single wrap. Failure condition: double-wrap nesting foes[ {foes:[...]} ].
- "multiple ENEMY_HP tags in one response all apply (g-loop)" — the deliberate change pinned.
- Existing sanity asserts in the converted parity battery updated to `combat.foes[0].hp` etc.

### ⑤ Hazard notes

- **Migration on live-combat saves**: a bug here corrupts `worldState.combat` at load for anyone
  mid-fight — per the UA10 discipline, test migration against a REAL exported save with active
  combat (export one from preview before starting), not only the fixture.
- **Missed read sites**: any surviving `combat.name`/`combat.hp` read returns `undefined`
  silently (NaN HP bars, empty core-memory strings). The execution-time grep in ① is mandatory;
  known sites are enumerated there and in MULTI_ENEMY_COMBAT §2.
- **Volatile combat block growth**: ~1 line/foe; measure a 4-foe prompt before/after (§4).
- **Stable-half edits**: two doc lines — same golden/purity discipline as item 1; bundle in the
  same DEPLOY as the other doc-line items.
- **UA2 closure**: removing ENEMY_SURRENDERS from `TAG_NO_HANDLER` without adding the handler
  fails the coverage guard (phantom branch) — the guard is the tripwire; let it drive.
- **Panel regression on mobile**: `#cpanel` is shallow — the 4-row cap + overflow line is a
  REQUIREMENT, not polish; screenshot the 5-foe case (visual work: render is ground truth).

### ⑥ Verification steps

1. Suite green (§8 battery written FIRST where practical — the add-foe and named-ENEMY_HP tests
   fail against the old handlers by construction).
2. Smoke-replay all three dev/ corpora: end states must be byte-identical to item 1's captures
   **except** turns whose raw text contains a mid-combat `COMBAT_START` or named `ENEMY_HP` —
   enumerate any such turns and verify each diff is the designed capture (expected-diff mode).
3. **The Haiku expected-diff replay** (§8's money evidence): the 150-turn Haiku window's raw
   corpus is NOT in dev/ (only v1238/v1241/v1258 are). First check AUDIT_haiku_v1.230.md for
   where the run's corpus was persisted (test-runs-always-audit says it exists somewhere); if
   recoverable, replay it and assert the 18 lost `COMBAT_START`s and 12 dropped named
   `ENEMY_HP`s now mutate — in exactly those places and nowhere else. If NOT recoverable, run a
   fresh steered multi-foe harness window (dev/playtest-harness.js) and keep ITS corpus as the
   regression asset; note the substitution in the commit.
4. Golden diff = exactly the two doc lines; frozen hashes updated.
5. Preview: hand-drive a 3-foe encounter (Table Talk steering) — panel rows, named damage,
   partial-down strike-through, surrender close, auto-clear; screenshot the panel at 3 and 5 foes,
   desktop + 375px.
6. Post-batch playtest steers a 3-foe fight live (spine gate).

---

## Item 3 — UA38-①: exits-as-canon in the `[LOCATION_DESC:]` doc line

The ②③ halves (suggestion-call grounding) shipped v1.245. This is the remaining ⛨ half: the GM
is told that a location's canonical description must enumerate its exits, so the write-once desc
becomes the fence against invented scenery (a suggestion model fed the desc can no longer invent
a lockable exit the canon never had — and neither can the GM under tapped-suggestion pressure).

### ① Files & functions touched

- **tag_table.js** — one `TAG_DOC_LINES` edit (line 48).
- **dev/engine-tests.js** — frozen doc-block hash/length constants; one content test.

### ② Code sketch

Doc-line-only commit; no handler or logic change anywhere.

### ③ Doc-line text (stable half — golden regen in the same commit)

Replace tag_table.js line 48 with:

```
"[LOCATION_DESC:text] -- canonical description of this location; emit ONCE on first visit ONLY; stored permanently and never overwritten. ALWAYS name every visible exit and where each leads -- exits are canon: a way in or out that the description never mentioned does not exist\n",
```

### ④ Engine tests to add

- **"LOCATION_DESC doc line carries the exits-are-canon clause"** — `buildStateTagsDoc()` contains
  `"ALWAYS name every visible exit"`. Failure condition: a later doc-line refactor silently
  dropping the clause (the doc block is one big join — a deleted array element has no other
  symptom).
- Frozen hash/length constants updated (the existing frozen test enforces deliberateness).

### ⑤ Hazard notes

- **Write-once permanence**: a first-visit desc that OMITS exits is now permanently exit-silent —
  the UA38 row's documented watch. If play shows first-visit omissions biting, the designed
  upgrade is append-only `[EXIT:]` entries (a new table entry — additive, post-batch); do NOT
  loosen write-once instead.
- Stable-half edit — standard golden/purity discipline; deploy bundled with the batch.
- Zero parser contact — the only silent-failure vector is the doc-block hash test being updated
  blindly without eyeballing the golden diff. Eyeball it.

### ⑥ Verification steps

1. Suite green; golden diff shows exactly the one-line change.
2. Preview: visit a NEW location, read the emitted `[LOCATION_DESC:]` in the raw response
   (console) — exits named. One turn is a smoke check; the real read is the post-batch playtest
   (first-visit descs across several locations, then a suggestion-button check that offered
   exits all exist in canon).

---

## Item 4 — UA39-②: GM-side distance grounding (the range-judgment rule)

UA39-① (suggestion-side canon fences) and the model escalation shipped v1.245/v1.249. This is
the GM half: the model enforces ranges stated AS distances but has no numeric model for scene
geography ("across town" vs 120ft was a judgment call it lost under player-intent pressure,
t355). The data is already injected — `buildGeoBlock` prints `Location size: … (~N min to cross)`
(api.js:14/16) — what is missing is the RULE that converts that data into a refusal.

### ① Files & functions touched

- **tag_table.js** — one new `TAG_DOC_LINES` line (stable half — the audit row's designated home),
  inserted directly after the `SPELL_USED` line (tag_table.js:60) so it sits beside the casting
  rules it governs.
- **dev/engine-tests.js** — frozen hash/length + one content test.
- *(Deliberately NOT touched: `buildGeoBlock` — the travelMins data line already exists;
  `buildSpellBibleBlock`'s header — keep the volatile header stable this commit. If the playtest
  shows the stable rule alone is not obeyed, the escalation path is a clause appended to the
  CANONICAL SPELL RULES header — volatile, zero cache cost — as a follow-up commit.)*

### ② Code sketch

Doc-line-only commit.

### ③ Doc-line text (stable half — golden regen in the same commit)

Insert after the `[SPELL_USED:]` line (tag_table.js:60):

```
"SPELL RANGES ARE PHYSICS: before any cast resolves, judge the distance CONCRETELY against the spell's listed range using the GEOGRAPHY block's location size -- a target in another building, street, or district, or whose current location is unknown, is BEYOND any short-range spell (~120ft or less) no matter how urgent the player's intent; narrate the failed reach and offer what the listed range actually allows\n",
```

### ④ Engine tests to add

- **"distance-grounding rule present in the STATE TAGS doc"** — `buildStateTagsDoc()` contains
  `"SPELL RANGES ARE PHYSICS"`. Failure condition: silent drop in a later doc refactor.
- **"rule lands in the STABLE half"** — `buildSysPrompt().stable` contains the marker,
  `.volatile` does not (guards against a future move accidentally duplicating it).
- Frozen hash/length constants updated.

### ⑤ Hazard notes

- This is a PROMPT-ONLY intervention against a judgment failure — the class where "engine tests
  prove the injection is sent; only live turns prove the model obeys" applies with full force.
  The validation is the playtest's baited re-run of the exact t355 shape (Message at a target
  across town), Sonnet path.
- Stable-half edit — standard discipline; deploy bundled.
- Wording hazard: the rule must NOT contradict the money-tested CANONICAL SPELL RULES header
  ("never expand… honor these over any remembered version") — it extends the same physics frame.
  Read both side by side in the golden diff before committing.

### ⑥ Verification steps

1. Suite green; golden diff = one line.
2. Preview bait turn: place a known NPC "elsewhere in town" and attempt a Message cast at them —
   expect refusal with narrated reach failure (the v1.238 money-test shape at sub-mile distance).
3. Post-batch playtest repeats the bait cold, plus the tapped-suggestion variant (the original
   t355 vector: a suggestion button should no longer offer it — v1.245 fence — and the GM should
   refuse it if hand-typed).

---

## Item 5 — #46 Phase B: the condition `cause` field

Phase A (turn-stamps, injection with age, audit teeth, expiries, toasts) is shipped through
v1.257. Phase B adds provenance: `[CONDITION:name|duration|cause]` and the 4-arg companion form.
`condInjectFmt` (api.js:43) ALREADY renders `x.cause` as `from …` — the read path is waiting;
this commit adds the write path + doc lines.

### ① Files & functions touched

- **tag_table.js** — `CONDITION` and `COMPANION_CONDITION` entry regex + upsert edits; two
  `TAG_DOC_LINES` edits (lines 75 and 84). No strip changes (no new tag names).
- **dev/engine-tests.js** — tests in ④; frozen doc hash/length.
- *(Deliberately NOT touched: the `stampNewConditions` post-pass (game.js:490) — it still owns
  turn-stamps, `until` parsing, and toasts. Folding the post-pass into the handlers was mooted at
  cutover but is a SEPARATE concern — do not bundle it here.)*

### ② Code sketch (ES5)

```js
// tag_table.js — CONDITION entry (3rd arg = cause, #46 Phase B; 2-arg form stays valid):
{t:"CONDITION",apply:function(text,R){var condTags=text.match(/\[CONDITION:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/g)||[];var condi;
  for(condi=0;condi<condTags.length;condi++){var condp=condTags[condi].match(/\[CONDITION:([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/);if(!condp)continue;
  if(!worldState.character.conditions)worldState.character.conditions=[];
  var cnm=condp[1].trim(),cdur=condp[2].trim(),ccause=condp[3]?condp[3].trim():"",calready=false,condj;
  for(condj=0;condj<worldState.character.conditions.length;condj++){
    if(worldState.character.conditions[condj].name.toLowerCase()===cnm.toLowerCase()){
      worldState.character.conditions[condj].duration=cdur;
      // cause is PROVENANCE — the affliction's origin. First writer wins (same spirit as the
      // onset turn-stamp surviving duration updates); a re-emission never rewrites history.
      if(ccause&&!worldState.character.conditions[condj].cause)worldState.character.conditions[condj].cause=ccause;
      calready=true;break;}}
  if(!calready){var newCond={name:cnm,duration:cdur};if(ccause)newCond.cause=ccause;
    worldState.character.conditions.push(newCond);R.muts.push("Condition: "+cnm);}}}},
```

`COMPANION_CONDITION` gets the mirror-image edit: regex
`/\[COMPANION_CONDITION:([^|\]]+)\|([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/` (name|cond|duration|cause?),
same first-writer-wins cause upsert onto the charSheet condition.

**Regex compatibility note (state in the commit):** the duration group narrows from `([^\]]+)`
to `([^|\]]+)`. A free-text duration CONTAINING a pipe would previously be swallowed whole and
now splits at the pipe into duration|cause. No known duration uses a pipe ("until antidote",
"saving throw each hour CON DC 15"); the backward-compat test in ④ pins the 2-arg form, and a
pipe-bearing duration now lands its tail in `cause` — visible on the sheet, not lost.

### ③ Doc-line text (stable half — golden regen in the same commit)

Replace line 75:

```
"[CONDITION:name|duration|cause] [CONDITION_REMOVED:name] -- duration is descriptive (e.g. 'until antidote', 'saving throw each hour CON DC 15'); cause = what inflicted it (e.g. 'Reaper Spider bite') -- ALWAYS name the cause so the sheet carries the why\n",
```

Replace line 84 (companion cluster):

```
"[COMPANION_CONDITION:Name|condName|duration|cause] [COMPANION_CONDITION_REMOVED:Name|condName]\n",
```

### ④ Engine tests to add

- **"CONDITION 3-arg stores cause; condInjectFmt renders 'from …'"** — apply
  `[CONDITION:Poisoned|until antidote|Reaper Spider bite]`, assert `.cause` and that
  `condInjectFmt` output contains `from Reaper Spider bite`.
- **"CONDITION 2-arg (legacy form) still parses — no cause, no error"** — THE backward-compat
  failure condition: old saves replay old-format responses; a regex mistake here breaks every
  historical condition tag. Run it against a corpus-shaped 2-arg tag.
- **"cause is first-writer-wins"** — re-emit with a different cause; original survives, duration
  updates (mirrors the onset-stamp semantics already tested at Phase A).
- **"COMPANION_CONDITION 4-arg files cause on the charSheet; 3-arg legacy form still parses"**.
- **"cause survives into the party-sheet injection"** — `buildSysPrompt().volatile` contains the
  companion's `from …` clause (the write-path-with-no-read-path class, inverted — pin the read).
- Frozen doc hash/length updated.

### ⑤ Hazard notes

- **The regex narrowing** (above) — the compat tests are the tripwire; write them FIRST against
  the current handler (they pass), then apply the regex change (they must STILL pass).
- **Double-write with the post-pass**: `stampNewConditions` diffs by NAME only — a cause added to
  an existing condition does not look "new", so no spurious toast/stamp. Verified by the
  first-writer-wins test running through a full `applyMuts`+post-pass cycle in preview.
- Stable-half edits — standard discipline; deploy bundled.
- Silent failure this could cause: a malformed cause capture polluting `duration` (or vice
  versa) would feed wrong text into the audit teeth (`buildConditionAudit` prints duration) —
  the compat + render tests cover both fields end-to-end.

### ⑥ Verification steps

1. Suite green (compat tests first).
2. Smoke-replay all three corpora: **zero end-state diffs expected** (no historical response
   carries a 3-arg CONDITION; the 2-arg path is byte-compatible). Any diff = regex regression.
3. Golden diff = the two doc lines.
4. Preview: inflict a condition via a steered turn; sheet shows `Name — tN · cause — duration`,
   injection carries `(duration; since tN; from cause)`; then `CONDITION_REMOVED` clears it and
   the ✓ toast fires (Phase A machinery undisturbed).

---

## Item 6 — #47 write path: epithets via player-routed `[NPC_ALIAS:]`

Display + schema shipped v1.251 (`character.aliases[]`/`charSheet.aliases[]`, migration at
state.js:139/144, "Also known as" on the sheets). This commit is the write path: the GM grants
an epithet at a dramatic moment by emitting `[NPC_ALIAS:]` with the PLAYER's (or a companion's)
name, and the handler routes it to the schema instead of NPC memory.

### ① Files & functions touched

- **tag_table.js** — `NPC_ALIAS` entry gains the routing preamble (player → schema only;
  party member → schema AND memory); one `TAG_DOC_LINES` edit (line 67). No strip changes.
- **dev/engine-tests.js** — tests in ④; frozen doc hash/length.

### ② Code sketch (ES5)

```js
// tag_table.js — inside the NPC_ALIAS per-match loop, BEFORE the existing memory.npcs create:
var alCanon=alp[1].trim(),alAlias=alp[2].trim();
// #47: a player-name (or literal "player") match is an EPITHET — character schema, NOT NPC
// memory. Must short-circuit BEFORE the memory.npcs upsert below: the legacy path would
// otherwise create a memory.npcs entry FOR THE PLAYER (identity leak — the rejected design).
var _plNm=(worldState.character&&worldState.character.name)||"";
if(/^player$/i.test(alCanon)||(_plNm&&alCanon.toLowerCase()===_plNm.toLowerCase())){
  if(!worldState.character.aliases)worldState.character.aliases=[];
  if(worldState.character.aliases.indexOf(alAlias)<0){
    worldState.character.aliases.push(alAlias);
    R.muts.push("Epithet: "+alAlias);
    if(typeof showToast==="function")showToast("✦ Epithet earned: "+alAlias);
  }
  continue;
}
// party member: epithet on the SHEET (display) *and* the normal memory alias (resolution) —
// the two alias layers stay distinct but a companion legitimately has both.
var _alCs=findCompanionChar(alCanon);
if(_alCs){if(!_alCs.aliases)_alCs.aliases=[];if(_alCs.aliases.indexOf(alAlias)<0)_alCs.aliases.push(alAlias);}
/* …existing memory.npcs / worldState.npcs alias code runs unchanged from here… */
```

### ③ Doc-line text (stable half — golden regen in the same commit)

Replace line 67:

```
"[NPC_ALIAS:canonical_name|alias] -- when a character is given a new name or title; links alias to canonical; prevents duplicate entries; emit alongside the NPC tag that introduces the alias. If the named character is the PLAYER or a party member, the alias is recorded as a TITLE/EPITHET on their character sheet ('Butcher of Ashfen') -- grant epithets at dramatic moments the story has earned\n",
```

### ④ Engine tests to add

- **"player-name NPC_ALIAS routes to character.aliases and creates NO memory.npcs entry"** —
  apply `[NPC_ALIAS:Tess|Wolf of Ashfen]` on the makeWorld fixture; assert
  `worldState.character.aliases` contains it AND `memory.npcs["Tess"]===undefined` AND no
  worldState.npcs entry named Tess. Failure condition: the identity leak — the legacy handler
  unconditionally creates `memory.npcs[alCanon]`, so a naive addition that checks AFTER the
  create ships the exact bug the design rejected.
- **"literal 'player' routes the same way"** (mirrors the NPC_LINK `_plMap` convention).
- **"epithet dedupe"** — same tag twice → one entry, one toast.
- **"party-member NPC_ALIAS lands on BOTH charSheet.aliases and memory alias"** — companion
  fixture; assert schema entry AND `memory.npcs[name].aliases` entry (resolution unbroken: a
  follow-up `[NPC_NOTE:alias|…]` still resolves).
- **"ordinary NPC path byte-unchanged"** — a non-party NPC alias produces exactly the legacy
  worldState/memory shape (run the parity-battery alias fixture and compare fields).
- Frozen doc hash/length updated.

### ⑤ Hazard notes

- **The identity leak** (above) is the one real trap — the short-circuit placement is
  load-bearing. The ④ test written FIRST fails against any wrong placement.
- **Name collision**: an NPC who genuinely shares the player's name would have aliases routed to
  the player's sheet. Accepted edge (the campaign already can't distinguish them in prose);
  document in the handler comment.
- **PC↔NPC swap symmetry**: `_switchPlayerCharacter` promotes `charSheet`→`character` wholesale,
  so `aliases[]` rides automatically — no swap-path code needed; pin with a comment, not code.
- Stable-half edit — standard discipline; deploy bundled.

### ⑥ Verification steps

1. Suite green (leak test first).
2. Smoke-replay corpora: zero end-state diffs expected UNLESS a historical response aliased a
   then-party-member — if any diff appears, verify it is exactly a schema-aliases addition
   (additive field, benign) and record it.
3. Golden diff = one line.
4. Preview: Table-Talk-steer the GM into granting an epithet; ✦ toast, "Also known as" renders
   on the char sheet, no ghost player entry in the sidebar NPC list.

---

## Item 7 — #50a: item provenance + consumption doc lines

Playtest-quantified: 4 blasting charges survived their own detonation (no `[ITEM_LOST:]`), and
a bare `blood` inventory entry with no recoverable origin. Two stable-half nudges; zero parser
contact. **The open #50a design question (allowing syncCharSheet audit corrections for missed
decrements, with an anti-double-spend guard) is NOT in this commit — it needs a user decision
first; leave the TODO row's question standing.**

### ① Files & functions touched

- **tag_table.js** — two new `TAG_DOC_LINES` lines directly after the ITEM TAG FORMAT line
  (tag_table.js:46).
- **dev/engine-tests.js** — frozen doc hash/length + content test.

### ② Code sketch

Doc-line-only commit.

### ③ Doc-line text (stable half — golden regen in the same commit)

Insert after line 46:

```
"CONSUMABLES ARE SPENT: the moment a consumable is used -- a potion drunk, a charge detonated, ammunition fired, a scroll read -- emit [ITEM_LOST:name] in that SAME response; narrated consumption without the tag leaves a ghost item on the sheet forever\n",
"ITEM NAMES CARRY PROVENANCE: name items so their origin stays recoverable ('Vial of basilisk blood', 'Signet ring (from Sheriff Hemlock)') -- never a bare noun like 'blood'; the name is the ONLY thing the sheet keeps, so where or whom it came from must live in it\n",
```

*(Note: parenthetical qualifiers keep items UNSTACKED by design — `_invNorm` treats
"Sword (rusty)" ≠ "Sword (enchanted)" — which is correct for provenance-bearing uniques and
irrelevant for generic consumables, which should stay bare-named + stacked. The two lines are
written to steer exactly that split.)*

### ④ Engine tests to add

- **"consumption + provenance doc lines present"** — `buildStateTagsDoc()` contains
  `"CONSUMABLES ARE SPENT"` and `"ITEM NAMES CARRY PROVENANCE"`.
- Frozen doc hash/length updated. No mutation tests (no parser change) — asserting the golden
  is the whole surface.

### ⑤ Hazard notes

- Prompt-only; the silent-failure vector is nil beyond a blind hash update — eyeball the golden
  diff. Stable-half edit; deploy bundled.
- Watch item: if provenance-in-names inflates stacking fragmentation in play (many one-off
  qualified items), the follow-up is display-side grouping, never a parser change.

### ⑥ Verification steps

1. Suite green; golden diff = two lines.
2. Post-batch playtest scenario: buy 3 charges, detonate one (expect `[ITEM_LOST:]` same
   response, count drops to 2 — the exact t455 failure re-baited); loot an ambiguous fluid
   (expect a provenance-bearing name).
3. #50(c)'s harness consumable-lifecycle test rides UA37's validation batch, not this commit.

---

## Item 8 — UA42: quest-reopen guard (F3) + completion/failed toast

F3 reproduced twice ORGANICALLY in Playtest 2: a completed-then-archived quest silently
resurrected by a bare `[QUEST:title|active]` upsert — archived AND live simultaneously, double
rewards on offer. And two quests completed with ZERO player-visible feedback. Both are edits to
the single `QUEST` table entry. *(Batch-mates UA30/UA31 stay OUT — they touch `buildQuestBlock`,
a different function and concern; the UberAudit row's "one quest-teeth pass" refers to a later
pass, and this commit stays single-concern.)*

### ① Files & functions touched

- **tag_table.js** — `QUEST` entry: archived-title guard before creation; toast on
  completed/failed. No doc-line change (the lifecycle instructions already exist; the guard is
  engine teeth, not prompt).
- **dev/engine-tests.js** — tests in ④ (uses the `__toasts` capture array).

### ② Code sketch (ES5)

Inside the `QUEST` per-match loop, after `qIdx` is computed and found `<0` (i.e. about to create):

```js
// UA42/F3: a title already ARCHIVED as completed/failed must not silently resurrect via a
// bare upsert (Playtest 2: 'Chapel in the Mud' completed t7, re-created by [QUEST:x|active]
// at t9 and t60 — archived AND live at once, rewards payable twice). Loud skip; a genuine
// follow-up quest needs a NEW title.
if(qIdx<0&&memory.quests){
  var _ak=Object.keys(memory.quests),_ai,_arch=null;
  for(_ai=0;_ai<_ak.length;_ai++){if(_ak[_ai].toLowerCase()===qTitle.toLowerCase()){_arch=memory.quests[_ak[_ai]];break;}}
  if(_arch&&(_arch.status==="completed"||_arch.status==="failed")){
    console.warn("[quest] blocked re-creation of archived quest '"+qTitle+"' ("+_arch.status+") — a follow-up needs a NEW title");
    R.muts.push("Quest '"+qTitle+"' already "+_arch.status+" — not reopened");
    continue;
  }
}
```

And where `qStat==="completed"||qStat==="failed"` triggers `archiveQuest` (end of the loop body):

```js
if(qStat==="completed"||qStat==="failed"){
  // UA42: player-visible closure — the toast names the same-response rewards so a close
  // never again passes in silence (two Playtest-2 completions had ZERO feedback).
  var _rw=[],_rx=text.match(/\[XP:\s*\+?(\d+)/);if(_rx)_rw.push("+"+_rx[1]+" XP");
  var _rg=text.match(/\[GOLD:\s*\+?(\d+)/);if(_rg)_rw.push("+"+_rg[1]+" gp");
  var _ri=(text.match(/\[ITEM_GAINED:[^\]]+\]/g)||[]).length;if(_ri)_rw.push(_ri+" item"+(_ri>1?"s":""));
  if(typeof showToast==="function")showToast((qStat==="completed"?"✓ Quest completed: ":"✗ Quest failed: ")+qTitle+(_rw.length?" — "+_rw.join(", "):""));
  archiveQuest(qTitle,qStat);
}
```

**Design decisions taken here (flag in the pre-commit summary):** ① the guard blocks ALL
re-creates of an archived completed/failed title — including a fresh `offered` (a sequel quest
must be retitled; the loud warn + muts line make the block visible so the GM/player can react).
The UberAudit row's alternative ("an explicit new-quest form") was not chosen — it would add tag
vocabulary for a rare case. ② The reward scan reads positive `[GOLD:+N]` only; a same-response
gold DEDUCTION is not a reward. ③ `declined` (mapped to `failed` in the tag path) also toasts as
✗ — acceptable; the Quest Journal's own decline path is separate and unchanged.

### ③ Doc lines

None — no stable-half change, no golden regen, no cache invalidation. (This is the one batch
item with mutation-behavior change but zero prompt change.)

### ④ Engine tests to add

- **"archived-completed title cannot be resurrected by a bare active upsert (the F3 repro)"** —
  create quest → `[QUEST:X|completed]` (archives) → `[QUEST:X|active]`; assert `questLog` does
  NOT contain X, `memory.quests` entry intact, muts line recorded. This IS the Playtest-2
  failure input, exactly.
- **"archived-failed title equally blocked"**; **"archived title blocked even as |offered"**
  (pins decision ①).
- **"a LIVE quest's status upsert still works"** — active→completed unchanged (the guard only
  fires on the create path, `qIdx<0`).
- **"an unarchived new title still creates normally"** — the guard must not overmatch.
- **"completion toast fires and names same-response rewards"** —
  `[QUEST:X|completed][XP:200][GOLD:+50][ITEM_GAINED:Ring]` → `__toasts` contains
  `"✓ Quest completed: X — +200 XP, +50 gp, 1 item"`. Failure condition: reward regexes
  misreading (e.g. counting `[GOLD:-5]` as a reward — add a negative-gold assertion).
- **"failed toast fires without rewards"** — bare `[QUEST:X|failed]` → `"✗ Quest failed: X"`.

### ⑤ Hazard notes

- **Behavior change vs frozen legacy** — this is precisely why item 0 precedes the batch; with
  legacy gone there is no parity gate to fight, and the smoke-replay diffs become the designed
  evidence (⑥).
- **Over-blocking a legitimate same-title sequel**: mitigated by the loud warn + visible muts
  line; the GM retitles. If play shows this biting, the escape hatch design (an explicit
  new-quest tag form) is a user decision, not an executor improvisation.
- **Toast inside a handler**: precedented (the `offered` toast and SKILL_SUCCESS toast already
  live in handlers); the engine-test stub captures it; no shadow machinery remains to stub after
  item 0.
- **Case-folded archive lookup**: `memory.quests` is keyed by original-case title; the guard's
  case-insensitive scan mirrors the live-log matching above it — do not "optimize" to a direct
  key hit.

### ⑥ Verification steps

1. Suite green (F3 repro test first — it fails against the current handler by design).
2. Smoke-replay `dev/corpus_playtest_v1258.json`: turns 9 and 60 (the organic F3 events) must
   now show the blocked-reopen muts line, and the end state must hold Chapel in the Mud ONLY in
   `memory.quests` — this is expected-diff mode with the exact diff enumerated. The other two
   corpora: zero diffs expected.
3. Preview: complete a quest live; ✓ toast with rewards; then Table-Talk-bait the GM into
   re-emitting the completed title as active; watch the block + warn.

---

## Item 9 — UA41: `buildReciprocityNudge` — the third `NOTE_BUILDERS` entry

The Morwen class: player→companion "Wife" filed for 150+ turns with no reciprocal entry on the
companion's sheet. Playtest 2 showed explicit bond SCENES reciprocate unprompted — the nudge is
a backstop for quiet shifts, sized accordingly: once per (entity, descriptor) pair, ever.
Registry + detection only; **zero parser contact, zero doc lines, zero golden regen** — the
cheapest and safest item, ordered last per the user's priority call.

### ① Files & functions touched

- **api.js** — new `buildReciprocityNudge()` beside `buildConditionAudit` (api.js:136); add it to
  `NOTE_BUILDERS` (api.js:169). Nothing else — `sendAction` already orchestrates via
  `buildEngineNotes()` (the registry's whole point: a new nag is a list entry, not sendAction
  surgery).
- **dev/engine-tests.js** — tests in ④.

### ② Code sketch (ES5)

```js
// UA41: relationship reciprocity — the Morwen class (t455): the GM files player-centric
// [RELATIONSHIP:] at the moment and never the mirror [COMPANION_RELATIONSHIP:], so marriages
// sat one-directional for 150+ turns. Deterministic detect / GM decides, same shape as
// buildQuestEscalation. Backstop sizing (Playtest-2 evidence: explicit bond scenes reciprocate
// unprompted): fires ONCE per (entity, descriptor) pair, ever; silent mid-combat.
function buildReciprocityNudge(){
  if(!worldState||!worldState.character||worldState.combat)return"";
  var c=worldState.character,rl=c.relationships||[],i,j;
  for(i=0;i<rl.length;i++){var r=rl[i];
    if(!r||!r.entity||!r.descriptor)continue;
    if(typeof WEIGHTY_REL_RE==="undefined"||!WEIGHTY_REL_RE.test(r.descriptor))continue;
    var cs=findCompanionChar(r.entity);if(!cs)continue;/* party members with sheets only */
    var key=r.entity+"|"+r.descriptor;
    if(worldState.reciprocityNudged&&worldState.reciprocityNudged[key])continue;
    var mirrored=false,cr=cs.relationships||[];
    for(j=0;j<cr.length;j++){if(cr[j].entity&&cr[j].entity.toLowerCase()===c.name.toLowerCase()){mirrored=true;break;}}
    if(mirrored)continue;
    if(!worldState.reciprocityNudged)worldState.reciprocityNudged={};
    worldState.reciprocityNudged[key]=worldState.turn;/* marked at BUILD time — see hazard note */
    return "[ENGINE NOTE — RELATIONSHIP RECIPROCITY (not a player action): the player's sheet records "+r.entity+" as \""+r.descriptor+"\", but "+r.entity+"'s own sheet has NO relationship entry for "+c.name+". If the fiction agrees the bond is mutual, emit [COMPANION_RELATIONSHIP:"+r.entity+"|"+c.name+"|<their descriptor for "+c.name+">] in this response; if it is genuinely one-sided, leave it as is.]";
  }
  return"";
}
var NOTE_BUILDERS=[buildQuestEscalation,buildConditionAudit,buildReciprocityNudge];
```

`worldState.reciprocityNudged` is lazily initialized (no `migrateWorldState` entry needed) and
rides the sync blob. One nudge per turn maximum (first unmirrored pair wins; others queue for
later turns) — consistent with the one-note-per-turn spirit of the quest escalation.

### ④ Engine tests to add

- **"fires on a weighty unmirrored player→companion relationship"** — fixture: player has
  `{entity:"Morwen", descriptor:"Wife"}`, Morwen is a partyMember with charSheet and empty
  relationships; assert the note names Morwen, "Wife", and the exact
  `[COMPANION_RELATIONSHIP:Morwen|Tess|` form. THE Morwen failure condition, reconstructed.
- **"does NOT fire when the mirror exists"** — Morwen's sheet holds `{entity:"Tess", …}` (any
  descriptor counts as reciprocation — the nudge checks existence, not weight).
- **"does NOT fire for a non-weighty descriptor"** ("Allied" fails `WEIGHTY_REL_RE`).
- **"does NOT fire for a weighty bond with a NON-party entity"** (a sworn enemy faction is not a
  companion-sheet concern).
- **"once per pair, ever"** — second call returns `""`; a NEW weighty descriptor on the same
  entity ("Wife"→"Betrayed") re-arms (key includes descriptor).
- **"silent mid-combat"** — `worldState.combat` set → `""` (and the pair is NOT marked consumed:
  assert the mark only writes when a note is returned).
- **"buildEngineNotes stacks it with an active quest escalation"** — both notes joined, order
  stable (registry order).

### ⑤ Hazard notes

- **Consumed-at-build-time**: the pair is marked before the API call resolves; a failed/retried
  turn burns the nudge. Accepted for a backstop (documented in the comment) — the alternative
  (post-response confirmation) would couple the note builder to the parse cycle for marginal
  gain.
- **This is the user-message channel** — the same outranking trick as the quest escalation; keep
  the note's "not a player action" framing verbatim so the GM never narrates the player saying
  it.
- Zero parser and zero prompt-half contact: `buildEngineNotes` output rides ONLY the outgoing
  API message (sendAction), never `buildSysPrompt` — the purity hash cannot fire and the golden
  is untouched. Verify anyway (⑥.3): it is the tripwire's job to confirm the design's claim.
- `findCompanionChar`'s fuzzy match could bind a relationship entity to the wrong companion in
  a two-similar-names party — the nudge is advisory text, so the blast radius is one wrong
  suggestion the GM can ignore; note and accept.

### ⑥ Verification steps

1. Suite green.
2. Smoke-replay corpora: zero diffs (note builders never run in replay — `sendAction` is not in
   the replay path).
3. `node dev/capture-stable.js dev/tmp_stable.txt` — byte-identical to the batch's final golden
   (proves zero prompt contact); delete tmp.
4. Preview on a fixture campaign: marry a companion via Sync-modal relationship edit + a turn;
   watch the console/network for the ENGINE NOTE in the outgoing message, the GM's
   `[COMPANION_RELATIONSHIP:]` response, and NO second nudge on the following turn.
5. The real-world validation is the user's live campaign (the t455 Morwen/Frizwick gaps were
   hand-repaired; the nudge should never fire for them — the mirrors now exist — but any FUTURE
   quiet bond shift exercises it).

---

## Batch close-out checklist (after item 9)

1. All nine commits pushed; ONE deploy carrying the doc-line items together (single cache
   invalidation — verify the purity warn fires once per campaign, then green).
2. TODO.md rows #46/#47/#50/#51-adjacent and UberAudit rows UA1/UA2/UA25/UA26/UA38/UA39/UA41/UA42
   updated per-commit (already required per item); do a final drift pass — no row may still say
   "rides the cutover batch".
3. `dev/lint-todo.js` (if wired) + a fresh `capture-stable` kept as the new PRE baseline for the
   next stable-half epoch.
4. **The playtest** (spine gate): one session exercising — a 3-foe encounter with a surrender
   and named damage; a companion leveled cast + rest; a condition with cause inflicted and
   audited; an epithet grant; a consumable detonation; a quest completed (toast + no silent
   reopen when re-baited); the t355 Message bait; a quiet weighty bond (reciprocity nudge).
   Corpus persisted, audit written (test-runs-always-audit), one AUDIT_playtest_v12xx.md in the
   established format.
   **✅ DONE (2026-07-11): [AUDIT_playtest_v1271.md](AUDIT_playtest_v1271.md)** — 29 turns, $1.18.
   7/8 scenarios validated live (the #46 `cause` field got no organic condition trigger — carried).
   Two new findings gate follow-up work: **P3-F1** UA26 stats mis-binding on multi-foe
   single-response emissions (Med-High, drift surface) and **P3-F2** the quest-reopen guard
   passing re-emitted rewards through (double payment). Batch closes with those carried as
   new work items.
