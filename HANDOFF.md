# Traffic and Dragons — Session Handoff

**Date:** 2026-07-08 (the capability_bible build day)
**Deployed version:** engine **v1.224** — pushed through `383da15` (`origin/master` == local HEAD).
**SW cache:** `tnd-v3-20260708b` (`sw.js`).
**Working tree:** only the two `.blueprint` files (Runelords + ToA) carry UNCOMMITTED changes — pre-existing, the user's, not this session's. Leave them; don't sweep into a commit.
**Server:** healthy on Fly (untouched this session).
**Overnight:** the user is running a **playtest while they sleep**. This handoff is for the session that audits it.

---

## ⚡ NEXT TASK: AUDIT THE OVERNIGHT PLAYTEST — the bible "MONEY TEST"

This session built the whole `capability_bible` anti-drift system (v1.218–v1.224). Every turn, the GM prompt now carries CANONICAL rules for the player's known spells/abilities (`buildSpellBibleBlock` + `buildAbilityBibleBlock`, VOLATILE half). **The machinery is proven and unit-tested; what is NOT proven is whether the model HONORS the fixed bounds under real play.** That is the money test the overnight run exists to answer.

### Get the data
1. **If the preview browser is still open** from the overnight run: the harness corpus is live at `window.__pt.log` (turn/action/narration) and `window.__pt.errors`. Pull it via `preview_eval` before anything reloads it away.
2. **Extract the save** regardless (source of truth): in the page, `saveAll(); window.__b64=btoa(unescape(encodeURIComponent(JSON.stringify({worldState:worldState,sessionLog:sessionLog,memory:memory},null,2))))` then `window.__b64` — an oversized `preview_eval` result **auto-saves to a tool-results file**; read it, strip the wrapping quotes, `Buffer.from(b64,"base64").toString("utf8")` → write `playtest_v1.224.tnd`. (This is exactly how the v1.214 save was captured — one whole-blob eval, not chunks.)

