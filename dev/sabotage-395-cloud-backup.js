// dev/sabotage-395-cloud-backup.js — proves the cloud-backed snapshot skip is guarded: the proof conditions
// (acked turn ≥ local, no conflict, server mode) and the partial-slot clear.
//   node dev/sabotage-395-cloud-backup.js
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({
  file: "state.js",
  command: ["node", ["dev/run-tests.js", "quota hardening"]],
  cases: [
    { label: "a cloud copy BEHIND the local turn counts as proof (the last turns would be lost)",
      find: '&&_ss.lastAckTurn>=0&&_ss.lastAckTurn>=_lt)_cloud={turn:_ss.lastAckTurn};', replace: '&&_ss.lastAckTurn>=0)_cloud={turn:_ss.lastAckTurn};' },
    { label: "a conflict no longer refuses (another device is ahead and this copy would vanish)",
      find: 'if(_ss&&!_ss.conflict&&typeof _ss.lastAckTurn==="number"', replace: 'if(_ss&&typeof _ss.lastAckTurn==="number"' },
    /* audit D3 re-anchor: the same clause, new bytes. The three raw store.del calls became one
       removeCampaignLocalCopy(id) when snapshotActiveCamp started writing through writeCampaignSlot
       (which clears its own partial); this line now removes an OLDER complete slot that would
       otherwise outlive the campaign state it no longer matches. Deleting it still leaves a stale
       copy the picker offers as whole — the mutation the clause was written to catch. */
    { label: "the partial slot write is left behind (a half copy the picker would offer as whole)",
      find: '      removeCampaignLocalCopy(id);/* D3: writeCampaignSlot already cleared its own partial', replace: '      if(false)removeCampaignLocalCopy(id);/* D3: writeCampaignSlot already cleared its own partial' }
  ]
}));
