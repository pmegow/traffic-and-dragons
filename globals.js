var API="https://api.anthropic.com/v1/messages";
var MDL="claude-sonnet-4-6";
// ── LLM provider adapters ─────────────────────────────────────────────────────
// Each provider is a self-contained object: callGM() picks the active one and
// calls headers/buildBody/parseResponse. NO if(provider===...) branches anywhere
// else. This same shape becomes the server-side routing table under subscription.
var PROVIDERS={
  anthropic:{
    id:"anthropic", label:"Claude (Anthropic)", keyHint:"sk-ant-...",
    endpoint:"https://api.anthropic.com/v1/messages",
    defaultModel:MDL,
    models:["claude-opus-4-8","claude-sonnet-4-6","claude-haiku-4-5-20251001"],
    headers:function(key){return {"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"};},
    buildBody:function(msgs,sys,maxTok,model){return {model:model,max_tokens:maxTok,system:sys,messages:msgs};},
    parseResponse:function(data){if(!data.content||!data.content[0]||!data.content[0].text)throw new Error("Empty response");return data.content[0].text;}
  },
  openai:{
    id:"openai", label:"ChatGPT (OpenAI)", keyHint:"sk-...",
    endpoint:"https://api.openai.com/v1/chat/completions",
    defaultModel:"gpt-4o",
    models:["gpt-4o","gpt-4o-mini","gpt-4.1"],
    // OpenAI carries the system prompt as the first message, uses Bearer auth,
    // and returns choices[0].message.content. max_tokens works for gpt-4o.
    headers:function(key){return {"Content-Type":"application/json","Authorization":"Bearer "+key};},
    buildBody:function(msgs,sys,maxTok,model){return {model:model,max_tokens:maxTok,messages:[{role:"system",content:sys}].concat(msgs)};},
    parseResponse:function(data){if(!data.choices||!data.choices[0]||!data.choices[0].message||typeof data.choices[0].message.content!=="string")throw new Error("Empty response");return data.choices[0].message.content;},
    // Per-provider system-prompt reinforcement. Claude honors the tag contract from
    // the base prompt; gpt-4o treats the tags as optional and narrates changes without
    // emitting them, so the sheet silently desyncs. callGM() appends this for gameplay
    // turns only (not summarize). This is exactly the kind of per-provider tuning the
    // abstraction is for — it transfers to the server-side routing table verbatim.
    reinforce:"\n\n=== MANDATORY TAG DISCIPLINE — the engine reads these brackets, NOT your prose ===\nEvery mechanical change you narrate MUST include its state tag in the SAME response, or the engine will not apply it and the player's sheet silently desyncs. If the prose says it happened, the tag MUST be present.\n- Money changes hands -> [GOLD:-5] or [GOLD:+10] (signed integer only)\n- Damage or healing -> [HP:-8] or [HP:+5]\n- Item bought / found / given / taken / lost -> [ITEM_GAINED:name] or [ITEM_LOST:name]\n- A named NPC appears or is interacted with -> [NPC:name|status|relation]\n- Travel to a new place -> [LOCATION:name]\n- XP earned -> [XP:25]\n- Quest offered / accepted / advanced / finished -> [QUEST:title|offered|desc] / [QUEST:title|active] / [QUEST_STEP:title|objective|true] / [QUEST:title|completed]\nExample: paying 5 gold for a room MUST contain [GOLD:-5]. Never narrate spending or earning gold without the matching [GOLD:] tag. Tags are invisible to the player; emit them inline, never announce them.\n"
  }
};
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
var panelCol=false,secCol={inv:false,ab:false,sp:false};
var activeChatTab="narrative";
var cs={tone:null,name:"",gender:"M",age:"early twenties",appear:"",mark:"",backstory:"",ancestry:null,fp:[],subrace:null,heritageVariant:null,cls:null,statMode:"roll",bs:{STR:8,DEX:8,CON:8,INT:8,WIS:8,CHA:8},rolled:false,deityEdited:false,step:1};
var rvGold=20;
var pendingChar=null,pendingTone="",pendingVoice="",pendingLoc="",pendingBumps=0,currentBump=0;
var pendingSpellPool={};
var pendingCompanions=[];
var pendingRacialBonus={}; // {cantrips:N, "1":N, ...} — extra picks granted by racial spells
var adultMode=false;
var legacyCharsOn=false;
var legacyChancePct=5;
var _sbPicks=[]; // stat-bump modal picks (was window._sbPicks — F-11)
