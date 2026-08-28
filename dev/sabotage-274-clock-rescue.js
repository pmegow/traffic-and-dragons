// sabotage-274-clock-rescue.js — mutation proof for the campaign-clock corruption rescue
// (#274 / Fable f63, joint review 2026-08-27).
//
// The guard being proven: a clock.min that is not a usable number must NOT cost the timeline
// silently. Before #274, both wipe sites (clockEnsure here, migrateWorldState in state.js)
// replaced the WHOLE clock object — position, every scheduled deadline, and the #146 repair
// receipts, with no console line, no toast, and no archive. Losing the receipts is the sharper
// half: it disarms #146's own double-fire protection, so a repeated repair id re-applies on any
// device after the reset.
//
// Every clause below breaks exactly one obligation of that contract — preserve, carry, be loud,
// tell the truth about what was lost, and keep ABSENT distinct from CORRUPT — and each names the
// assertion that must catch it, so a mutation caught by an unrelated red reports MISATTRIBUTED
// rather than passing as coverage.
//
// Usage: node dev/sabotage-274-clock-rescue.js
var sabotage = require("./sabotage.js");
var rc = 0;
var CMD = ["node", ["dev/run-tests.js"]];

rc |= sabotage.prove({
  file: "clock.js",
  command: CMD,
  cases: [
    { label: "the PRESERVE is dropped — a corrupt clock is reset with no archive at all (#274)",
      mustFail: "#274 a STRING clock.min",
      find: "    try{store.set(rk,raw);kept=store.get(rk)===raw;}catch(e3){kept=false;}",
      replace: "    kept=false;" },

    { label: "the SCHEDULE carry is dropped — every deadline dies with the poisoned scalar again (#274)",
      mustFail: "#274 a STRING clock.min",
      find: "  var out={min:0,schedule:keepSched||[]};",
      replace: "  var out={min:0,schedule:[]};" },

    { label: "the REPAIR-RECEIPT carry is dropped — #146's double-fire protection stays disarmed after a reset (#274)",
      mustFail: "#274 a STRING clock.min",
      find: "  if(keepRep)out.repairs=keepRep;",
      replace: "  if(false)out.repairs=keepRep;" },

    { label: "the player channel goes silent — the timeline resets behind the player's back (#274)",
      mustFail: "#274 a STRING clock.min",
      find: "if(typeof showToast===\"function\")showToast(\"⚠ Your campaign clock",
      replace: "if(false)showToast(\"⚠ Your campaign clock" },

    { label: "the developer channel goes silent — no console trace of a wiped clock (#274)",
      mustFail: "#274 a STRING clock.min",
      find: "if(typeof console!==\"undefined\")console.error(\"[clock] the campaign clock could not be read",
      replace: "if(false)console.error(\"[clock] the campaign clock could not be read" },

    { label: "the loss stops being NAMED — junk deadlines are reported as \"your deadlines were kept\" (#274)",
      mustFail: "#274 junk schedule/repairs rebuild EMPTY",
      find: "  var lost=gone.join(\" and \");",
      replace: "  var lost=\"\";" },

    { label: "the non-finite snapshot reverts to plain JSON — a NaN scalar is preserved as a lossy null (#274)",
      mustFail: "#274 a numeric-NaN clock.min",
      find: "  try{raw=JSON.stringify(bad,function(k,v){return (typeof v===\"number\"&&!isFinite(v))?(\"__nonfinite:\"+String(v)):v;});}catch(e){raw=null;}",
      replace: "  try{raw=JSON.stringify(bad);}catch(e){raw=null;}" },

    { label: "ABSENT collapses back into CORRUPT — an ordinary legacy load alarms the player (#274)",
      mustFail: "#274 an ABSENT clock still mints silently",
      find: "  if(!c)worldState.clock={min:0,schedule:[]};",
      replace: "  if(!c)worldState.clock=clockRescueCorrupt(c);" },

    { label: "the corruption test is dropped — every healthy load rescues, backs up and alarms (#274)",
      mustFail: "#274 a healthy clock is never rescued",
      find: "  else if(typeof c.min!==\"number\"||isNaN(c.min))worldState.clock=clockRescueCorrupt(c);",
      replace: "  else worldState.clock=clockRescueCorrupt(c);" }
  ]
});

rc |= sabotage.prove({
  file: "state.js",
  command: CMD,
  cases: [
    { label: "the load-time migrate site reverts to the wholesale wipe — the second wipe site goes quiet again (#274)",
      mustFail: "#274 the load-time migrate path rescues too",
      find: "    if(typeof clockRescueCorrupt===\"function\")worldState.clock=clockRescueCorrupt(worldState.clock);",
      replace: "    if(true)worldState.clock={min:0,schedule:[]};" }
  ]
});

process.exit(rc ? 1 : 0);
