// sabotage-783-new-campaign-first.js - prove the #783 guard is not decorative.
// #783 (owner 2026-11-25): the campaigns modal puts New Campaign above the list. Each mutation moves or
// removes the button; the engine test must turn red, and sabotage.js restores byte-identical source.
//   node dev/sabotage-783-new-campaign-first.js
var sabotage=require("./sabotage.js"),rc=0;
var CMD=["node",["dev/run-tests.js","#783 New Campaign leads the campaigns list"]];
var MUST="#783 the campaigns modal puts New Campaign above the list";

rc|=sabotage.prove({file:"ui-campaigns.js",command:CMD,cases:[
  {label:"#783 the list comes first again",find:"    +\"<div id='camp-list'></div>\",",replace:"    +\"<div id='camp-list'></div><button onclick='campNew()'>New Campaign</button>\",",mustFail:MUST},
  {label:"#783 the button is gone",find:"<button onclick='campNew()' style='width:100%;margin-bottom:14px;",replace:"<button style='width:100%;margin-bottom:14px;",mustFail:MUST},
  {label:"#783 the connection status drops under the button",find:"    +\"<div id='camp-sync-status' style='display:none;font-size:11px;color:var(--t2);margin-bottom:10px;text-align:center;'></div>\"\n",replace:"",mustFail:MUST}
]});
process.exit(rc);
