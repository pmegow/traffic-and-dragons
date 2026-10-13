// sabotage-621-portrait-vision.js — prove the #621 portrait-describer guards are not decorative.
// #621 (owner ruling 2026-10-12, the first outside beta tester): "Describe appearance from image"
// rides the GM transport — Gemini first, through the gateway for a signed-in player, on an own key
// otherwise, a Claude key as the BYOK fallback. Each mutation removes one load-bearing clause; the
// named test must turn red, and sabotage.js restores byte-identical source after every case.
var sabotage=require("./sabotage.js"),rc=0;
var ENGINE=["node",["dev/run-tests.js","#621"]];
var SUITE=["node",["dev/tests-621-portrait-vision.js"]];

rc|=sabotage.prove({file:"globals.js",command:ENGINE,cases:[
  {label:"the Gemini vision builder drops the image (a text placeholder rides where inlineData was)",
   mustFail:"#621 the vision builders",
   find:'parts:[{text:text},{inlineData:{mimeType:mime,data:b64}}]',
   replace:'parts:[{text:text},{text:"[image omitted]"}]'},
  {label:"the Claude vision builder leaves adaptive thinking on (the opus-5 empty-first-block class)",
   mustFail:"#621 the vision builders",
   find:'body.thinking={type:"disabled"};/* the same adaptive-thinking guard as buildBody */',
   replace:'/* no thinking guard */'}
]});

rc|=sabotage.prove({file:"api.js",command:ENGINE,cases:[
  {label:"the route order is flipped (Claude before Gemini)",
   mustFail:"#621 the route",
   find:'var PORTRAIT_VISION_ORDER=["gemini","anthropic"];',
   replace:'var PORTRAIT_VISION_ORDER=["anthropic","gemini"];'},
  {label:"an own vendor key rides the gateway request",
   mustFail:"#621 the route",
   find:'own=server?"":(((typeof providerKeys!=="undefined"&&providerKeys[id])||(activeProvider===id?apiKey:""))||"");',
   replace:'own=(((typeof providerKeys!=="undefined"&&providerKeys[id])||(activeProvider===id?apiKey:""))||"");'},
  {label:"the describer meters as a generic call instead of kind portrait",
   mustFail:"#621 describePortraitImage: the Claude-key gate is gone",
   find:'gmTransport(prov,model,r.key,"portrait",PORTRAIT_DESC_SYS)',
   replace:'gmTransport(prov,model,r.key,"other",PORTRAIT_DESC_SYS)'}
]});

rc|=sabotage.prove({file:"api.js",command:SUITE,cases:[
  {label:"a gateway 402/401 falls through to the vendor-error path (the source pin cannot see this — only the behaviour suite can)",
   mustFail:"a gateway 402 reads as the account message",
   find:'if(_tp.server&&(res.status===402||res.status===401)){var _sp=null;',
   replace:'if(false&&_tp.server&&(res.status===402||res.status===401)){var _sp=null;'},
  {label:"the request is sent to the vendor endpoint on the player's (empty) key instead of through gmTransport",
   mustFail:"the request lands on /api/llm/gemini/<model>",
   find:'var res=await _fetchTextDeadline(_tp.url,{method:"POST",headers:_tp.headers,body:JSON.stringify(body)}',
   replace:'var res=await _fetchTextDeadline(typeof prov.endpoint==="function"?prov.endpoint(model):prov.endpoint,{method:"POST",headers:prov.headers(r.key),body:JSON.stringify(body)}'},
  {label:"a null route sends anyway (the old blind path) instead of the honest sentence",
   mustFail:"no sign-in and no key is one honest sentence",
   find:'if(!r)throw new Error("Sign in, or add a Gemini or Claude key via File ▸ Settings ▸ Language Model.");',
   replace:'if(!r)r={prov:PROVIDERS.gemini,key:"",server:false,model:PROVIDERS.gemini.defaultModel};'}
]});

process.exit(rc);
