var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
 file:"blueprint-designer.html",command:["node",["dev/tests-blueprint-models.js"]],
 cases:[
  {label:"frontier model disappears",find:'models:["claude-fable-5-1"]',replace:'models:[]',mustFail:"frontier options appear for every accessible provider"},
  {label:"compatibility preparation bypassed",find:'return spec.models.indexOf(model)>=0?spec.prepare(body):body;',replace:'return body;',mustFail:"GPT frontier requests use completion tokens rather than rejected max_tokens"},
  {label:"designer mutates shared provider objects",find:'spec=DESIGNER_MODELS[id],copy=Object.assign({},base);',replace:'spec=DESIGNER_MODELS[id],copy=base;',mustFail:"game provider definitions and existing request bodies stay unchanged"},
  {label:"selection saved outside designer key",find:'var LLM_PICK_K="bpd_llm_v1";',replace:'var LLM_PICK_K="wrong_key";',mustFail:"selection persists only in the Designer and restores after reload"}
 ]
})?1:0);
