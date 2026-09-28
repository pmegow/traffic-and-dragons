// dev/sabotage-395-cloud-backup.js — proves the cloud-backed snapshot skip is guarded: the proof conditions
// (acked turn ≥ local, no conflict, server mode) and the partial-slot clear.
//   node dev/sabotage-395-cloud-backup.js
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({
  file: "state.js",
  command: ["node", ["dev/run-tests.js", "quota hardening"]],
  cases: [
    { label: "a cloud copy BEHIND the local turn counts as proof (the last turns would be lost)",
      mustFail: "cloud behind by a turn must refuse",
      find: '&&_ss.lastAckTurn>=0&&_ss.lastAckTurn>=_lt)_cloud={turn:_ss.lastAckTurn};', replace: '&&_ss.lastAckTurn>=0)_cloud={turn:_ss.lastAckTurn};' },
    { label: "a conflict no longer refuses (another device is ahead and this copy would vanish)",
      mustFail: "a conflict must refuse",
      find: 'if(_ss&&!_ss.conflict&&typeof _ss.lastAckTurn==="number"', replace: 'if(_ss&&typeof _ss.lastAckTurn==="number"' },
    /* #473 re-anchor (2026-09-27; the weekly job had reported this clause MISSED since the audit D3 anchor): the D3 anchor
       was snapshotActiveCamp's own removeCampaignLocalCopy(id), and that line is a SECOND removal. It runs only after
       writeCampaignSlot has failed, and writeCampaignSlot's catch has by then deleted all three slot keys (an older
       complete copy included), so disabling it changed nothing and no test could ever catch it. The obligation lives at
       the catch. Through #395's own section only the REFUSAL paths can see it (the proceed path's second removal masks
       it there), so the #395 test now asserts a refused snapshot leaves no slot, a stale older copy included.
       sabotage-337-campaign-switch.js proves the same line independently through the #337 test. */
    { label: "a failed snapshot's partial or older slot copy is left behind (a half copy the picker would offer as whole)",
      mustFail: "a refused snapshot must still leave no partial slot",
      find: "  catch(e){\n    removeCampaignLocalCopy(id);\n    var need=", replace: "  catch(e){\n    var need=" }
  ]
}));
