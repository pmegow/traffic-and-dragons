# Fix 2026-10-12 — #518 acceptance reds and #613

Worktree `agent-a7ea762da5537c4cd` at `390cc0bf` (APP_VERSION unchanged, no commit, no TODO edit). The acceptance patch `acc-518.patch` was applied first (`git apply --3way`, clean). Engine changes are confined to `tag_table.js`, `inventory.js` and `memory.js`. Both patches in this folder hold the acceptance section:

- `fix-518.patch` is built against the worktree HEAD `390cc0bf`.
- `fix-518-on-origin-master.patch` is the same change rebased onto origin/master `3bbed367`, verified there. origin/master added its own acceptance section at the same line of `dev/engine-tests.js`; see "Two patches" under Gates.

**Result:** all 20 acceptance probes are green, the KNOWN #613 probe included. `#518 block` gained one #613 test. The full suite is ALL GREEN (2983 engine assertions plus every standalone layer). One acceptance probe was edited: ⑫'s counting helper. It would count every unit twice once the two spellings share a key. See ⑫ below.

## Per defect

| Defect | Verdict | One line |
|---|---|---|
| ⑮ one loss, two placements | fixed | a stow with no standing loss unit in its block refuses: "⚠ Nothing placed — 'Torch': every unit … already given, placed or back in the pack (#518)" |
| ⑯ counted stow overdraw | fixed | a stow is cut to the units still standing, and the cut is said: "⚠ Placement of Torch x3 cut to one — 1 of this block's lost unit left to place (#518)" |
| ⑳ sweep with stows | fixed | 300/300 conserve (was 93/300). Same fix as ⑮ ⑯ |
| ⑰ take beside the floor or chest | fixed | ITEM_GAINED skips the auto-take for the units a same-block take names, and says so when a unit lies there |
| ⑭ short take of a row with fields | fixed | the shortfall comes back BEFORE the I5 carry; the held units move with their field (hero 1 or 2 blessed) |
| #613 two take pairs | fixed | a take consumes the gain units it pairs; the second take says "Nothing moved"; the hero keeps one |
| ⑫ plural "-es" | fixed (key rule narrowed, probe helper corrected) | `itemKey` folds "-es"/"-e" after ch, sh and ss; not after s, x or z, because each of those splits a pair that matches today (Horses/Horse, Axes/Axe, Prizes/Prize) |

## Mechanisms and changes

### ⑮ ⑯ ⑳ — the stow pairs a loss unit once, and is cut to what its loss took

- **Mechanism (as the acceptance report found):** LOCATION_ITEM refused a placement only through `itemPairMissed` (inventory.js), which is true only when the block's loss MISSED. After the first placement consumed the only `ilHits` note, the second placement was neither refused nor bounded. `fileLocationItem` (memory.js) then filed the tag's own count (`_qtyParse(_lnm).n`).
- **Change:** `tag_table.js:650–657`, in LOCATION_ITEM after the `itemPairMissed` check and before the fields check, for `placed` only:
  - `_lHits = itemPairCount(R,"ilHits",_lnm,_liB)`;
  - `_lHits===0` → refuse, said;
  - `0 < _lHits < count` → `_lnm` is rewritten to the cut count (`Torch` or `Torch xN`), said.
  - Everything downstream reads the cut name: the filing, the refused-placement put-back and the move record. The existing move-record loop consumes the units placed (`_mu = _mq.n` in a stash kind).
  - A placement with no loss in its block (`null`) is untouched.
- **Probes flipped:** ⑮, ⑯, ⑳ (93/300 → 0/300).
- **Clauses** (`dev/sabotage-518-pair-block.js`, new runner `ACC_CMD` = `run-tests.js "acceptance 2026-10-12"`):
  - "#518 ⑮: a stow whose block's loss units are all paired places anyway". Mutation: `if(_lHits===0){…` → `if(false){…`. Attribution: `#518 acceptance ⑮`.
  - "#518 ⑯: a counted stow files the tag's count again". Mutation: `if(_lHits!==null&&_lHits<_lq.n){` → `if(false){`. Attribution: `#518 acceptance ⑯`.

### ⑰ — a TAKE takes from the companion only

