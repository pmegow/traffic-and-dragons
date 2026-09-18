// dev/sabotage-424-cloud-rewind.js — proves the #424 cloud-rewind guards actually bite.
// #424 (owner ask 2026-09-18): when this device is AHEAD of the cloud, Load and ☁↓ Pull must ASK before
// discarding the local turns (with an export escape), and a confirmed rewind must re-base the sync
// adapter. Each case reintroduces one shape of the old behaviour (a silent overwrite, a silent keep, a
// base that only rises) and expects the suite to go RED. A mutation that stays green means the test
// guards nothing (CLAUDE.md guardrail rule 2).
//
//   node dev/sabotage-424-cloud-rewind.js
var sabotage = require("./sabotage.js");
var ENGINE = ["node", ["dev/run-tests.js", "cloud rewind"]];
var AUDIT  = ["node", ["dev/tests-audit-sync.js"]];
var rc = sabotage.prove({
  file: "state.js",
  command: ENGINE,
  cases: [
    { label: "a local-ahead copy is adopted without asking (the old ☁↓ Pull)",
      find: "  return {kind:\"confirm-rewind\",serverTurn:st,localTurn:lt,lost:lt-st};",
      replace: "  return {kind:\"adopt\",serverTurn:st,localTurn:lt};" },
    { label: "an unreadable local copy is adopted over (it may be ahead)",
      find: "  if(lt<0)return {kind:\"confirm-rewind\",serverTurn:st,localTurn:lt,lost:null};",
      replace: "  if(lt<0)return {kind:\"adopt\",serverTurn:st,localTurn:lt};" },
    { label: "a level Load re-downloads the cloud copy (nothing to gain, a full blob on a phone)",
      find: "  if(st>lt||(st===lt&&mode===\"pull\"))return {kind:\"adopt\",serverTurn:st,localTurn:lt};",
      replace: "  if(st>=lt)return {kind:\"adopt\",serverTurn:st,localTurn:lt};" },
    { label: "an unknown cloud turn on a pull overwrites silently instead of asking",
      find: ":{kind:\"confirm-rewind\",serverTurn:null,localTurn:lt,lost:null};",
      replace: ":{kind:\"adopt\",serverTurn:null,localTurn:lt};" },
    { label: "campLocalTurn reports a missing turn field as turn 0 (the cloud would always look ahead)",
      find: "  try{var w=JSON.parse(raw);return typeof w.turn===\"number\"?w.turn:-1;}",
      replace: "  try{var w=JSON.parse(raw);return typeof w.turn===\"number\"?w.turn:0;}" }
  ]
});
if (rc === 0) {
  rc = sabotage.prove({
    file: "storage-adapter.js",
    command: ENGINE,
    cases: [
      { label: "adoptServerTurn only RAISES the base (the ordinary ack rule) — a rewind would 409 on the next save",
        find: "    _lastAckTurn = turn;",
        replace: "    if (turn > _lastAckTurn) _lastAckTurn = turn;" }
    ]
  });
}
if (rc === 0) {
  rc = sabotage.prove({
    file: "ui-campaigns.js",
    command: AUDIT,
    cases: [
      { label: "☁↓ Pull stops consulting planCloudAdopt (the silent overwrite returns)",
        find: "    var plan=planCloudAdopt(\"pull\",typeof data.worldState.turn===\"number\"?data.worldState.turn:null,localTurn===null?-1:localTurn,localTurn!==null);",
        replace: "    var plan={kind:\"adopt\",serverTurn:data.worldState.turn,localTurn:localTurn};" },
      { label: "Load stops probing the server turn (the silent local keep returns)",
        find: "    storageAdapter.getServerStateTurn(id,function(st){",
        replace: "    (function(cb){cb(null);})(function(st){" },
      { label: "a confirmed rewind of the active campaign leaves the adapter on the old, higher base",
        find: "  if(id===getActiveCampId())storageAdapter.adoptServerTurn(typeof data.worldState.turn===\"number\"?data.worldState.turn:0);",
        replace: "  if(id===getActiveCampId())storageAdapter.syncToServer();" },
      { label: "the modal loses its export escape (a rewind is a total loss again)",
        find: "    exportCampaignCopy(opts.id).then(function(){modal.remove();opts.onAdopt();},function(e){",
        replace: "    Promise.resolve().then(function(){modal.remove();opts.onAdopt();},function(e){" }
    ]
  });
}
if (rc === 0) {
  rc = sabotage.prove({
    file: "ui-files.js",
    command: AUDIT,
    cases: [
      { label: "exportCampaignCopy exports the LIVE keys for a non-active campaign (the wrong game gets the safety copy)",
        find: "    var rawWs=store.get(campSlotKey(id,\"ws\")),rawSl=store.get(campSlotKey(id,\"sl\")),rawMem=store.get(campSlotKey(id,\"mem\"));",
        replace: "    var rawWs=store.get(WSK),rawSl=store.get(SLK),rawMem=store.get(MEM_KEY);" }
    ]
  });
}
process.exit(rc);
