// dev/sabotage-481-b4-scene-present.js — proves the #481 B4 guards are guarded: "in the scene" expires. ONE predicate
// (scenePresentNow) behind ONE boundary (buildSceneManifest's addLocal); the trade gate keeps the stale-tolerant list
// (owner ruling: a shop's keeper counts while the shop is open). Each clause removes one rule and the matching "#481 B4"
// test must fail. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-b4-scene-present.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 B4"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("game.js", [
  { label: "the boundary skips the predicate (every exact-spot sighting is local again)",
    find: "if(!seenLocal[k]&&((typeof scenePresentNow===\"function\")?scenePresentNow(nm):exact)){", replace: "if(!seenLocal[k]&&exact){",
    mustFail: "Victor, last seen in the tavern at t28" }
]);
prove("identity.js", [
  { label: "a sighting from before the frame counts again",
    find: "    else if(lt!=null&&lt>=f.startTurn&&(last==null||lt>last))last=lt;}", replace: "    else if(lt!=null&&(last==null||lt>last))last=lt;}",
    mustFail: "Victor, last seen in the tavern at t28" },
  { label: "the latest cast is ignored",
    find: "  if(cl&&cl.node===here&&cl.turn>last&&(cl.names||[]).indexOf(canon)<0)return false;", replace: "",
    mustFail: "the latest cast is the authority" },
  { label: "the cast is never remembered",
    find: "    worldState.castLast={turn:(R.turn!=null)?R.turn:worldState.turn,node:locResolve(currentNodeKey()),names:Object.keys(castCanon)};", replace: "",
    mustFail: "a non-none cast is remembered" }
]);
prove("helpers.js", [
  { label: "the trade gate reads the present-now list (a keeper seen 100 turns ago stops trading)",
    find: "local=_arrived?_spk:(man.seenHere||man.local||[]).concat(_spk)", replace: "local=_arrived?_spk:(man.local||[]).concat(_spk)",
    mustFail: "a shop whose keeper was last seen 100 turns ago still trades" }
]);
process.exit(code);
