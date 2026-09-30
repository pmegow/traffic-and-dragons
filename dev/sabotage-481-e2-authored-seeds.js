// dev/sabotage-481-e2-authored-seeds.js — proves the #481 E2 guards are guarded: every AUDIO_SCENES seed is authored data
// (Fable's named clause: restore the profilePolicy gate), the hushed halving stays, a chosen seed's accents ride for a
// classified place, and they stay subject to the profile's forbid. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-e2-authored-seeds.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "Interior hearth defaults"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("ambient.js", [
  { label: "restore the profilePolicy gate (Fable's named clause): only dusk, night and the tavern are authored again",
    find: "  if (!ambientSceneMatches(s, scene)) return false;", replace: "  if (!ambientSceneMatches(s, scene) || [\"village-dusk-noctina\",\"village-night\",\"tavern\"].indexOf(scene.id) < 0) return false;",
    mustFail: "#481 E2 the classified village square" },
  { label: "the hushed halving is lost",
    find: "(s.profile && s.profile.quiet === \"hushed\" ? 0.5 : 1)", replace: "1",
    mustFail: "#481 E2 the classified village square" }
]);
prove("audio-accents.js", [
  { label: "a classified place gets no seed accents (the tavern's footsteps are lost)",
    find: "  return (sc && sc.bind) ? sc : null;", replace: "  return (sc && sc.bind && !snapshot.classified) ? sc : null;",
    mustFail: "#481 E2 the t202 tavern plays its crowd bed AND its authored footsteps" },
  { label: "seed accents ignore the profile's forbid (footsteps with no one about)",
    find: "        return !((a.needsAny || []).length && a.needsAny.every(function(c) { return pf.forbid.indexOf(c) >= 0; }));   /* no one about */", replace: "        return true;",
    mustFail: "#481 E2 the t202 tavern plays its crowd bed AND its authored footsteps" }
]);
process.exit(code);
