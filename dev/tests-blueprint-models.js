// Exercise the real Designer picker and provider adapters, without credentials or network.
const fs=require("fs"),path=require("path"),vm=require("vm"),assert=require("assert/strict");
const root=path.join(__dirname,".."),html=fs.readFileSync(path.join(root,"blueprint-designer.html"),"utf8");
let pass=0,fail=0;
function test(name,fn){try{fn();pass++;console.log("PASS DESIGNER MODELS "+name);}catch(e){fail++;console.error("FAIL DESIGNER MODELS "+name+": "+e.message);}}
const saved={},listeners={};
const select={value:"",disabled:false,addEventListener:(n,f)=>listeners[n]=f};
Object.defineProperty(select,"innerHTML",{set(s){this.html=s;this.value=(s.match(/<option value='([^']*)'/)||[])[1]||"";}});
const c={console,document:{getElementById:()=>select},localStorage:{getItem:k=>saved[k]||null,setItem:(k,v)=>saved[k]=v},
 esc:s=>s,setStatus:()=>{},gmViaServer:()=>true};
vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,"globals.js"),"utf8"),c);
const original=c.PROVIDERS,originalModels=JSON.stringify(Object.values(original).map(p=>p.models));
const start=html.indexOf('var LLM_PICK_K='),end=html.indexOf('// Compact story context',start);
assert(start>=0&&end>start);vm.runInContext(html.slice(start,end),c);
const frontier={anthropic:["claude-fable-5-1"],openai:["gpt-6-astra"],gemini:["gemini-3.8-flash"]};
test("frontier options appear for every accessible provider",()=>{const choices=c.llmChoices();assert.equal(choices.length,3,"Exactly three authoring models");for(const [p,models] of Object.entries(frontier))for(const m of models)assert(choices.some(x=>x.provider===p&&x.model===m),"Missing "+m);});
test("game provider definitions and existing request bodies stay unchanged",()=>{assert.equal(JSON.stringify(Object.values(original).map(p=>p.models)),originalModels);for(const p of Object.keys(original)){const m=original[p].defaultModel;assert.equal(JSON.stringify(c.PROVIDERS[p].buildBody([], "test",4000,m)),JSON.stringify(original[p].buildBody([],"test",4000,m)));}});
test("Claude frontier requests allow adaptive thinking and reserve output headroom",()=>{for(const m of frontier.anthropic){const b=c.PROVIDERS.anthropic.buildBody([],"test",500,m);assert.equal(b.thinking.type,"adaptive");assert(b.max_tokens>=8192);assert.equal(b.model,m);}});
test("GPT frontier requests use completion tokens rather than rejected max_tokens",()=>{for(const m of frontier.openai){const b=c.PROVIDERS.openai.buildBody([],"test",2000,m);assert.equal(b.max_tokens,undefined);assert(b.max_completion_tokens>=8192);assert.equal(b.reasoning_effort,"low");assert.equal(b.model,m);}});
test("Gemini frontier requests retain generateContent and low thinking",()=>{for(const m of frontier.gemini){assert(c.PROVIDERS.gemini.endpoint(m).includes(m+":generateContent"));assert.equal(c.PROVIDERS.gemini.buildBody([],"test",4000,m).generationConfig.thinkingConfig.thinkingLevel,"low");}});
test("key filtering excludes gameplay custom models",()=>{c.gmViaServer=()=>false;c.providerKeys={openai:"fixture"};c.apiKey="";c.providerModels={openai:"custom-game-model"};const choices=c.llmChoices();assert.equal(choices.length,1);assert(choices.every(x=>x.provider==="openai"));assert.equal(choices.filter(x=>x.model==="gpt-6-astra").length,1);c.providerKeys={};assert.equal(c.llmChoices().length,0);});
test("selection persists only in the Designer and restores after reload",()=>{c.gmViaServer=()=>true;c.activeProvider="openai";c.providerModels={openai:"gpt-5.6-sol"};c.wireLlmSelect();select.value="anthropic|claude-fable-5-1";listeners.change();assert.equal(c.designerModel(),"claude-fable-5-1");assert.equal(c.activeProvider,"anthropic");assert.deepEqual(Object.keys(saved),["bpd_llm_v1"]);assert.equal(c.providerModels.openai,"gpt-5.6-sol");c.wireLlmSelect();assert.equal(select.value,"anthropic|claude-fable-5-1");});
test("retired saved choice resolves to the current provider frontier model",()=>{saved.bpd_llm_v1="openai|gpt-6.1-sol";c.activeProvider="openai";c.providerModels.openai="custom-game-model";c.wireLlmSelect();assert.equal(select.value,"openai|gpt-6-astra");});
console.log("DESIGNER MODELS: "+pass+" passed, "+fail+" failed");process.exitCode=fail?1:0;