- **Mechanism:** ITEM_GAINED called `autoTakeLocationItem` for every landed gain unit. The table runs ITEM_GAINED before COMPANION_ITEM_LOST, so the gain could not see that a take pair covered it. Only the gift direction had the 2026-10-03 guard.
- **Change:**
  - `tag_table.js:535–542`: before the gain loop, every unit named by a same-reply `[COMPANION_ITEM_LOST:]` gets one `tlCover` pair note, keyed by item and block. Only takes from a party member with a sheet count, which is the take handler's own condition.
  - `tag_table.js:543`: each landed unit that meets a cover note skips the auto-take. Only `_igL − _igC` units are auto-taken. When cover was used and a unit still lies there, the receipt says "Left where it lies: Healing potion — this block's [COMPANION_ITEM_LOST:] is where the hero's Healing potion came from (#518)".
  - `memory.js:1047–1056`: new read-only `locationItemLying(itemName, atKey)`. It uses the same node and identity rule as the auto-take, and moves nothing.
  - Cover is the take's ASKED count, not what the companion held. A short or total take takes the covered gain units back itself, so auto-taking them would destroy the chest's units.
- **Probe flipped:** ⑰ (village chest and adventure floor).
- **Clause:** "#518 ⑰: a gain beside a same-block take auto-takes from the chest again". Mutation: the cover loop → `var _igC=0;`. Attribution: `#518 acceptance ⑰`.

### ⑭ — a short take of a row with fields

- **Mechanism (confirmed):** the I5 carry ran before the #518 ② shortfall take-back. A blessed torch (1) taken as x3 met the hero's row of 3 and `invCarryFields` refused (`row.qty!==units`). The restore took back 1 and `continue`d past the shortfall, so two plain torches stayed under a "Nothing moved" receipt.
- **Change:** `tag_table.js:1720–1726`. The shortfall take-back moved ahead of the carry. The carry then meets a row of exactly the units that moved, the fields land, and the hero has 1 (or 2) blessed. The cut message stays after the receipt (`:1732`, `if(_tsb)`), so mutation-log order is unchanged. In the restore case (a pre-existing stack without the field), the shortfall and the paired units both go back, so "Nothing moved" is now true.
- **Probe flipped:** ⑭ (both short cases; the two full-count cases stayed green).
- **Clause:** "#518 ⑭: a short take of a row with fields skips the shortfall before the I5 carry". Mutation: `_tsh=(cIlHit&&cIlHit<cIlq.n)?` → `_tsh=(cIlHit&&cIlHit<cIlq.n&&!invFragsHaveFields(_tlF))?`. Attribution: `#518 acceptance ⑭`.

### #613 — two take pairs in one block

- **Mechanism (confirmed as filed):** COMPANION_ITEM_LOST's success path never consumed `igHits`. The second take missed, and its take-back loop (`while(_tpb)`, the #517 (d) refund path) took back every gain unit, the first pair's included.
- **Second shape, found while fixing:** the shortfall take-back could also reach the units the companion did hand over. `[COMPANION_ITEM_LOST:Bram|Torch x3][ITEM_GAINED:Torch]` with Bram holding one took back the hero's torch: hero 0, Bram 0. So did a gain of x2 against a take of x3.
- **Change:** `tag_table.js:1719` / `:1725–1726`:
  - `_tlP = min(cIlHit, standing igHits)` is the set of gain units this take pairs.
  - The success branch consumes `_tlP` notes: `for(_tlN=0;_tlN<_tlP;_tlN++)itemPairTake(R,"igHits",…)`.
  - The shortfall is capped at `_tlG − _tlP`.
  - The I5 carry and restore use `_tlP`, which equals the old `Math.min(_tlG,cIlHit)`.
- **Probes flipped:** acceptance "KNOWN #613" (now green), plus the new `#518 block` test at `dev/engine-tests.js:28340–28359`. That test covers three shapes:
  - two take pairs, Bram holding one: hero 1, and "Nothing moved" for the second take;
  - Bram 1, Cara 0, one gain of x2: hero 1;
  - a gain of one beside a take of x3 from Bram's one: hero 1.
- **Clauses** (both attributed `#613 a take pair consumes the gain units it pairs`, runner `#518 block`):
  - "#613: a take no longer consumes the gain unit it pairs". Mutation: the consumption loop is removed.
  - "#613: the short take's shortfall reaches the units the companion handed over again". Mutation: `Math.min(cIlq.n-cIlHit,_tlG-_tlP)` → `Math.min(cIlq.n-cIlHit,_tlG)`.

### ⑫ — a plural written "-es"

