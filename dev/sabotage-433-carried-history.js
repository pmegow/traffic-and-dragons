// dev/sabotage-433-carried-history.js — proves the #433 guards are guarded: the carried-history pool serves only when the
// action NAMES someone (presence never spams the prompt), never a party member's sheet, never an unnamed person's private
// beat; dedups a moment shared by two sheets; caps; orders origin before echo; invalidates its memo when a sheet changes;
// honours the RAG off-switch; and api.js splices the block into the volatile half. Each mutation runs in a disposable clone
// (sabotage.js proveScratch); nothing here touches the working tree.
//   node dev/sabotage-433-carried-history.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#433 carried"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("memory.js", [
  { label: "presence alone serves the pool (the backlog spams every prompt)",
    find: '  if(!any)return "";/* the action named nobody: nothing is served — presence never spams the prompt */',
    replace: '  if(!any){for(k in q.scene){w[k]=2;any=true;}}',
    mustFail: "#433 a question naming" },
  { label: "party members' sheets ride the pool (served twice)",
    find: 'var r=n[i];if(!r||r.partyMember||!r.charSheet||!r.name)continue;', replace: 'var r=n[i];if(!r||!r.charSheet||!r.name)continue;',
    mustFail: "#433 the pool is non-party only" },
  { label: "a fact naming nobody the action named still qualifies (private beats leak)",
    find: '    if(sc<=0)continue;/* the gate: a fact must name someone the action named */', replace: '    if(sc<0)continue;',
    mustFail: "#433 the pool is non-party only" },
  { label: "the cap is gone",
    find: 'var picked=cands.slice(0,RAG_CARRIED_MAX);', replace: 'var picked=cands.slice(0);',
    mustFail: "#433 the pool is non-party only" },
  { label: "a moment shared by two sheets is served twice",
    find: 'var key=t.toLowerCase();if(seen[key])return;seen[key]=1;pool.push(', replace: 'pool.push(',
    mustFail: "#433 a question naming" },
  { label: "the echo is served before the origin",
    find: 'picked.sort(function(a,b){return (a.t-b.t)||(a.i-b.i);});', replace: 'picked.sort(function(a,b){return (b.t-a.t)||(a.i-b.i);});',
    mustFail: "#433 a question naming" },
  { label: "the memo ignores sheet changes (an edited sheet is served stale)",
    find: '_k=_ragNpcsFp()+"|carried|"+fp+"|"+_ragDjb2(', replace: '_k=_ragNpcsFp()+"|carried|"+_ragDjb2(',
    mustFail: "#433 the pool is non-party only" },
  { label: "the RAG off-switch is ignored",
    find: 'function ragCarriedRetrieve(inputText){\n  if(!ragEnabled())return "";\n', replace: 'function ragCarriedRetrieve(inputText){\n',
    mustFail: "#433 buildSysPrompt" }
]);
prove("api.js", [
  { label: "the block is dropped from the volatile splice",
    find: '    +carriedRagBlock/* #433:', replace: '    +""/* #433:',
    mustFail: "#433 buildSysPrompt" }
]);
process.exit(code);
