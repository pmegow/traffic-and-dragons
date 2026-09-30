// dev/sabotage-481-b3-on-stage.js — proves the #481 B3 guards are guarded: the resident-exchange note amplifies a pair who
// are ON STAGE NOW (both observed in the active frame by the latest reply), never summons one. Fable's named clause: "revert
// to manifest.local". Each mutation runs in a disposable clone.
//   node dev/sabotage-481-b3-on-stage.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 B3"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("api.js", [
  { label: "revert to manifest.local (Fable's named clause): the note summons whoever the scene manifest calls present",
    find: "&&typeof sceneOnStageNow===\"function\"&&sceneOnStageNow(n.name))res.push(n);}", replace: "&&(buildSceneManifest().local||[]).indexOf(n.name)>=0)res.push(n);}",
    mustFail: "the t85 shape" }
]);
prove("identity.js", [
  { label: "on stage means seen any time this frame",
    find: "  for(i=0;i<ob.length;i++)if(ob[i]&&resolveNpcName(ob[i].entity)===canon)return ob[i].lastTurn===worldState.turn;", replace: "  for(i=0;i<ob.length;i++)if(ob[i]&&resolveNpcName(ob[i].entity)===canon)return true;",
    mustFail: "the t85 shape" },
  { label: "a frame at another place counts",
    find: "  if(locResolve(String(f.node))!==locResolve(currentNodeKey()))return false;\n  var canon=resolveNpcName(name),ob=f.observed||[],i;", replace: "  var canon=resolveNpcName(name),ob=f.observed||[],i;",
    mustFail: "on stage elsewhere" }
]);
process.exit(code);
