// dev/sabotage-337-campaign-switch.js — proves the #337 campaign-switch quota guards actually bite.
// Each case reintroduces one shape of the field failure (owner 2026-09-05: Load did nothing because
// a QuotaExceededError escaped switchToCampaign's unguarded live-key write) and expects the suite to
// go RED. A mutation that stays green means the test guards nothing (CLAUDE.md guardrail rule 2).
//
//   node dev/sabotage-337-campaign-switch.js
var sabotage = require("./sabotage.js");
var rc = sabotage.prove({
  file: "state.js",
  command: ["node", ["dev/run-tests.js", "campaign switch under quota"]],
  cases: [
    { label: "free the target slot AFTER the snapshot (the old three-blob peak)",
      find: "  removeCampaignLocalCopy(id);\n  // B4: abort BEFORE touching the live keys",
      replace: "  // B4: abort BEFORE touching the live keys" },
    { label: "unguard the live-key write (the uncaught QuotaExceededError of the field report)",
      find: "  try{put(WSK,ws);put(SLK,sl);put(MEM_KEY,mem);return true;}\n  catch(e){",
      replace: "  put(WSK,ws);put(SLK,sl);put(MEM_KEY,mem);return true;\n  if(0){" },
    { label: "skip restoring the previous live triple after a failed write",
      find: "    try{put(WSK,prevWs);put(SLK,prevSl);put(MEM_KEY,prevMem);}",
      replace: "    try{}" },
    { label: "leave the target slot unrestored after a failed switch",
      find: "  if(!snapshotActiveCamp(true)){restoreTargetSlot();fullToast(",
      replace: "  if(!snapshotActiveCamp(true)){fullToast(" },
    { label: "writeCampaignSlot keeps the partial slot on a quota throw",
      find: "  catch(e){\n    removeCampaignLocalCopy(id);\n    var need=",
      replace: "  catch(e){\n    var need=" }
  ]
});
if (rc === 0) {
  // The source contract in run-tests.js is a separate guard: a raw store.set in the transport paths must fail the suite.
  rc = sabotage.prove({
    file: "ui-campaigns.js",
    command: ["node", ["dev/run-tests.js", "campaign switch under quota"]],
    cases: [
      { label: "raw slot write sneaks back into campCloudPull",
        find: "      if(!writeCampaignSlot(id,wsS,slS,memS))return;",
        replace: "      store.set(campSlotKey(id,\"ws\"),wsS);store.set(campSlotKey(id,\"sl\"),slS);store.set(campSlotKey(id,\"mem\"),memS);" }
    ]
  });
}
process.exit(rc);
