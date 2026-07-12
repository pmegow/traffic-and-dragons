# AUDIT — Playtest 3 (v1.271, 2026-07-11): the post-batch playtest (HANDOFF_batch_v1260 close-out §4)

**Run:** 29 GM turns, Sonnet (anthropic default), harness-driven, every turn steered at the eight
close-out scenarios. **Character:** Vex Calder — fresh level-3 Human (Northlander) Draconic
Sorcerer, hand-built with Message + a Flask of Alchemist's Fire, gritty tone, Abercrombie voice,
emergent campaign "PT_v1271_PostBatch" in Marrowgate. **Cost:** $1.18 (68 calls, 272k in /
18.7k out; prompt cache healthy — 191k cache reads). **Corpus:**
[dev/corpus_playtest_v1271.json](dev/corpus_playtest_v1271.json) (29 turn log + 29 raw responses +
18 toasts + 4 instrumentation notes; durable copy in the preview browser's `tnd_pt_corpus_v1`,
persisted after every turn per test-runs-always-audit). Synthetic interventions (3, all labeled in
the corpus notes): the UA41 Morwen-class setup, the staged multi-foe panel states, and the
ENEMY_SURRENDERS live-page check. **Screenshots:**
[dev/img_playtest_v1271/](dev/img_playtest_v1271/) — combat panel at 3 and 5 foes, 1280px
and 375px. *Capture method note: the Browser-pane screenshot pipeline was dead this session (every
capture timed out; page itself healthy), so the PNGs are in-page rasterizations of `#cpanel` via
SVG foreignObject using the app's own stylesheet at the target viewport widths — same CSS, same
layout engine, verified visually.*

## Verdict

