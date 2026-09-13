// dev/sabotage-e13b-fresh-campaign-id.js — proves E13b: a new campaign never inherits an occupied campaign id.
//   node dev/sabotage-e13b-fresh-campaign-id.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "E13b a NEW campaign"]], cases: cases }); }
prove("state.js", [
  { label: "a listed campaign id reads as free",
    find: 'var meta=getCampMeta(),i;for(i=0;i<meta.length;i++)if(meta[i]&&meta[i].id===id)return true;', replace: '',
    mustFail: "E13b campaignIdOccupied" },
  { label: "a slot with state reads as free",
    find: 'return !!store.get(campSlotKey(id,"ws"));', replace: 'return false;',
    mustFail: "E13b campaignIdOccupied" }
]);
prove("game.js", [
  { label: "startGame adopts whatever id is active",
    find: 'var _aid=getActiveCampId();if(!_aid||campaignIdOccupied(_aid))setActiveCampId(newCampaignId());', replace: 'var _aid=getActiveCampId();if(!_aid)setActiveCampId(newCampaignId());',
    mustFail: "E13b campaignIdOccupied" }
]);
process.exit(code);
