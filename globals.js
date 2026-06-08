var API="https://api.anthropic.com/v1/messages";
var MDL="claude-sonnet-4-6";
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
            body:function(p,imgUrl){return {prompt:p,image_url:imgUrl,strength:0.6,num_inference_steps:30,guidance_scale:4,num_images:1};}}}
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
