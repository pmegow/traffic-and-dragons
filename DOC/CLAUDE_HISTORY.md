# CLAUDE.md — history & incident records

Extracted 2026-07-29 (engine v1.491) when CLAUDE.md was distilled to current contracts only.
This file preserves the version-by-version evolution, incident stories, and measured evidence
that used to ride inline in CLAUDE.md. **Nothing here is needed to work on the code** — it is
the why-it-got-this-way record. Sections mirror CLAUDE.md. The full pre-split CLAUDE.md is in
git history (the commit that added this file).

New entries: when a CLAUDE.md contract earns a war story (an incident, a validation arc, a
measured before/after), the story lands HERE and the contract line in CLAUDE.md links to it.

---

## Files on disk

### error-report.js — the #16 arc

Shipped in three waves: #16 core reporting (v1.352), #16b user-initiated reports + screenshot
modal (v1.353), #16c crash diagnostics (v1.407 — `ER_SESSION_ID`, the persisted breadcrumb
ring, `erDiagBlock`). The breadcrumb ring exists because a jetsam PROCESS KILL runs no handler —
only pre-written state survives, so the ring is written continuously and recovered at next boot.

**Screenshot fix (v1.365):** before `_bugShotFilter` + `imagePlaceholder`, ONE bad `<img>`
(src-less or unfetchable) rejected the whole `toSvg` promise — so **no field report ever
carried a screenshot** until then. The vendored lib's `toJpeg` was abandoned earlier for
hanging in embedded Chromium (own canvas encode instead).

### capability_bible.js — merge arc

