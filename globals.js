var MDL="claude-sonnet-4-6";
var SCENE_REF_ACTOR_CAP=10;     // #168 W2: accepted referents in one active scene. Overflow preserves them and makes irreversible identity writes fail closed.
var SCENE_REF_NEGATIVE_CAP=10;  // #168 W2: explicit/inference exclusions per active scene; same no-eviction rule as actors.
var SCENE_REF_SEALED_CAP=6;     // #168 W2: transitioned frames retained until a structured summary acknowledges them.
var CANON_TXN_CAP=24;           // #168 W2: bounded idempotency/quarantine receipts for death/quest/reward envelopes.
var CANON_TXN_RETIRE_TURNS=12;  // #168R3: committed receipts older than this retire on structured-summary success (quarantined receipts NEVER retire — poisoning is a contract); without retirement the cap permanently killed envelopes at receipt 24.
var IDENTITY_CONFLICT_CAP=8;    // #168 W2: unresolved referential conflicts surfaced back to the GM.
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
var MOOD_AUDIT_TURNS=12;    // v1.381: a party member's recorded MOOD older than this is due for a re-check (buildMoodAudit, api.js). Deliberately far shorter than REL_AUDIT_TURNS below: bonds shift on a ~100-turn scale, mood is scene-scale, and auditing a volatile field on a slow field's clock is what let "watchful, tense" sit pinned on Frizwick for an entire arc. ~12 turns ≈ one play session at the observed rate. An EMPTY mood is eligible immediately — no age wait — since a party member in every scene with no recorded mood is a gap now, not in 12 turns.
var MOOD_AUDIT_COOLDOWN=12; // v1.381: at most one mood audit per this many turns. Frequency is the real lever on churn — every audit invites re-emission, and re-emission is where vocabulary leaks enter, so a fast audit would keep rolling the corruption dice on characters that were fine.
var REL_AUDIT_TURNS=40;          // #61: at most one relationship audit per this many turns (buildRelationshipAudit, api.js) — bonds shift on a ~100-turn scale in the wild (t455/t472 Runelords), so 40 re-grounds without nagging; a party join/leave pulls the audit forward via worldState.relAuditDue
var CONSUMABLE_RE=/\b(potion|elixir|draught|tonic|salve|poultice|scroll|charge|bomb|grenade|flask|vial|phial|dose|ration|torch|dust|powder|oil)s?\b/i; // #60: item base-names that read as per-use consumables even without an " xN" stack (a counted stack qualifies regardless). Deliberately EXCLUDES arrow/bolt — ammo is caught by the xN path when stacked, and per-shot nagging of unstacked ammo would be noise
var SPLIT_AUDIT_TURNS=10;   // #133 (t1431/B21 stale-split finding): a charSheet.splitLoc older than this (or LEGACY-unstamped — infinitely old, the #46 precedent) gets the buildSplitAudit neutral-fork note (rejoin or re-affirm); doubles as the per-member re-fire cooldown. Only [PARTY_SPLIT:] tags resolve it — the record never commands the story
var PRESENCE_AUDIT_TURNS=12; // #137 (t1467 phantom-presence finding): every N turns the PRESENCE CHECK note asks the GM to confirm each WITH-party member is physically in the scene or emit [PARTY_SPLIT:] — the inverse of buildSplitAudit (which can only police records that EXIST). Deterministic: catches the Morwen class the stay-behind verb-watcher cannot
var TAG_LOG_CAP=40;
var RETCON_PIN_SHELF=15;    // #147 (drift pass order 4): turns a CORRECTION IN FORCE pin survives un-filed before it archives LOUDLY — bounded so a stuck pin can never become permanent prompt noise (the one-shot-shelf discipline); a completed summarize extraction archives it earlier
var DEITY_DRIFT_COOLDOWN=25;
var RECONCILE_SKIP_MIN=360; // #142: a clock reconcile that crosses DAWN and exceeds this is presumed a mislabel (skip-and-demand), never a timeskip — one word cost 19h at t1524 // #140③: at most one deity-drift nudge per character per this many turns — a god's displeasure is an arc, not a nag          // #137 provenance ring: recent per-response tag names + mutation labels kept ON THE SAVE (worldState.tagLog) so the next field forensics can decide emitted-then-purged vs never-emitted — the fork the t1467 investigation could not close
var LOC_DESC_NUDGE_COOLDOWN=10; // #134 (t1431 multiplying-beds): while the party's current node has NO [LOCATION_DESC:] on file, buildLocationDescNudge re-demands one this often — re-fire, not one-shot (the #29 rot lesson); a filed description ends it permanently
var PROVISIONAL_CAP=4;          // #156 Phase A: max OUTSTANDING provisional npc records (the create-distinct collision outcome). Beyond it a suspect write degrades LOUDLY to today's direct-write behavior — the guard may never be worse than the status quo it replaces (runaway-model bound, the pendingItemDefs precedent)
var PROVISIONAL_NUDGE_COOLDOWN=5; // #156 Phase A: buildProvisionalNudge re-fires per unresolved provisional this often — re-fire, not one-shot (an unresolved provisional is live fragmentation; the #29/#134 rot lesson), latch on worldState.provisionalNudged
var NPC_INTRO_REL_RE=/(unknown|stranger|unfamiliar|just met|newly met|not yet met|new arrival)/i; // #156 Phase A: an [NPC:] relation slot that reads as an INTRODUCTION — into a history-rich record, that is the Savah collision signature (t1530: "unknown, not yet met" written into the armorer's file). Tested against the RAW rel operand only
var PHASE_MISMATCH_MIN=240;  // #158: minutes of BAND distance between a narrated phase assertion and the clock before the GM-decides reconcile nudge arms (clockPhaseDetect, clock.js). 4h swallows honest estimation slop and adjacent-phase wording; the t1605 class (dusk narrated at 11:10 am = 7h+) clears it with room
var LOC_STATE_CAP=3;        // #105 (B17): max durable state-change notes per map node — the record COMPRESSES (newest state is the truest state); overflow evicts the oldest loudly. Small on purpose: every note rides the volatile prompt every turn via the geo block or the changed-locations roll-up
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
var TAG_REINFORCE="\n\n=== MANDATORY TAG DISCIPLINE — the engine reads these brackets, NOT your prose ===\nEvery mechanical change you narrate MUST include its state tag in the SAME response, or the engine will not apply it and the player's sheet silently desyncs. If the prose says it happened, the tag MUST be present.\n- Money changes hands -> [GOLD:-5] or [GOLD:+10] (signed integer only)\n- Damage or healing -> [HP:-8] or [HP:+5]\n- Item bought / found / given / taken / lost -> [ITEM_GAINED:name] or [ITEM_LOST:name]\n- A named NPC appears or is interacted with -> [NPC:name|status|relation]\n- Travel to a new place -> [LOCATION:name]\n- XP earned -> [XP:25]\n- Quest offered / accepted / advanced / finished -> [QUEST:title|offered|desc] / [QUEST:title|active] / [QUEST_STEP:title|objective|true] / [QUEST:title|completed]\n- An NPC joins / leaves the party -> [PARTY_MEMBER:name|true] / [PARTY_MEMBER:name|false]\n- Campaign arc completed -> [ARC_COMPLETE:arc title]; act's turning point reached -> [ACT_COMPLETE:act title]\n- Do NOT end your response with suggested actions, a 'You could...' line, or an [ACTIONS:] tag — action suggestions are generated separately by the engine.\nExample: paying 5 gold for a room MUST contain [GOLD:-5]. Never narrate spending or earning gold without the matching [GOLD:] tag. Tags are invisible to the player; emit them inline, never announce them.\n";
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
  // ⚠ Sonnet 5 is INTRO pricing ($2/$10) through 2026-08-31 — sticker is $3/$15. UPDATE this
  // entry on Sep 1, 2026 or cost telemetry silently undercounts by 33%. Note its new tokenizer
  // bills ~30% more tokens for the same text, so per-TURN cost ≈ 0.87× of 4.6 during intro,
  // ≈1.3× after (see TODO #30 row).
  "claude-sonnet-5":  {in:2.00, out:10.00, cacheWrite:2.50, cacheRead:0.20},
  "claude-sonnet-4-6":{in:3.00, out:15.00, cacheWrite:3.75, cacheRead:0.30},
  "claude-haiku-4-5": {in:1.00, out:5.00,  cacheWrite:1.25, cacheRead:0.10}
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
    upgradeModel:"claude-sonnet-4-6",
    models:["claude-opus-4-8","claude-sonnet-5","claude-sonnet-4-6","claude-haiku-4-5-20251001"],
    headers:function(key){return {"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"};},
    // {stable, volatile} → two system blocks with a cache_control breakpoint after the stable
    // one: the stable prefix re-reads at 0.1x input price on every turn (writes at 1.25x, 5min
    // TTL — warm during active play). Plain-string sys (summarize/actions/skeleton overrides)
    // stays a single uncached block. Min cacheable prefix on Sonnet 4.6 is 2048 tokens — the
    // stable block clears it (enforced by an engine test); verify live via usage.cache_read_input_tokens.
    buildBody:function(msgs,sys,maxTok,model){
      var body={model:model,max_tokens:maxTok,messages:msgs};
      // Sonnet 5 runs ADAPTIVE THINKING when `thinking` is omitted (4.6 ran thinking-off) —
      // unguarded, every GM turn would bill thinking as output tokens AND eat into maxTok=1000
      // (truncated narration mid-scene). Explicit disabled preserves the 4.6-equivalent turn
      // shape. Sonnet-5-only: 4.6 doesn't need it, and Fable-tier models would 400 on it.
      if(model.indexOf("claude-sonnet-5")===0)body.thinking={type:"disabled"};
      if(typeof sys==="string")body.system=sys;
      else body.system=[{type:"text",text:sys.stable,cache_control:{type:"ephemeral"}},{type:"text",text:sys.volatile}];
      return body;
    },
    parseResponse:function(data){if(!data.content||!data.content[0]||!data.content[0].text)throw new Error("Empty response");return data.content[0].text;},
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
    defaultModel:"gpt-4o",
    upgradeModel:"gpt-4o",
    models:["gpt-4o","gpt-4o-mini","gpt-4.1"],
    // OpenAI carries the system prompt as the first message, uses Bearer auth,
    // and returns choices[0].message.content. max_tokens works for gpt-4o.
    headers:function(key){return {"Content-Type":"application/json","Authorization":"Bearer "+key};},
    buildBody:function(msgs,sys,maxTok,model){return {model:model,max_tokens:maxTok,messages:[{role:"system",content:sysJoin(sys)}].concat(msgs)};},
    parseResponse:function(data){if(!data.choices||!data.choices[0]||!data.choices[0].message||typeof data.choices[0].message.content!=="string")throw new Error("Empty response");return data.choices[0].message.content;},
    parseUsage:OPENAI_USAGE,
    parseFinish:OPENAI_FINISH,
    reinforce:TAG_REINFORCE
  },
  grok:{
    // xAI is OpenAI-compatible — same body/response shape, different endpoint + key.
    id:"grok", label:"Grok (xAI)", keyHint:"xai-...",
    endpoint:"https://api.x.ai/v1/chat/completions",
    defaultModel:"grok-4.3", // current xAI flagship (June 2026); old grok-2-*/grok-beta IDs are retired and 400
    upgradeModel:"grok-4.3",
    models:["grok-4.3","grok-4","grok-3","grok-3-mini","grok-code-fast-1"],
    headers:function(key){return {"Content-Type":"application/json","Authorization":"Bearer "+key};},
    buildBody:function(msgs,sys,maxTok,model){return {model:model,max_tokens:maxTok,messages:[{role:"system",content:sysJoin(sys)}].concat(msgs)};},
    parseResponse:function(data){if(!data.choices||!data.choices[0]||!data.choices[0].message||typeof data.choices[0].message.content!=="string")throw new Error("Empty response");return data.choices[0].message.content;},
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
    defaultModel:"gemini-3.5-flash", // current stable flagship (June 2026); gemini-1.5-*/2.0-flash are retired and 404
    upgradeModel:"gemini-2.5-pro",
    models:["gemini-3.5-flash","gemini-2.5-pro","gemini-2.5-flash","gemini-2.5-flash-lite"],
    headers:function(key){return {"Content-Type":"application/json","x-goog-api-key":key};},
    buildBody:function(msgs,sys,maxTok,model){var contents=[],i;for(i=0;i<msgs.length;i++){contents.push({role:msgs[i].role==="assistant"?"model":"user",parts:[{text:msgs[i].content}]});}var gc={};if(maxTok)gc.maxOutputTokens=maxTok;return {systemInstruction:{parts:[{text:sysJoin(sys)}]},contents:contents,generationConfig:gc};},
    parseResponse:function(data){if(!data.candidates||!data.candidates[0]||!data.candidates[0].content||!data.candidates[0].content.parts||!data.candidates[0].content.parts[0]||typeof data.candidates[0].content.parts[0].text!=="string")throw new Error("Empty response");return data.candidates[0].content.parts[0].text;},
    parseUsage:function(data){var u=data.usageMetadata;if(!u)return null;return {in:u.promptTokenCount||0,out:u.candidatesTokenCount||0,cacheRead:u.cachedContentTokenCount||0,cacheWrite:0};},
    parseFinish:function(data){var c=data.candidates&&data.candidates[0];return (c&&c.finishReason==="MAX_TOKENS")?"MAX_TOKENS":null;},
    reinforce:TAG_REINFORCE,
    tokScale:4 // generous ceiling (maxTok*4 ≈ 4k-8k), NOT sky-high: the old x1000 sent maxOutputTokens=1,000,000+, which Gemini rejects with HTTP 400 on models capped well below that (audit E89). The prose voice still controls actual length.
  },
  ollama:{
    // Local OpenAI-compatible server. NOTE: http://localhost is blocked as mixed
    // content from an https origin (Netlify) and unreachable from file://; usable
    // only when the game is served from localhost. Exploration tier.
    id:"ollama", label:"Ollama (local)", keyHint:"(none needed)",
    endpoint:"http://localhost:11434/v1/chat/completions",
    defaultModel:"llama3.1:70b",
    upgradeModel:"llama3.1:70b",
    models:["llama3.1:70b","qwen2.5:72b","mixtral:8x22b"],
    headers:function(key){return {"Content-Type":"application/json","Authorization":"Bearer "+(key||"ollama")};},
    buildBody:function(msgs,sys,maxTok,model){return {model:model,max_tokens:maxTok,messages:[{role:"system",content:sysJoin(sys)}].concat(msgs)};},
    parseResponse:function(data){if(!data.choices||!data.choices[0]||!data.choices[0].message||typeof data.choices[0].message.content!=="string")throw new Error("Empty response");return data.choices[0].message.content;},
    parseUsage:OPENAI_USAGE,
    parseFinish:OPENAI_FINISH,
    reinforce:TAG_REINFORCE
  }
};
var carMode=false;
var APP_VERSION="v1.603";
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
  {id:"fal-ai/flux/dev",       label:"Flux [Dev]",
   body:function(p){return {prompt:p,image_size:"landscape_4_3",num_inference_steps:28,num_images:1};},
   // imgUrl may be a single data-URL OR an array of them (party render). Single-image denoise: takes
   // the first seed only (the player) — multi-portrait party seeding is Nano-only by design.
   img2img:{endpoint:"fal-ai/flux/dev/image-to-image",strength:0.6,
            body:function(p,imgUrl,s){return {prompt:p,image_url:(Array.isArray(imgUrl)?imgUrl[0]:imgUrl),strength:s,num_inference_steps:28,num_images:1};}}},
  {id:"fal-ai/flux-lora",      label:"Flux [Dev] HQ",
   // #163 outcome: the id the user supplied was a sandbox REQUEST id — no trained LoRA exists —
   // but the user's same-prompt A/B grid (2026-08-10, 3× flux/dev vs schnell vs flux-lora)
   // showed this endpoint WITHOUT any adapter consistently beats fal-ai/flux/dev, corroborated
   // by ~2× inference time (5.8-7.3s vs 1.6-4.4s) and $0.035 vs $0.025 at identical steps:
   // the LoRA host serves the full unaccelerated model, flux/dev an accelerated variant.
   // Same weights, better sampling — kept under an honest label. `loras` is deliberately
   // ABSENT (the A/B-validated config, absence test-pinned); a real trained style later
   // re-adds the v1.589 entry shape (loras:[{path:<weights URL>,scale:1}] in BOTH bodies).
   body:function(p){return {prompt:p,image_size:"landscape_4_3",num_inference_steps:28,guidance_scale:3.5,num_images:1};},
   img2img:{endpoint:"fal-ai/flux-lora/image-to-image",strength:0.6,
            body:function(p,imgUrl,s){return {prompt:p,image_url:(Array.isArray(imgUrl)?imgUrl[0]:imgUrl),strength:s,num_inference_steps:28,guidance_scale:3.5,num_images:1};}}},
  {id:"fal-ai/nano-banana-2",  label:"Nano Banana 2",
   body:function(p){return {prompt:p,aspect_ratio:"4:3",resolution:"1K",num_images:1};},
   // Edit API composites MULTIPLE reference images — image_urls accepts the whole party portrait set
   // (player first) for a group render; a lone data-URL is wrapped so single-subject renders still work.
   // #165: multiSeed marks a compositor img2img — doRender gathers COMPANION portraits only for
   // entries that declare it (a table property, never an id check at the call site).
   img2img:{endpoint:"fal-ai/nano-banana-2/edit",multiSeed:true,
            body:function(p,imgUrl){return {prompt:p,image_urls:(Array.isArray(imgUrl)?imgUrl:[imgUrl]),aspect_ratio:"4:3",resolution:"1K",num_images:1};}}},
  {id:"xai/grok-imagine-image",label:"Grok Imagine",
   // fal schema (verified 2026-08-10): lowercase "1k", aspect_ratio enum includes 4:3 AND the
   // portrait override's 3:4. Response is the standard fal images[].url shape.
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
  {id:"fal-ai/qwen-image-2512",label:"Qwen Image 2512",
   body:function(p){return {prompt:p,image_size:"landscape_4_3",num_inference_steps:28,guidance_scale:4,num_images:1};},
   img2img:{endpoint:"fal-ai/qwen-image-edit/image-to-image",strength:0.9,
            // qwen-image-edit is edit-style: it preserves the input image unless strength is high.
            // At 0.6 it returned near-copies of the portrait instead of the scene prompt.
            // Single-image denoise: array seed collapses to the first (player) — Nano-only multi-image.
            body:function(p,imgUrl,s){return {prompt:p,image_url:(Array.isArray(imgUrl)?imgUrl[0]:imgUrl),strength:s,num_inference_steps:30,guidance_scale:4,num_images:1};}}}
];
var renderModel="fal-ai/flux/dev";
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
