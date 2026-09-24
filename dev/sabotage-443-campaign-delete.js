// sabotage-443-campaign-delete.js — mutation proof for #443: the cloud delete is awaited, a failure keeps the local
// copy and says why, a 404 still deletes locally. Usage: node dev/sabotage-443-campaign-delete.js
var sabotage=require("./sabotage.js");
process.exit(sabotage.prove({
  file:"ui-campaigns.js",
  command:["node",["dev/tests-443-campaign-delete.js"]],
  cases:[
    { label:"#443: the local copy is deleted before the server answers",
      mustFail:"connected: the remote delete goes first",
      find:'  showToast("Deleting "+name+"…");\n',
      replace:'  showToast("Deleting "+name+"…");deleteCampaign(id);\n' },
    { label:"#443: a failed cloud delete still deletes the local copy",
      mustFail:"connected, the server fails: the local copy is KEPT",
      find:'      showCampaignPicker();return;\n    }\n    deleteCampaign(id);',
      replace:'      showCampaignPicker();\n    }\n    deleteCampaign(id);' },
    { label:"#443: a 404 counts as a failure (a local-only campaign can never be deleted while connected)",
      mustFail:"connected, the server never had it (404)",
      find:'  if(/\\b404\\b|not found/i.test(String(err)))return "absent";',
      replace:'  if(false)return "absent";' }
  ]
}));
