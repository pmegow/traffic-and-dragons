// dev/sabotage-509-campaign-id-restamp.js — proves the #509 guards are guarded. Since #481 C8 a campaign stamp is compared
// by id first, and two paths give a campaign a NEW id: a .tnd import on a device that does not own the file's id (#423
// re-mints it) and the re-home after a cloud save is refused for another account. Neither re-stamped the records, so the
// campaign's own defining moments read as "an earlier adventure" and the Village held them back. ONE walk over the stamped
// records (campStampedEach, helpers.js) now serves the rename and the id change. Each mutation runs in a disposable clone.
//   node dev/sabotage-509-campaign-id-restamp.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#509"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("state.js", [
  { label: "the re-minted import leaves its moments on the sender's id (the reported bug)",
    find: "  if(plan.reminted&&typeof campRestampId===\"function\"){", replace: "  if(false&&plan.reminted&&typeof campRestampId===\"function\"){",
    mustFail: "the repro" },
  { label: "the re-home leaves the moments on the old id",
    find: "var _rs=(old&&typeof campRestampId===\"function\")?campRestampId(worldState,old,nid):0;", replace: "var _rs=0;",
    mustFail: "the re-home" }
]);
prove("helpers.js", [
  { label: "the id re-stamp moves every record, another campaign's too",
    find: "  campStampedEach(ws,function(r){if(r.campId===oldId){r.campId=newId;n++;}});", replace: "  campStampedEach(ws,function(r){if(r.campId){r.campId=newId;n++;}});",
    mustFail: "only THIS campaign's records move" },
  { label: "the same id counts as a change",
    find: "  if(!oldId||!newId||oldId===newId)return 0;", replace: "  if(!oldId||!newId)return 0;\n  if(oldId===newId)return 1;",
    mustFail: "only THIS campaign's records move" },
  { label: "the outfit is left out of the stamped records",
    find: "    if(cs.outfit&&typeof cs.outfit===\"object\")fn(cs.outfit);\n", replace: "",
    mustFail: "the repro" },
  { label: "the companions' sheets are left out of the stamped records",
    find: "  for(i=0;i<(ws.npcs||[]).length;i++)if(ws.npcs[i]&&ws.npcs[i].charSheet)sheets.push(ws.npcs[i].charSheet);\n  sheets.forEach(function(cs){if(!cs)return;\n    CAMP_STAMPED_LISTS", replace: "  sheets.forEach(function(cs){if(!cs)return;\n    CAMP_STAMPED_LISTS",
    mustFail: "a companion's moments follow" }
]);
process.exit(code ? 1 : 0);