**The batch holds. 7 of 8 commissioned scenarios validated live with raw-tag evidence; the
condition-`cause` write path (#46 Phase B) got no organic trigger in 29 turns and remains
engine-tested only.** The headline catch is new: **UA26's stat-binding is broken for the
multi-foe-single-response case** (P3-F1) — the exact shape the docs teach and the GM actually
emitted at t10. Second real catch: the F3 quest-reopen guard blocks the quest tag but **lets the
re-completion's reward tags through — the same completion paid twice** (P3-F2).

## The checks the run was commissioned for

| Check | Result |
|---|---|
| **t355 Message bait** | ✅ **PASS — the exact original vector, refused.** t2: Message cast at Sorn "across town" → "Message doesn't work like that. The Counting House is the length of a town away, well past a hundred and twenty feet… Sorn is a name, not a face." No `[SPELL_USED:]`, `used` stayed false; GM even emitted `[RETCON:]` marking the failed cast. UA39-② (SPELL RANGES ARE PHYSICS, stable half) obeyed live. No suggestion button ever offered an out-of-range cast (v1.245 fence held). |
| **Companion leveled cast + rest** | ✅ PASS. Celeste (emergent Cleric, async-sheeted at t4 with leveled spells) cast Cure Wounds at t15 → `[COMPANION_SPELL_USED:]` → `used:true` on her sheet; her Sacred Flame cantrip (t11) correctly never expended (UA25). t20 inn night → `[REST:long]` → "Spell slots restored." — her Cure Wounds AND the player's Scorching Ray both reset. |
| **3-foe fight, surrender, named damage** | ◐ PARTIAL. t10 ambush: 6 narrative enemies, but the GM **pooled them into 2 foe entries** (Lantern Holder + "Club Thugs" 40hp pool — the doc's own pooled-group teaching). Named damage clean: `[ENEMY_HP:Lantern Holder\|-5]`, engaged-tracking, bare-form routing all correct. Surrender: the GM closed via Intimidation → `[COMBAT_END:fled]` — **`[ENEMY_SURRENDERS]` never emitted organically** (see P3-O1). Engine semantics of the tag verified live synthetically: named form marks one foe surrendered (fight stays open), bare form surrenders all living → all-down auto-close ends combat as "surrender". 3- and 5-foe panel states staged for the screenshots; panel renders cleanly at both widths (engaged ◆, morale badges, slain-foe "+1 more" collapse). |
| **Condition inflicted with cause** | ✗ **NOT EXERCISED.** No condition was inflicted on anyone in 29 turns — and when baited ("I think something's cracked"), the GM *refused the player-authored injury* ("Ribs are bruised… Not cracked"), which is good GM discipline but leaves `[CONDITION:name\|dur\|cause]` engine-tested only. Carry to the next playtest; the v1.258 run validated the full Phase-A lifecycle, so only the new `cause` arg lacks live evidence. |
| **Epithet grant (#47)** | ✅ PASS. t18: `[NPC_ALIAS:Vex Calder\|The Northlander]` → landed on `character.aliases`, "✦ Epithet earned" toast. Note the shape: at t17 the GM *narrated* the epithet ("They are calling you the Northlander") without tagging it; the tag came only when the player explicitly adopted the name (P3-F6). |
| **Consumable detonation (#50a)** | ✅ PASS (consumption side). t11: thrown Flask of Alchemist's Fire → `[ITEM_LOST:Flask of Alchemist's Fire]` in the same response, flask gone from inventory, per-target DEX saves rolled. The **acquisition side leaked** the same session — see P3-F4. |
| **Quest completion + re-bait block** | ✅ PASS, with a reward-side hole. "The Burning Man": `offered` → ⚑ opportunity toast (first time ever seen live) → journal accept → completed at t15 with the **new completion toast carrying same-response rewards** ("✓ Quest completed: The Burning Man — +120 XP, +10 gp"). Re-bait at t16 worked *organically*: the GM emitted `[RETCON:]` declaring its own completion premature and re-emitted `[QUEST:The Burning Man\|completed]` → **engine guard blocked it loudly** ("[quest] blocked re-creation of archived quest… a follow-up needs a NEW title"), log stayed clean. BUT the re-completion's `[XP:120][GOLD:+10]` were applied again → P3-F2. |
| **Quiet weighty bond → reciprocity nudge (UA41)** | ✅ PASS (controlled). Organically the nudge **cannot fire on Sonnet**: both the loud bond (t4 "Partner") and the deliberately quiet one (t19 "Sworn ally", muttered, no answer waited for) were mirrored with `[COMPANION_RELATIONSHIP:]` unprompted in the same response — confirming the Playtest-2 sizing ("explicit bond scenes reciprocate unprompted"). To exercise the true Morwen class, the companion mirror was synthetically cleared (labeled in corpus), player-side "Blood-sworn shield" left one-directional, **no pre-call of the builder** (consume-at-build). t20 real turn: latch consumed (`reciprocityNudged` stamped t19), and the GM **obeyed the engine note** — `[COMPANION_RELATIONSHIP:Celeste Emberveil\|Vex Calder\|Sworn ward]`, an in-fiction inversion of the player's descriptor. Detection, once-per-pair latch, and model obedience all validated. |

## Live-validated in passing (free riders)

- **Quest write paths, full spread:** `offered` (t5, with desc), journal `acceptQuest` (title-keyed),
  in-story activation (`[QUEST:The Blighted Shore|active]` t22), `[QUEST_STEP:…|true]`, archive on
  completion. The opening emitted a `[QUEST:…|active]` auto-accepted (P2-F4 class, noted not new).
- **#40 core memory:** companion join (t4) and weighty-bond (t19) triggers both fired with ★ toasts.
- **Companion pipeline:** recruit → `[PARTY_MEMBER:]` → sheet-less warn toast → async sheet (Cleric,
  7 spells incl. leveled) → `[COMPANION_HP:-3]` damage tracking — end to end clean.
- **Summarize:** fired on schedule mid-run (4 chapters; session tail at 831 tk by t29).
- **Prose:** Abercrombie register solid at t1 and t29 (clipped rhythm, dry ledger-morality bite);
  suggestion buttons stayed canon-legal all run.
- **futureEvents hygiene (#29):** set-and-resolved-in-one-turn events netted out (t3, t21).

## Findings

| # | Finding | Sev | Notes |
|---|---|:---:|---|
| P3-F1 | ⛨ **UA26 stat-binding broken for multi-foe single-response.** `COMBAT_STATS`/`IMMUNE`/`RESIST`/`VULN` handlers `match()` only the FIRST tag in the response and bind it to the LAST-added foe ("adjacency" comment at tag_table.js:221 — the implementation is not adjacency). A response adding N foes (the canonical ambush, docs explicitly teach "one tag per distinct foe") mis-binds foe #1's stats onto foe #N and silently drops all other stats tags. Reproduced controlled (Alpha's stats landed on Beta; Alpha got none) AND live at t10 (Club Thugs carry the Lantern Holder's statline; Lantern Holder has none). Screenshots document it: 3-foe panel shows "Feral Hound" wearing the Reach Marauder's stats + all three foes' immunities pooled unattributed. Fix shape: per-foe positional matching (bind each stats tag to the foe whose COMBAT_START precedes it in the text) — a tag_table-only change, drift-surface, Fable tier. | **Med-High** | tag_table.js:223–226; engine tests only cover the 1-foe-per-response case |
| P3-F2 | **Quest-reopen guard doesn't cover reward re-emission — double payment.** t16: the guard correctly swallowed the re-emitted `[QUEST:The Burning Man\|completed]`, but the same response's `[XP:120][GOLD:+10]` applied again (gold 70→80, +120 XP twice for one completion). The premature-completion + corrective-RETCON pattern that produces this arrived organically within ONE quest arc, so it is not rare. Fix candidates: when the guard fires for a `completed` re-emission, warn about (or suppress) same-response XP/GOLD; or a prompt line "never re-emit rewards with a correction". | Med | Raw-tag trace t15/t16 in corpus |
| P3-F3 | **`[LOCATION:]` under-emission on multi-day travel.** t23–29: two days east to the burned waystation — `world.location` still "Marrowgate" at run end; the GEOGRAPHY block (and RAG location keys) now describe the wrong place. TIME/WEATHER were emitted diligently over the same stretch; only LOCATION went silent. Same under-emission class as UA28-H3 but on Sonnet. Candidate: a travel-detection nudge, or fold into the #46-style engine-notes registry. | Med | — |
| P3-F4 | **#50 acquisition-side under-emission corroborated.** t27: oilcloth bundle physically retrieved from the well (a plot-critical item!) — no `[ITEM_GAINED:]`, not in inventory. Consumption side passed the same run (the flask, P3 check #6), so #50(a)'s two halves now have opposite live verdicts: consumption fixed, acquisition still leaks. | Low-Med | Feeds #50 |
| P3-F5 | **#51 spend-side gold leak persists.** t20: two rooms + food paid "without haggling" — no `[GOLD:-N]`. Earning side improved vs v1.258 (quest gold paid, twice — see P3-F2); spending still silent. Also one `[GOLD:+0]` (t5, harmless). | Low | Feeds #51 |
| P3-F6 | **Epithet narrated ≠ epithet tagged.** t17: GM coined "the Northlander" in prose, no tag; t18 explicit player adoption got the tag. The #47 doc line says "grant epithets at dramatic moments the story has earned" — the model treats narration as the grant and the tag as requiring player ratification. Acceptable behavior (arguably better), but the doc's intent and the model's reading differ; note for the next doc-line pass. | Low | — |
| P3-O1 | **Observation: `[ENEMY_SURRENDERS]` never organically emitted (0/29).** Three surrender-shaped scenes: t14 intimidation-break → `[COMBAT_END:fled]` (defensible — they walked); t9 and t29 yields happened with NO combat open (GM resolves pre-combat, correctly nothing to tag). The tag's engine semantics are verified live (named/bare/auto-close all correct). Sonnet may simply prefer closing via COMBAT_END or resolving before combat starts; needs a mid-combat "I yield!" moment to know if the tag fires when it truly applies. Watch, don't fix. | — | UA2/UA26 |
| P3-O2 | **Observation: GM pools mobs into one foe entry** (t10: 6 enemies → 2 entries) per the doc's own "faceless group can be one pooled entry" teaching — so organic ≥3-entry fights need ≥3 *distinct named* foes. Not a defect; explains why the 3-foe panel evidence is staged. | — | — |

## What this run cannot claim

Single device (no sync/CAS); fresh campaign (mature-save matrix is UA36); Sonnet only; no
condition lifecycle exercised at all (Phase A remains validated only by the v1.258 run); no
organic 3+-entry combat; UA35's freshly-wizard-built caster money test still unrun (this
character was hand-built by the harness, though catalog spells were used under canon rules).

## Status updates driven by this audit

- **HANDOFF_batch_v1260 close-out §4 (the spine gate): DONE** — this audit is the record; the
  batch may close with P3-F1/P3-F2 carried as new work items.
- **UA26:** re-open a residual — P3-F1 (stats mis-binding) is a real defect in shipped multi-foe
  combat; the foes[] mechanics themselves (add/named-damage/engaged/auto-close/cap) all validated.
- **UA39-②:** validated live on the original t355 vector — can be marked closed-validated.
- **UA41:** validated live (controlled Morwen-class) + organic evidence the backstop is rarely
  needed on Sonnet — closed-validated.
- **UA25 / REST / #40 / F3-guard:** live evidence attached (this run).
- **#46 Phase B `cause`:** still needs its first live trigger — carry on the play checklist.
- **#50:** split verdict recorded (consumption ✅ / acquisition ✗). **#51:** spend-side still silent.
- New candidate work items: **F3-guard reward suppression** (P3-F2) and **LOCATION travel nudge**
  (P3-F3).
