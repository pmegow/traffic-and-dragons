# The presence panel — ten-angle design exploration (2026-08-17)

**Provenance:** ten parallel Opus agents at high effort (owner-directed fan-out, ~1.36M delegate
tokens, ~6 min wall), each exploring one angle of the #173/#175b presence problem after the owner
ruled two fixed points: **a mention must never teleport a character to the current location**, and
**`[NPC:]` tagging of mentioned characters stays and is encouraged**. Fable synthesis first; the
ten verbatim reports follow as appendices. Related: TODO #193, FABLE_REVIEW_RECORDS entry 17.

---

## Fable synthesis — the solution is in there, and it converged

### The three measurements that reframe the problem

1. **The one-mention kill is the DEFAULT state, not an edge.** On the live saves, 37 of 39
   (t1903) / 35 of 37 (t1837) living rostered NPCs pass the bare-name death gate **right now**,
   nearly all on the `statusTurn` limb alone — including NPCs last written ~1,000 turns and a
   region away. 12 of 49 `statusTurn` values are v1.381 migration fabrications. The
   `lastSeenTurn` co-location limb is **dead in the field** (0 of 69 records carry it — v1.650
   only stamps going forward). `statusTurn` — i.e. the mention channel — is doing 100% of the
   authorization work.
2. **`[SAY:]` is the presence signal the engine already has and throws away.** Measured across
   live tagLogs and 700+ corpus responses, independently by five agents: `[SAY:]` fires on
   88–95% of GM responses; `[NPC:]` on 12–18%; `[SCENE_REF:]` on 0% live. And the t1903 incident
   itself: Caul had `[COMBAT_START:]` at t1878, `[ENEMY_HP:]` t1880–84, and `[SAY:]` on 29/29
   turns across the incident window — **the evidence for his death was in the tag stream all
   along; the gate just couldn't read those channels.**
3. **The migration window is open exactly now.** Guestbooks are nearly empty in the field
   (5 records across 85 nodes at t1903; zero at t1837/t1728) — #173 is too young to have
   polluted much. The pollution is prospective. In 200 turns this stops being cheap.

### Why `[SCENE_REF:]` failed and `[SAY:]` didn't (the compliance mechanism)

The gm-compliance angle's finding: 0/1,837 is not generic bookkeeping-laziness. `[SCENE_REF:]`
demands a **meta-conditional trigger** (the GM must decide "is this person story-significant? is
this their first observation?") plus a **stateful invented vocabulary** (a handle namespace
maintained across turns with no narrative counterpart). Its sibling `[SCENE_REVEAL:]` — one
legible trigger — fired at 13% in the same window. `[SAY:]` complies at 95% because its payload
is a fact being written in the same sentence and its consequence is *perceivable* (the owner
hears the voices; a compliance nudge took it from 0 → 39/40). Design rule extracted: **a
presence vocabulary must need no handles, must never ask the GM to decide WHEN, and must make
non-compliance measurable.**

### The composite architecture (assembled from the panel)

