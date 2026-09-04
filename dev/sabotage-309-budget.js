var sabotage=require("./sabotage.js"),rc=0,command=["node",["dev/run-tests.js","#309 — note delivery budget"]];
rc|=sabotage.prove({file:"api.js",command:command,cases:[
  {label:"fourth builder escapes count budget",mustFail:"count cap defers fourth builder",find:'names.length>=NOTE_DELIVERY_CAP?',replace:'false?'},
  {label:"protocol omitted from character accounting",mustFail:"character cap includes protocol",find:'chars=ENGINE_NOTES_PROTOCOL.length+2',replace:'chars=0'},
  {label:"drop consumes its trigger",mustFail:"count cap defers fourth builder",find:'      restoreNoteLatches(snap);',replace:'      void 0;'},
  {label:"drop is absent from audit ring",mustFail:"count cap defers fourth builder",find:'d:dropped',replace:'d:[]'},
  {label:"deferred shelf expires",mustFail:"deferred transient survives its shelf",find:'!p._noteDeferred&&worldState.turn-p.turn>shelf',replace:'worldState.turn-p.turn>shelf'},
  {label:"dead provider turn consumes expiry appointment",mustFail:"deferred expiry appointment survives",find:'else f._askPending=fr.pending;',replace:'else f._askPending=false;'},
  {label:"consequence must yield",mustFail:"consequence notes never yield",find:'reason&&!row.neverYield&&names.length',replace:'reason&&names.length'},
  {label:"oversized first note starves forever",mustFail:"one oversized first note is delivered alone",find:'reason&&!row.neverYield&&names.length',replace:'reason&&!row.neverYield'},
  {label:"rollback re-adds archived legacy entries",mustFail:"dropped legacy review cannot duplicate",find:'if(row.prepare)row.prepare();',replace:'void 0;'}
]});
rc|=sabotage.prove({file:"memory.js",command:command,cases:[
  {label:"summary retires an undelivered ask",mustFail:"deferred expiry appointment survives",find:'if(f._askPending){kept.push(f);continue;}',replace:'if(false){kept.push(f);continue;}'}
]});
process.exit(rc?1:0);