Merged from separate `spell_bible` + `ability_bible` files at v1.222 (TODO #10) once it was
clear spells and abilities have no intrinsic difference (`kind` is cosmetic; `cost`+`isMagical`
are the real axes). `category` tradition lists added v1.223; the fixed 6-attribute set
(everything carries `cost/range/targets/duration/save/dice`, `"N/A"` where inapplicable) added
v1.224 after injected canon was queried empty (Death Sight had no duration at all). The
emergent `[SPELL_DEF:]` overlay (write-once) shipped v1.219.

### tag_table.js — the UA1 validation arc

The table shipped v1.241 running in SHADOW (legacy parser stayed authoritative; the table ran
alongside and diffs were recorded to `tnd_tagdiff_v1`). Cutover to table-authoritative v1.258,
then a reverse soak: **159 scripted parity runs + ~160 real gameplay turns, zero diffs ever,
`tnd_tagdiff_v1` never written once.** On that evidence the legacy parser + all shadow/parity
machinery were DELETED at v1.261 (UA1 closed 2026-07-11). Rollback of the deletion is
`git revert`, not a flag. At v1.241 `TAG_NO_HANDLER` listed ENEMY_SURRENDERS ("ships with
UA26") — it graduated to a real handler when UA26 landed (v1.264); the CLAUDE.md line saying
so went stale until the 2026-07-29 distillation corrected it against the code
(`["DICE","ACTIONS","RETCON","SAY"]`).

### campaign_generator.js (#59, v1.290)

Skeleton prompt fragments were verbatim-extracted so the assembled game prompt stayed
byte-identical to pre-extraction. The one-pass review + auto-correction for on-the-fly
skeletons was the content improvement; `worldState.skeleton` shape and `buildSkeletonBlock`
were deliberately untouched.

### ui-*.js split (#54, v1.325)

ui.js (3,350 lines) was decomposed into the ten `ui-*.js` files as **pure moves — byte-identical
function bodies**, per the seam plan in DOC/UI_SEAM_MAP.md.

### tts.js — provider evolution

Original stack was native + Piper + a `cartesia` cloud provider with a user-facing engine
picker. The **#9 rework (v1.398)** removed cartesia and the picker on a cost/ownership call —
selection became RESOLVED, never stored. **#90 M1 (v1.435)** then added the SERVER tier on top
(`TTS_LADDER = server → piper → native`), closing the B9 architectural question — narration for
connected players synthesizes on the self-hosted `tnd-tts` Fly app, zero client wasm work.
Self-hosting is why the #84/LiveKit cost/ownership objection doesn't apply (our own box); the
ownership decision stands re-affirmed in DOC/Research/liveKit_findings.html. The v1.434 work-budget
governor predates the server tier and meters only the local Piper tier. Shared text-prep
(`normalizeForTTS`/`splitSentences`) was harvested from the piper_test.html spike at v1.298.

### stt.js — the stale-doc lesson (#84)

The cloud Whisper fallback shipped v1.342 (todo_carplay rank 7). For a while afterwards the
CLAUDE.md line still said STT was "Chrome/Edge only" — that stale line **misled an entire
LiveKit evaluation** (#84) into believing iPhone Safari had no voice path. It did (the
fallback). Roster-phonetic correction `sttCorrectNames` (the "Frizwick → Physics" class)
shipped v1.330. The player-pays-transcription property was decisive in declining LiveKit.

### class_bible.js / bible_editor.html — the #72 build-out

class_bible.js was generated from the live engine tables at v1.464. Seeding CLASS_FEATURES
into the level grid with their REAL names structurally killed the old `nm:"Lv9"` placeholder
bug. The editor's v1 was download-only — exports silently piled up in ~/Downloads and never
reached the tracked file, which motivated v2's File System Access save-in-place (v1.467). The
capability-bible round-trip contract is pinned BOTH ways (unedited round-trip AND all-dirty
emit) because sabotage showed the first pin alone left `emit()` completely untested. The
editor's Reconnect-inside-a-click-gesture pattern is the #30 permission lesson (FSA re-grant
requires a user gesture). v1 class-only drafts are migrated, never discarded.

### bug_tracker.html — the SW-staleness lesson (v1.360)

The tracker page shipped and was immediately pinned stale by the service worker because it
wasn't in the network-first allowlist — hence the standing rule that every new satellite is
added to sw.js's network-first regex (or the app shell) in the same commit.

---

## Key systems

### §2 AUTHORS — the sentence-cap removal

The STYLE block once carried a hard `2-3 sentences maximum` cap. It was identified as the
run-on ROOT CAUSE: capping sentence count made the model cram everything into one dense
sentence (clause pile-ups, em-dashes, similes). The cap was removed entirely; STYLE now
forbids cramming and hands length/rhythm to the selected prose voice. Per-campaign
`worldState.proseAuthor` shipped v1.87. Don't re-add a count cap.

### §2 ARCHETYPES — the stale "24"

CLAUDE.md said "24 total" long after there were 27 (9 classes × 3); corrected 2026-07-27
during the #72 inventory. Filed here as a specimen of doc rot.

### §3 Transcript compression — the t308 evidence (v1.227)

On the t308 mature save the append-only transcript was **54% of the blob** and caused
localStorage quota death on mobile. LZ-compressing only the transcript at the storage boundary
halved the on-disk core (626K→283K chars; the transcript itself ~5× smaller in
localStorage-char terms). Known issue #3 at the time.

### §5 Providers — the gpt-4o bring-up finding (v1.32)

gpt-4o parsed responses and produced valid `summarize()` JSON fine, but treated the state tags
as OPTIONAL — it narrated "you pay 5 gold" without emitting `[GOLD:-5]`, silently desyncing
the sheet. That finding created the per-provider `reinforce` mechanism (openai's is a forceful
MANDATORY-TAG-DISCIPLINE block with the gold-for-a-room example) and loosened the
`[GOLD:]`/`[HP:]` parsers to tolerate suffixes like `[GOLD:-5 gp]` — which the prompt's own
format hint invites. Provider-agnostic `PROVIDERS` table dates to v1.30; prompt caching's
two-block system array to v1.151.

### §6 5b Party sheets — the t755 finding (#61, v1.303)

Companion `charSheet.relationships` were WRITTEN by `[COMPANION_RELATIONSHIP:]` but never
injected back to the GM, which hallucinated party bonds from the roster's decayed one-liners.
More broadly, before partyBlock (v1.75) the GM only saw one-line roster entries and never knew
a companion could cast — a sorcerer companion defaulted to swinging a weapon. The #61 backstops
(downgrade nudge, 40-turn relationship audit) came from the same investigation.

### §7 [LOCATION:] combat-clear (v1.216 audit F2, generalized v1.264)

A world-location change clears `worldState.combat` because the party traveled away — any
unclosed fight is over. Under multi-foe add-a-foe semantics, skipping the clear would leak the
old location's foes into a new fight, so it runs unconditionally on a real move (silently when
the same response opens a fresh `[COMBAT_START:]`).

