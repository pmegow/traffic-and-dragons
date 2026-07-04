var MDL="claude-sonnet-4-6";
var SUMMARIZE_AT=1200; // session-token threshold: summarize() gate, sendAction trigger, membar colors (amber at 80%)
// ── LLM provider adapters ─────────────────────────────────────────────────────
// Each provider is a self-contained object: callGM() picks the active one and
// calls headers/buildBody/parseResponse. NO if(provider===...) branches anywhere
// else. This same shape becomes the server-side routing table under subscription.
// Shared tag-discipline reinforcement for every non-Claude provider. Claude honors the
// tag contract from the base prompt; other models treat the tags as optional and narrate
// changes without emitting them, silently desyncing the sheet. callGM() appends this for
// gameplay turns only (not summarize). Per-provider tuning the abstraction exists for.
var TAG_REINFORCE="\n\n=== MANDATORY TAG DISCIPLINE — the engine reads these brackets, NOT your prose ===\nEvery mechanical change you narrate MUST include its state tag in the SAME response, or the engine will not apply it and the player's sheet silently desyncs. If the prose says it happened, the tag MUST be present.\n- Money changes hands -> [GOLD:-5] or [GOLD:+10] (signed integer only)\n- Damage or healing -> [HP:-8] or [HP:+5]\n- Item bought / found / given / taken / lost -> [ITEM_GAINED:name] or [ITEM_LOST:name]\n- A named NPC appears or is interacted with -> [NPC:name|status|relation]\n- Travel to a new place -> [LOCATION:name]\n- XP earned -> [XP:25]\n- Quest offered / accepted / advanced / finished -> [QUEST:title|offered|desc] / [QUEST:title|active] / [QUEST_STEP:title|objective|true] / [QUEST:title|completed]\n- An NPC joins / leaves the party -> [PARTY_MEMBER:name|true] / [PARTY_MEMBER:name|false]\n- Campaign arc completed -> [ARC_COMPLETE:arc title]; act's turning point reached -> [ACT_COMPLETE:act title]\n- Do NOT end your response with suggested actions, a 'You could...' line, or an [ACTIONS:] tag — action suggestions are generated separately by the engine.\nExample: paying 5 gold for a room MUST contain [GOLD:-5]. Never narrate spending or earning gold without the matching [GOLD:] tag. Tags are invisible to the player; emit them inline, never announce them.\n";
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
    // Anthropic: input_tokens EXCLUDES cached tokens; cache fields are 0 until prompt caching (#11) lands
    parseUsage:function(data){var u=data.usage;if(!u)return null;return {in:u.input_tokens||0,out:u.output_tokens||0,cacheRead:u.cache_read_input_tokens||0,cacheWrite:u.cache_creation_input_tokens||0};}
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
    tokScale:1000 // ceiling not target; Gemini's default is too low, so set it sky-high and let the prose voice control length
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
var APP_VERSION="v1.154";
var activeProvider="anthropic"; // id into PROVIDERS
var providerKeys={};            // {providerId: apiKey}
var providerModels={};          // {providerId: modelOverride} — falls back to defaultModel
var customRules=[];
var apiKey="",falKey="",busy=false,lastAction=null;
var RENDER_MODELS=[
  {id:"fal-ai/flux/dev",       label:"Flux [Dev]",
   body:function(p){return {prompt:p,image_size:"landscape_4_3",num_inference_steps:28,num_images:1};},
   img2img:{endpoint:"fal-ai/flux/dev/image-to-image",
            body:function(p,imgUrl){return {prompt:p,image_url:imgUrl,strength:0.6,num_inference_steps:28,num_images:1};}}},
  {id:"fal-ai/nano-banana-2",  label:"Nano Banana 2",
   body:function(p){return {prompt:p,aspect_ratio:"4:3",resolution:"1K",num_images:1};},
   img2img:{endpoint:"fal-ai/nano-banana-2/edit",
            body:function(p,imgUrl){return {prompt:p,image_urls:[imgUrl],aspect_ratio:"4:3",resolution:"1K",num_images:1};}}},
  {id:"fal-ai/qwen-image-2512",label:"Qwen Image 2512",
   body:function(p){return {prompt:p,image_size:"landscape_4_3",num_inference_steps:28,guidance_scale:4,num_images:1};},
   img2img:{endpoint:"fal-ai/qwen-image-edit/image-to-image",
            // qwen-image-edit is edit-style: it preserves the input image unless strength is high.
            // At 0.6 it returned near-copies of the portrait instead of the scene prompt.
            body:function(p,imgUrl){return {prompt:p,image_url:imgUrl,strength:0.9,num_inference_steps:30,guidance_scale:4,num_images:1};}}}
];
var renderModel="fal-ai/flux/dev";
var panelCol=false,secCol={quest:false,inv:false,ab:false,sp:false};
var _qaSuppressUntil=0; // brief window after a long-press fires, to swallow the trailing click on an action button
var activeChatTab="narrative";
var cs={tone:null,author:"",name:"",gender:"M",age:"early twenties",appear:"",backstory:"",ancestry:null,fp:[],subrace:null,heritageVariant:null,cls:null,statMode:"roll",bs:{STR:8,DEX:8,CON:8,INT:8,WIS:8,CHA:8},rolled:false,deityEdited:false,portrait:null,step:1};
var rvGold=20;var rvGoldRolled=false;
var pendingChar=null,pendingTone="",pendingVoice="",pendingAuthor="",pendingLoc="",pendingBumps=0,currentBump=0;
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
