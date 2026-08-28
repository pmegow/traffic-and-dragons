// sabotage-jp0-4-store-rescue.js — mutation proof for the corrupt recall-store rescue (JP0-4,
// joint review 2026-08-27; Sol P0-02, Fable-verified at state.js:476-478).
//
// The defect: loadState parsed sessionLog and memory in their own try/catch (E73 — a corrupt side
// key must never discard a good worldState, which is RIGHT), but both catch arms were SILENT.
// sessionLog became [], memory became blankMemory(), the campaign looked healthy, and the next
// save persisted the blank over the only recoverable bytes. The fix mirrors the UA3 transcript
// rescue: preserve the original string under a bounded per-campaign key, shout on both channels,
// then degrade.
//
// Two guards cover this row and the clauses below are split by which one should fire:
//   • the JP0-4 CORRUPT-STORE RESCUE CONTRACT (dev/run-tests.js) — the SHAPE clauses (both catch
//     arms route through the rescue, both channels shout, the tier is named, nothing deletes a
//     rescue key). It runs before the engine suite and exits on the first failure, so a mutation
//     it sees is attributed to it.
//   • the engine assertions (dev/engine-tests.js, "corrupt recall-store rescue (JP0-4)") — the
//     BEHAVIOR clauses. Those mutations are deliberately shaped to pass the source contract so
//     the behavior test is the thing proven.
//
// Every clause must make dev/run-tests.js FAIL, and on the NAMED assertion (mustFail) — an
// unrelated red is MISATTRIBUTED, not a pass. A mutation that changes no bytes is a hard failure.
// Usage: node dev/sabotage-jp0-4-store-rescue.js
var sabotage = require("./sabotage.js");
var rc = 0;

rc |= sabotage.prove({
  file: "state.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    // ── shape clauses (caught by the source contract) ──────────────────────────────
    { label: "the session-log catch arm goes silent again — a corrupt log is blanked with no rescue and no word",
      mustFail: "the sessionLog catch arm no longer rescues before degrading",
      find: 'catch(e){rescueCorruptStore("sess",sl,e);sessionLog=[];}',
      replace: 'catch(e){sessionLog=[];}' },

    { label: "the memory catch arm goes silent again — a corrupt long-term memory is blanked with no rescue and no word",
      mustFail: "the memory catch arm no longer rescues before degrading",
      find: 'catch(e){rescueCorruptStore("mem",mm,e);memory=blankMemory();}',
      replace: 'catch(e){memory=blankMemory();}' },

    { label: "the player-facing degrade goes quiet — the campaign silently loads without a recall tier again",
      mustFail: "no longer raises a typeof-guarded toast",
      find: '  if(typeof showToast==="function")showToast("⚠ Your "+label+" could not be read"',
      replace: '  if(false)showToast("⚠ Your "+label+" could not be read"' },

    { label: "the developer channel goes quiet — a degraded load leaves nothing in the console for forensics",
      mustFail: "no longer console.errors behind the node guard",
      find: '  if(typeof console!=="undefined")console.error("[save] the "+label+" store could not be parsed — "',
      replace: '  if(false)console.error("[save] the "+label+" store could not be parsed — "' },

    { label: "the tier ternary collapses — the messages stop naming which recall layer was lost",
      mustFail: "no longer names the degraded tier",
      find: '  var label=(tier==="sess")?"session log":(tier==="mem")?"long-term memory":tier;',
      replace: '  var label=tier;' },

    // ── behavior clauses (shaped to pass the contract; caught by the engine suite) ──
    { label: "the rescue writes nothing at all — the catch still calls it, it still shouts, but the bytes are gone",
      mustFail: "not byte-identical to the corrupt original",
      find: '  if(typeof raw==="string"&&raw.length){try{store.set(rk,raw);',
      replace: '  if(false){try{store.set(rk,raw);' },

    { label: "the preserved blob is truncated instead of stored verbatim — the rescue is no longer the bytes that were on disk",
      mustFail: "not byte-identical to the corrupt original",
      find: '{try{store.set(rk,raw);kept=store.get(rk)===raw;}',
      replace: '{try{store.set(rk,String(raw).slice(0,4));kept=true;}' },

    { label: "the rescue key loses its TIER — the two recall stores share one slot, so whichever fails second erases the other's evidence",
      mustFail: "two corrupt stores in one load rescue INDEPENDENTLY",
      find: '  var rk=STORE_RESCUE_K+tier+"_"+((typeof getActiveCampId==="function"&&getActiveCampId())||"default");',
      replace: '  var rk=STORE_RESCUE_K+((typeof getActiveCampId==="function"&&getActiveCampId())||"default");' },

    { label: "the rescue key loses its CAMPAIGN scope — one campaign's corruption destroys another campaign's preserved bytes",
      mustFail: "rescues are PER CAMPAIGN",
      find: '  var rk=STORE_RESCUE_K+tier+"_"+((typeof getActiveCampId==="function"&&getActiveCampId())||"default");',
      replace: '  var rk=STORE_RESCUE_K+tier;' },

    { label: "keep-oldest (the UA3 rule) is copied over — a fresh corruption can no longer be preserved because a stale slot squats it",
      mustFail: "a NEWER corruption overwrites the older bytes",
      find: '  if(typeof raw==="string"&&raw.length){try{store.set(rk,raw);kept=store.get(rk)===raw;}catch(e2){kept=false;}}',
      replace: '  if(typeof raw==="string"&&raw.length){try{if(!store.get(rk))store.set(rk,raw);kept=store.get(rk)===raw;}catch(e2){kept=false;}}' },

    { label: "the toast stops naming the tier in its own text — the player is told something failed but not which recall layer",
      mustFail: "no toast named the degraded tier",
      find: 'showToast("⚠ Your "+label+" could not be read"',
      replace: 'showToast("⚠ Part of this save could not be read"' }
  ]
});

// The "nothing sweeps a rescue key" clause lives on a DIFFERENT file on purpose: the risk is a
// future cleanup path deleting the only copy, so the guard has to fire from anywhere in the shell.
rc |= sabotage.prove({
  file: "game.js",
  command: ["node", ["dev/run-tests.js"]],
  cases: [
    { label: "a shell path starts deleting rescue keys — the preserved bytes vanish before any recovery flow exists",
      mustFail: "deletes a store-rescue key",
      find: 'function clearPendingAction(){try{store.del(PENDING_ACT_K);}catch(e){}}',
      replace: 'function clearPendingAction(){try{store.del(PENDING_ACT_K);store.del(STORE_RESCUE_K+"sess_x");}catch(e){}}' }
  ]
});

process.exit(rc ? 1 : 0);
