// dev/sabotage-481-c8-campaign-stamps.js — proves the #481 C8 guards are guarded: the one comparator must compare by
// campaign id when both sides carry one (else a rename makes this campaign's own moments "an earlier adventure"
// again), the one stamper must carry the id, and the rename must re-stamp name-only legacy entries. Each mutation
// runs in a disposable clone (sabotage.js proveScratch); nothing here touches the working tree.
//   node dev/sabotage-481-c8-campaign-stamps.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 C8"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "the comparator compares display names only",
    find: "  if(rec.campId&&ws&&ws.campId)return rec.campId===ws.campId;\n", replace: "",
    mustFail: "a rename keeps it this campaign's" },
  { label: "the stamper stops carrying the id",
    find: "  if(ws&&ws.campId&&obj.camp===cur)obj.campId=ws.campId;\n", replace: "",
    mustFail: "stamped with the campaign's name AND id" },
  { label: "the rename re-stamp ignores name-only legacy entries",
    find: "    else if(!r.campId&&oldName&&r.camp===oldName){r.camp=newName;if(id)r.campId=id;n++;}\n", replace: "",
    mustFail: "legacy name-only stamps" }
]);
prove("ui-campaigns.js", [
  { label: "the rename stops re-stamping the active campaign",
    find: "campRestamp(worldState,_oldCampName,name,id);", replace: "",
    mustFail: "re-stamps the ACTIVE campaign" },
  { label: "the rename stops re-stamping a stored campaign",
    find: "campRestamp(ws,ws.campName,name,id);", replace: "",
    mustFail: "re-stamps a STORED campaign" }
]);
process.exit(code);