### §7 [ENEMY_SLAIN:] — the t1188 trafficker ambush (v1.463)

The GM's only kill vocabulary was a damage NUMBER, so narrated executions (stealth kill, coup
de grace) emitted honest dice damage that left 18-HP foes standing — prose said one foe
living, tracker said four. `[ENEMY_SLAIN:Name]` is the outcome-assertion fix: the GM narrates
the kill, the engine does the arithmetic.

### §7 [NPC_SUPERSEDE:] — the t378 woman-in-bronze class (#57, v1.306)

A reveal ("the woman in bronze IS the queen") could coexist indefinitely with its stale hedge
in `.knowledge[]`, and the GM kept hedging. The tag retires the outdated line(s) to
`memory.archive.superseded` so a reveal cannot coexist with its hedge.

### §7 NPC death — B3 (v1.361)

Death became first-class after dead NPCs kept re-appearing via later status writes; the
refusal-of-non-death-writes + affirmative `DECEASED:` roster line + `propagateSlainFoes` +
extractor `npcDeaths[]` backstop all landed together.

### §8 SUMMARIZE_AT 1200 → 2400 (#28)

1200 was tuned in the sentence-cap era; under prose-voice response lengths it fired every ~2
exchanges. Raised to 2400 with the tail-retention work.

### §8 futureEvents hygiene — the t198 Shalelu pile-up (#29, v1.166)

The GM rarely emits `[FUTURE_EVENT_RESOLVED:]` unprompted, so pending events accumulated
finished business — at t198, SEVEN "find Shalelu" variants sat pending while Shalelu sat at
the party's campfire. Produced the three teeth: near-duplicate dedupe, deterministic
40-turn expiry, extractor echo-resolution.

### §8 Tail retention — the t160 pin-grab (#28, v1.165)

`summarize()` used to clear `sessionLog` to zero; in mature campaigns the GM's verbatim window
dropped to ~2 turns and it CONFABULATED recalls (the t160 pin-grab incident — a false memory
of how an item was obtained). `retainSessionTail()` + the `sessKept` marker fixed it; degraded
3-strikes summarize fallback dates to v1.144/v1.165.

### §8b RAG — validation arc and pollution incidents