### What to check — bible compliance FIRST
Grep the narration corpus / transcript against `capability_bible.js` and look for **drift** (the whole point):
- **Range/targets/duration honored?** e.g. Message stays ≤120ft (the original drift), Hunter's Mark stays ONE target (exclusive), Fireball's radius/save intact. Any spell narrated outside its canon = a finding, and it means injection isn't enough (next step would be per-provider reinforcement, like the openai tag-discipline block).
- **`[SPELL_DEF:]`** — did the GM invent a spell not in the bible and canonize it write-once into `worldState.capabilityBible`? (Check the save's `capabilityBible` overlay.)
- **`[SPELL_USED:]`** slot expenditure + **`[REST:long]`** restore (P10/R1).
- **NOTE:** the money test is only real if the character CASTS. The current local save (Kael) is a **Ranger** (Hunter's Mark + a few spells). If the run used a random harness character, confirm it actually casts; a **Sorcerer/Cleric** exercises the drift-prone spells far better — recommend that for any re-run.

### Then the regression invariants (all shipped this arc — confirm they held live)
- **F2 (v1.216):** combat clears on a `[LOCATION:]` world-move — grep for stale `worldState.combat` persisting across a travel. (Console prints `[combat] auto-cleared stale combat …`.)
- **F3 (v1.216):** an act with all arcs `completed` gets the `[ACT_COMPLETE:]` nudge and actually advances.
- **v1.215:** NO raw tags in displayed prose (`[TIME:]`/`[WEATHER:]`/`[REST:]` were leaking pre-v1.215 — should be clean now).
- From the v1.214 audits (still the live behaviour): quest lifecycle CLOSES with rewards (P3), story beats fire (P11), `[LOCATION]`/`[SUBLOCATION]` movement upkeep (P4), `[TIME:]`/`[WEATHER:]` advance (R2), companion auto-sheets (P2). Zero console errors.

### Write it up
Use the established audit format (bold finding → mechanism w/ file:line → **Remedy** → Effort → Status) — model on **`AUDIT_playthrough_v1.214.md`** (this repo, earned explicit praise: direct answers table up top, regression scorecard vs the prior run, honest "what this can't claim"). Name it `AUDIT_playtest_v1.224.md`. `.tnd` saves are gitignored (local only); the audit `.md` is committable.

---

## This session (v1.216 → v1.224, all pushed)

| Ver | What |
|---|---|
| 1.216 | **F2** stale-combat clear on `[LOCATION:]` world-move (+ `[COMBAT_END:fled/truce/disengaged]` prompt nudge) · **F3** all-arcs-done → `[ACT_COMPLETE:]` nudge in the skeleton block. From the v1.214 ToA playthrough audit. |
| 1.217 | **`character_library` rename** — the bare `library` was ambiguous (character vs blueprint). `Char`→`Character` on the identifiers, UI labels qualified per-domain. Server contract untouched (`/api/characters`). Deferred: the generic `mode==="library"` cloud-source toggle (a `"cloud"` rename is the clean fix if it ever bugs). |
| 1.218 | **`spell_bible.js`** + live anti-drift injection (option A: preventive, every turn, known spells). Base-name keyed; `spellBibleLookup` w/ emergent overlay hook. |
| 1.219 | **`[SPELL_DEF:]`** write-once tag — GM canonizes an invented spell into `worldState.capabilityBible` (lookup prefers overlay). |
| 1.220 | **`ability_bible.js`** — abilities folded in; `capabilityLookup` resolves an ability-that-is-a-spell (Hunter's Mark) to its spell canon, no dup. |
| 1.221 | **Player click-card** (`showCapabilityCard`) + **`bible_study.html`** viewer — one shared pure renderer `bibleCardHTML` (helpers.js), two hosts. |
| 1.222 | **MERGED** `spell_bible`+`ability_bible` → **one `capability_bible.js`** (`CAPABILITY_BIBLE`, kind-tagged). User call: spells & abilities have no intrinsic difference, `kind` is cosmetic. Entities (item/creature/profession) stay separate `*_bible` files. |
| 1.223 | **`category`** LIST (traditions: `arcane/divine/primal/necromantic/martial`) on every entry — the gate to limit an enemy caster (a cleric → `capabilitiesByCategory("divine")`). Turn Undead = `["divine","necromantic"]`. Rendered as card chips. `[SPELL_DEF:]` takes `category=a,b`. |
| 1.224 | **Fixed attribute set** — every entry carries all of cost/range/targets/duration/save/damage, `"N/A"` where inapplicable. Cards always show 6 uniform rows; `capBibleLine()` injects one LABELED COMPLETE line so the GM can query any attribute and never get empty (the Death-Sight-duration problem). |

**Key files:** `capability_bible.js` (the registry + `capBaseName`/`capabilityLookup`/`capabilitiesByCategory`); `api.js` (`buildSpellBibleBlock`/`buildAbilityBibleBlock`/`capBibleLine`, `[SPELL_DEF:]` in applyMuts, F2 in the `[LOCATION:]` handler, F3 in `buildSkeletonBlock`); `helpers.js` (`bibleCardHTML`); `ui.js` (`showCapabilityCard`); `bible_study.html` (satellite viewer, NOT in the SW shell). Full design + roadmap in **TODO #10**.

---

## Next in value (after the audit)
1. **Whatever the money test surfaces.** If the GM ignores bible bounds → per-provider reinforcement / a stronger STYLE line, not more data.
2. **Enemy-caster consumer** — wire `capabilitiesByCategory` into a GM prompt block / enemy statblock so a rolled caster actually draws from its tradition. The data + gate function are ready; nothing consumes them for enemies yet. (TODO #10.)
3. **Bible remaining:** companion spell canon (their spells live on `charSheet.spells`); `item_bible` + `[ITEM_DEF:]`; `creature_bible` (must ABSORB `worldState.bestiary`, not become a 2nd monster home); full-coverage authoring (starter sets only, 42 entries). Eventual editor deferred until blueprint-bundled bibles create demand.
4. **Open, unanswered:** reclassify Arcane Bolt (and the sorcerer at-will "abilities") `kind:"ability"`→`"spell"`? The user never called it — left as-is. One-line change. (`category:["arcane"]` regardless, since category is a separate axis.)
5. **Older backlog:** #30 usage-meter undercount (~⅓ silently $0 — find the unpriced model id, prefix-match); #33 action buttons append + input clear ×.

---

## Standing rules / don't get burned
- **Every commit is gated on the test suite** — `.git/hooks/pre-commit` runs `dev/run-tests.js` (**now 233 assertions**, headless node, ~1s) and BLOCKS on red. Hook isn't tracked — after a fresh clone: `cp dev/pre-commit .git/hooks/pre-commit`.
- **ES5 only** (`var`, no arrows/template-literals/`const`); **bump `APP_VERSION` (globals.js) + `CACHE` (sw.js) on every game-code commit**; **update the TODO row in the same commit as the fix** (user rule).
- **Bible canon is VOLATILE-half only** (`buildSpell/AbilityBibleBlock` read `worldState.character.spells/abilities` live). Never let it leak into the STABLE (cached) half — an engine test canaries this. `capabilityLookup` is THE lookup: overlay (`worldState.capabilityBible`) wins over `CAPABILITY_BIBLE`; keyed by **base name** (parenthetical stripped, lowercased) so it overlays the `SPELLS`/`ABILS` strings and `[SPELL_USED:]` matcher with no refactor.
- **Preview loads stale by default** — the SW serves cache-first. To load a new version in the preview: unregister service workers + `caches.delete` all + reload (I did this every verify this session). A `CACHE` bump alone isn't enough for the *already-open* page.
- **OneDrive can serve stale files** — project lives under OneDrive; `git diff` before committing if anything smells off (the v1.177 dropped-TODO-rows incident). The test gate does NOT check docs.
- **Save extraction gotcha:** an oversized `preview_eval` return auto-saves to a tool-results file (path in the error) — use the whole-blob base64 round-trip, don't hand-copy chunks (a chunk I hand-copied truncated once).
- **Memory holds live feedback norms** (auto-loaded): a question is not an action; don't begin work while a flagged question is unanswered ("proceed" ≠ resolving an open fork); Clarity above Brevity in naming; end update replies with the version line. Honor them.
- **File menus are generated** (`buildFileMenus()` in ui.js); Blueprint Designer + `bible_study.html` are **satellite pages, no menu entry**, NOT in the SW app shell; the designer versions separately (`BP_DESIGNER_VERSION`).
- **Read `CLAUDE.md` first** for architecture — this file is only "where we left off."

## Deploy
- **Cloudflare Pages** auto-deploys on push to `master` (static, output = repo root). Poll `globals.js?nc=<ts>` for `APP_VERSION`.
- **Server:** `cd ..\traffic-and-dragons-server && flyctl deploy --ha=false` (separate SIBLING repo).

<!-- Prior handoffs (07-04/05/06: memory-engine day, designer arc, whole-engine audit) are in git history if needed. -->
