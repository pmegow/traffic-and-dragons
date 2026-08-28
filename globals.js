var MDL="claude-sonnet-5"; // default GM model — flipped from 4.6 on owner ruling 2026-08-15 (Sonnet 5's launch pricing made permanent; see MODEL_PRICING)
var SCENE_REF_ACTOR_CAP=10;     // #168 W2: accepted referents in one active scene. Overflow preserves them and makes irreversible identity writes fail closed.
var SCENE_REF_NEGATIVE_CAP=10;  // #168 W2: explicit/inference exclusions per active scene; same no-eviction rule as actors.
var SCENE_REF_SEALED_CAP=6;     // #168 W2: transitioned frames retained until a structured summary acknowledges them.
var CANON_TXN_CAP=24;           // #168 W2: bounded idempotency/quarantine receipts for death/quest/reward envelopes.
var CANON_TXN_RETIRE_TURNS=12;  // #168R3: committed receipts older than this retire on structured-summary success (quarantined receipts NEVER retire — poisoning is a contract); without retirement the cap permanently killed envelopes at receipt 24.
var IDENTITY_CONFLICT_CAP=8;    // #168 W2: unresolved referential conflicts surfaced back to the GM.
var IDENTITY_CONFLICT_STALE_ATTEMPTS=5;
var IDENTITY_CONFLICT_REARM_CAP=2;/* #190ⓓ: a shelved dispute re-arms at most this many times, and only on a NEW refusal reason — an identical retry is the loop itself */
var COMBAT_STALE_TURNS=2;      /* #214②: turns an OPEN encounter may go without a single combat tag before the
                                  engine asks for the missing outcome. Deliberately short — combat is high tempo,
                                  and the failure this catches (narration ends the fight, no tag follows) shows up
                                  on the very next turn. */
var REWARD_CLAIM_CAP=3;        /* #215: unanswered reward claims held at once. Small on purpose \u2014 a claim is a
                                  modal the player must answer, and a stack of them is its own immersion break. */
var W2_WITHHELD_CAP=12;        /* #213: reward tokens itemised on one conflict record. Bounded because a stubborn model re-refuses the same claim every turn — the ledger is a player-facing receipt of what a dispute cost, not an accumulating log. */
var PRESENCE_OBSERVED_CAP=16;   // #194: derived actors per scene frame (frame.observed[]). EVICTABLE — engine-derived and re-derivable from the tag stream, so LRU eviction is safe and it must NEVER arm the W2 overflow latch (auto-derivation in a busy tavern would otherwise freeze every irreversible identity write).
var SPEECH_EVIDENCE_TURNS=60;   // #194: how far back the death gate's speech limb reads transcript speaker maps (entry.sp), relative to the claim turn. Tuned on the live t1903 save: 60 reproduces the panel's witnessed census exactly (37 → 9 = party + Caul + the four characters actually in scene); the mention channel it replaces authorized ~1,000-turn-stale NPCs.
var DEATH_EVIDENCE_NOTES=2;     // #194 L3: fork-note deliveries per refused-death subject before the valve hands the dispute back to the standing conflict machinery (which shelves at IDENTITY_CONFLICT_STALE_ATTEMPTS).
var CAST_REFRESH_TURNS=12;      // #194 L4: turns at one node before the engine re-asks for a [SCENE_CAST:] (the 57-turn-tagless-dungeon case — location tags alone starve the ask trigger).
var CANON_CONTRA_COOLDOWN=25;
var COMMITMENT_PING_MAX_AGE=10;
var RECURRING_NAME_COOLDOWN=30;    // P7: turns between registration nudges for the same unregistered name
var RECURRING_NAME_MIN_TURNS=3;    // P7: distinct GM turns a name must recur in before the engine asks
var RECURRING_NAME_MAX_NUDGES=2;   // P7: ignored twice = the owner ruled it not-an-NPC; never ask again    // P4b/#169: a dated-commitment ping older than this is stale scene context, not a live gap      // P5①: turns between canon-contradiction notes for the same NPC (the deity-drift cadence) // #175: pointed deliveries before an unanswered conflict is shelved stale (the t1742 row fired 14 times unanswerable — a note N deliveries cannot clear will not clear on N+1)
var SUMMARY_IDENTITY_ROW_CAP=12;// #168 W6: compact identity authorities in one extractor call; priority is player, party, scene, then mentioned NPCs.
var SUMMARY_IDENTITY_CHAR_CAP=1600;// #168 W6: hard prompt bound for the uncached summary identity block.
var SUMMARY_IDENTITY_QUARANTINE_CAP=12;// #168 W6: non-injected exhausted-validation receipts retained for forensics.
var SUMMARIZE_AT=2400; // session-token threshold: summarize() gate, sendAction trigger, membar colors (amber at 80%).
// Counts only UNEXTRACTED session tokens (past worldState.sessKept — see sessKeptStart, memory.js).
// Raised 1200→2400 with #28: 1200 was tuned in the 2-3-sentence-cap era; prose-voice GM turns run
// 1,300-3,100 chars, so 1200 fired every ~2 exchanges in mature campaigns (the amnesia cliff).
var FUTURE_EXPIRE_TURNS=40; // #29: unresolved futureEvents older than this are swept at summarize time
var ACT_TURN_BUDGET=100;    // #23/#43: soft per-act pacing target — buildSkeletonBlock nudges toward the act's turning point once the ACTIVE act has run longer than this (measured from worldState.actStartTurn)
var ARC_TURN_BUDGET=50;     // #23 (v1.296): soft per-ARC pacing target — a single active arc that outlives this (measured from arc.startTurn) gets a targeted "close THIS arc" nudge. Half the act budget: one arc eating >half an act's whole turn allowance is dragging (the t727 Skinsaw arc metastasized to ~220). Superseded by the act nudge only when >1 arc is active (parallel — can't attribute the overstay).
var ARC_DRIFT_RECHECK=50;   // #23 (v1.297): the inverse arc/quest desync (buildArcDriftNudge) — an arc still 'active' after its same-name quest already completed — RE-FIRES this often (per pair, from worldState.arcDriftNudged[key]=lastTurn) instead of latching once, so a "justify and forget" can't let the open arc go stale unwatched. Soft nudge only; never auto-closes (user's one worry is a premature close).
var SUMMARY_KEEP_EX=3;     // #28: max exchanges retained in sessionLog after a summarize
var SUMMARY_KEEP_TOK=1600; // #28: token cap on that retained tail (newest exchange always kept).
var QUEST_ESCALATE_TURNS=3; // P3: an active quest all-objectives-done for this many turns triggers the engine-note escalation in sendAction (see buildQuestEscalation, api.js)
var QUEST_STALE_TURNS=30; // #191ⓑ (owner-ruled 2026-08-14): an ACTIVE quest with no QUEST/QUEST_STEP tag activity for this many turns gets the outcomes-review engine note (buildQuestStaleNudge, api.js); also the re-fire cooldown and the #17 stalled-WATCH threshold. Legacy rows without lastTouch read infinitely old (the #133 ruling)
var QUEST_OBJECTIVE_NUDGE_TURNS=3; // #129: an active quest with ZERO objectives for this many turns triggers the checklist engine note (see buildQuestObjectiveNudge, api.js)
var CORE_MEMORY_CAP=25;     // #40: defining-moments list cap, PER SHEET since #63 (v1.304) — generous, not infinite; overflow evicts to memory.archive with a loud warn (a full list means the triggers fire too easily, not that we need more storage)
var RENDER_PTR_CAP=60;      // #30: cap on worldState.renders — POINTERS only ({f,t,k} ≈ 40 bytes), never image bytes. A monotonic per-render list rides the sync blob, so it gets a bound like every other accumulator (standing audit dimension); oldest drop out first. 60 ≈ every render of a long campaign at a realistic render rate, ~2.4KB.
var CONDITION_AUDIT_TURNS=12;   // #46 audit teeth: a party condition this many turns old (or unstamped/legacy) makes buildConditionAudit fire
var MANA_BLOOD_HP=3;        // #110: NECROMANCER-ONLY overdraw price — HP paid per mana point cast beyond an empty pool (draft constant, flagged for the balance pass; the engine deducts it, the GM is told never to re-emit [HP:] for it)
var TT_HISTORY_MAX=6;       // #76: max Table Talk Q/A pairs fed back into the TT prompt (its OWN log — never sessionLog, so TT chatter can't reach story context). Stored list is capped at 2x this.
var TT_HISTORY_CHARS=3000;  // #76: char budget on that TT history (newest pair always survives)
var TT_CAP_MATCH_MAX=6;     // #76: max capability-bible entries expanded to full canon per question (the index of ALL names is always sent; only matches get the 6-row detail)
var CONDITION_AUDIT_COOLDOWN=12; // #46: at most one condition audit per this many turns — a kept condition gets re-audited next window, not nagged every turn
/* #168: token-bounded relationship canon. The old bare `wed` branch matched Owed/showed and
   therefore classified a passing favor descriptor as marriage-weighty in BOTH consumers
   (core-memory filing and downgrade detection). Spell out the intended morphology inside word
   boundaries: inflections remain weighty; unrelated words containing a short stem never are. */
