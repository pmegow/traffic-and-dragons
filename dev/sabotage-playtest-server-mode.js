// dev/sabotage-playtest-server-mode.js — proves the signed-in playtest guards are guarded (owner 2026-09-30, "sign in"). A
// signed-in run shares storage with the owner's sign-in and campaigns, and its saves sync to the owner's cloud: the harness
// starts only a harness-named campaign, records it only when confirmed, deletes only that campaign (this device's copy
// first, then the cloud copy, checked gone), keeps an undeleted run's record through a clear, and sets the model in memory
// only. Each mutation runs in a disposable clone.
//   node dev/sabotage-playtest-server-mode.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/tests-playtest-server-mode.js"]];
process.exit(sabotage.prove({ file: "dev/playtest-harness.js", command: CMD, cases: [
  { label: "a harness name is matched anywhere in the name, not as its prefix",
    find: "if(name.indexOf(__PT_CAMP_PREFIXES[i])===0)return true;", replace: "if(name.indexOf(__PT_CAMP_PREFIXES[i])>=0)return true;",
    mustFail: "only a campaign named as the harness's own counts" },
  { label: "an unentitled account may start (every turn would be refused)",
    find: "    if(!env.entitled)return {ok:false,", replace: "    if(false)return {ok:false,",
    mustFail: "the preflight refuses every route that would fail each turn" },
  { label: "a run is recorded without confirming the new campaign is the active one",
    find: "if(!activeId||!ws||ws.campId!==activeId||ws.campName!==campName||", replace: "if(!activeId||!ws||",
    mustFail: "a run is recorded only when the new campaign is confirmed" },
  { label: "the run's name is read after startGame deleted it (every real start is refused)",
    find: "    var rec=__ptRunRecord(getActiveCampId(),(typeof worldState!==\"undefined\")?worldState:null,campName);", replace: "    var rec=__ptRunRecord(getActiveCampId(),(typeof worldState!==\"undefined\")?worldState:null,char._campName);",
    mustFail: "a run starts only a harness-named campaign, and records it" },
  { label: "the cleanup trusts the id without the name",
    find: "    if(hits[0].campName!==run.campName)return {ok:false,", replace: "    if(false)return {ok:false,",
    mustFail: "the cleanup deletes only the recorded run's own campaign" },
  { label: "the cleanup deletes by id alone when the campaign is missing from this device",
    find: "  if(run.localGone)return {ok:true,id:run.campId,local:false};", replace: "  return {ok:true,id:run.campId,local:false};",
    mustFail: "the cleanup deletes only the recorded run's own campaign" },
  { label: "this device's copy is never torn down (it could push the campaign back)",
    find: "    if(plan.local){\n      if(getActiveCampId()===id){removeActiveCampaignLocally(id);", replace: "    if(false){\n      if(getActiveCampId()===id){removeActiveCampaignLocally(id);",
    mustFail: "the cleanup removes this device's copy BEFORE the cloud delete" },
  { label: "the cloud delete is never checked (a late push survives, claimed deleted)",
    find: "      var still;try{still=await cloudHas();}", replace: "      var still=false;try{}",
    mustFail: "a push that lands after the delete is caught" },
  { label: "a new run starts while the previous run's campaign is still in the cloud",
    find: "    if(prev&&prev.route===\"server\"&&!prev.deleted)return \"refused:", replace: "    if(false)return \"refused:",
    mustFail: "a new run waits until the previous signed-in run's campaign is deleted" },
  { label: "a clear drops the undeleted run's record",
    find: "window.__pt={log:[],errors:[],raw:[]};if(keep)window.__pt.run=keep;", replace: "window.__pt={log:[],errors:[],raw:[]};",
    mustFail: "a new run waits until the previous signed-in run's campaign is deleted" },
  { label: "the action pool reads the whole story's last four buttons again (a previous turn's button gets picked)",
    find: "    var btns=nars[nars.length-1].querySelectorAll(\".qa[data-action]\");\n    if(!btns.length||btns[btns.length-1].disabled)return null;\n    return Array.prototype.map.call(btns,function(b){return b.getAttribute(\"data-action\");});",
    replace: "    var btns=document.querySelectorAll(\"#story-narrative .qa[data-action]\");\n    if(!btns.length||btns[btns.length-1].disabled)return null;\n    return Array.prototype.map.call(btns,function(b){return b.getAttribute(\"data-action\");}).slice(-4);",
    mustFail: "the action pool is the newest narration's buttons only" },
  { label: "the run's model is saved over the owner's choice",
    find: "    activeProvider=provider;providerModels[provider]=model;\n", replace: "    activeProvider=provider;providerModels[provider]=model;store.set(\"tnd_provider_v1\",provider);\n",
    mustFail: "the run's model is set in memory only" }
]}) ? 1 : 0);