- **Layer 0 — the split (fixed point 1, structural).** `mapNpcLocation` splits into
  `npcRegisterMention` (roster + memory + display `node.npcs` + a new `lastMentioned` turn
  scalar — everything true of a discussed character) and `npcRecordPresence` (lastSeenAt +
  lastSeenTurn + guestbook, keeping the #137 split-member guard, which now covers both writes).
  The `[NPC:]` handler calls only the former. A mention cannot teleport, by construction — no
  heuristic, no timer.
- **Layer 1 — derived presence (the recall floor; zero new ceremony).** One derivation pass at
  the existing post-handler seam commits presence from writers the GM already operates for its
  own reasons: the truthful party-arrival writers (unchanged), `[SAY:]` speakers that resolve to
  rostered NPCs (skip the player, the dead, split members, unresolvable names — refuse-and-warn,
  never create), and combat tags naming rostered NPCs. Presence lands in the guestbook (with a
  source) and in an **evictable `frame.observed[]`** beside sceneRefs' authored `actors[]`
  (data-model angle) — engine-derived, re-derivable, capped LRU, and structurally unable to trip
  the W2 overflow latch.
- **Layer 2 — the death-gate regrade (ships in the SAME commit as 0/1, never split).** Gate 3
  becomes graded: witnessed facts (speech, combat engagement, bound scene actor, party
  co-location) authorize alone under the strictly-earlier contract; post-epoch `statusTurn`
  authorizes **nothing**. Measured on t1903: killable-by-bare-name census 37 → 9, and Caul still
  authorizes (`speech at t1897, +13 more`). The paradigms angle's one-commit warning is
  binding: split the change and the gate loses its only live limb → t1903 returns.
- **Layer 3 — refusal terminates (the valve).** A refused named death arms ONE fork-shaped
  one-shot note (never the current handle-ceremony ask): "if they are here, give them a line /
  cast them; if this death happened elsewhere, emit `[NPC_DEATH_REPORTED:name|source]`" — a new
  tag that commits the death loudly AS REPORTED (no eyewitness claim, `npc.deathReported`
  stamped). Off-screen deaths become a legitimate, honest category instead of an unanswerable
  refusal. This is what permanently kills the quarantine-loop class.
- **Layer 4 — `[SCENE_CAST:]` (optional accelerator for silent NPCs + starving providers).**
  One tag, whole cast, **engine-owned timing** (asked by one-shot note at node change / combat
  open / split settle / ~12-turn refresh — the 57-turn-tagless-dungeon case), `[SCENE_CAST:none]`
  making non-answer measurable, compliance nudge on non-answer, TAG_REINFORCE for non-Claude
  providers (gpt-5.6-sol runs `[SAY:]` at only 10–18/50 turns — the red team's provider-starvation
  attack is real). The gate must not lean on this layer until a 50-turn playtest measures its
  actual compliance.
- **Layer 5 — migration: one scalar.** `worldState.presenceEpoch` = current turn at upgrade;
  evidence grade is DERIVED from `turn < epoch`, zero records rewritten, idempotent, fold-safe.
  Legacy (pre-epoch) `statusTurn` evidence stays authorized — **fail-open, grandfathered,
  receipt-stamped `evidenceGrade:"legacy"`, surfaced in the #17 drift-health readout, and
  monotonically shrinking** as NPCs get re-witnessed. Old-client tripwire: missing `presenceVer`
  with `turn > epoch` advances the epoch and warns. Optional `dev/backfill-cast.js`: the
  transcript already persists per-entry speaker maps (`.sp`) AND locations (`.e.l`) — 111
  deterministic (speaker, node) facts reconstructible on the live save, no prose scanning.
- **Layer 6 — projection honesty (separable second commit).** `PRESENCE_TIERS` registry
  (witnessed / legacy-unverified / spoken-of / based-here) rendered in memory voice, never
  ledger voice; `node.mentions` as capped, windowed rumor texture ("this place has heard these
  names lately… hearing a name here is not a visit"); `lastSeenAt` projected as age-banded
  "last placed" (48/69 records are undated assertions today); negatives stay record-based.
  Mention projection ships second and gets judged against a corpus for priming risk.

### The dissent, adjudicated

The red team rejected `[SAY:]`-creates-presence (remote speech, provider starvation, incentive
contamination of a validated TTS signal) and proposed SAY-confirms-only. Adjudication: the
majority's measurements hold — remote-speech false positives measured 0/589 manually-checked
instances (ceiling 2.4% by keyword proximity, all inspected hits false alarms), and
frame/node-scoping bounds the damage, versus today's structural mis-stamp of every discussed
character. The confirm-only variant is circular (the manifest it would confirm against is fed by
the prose name-scan). SAY-as-witness stands, with the location-corroboration knob (`entry.e.l`
must match the current node) available as a hardening. The red team's other verdicts are
ADOPTED: **no required arrives/departs ceremony** (worse compliance profile than the problem),
**no corroboration-by-count on mentions** (the Karzoug slow-burn forge: 61 mentions across 17
nodes — counting weak facts launders them; the fix is typing the record, not thresholding it),
and the migration knife-edge (grandfather-as-eyewitness launders history; hard-demote starves —
hence the epoch + fail-open + valve triple).

### Owner rulings (2026-08-17 — all four resolved)

1. **Speech is presence:** `[SAY:]` becomes canon-bearing (a TTS-validated tag acquires a state
   handler; voice-attribution changes would then touch canon). Recommended YES — **RULED: AGREED.**
2. **The reported-death category:** `[NPC_DEATH_REPORTED:]` + the fork-note valve lets an
   off-screen death commit honestly instead of quarantining forever. The biggest doctrinal
   change — W2 stops treating every unproven death as refusable-forever. Recommended YES
   (the t1903 loop's measured cost exceeded a wrongly-accepted off-screen death's) —
   **RULED: AGREED.**
3. **Legacy fail-open:** grandfathered pre-epoch `statusTurn` evidence keeps authorizing until
   the NPC is re-witnessed (the alternative is a refusal wave on mature saves). Recommended
   YES, with receipts + health-readout visibility, no fade window — **RULED: TENTATIVE
   AGREEMENT ("try it for now, can change later") — build it revisit-able: the epoch derivation
   already makes flipping to fail-closed (or adding a fade) a one-clause change; keep it that
   way and keep the legacy-grade receipts so a later reversal has its evidence.**
4. **`[SCENE_CAST:]` ships** as Layer 4, playtest-gated before the death gate leans on it.
   Recommended YES — **RULED: AGREED.**

### Residual floor (accepted, no design escapes it)

Coherent fabrication (a GM that narrates presence and emits the matching tags is
indistinguishable from truth — no oracle exists); the silent never-nudged bystander (their real
death costs one fork-note turn, forever); retroactive reveals cannot repair history-as-written;
speech through doors/adjacent rooms stamps the party's node (#164 granularity territory).

---

# Appendices — the ten reports, verbatim


## Appendix 1 — angle: vocabulary

## EXECUTIVE SUMMARY

1. **Presence should be *derived from speech*, not declared.** Measured on the live 1,903-turn campaign (`worldState.tagLog`, last 40 responses): `[SAY:]` = **38/40 (95%)**, `[NPC:]` = 7/40 (18%), `[SCENE_REF:]` = **0**. `[SAY:]` is the highest-compliance tag in the game — higher than `[DICE:]`.
2. **Recommendation:** strip presence out of `[NPC:]` entirely (fixed point 1, structurally); give `[SAY:]` a handler (it has none today — `tag_table.js:43` `TAG_NO_HANDLER`) that stamps presence; add ONE optional cast tag `[SCENE_CAST:]` that is only ever *requested* by a one-shot engine note at detected ambiguity.
3. This **increases** evidence volume, so the under-recording/t1903 hazard shrinks rather than grows: on the shipping model (sonnet5 corpus, 50 turns) `[SAY:]` named **53** speakers of which **49 had no `[NPC:]` tag that response** — presence facts the current design never records at all.
4. Per-NPC `[NPC_ARRIVES:]/[NPC_DEPARTS:]` is the same shape as `[SCENE_REF:]` (pure bookkeeping, GM must detect a transition) and should be **rejected as a required tag**; a 4th `[NPC:]` field survives as an optional escape hatch for present-but-silent NPCs.
5. Cost: ~530 chars on a 23,372-char STATE TAGS doc (**+2.3%**, cached stable half). Migration is a non-issue — the live t1903 guestbook holds **5 records across 1 of 85 nodes**.

---

## (a) THE DESIGN

### Layer 0 — split the function that conflates the two jobs

`memory.js:282` `mapNpcLocation` currently does registration *and* presence. Split it:

```js
// display-only "ever associated" set (amendment ⑦) — mentions land here and nowhere else
function npcRecordAssociation(name){ /* node.npcs push only */ }
// the ONLY presence writer: guestbook + lastSeenAt/lastSeenTurn
function npcRecordPresence(name,turn,source){ /* keeps the #137 split-member guard at :300 */ }
```

`[NPC:]` (tag_table.js:424) calls **only** `npcRecordAssociation`. Fixed point 1 holds by construction — no heuristic, no timer, no "was this a mention?" guess.

### Layer 1 — `[SAY:]` becomes the primary presence writer

Grammar unchanged (`[SAY:Character Name]`). It gains a handler:

```js
{t:"SAY",apply:function(text,R){
  var seen={},m,re=/\[SAY:([^\|\]]+)\]/g;
  while((m=re.exec(text))){
    var raw=m[1].trim(); if(!raw||seen[raw.toLowerCase()])continue; seen[raw.toLowerCase()]=1;
    var canon=resolveNpcName(raw);
    if(!wsNpcByName(canon)&&!(memory.npcs&&memory.npcs[canon]))continue; // descriptor handles drop
    if(memoryNpcIsPlayer(canon))continue;                                // the PC is not an NPC
    if(npcIsDead(wsNpcByName(canon)))continue;
    npcRecordPresence(canon,R.turn,"spoke");
    R.muts.push("Present (spoke): "+canon);
  }
}}
```

**Rationale:** speaking in the narrated scene *is* being in it — this is the "tag coupled to state the GM is actively narrating" class that the field says emits reliably, and `[SAY:]` is field-validated (#96) because it drives TTS the owner hears. It is presence evidence the GM emits **for a reason it can feel**, which is precisely what `[SCENE_REF:]` never had.

STATE TAGS doc: append one clause to the existing `[SAY:]` line (~150 chars):

> *"A tagged speaker is understood to be physically present in the scene you are narrating. If a voice is remote — a letter read aloud, a remembered line, a sending, a dream — do not tag it; write it in the narrator's voice."*

### Layer 2 — `[NPC:]` gains an optional 4th field for the silent-but-present case

`[NPC:Name|mood|rel]` → `[NPC:Name|mood|rel|here]`. Only the literal `here` writes presence; **anything else, including omission, writes none**. Legacy 3-field tags therefore mean exactly what fixed point 1 says they mean, and no save needs migrating. Doc cost ~120 chars:

> *"Add a 4th field `|here` ONLY when the character is physically in the scene you are narrating right now. A character merely spoken about, remembered, or reported gets no 4th field."*

### Layer 3 — `[SCENE_CAST:A|B|C]` — never a standing ceremony

One tag, whole cast, emitted at a scene opening. It is documented **but never demanded** in the stable half; it is *asked for* by a one-shot engine note (the validated #168 W4 observer channel) when the engine detects real ambiguity:

* a `[SAY:]` name resolved to nobody on the roster (`[SAY:coat_man]` — observed in the v1642 corpus), or
* a `[LOCATION:]`/`[SUBLOCATION:]` move followed by ≥2 turns with zero presence writes at the new node.

```
[ENGINE NOTE — SCENE CAST (not a player action): the record has no one standing with you at
<node>. Name everyone physically present in one tag now — [SCENE_CAST:Name|Name|Name] — and
omit anyone only spoken about. If you are genuinely alone, emit nothing.]
```

Combat-silent, cooldown-latched, GM-decides. ~260 chars of stable doc.

### Scene EXIT semantics

**There is no exit tag and none is needed.** Presence is a *turn stamp*, never a boolean mode — the guestbook is already stamp-shaped (`memory.js:339 guestbookStamp`), and `w2NamedPresenceEvidence` already reads turn-stamped facts with a strictly-earlier contract (`identity.js` gate 3). Readers ask `presenceFresh(name,node)` = stamped at this resolved node within `PRESENCE_FRESH_TURNS`. A party `[LOCATION:]`/`[SUBLOCATION:]` move seals the frame implicitly, exactly as `sceneRefs` transitions already do. Re-arrival needs no special case: a fresh stamp. `[NPC_DEPARTS:]` may exist later as an *optional* liveness clear for `buildSceneManifest`, but no correctness property may depend on it — a tag the GM might not emit must never be load-bearing.

### Interactions

| Surface | Behavior |
|---|---|
| `[PARTY_SPLIT:]` | The existing split guard (`memory.js:300`) sits inside `npcRecordPresence`, so it covers the SAY path automatically — a split member who speaks via sending is not stamped at the camera node. |
| Combat | `[COMBAT_START:Name]` becomes a third presence writer when `Name` resolves to a rostered NPC (reliable per the field constraints). `[SCENE_CAST:]` notes stay combat-silent. |
| `buildSceneManifest` (game.js:258) | Its prose name-scan on the last GM entry can be **retired** once SAY-presence lands — the affordance gate stops needing the one place the engine reads prose. |
| `w2NamedPresenceEvidence` gate 3 | Add one limb before the guestbook limb: `spoke at this node at tN`, same strictly-earlier `lim` test. Handle-mediated paths untouched. |
| `buildGeoBlock` | Unchanged — the guestbook projection contract ("no *recorded* visit"; unrecorded = UNKNOWN) is already correct for a record that is now honest. |

---

## (b) HOW IT HOLDS

| Constraint | Verdict |
|---|---|
| Mention ≠ presence (fixed point 1) | Structural. `[NPC:]` no longer calls the presence writer at all. |
| `[NPC:]` tagging encouraged (fixed point 2) | Unchanged and cheaper — the GM no longer has to fear that registering Magistrate Vess teleports her. TODO #190's fix becomes free of side effects. |
| GM non-compliance | The primary writer is the one tag with 95% live compliance. Nothing new is *required*. |
| Under-recording hazard (t1903) | **Evidence goes up, not down.** Sonnet5: 49 speaker-instances/50 turns currently produce zero presence records. Opus5: 59. The death gate is better fed than today. |
| One tag = one table entry | `SAY` moves out of `TAG_NO_HANDLER`; `SCENE_CAST` is one new entry (parse+strip+doc derive together). |
| Stable/volatile split | All three doc additions are campaign-constant. Engine notes ride the volatile user-message channel. |
| ES5 / no deps | The handler above is ES5 as written. |
| Migration | Measured: 1 node, 5 guestbook records at t1903. No tool needed; `healMemory` untouched. |

---

## (c) FAILURE MODES, HONESTLY

1. **Remote-voice `[SAY:]` → false presence.** Measured ceiling: across 589 `[SAY:]` instances in 16 corpora, **14 (2.4%)** sit within ±200 chars of a remote-voice keyword; the 8 I read were all false positives (the PC's own name near incidental "dreams"/"remember"). Real rate is plausibly <1%, versus today's mention pollution which is *structurally* every discussed character. Not zero — accepted under the existing "recorded-evidence boundary."
2. **Silent present NPCs get no stamp.** A guard who never speaks is unrecorded. Mitigated by `|here` and `[SCENE_CAST:]`, but neither is guaranteed. The guestbook projection already says "no recorded visit," so this degrades to *unknown*, never to *false*.
3. **`[SCENE_CAST:]` may go the way of `[SCENE_REF:]`.** Likely, honestly. The design survives it — it is a convenience layer, not a dependency, and its absence only leaves records sparser.
4. **Retiring the manifest prose-scan could narrow the affordance gate** for silent NPCs. Recommend landing it as a *separate* commit after SAY-presence is measured in the field.
5. **`[SAY:]` for a character in an adjacent room, shouting through a door.** Stamps them at the party's node. Deliberate over-record; the granularity gap is #164 territory.

**REQUIRES OWNER RULING:** `[SAY:]` acquiring a state handler makes a TTS-facing tag load-bearing for canon. If voice attribution is ever changed for audio reasons, presence changes with it. I recommend accepting this coupling — but it should be a ruling, not a side effect.

## Appendix 2 — angle: signal-inference

## EXECUTIVE SUMMARY

1. **`[SAY:]` is the presence signal the GM already emits reliably and the engine currently throws away**: across 440 live-save `tagLog` responses, `SAY` appears on **390 (88.6%)** vs `NPC` on **60 (13.6%)** and `SCENE_REF` on **0**. Deriving presence from `SAY` + the rolling combat roster is a net **increase** in evidence, not a rationing of it.
2. Measured on the 550 SAY-era corpus responses (322 `[NPC:]` name-instances): same-response `[SAY:]` covers **55.9%**, the *rolling* combat roster **39.8%**, union **78.6%** — the residual 21.4% is dominated by *present-but-silent* actors, not mentions.
3. So inference alone **cannot** replace `[NPC:]` for presence; it can replace it as *authority*. Split the write: `[NPC:]` = registration + a mention stamp; derived signals = the only writers of guestbook/`lastSeenAt`/death-gate presence.
4. Because `[NPC:]` presence is *removed* from the #175b gate while `SAY`/combat presence is *added*, the gate ends up strictly better fed than today — that is the direct answer to the under-recording hazard.
5. Honest gap: silent NPCs in social scenes, letters/scrying (measured 0/589 in corpus but real), and departures. Design keeps them in the epistemically correct state ("registered, not witnessed") rather than guessing.

---

## (a) SIGNAL INVENTORY — everything in `tag_table.js` that implies a body in the room

| Signal | Implies | Precision est. | Known exceptions |
|---|---|---|---|
| `[SAY:Name]` (#96, field-validated) | speaker is here | **~98%** — cue-word scan flagged 13/589; manual read found **0** genuine remote speech | letter read aloud, sending stone, scrying, dream/flashback, one character *quoting* another |
| `[COMBAT_START:]` + rolling `foes[]` until `[COMBAT_END:]` | foe is here | ~99% | summoned-then-fled; ranged foe on a wall (still "here" for our purposes) |
| `[ENEMY_HP:Name]`, `[ENEMY_SLAIN:]`, `[ENEMY_SURRENDERS:]` | here | ~99% | named-routing near-miss (contains-match) |
| `[LOCATION:]`/`[SUBLOCATION:]`/`[PARTY_SPLIT:]`/rejoin/#133b fold/`startGame` | party attendance | ~100% (already the truthful writers, `tag_table.js:1012`) | — |
| `[COMPANION_HP:]`, `[COMPANION_SPELL_USED:]`, `[COMPANION_CONDITION:]`, `[COMPANION_ITEM_*]` | that companion acted **in body** | ~95% | remote/split companion taking off-screen damage |
| `[SPELL_USED:]` + capability `targets`/`range` local | target is here | ~90% | remote-range spells (bible `range` already distinguishes; `suggestionRangeLocal` precedent, `game.js:212`) |
| `[NPC_PRONOUN:]`, `[NPC_NOTE:]`, `[LORE:]`, `[DECISION:]` | **nothing** | — | pure bookkeeping about absent people |
| `[LOCATION_RESIDENT:]` | association only, explicitly *not* presence (#173) | — | by design |
| `[QUEST_STEP:]` text, `[DICE:]` label | **nothing usable** — free text, no actor field | — | would require prose parsing → forbidden |
| Player input naming an NPC | **rejected as evidence** | — | player intent ≠ scene truth ("I think about Vess") |

`[DICE:]` deserves an explicit no: its payload is `label|result|outcome`, carrying no actor slot, so any actor extraction is a prose scan.

## (b) DESIGN — derive at a post-handler seam, tier the confidence

**① Split the conflated write.** `mapNpcLocation` (`memory.js:282-303`) currently does registration *and* presence in one call, invoked unconditionally from the `[NPC:]` handler (`tag_table.js:424`). Split it:

```js
/* registration only — identity, pronouns, first encounter, display association */
function npcRegisterAt(name){                       // called by [NPC:]
  var key=locResolve(currentNodeKey()),node=memory.map.nodes[key];
  if(node&&node.npcs.indexOf(name)<0)node.npcs.push(name);   // DISPLAY-ONLY (amendment ⑦)
  if(memory.npcs[name])memory.npcs[name].mentionTurn=worldState.turn;   // NEW: not presence
}
/* presence — the ONLY writer of lastSeenAt/lastSeenTurn/guestbook */
function presenceWitness(name,src,turn){            // src: "say"|"cbt"|"arr"|"comp"
  var key=locResolve(currentNodeKey());
  if(_splitAway(name))return false;                 // #137, unchanged
  if(memory.npcs[name]){memory.npcs[name].lastSeenAt=key;memory.npcs[name].lastSeenTurn=turn;
                        memory.npcs[name].witnessedEver=1;}
  return guestbookStamp(key,name,turn,src);         // src recorded in rec.by[turn]
}
```

**② One derivation pass at the existing post-handler seam** (`tag_table.js:1012`, beside `guestbookCommitArrivals`) — so combat, `[PARTY_SPLIT:]`, `[LOCATION:]` and the #133b fold have all settled before anyone is placed:

```js
function derivePresence(text,R){                    // pure over (text, settled state)
  var out={},i,m,re=/\[SAY:([^\]|]*)\]/g;
  while((m=re.exec(text))){var s=m[1].replace(/^\s+|\s+$/g,"");if(s)out[resolveNpcName(s)]="say";}
  var foes=(worldState.combat&&worldState.combat.foes)||[];
  for(i=0;i<foes.length;i++)if(!foes[i].down)out[resolveNpcName(foes[i].name)]="cbt";
  re=/\[COMPANION_(?:HP|CONDITION|SPELL_USED|ITEM_GAINED|ITEM_LOST):([^\]|]+)/g;
  while((m=re.exec(text)))out[resolveNpcName(m[1])]="comp";
  return out;                                       // engine-testable, no DOM, no prose
}
```
Names not on the roster are skipped silently (registration is `[NPC:]`'s job). The player character is skipped.

**③ Two tiers, one schema addition.** `rec.by = {turn: "say"|"cbt"|"arr"|"comp"|"legacy"}`, bounded by `GB_TURN_CAP`, healed by `healMemory`. Existing guestbook turns migrate to `"legacy"` — cheap **now**: the t1903 live save has 85 map nodes but **1 node with a guestbook, 5 records, 5 stamped visits** (#173 is young; in 200 turns this migration is expensive).

**④ Retier the #175b gate (`identity.js:865-868`) so it gains evidence overall:**

| Limb | Today | Proposed |
|---|---|---|
| co-location `lastSeenAt`/`lastSeenTurn` | any `[NPC:]` mention writes it | only `presenceWitness` writes it → **strong** |
| guestbook turn | mention-polluted | `by ∈ {say,cbt,arr,comp}` → **strong**; `legacy` → weak |
| `statusTurn` (roster write) | authorizes alone | authorizes only if `witnessedEver` — closes the blueprint-dossier hole |
| `[SAY:]`/combat | **contributes nothing today** | now a strong limb |

Preflight ordering is preserved for free: the derivation commit runs *after* handlers, while the W2 envelope preflight runs during them against cloned state, so a same-response `[SAY:]` still cannot authorize that response's death (`lim` strictly-earlier contract, `identity.js:846`).

## (c) WHAT THIS CANNOT COVER — stated plainly

- **Present-but-silent actors: 50/322 (15.5%)** of tagged names appear in prose, physically acting, with no `SAY` and no combat entry (e.g. `v1636_sonnet` t28 "Morwen walks two paces behind. She does not speak."). They stay *registered, not witnessed*. That is correct epistemics, but it means the guestbook under-records real attendance for quiet companions of non-party NPCs. Party members are unaffected (arrival writers cover them).
- **Remote speech**: `[SAY:]` for a letter/sending stone stamps a false presence. Measured 0/589, but it exists. I recommend **accepting it** rather than extending the `SAY` grammar — `SAY_TAG_RE` payload feeds TTS speaker mapping (`game.js:564`), and a `|remote` operand would need the TTS splitter changed. *Extending `[SAY:]` to `[SAY:Name|remote]` REQUIRES OWNER RULING.*
- **Departures**: nothing infers absence. Presence stays additive-per-turn; only `lastSeenAt` overwrite moves someone.
- **Crowds and unnamed extras**: no coverage, correctly.
- **`[NPC:]`-only social scenes** (19/322 where the name never appears in prose at all — genuine mentions, e.g. `v1635` t35 "Void Ironside" tagged while the party talks to someone else): these now correctly stamp *nothing*.

## (d) FAILURE MODES

1. **Contains-matching**: `resolveNpcName` plus substring matching can bind `[SAY:Grim]` to *Grim Saltborn* and to *Grimtide*. Use `resolveNpcName` only (its alias/distinctive-token vocabulary), never substring, and drop unresolvable speakers. A wrong bind writes a false eyewitness turn — the exact t1728 harm.
2. **Silence must stay silent**: when a derived stamp contradicts a fresh `lastSeenAt` at another node, **file nothing and log to `tagLog`** — no nudge. Entry 17's nine-record nudge factory is the precedent against making this a prompt.
3. **Gate regression risk**: if a campaign's victim was never a speaker and never a foe, gate limb 3 falls to `statusTurn+witnessedEver`. A blueprint-seeded NPC who was introduced in prose but never `SAY`-tagged and never fought is *unkillable by bare name* until one witness signal lands. That is a real, bounded re-opening of the t1903 class and the single thing to soak before shipping (`dev/replay-w2-incident.js`, `dev/sabotage-guestbook.js`, `dev/sabotage-w2.js`).
4. **`[SAY:]` volume varies by provider**: 128 SAY names in 50 sonnet turns vs 2 in 50 grok turns. Presence fidelity becomes provider-dependent — acceptable given the pruned menu, but it belongs in the #17 drift-health readout as a "witness rate" indicator.

**Scratch scripts:** `…\scratchpad\angle2\measure.js`, `measure2.js`, `measure3.js`, `say.js`. No repo file modified.

## Appendix 3 — angle: observer-enforcement

## Executive summary

1. **The nudge layer cannot be the primary presence writer** — measured: `[NPC:]` appears in 4–7 of the last 40 responses in three live saves, `[SAY:]` in 35–38, `[SCENE_REF:]` in 0. Presence must be *inferred* from the channels the GM already emits for its own reasons; the observer interrogates only the residue.
2. Across 550 post-#96 corpus responses, 322 distinct `[NPC:]` writes: **62% are corroborated in the same response by `[SAY:]` or a combat tag; 38% (122) are not.** Grade the corroborated ones as presence, the rest as mention-only.
3. A naive "ambiguous mention" nudge fires on 16.4% of turns (0.22/turn) — a factory. With a repetition filter + permanent per-entity latch it fires on **4.2% of turns (23 notes / 550 turns, 23 distinct entities, worst single run 6/50)**.
4. **The note must never ask "is X present?"** — the cheapest answer to that is yes. Both branches ship as pre-composed tags, the presence branch must *name the node* (engine-validated), and silence resolves to mention (the conservative record).
5. Under-recording is defused not by the classify note but by widening the writers: `[SAY:]`/combat carry 62% of writes today, so the #175b gate is fed by channels the GM emits reliably — and the mention-grade `statusTurn` limb that authorized t1903's Caul can then be retired **REQUIRES OWNER RULING**.

---

## 0. Precondition: graded presence (the substrate the observers need)

Angle 3 is unbuildable on ungraded records. Minimum change:

| Writer | Grade | Writes |
|---|---|---|
| `[SAY:E]`, `[COMBAT_START/ENEMY_HP/ENEMY_SLAIN/COMBAT_STATS:E]` | `witnessed` | `lastSeenAt`+`lastSeenTurn`+`guestbookStamp` |
| `[LOCATION:]`/`[SUBLOCATION:]`/`[PARTY_SPLIT:]`/rejoin/seed | `witnessed` | unchanged (already truthful) |
| bare `[NPC:E\|mood\|rel]` | `mentioned` | roster + `memory.npcs` **only** — `mapNpcLocation` not called |
| `[NPC_PRESENT:E]` (new, Observer A's answer) | `asserted` | same as witnessed, stamped `grade:"asserted"` |

`mapNpcLocation(name, grade)`; `guestbookStamp(node,name,turn,grade)` refuses `grade==="mentioned"`. Guestbook records gain `grades:{turn:grade}` — **live migration burden measured as 5, 0 and 0 records across t1903/t1837/t1728** (77–85 nodes each), so `healMemory` can simply default legacy stamps to `"legacy"` and admit them; nothing needs rewriting. `memory.npcs[].lastSeenGrade` likewise defaults `"legacy"` — and note **0 of 48 `lastSeenAt` records in t1903 carry `lastSeenTurn` at all**, so the #175b co-location limb is already dead there.

## 1. The three observers

All are `NOTE_BUILDERS` entries, combat-silent **without consuming**, single-record-per-axis (W4), and their latch keys must be added to `NOTE_LATCH_FIELDS` or the #151 LATCH REGISTRY CONTRACT fails the build.

| # | Observer | Armed in `observeDriftAxes(raw,clean)` when | Fires | Latch |
|---|---|---|---|---|
| **A** | `buildPresenceClassifyNudge` | an `[NPC:E]` write with (i) no same-response witnessed writer for E, (ii) no witnessed record for E at the current node, (iii) E named in ≥2 of the last 6 committed responses (kills one-off name-drops), (iv) E not party, not dead | 1 entity/turn, most recent first | `worldState.presenceClassifyNudged[E]={count,turn}` — **permanent**, retires after 2 unanswered (`buildRecurringNameNudge` precedent) |
| **B** | `buildPresenceStarvationNudge` | a death/consequence claim for E was refused by `w2DeathAuthorized` **and** E has only mention/legacy-grade records (distinguishable from the existing conflict note, which asks for handle ceremony) | once per subject, then hands off to the existing conflict record | `worldState.presenceStarved={name,turn,attempts}`, max 2 |
| **C** | `buildPresenceContradictionNudge` | a `witnessed` writer fired for E while the record says E is **split off** (`charSheet.splitLoc`) — the only deterministic, record-based contradiction | one-shot, 2-turn shelf (`buildStayBehindNudge` shape) | `worldState.presenceContra` |

Observer A is armed at the same seam as `locationFilingWatch` (game.js:1556) using a rolling `worldState.presenceWatch={name,turns:[…]}` — **one record, not a history**, per W4.

## 2. Note texts

```
A: [ENGINE NOTE — SCENE MEMBERSHIP (not a player action): you registered "Vess" again this turn.
The registration is correct and useful — keep doing it for anyone the story names. This asks only
ONE thing the record cannot tell: was Vess physically in the scene you just narrated?
• IN THE SCENE, at <node> → emit [NPC_PRESENT:Vess|<node>] in your next response.
• Only spoken of, remembered, read about, or elsewhere → emit nothing. The record already reads
  "mentioned", which is what the engine will keep.
Do not answer in prose, and do not move Vess into the scene to satisfy this note.]
```

```
B: [ENGINE NOTE — PRESENCE NOT ON RECORD (not a player action): a permanent consequence for
"Caul" was refused: the record has Caul registered but never places Caul in a scene with the
party, so the engine cannot tell a narrated death from a reported one.
• If Caul is on screen with the party NOW → emit [NPC_PRESENT:Caul|<node>] in THIS response,
  then re-emit the death and its rewards in one CANON_TXN with a NEW claim id NEXT response.
• If the death was reported to the party rather than witnessed → leave Caul alive in state and
  narrate the report as a report.
This note will not repeat more than once.]
```

```
C: [ENGINE NOTE — SPLIT MEMBER SPOKE (not a player action): Daeris is recorded as split off at
Sandpoint, but this turn's narration gave Daeris a spoken line in the party's scene.
• Rejoined → [PARTY_SPLIT:Daeris|rejoin]
• Still apart (a letter, a memory, a sending, a scene elsewhere) → re-emit
  [PARTY_SPLIT:Daeris|Location|Sublocation] and the record is reset.]
```

Design rules the phrasing encodes, each traceable to a measured failure: **(1)** both branches are pre-composed tags — the GM copies, never composes (`buildSplitAudit`); **(2)** the presence branch costs a tag and names the node, the mention branch costs nothing — silence lands on the conservative record; **(3)** `[NPC_PRESENT:]` must carry a node that `locSame`-matches the current node or it is refused loudly (a rubber-stamp that guesses wrong dies at the parser); **(4)** two unanswered deliveries retire the note — the t1742 conflict fired 14 times and the GM rationalized the dispute *into the fiction* (body-double narration, t1781).

## 3. Constraint check

| Constraint | How it holds |
|---|---|
| Mention ≠ presence (fixed pt 1) | `mapNpcLocation` is no longer called from the `[NPC:]` handler at all; only graded writers reach the guestbook |
| `[NPC:]` still encouraged (fixed pt 2) | note A's first line explicitly praises the registration; nothing about `[NPC:]` gets harder |
| Poor ceremony compliance | zero new *required* ceremony — 62% of writes are already covered by `[SAY:]`/combat; `[NPC_PRESENT:]` is optional and only ever requested for the 4.2% residue |
| Under-recording hazard (t1903) | Caul was authorized by `statusTurn` (roster write t1878) while his `lastSeenAt` pointed at a *different node*. Under this design he'd be authorized by his combat/`[SAY:]` witnessed record instead — and if he had neither, Observer B costs **one turn**, not 18 |
| ES5, one-tag-one-entry | `[NPC_PRESENT:]` = one `tag_table.js` entry (parse+strip+docs derive); observers are `var`-only functions |
| Cache split | all three notes ride the user-message engine-note channel; stable half untouched |
| No prose scanning | every trigger reads tags and records only. Observer A's "named in ≥2 of last 6" counts `[NPC:]`/`[SAY:]` **tags**, not prose |
| Migration | measured 5/0/0 guestbook records live; legacy grades admitted, nothing rewritten |

## 4. Failure modes, stated plainly

- **Momentum compliance is real and only partly defused.** A GM that answers `[NPC_PRESENT:X|<correct node>]` reflexively is indistinguishable from a truthful one — there is no oracle. What the design buys is: the lazy path (silence) is the *safe* path, and a careless answer must still produce a node the engine can check. Detection, not prevention: log `grade:"asserted"` separately so an audit can measure how often assertions are the *only* evidence behind a death.
- **Chilling effect on registration.** Notes attached to `[NPC:]` may teach the GM to tag fewer mentions — directly harming TODO #190 (Vess). Unmeasurable in advance; the mitigation is the note's opening clause plus the ≥2-occurrence filter (a single mention is never nudged). **Watch metric: `[NPC:]` writes/turn before and after.**
- **`[SAY:]` ≠ presence** in flashback, letter, sending, dream. Observer C catches only the split-member case; a remote *non-party* speaker mis-stamps. Accepted residual, same "recorded-evidence boundary" the current guestbook already accepts, but the false-eyewitness class is now narrower (speech, not any mention).
- **Observer B can still loop** if the GM answers with neither branch. Capped at 2, then it hands the subject to the existing (now stale-capping) identity-conflict record.
- **Retiring the `statusTurn` limb of `w2NamedPresenceEvidence` is the actual repair** of the killable-by-mention leak — but it is the limb that unblocked t1903, so removing it before graded witnessed records have accumulated re-opens the quarantine class. Sequence: ship grading + observers, let witnessed records accrue, *then* retire. **REQUIRES OWNER RULING** on both the retirement and its timing.

## Appendix 4 — angle: data-model

## Executive summary

1. **Measured, not assumed:** across 200 distinct live GM responses (six `testRuns/*.tnd` tagLogs), `[SAY:]` fires on **90.5%**, `[NPC:]` on **12.5%**, `[SCENE_REF:]` on **0%**. Presence should be derived from the tag the GM already emits reliably, not from the one it doesn't.
2. **The current exposure is worse than stated:** in `t1903.tnd`, **49 of 52** rostered NPCs are bare-name death-authorizable today — because `lastSeenTurn` is populated on **0 of 48** `lastSeenAt` records (`w2NamedPresenceEvidence` gate-3 limb 1 is dead in the field), leaving `n.statusTurn` (set by any `[NPC:]` mention) as the only working limb.
3. **The t1903 incident refutes the ceremony approach empirically:** `[COMBAT_START:Caul]` t1878, `[ENEMY_HP]` t1880–1884, `[SAY:]` on **29/29** turns t1875–1903 — and the t1889 death was still refused for "no prior positive scene binding." The evidence was in the tag stream; the gate wasn't reading it.
4. **Recommendation: option (c), unified — the engine authors the scene frame the GM won't.** Split `mapNpcLocation` into mention vs presence; derive presence from `[SAY:]`/combat/party-movement at the post-handler seam; write it into a new **evictable** `frame.observed[]` beside the non-evictable authored `actors[]`. No new tag. Guestbook shape untouched — it just gains truthful writers.
5. **Migration is nearly free:** total live guestbook history is **5 stamps across 85 nodes** (t1903) and **0** at t1837/t1728 — the mention pollution is prospective, so no backfill tool is required.

---

## Why (a) and (b) lose

**(a) Provenance-graded guestbook.** A mention is not a weak visit — it is a fact about a *name being in play*, carrying no place. Grading forces `turns:[1,5,9]` into typed objects, which touches `guestbookStamp`/`_gbCapFold`/`guestbookFoldRecords`/`guestbookFoldBooks`/`guestbookRekeyName`/`locSplit`'s `take.guestbook`/`healMemory`/the geo projection (memory.js:320–424, api.js:70–90) and adds a third truth value to a projection whose ratified vocabulary is exactly two ("recorded visit" / "no recorded visit"). It multiplies the record and fixes nothing the death gate would read.

**(b) A new per-scene structure.** `sceneRefs` (identity.js:717–741) is already a per-scene structure with node binding, turn stamps, caps, sealing on transition, and summary-gated release — and the death gate already reads it. A second one is duplicate authority.

## Recommendation: derived presence into `sceneRefs`

### Schema

```js
/* globals.js */
var PRESENCE_OBSERVED_CAP=16;  /* derived actors per frame — EVICTABLE (LRU by lastTurn) */

/* identity.js — _sceneRefFresh gains one list */
{scene, node, startTurn, actors:[], negatives:[], observed:[], acknowledged:false}
/* observed entry */
{entity:"Caul", channel:"combat"|"speech"|"party", firstTurn:1878, lastTurn:1884, turns:5}
```

`actors[]` stays exactly as ratified: GM-authored, **never evicted**, overflow latches fail-closed. `observed[]` is engine-derived, therefore **re-derivable every turn from the tag stream** — so it is safe to evict and **must never call `_sceneRefOverflow`**. This is the load-bearing separation: without it, auto-derivation would trip the W2 overflow latch (`SCENE_REF_ACTOR_CAP`=10) in any busy tavern and freeze every irreversible identity write.

### Writers

| Channel | Trigger (parsed tags only, never prose) | Live rate |
|---|---|---|
| `speech` | `[SAY:Name]` resolving via `resolveNpcName` to a rostered NPC | 90.5% of responses |
| `combat` | `[COMBAT_START:]`, `[ENEMY_HP:Name\|]`, `[ENEMY_SLAIN:]`, `[ENEMY_SURRENDERS:Name]` | 1–2.5% |
| `party` | existing arrival queue, `[PARTY_SPLIT:]`, rejoin, `guestbookSeedStart` | unchanged |
| *(none)* | `[NPC:]`, `[NPC_NOTE:]`, `[LOCATION_RESIDENT:]` | — registration/association only |

```js
function presenceObserve(name,channel){
  var canon=resolveNpcName(String(name||"").trim()); if(!canon) return false;
  if(typeof memoryNpcIsPlayer==="function"&&memoryNpcIsPlayer(canon))return false;
  var n=(typeof wsNpcByName==="function")?wsNpcByName(canon):null;
  if(!n&&!(memory.npcs&&memory.npcs[canon]))return false;                 /* unrostered speaker: anonymous, no presence */
  if(n&&n.charSheet&&n.charSheet.splitLoc&&n.charSheet.splitLoc.location)return false;  /* #137 */
  if(typeof npcIsDead==="function"&&npcIsDead(n))return false;            /* B3: the dead don't travel */
  var f=sceneRefsEnsure().active,t=worldState.turn,i,hit=null;
  for(i=0;i<f.observed.length;i++)if(f.observed[i].entity===canon){hit=f.observed[i];break;}
  if(hit){hit.lastTurn=t;hit.turns++;if(_chRank(channel)>_chRank(hit.channel))hit.channel=channel;}
  else{ if(f.observed.length>=PRESENCE_OBSERVED_CAP)_evictOldest(f.observed);
        f.observed.push({entity:canon,channel:channel,firstTurn:t,lastTurn:t,turns:1}); }
  npcRecordPresence(canon);                 /* lastSeenAt + lastSeenTurn + guestbookStamp + node.npcs */
  return true;
}
```

`mapNpcLocation` splits in two. The `[NPC:]` handler (tag_table.js:424) calls **`npcRegisterMention(name)`** — `memory.npcs[name].lastMentioned = turn`, nothing place-shaped. `npcRecordPresence(name)` keeps today's body verbatim and is called only from `presenceObserve`. `presenceCommitFromTags(raw)` runs at the post-handler seam **after** `guestbookCommitArrivals()`, so the node is settled (CLAUDE.md §9 amendment ③).

### Readers

| Reader | Change |
|---|---|
| `w2DeathAuthorized` frame scan (identity.js:825) | also scan `frame.observed`, `firstTurn < _nmLim`, comparing `resolveNpcName(ob.entity)===canon` (merge-orphan bridge, §8b pattern) |
| `w2NamedPresenceEvidence` gate 3 | **drop** the unconditional `n.statusTurn` limb; keep it only when `statusTurn >= s.active.startTurn` — a mention *in the scene you are standing in*. Measured effect on t1903: **49 → 1** bare-name-authorizable NPCs |
| `buildSceneManifest` (game.js:247–266) | read `observed` first; keep `lastSeenAt` as legacy fallback; **delete the prose name-scan at 256–266** — `observed` covers the lag case it existed for, at 90.5% vs `[NPC:]`'s 12.5% |
| geo block / guestbook projection | unchanged code, truthful inputs |
| `lastSeenAt` | becomes **"last observed"**; `lastMentioned` (turn scalar, no node) carries the other half |

### Caps across the five scopes

per-call: none. per-turn: `observed` is one entry per name, updated in place, cap 16 LRU. per-session: frames seal on node transition (`SCENE_REF_SEALED_CAP`=6) and clear at `sceneRefsSummarySuccess`. per-campaign: guestbook `GB_TURN_CAP`=8 with agg fold (unchanged); `lastMentioned`/`lastSeenTurn` are O(1) scalars. per-device-forever: nothing new.

### Under #156 repairs

`guestbookFoldBooks`/`guestbookRekeyName`/`locSplit`'s `take.guestbook` are untouched. A `locMerge` mid-scene changes `locResolve(currentNodeKey())`, so `sceneRefsEnsure` seals and opens a fresh frame — nothing is lost, because **derived state self-heals: it is re-authored from the next response's tags.** No repair tooling owes it anything. NPC merges are handled by resolving `ob.entity` at read time.

## Failure modes, stated honestly

- **Remote or quoted speech binds presence** — a letter read aloud, a scrying voice, a flashback line all carry `[SAY:]`. Bound, not eliminated: the binding is *frame-scoped*, so it can only authorize consequences inside that same scene. Strictly narrower than today's `statusTurn` limb, which authorizes anywhere, forever.
- **The silent bystander is not recorded** — an NPC present but never speaking or fighting. Their bare-name death refuses and falls to the same-frame `statusTurn` limb, then to the nudge. This is the residual under-recording, and it is the price of fixed point 1.
- **Every campaign becomes gated.** `w2DeathAuthorized` currently short-circuits `true` when `worldState.sceneRefs` is absent; derived frames exist from turn one, so that legacy bypass disappears. **REQUIRES OWNER RULING** — the t1903-class quarantine risk moves from "campaigns that used W2 tags" to "all campaigns," offset by evidence arriving on 90.5% of turns instead of 0%.
- **Nudge channel, retargeted not added:** `buildIdentityConflictNudge`'s ask changes from "emit a scene handle" (0/1837 compliance) to "if X is present, give them a line" — a `[SAY:]` the GM performs anyway. No new standing rule, no stable-half change, no prompt-cache impact.
- **Not covered:** an NPC whose *only* appearance is a `[SAY:]` the GM forgot; a same-response death of someone first observed that same response (correctly still refuses — `firstTurn < lim`).

Scratch scripts: `…/scratchpad/angle4/m1.js`–`m6.js`. No repo file modified.

## Appendix 5 — angle: death-gate

## Executive summary

1. **Measured, on the real t1903 save: 37 of 39 living roster NPCs are killable by bare name right now**, and **33 of those pass on the `statusTurn` limb alone** (identity.js:865) — including Aldern Foxglove (roster write t867, ~1000 turns and a region away). The one-mention kill is not hypothetical; it is the current default state.
2. `statusTurn` is fed by any `[NPC:]` write, so it *is* the mention channel. Once mentions stop minting presence, it must be demoted to **weight zero** — it is the remote-kill side door and contributes no information the other limbs don't.
3. The replacement evidence already exists in every live save and needs **no new GM ceremony**: `[SAY:]` speaker maps are persisted per transcript entry as `entry.sp.s` — structured JSON, turn-stamped, **83.5% of GM responses since #96 shipped** (86.5% over the last 200), 48 distinct speakers, 95% of the last-40 tagLog window. Speech is presence.
4. Proposed gate 3 = **graded facts**: A (speech / combat engagement / bound scene actor / unsplit party) authorizes alone; B (recorded co-location) needs 2 distinct turns; C (roster paperwork) authorizes nothing. Plus a persistence valve so refusal can never loop.
5. **Replayed headless against `testRuns/Rise_of_the_Runelords__t1903.tnd`: Caul still authorizes** (`on screen: speech at t1897 (+13 more)`, 14 speech turns t1878–1897), the remote-mention attack **refuses**, and the killable census drops **37 → 9** — the 9 being the party, Caul, and the four characters actually in the scene.

---

## (a) The design

**Gates 1 and 2 unchanged.** Introduction stays permissive (it is necessary, not sufficient); an unresolved explicit `[SCENE_NOT:]` still hard-refuses and now also blocks the valve below. Handle-mediated paths (`_sceneRefActor`, `sceneRefDeath`) keep their full strictness.

**Gate 3 becomes one pure function over graded, turn-stamped facts** (all filtered `< lim`, where `lim = min(sourceTurn, worldState.turn)` — the entry-13 same-turn rule is preserved verbatim):

| Grade | Source | Writer | Weight |
|---|---|---|---|
| **A** speech | `transcript[i].sp.s` names them at `t < lim` (bounded tail scan, memoized per turn) | `[SAY:]`, 83.5% compliance | authorizes alone |
| **A** combat | `npc.engagedTurn`, stamped by the `COMBAT_START`/`ENEMY_HP`/`ENEMY_SLAIN` handlers when the foe name is on the roster | reliable when fighting | authorizes alone |
| **A** scene | a `sceneRefs` actor bound to the name | the existing ceremony, now *contributing* rather than gatekeeping | authorizes alone |
| **A** party | living, unsplit `partyMember` | engine-truthful | authorizes alone |
| **B** co-location | `lastSeenAt`+`lastSeenTurn` at the current node; guestbook visit turn | truthful writers *after* the mention fix; polluted *before* it | needs ≥2 distinct turns |
| **C** roster | `statusTurn`, `met` | **the mention channel** | **zero** |

```js
function npcPresenceFacts(canon,lim){ /* returns [{turn,grade,kind}], all turn < lim */ }
// gate 3:
//   if any A  -> authorize, citing kind+turn
//   else if distinct B turns >= 2 -> authorize
//   else null
```

`_speechFacts` reads `entry.sp` — a JSON map the engine wrote itself. **This is not a prose scan and not RAG**: it is deterministic, replayable, and already rides the state blob, `.tnd` export, and sync.

**The anti-starvation valve** (this is the load-bearing half — C=0 strictly *increases* refusals over today's gate, so the t1903 class would otherwise return for genuinely-offscreen deaths):

- On a refused named death, one-shot `buildDeathEvidenceNudge` fires at the moment of ambiguity (#168 W4 channel, not a standing rule): *"You narrated <Name>'s death; the engine has no record of them on screen. If they are here, tag their next line `[SAY:<Name>]`. If the death happened elsewhere, re-emit it and say so — offscreen deaths are accepted."*
- New table entry `[NPC_DEATH_REPORTED:name|source]` commits the death but stamps `npc.deathReported={turn,source}` and does not carry an eyewitness claim.
- **Persistence degrade:** after `DEATH_EVIDENCE_GRACE`=2 refusals for the same subject, the engine accepts the death **as reported**, loudly, into `memory.archive.reportedDeaths`. Suppressed when gate 2 has an explicit negative, when the subject is a sheeted party member, or when an unresolved conflict names a *different* handle. A GM that says someone is dead three times is telling the story, not confabulating a referent.

**Migration:** stamp `worldState.gbTruthfulFrom = turn` at upgrade. Guestbook turns ≥ that marker are truthful-writer-only and may later be promoted to authorize alone; earlier ones stay corroboration-only. No backfill is possible or needed — `sp` already covers history back to t923 on this save.

## (b) Constraint-by-constraint

- **GM non-compliance:** the design asks for *nothing new* on the happy path. Its primary evidence is the highest-compliance tag in the vocabulary (95% of the last 40 responses vs `[NPC:]` at 18%, `[SCENE_REF:]` at **0 of 1,837**), and it is a tag the owner *hears* — TTS keeps it honest.
- **Under-recording hazard:** measured Case C — an NPC who speaks once at t1920 and dies at t1921 authorizes on that single speech fact. The valve makes refusal terminate in ≤3 turns rather than never. This is the explicit repair of the t1903 loop shape.
- **Prompt cache / ES5 / one-tag-one-entry:** the nudge is volatile-half and one-shot; `[NPC_DEATH_REPORTED:]` is one `tag_table.js` entry (parse+strip+docs derive); everything is `var`/`function`, no deps.

## (c) Replay results (real engine, real saves)

| Case | Old gate | New gate |
|---|---|---|
| **t1903 Caul, `w2DeathAuthorized("Caul",null)`** | true (`roster write at t1878`) | **true** (`on screen: speech at t1897 (+13 more)`) |
| t1903 Caul, self-naming handle `"caul"` | true | **true** |
| Remote mention → death next turn | **true** (`roster write`) | **false** |
| Two mentions, two turns | true | **false** |
| One-scene NPC (speaks t1920, dies t1921) | true | **true** |
| Combat-engaged, silent (`engagedTurn`) | true | **true** |
| Never-on-screen (Aldern Foxglove) | **true** | **false** |
| `[SCENE_NOT:]` vs 15 grade-A speech facts | false | **false** (gate 2 dominant) |
| Killable-by-bare-name census, t1903 | **37 / 39** | **9 / 39** |

Scripts: scratchpad `angle5/probe.js`, `graded.js`, `cases.js`. `dev/repair-t1903-caul.js` still passes its `w2NamedPresenceEvidence("Caul",1902)` precondition.

## (d) What breaks — honestly

1. **Three shipped #175b engine tests encode `statusTurn` as the authorizing limb** (`dev/engine-tests.js:14185, 14204, 14221` — `n.introduced=1852;n.statusTurn=1878`). Verified: that fixture returns `null` under the graded gate. Rewriting them is **re-baselining a frozen assertion → Fable tier**, not an off-Fable change.
2. **Grade B's weakness is accidental, not designed.** `_w2NodeGuestbookTurn` returns only the *max* turn, so two mentions yield one B turn — Case B refuses for the wrong reason. If that helper is ever made to return all turns, two mentions authorize. **Fix the reason, not just the outcome:** gate B on `gbTruthfulFrom`.
3. **`[SAY:]` false positives:** a quoted letter, a Sending, a remembered line may carry `[SAY:Writer]`. That makes a remote speaker killable by name. Narrow, but real — and unmeasurable without a prose oracle. Mitigation available if the owner wants it: require the speech turn's `entry.e.l` to match the current world location (already recorded per entry).
4. **Pre-#96 campaign stretches** (before t923 here) have no `sp` and fall entirely to the valve. Older saves will see a burst of nudges on upgrade.
5. **`engagedTurn` is a new write in three combat handlers** — combat is on the drift surface; it needs its own sabotage case.
6. **REQUIRES OWNER RULING:** accepting a death after 2 refusals is a deliberate relaxation of "no unproven death ever commits." It trades a small false-positive rate for the elimination of the quarantine-loop class. I recommend it, because the t1903 evidence says the loop's cost (divergent canon, 4 conflict records, 18-turn toast loop, 2,600 XP + a quest completion stranded) exceeded the cost of a wrongly-accepted offscreen death.

## Appendix 6 — angle: projection

## Executive summary

1. **Measured, in the live t1903 save: the guestbook projects essentially nothing today** — 85 map nodes, **1** carries a guestbook, **5** records total (all single-turn, 0 residents, 1 non-party). The anti-confabulation surface #173 was built for is silent in ~99% of scenes, so mention-pollution has *not* yet accrued: the window to split the projection is open at near-zero migration cost.
2. **Every "NPCs elsewhere" line the geo block prints today is an undated assertion** — 48 of 69 `memory.npcs` carry `lastSeenAt`, **0** carry `lastSeenTurn` (api.js:60 prints `Name → Node` with no age). That is the least honest line in the prompt and it is fixable without touching any write path.
3. Proposal: one `PRESENCE_TIERS` registry (witnessed / spoken-of / associated / unknown) that geo block, map_viewer, map_cleanup and the sheets all render through, plus a **separate, capped, recency-windowed `node.mentions`** channel projected in rumor voice with an explicit non-presence clause.
4. Projection *can* help compliance, but as a **one-shot gap note** (`buildScenePresenceNudge`, combat-silent, cooldown + stale-shelving per the t1742/t1781 lesson), never as a standing "presence recorded: none" line — a standing negative teaches the GM the world is empty and invites over-tagging.
5. Honest costs: mention projection **primes** the GM to place mentioned people in scene; legacy guestbook turns are **provably indistinguishable** from mention-stamps (no provenance was ever stored), so old records must be permanently downgraded, not deleted.

---

## (a) The design

### P1 — one tier registry, four voices

```js
/* helpers.js — the ONE vocabulary for "how sure is this record". Every surface renders through
   it; adding an evidence kind is an entry, not an edit at four call sites. */
var PRESENCE_TIERS={
  witnessed:{rank:3,label:"remembers",claim:"stood here"},
  unverified:{rank:2,label:"half-remembers",claim:"is remembered here, from before the record kept provenance"},
  spoken:    {rank:1,label:"has heard the name",claim:"was spoken of here — that is not a visit"},
  associated:{rank:0,label:"is usually found at",claim:"is based here; not present unless you place them"}
};
```

`node.guestbook[name]` gains one boolean `unverified:true` (any turn recorded before the split shipped). `node.mentions[name]={turns:[…]}` is new, capped `MENTION_TURN_CAP`=4, windowed `MENTION_WINDOW`=60 turns, pruned on write.

### P2 — the mention channel: yes, project it

Rumours do have geography, and it is the one piece of *new fiction texture* the split unlocks. One line, current node only, cap 6 names, recency-sorted:

> `This place has heard these names lately: Magistrate Vess (t1890), Mokmurian (t1902). Hearing a name here is not a visit — nobody listed is present, and none of them has any recorded history with this place unless the memory line above says so.`

It is **not** read by `buildSceneManifest`, `w2NamedPresenceEvidence`, or the NPCs-elsewhere line. Ever.

### P3 — `lastSeenAt` display: last *placed*, age-banded, never bare

`lastSeenAt` keeps its name and its truthful writers; mention writes go nowhere near it. The projection at api.js:60 changes:

| today | proposed |
|---|---|
| `Rinn → The Docks` | `Rinn — last placed at The Docks, t1412 (491 turns ago; long cold, whereabouts now unknown)` |
| (undated for 48/69 NPCs) | `Sabyl — recorded at Sandpoint, when unknown (legacy record, not a current whereabouts)` |

Three bands off `worldState.turn - lastSeenTurn`: `<20` "was there recently", `<200` "was there", `≥200`/null "long cold / date unknown". No suppression — suppression re-opens the phantom-NPC class the line exists to close.

### P4 — negatives stay record-based, now three-state

Preserve the existing clause verbatim (it is already correct) and add the mention tier's own negative: *"a name heard here is not a visit; treat their history with this place as UNKNOWN."* Never "was never here", at any tier.

### P5 — residents unchanged, one clause added

The existing line is right. Add: *"placing them in a scene is what makes them present."*

### P6 — compliance: the gap note, one-shot

```js
function buildScenePresenceNudge(){           /* NOTE_BUILDERS; latch: lastScenePresenceNote */
  if(worldState.combat)return"";              /* combat-silent, like every sibling */
  var gaps=sceneSpeakersWithoutPresence();    /* [SAY:] names of the last response ∩ no presence record here */
  if(!gaps.length||worldState.turn-(worldState.lastScenePresenceNote||0)<PRESENCE_GAP_COOLDOWN)return"";
  worldState.lastScenePresenceNote=worldState.turn;
  return "[ENGINE NOTE — SCENE RECORD (not a player action): "+gaps.join(", ")+" spoke here last response, but nothing records them as present at "+nodeLabel+". If they are physically here, emit <presence tag> now; if they were only spoken of, quoted, or heard at a distance, emit nothing.]";
}
```

**[SAY:] is the right trigger.** Measured over the last 40 responses of three live saves: `SAY` fired in **38 / 36 / 35**, `NPC` in **7 / 4 / 6**, `LOCATION|SUBLOCATION` in **4 / 3 / 8**. The note keys on the channel that actually emits, and asks for ceremony only where a genuine gap exists.

### P7 — satellites

- **map_viewer**: guestbook section splits into witnessed / half-remembered / heard-of / based-here, tier-colored; a node whose whole book is mentions gets a **rumour** badge — visibly *not* a visited node.
- **map_cleanup**: new census evidence type `mention-only record (legacy, unverifiable)`. It classifies nothing (the standing rule) — it *shows* the record and offers demote/leave. `locMerge`/`guestbookFoldBooks` must fold `node.mentions` and OR `unverified`, or a repair silently deletes the channel.

---

## (b) Under the constraints

| Constraint | How it holds |
|---|---|
| GM non-compliance | Projection reads state, demands nothing. The only ask is P6, triggered off the 88–95%-reliable `[SAY:]` channel, cooled down and shelved-when-unanswerable. |
| Under-recording hazard | Projection is **read-only** — it cannot starve `w2NamedPresenceEvidence`. P6 *adds* evidence opportunities at the moment of ambiguity (the validated W4 observer shape). |
| Fixed point 1 (mention ≠ presence) | `node.mentions` is a separate store, never read by manifest/gate/NPCs-elsewhere. |
| Fixed point 2 ([NPC:] encouraged) | Nothing here discourages tagging; a mention tag now lands in the honest channel instead of the eyewitness one. |
| Stable/volatile | All of it is state-derived → volatile half. Zero stable bytes, zero cache impact. |
| ES5 / one-tag-one-entry | No new tag in this angle. Registry + pure render functions; `sceneSpeakersWithoutPresence` is pure and engine-testable. |
| No-ledgers voice | Labels move to memory voice ("remembers", "half-remembers", "has heard the name"); the clerical eyewitness sentence rewrites as *"two people share a memory of this place only if the record puts them here on the same turn; otherwise it is hearsay."* **Tension stated honestly: the turn numbers must stay** — the same-turn eyewitness test is mechanical and cannot be expressed in mood words. |
| Migration | `healMemory` adds `unverified:true` to every existing record and `mentions:{}`; measured cost at t1903 = **5 records touched**. |

---

## (c) Failure modes

1. **Priming.** Naming rumoured people in the prompt makes the GM more likely to walk them on stage. Real, unmeasurable in advance. Ship P1/P3/P4/P6 first; ship P2 second and judge it against a corpus.
2. **Byte inversion.** Today's attendance line fires at ~1 node in 85; the mention line would fire most scenes — net prompt growth. Hard cap 6 names, one line.
3. **Legacy indistinguishability.** Pre-split guestbook turns carry no provenance. They are downgraded to `unverified` forever — a permanent honesty tax, and a genuine visit gets under-credited. Cheap only because the corpus is 5 records; it would be unaffordable in six months.
4. **Note fatigue.** P6 is the 39th `NOTE_BUILDERS` entry. Without cooldown + stale shelving it reproduces the t1742 → t1781 rationalization-into-fiction failure.
5. **Standing negatives are dangerous.** "Presence recorded: none" as a permanent geo line would (a) advertise the record's own poverty and (b) invite defensive over-tagging. Kept strictly one-shot — **REQUIRES OWNER RULING** if a standing form is ever wanted.
6. **Repair-path silence.** `node.mentions` not folded in `locMerge`/`locSplit`/`guestbookRekeyName` disappears without a warning — the exact rot class #156B was built against.

**Files that change (none modified here):** `memory.js` (guestbook shape, mentions store, fold), `api.js` 50–60 + `gbAttendanceLines`, `helpers.js` (`PRESENCE_TIERS`, pure renderers), `api.js` NOTE_BUILDERS + `NOTE_LATCH_FIELDS` (`lastScenePresenceNote`), `map_viewer.html` 377–390, `map_cleanup.html`, `dev/loc-repair-core.js`.

## Appendix 7 — angle: red-team

## EXECUTIVE SUMMARY

1. **The leak is already terminal, not hypothetical:** in the live t1837 save **35 of 37 living NPCs pass the #175b named-death gate right now**, all via `statusTurn` alone — including Aldern Foxglove and Hemwick (last written t867, ~970 turns and a city away from the party's `Magnimar|Vess's Sealed Chambers`). The gate is currently "was ever `[NPC:]`-tagged."
2. **The guestbook contributes zero evidence today** (0 records across 82 map nodes at t1837 — #173 post-dates the save), so `statusTurn` is doing 100% of the authorization work; pollution is *ahead* of us, not behind, and migration is cheap **now** and never again.
3. **Every additive presence tag starves on a shipped provider.** Measured over 50-turn corpora: `[SAY:]` = 127 (opus5), 58 (sonnet5), **10 (gpt-5.6-sol)**; `[NPC:]` = 6–21; `[SCENE_*]` = 3–10 per 50 turns and **0 in the live save's last 40 responses**. Any single-source presence design fails for at least one listed model.
4. **Therefore no boolean presence flag survives red-teaming.** The only shape that does is *typed, provenance-tagged evidence* (eyewitness vs cited) with per-consumer strength, plus a **GM-decides one-shot note on refusal** — a permanent refusal re-opens the t1903 quarantine loop.
5. **Residual floor (unclosable):** the GM can narrate a person present and emit the identical tags whether they are or not; no engine reading only tags can distinguish a lie from a truth. Every design below reduces *accidental* pollution; none detects *coherent* fabrication.

---

## A. The design I'd defend (compact)

**Split provenance, not tags.** `[NPC:]` keeps both jobs — but the presence half is typed as weaker evidence.

```js
/* memory.js — guestbook record gains one field. ES5, additive, healMemory-shaped. */
rec = {turns:[], cited:[], resident:false, agg:null}   // turns = EYEWITNESS, cited = MENTION
```

| Writer | file:line | Evidence class |
|---|---|---|
| party arrival seam (`guestbookNoteArrival`) | memory.js:~400 | `turns` (eyewitness) |
| `[PARTY_SPLIT:]` / rejoin / `guestbookSeedStart` | memory.js:~415 | `turns` |
| `[COMBAT_START:]` + `[SAY:Name]` **when the same response also holds no remote-speech marker** | tag_table.js | `turns` |
| `[NPC:]` via `mapNpcLocation` | memory.js:282 | **`cited`** — never `turns` |

`memory.npcs[n]` likewise gains `lastCitedTurn` beside `lastSeenAt/lastSeenTurn`. Consumers pick strength: `w2NamedPresenceEvidence` gate 3 reads **`turns` only, at the resolved current node, within `PRESENCE_STALE`**; `buildGeoBlock` projects `turns` as attendance and `cited` never; `buildSceneManifest` may keep `cited` (advisory surface, no canon). `statusTurn` is **removed** from the death gate (it is a registration timestamp wearing a presence costume).

Under-recording is closed not by loosening the gate but by **replacing permanent refusal with one arbitration note** (the validated #168 W4 one-shot channel):

> `[ENGINE NOTE — DEATH UNVERIFIED, DECIDE (not a player action): the story says <N> died, but no eyewitness record places <N> in this scene. If <N> is here, emit [SCENE_REF:<n>|<N>] this response and the death lands. If this death happened elsewhere or off-screen, emit [NPC:<N>|dead|<rel>] instead.]`

---

## B. RED TEAM — attacks

### (a) Explicit arrives/departs tags — **REJECT**

| Attack | Lands at | Invariant broken | Sev |
|---|---|---|---|
| **Momentum misuse.** GM writes "Karzoug's gaze finds you across the leagues" and emits `[NPC_ARRIVES:Karzoug]`. Measured precondition: Karzoug appears in the entity index **61 times across 17 distinct locations** in a campaign where he is never physically present. | new handler beside tag_table.js:370 | presence truth; then #175b gate 3 | **HIGH** |
| **Never-departs staleness.** Departures are pure bookkeeping — the tag class with the worst compliance (`[SCENE_REF:]` 0/1837, `[FUTURE_EVENT_RESOLVED:]` needed five teeth). An NPC arrives at t400 and is "present" forever: the #137 phantom class, now writing *canon* instead of a manifest hint. | absent-departure path | membership≠presence | **HIGH** |
| **Scene-boundary ambiguity.** 57-turn dungeon run with zero `[LOCATION:]` tags → no node transition → the arrive-frame never closes. | fileLocation seam | frame sealing | MED |
| Guard | Departures must be **engine-derived** (node change, combat close, N-turn decay), never GM-authored. That reduces the tag to "stamp presence now" — i.e. exactly the `turns` write in §A, with a worse compliance profile and a new vocabulary to teach. **Net negative.** | | |

### (b) `[SAY:]`-derived presence — **PARTIAL, must be co-conditioned**

| Attack | Lands at | Invariant | Sev |
|---|---|---|---|
| **Provider starvation.** gpt-5.6-sol emits **10 `[SAY:]` in 50 turns** vs sonnet5's 58. On that shipped provider a SAY-only design records almost nothing → the death gate starves → t1903 loop returns. | TTS-driven authoring, not engine | under-recording | **HIGH** |
| **Quoted / remote / vision speech.** A letter read aloud, a scrying pool, a remembered line, a dream — all legitimately get `[SAY:Name]` because the owner *hears* them in TTS. The tag's field-validated reliability is for **attribution**, not **location**; using it for presence silently repurposes a validated signal. | tag_table.js `SAY` | presence truth | **HIGH** |
| **TTS-motivated over-tagging.** The GM is rewarded (audibly) for tagging every voice; adding a state consequence to `[SAY:]` creates a channel where the *prose incentive* and the *canon incentive* disagree — the exact shape that made `[NPC:]` a liar. | — | incentive purity | MED |
| Guard | Only accept `[SAY:]` as eyewitness when the speaker is **already in the manifest or bound to an active scene frame** — i.e. SAY *confirms* presence, never *creates* it. Accept the residual starvation; §A's arbitration note absorbs it. | | |

### (c) Observer nudges — **KEEP, but never state-minting**

| Attack | Lands at | Invariant | Sev |
|---|---|---|---|
| **Rubber-stamp.** "Is Vess here? emit `[SCENE_REF:]`" → GM emits it for whoever the note names, because the note named them. Precedent: t1903's GM emitted `[SCENE_REVEAL:]` **four times with handles it had never registered**, minting a conflict record each time (identity.js:~770 `_w2Conflict` on reveal). Notes teach the answer. | any nudge naming the entity | evidence independence | **HIGH** |
| **Nudge fatigue / factory.** The t1903 loop measured 9 records + a cap overflow + an 18-turn toast loop from *one* refused death. Any nudge that re-fires per turn recreates it. | identity.js `_w2Conflict` | bounded state | **HIGH** |
| **Advice that mints state (v1.650 lesson).** A note that says "I'll assume present unless you object" makes silence into canon. | — | no-silent-writes | **HIGH** |
| Guard | Notes must be **fork-shaped** (§A: "here → tag; elsewhere → other tag"), **one-shot per (subject,turn)** keyed like #175bR's `(subject,"-")` collapse, **combat-silent**, and must never name the answer they want. Nudges arbitrate; they never record. | | |

### (d) Corroboration windows (N mentions ⇒ presence) — **REJECT outright**

| Attack | Lands at | Invariant | Sev |
|---|---|---|---|
| **Slow-burn forge.** Karzoug: 61 mentions / 17 nodes. Sheriff Belor Hemlock: 161 / 12. Any "2 mentions ≠ mention" rule promotes *the most-discussed absent characters first* — precisely the villains and patrons whose deaths matter most. | a would-be counter in mapNpcLocation | presence truth | **CRITICAL** |
| **Counting is not evidence.** Two false facts corroborate to a confident false fact. This is the identity-before-timing-guards callout in its purest form: the fix is splitting the *kind* of record, never thresholding the *count*. | — | — | — |
| Guard | None exists. Do not ship this shape. | | |

### (e) Migration — **the sharpest live risk**

| Attack | Lands at | Invariant | Sev |
|---|---|---|---|
| **Grandfathering.** If existing `statusTurn`/`lastSeenAt` are read as eyewitness after the split, the t1837 save keeps **35 killable-by-name NPCs**, and every legacy campaign's mention history is laundered into death evidence on first load. | identity.js:850–865 | the whole fix | **CRITICAL** |
| **Silent downgrade.** Conversely, migrating everything to `cited` starves mature saves' gate on day one → refusal wave → t1903 class at scale. | healMemory | under-recording | **HIGH** |
| Guard | `healMemory` migrates legacy stamps to **`cited` only** (unknowable provenance is not eyewitness), **and** the arbitration note (§A) ships in the same commit so the refusal wave becomes a one-turn GM fork, not a quarantine. Legacy `lastSeenAt` without `lastSeenTurn` is already distrusted at identity.js:862 — extend that precedent, don't invent one. | | |

### (f) Attacks on **my own** design

- **`[SAY:]`-confirms-manifest is circular:** the manifest's "presence by narration" limb (game.js:~258) is a **prose name regex on the last GM entry** — a mentioned name enters the manifest, then SAY "confirms" it into eyewitness canon. **Guard:** the confirm limb must read the *map/scene-frame* half of the manifest only, never the narration limb. Missing this makes §A strictly worse than today.
- **`cited` becomes evidence by drift:** a future consumer reads `rec.cited` because it's "right there." **Guard:** name it `cited` (not `turnsWeak`), and pin a contract test that `w2NamedPresenceEvidence` never touches it — the guard is a sabotage case, not a comment.
- **`PRESENCE_STALE` is a timing guard**, the exact reach the owner has called out. Honest answer: it is, and it's the weakest limb. Prefer **node-scoped + frame-scoped** (evidence dies at node transition, like sealed frames) over a turn window.

---

## C. RESIDUAL RISK FLOOR — survives every design

1. **Coherent fabrication.** The GM narrates Vess walking in and emits every truthful-writer tag. Nothing in a tag-only engine distinguishes this from truth. Unclosable without an independent oracle, which does not exist.
2. **Silent presence.** A character genuinely present who is never tagged by any writer (gpt-5.6-sol's 10-SAY profile) is invisible to canon; their real death always needs arbitration. Cost: one extra fork-note turn, forever.
3. **Retroactive truth.** A reveal at t900 ("she was in the room all along") cannot repair t400's guestbook without rewriting history the identity layer deliberately leaves as-written (`_locHealLivePointers` precedent).
4. **Alias-time evidence.** Presence recorded under a name later merged is re-keyed by `guestbookRekeyName` (memory.js:~395) — but evidence recorded under a name later *split* is unallocatable without human judgment (`locSplit` is tool-only for exactly this reason).

**Bottom line:** ship the eyewitness/cited split **with** migration-to-`cited` **and** the arbitration note in one commit. Ship no arrives/departs vocabulary, no corroboration threshold, and no `[SAY:]`-creates-presence limb.

*(No repo files modified; scratch scripts in `…/scratchpad/redteam/`.)*

## Appendix 8 — angle: migration

## Executive summary

1. **The premise is mostly false, and I measured it.** Guestbooks are nearly empty on live saves — t1903 has 5 records across 85 nodes (all single-turn); t1837/t1728/t1411 have **zero**. #173 shipped too recently to have polluted anything.
2. **The real legacy pollution is `statusTurn`, and it is already load-bearing.** In t1903, **37 of 39 living NPCs pass `w2NamedPresenceEvidence` today; 33 on `roster write` alone; 36 of those 37 are not recorded at the current node.** Ameiko is killable by bare name at Magnimar right now.
3. **12 of those 49 `statusTurn` values are a fabrication** — the v1.381 backfill at state.js:433 stamped every moody NPC at the migration turn (t867 ×12). Presence must never repeat that pattern.
4. **Heuristic reclassification is impossible, not merely unwise**: `lastSeenTurn` is set on **0 of 69** memory NPCs, so the co-location limb is already silently inert; "multi-turn corroboration" would promote 0 of 5 guestbook records.
5. **Proposal: migrate one scalar.** Grade is *derived* from `turn < worldState.presenceEpoch`, never stored per record. Zero rewrites, idempotent, fold-safe, sync-safe; legacy fails **open** with a receipt, new play fails closed.

Measurements: `dev/load-engine.js` harness against `testRuns/Rise_of_the_Runelords__t1903.tnd`.

---

## The migration spec

### 1. The epoch scalar (the whole migration)

```js
/* state.js migrateWorldState, beside the v1.381 stamp at :433 — NOTE the contrast: that
   backfill FABRICATED a per-record turn (12/49 NPCs collide at t867 in the live save).
   Presence records nothing per-record; it records where the old world ended. */
if(typeof worldState.presenceEpoch!=="number"){
  worldState.presenceEpoch=(typeof worldState.turn==="number")?worldState.turn:0;
  worldState.presenceVer=1;_mig=true;
  if(typeof console!=="undefined")console.info("[presence] epoch set at t"+worldState.presenceEpoch+" — every earlier stamp is legacy-grade");
}
```

`presenceGrade(turn)` → `"legacy"` when `turn < presenceEpoch`, else the grade of the writer that made it. Because grade is a pure function of a number already in the record, **no record is rewritten, ever**. That single property is what makes every downstream question below cheap.

### 2. What legacy records become

| Store | Live t1903 count | Ruling |
|---|---|---|
| `guestbook[].turns` | 5 records / 1 node | **Grandfather as-is.** Too few to matter; all single-turn. |
| `memory.npcs[].lastSeenAt` | 48 set | Grandfather. Already inert for the death gate (`lastSeenTurn` null on all 48, identity.js:861). |
| `memory.npcs[].lastSeenTurn` | **0 set** | Nothing to migrate. Do **not** backfill. |
| `worldState.npcs[].statusTurn` | 49 set, 12 fabricated | Keep the field (it is mood-age: api.js:1011, :1126). **Demote it out of the presence limb for post-epoch stamps only.** |
| `memory.map.nodes[].npcs` | 203 entries, max 19 at Sandpoint | Leave. Display-only by ratified amendment ⑦ (memory.js:286-288); mention-polluted by construction and must stay unreadable by anything authoritative. |

No heuristic classification pass. It would run on the two fields where the evidence provably does not exist.

### 3. Death gate during the transition — fail **open** on legacy

A hard cutover takes the live campaign from 37 authorizable NPCs to ~4 (the four post-#173 guestbook entries). That is precisely the t1903 starvation shape — a narrated death refused forever, nine conflict records, an 18-turn toast loop. So:

```js
/* identity.js w2NamedPresenceEvidence, gate 3 — the statusTurn limb becomes epoch-aware */
if(n&&n.statusTurn>0&&Number(n.statusTurn)<lim){
  if(Number(n.statusTurn)<(worldState.presenceEpoch||0))
    return "roster write at t"+n.statusTurn+" (legacy-grade, pre-epoch)";
  return null; /* post-epoch: a mood write is not presence */
}
```

Legacy passes carry `evidenceGrade:"legacy"` onto the `canonTxns` receipt and surface as a **standing anomaly** in `healthIndicators` (§8d) — observation only, no toast, no prompt text. The grandfathered set is monotonically shrinking: any NPC re-witnessed post-epoch acquires real evidence and stops needing the clause.

**No auto-expiry.** An NPC never re-witnessed after the epoch is exactly where fail-open is safest and fail-closed reproduces t1903. *REQUIRES OWNER RULING if you want a fade window instead* — my recommendation is no fade.

### 4. New channel, and the fold contract

Assuming the sibling angles land a mention channel (`rec.mturns`, mention-grade turns, cap `GB_MENTION_CAP`), migration obligations:

- **`guestbookFoldRecords` (memory.js)** unions `mturns` exactly like `turns`, **grade-preserving**: a fold must never promote mention→witnessed. Turn-derived grading gives this for free — folding a pre-epoch turn into a post-epoch record cannot re-grade it, because the turn value travels.
- **`locMerge`** (identity.js:207) needs no change beyond the fold. **`locSplit`** (identity.js:331-345): allocation granularity stays the **character** — `take.guestbook` claims a name and takes the whole record, both arrays. Never per-array allocation; a human allocating "witnessed here, mentioned there" is exactly the ceremony this project's field data says fails.
- **`guestbookRekeyName`** rides the shared fold; no change.
- **`healMemory` (state.js:495-510)** gains `mturns` coercion/dedupe/cap in the same loop, and the empty-record drop becomes `!turns.length && !mturns.length && !agg && !resident`. Idempotent and loud, per the existing block's discipline.

### 5. Transport surfaces

| Surface | Behavior | Action |
|---|---|---|
| `.tnd` import | `memory.map` is copied **wholesale** (ui-files.js:477 `map:mm.map||…`) → new node channels ride free, unvalidated | None for map. `healMemory` is the entire contract — make sure it is. |
| `.tnd` import, archive | Archive is **field-by-field whitelisted**; it has silently dropped `attitudeSpec`, `eras`, `coreMemories` already | **Any new archive bucket must be added to that literal in the same commit.** Cheapest fix: an engine test asserting `Object.keys(memArchive())` ⊆ the import whitelist. |
| Blueprint export | Strips per-run state; a seeded roster has no presence at all | Nothing. Gate 1 (introduction, identity.js:855) already excludes GM-eyes-only dossiers from becoming corpses. |
| Sync (state blob) | `presenceEpoch`/`presenceVer` are plain worldState scalars; ride the CAS-guarded `POST /api/state` | None. |
| Old client writes to a migrated blob | Stamps mention-grade into `turns` at turns > epoch → **turn-derived grading mis-labels them witnessed** | On load: if `presenceVer` is missing but `turn > presenceEpoch`, **advance `presenceEpoch` to the current turn** and warn. Re-labels the old client's whole run as legacy (fail-open, the conservative direction). This re-labels; it cannot repair. Honest limit. |
| `map_cleanup` census | `locRepairCensus` classifies nothing, by design | Evidence rows gain `grade`; dry-run diff shows both arrays. **Do not touch classification logic** — a mention-grade co-location is weaker merge evidence, and that judgment stays human. |

### 6. Failure modes, stated plainly

- **The accepted regression window.** 33 NPCs in the live campaign remain bare-name-killable on fabricated/mention-grade `statusTurn` — including 12 whose stamp is a known v1.381 artifact. Fail-open is a choice to keep the t1903 class shut at the cost of leaving the t1728 class half-open for grandfathered records. State it in the TODO row; don't let a future audit rediscover it as a bug.
- **Turn-derived grading assumes a monotonic clock.** Importing an older `.tnd` over a newer campaign is safe (worldState is replaced wholesale, epoch travels with its own turns), but a hand-edited or rolled-back `worldState.turn` silently promotes legacy records. `presenceVer` + a load-time `turn < presenceEpoch` warn is the tripwire.
- **The guestbook's emptiness is itself a finding.** Zero records at t1837/t1728/t1411 means #173's writers are firing far less than assumed — worth an independent check before more weight is put on that channel.
- **Nothing here fixes `node.npcs`.** 203 mention-polluted associations stay; the only defense remains the comment at memory.js:286.

Scratch probe: `…\scratchpad\angle8\probe.js` (read-only; no repo file modified).

## Appendix 9 — angle: gm-compliance

## Executive summary

1. **`[SCENE_REF:]`'s 0/1837 is not generic non-compliance — it is a *meta-conditional trigger* plus a *stateful invented vocabulary*.** Its sibling `[SCENE_REVEAL:]` fired 5×/40 (13%) in the same live window, and `[SCENE_REF:]` does fire at 4–18% in 11 playtest corpora. The GM will use the family; it will not decide *when* on its own.
2. **Measured compliance ranking (739 corpus responses + the live t1903 tagLog):** `[SAY:]` 95% of live responses (38/40), 76–98% on modern models; `[NPC:]` 18% live; `[SCENE_REF:]` 0% live. **`[SAY:]` is already the most reliable name-bearing signal in the system and it is a presence signal.**
3. **But SAY alone under-records by ~half:** 113 of 241 `[NPC:]` name-instances across 6 modern corpora carry no `[SAY:]` (47%), and 14/14 sampled are *physically present and silent* (combatants, a carried wounded man) — not mentions. Silent presence is the real gap, not chatter.
4. **Design: presence is DERIVED from a typed evidence adapter (SAY/combat/arrival = presence; `[NPC:]` = registration only), plus ONE new tag `[SCENE_CAST:]` whose *timing the engine owns* and whose non-answer is measurable** — so it gets the `buildSayComplianceNudge` feedback loop that took SAY from 0→39/40.
5. **The migration window is open right now:** the t1903 save has **5 guestbook records across 1 of 85 nodes**. Cut mention-stamping this week and there is almost nothing to repair; in 200 turns there will be.

---

## (a) Why some tags comply — four hypotheses, ranked by evidence

| Hypothesis | Predicts | Evidence |
|---|---|---|
| **H1 — Narrated-content coupling.** The payload is a fact being written in the same sentence. | SAY/ENEMY_HP/COMBAT_START high; pure bookkeeping low | SAY 95%, ENEMY_HP 13%/40 live (fires when fights happen), `[LOCATION_STATE:]` 0/40 before its nudge (api.js:174-178) |
| **H2 — Trigger legibility.** A self-evident in-the-moment trigger vs. a meta-condition the model must evaluate. | SCENE_REF starves; SCENE_REVEAL survives | SCENE_REF's doc (tag_table.js:53) says *"on first observing any story-significant person"* — three judgments (significant? first? handle?). SCENE_REVEAL has one legible trigger ("a reveal happens") → 13% live |
| **H3 — Stateful invented vocabulary.** The tag needs a handle namespace maintained across turns with no narrative counterpart. | SCENE_REF worst in family | Confirmed by the t1903 forensic: the GM emitted `[SCENE_REVEAL:]` four times *with handles it never registered* |
| **H4 — Perceivable-consequence feedback.** Not the model perceiving output, but an engine note that **names what broke**. | Nudged tags recover | api.js:1023-1045 measured **SAY 0→39/40**; LOCATION_DESC 8%→filed. This is the strongest lever in the codebase |

**Verdict:** H2+H3 explain the 0/1837 better than "the GM ignores bookkeeping." A presence vocabulary that (i) needs no handles, (ii) never asks the GM *when*, and (iii) has a compliance nudge, should land in SAY's band, not SCENE_REF's.

---

## (b) The design

### Layer 1 — the presence evidence adapter (no new ceremony, ships alone)

One function, `presenceEvidence(name)`, becomes the only writer of attendance. `mapNpcLocation` (memory.js:282-300) stops being called from the `[NPC:]` handler.

| Class | Source tags | Field rate | Writes guestbook `turns[]` | Writes `lastSeenAt/Turn` | Feeds death gate 3 |
|---|---|---|---|---|---|
| `arrived` | LOCATION / SUBLOCATION / PARTY_SPLIT / rejoin / seed | truthful by construction | ✅ | ✅ | ✅ |
| `fought` | COMBAT_START / ENEMY_HP / ENEMY_SLAIN naming a roster NPC | reliable when fights occur | ✅ | ✅ | ✅ |
| `cast` | `[SCENE_CAST:]` (Layer 2) | new | ✅ | ✅ | ✅ |
| `spoke` | `[SAY:Name]` at the current node | **95%** | ❌ (letters/voices-through-doors) | ✅ | ✅ (new limb) |
| `mentioned` | `[NPC:]` | 18% | ❌ | ❌ | ❌ **(removed)** |

Removing the `roster write at t<statusTurn>` limb from `w2NamedPresenceEvidence` (identity.js ~870) is the actual fix for "one tagged mention makes a never-present NPC killable." The `spoke` limb replaces it with something far better-attested.

### Layer 2 — `[SCENE_CAST:]`, timing owned by the engine

**STATE TAGS (stable half — campaign-constant, one added line):**

```
[SCENE_CAST:Name, Name, Name] -- WHO IS PHYSICALLY HERE: the named characters
standing in the scene you are narrating, close enough to be spoken to, touched, or
struck this instant. The engine asks for this line at scene changes; when it asks,
name every present character and nobody else. Someone the party is talking ABOUT,
expecting, or remembering is NOT in the cast. If the party is alone, emit
[SCENE_CAST:none].
```

`[SCENE_CAST:none]` is load-bearing: it makes *non-answer* distinguishable from *empty scene*, which is what makes a compliance nudge possible at all. SCENE_REF had no such signal, so its 0/1837 was invisible to the engine.

**Engine note (volatile, one-shot, `NOTE_BUILDERS`):**

```
[ENGINE NOTE — SCENE CAST (not a player action): the scene has moved to <node>.
Emit one [SCENE_CAST:] line naming every character physically present with the party
there — the people who could be spoken to or struck this instant. Do not carry names
forward from the last scene out of habit: look at what you are about to write. Anyone
merely discussed, expected, or remembered is not in the cast. If the party is alone,
emit [SCENE_CAST:none]. Never acknowledge this check in prose.]
```

**Trigger (deterministic, engine-side; latch `worldState.castAsk` in the LATCH REGISTRY):** location/sublocation change · combat opened · split/rejoin settled · **`CAST_REFRESH_TURNS`≈12 elapsed at the current node**. From the corpora, LOCATION(3.5%)+SUBLOCATION(6.5%)+LEAVE(3.7%)+COMBAT_START(5.3%) ≈ 19% of responses; the 12-turn floor is not a backstop but **the primary trigger in the 57-turn-dungeon case where location tags starve.**

**Compliance nudge** (`buildCastComplianceNudge`, the proven pattern): fires when the engine asked last response and got no `[SCENE_CAST:]`, and states the consequence — *"the engine could not tell who was in the room, so it recorded only who spoke; anyone silent went unrecorded and the map now shows them absent."*

**Non-Claude `reinforce`:** add SCENE_CAST to `TAG_REINFORCE`'s mandatory list. Required by measurement: gpt-5.6-sol runs NPC 40% / **SAY 18%** — SAY-derivation alone starves it.

### Negative guidance — phrasings that train rubber-stamping

| Never write | Why | Write instead |
|---|---|---|
| "Confirm the cast is unchanged" | Confirm-shaped asks get agreement | "Name every character physically present" (open) |
| Print the engine's belief and ask "is this right?" | The model ratifies the list. `buildPresenceAudit` does this legitimately for ≤3 party members; it would rubber-stamp a 52-NPC roster | Never enumerate the roster in the ask |
| "…and anyone else who might be nearby" | Trains inflation, which is *worse* than under-recording (it re-creates the t1728 false eyewitness) | "and nobody else" |
| "Tag characters when it matters" / "story-significant" | The SCENE_REF failure verbatim | Unconditional scope, engine-chosen timing |
| Any length target on the cast list | The STYLE-cap lesson | No count language at all |

**What must NOT happen elsewhere:** the suggestion call already emits a `present` string (game.js:89, console-only at :174) — it must stay a *free-text guess for button filtering* and must never be parsed as canon; its output never reaches `applyMuts` (verified: only commitGmTurn:1604 does), and `SUGGESTION_MODE_BLOCK` should gain "Emit no state tags." Table Talk must never learn the vocabulary — it cannot reach `applyMuts` by construction (#76 isolation contract) and a TT answer about "who's here" must read state, never write it.

---

## (c) How it holds under each constraint

- **Fixed point 1 (mention ≠ presence):** satisfied by deletion, not by a heuristic — the `[NPC:]` handler simply stops calling `mapNpcLocation`.
- **Fixed point 2 ([NPC:] stays encouraged):** strengthened. `[NPC:]` becomes *purely* registration, which is exactly what `buildRecurringNameNudge` already demands for #190. Its doc line can now say "tag them whether or not they are present" without side effects.
- **GM non-compliance:** three independent sources. If `[SCENE_CAST:]` lands at 0%, presence still comes from arrivals + combat + SAY(95%) — strictly better than today, where mention-stamping makes the guestbook *actively false*. The turn-refresh trigger survives location-tag starvation.
- **Under-recording hazard / t1903 class:** the `spoke` limb (95%) is a materially larger evidence base than the `statusTurn` limb (18%) it replaces. **Additionally required: convert the death gate's terminal refusal into a one-shot challenge** — a refused named death arms a note asking for `[SCENE_CAST:]` or a re-assertion, and a re-assertion on the *next* response commits. This turns "refused forever, 4 conflict records, 18-turn toast loop" into a one-turn delay. **REQUIRES OWNER RULING** — it admits *GM re-assertion after an explicit engine challenge* as evidence, which relaxes W2's structured-evidence-only rule (though it stays deterministic, turn-stamped, and replayable).
- **ES5 / one-tag-one-entry / cache split:** one `TAG_TABLE` entry (parse+strip+doc derive); the STATE TAGS line is campaign-constant → stable half; every note is volatile; all latches join the `#151` registry.
- **Migration:** measured near-zero (5 records/1 node). `healMemory` needs no change; existing `lastSeenAt` values without `lastSeenTurn` (48/69) already fall through gate 3.

---

## (d) Failure modes, honestly

1. **SAY false positives:** a letter read aloud, a voice through a door, a remembered line, a dream. Mitigated by keeping `spoke` out of the guestbook, but it *does* reach `lastSeenAt` and the death gate. Residual and real. A `[SAY:Name|remote]` descriptor slot exists (`SAY_TAG_RE` reserves `|payload`) but would starve like every optional field — I do not recommend relying on it.
- 2. **Cast-line inertia.** The single largest risk: the model copies last turn's cast forward. The "do not carry names forward out of habit" clause is a mitigation, not a proof. **Measurable** — compare consecutive cast lines against arrival/departure evidence and alert on N identical casts spanning a location change.
3. **Compliance unknown.** I have no data on `[SCENE_CAST:]` because it does not exist. My prediction (SAY's band, not SCENE_REF's) rests on the H2/H3 mechanism, not on measurement. **This should be validated by a 50-turn playtest before the death gate is repointed at it.**
4. **Removing the `statusTurn` limb narrows death evidence on the day it ships**, before `[SCENE_CAST:]` has any adoption. Ship order matters: adapter + SCENE_CAST + challenge-not-refusal *together*, never the removal alone.
5. **Cost:** ~40 tokens of stable doc (cached) + an occasional volatile note. Negligible; no extra API call.

Scratch scripts: `…\scratchpad\angle9\{tagstats,overlap,mentions,gb,field}.js`. No repo file modified.

## Appendix 10 — angle: paradigms

## Executive summary

1. **The evidence the engine needs is already being emitted — as `[SAY:]`.** In the live t1837 save, 83–92% of recent GM turns carry a persisted speaker map (`transcript[].sp`, state.js:233), 754 GM entries total, and **every one of those 754 also carries `.e.l`, the location at that turn** — 111 deterministic (speaker, node) presence facts, no prose scan, no new ceremony.
2. **Prior art says the real bug is a missing type distinction**, not a missing tag: Inform separates `topic` tokens from `object` tokens so you can discuss what isn't in scope. `[NPC:]` is our topic token being read as an object token.
3. **Removing the mention-stamp alone will re-open t1903.** Measured: 0 of 66 `memory.npcs` carry `lastSeenTurn`, so gate 3's co-location limb (identity.js ~825) is dead for every legacy record; 46 of 49 roster rows have `statusTurn>0`. The mention path *is* the death gate's working limb today. Removal and replacement must ship in one commit.
4. **Proposed primary: the CAST FRAME** — presence is a scene-scoped roster the engine *derives* from writers it can trust (speech, combat, arrivals), sealed at the transition W2 already seals.
5. **Proposed secondary (composable): provenance-tiered presence belief** — mention = hearsay tier, stored and useful, never promoted to attendance without corroboration.

## Prior art, and what each transfers

| System | Its mechanism | Transfer to this engine |
|---|---|---|
| Inform 7 / TADS | `scope` derived from the containment tree; `topic` is a *different token type* from `object` | Give the mention its own type. `[NPC:]` = topic + registration; presence is derived elsewhere |
| MUD/MMO rooms | Authoritative occupancy set; only enter/leave events mutate it | Only truthful transition writers may commit attendance |
| Stage play / screenplay | Scene opens with a cast, "Enter/Exeunt"; a name in dialogue is not on stage | A per-scene CAST set, sealed at scene boundary — and it matches the GM's own craft frame |
| TMS / provenance KBs | Assertions carry justifications; graded, retractable | Presence as tiered belief; `sceneRefBind` already writes `authority`/`epistemic` (identity.js ~756) — the schema anticipated this |
| Authoritative vs gossip / SWIM | Gossip is stored but never authoritative until corroborated | Mentions file to a `mentions[]` index; upgrade only on corroboration |

## Architecture A — THE CAST FRAME (recommended primary)

**Mechanism.** W2 already opens and seals a scene frame at node transition. Add one field: `frame.cast = {canonName: {since, src}}`. Populated only by writers measured reliable:

| Writer | Evidence quality | Measured |
|---|---|---|
| `[SAY:Name]` → `resolveNpcName` | witnessed (speech is presence) | 36/40 of the last live responses; 83–92% of recent turns |
| `[COMBAT_START:]` / `[ENEMY_HP:]` | witnessed | field-reliable per brief |
| `[LOCATION:]`/`[SUBLOCATION:]`/`[PARTY_SPLIT:]`/rejoin/seed | witnessed (already the guestbook's truthful writers) | existing |
| `[SCENE_REF:]` bound actor | witnessed | 42 emissions / 447 harness turns (≈9%) — **note: not zero in fresh campaigns**, only in the mature live one |
| `[NPC:]` alone | **nothing** — registration only | 4/40 live responses |

`mapNpcLocation` (memory.js:282) splits: the `[NPC:]` caller keeps the memory/roster write and drops `guestbookStamp` + `lastSeenAt`; a new `castCommit(name,src)` owns both and is called from the cast writers. Guestbook stamps at cast-commit time (same post-handler seam discipline). `w2NamedPresenceEvidence` gate 3 gains a cast limb and keeps the rest.

**Fits.** Zero new GM ceremony — it harvests tags the GM emits because they change something it can perceive (the owner *hears* `[SAY:]` through TTS; that is why #96 holds at 90% while `[SCENE_REF:]` sits at 0). ES5, one derived structure, no new tag_table entry. Stable-half untouched (cast is state → volatile only).

**Costs / breaks.** A *silent, non-combatant* present NPC never enters the cast. That is the under-recording edge, and it is real: 46 distinct all-time speakers vs 49 roster rows; 31 of 66 `memory.npcs` have ≥1 SAY. Mitigations, in preference order: (i) `[SAY:]` for the player's own lines is already mandated, so any two-way scene commits both parties; (ii) an existing engine-note channel — `buildPresenceAudit` (api.js:446) already does exactly this shape for party members; a cast-gap variant would ask "these named characters are in the scene but have no cast entry" *only when a death/quest consequence is pending*, i.e. ceremony at the moment of ambiguity, never standing.

## Architecture B — PRESENCE AS TIERED BELIEF (composable with A)

**Mechanism.** Per (npc, node): `{tier, turn, src}`, tiers `3 witnessed` (cast writers above) / `2 inferred` (the affordance gate's narration name-scan, game.js:263 — read-side today) / `1 hearsay` (`[NPC:]` mention). Rules: a write never lowers an existing tier for the same turn (kills the current last-write-wins clobber where a mention overwrites an arrival's `lastSeenAt`); guestbook commits at tier 3 only; hearsay files to `npc.mentions[]` — *useful data we currently destroy*: it is the topic index, it answers "who is being talked about," and it directly serves #190's registration goal without touching attendance. Death gate admits tier ≥ 3 strictly-earlier; tier 2 admissible only when a second independent tier-2 corroborates.

**Fits.** Solves the fixed points without deleting information; graded evidence makes the under-recording hazard tunable by a constant rather than a redesign. **Costs:** more state per NPC; two knobs (tier floor, corroboration count) that only a live campaign can calibrate.

## Architecture C — NEGATIVE-SPACE / interval presence

Presence is one pointer per NPC, `{node, since, until}`; only arrival and departure move it, continuity assumed between. Guestbook becomes an interval projection instead of turn arrays. Closest to MUD/Inform. **Fights this engine:** it needs a reliable *first arrival* per NPC — the exact ceremony the GM under-performs — and it rewrites the #173 guestbook schema on 1,900-turn saves. I'd take its one good idea (departure-by-default: the party leaving a node ends everyone's presence, no tag required) into A, and leave the rest.

## Player-as-oracle — a corroboration rule, not an architecture

The strongest evidence available is a *committed* player action naming an NPC that the affordance gate did **not** reject and the GM answered with that NPC's `[SAY:]` — a human who can read the prose chose to address them. Cheap, precise, and it only covers interacted-with characters. Ship it as a tier-3 source inside A/B, not as the system.

## Migration (measured, and unusually clean)

The 754 `.sp`-carrying entries all carry `.e.l` → a **deterministic backfill** reconstructs 111 (speaker, node) attendance facts from the existing transcript for post-#96 turns, with turn stamps, no prose scanning, replayable. Pre-#96 turns (first 300 GM entries: 0% `.sp`) stay honestly unknown — the guestbook's "no *recorded* visit ≠ never here" projection rule already covers that. Ship as `dev/backfill-cast.js`, dry-run first, mirroring `dev/loc-repair-core.js` discipline.

## Honest failure modes

- **The one-commit constraint is non-negotiable.** Split the change and the death gate loses its only live limb (statusTurn is mention-fed) → t1903 quarantine loop returns.
- `[SAY:]` names are free text; `resolveNpcName` mostly absorbs it (live save shows "Morwen"/"Morwen Zethran", "Shalelu"/"Shalelu Andosana"), but an unresolvable speaker becomes a phantom cast member. Refuse-and-warn, never create.
- **Remote/flashback speech mis-stamps.** A GM tagging a remembered or scried line with `[SAY:]` commits false attendance — the same accepted "recorded-evidence boundary" the current design already takes, but at a new source.
- Silent NPCs under-record (quantified above).
- `[SCENE_REF:]` is *not* dead in new campaigns (9% of harness turns). Any design assuming zero emissions under-uses a working signal.

## REQUIRES OWNER RULING

1. **May the affordance gate's narration name-scan (game.js:263) be persisted as tier-2 evidence?** It exists and runs today, but persisting it crosses "the engine never scans prose." Recommendation: **no** — restrict tier 2 to structured-but-indirect sources, keep the scan read-only.
2. **May `[SAY:]` alone commit a guestbook visit turn** (i.e. speech = attendance)? Recommendation: yes; it is the single highest-compliance signal in the corpus.
3. **Retain hearsay mentions as `npc.mentions[]`** (new persisted field, sync/`.tnd` payload growth) or discard them?