// sabotage-423-import-ownership.js — mutation proof for #423: an imported save must never write over
// another account's cloud campaign.
//
// The defect: importSave adopted the .tnd file's own campId, the next autosave POSTed it, and the server
// upsert keyed on id alone — a friend importing an exported save overwrote the sender's row. The client
// half now re-mints a foreign id at import (resolveImportedCampaignId), re-homes ONCE on the server's
// 403 foreign_campaign (rehomeCampaign carries slot / list row / unsynced marker / #365 stamp / held
// checkpoint), and the DOM shell routes through the engine half (importSaveData) so the honest
// two-account case is engine-tested. Each clause below must make dev/run-tests.js FAIL on the named
// assertion; a mutation that changes no bytes is a hard failure.
// Usage: node dev/sabotage-423-import-ownership.js
var sabotage = require("./sabotage.js");
var rc = 0;
var ALSO = ["dev/tests-423-import-ownership.js", "dev/run-standalone-suites.js"];

rc |= sabotage.prove({
  file: "state.js",
  command: ["node", ["dev/run-tests.js"]],
  also: ALSO,
  cases: [
    { label: "the resolver adopts every file id — a friend's export posts the sender's id again",
      mustFail: "RE-MINTED",
      // the ownership question is still ASKED (so the source pin stays green) but its answer is ignored —
      // the battery, not the contract, must be what catches a resolver that reuses a foreign id
      find: "    if(campaignIdOccupied(fileId))return{id:fileId,reminted:false,fileId:fileId};\n    return{id:newCampaignId(),reminted:true,fileId:fileId};",
      replace: "    campaignIdOccupied(fileId);return{id:fileId,reminted:false,fileId:fileId};" },

    { label: "the re-home forgets the #365 memory stamp — the next load toasts an owner mismatch",
      mustFail: "memory.campId not restamped",
      find: "  if(typeof memory!==\"undefined\"&&memory&&old&&memory.campId===old)memory.campId=nid;",
      replace: "" },

    { label: "the re-home keeps the onServer flag — the picker believes the cloud holds the new id",
      mustFail: "onServer flag survived",
      find: "delete meta[i].onServer;",
      replace: "" },

    { label: "the unsynced marker stays keyed by the old id — the boot push posts the foreign id at every launch",
      mustFail: "unsynced marker",
      find: "      if(t!=null){storageAdapter.clearFlushDirty(old);storageAdapter.markFlushDirty(nid,t);}",
      replace: "" },

    { label: "the re-home drops the held checkpoint — the camp is lost at the id change",
      mustFail: "held checkpoint",
      find: "  if(held){held.campId=nid;_checkpointMem=held;}",
      replace: "" }
  ]
});

rc |= sabotage.prove({
  file: "storage-adapter.js",
  command: ["node", ["dev/run-tests.js"]],
  also: ALSO,
  cases: [
    { label: "the 403 branch is gone — a foreign id is a plain failure and the importer's campaign never saves",
      mustFail: "re-home",
      find: "      else if (r.status === 403) {",
      replace: "      else if (false) {" },

    { label: "the re-home is unbounded — a lying server drives an id-minting storm",
      mustFail: "IMPORT OWNERSHIP CONTRACT",
      find: 'd.reason === "foreign_campaign" && !rehomedRetry',
      replace: 'd.reason === "foreign_campaign"' }
  ]
});

rc |= sabotage.prove({
  file: "ui-files.js",
  command: ["node", ["dev/run-tests.js"]],
  also: ALSO,
  cases: [
    { label: "the shell grows its own adoption path — the engine battery cannot see it",
      mustFail: "IMPORT OWNERSHIP CONTRACT",
      find: "    importSaveData(data);",
      replace: "    worldState=data.worldState;setActiveCampId(data.worldState.campId);saveAll();" }
  ]
});

process.exit(rc);
