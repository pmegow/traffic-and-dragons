// sabotage-780-thinking.js — prove the #780 thinking-level guards are not decorative.
// #780 (owner 2026-11-24): the Language Model chooser offers a thinking level where the provider
// declares levels (Gemini: low, medium, high). The choice rides the GM story turn only; every other
// call kind keeps the #22 low pin, and a level the provider does not offer is never sent or kept.
// Each mutation removes one load-bearing clause; the named engine test must turn red, and
// sabotage.js restores byte-identical source after every case.
var sabotage=require("./sabotage.js"),rc=0;
var CMD=["node",["dev/run-tests.js","prompt caching split"]];
var TURN="#780 gemini thinking: the chosen level rides the story turn only";

rc|=sabotage.prove({file:"globals.js",command:CMD,cases:[
  {label:"#780 the kind gate dropped — every small utility ask thinks at the chosen level (the #198 starvation class)",
   mustFail:TURN,
   find:"  if((prov.thinkingKinds||[]).indexOf(kind)<0||prov.thinkingLevels.indexOf(chosen)<0)return prov.defaultThinking;",
   replace:"  if(prov.thinkingLevels.indexOf(chosen)<0)return prov.defaultThinking;"},
  {label:"#780 the offered-level check dropped — a level the model refuses with HTTP 400 is sent on every turn",
   mustFail:TURN,
   find:"  if((prov.thinkingKinds||[]).indexOf(kind)<0||prov.thinkingLevels.indexOf(chosen)<0)return prov.defaultThinking;",
   replace:"  if((prov.thinkingKinds||[]).indexOf(kind)<0||!chosen)return prov.defaultThinking;"},
  {label:"#780 the body pinned back to a literal — the chooser saves a level nothing sends",
   mustFail:TURN,
   find:"var gc={thinkingConfig:{thinkingLevel:thinkingLevelFor(PROVIDERS.gemini,kind)}};",
   replace:"var gc={thinkingConfig:{thinkingLevel:\"low\"}};"},
  {label:"#780 the chooser lists one level only — medium and high cannot be picked",
   mustFail:"#780 the model chooser lists one row per offered thinking level",
   find:"    for(j=0;j<L.length;j++)rows.push({value:prov.models[i]+\"|\"+L[j],",
   replace:"    for(j=0;j<1;j++)rows.push({value:prov.models[i]+\"|\"+L[j],"},
  {label:"#780 the session bar label dropped — nothing on screen says which level is in play",
   mustFail:"#780 the session bar names the level in play",
   find:"return l?\" (\"+l+\")\":\"\";}",
   replace:"return \"\";}"}
]});

rc|=sabotage.prove({file:"api.js",command:CMD,cases:[
  {label:"#780 the first build drops the kind — the chosen level never reaches a turn",
   mustFail:"#780 callGM hands its call kind to every buildBody it calls",
   find:"  var body=prov.buildBody(msgs,sys,_tok,model,_kind);",
   replace:"  var body=prov.buildBody(msgs,sys,_tok,model);"},
  {label:"#780 the fallback rung's rebuild drops the kind — a storm turn silently runs at low",
   mustFail:"#780 callGM hands its call kind to every buildBody it calls",
   find:"        body=prov.buildBody(msgs,sys,_tok,model,_kind);",
   replace:"        body=prov.buildBody(msgs,sys,_tok,model);"}
]});

rc|=sabotage.prove({file:"state.js",command:CMD,cases:[
  {label:"#780 the load keeps any stored level — the chooser and the session bar show a level that is never sent",
   mustFail:"#780 a stored thinking level is kept across a load",
   find:"      if(pv&&pv.thinkingLevels&&pv.thinkingLevels.indexOf(lv)>=0)continue;",
   replace:"      if(pv)continue;"}
]});

process.exit(rc?1:0);