- **Mechanism:** `itemKey` (inventory.js) stripped one final "s", so `Torches` keyed as `torche` and never met `Torch` in the pack, the chest or the pair notes.
- **The rule as briefed (strip "es" after ch, sh, s, x, z) was rejected.** Each of s, x and z splits a pair that matches today:
  - s: `Horses`/`Horse`, `Cases`/`Case`, `Roses`/`Rose`;
  - x: `Axes`/`Axe` (a core sword-and-sorcery item);
  - z: `Prizes`/`Prize`, `Adzes`/`Adze`, `Mazes`/`Maze`.
  A plain ch-only "-es" strip would also split `Caches`/`Cache`, `Niches`/`Niche` and `Brioches`/`Brioche`.
- **Change:** `inventory.js:23–28`. A sibilant stem (ch, sh, ss) folds BOTH its "-es" plural and an "-e" singular onto the stem before the final "s" goes: `.replace(/(ch|sh|ss)es?$/,"$1").replace(/s$/,"")`. Examples:
  - `Torches`/`Torch` → `torch`; `Pouches`/`Pouch`, `Brushes`/`Brush`, `Matches`/`Match`;
  - `Glasses`/`Glass` → `glas` (the "s" rule always made it that);
  - `Cache`/`Caches` → `cach`;
  - `Arrows` → `arrow`;
  - `Clothes` stays `clothe`, never `Cloth`;
  - `Boxes` still misses `Box` (x left out for `Axe`);
  - `Chaos` stays `chao`.
  - The header comment (`inventory.js:17`) names the fold.
- **The probe needed one correction.** ⑫'s `both()` summed `acc518Units("Torch") + acc518Units("Torches")`. Once the spellings share a key, each call counts every unit, so the engine was right ("cut to one", "x3 stays in the pack") and the probe read 6 for 3. The helper now adds the second spelling only while the keys differ (`dev/engine-tests.js:28155–28157`, commented). It still says 1 in, 2 out on the old key, as the sabotage clause proves.
- **Probe flipped:** ⑫.
- **Clause:** "#518 ⑫: the item key strips only a final s again". Mutation: the fold `.replace(/(ch|sh|ss)es?$/,"$1")` is removed. Attribution: `#518 acceptance ⑫`.
- **Risk, stated:** the key is shared, so this is more than a pairing change:
  - A sheet holding both `Torch` and `Torches` rows now folds them into one row at load (`invRows`, I2), which is correct.
  - If the two rows carry DIFFERENT unknown fields, the world's admission refuses loudly (all or nothing). Real saves carry no unknown fields today, so this is theoretical.
  - Persisted consumable latches keyed under an old spelling (`who|matche`) self-prune on the next sweep (game.js:2350). The worst case is one repeated consumable question.
  - The four replay baselines are unchanged, and every key battery proves (below).
  - I did not census the owner's saves, because the brief kept me out of the main tree.

## Re-anchored clauses (same mutations)

- `dev/sabotage-quartet-ledger.js`: "#518 ② the take pair gives the hero the full count again". The anchor moved to `_tsh=(cIlHit&&cIlHit<cIlq.n)?Math.min(cIlq.n-cIlHit,_tlG-_tlP):0;` → `_tsh=0;`.
- `dev/sabotage-599c2-review.js`: "a take onto a plain stack keeps the move". The anchor moved to `if(_tlP>0&&invFragsHaveFields(_tlF)){` → `if(false){`.
- `dev/sabotage-481-a4-place-sequencer.js`: "the gain takes from where the party stood before the reply". The anchor moved to `autoTakeLocationItem(igq.base,null,_igL-_igC,rPlaceAtBlock(…).key)` → `…,null)`.
- `dev/sabotage-517-counter-tail.js`: no anchor moved (`if(_tpRef>0){…` is untouched). Not edited.

## Gates

All commands were run in the worktree after the last edit. No file changed during the battery sweep.

