// dev/sabotage-392-local-scene.js — proves the wares gate reads the SCENE, not the town: the local list's
// exact-spot limb, its observed limb, and the fourth button's choice of list.
// #481 B4 (v1.1030): the exact-spot rule now lives in scenePresentNow (identity.js) — the one predicate behind
// buildSceneManifest's addLocal — so the same-town clause mutates THAT check; widening the old game.js call site
// is neutralised by the predicate (the clause went MISSED there, which is how the move was found).
//   node dev/sabotage-392-local-scene.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "class bible"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("identity.js", [
    { label: "local regains the same-town rule (a seller anywhere in the settlement is 'in the scene' again)",
      find: '  if(m&&m.lastSeenAt&&locResolve(String(m.lastSeenAt))===here){var lt=',
      replace: '  if(m&&m.lastSeenAt&&(locResolve(String(m.lastSeenAt))===here||locResolve(String(m.lastSeenAt))===locResolve(worldState.world.location)||locResolve(String(m.lastSeenAt)).indexOf(locResolve(worldState.world.location)+"|")===0)){var lt=' }
]);
prove("game.js", [
    { label: "an observed seller no longer counts as local",
      find: 'addNpc(npcs[_oj].name);addSeenHere(npcs[_oj].name);addLocal(npcs[_oj].name,true);/* #392: observed = in the scene */break;', replace: 'addNpc(npcs[_oj].name);addSeenHere(npcs[_oj].name);break;' },
    { label: "the fourth button reads the town list again",
      find: 'waresOfferedHere(node,buildSceneManifest().local)', replace: 'waresOfferedHere(node,buildSceneManifest().npcs)' },
    { label: "the suggestion gate reads the town list again",
      find: '_bo=_bn?waresOfferedHere(_bn,man.local||man.npcs):[],_bi;/* #392 */', replace: '_bo=_bn?waresOfferedHere(_bn,man.npcs):[],_bi;' }
]);
process.exit(code);
