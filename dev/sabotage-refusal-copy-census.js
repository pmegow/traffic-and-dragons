// sabotage-refusal-copy-census.js — retained proof for joint f24/f76.
// Usage: node dev/sabotage-refusal-copy-census.js
var sabotage=require("./sabotage.js"),rc=0;
var CMD=["node",["dev/run-tests.js","refusal copy coverage"]];

rc|=sabotage.prove({file:"identity.js",command:CMD,also:["dev/refusal-copy-census.js"],cases:[
  {label:"f24: unsupported-claim player copy falls back to the generic sentence",
    mustFail:"fallback for: unsupported canon claim type",
    find:"  {match:/unsupported canon claim type/i,",
    replace:"  {match:/unsupported canon claim type NEVER/i,"},
  {label:"f24: transaction-handler player copy falls back to the generic sentence",
    mustFail:"fallback for: transaction handler failed",
    find:"  {match:/transaction handler failed/i,",
    replace:"  {match:/transaction handler failed NEVER/i,"},
  {label:"f24: receipt-persistence player copy falls back to the generic sentence",
    mustFail:"fallback for: transaction receipt could not be persisted",
    find:"  {match:/transaction receipt could not be persisted/i,",
    replace:"  {match:/transaction receipt could not be persisted NEVER/i,"},
  {label:"f24: unsupported claim is removed from the shipped-reason registry",
    mustFail:"real uncovered refusal reasons",
    find:'  "unsupported canon claim type",\n',replace:""},
  {label:"f24: transaction handler failure is removed from the shipped-reason registry",
    mustFail:"real uncovered refusal reasons",
    find:'  "transaction handler failed: ",\n',replace:""},
  {label:"f24: receipt persistence failure is removed from the shipped-reason registry",
    mustFail:"real uncovered refusal reasons",
    find:'  "transaction receipt could not be persisted",\n',replace:""},
  {label:"f76: a planted novel-prefix refusal reason must fail the build",
    mustFail:"real uncovered refusal reasons",
    find:"function w2PrepareResponse(text){",
    replace:'function w2PrepareResponse(text){if(false){var reason="the envelope subject is unbound";}'}
]});

rc|=sabotage.prove({file:"dev/refusal-copy-census.js",command:CMD,cases:[
  {label:"f24: api.js quarantine reasons fall out of the census again",
    mustFail:"census did not discover shipped reason: transaction handler failed: ",
    find:'  callReasons(apiSrc,"w2TxnQuarantine",1,out,seen);',replace:""},
  {label:"f76: arbitrary reason assignments fall out and the recognizer becomes prefix-like again",
    mustFail:"census did not discover shipped reason: unsupported canon claim type",
    find:"  reasonAssignments(identitySrc,out,seen);",replace:""}
]});

process.exit(rc?1:0);