| Command | Result |
|---|---|
| `node dev/run-tests.js "acceptance 2026-10-12"` | 20/20 green (was 7 red: ⑫ ⑭ ⑮ ⑯ ⑰ ⑳ and KNOWN #613) |
| `node dev/run-tests.js "#518"` (quartet + acceptance + block) | `FILTERED GREEN — 3 section(s) matched, 38 assertions passed` |
| `node dev/run-tests.js` (full) | exit 0, `ALL GREEN — 2983 assertions passed (engine tests)`, every standalone layer green |
| `node dev/check-es5.js` | `ES5 check OK — 52 file(s)`; also OK on `dev/engine-tests.js` and `dev/sabotage-518-pair-block.js` |
| `node dev/check-sabotage-applicability.js` | `ALL GREEN — 3126/3126 retained sabotage clauses applicable across 333 batteries` (was 3119; +7 new clauses) |
| `node dev/sabotage-518-pair-block.js` | exit 0, 17/17 caught with attribution, every file restored byte-identical. The 10 old clauses plus 7 new: #613 ×2, ⑮, ⑯, ⑰, ⑭, ⑫ |
| `node dev/run-sabotage-diff.js HEAD` (every battery targeting a changed file) | exit 0, **111/111 batteries green**, no flaky re-runs. Includes 481-a2-item-pairs, quartet-ledger, 517-counter-tail, 518-pair-block, 481-a4-place-sequencer, 481-d5-coin, 598-copper, 599b, 599b3, 599b4, 599b5, 599c, 599c2, 599d, 271-residue-quartet |
| Key batteries outside that sweep, run one by one | `sabotage-599-legacy-census.js` 4/4; `sabotage-599a-version-gate.js` exit 0 (all groups proven); `sabotage-599b2-admission.js` exit 0 (all groups proven) |
| The four CI replay baselines (`diff-replay.js dev/corpus_playtest_v{1238,1258,1271,1276}.json --check`) | all four: `end state matches committed baseline` |

**The sweep ⑳ (seed 20261012, 300 replies, gifts and stows, village chest):** 300/300 conserve (was 93/300). The gifts-only sweep ⑲ stays 300/300.

### Two patches — origin/master moved

The worktree sits at `390cc0bf`. origin/master is now `3bbed367`, four commits ahead (#593 acceptance and fix, #615 signup). None of the four touches `tag_table.js`, `inventory.js` or `memory.js`. They DO add an `acceptance 2026-10-12 — #593` section to `dev/engine-tests.js` at the same spot as ours (just before `#518 block`). So:

- **`fix-518.patch`** is the briefed deliverable: `git add -A … && git diff --cached` against the worktree HEAD `390cc0bf`. It applies to `390cc0bf`. Against origin/master, its `dev/engine-tests.js` hunk fails (`git apply --check`: "patch failed: dev/engine-tests.js:28011"), because both sides insert at the same line. The other seven files apply cleanly.
- **`fix-518-on-origin-master.patch`** is the same change rebased onto `3bbed367`. Engine files are byte-identical: `tag_table.js` goes to blob `808691c` in both patches. The two test insertions (the acceptance section and the #613 test) are placed after origin/master's #593 section, before `#518 block`. The base blob ids match origin/master (`tag_table.js 68f3288`, `dev/engine-tests.js 943a253`). `git apply --check` passes on origin/master's files.
  - Verified in a scratch export of origin/master (scratchpad `om/`, a throwaway repo; the project repo was not touched):
    - full suite exit 0, `ALL GREEN — 3004 assertions passed (engine tests)`, `ALL GREEN — 114 standalone verifier suites`;
    - applicability `3132/3132 across 334 batteries`;
    - ES5 OK;
    - `sabotage-518-pair-block.js` exit 0, 17/17.
  - The first scratch run's only red was environmental: `tests-481-g7-archive-moves` needs a HEAD commit. It went green once the scratch repo had one.
  - **Use this patch to land on master.**

Not run: live model turns, browser checks. No UI changed; the receipts are mutation-log text.

## Observations (not fixed; out of scope or by design)

- **Adventure stows consume one loss unit per placement, whatever count the name carries.** The move record's `_mu` is 1 for a toggle row, by design. A placement onto a toggle row already lying there is a `noop` and consumes nothing. Village (counted) stows are exact. No probe covers the adventure count.
- **A successful stow does not consume its `ilFrags` note** (only `ilHits`). This has no observable effect today: a stow of a row with fields refuses whole, and plain fragments are interchangeable.
- **Pre-existing wording carried over:** the gift's "every unit this block's [ITEM_LOST:] took is already given or placed" still reads that way after a void. The new stow refusal says "given, placed or back in the pack".
- **"Left where it lies" is said even when the take then finds the companion holding none** (it says "Nothing moved" next). The chest keeps its unit in both cases, which is the point.