Shipped v1.154 (TODO #27 Phase 1) behind a flag; default ON v1.230; **standard behavior**
v1.349 (user call 2026-07-17, closing TODO #55 on field evidence) — toggle UI removed
(`showRagModal` + the 🗂 Episodic memory menu item), console escape hatch retained. Validated on the t308 mature save: RAG is what carries a long campaign
through NPC-key fragmentation + the cap-30 window (AUDIT_t308.md).

Pollution incidents that produced the guards (v1.167): meta "GM:" exchanges were outranking
the origin scenes they quoted (t164 broadsheet displacement) and preserving false corrections
(t160 pin-grab); the merge-orphan bridge exists because entries stamped `"Hemlock"` went
invisible after the t198 merges collapsed the key into `"Sheriff Belor Hemlock"`. Untagged
prose corrections predating `[RETCON:]` (e.g. the t35 debt correction) remain indexed — known
residual. Measured on the Runelords t54 save: the TOC diet more than paid for the excerpts
(volatile net −480 chars with a 1,360-char excerpt block included); flag-off volatile was
byte-identical to the pre-feature prompt.

### §8c Core Memory — the re-homing (#40 v1.243 → #63 v1.304)

The #40 v1 stored core memories party-shared on `worldState.coreMemories[]` — which violated
the PC↔companion interchangeability contract: **export Morwen and her defining moments stayed
behind with the quest log.** #63 re-homed them onto the character schema (witnessed-by-all,
user ruling 2026-07-16); `migrateWorldState` copies the legacy list to the player + party
sheets and deletes the worldState field — same single-source lesson as portraits. The
`[CORE_MEMORY:]` GM tag shipped v1.307 for the engine-undetectable class (revelations — the
#57/UA40 finding).

### §10b Quest lifecycle teeth — the t198 silence (#20, v1.172)

The t198 corpus check showed the lifecycle going silent in mature campaigns: **zero**
`[QUEST:]` emissions, quests sitting at 4/4 objectives never closed. Produced the
deterministic all-objectives-complete instruction + the standing "active crises ARE quests"
reminder.

### §13 Suggestions — the starvation arc (#14 → v1.288)

#14 (v1.110) decoupled suggestions from GM prose (side benefit: removing `[ACTIONS:]` from
STYLE noticeably improved prose-voice fidelity). But the split STARVED the follow-up call — a
200-token mini-prompt + scene tail — and no bolt-on fence fully compensated: the t580 "Message
someone who knows Thassilonian lore" button shipped WITH the 120-ft-range telepathy canon
annotated in its own prompt. v1.288 un-starved it: full `buildSysPrompt()`, stable half
byte-identical (rides the turn's warm cache), `SUGGESTION_MODE_BLOCK` on the volatile half
only, last-5-exchange history. The old `upgradeModelFor()` escalation was dropped from this
call (caches are model-scoped); it survives for the skeleton. Tap-to-fill/long-press-to-send
is #14a (v1.56/v1.83).

### §15/§16 File & campaign plumbing

Auto-export narrative removed v1.228 (a pre-transcript durability hack). Debounced server sync
v1.146; submenu flyouts v1.160/161; menu reorganization v1.158; generated File menus v1.159.

### §19 Portraits — the sync sagas

- **Companion portrait single-source (v1.169):** portraits used to live in TWO places;
  display read only `npc.portrait` (traveling via the PV-gated separate store) while the
  blob-borne `charSheet.portrait` was ignored — the **Daeris cross-device desync** (old Known
  issue #6). Fixed by single-homing + `npcPortrait()`.
- **Transport (v1.170):** without `fillPortraitsFromBlob()` running on every reconcile,
  devices already at the current turn had NO portrait transport at all — the **Frizwick/Morwen
  mobile gap**.
- **Companion offset (v1.43):** the portrait modal's default getOffset/setOffset fell back to
  `worldState.character`, so editing a COMPANION's framing silently rewrote the PLAYER's —
  hence the rule that `showNpcSheet` must pass explicit accessors.
- **Swap portrait desync (v1.41 → v1.45 root fix):** v1.41 added `markPortraitDirty()` on
  character swap so the separate `/portrait` endpoint re-uploaded — necessary but NOT
  sufficient (fire-and-forget, not atomic with the state blob; a second device could load the
  old PC's face on the new PC). v1.45 root-fixed it: `syncToServer` stopped nulling
  `character.portrait`, so the PC's portrait rides inline in the main state blob, atomic with
  the state turn. Only sheet-less NPC `n.portrait` is still stripped to the separate store —
  companion `charSheet.portrait` always rode inline; that asymmetry was the bug.
- Pan+zoom offset schema v1.39; 3:4 portrait-aspect generation via `portraitRenderBody()`.

### §24 Mid-game character swap — POV handoff (v1.38)

The GM kept narrating the old PC as "you" after a swap; a single handoff line couldn't
overpower many turns of old-POV conversation momentum. The fix that held was the transient
`recentSwitch` system-prompt re-injection (the same lesson as
memory/prompt-channel-beats-position: a new CHANNEL, not a new spot).

### Known issue (RESOLVED 2026-07-12) — relationships not populating on NPC sheets

Root cause: the sheet's Relationships section reads `charSheet.relationships[]`, which only
`[COMPANION_RELATIONSHIP:]` writes — and the GM filed player-centric `[RELATIONSHIP:]` almost
exclusively (the UA41 finding: half the graph never got written). Fixed twice over:
① display-time merge in `showNpcSheet` guarantees at least the player↔NPC bond renders from
`wsNpc.rel`; ② UA41's reciprocity nudge (v1.270) + organic Sonnet mirroring (live-validated in
the v1.271 playtest) now writes the data for weighty bonds. Companion↔companion bonds still
only appear when the GM files them — by design, nudged when weighty. Sequel: #61 (the written
bonds were never READ back — see the t755 entry above).

---

## Dev workflow

### sw.js caching — the full arc

cache-first → **network-first** (v1.28, to fix "wrong version deployed" staleness) → **back to
cache-first** (v1.79), because network-first re-downloaded the whole app shell on every load
and blew past Netlify's 100 GB/mo bandwidth cap, **pausing the site**. Hosting migrated
Netlify → Cloudflare Pages at the same version (unlimited bandwidth). Cache-first is safe now
only because the `CACHE` constant is bumped on every deploy (hard rule) and browsers refetch
the SW script per navigation — that pairing is why the bump-every-commit rule has no
exceptions.

### The 2026-07-29 bible-editor spiral (origin of the guardrail rules)

Three hours, four wrong fixes, and the user as the only test runner — because the editor's
save path was unreachable by any harness (the file picker is an OS dialog). The actual bug was
a **zero-byte file**: Chrome kept reporting "the state had changed since it was read from
disk" and was telling the literal truth, while the investigation checked the *timestamp* four
times across three theories and never the *size*. The same day, sabotage-testing the shipped
contract clauses found THREE that were fake coverage because the sabotage mutation silently
didn't apply (`indexOf("function _idbDel")` still matched after renaming to `_idbDelUNUSED`;
`/requestPermission/` still matched an existence-check after the CALL was deleted). Products:
the `window.__bibleTest` + OPFS-handle seam (found a real bug on its FIRST run),
`dev/sabotage.js` (a no-byte-change mutation is a FAILURE; restores byte-identically on any
exit), `dev/file-forensics.js` (verify an error's asserted fact exhaustively before
reinterpreting it), and `dev/install-bible.js` (refuses an empty file — the exact failure that
zeroed a tracked file).

### The v0.27→v0.28 textarea saga (origin of the diagnosis discipline)

Three passes to find one CSS root cause. The box the spec measured was not the box the scroll
painted — computed values said "fixed" while the render stayed broken. Produced the standing
rules: verify the FAILURE condition; the screenshot is ground truth and measurements are a
proxy; "measures fixed but reported still broken" means reproduce before explaining;
cache/environment is never the first explanation for an unreproduced divergence.

### Version-number rot

CLAUDE.md once hardcoded "Current: v1.114" while the app was at v1.143 — which is why the
current-version pointer is "see `APP_VERSION` in globals.js" and nothing else.

### DOC/ folder enforcement (2026-07-27)

Thirteen reference docs had accumulated at repo root (Fable_UberAudit, SERVER_ARCHITECTURE,
UI_SEAM_MAP, RAG_MEMORY, MULTI_ENEMY_COMBAT, RESOLVE_NPC_INVARIANTS, STORY_COMPILER,
BLUEPRINT_EDITOR, CAR_MODE, AUDIT_PLAYBOOK, PRE_REVIEW_UA30_UA31, HANDOFF_batch_v1260,
FABLE_REVIEW_ACTION) and were moved into `DOC/` in one enforcement pass. The folder rule
itself was amended 2026-07-16 (audit #29) from eeef396's "HTML only" to "HTML and MD" — the
least-churn reading of what the folder already held.

---

## Version stamps of record

Feature→version stamps that were dropped from CLAUDE.md prose in the distillation (everything
else above carries its own): identity+ancestry step merge **v1.141** · "Part ways" manual
departure **v1.96** · `racial_caps` single-sourcing **v1.226** · usage/cost telemetry
**v1.150** · combat-attribute positional adjacency (P3-F1) **v1.272** · File-menu flyout
presentation **v1.160/v1.161** · img2img strength slider (#42) **v1.233** ·
`BP_DESIGNER_VERSION` started at **v0.4**.
