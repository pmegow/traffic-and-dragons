var MDL="claude-sonnet-4-6";
var SUMMARIZE_AT=2400; // session-token threshold: summarize() gate, sendAction trigger, membar colors (amber at 80%).
// Counts only UNEXTRACTED session tokens (past worldState.sessKept — see sessKeptStart, memory.js).
// Raised 1200→2400 with #28: 1200 was tuned in the 2-3-sentence-cap era; prose-voice GM turns run
// 1,300-3,100 chars, so 1200 fired every ~2 exchanges in mature campaigns (the amnesia cliff).
var FUTURE_EXPIRE_TURNS=40; // #29: unresolved futureEvents older than this are swept at summarize time
var ACT_TURN_BUDGET=100;    // #23/#43: soft per-act pacing target — buildSkeletonBlock nudges toward the act's turning point once the ACTIVE act has run longer than this (measured from worldState.actStartTurn)
var SUMMARY_KEEP_EX=3;     // #28: max exchanges retained in sessionLog after a summarize
var SUMMARY_KEEP_TOK=1600; // #28: token cap on that retained tail (newest exchange always kept).
var QUEST_ESCALATE_TURNS=3; // P3: an active quest all-objectives-done for this many turns triggers the engine-note escalation in sendAction (see buildQuestEscalation, api.js)
var CORE_MEMORY_CAP=25;     // #40: defining-moments list cap — generous, not infinite; overflow evicts to memory.archive with a loud warn (a full list means the triggers fire too easily, not that we need more storage)
var CONDITION_AUDIT_TURNS=12;    // #46 audit teeth: a party condition this many turns old (or unstamped/legacy) makes buildConditionAudit fire
var CONDITION_AUDIT_COOLDOWN=12; // #46: at most one condition audit per this many turns — a kept condition gets re-audited next window, not nagged every turn
var WEIGHTY_REL_RE=/(married|wed(ded)?|betrothed|lover|betray|sworn|oath|blood[- ]?(bound|brother|sister)|nemesis|widow|avenged)/i; // #40: relationship descriptors weighty enough to file as a defining moment
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
// NOTE: OpenAI's prompt_tokens INCLUDES cached tokens; Anthropic's input_tokens EXCLUDES them.
// We store each provider's raw semantics — the cost math only prices Anthropic models anyway.
var OPENAI_USAGE=function(data){var u=data.usage;if(!u)return null;return {in:u.prompt_tokens||0,out:u.completion_tokens||0,cacheRead:(u.prompt_tokens_details&&u.prompt_tokens_details.cached_tokens)||0,cacheWrite:0};};
// $/MTok — used by usageCost() (api.js) for the Dev Mode running-cost estimate (TODO #21).
// Anthropic rates verified 2026-07-02; cache write = 1.25x input (5min TTL), cache read = 0.1x input.
// Keyed by model-ID prefix so dated IDs (claude-haiku-4-5-20251001) still match.
var MODEL_PRICING={
  "claude-opus-4-8":  {in:5.00, out:25.00, cacheWrite:6.25, cacheRead:0.50},
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
    models:["claude-opus-4-8","claude-sonnet-4-6","claude-haiku-4-5-20251001"],
    headers:function(key){return {"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"};},
    // {stable, volatile} → two system blocks with a cache_control breakpoint after the stable
    // one: the stable prefix re-reads at 0.1x input price on every turn (writes at 1.25x, 5min
    // TTL — warm during active play). Plain-string sys (summarize/actions/skeleton overrides)
    // stays a single uncached block. Min cacheable prefix on Sonnet 4.6 is 2048 tokens — the
    // stable block clears it (enforced by an engine test); verify live via usage.cache_read_input_tokens.
    buildBody:function(msgs,sys,maxTok,model){
      var body={model:model,max_tokens:maxTok,messages:msgs};
      if(typeof sys==="string")body.system=sys;
      else body.system=[{type:"text",text:sys.stable,cache_control:{type:"ephemeral"}},{type:"text",text:sys.volatile}];
      return body;
    },
    parseResponse:function(data){if(!data.content||!data.content[0]||!data.content[0].text)throw new Error("Empty response");return data.content[0].text;},
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
    reinforce:TAG_REINFORCE
  }
};
var carMode=false;
var APP_VERSION="v1.263";
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
   img2img:{endpoint:"fal-ai/flux/dev/image-to-image",strength:0.6,
            body:function(p,imgUrl,s){return {prompt:p,image_url:imgUrl,strength:s,num_inference_steps:28,num_images:1};}}},
  {id:"fal-ai/nano-banana-2",  label:"Nano Banana 2",
   body:function(p){return {prompt:p,aspect_ratio:"4:3",resolution:"1K",num_images:1};},
   img2img:{endpoint:"fal-ai/nano-banana-2/edit",
            body:function(p,imgUrl){return {prompt:p,image_urls:[imgUrl],aspect_ratio:"4:3",resolution:"1K",num_images:1};}}},
  {id:"fal-ai/qwen-image-2512",label:"Qwen Image 2512",
   body:function(p){return {prompt:p,image_size:"landscape_4_3",num_inference_steps:28,guidance_scale:4,num_images:1};},
   img2img:{endpoint:"fal-ai/qwen-image-edit/image-to-image",strength:0.9,
            // qwen-image-edit is edit-style: it preserves the input image unless strength is high.
            // At 0.6 it returned near-copies of the portrait instead of the scene prompt.
            body:function(p,imgUrl,s){return {prompt:p,image_url:imgUrl,strength:s,num_inference_steps:30,guidance_scale:4,num_images:1};}}}
];
var renderModel="fal-ai/flux/dev";
var renderStrength={}; // per-model img2img strength overrides {modelId:0.2-0.95} (#42); persisted under RENDER_STR_K
// (UA1 closed v1.261: TAG_SHADOW / TAG_AUTHORITY deleted with the legacy parser — the tag table
// is the only parser; rollback of the deletion itself is `git revert`, not a flag.)
var panelCol=false,secCol={quest:false,inv:false,ab:false,sp:false};
var _qaSuppressUntil=0; // brief window after a long-press fires, to swallow the trailing click on an action button
var activeChatTab="narrative";
var cs={tone:null,author:"",name:"",gender:"M",age:"early twenties",appear:"",backstory:"",ancestry:null,fp:[],subrace:null,heritageVariant:null,cls:null,statMode:"roll",bs:{STR:8,DEX:8,CON:8,INT:8,WIS:8,CHA:8},rolled:false,deityEdited:false,portrait:null,step:1};
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