var WEIGHTY_REL_RE=/\b(?:married|wed(?:s|ded|ding)?|w(?:ife|ives)|husbands?|spouses?|betroth(?:s|ed|ing|al)|lovers?|betray(?:s|ed|ing|al)|sworn|oaths?|blood[- ]?(?:bound|brothers?|sisters?)|nemes(?:is|es)|widow(?:s|ed|er)?|aveng(?:e|es|ed|ing))\b/i; // #40: relationship descriptors weighty enough to file as a defining moment. +wife/husband/spouse (v1.270, UA41): the t455 Morwen entries read literally "Wife" — the exact incident the reciprocity nudge exists to catch never matched the original list
// #167: once a bond downgrade is recognized, the check re-fires until the pair's descriptor is
// rewritten (resolution in stampRelationshipChanges). #168 established that t1666 never reached
// this persistence path: bare `wed` misclassified "Owed a favor" as weighty, so no check armed.
// The word-bounded matcher above closes that creation gap; delivery stays bounded on purpose.
var REL_DOWNGRADE_COOLDOWN=3;  // turns between deliveries of the same pending check
var REL_DOWNGRADE_MAX=3;       // total deliveries before the entry retires unanswered
var REL_DOWNGRADE_EXPIRE_TURNS=60; // #181: muted-but-unresolved entries archive out of live state this many turns after their last delivery (owner 2026-08-13: "60 sounds reasonable, adjust later if need be"); unmuted entries never expire
var MOOD_AUDIT_TURNS=12;    // v1.381: a party member's recorded MOOD older than this is due for a re-check (buildMoodAudit, api.js). Deliberately far shorter than REL_AUDIT_TURNS below: bonds shift on a ~100-turn scale, mood is scene-scale, and auditing a volatile field on a slow field's clock is what let "watchful, tense" sit pinned on Frizwick for an entire arc. ~12 turns ≈ one play session at the observed rate. An EMPTY mood is eligible immediately — no age wait — since a party member in every scene with no recorded mood is a gap now, not in 12 turns.
var MOOD_AUDIT_COOLDOWN=12; // v1.381: at most one mood audit per this many turns. Frequency is the real lever on churn — every audit invites re-emission, and re-emission is where vocabulary leaks enter, so a fast audit would keep rolling the corruption dice on characters that were fine.
var REL_AUDIT_TURNS=40;          // #61: at most one relationship audit per this many turns (buildRelationshipAudit, api.js) — bonds shift on a ~100-turn scale in the wild (t455/t472 Runelords), so 40 re-grounds without nagging; a party join/leave pulls the audit forward via worldState.relAuditDue
var CONSUMABLE_RE=/\b(potion|elixir|draught|tonic|salve|poultice|scroll|charge|bomb|grenade|flask|vial|phial|dose|ration|torch|dust|powder|oil)s?\b/i; // #60: item base-names that read as per-use consumables even without an " xN" stack (a counted stack qualifies regardless). Deliberately EXCLUDES arrow/bolt — ammo is caught by the xN path when stacked, and per-shot nagging of unstacked ammo would be noise
var ARC_WALL_WARN_LEAD=15;  // #231 (the closed-eye sprawl, owner ruling 2026-08-24 — HARD WALL): turns before an arc's ARC_TURN_BUDGET expires that buildArcWallNudge starts naming the emergent threads that will be closed with it. Runway, not a reprieve: the wall falls either way, but the GM gets told in time to land them in fiction. Doubles as the note's re-fire cooldown.
var SUMMARY_DEFER_TURNS=10;  // #263 (JP0-13): how long a deferred summary failure may skip extraction attempts while its owning tag-lane conflict stays live. The cap guarantees the 3-strike terminal ladder can never be disabled — past it, attempts (and strikes) resume even under an unresolved dispute.
var REVIEW_CALL_TAGS=["QUEST","QUEST_STEP","ITEM_DEF","XP","GOLD","ITEM_GAINED"];  // #264 (owner ruling 2026-08-28): the ONLY tags a review-call response (Suggest-completion, Define-item) may mutate through — quest/item/reward class; everything else strips loudly in applyMuts. syncCharSheet deliberately keeps the full vocabulary.
var SPLIT_AUDIT_TURNS=10;   // #133 (t1431/B21 stale-split finding): a charSheet.splitLoc older than this (or LEGACY-unstamped — infinitely old, the #46 precedent) gets the buildSplitAudit neutral-fork note (rejoin or re-affirm); doubles as the per-member re-fire cooldown. Only [PARTY_SPLIT:] tags resolve it — the record never commands the story
var PRESENCE_AUDIT_TURNS=12; // #137 (t1467 phantom-presence finding): every N turns the PRESENCE CHECK note asks the GM to confirm each WITH-party member is physically in the scene or emit [PARTY_SPLIT:] — the inverse of buildSplitAudit (which can only police records that EXIST). Deterministic: catches the Morwen class the stay-behind verb-watcher cannot
// #227 the deep-time age ladder — the campaign's world-history rungs, oldest first, and the
// answer to the antiquity ratchet (the GM signalling that a new scene matters by making it
// OLDER than the last, forever). Age is the one dial in the fiction with no stop on it, so the
// ladder turns it into a CLOSED ENUM: a thing IS of a rung, it never gets to be "older".
// NAMED deepTime, NEVER "eras" — memory.eras (#148) is the compiled PLAYED story, a different
// concept entirely, and the collision would be permanent.
// These caps are load-bearing twice over: a 20-rung ladder is not a ladder, and this text is
// CACHED prompt (stable half) fed from a semi-trusted campaign file, so its size must be bounded.
var DEEP_TIME_RUNGS_CAP=6;
var DEEP_TIME_NAME_MAX=60;
var DEEP_TIME_WHEN_MAX=90;
var DEEP_TIME_NOTE_MAX=160;
var TAG_LOG_CAP=40;
var HEALTH_LOG_CAP=40; // #17 drift-health ring (worldState.healthLog): ONE observational {t,in,cr,rag,prov} per gameplay-turn call, written only by recordUsage, read only by healthIndicators (helpers.js) — never by any prompt or parser path
var RETCON_PIN_SHELF=15;    // #147 (drift pass order 4): turns a CORRECTION IN FORCE pin survives un-filed before it archives LOUDLY — bounded so a stuck pin can never become permanent prompt noise (the one-shot-shelf discipline); a completed summarize extraction archives it earlier
var DEITY_DRIFT_COOLDOWN=25;
var HP_ZERO_NOTE_TURNS=3;    /* #196: turns the player must sit at exactly 0 HP before the observer fires (combat excluded from firing, not from counting) */
var HP_ZERO_NOTE_COOLDOWN=5; /* #196: turns between re-fires while the zero persists — one note per ask, pressure without spam (the PROVISIONAL_NUDGE_COOLDOWN rhythm) */
var NODE_MENTION_CAP=8;      /* #194 L6: names a node's rumor mill retains — LRU at write time (a re-mention moves to newest); bounded per the standing monotonic-resources rule */
var NODE_MENTION_WINDOW=120; /* #194 L6: turns a heard name stays CURRENT rumor at render time — older mentions keep their record but stop injecting */
var PRESENCE_FRESH_TURNS=12; /* #194 L6: last-placed age band — within this many turns projects as "recently" */
var PRESENCE_AGED_TURNS=60;  /* #194 L6: within this = "a while back"; beyond = "long ago" */
var PRINCIPAL_STAGE_TURNS=25;    /* #199: campaign turns before never-staged authored principals draw the off-stage note (the GPT-ladder finding: 100 combined turns, Valerius never named, the seeded bench replaced by inventions) */
var PRINCIPAL_NUDGE_COOLDOWN=30; /* #199: turns between re-asks (the RECURRING_NAME cadence) */
var PRINCIPAL_NUDGE_MAX=2;       /* #199: asks per principal, then the silence stands as a ruling — never ask again (the P7 pattern) */
var RECONCILE_SKIP_MIN=360; // #142: a clock reconcile that crosses DAWN and exceeds this is presumed a mislabel (skip-and-demand), never a timeskip — one word cost 19h at t1524 // #140③: at most one deity-drift nudge per character per this many turns — a god's displeasure is an arc, not a nag          // #137 provenance ring: recent per-response tag names + mutation labels kept ON THE SAVE (worldState.tagLog) so the next field forensics can decide emitted-then-purged vs never-emitted — the fork the t1467 investigation could not close
var LOC_DESC_NUDGE_COOLDOWN=10; // #134 (t1431 multiplying-beds): while the party's current node has NO [LOCATION_DESC:] on file, buildLocationDescNudge re-demands one this often — re-fire, not one-shot (the #29 rot lesson); a filed description ends it permanently
var PROVISIONAL_CAP=4;          // #156 Phase A: max OUTSTANDING provisional npc records (the create-distinct collision outcome). Beyond it a suspect write degrades LOUDLY to today's direct-write behavior — the guard may never be worse than the status quo it replaces (runaway-model bound, the pendingItemDefs precedent)
var PROVISIONAL_NUDGE_COOLDOWN=5; // #156 Phase A: buildProvisionalNudge re-fires per unresolved provisional this often — re-fire, not one-shot (an unresolved provisional is live fragmentation; the #29/#134 rot lesson), latch on worldState.provisionalNudged
var NPC_INTRO_REL_RE=/(unknown|stranger|unfamiliar|just met|newly met|not yet met|new arrival)/i; // #156 Phase A: an [NPC:] relation slot that reads as an INTRODUCTION — into a history-rich record, that is the Savah collision signature (t1530: "unknown, not yet met" written into the armorer's file). Tested against the RAW rel operand only
var PHASE_MISMATCH_MIN=240;  // #158: minutes of BAND distance between a narrated phase assertion and the clock before the GM-decides reconcile nudge arms (clockPhaseDetect, clock.js). 4h swallows honest estimation slop and adjacent-phase wording; the t1605 class (dusk narrated at 11:10 am = 7h+) clears it with room
var LOC_STATE_CAP=3;        // #105 (B17): max durable state-change notes per map node — the record COMPRESSES (newest state is the truest state); overflow evicts the oldest loudly. Small on purpose: every note rides the volatile prompt every turn via the geo block or the changed-locations roll-up
var GB_TURN_CAP=8;          // #173: max EXACT visit turns kept per character per node in the location guestbook (the cap is per CHARACTER — pinned amendment ①); older turns fold into the {first,last,count} aggregate, never the void
var GB_PROJ_MAX=14;         // #173: max visitor entries the GEO attendance line renders for one node (most-recent first); overflow renders a visible "+N more" note, never silent truncation
var CHANGED_LOC_MAX=10;     // #105: max locations shown in the always-present CHANGED LOCATIONS roll-up (most-recent-first); overflow renders a visible "+N more" line, never silent truncation
var CONSUMABLE_NUDGE_COOLDOWN=6; // #60: after a consumable check fires for an item, don't re-queue that same item for this many turns — one ignored nudge means the GM decided it wasn't spent; re-nagging every mention would railroad a false decrement (the C2 lesson in reverse)
// 1600 retains 2-3 exchanges at observed mature-campaign prose sizes (t198: GM turns 1,300-3,100
// chars ≈ 330-780 tok/exchange); 900 kept only 1, under the 2-3 the #28 spec calls for.
// ── LLM provider adapters ─────────────────────────────────────────────────────
// Each provider is a self-contained object: callGM() picks the active one and
// calls headers/buildBody/parseResponse. NO if(provider===...) branches anywhere
// else. This same shape becomes the server-side routing table under subscription.
// Shared tag-discipline reinforcement for every non-Claude provider. Claude honors the
// tag contract from the base prompt; other models treat the tags as optional and narrate
// changes without emitting them, silently desyncing the sheet. callGM() appends this for
// gameplay turns only (not summarize). Per-provider tuning the abstraction exists for.
var TAG_REINFORCE="\n\n=== MANDATORY TAG DISCIPLINE — the engine reads these brackets, NOT your prose ===\nEvery mechanical change you narrate MUST include its state tag in the SAME response, or the engine will not apply it and the player's sheet silently desyncs. If the prose says it happened, the tag MUST be present.\n- Money changes hands -> [GOLD:-5] or [GOLD:+10] (signed integer only)\n- Damage or healing -> [HP:-8] or [HP:+5]\n- Item bought / found / given / taken / lost -> [ITEM_GAINED:name] or [ITEM_LOST:name]\n- A named NPC appears or is interacted with -> [NPC:name|status|relation]\n- Travel to a new place -> [LOCATION:name]\n- XP earned -> [XP:25]\n- Quest offered / accepted / advanced / finished -> [QUEST:title|offered|desc] / [QUEST:title|active] / [QUEST_STEP:title|objective|true] / [QUEST:title|completed]\n- An NPC joins / leaves the party -> [PARTY_MEMBER:name|true] / [PARTY_MEMBER:name|false]\n- Campaign arc completed -> [ARC_COMPLETE:arc title]; act's turning point reached -> [ACT_COMPLETE:act title]\n- A character speaks -> [SAY:Name] before the quoted line; when the engine asks who is physically present -> answer with one [SCENE_CAST:Name, Name] line ([SCENE_CAST:none] if the party is alone)\n- Do NOT end your response with suggested actions, a 'You could...' line, or an [ACTIONS:] tag — action suggestions are generated separately by the engine.\nExample: paying 5 gold for a room MUST contain [GOLD:-5]. Never narrate spending or earning gold without the matching [GOLD:] tag. Tags are invisible to the player; emit them inline, never announce them.\n";
// UA28: weak-model (Haiku) nudges. Haiku HONORS the tag contract (0 turn errors across the
// 150-turn AUDIT_HAIKU window) — its failure is UNDER-EMISSION of exactly two tag families:
// HP recovery (H1 — the sheet sat at 0 HP for 31% of turns after healing was narrated) and
// location changes (H3). So this block targets those two and nothing else: it is deliberately
// NOT the full TAG_REINFORCE (that block cures narrate-without-tagging, which Haiku doesn't
// have, and attention is the scarce resource on the free tier). Appended to the STABLE half
// by callGM — constant per model id, so cache-safe; resolveReinforce (api.js) returns "" for
// Sonnet/Opus, keeping their prompt BYTE-IDENTICAL to today (zero cache invalidation).
var ANTHROPIC_HAIKU_REINFORCE="\n\n=== STATE DISCIPLINE — rules this model tends to bend ===\n1. HP RECOVERY: whenever ANY character regains hit points for ANY reason — healing magic, a potion, first aid, a night's rest, natural recovery — emit [HP:+N] (player) or [COMPANION_HP:Name|+N] (party member) in the SAME response. If the sheet above shows 0 HP but you are narrating that character up and moving, the sheet is WRONG until you emit the recovery tag. Never leave a healed character at 0 HP on the sheet.\n2. LOCATION: whenever the party travels to a different named place, emit [LOCATION:name] in that response. Entering a distinct area inside it (a tavern, a chamber, a cave) emits [SUBLOCATION:name]; leaving it emits [SUBLOCATION_LEAVE]. Narrated travel without the tag strands the world state at the old location.\n3. SPELL CANON: the CANONICAL SPELL RULES block is hard physics. No spell ever reaches beyond its listed range, affects more than its listed targets, or lasts past its listed duration — no matter the circumstances, the stakes, or how it seemed to work before. If an attempted cast exceeds its canon, the spell simply FAILS: narrate the failure and offer what the canon actually allows.\n";/* item 3 added v1.248 — the t361 Haiku incident (Message conversation at three miles) */
// Shared usage extractor for OpenAI-compatible providers (openai/grok/ollama).
// UA13 (v1.280): normalized to ANTHROPIC unit semantics — `in` is UNCACHED input only.
// OpenAI's raw prompt_tokens INCLUDES cached tokens, so we subtract cached_tokens here;
// cross-provider totals in worldState.usage are now the same unit (in + cacheRead = full prompt).
var OPENAI_USAGE=function(data){var u=data.usage;if(!u)return null;var _cached=(u.prompt_tokens_details&&u.prompt_tokens_details.cached_tokens)||0;return {in:Math.max(0,(u.prompt_tokens||0)-_cached),out:u.completion_tokens||0,cacheRead:_cached,cacheWrite:0};};
// #132: length-cap detection, shared by the OpenAI-shaped adapters. Returns the finish reason
// string ONLY when the response was cut at the output-token cap, else null — callGM warns loudly
// on truthy (a cut response may have lost a state tag mid-emission; the B21 [SCH case).
var OPENAI_FINISH=function(data){var c=data.choices&&data.choices[0];return (c&&c.finish_reason==="length")?"length":null;};
// $/MTok — used by usageCost() (api.js) for the Dev Mode running-cost estimate (TODO #21).
// Anthropic rates verified 2026-07-02; cache write = 1.25x input (5min TTL), cache read = 0.1x input.
// Keyed by model-ID prefix so dated IDs (claude-haiku-4-5-20251001) still match.
var MODEL_PRICING={
  "claude-opus-4-8":  {in:5.00, out:25.00, cacheWrite:6.25, cacheRead:0.50},
  // Sonnet 5's launch pricing ($2/$10) is PERMANENT (owner-confirmed 2026-08-15; the planned
  // Sep 1 rise to $3/$15 was cancelled) — which is why it became the default GM model. Its
  // tokenizer bills ~30% more tokens for the same text, so real per-TURN cost ≈ 0.87× of 4.6,
  // not the full 33% the rate card suggests (see TODO #30 row).
  "claude-sonnet-5":  {in:2.00, out:10.00, cacheWrite:2.50, cacheRead:0.20},
  "claude-sonnet-4-6":{in:3.00, out:15.00, cacheWrite:3.75, cacheRead:0.30},
  "claude-haiku-4-5": {in:1.00, out:5.00,  cacheWrite:1.25, cacheRead:0.10},
  // Gemini rates verified 2026-08-18 (ai.google.dev/gemini-api/docs/pricing): $0.75/$3.75
  // holds through Dec 31 2026, then DOUBLES to $1.50/$7.50 on Jan 1 2027 — revisit then.
  // Both flash models are identically priced (which is why the #29b fallback rung is
  // cost-neutral). ⚠ cacheRead is deliberately 0: Gemini's promptTokenCount INCLUDES cached
  // tokens (unlike Anthropic's input_tokens), so pricing them again would double-count —
  // cached reads therefore bill at the FULL input rate here, a documented UPPER bound, never
  // an undercount (the #30 failure class). `out` already includes thinking tokens (parseUsage
  // folds thoughtsTokenCount into out, matching Google's billing).
  "gemini-3.7-flash": {in:0.75, out:3.75, cacheWrite:0, cacheRead:0},
  "gemini-3.6-flash": {in:0.75, out:3.75, cacheWrite:0, cacheRead:0},
  // OpenAI rates verified 2026-08-18 (post the July 30 2026 adjustment: sol standard $5/$30;
  // luna cut 80% to $0.20/$1.20). Same cacheRead:0 caveat as the Gemini entries — the OpenAI
  // usage shape's prompt_tokens INCLUDES cached tokens (CLAUDE.md §5), so cached reads bill at
  // the full input rate here: a documented UPPER bound, never an undercount (#30 class).
  "gpt-5.6-sol":  {in:5.00, out:30.00, cacheWrite:0, cacheRead:0},
  "gpt-5.6-luna": {in:0.20, out:1.20,  cacheWrite:0, cacheRead:0}
};
// buildSysPrompt returns {stable, volatile} for gameplay turns (TODO #11 prompt caching);
// sysOverride callers pass a plain string. Non-Anthropic adapters flatten via sysJoin;
// the Anthropic adapter keeps the halves separate to place a cache_control breakpoint.
function sysJoin(sys){return typeof sys==="string"?sys:sys.stable+sys.volatile;}
var PROVIDERS={
  anthropic:{
    id:"anthropic", label:"Claude (Anthropic)", keyHint:"sk-ant-...",
    endpoint:"https://api.anthropic.com/v1/messages",
    defaultModel:MDL,
    upgradeModel:"claude-sonnet-5", // escalation target must never sit below (or cost more than) the default — moved with MDL 2026-08-15
    models:["claude-sonnet-5"], // the >=Sonnet-5 menu (owner rulings 2026-08-16). claude-opus-5 was benchmarked (money turn: stellar — deepest structure of the #22 study) and then UNLISTED the same day on economics: ~$8-9/50 turns ≈ 3x sonnet-5 at unverified opus-4-8 rates ("doesn't make economic sense at the moment"). Restoring it is this one line; the Claude-5 thinking guard below already covers it.
    headers:function(key){return {"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"};},
    // {stable, volatile} → two system blocks with a cache_control breakpoint after the stable
    // one: the stable prefix re-reads at 0.1x input price on every turn (writes at 1.25x, 5min
    // TTL — warm during active play). Plain-string sys (summarize/actions/skeleton overrides)
    // stays a single uncached block. Min cacheable prefix on Sonnet 4.6 is 2048 tokens — the
    // stable block clears it (enforced by an engine test); verify live via usage.cache_read_input_tokens.
    buildBody:function(msgs,sys,maxTok,model){
      var body={model:model,max_tokens:maxTok,messages:msgs};
      // Claude 5 models run ADAPTIVE THINKING when `thinking` is omitted (4.6 ran thinking-off) —
      // unguarded, every GM turn bills thinking as output tokens AND eats into maxTok=1000; on
      // opus-5 the FIRST content block is then a thinking block and parseResponse saw "Empty
      // response" (found live 2026-08-16, the opus-5 money turn). Explicit disabled preserves the
      // 4.6-equivalent turn shape; opus-5 accepting {type:"disabled"} was probe-verified live.
      if(/^claude-(sonnet|opus)-5/.test(model))body.thinking={type:"disabled"};
      if(typeof sys==="string")body.system=sys;
      else body.system=[{type:"text",text:sys.stable,cache_control:{type:"ephemeral"}},{type:"text",text:sys.volatile}];
      return body;
    },
    parseResponse:function(data){var i;if(data.content)for(i=0;i<data.content.length;i++){if(data.content[i]&&data.content[i].type!=="thinking"&&typeof data.content[i].text==="string"&&data.content[i].text.trim())return data.content[i].text;}throw new Error("Empty response");}, // tolerant of thinking-bearing responses: first NON-EMPTY non-thinking text block wins (the opus-5 lesson; #198 adds the trim — ""/whitespace blocks fall through to the loud throw instead of committing an empty turn)
    parseFinish:function(data){return data.stop_reason==="max_tokens"?"max_tokens":null;},
    // Anthropic: input_tokens EXCLUDES cached tokens (a turn's real input = in + cacheRead).
    // Prompt caching is LIVE (#11, v1.151) — healthy play shows cacheRead >> in on turn calls.
    parseUsage:function(data){var u=data.usage;if(!u)return null;return {in:u.input_tokens||0,out:u.output_tokens||0,cacheRead:u.cache_read_input_tokens||0,cacheWrite:u.cache_creation_input_tokens||0};},
    // UA28: model-CONDITIONAL reinforce — the only function-shaped one (others are string
    // constants). Haiku gets the two-tag under-emission block; every other Claude gets ""
    // (byte-identical prompt — Sonnet needs no reinforcement, validated at v1.32 and re-money-
    // tested at v1.238). Pure function of the model id, so the stable half stays constant
    // within a campaign; a mid-campaign model switch is an expected one-time UA5 purity warn.
    reinforce:function(model){return /haiku/i.test(model||"")?ANTHROPIC_HAIKU_REINFORCE:"";}
  },
  openai:{
    id:"openai", label:"ChatGPT (OpenAI)", keyHint:"sk-...",
    endpoint:"https://api.openai.com/v1/chat/completions",
    defaultModel:"gpt-5.6-sol",
    upgradeModel:"gpt-5.6-sol",
    models:["gpt-5.6-sol","gpt-5.6-luna"], // pruned to the >=Sonnet-5 menu (owner ruling 2026-08-16): gpt-4o/4o-mini/4.1 removed — gpt-4o FAILED the sweep contract (15/50 zero-tag, frozen sheet); gpt-5.6-sol held it (round-2 arm 2). LUNA LISTED by owner ruling 2026-08-20 — amends the ≥Sonnet-5-only bar and the v1667 re-run report's seat-unchanged conclusion: the budget tier at $0.20/$1.20 (25x under sol), measured UP across the board under the current engine (SWEEP_luna_rerun_v1667.html: 44 distinct tags vs 37, a third more prose, 375 XP/L2, five quests archived, first LEGAL death envelope, deepest budget-tier skeleton progression). Known blemish, documented not hidden: the false-death habit on collective NPCs persists — contained by the W2 gate (quarantines, zero canon damage, but re-attempt toasts). Also remains sol's #29b storm rung; luna selected simply has no rung below it.
    // OpenAI carries the system prompt as the first message, uses Bearer auth,
    // and returns choices[0].message.content. max_tokens works for gpt-4o; gpt-5.x REJECTS it
    // with HTTP 400 and demands max_completion_tokens (found live 2026-08-15, the gpt-5.6-sol
    // bring-up) — model-conditional so the validated gpt-4o path stays byte-identical.
    // #198 reasoning_effort "low" on every gpt-5.x call (owner ruling 2026-08-20, live probe on
    // the real 33k-token t2004 prompt): gpt-5.x reasoning bills against max_completion_tokens —
    // at the implicit medium a combat turn spent 1034 tokens reasoning (variance 218–1034 on ONE
    // prompt; the field's empty t2002 narration is the high-side draw under the old 1500 cap),
    // and the 200-token suggestion call returned EMPTY with all 200 tokens reasoning, every call.
    // 'low' (probe: ~131 tokens) held every tag discipline and answered the [SCENE_CAST:] ask
    // medium ignored — the engine already does the bookkeeping thinking, and medium's most
    // ambitious product was a same-response-evidence death envelope the W2 gate refuses.
    // ⚠ 'minimal' is NOT legal here — gpt-5.6 rejects it with HTTP 400 (menu: none…max);
    // chat-completions acceptance of "low" probe-verified live 2026-08-20. The #29b luna rung
    // inherits the pin through this same conditional. Certification: owner-settled 2026-08-20 —
    // the v1662 GPT-ladder sweep stands for the family; a dedicated sol-at-low re-run is waived
    // (#17's zero-tag indicator is the field watch).
    headers:function(key){return {"Content-Type":"application/json","Authorization":"Bearer "+key};},
    buildBody:function(msgs,sys,maxTok,model){var b={model:model,messages:[{role:"system",content:sysJoin(sys)}].concat(msgs)};if(/^gpt-5/.test(model)){b.max_completion_tokens=maxTok;b.reasoning_effort="low";}else b.max_tokens=maxTok;return b;},
    tokScale:4, // #198: reasoning shares the completion budget, so the runaway-insurance cap needs headroom (turns 6000, actions 800, summarize 8000) — the gemini E89 pattern; gpt bills only what it uses
    // #29b OpenAI storm rung (owner ruling 2026-08-18, after the ladder sweep): a sol storm
    // re-attempts ONCE on luna — per-call, never sticky, loud, attributed (see the gemini entry's
    // rung comment; identical machinery). Unlike Gemini, the model rides IN THE BODY here, so the
    // rung's generic rebuild path re-serializes the payload with the fallback id (battery-pinned).
    // Sweep evidence for the seat: SWEEP_luna_arm_v1661 (engine-guarded canon — acceptable at the
    // rung bar, a fallback turn beats a dead one) + SWEEP_gpt_ladder_v1662 (the family scoreboard).
    // Since 2026-08-20 luna is ALSO a listing (see models[] above) — the rung survives unchanged
    // for sol players; a player who SELECTS luna has no rung below it (model===fallbackModel).
    fallbackModel:"gpt-5.6-luna",
    parseResponse:function(data){if(!data.choices||!data.choices[0]||!data.choices[0].message||typeof data.choices[0].message.content!=="string"||!data.choices[0].message.content.trim())throw new Error("Empty response");return data.choices[0].message.content;}, // #198: ""/whitespace THROWS — reasoning exhausting the budget returned content:"" and the turn committed EMPTY (field t2002); loud beats silent
    parseUsage:OPENAI_USAGE,
    parseFinish:OPENAI_FINISH,
    reinforce:TAG_REINFORCE
  },
  gemini:{
    // Google's schema differs: system in systemInstruction, messages in contents[]
    // (role "model" not "assistant"), reply at candidates[0].content.parts[0].text,
    // and the MODEL NAME is in the URL — so endpoint is a function(model).
    id:"gemini", label:"Gemini (Google)", keyHint:"AIza...",
    endpoint:function(model){return "https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent";},
    defaultModel:"gemini-3.7-flash", // pruned to the >=Sonnet-5 menu (owner ruling 2026-08-16): 3.7-flash held the sweep contract (round-2 arm 1, index ~56); 3.5-flash FAILED story coherence and the 2.5 line sits below the tier floor
    upgradeModel:"gemini-3.7-flash",
    models:["gemini-3.7-flash"],
    // #29b in-family overload rung (owner ruling 2026-08-18, the 503 storms): when the primary
    // exhausts its transient retries, the SAME call re-attempts ONCE on this model. PER-CALL
    // only, never sticky — the next call starts back on the chosen model, because voice
    // continuity outranks recovery speed (owner ruling 2026-08-17). Deliberately NOT in models[]:
    // the picker menu stays sweep-validated (>=Sonnet-5 ruling 2026-08-16); this is emergency
    // degrade, one LOUD visible turn at a time (toast + the #45 m: transcript stamp), not a
    // listing. Sweep-CERTIFIED 2026-08-18 (audits/SWEEP_fallback_rung_v1660.html): both contract
    // halves hold over the 50-turn standard campaign — degradations are texture (leaner prose,
    // thinner quest bookkeeping, grammar slips), never canon damage; identical per-token price.
    fallbackModel:"gemini-3.6-flash",
    headers:function(key){return {"Content-Type":"application/json","x-goog-api-key":key};},
    // thinkingLevel "low" on EVERY call kind (owner ruling 2026-08-16, #22): 3.7-flash thinks
    // MANDATORILY and bills it as output. The 50-turn low arm (corpus v1644, standard Korrag
    // campaign) held BOTH contract halves — 0/50 zero-tag turns, dead-actor scan clean, all 4
    // death tags same-turn as the prose kill (the thinking-ON sibling had the premature-tag
    // blemish, not this one) — while a paired A/B on one identical 17,305-token gameplay prompt
    // measured 0 thought tokens vs a median 275/call, ~35% less billable output, ~2x faster,
    // and MORE narration (thinking-on spends its budget deliberating instead of writing).
    // ⚠ "minimal" is NOT a legal tightening — this model rejects it with HTTP 400.
    buildBody:function(msgs,sys,maxTok,model){var contents=[],i;for(i=0;i<msgs.length;i++){contents.push({role:msgs[i].role==="assistant"?"model":"user",parts:[{text:msgs[i].content}]});}var gc={thinkingConfig:{thinkingLevel:"low"}};if(maxTok)gc.maxOutputTokens=maxTok;return {systemInstruction:{parts:[{text:sysJoin(sys)}]},contents:contents,generationConfig:gc};},
    parseResponse:function(data){if(!data.candidates||!data.candidates[0]||!data.candidates[0].content||!data.candidates[0].content.parts||!data.candidates[0].content.parts[0]||typeof data.candidates[0].content.parts[0].text!=="string"||!data.candidates[0].content.parts[0].text.trim())throw new Error("Empty response");return data.candidates[0].content.parts[0].text;}, // #198: ""/whitespace THROWS (the empty-turn commit class, field t2002)
    parseUsage:function(data){var u=data.usageMetadata;if(!u)return null;return {in:u.promptTokenCount||0,out:(u.candidatesTokenCount||0)+(u.thoughtsTokenCount||0),cacheRead:u.cachedContentTokenCount||0,cacheWrite:0};}, // thoughtsTokenCount folded into out (probe 2026-08-16: gemini-3.7-flash thinks MANDATORILY — 745 thought tokens per 51 output on a trivial call, billed as output, previously invisible to the meter)
    parseFinish:function(data){var c=data.candidates&&data.candidates[0];return (c&&c.finishReason==="MAX_TOKENS")?"MAX_TOKENS":null;},
    reinforce:TAG_REINFORCE,
    tokScale:4 // generous ceiling (maxTok*4 ≈ 4k-8k), NOT sky-high: the old x1000 sent maxOutputTokens=1,000,000+, which Gemini rejects with HTTP 400 on models capped well below that (audit E89). The prose voice still controls actual length.
  }
};
var carMode=false;
var APP_VERSION="v1.736";
var activeProvider="anthropic"; // id into PROVIDERS
var providerKeys={};            // {providerId: apiKey}
var providerModels={};          // {providerId: modelOverride} — falls back to defaultModel
// Per-turn model attribution (#45): the model id callGM resolved for the LAST GAMEPLAY call
// (sysOverride calls — summarize/actions/skeleton/TT — never touch it). logTranscript stamps it
// onto GM entries as the additive `m:` field so every narration is attributable to the model
// that wrote it (Haiku-vs-Sonnet quality analysis, incident forensics, future per-model billing).
var _lastTurnModel=null;
var customRules=[];
var apiKey="",falKey="",busy=false,lastAction=null;
var RENDER_MODELS=[
  // img2img.strength is the model's DEFAULT — the effective value goes through img2imgStrength()
  // (helpers.js, #42), which lets a per-model user override from Render Options win. Models whose
  // edit-style API has no strength knob (nano-banana) simply omit the field; the slider hides.
  // #208a (owner call 2026-08-21): BOTH Flux entries (flux/dev + the flux-lora "HQ" host) are
  // DROPPED — consistently sub-par: solo-portrait img2img collapsed every party scene to one
  // figure, and the five-way controlled test (DOC/Research/party_render_engines.html) confirmed
  // the class. The #163 A/B history and the entry shapes live in git (v1.689) if a FLUX.2-era
  // entry ever earns a seat. Stored prefs pointing at the departed ids fall back safely through
  // resolveRenderModel (helpers.js).
  {id:"fal-ai/nano-banana-2",  label:"Nano Banana 2",
   body:function(p){return {prompt:p,aspect_ratio:"4:3",resolution:"1K",num_images:1};},
   // Edit API composites MULTIPLE reference images — image_urls accepts the whole party portrait set
   // (player first) for a group render; a lone data-URL is wrapped so single-subject renders still work.
   // #165: multiSeed marks a compositor img2img — doRender gathers COMPANION portraits only for
   // entries that declare it (a table property, never an id check at the call site).
   img2img:{endpoint:"fal-ai/nano-banana-2/edit",multiSeed:true,
            body:function(p,imgUrl){return {prompt:p,image_urls:(Array.isArray(imgUrl)?imgUrl:[imgUrl]),aspect_ratio:"4:3",resolution:"1K",num_images:1};}}},
  /* #210 (owner request 2026-08-21): GPT Image 2 — arena #1 on every image board; quality
     "medium" IS the config that tops the boards and runs ~4x cheaper than high (~$0.04-0.10 vs
     $0.15-0.40/img). t2i defaults to landscape_4_3; stated anyway so portraitRenderBody (which
     keys on the image_size FIELD) can flip portraits to portrait_4_3. Edit is an edit-style
     multiSeed compositor (image_urls, no documented cap, no strength knob). 4/4 on the five-way
     with minor hair drift; slowest arm (~40s at medium). Schema probe-verified 2026-08-21. */
  {id:"openai/gpt-image-2",   label:"GPT Image 2",
   body:function(p){return {prompt:p,image_size:"landscape_4_3",quality:"medium",num_images:1};},
   img2img:{endpoint:"openai/gpt-image-2/edit",multiSeed:true,
            body:function(p,imgUrl){return {prompt:p,image_urls:(Array.isArray(imgUrl)?imgUrl:[imgUrl]),quality:"medium",num_images:1};}}},
  {id:"xai/grok-imagine-image",label:"Grok Imagine",
   // fal schema (verified 2026-08-10): lowercase "1k", aspect_ratio enum includes 4:3 AND the
   // portrait override's 3:4. Response is the standard fal images[].url shape.
   // #210 (2026-08-21): Grok Imagine 2.0 exists at the vendor (arena #3 T2I) but is NOT on fal —
   // both plausible ids 404-probed live — so v1 remains the latest fal-callable version.
   body:function(p){return {prompt:p,aspect_ratio:"4:3",resolution:"1k",num_images:1};},
   // Edit API composites reference images like Nano (image_urls, plural) but caps at THREE
   // references — PARTY_MAX is 4, so a full-party render seeds the player + first two
   // companions; unsliced it would 422 on every full-party scene. Edit-style: no strength
   // knob (the #42 slider hides). #165: multiSeed — doRender gathers the party for this entry
   // (it did NOT before v1.593: the seed collection was hardcoded isNano, so Grok's 3-ref
   // capability went unused despite the #162 body-slice tests).
   // #166: maxSeeds=3 is COLLECTION data (collectRenderSeeds caps there so the reference
   // legend matches what is actually sent); the body's slice stays as a defensive backstop.
   // ⚠ Field note 2026-08-11: the edit endpoint ACCEPTED aspect_ratio:"4:3" (no 422) but the
   // output followed the 3:4 reference portraits' ratio anyway — Grok edit treats the field
   // as soft when references dominate. Nano honors 4:3; use it when the frame matters.
   img2img:{endpoint:"xai/grok-imagine-image/edit",multiSeed:true,maxSeeds:3,
            body:function(p,imgUrl){return {prompt:p,image_urls:(Array.isArray(imgUrl)?imgUrl.slice(0,3):[imgUrl]),aspect_ratio:"4:3",resolution:"1k",num_images:1};}}},
  /* #210: Seedream 5 Pro — the latest Seedream on fal (NOTE: the newest partner models drop the
     fal-ai/ prefix — the prefixed id 404s). $0.0675/img ≤1536², $0.135 to 2048²; edit takes up
     to 10 refs (first input free, +$0.0045/additional). Schema probe-verified 2026-08-21: both
     endpoints take image_size presets incl. landscape_4_3/portrait_4_3 (portrait-override
     compatible). Known five-way caveat rides its 4.5 sibling: mixing-heavy on group scenes —
     listed at the owner's request; the #209 levers + text-only party policy are the mitigations. */
  {id:"bytedance/seedream/v5/pro/text-to-image",label:"Seedream 5 Pro",
   body:function(p){return {prompt:p,image_size:"landscape_4_3",num_images:1};},
   img2img:{endpoint:"bytedance/seedream/v5/pro/edit",multiSeed:true,
            body:function(p,imgUrl){return {prompt:p,image_urls:(Array.isArray(imgUrl)?imgUrl:[imgUrl]),image_size:"landscape_4_3",num_images:1};}}},
  {id:"fal-ai/qwen-image-2512",label:"Qwen Image 2512",
   body:function(p){return {prompt:p,image_size:"landscape_4_3",num_inference_steps:28,guidance_scale:4,num_images:1};},
   img2img:{endpoint:"fal-ai/qwen-image-edit/image-to-image",strength:0.9,
            // qwen-image-edit is edit-style: it preserves the input image unless strength is high.
            // At 0.6 it returned near-copies of the portrait instead of the scene prompt.
            // Single-image denoise: array seed collapses to the first (player) — Nano-only multi-image.
            body:function(p,imgUrl,s){return {prompt:p,image_url:(Array.isArray(imgUrl)?imgUrl[0]:imgUrl),strength:s,num_inference_steps:30,guidance_scale:4,num_images:1};}}}
];
var renderModel="fal-ai/nano-banana-2";/* #208a: the five-way champion is the shipped default */
var renderStrength={}; // per-model img2img strength overrides {modelId:0.2-0.95} (#42); persisted under RENDER_STR_K
// (UA1 closed v1.261: TAG_SHADOW / TAG_AUTHORITY deleted with the legacy parser — the tag table
// is the only parser; rollback of the deletion itself is `git revert`, not a flag.)
var panelCol=false,secCol={quest:false,inv:false,ab:false,sp:false};
var _qaSuppressUntil=0; // brief window after a long-press fires, to swallow the trailing click on an action button
var activeChatTab="narrative";
// Blank wizard-state factory (audit #16): the SINGLE source for a fresh `cs`. The boot literal
// here and ui.js showChar()'s reset copy had already diverged (showChar's carried mark:"" +
// portraitOffset:null, this one didn't — so a fresh boot lacked both until the first showChar).
// Union shape is canonical; returns a NEW object each call (bs is fresh too — no shared refs).
function blankWizardState(){
  return {tone:null,author:"",name:"",gender:"M",age:"early twenties",appear:"",mark:"",backstory:"",ancestry:null,fp:[],subrace:null,heritageVariant:null,cls:null,statMode:"roll",bs:{STR:8,DEX:8,CON:8,INT:8,WIS:8,CHA:8},rolled:false,deityEdited:false,portrait:null,portraitOffset:null,step:1};
}
var cs=blankWizardState();
var rvGold=20;var rvGoldRolled=false;
var pendingChar=null,pendingTone="",pendingVoice="",pendingAuthor="",pendingLoc="",pendingBumps=0,currentBump=0;
// Perk-flow (creation level>=3) undo state (audit E2): a snapshot of the character taken when the
// archetype/bump flow is entered, so Back navigation can revert cleanly instead of double-applying.
var pendingPerkBase=null; // {stats:{...}, abilLen:N} captured before the first archetype pick
var _cbApplied=[];        // picks confirmed per creation stat-bump, so Back can revert the last one
var pendingSpellPool={};
var pendingCompanions=[];
var pendingImportChar=null;
var pendingBlueprint=null; // loaded .campaign blueprint; consumed by startGame
var pendingRacialBonus={}; // {cantrips:N, "1":N, ...} — extra picks granted by racial spells
var adultMode=false;
var proseAuthor=""; // selected prose-inspiration author id ("" = house default); see AUTHORS in data.js
var PARTY_MAX=4;    // total party cap = players + companions. Companion cap = PARTY_MAX - playerCount (1 today; multiplayer #1 will subtract the real count)
var allowModelUpgrade=true;
var legacyCharsOn=false;
var legacyChancePct=5;
var legacyLibCache=null;   // cached Character Library list (legacy candidates); fetched async, rolled against synchronously
var legacyLibLoading=false;
var _sbPicks=[]; // stat-bump modal picks (was window._sbPicks — F-11)
