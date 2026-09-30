// dev/sabotage-481-b2-cast-omits.js — proves the #481 B2 guards are guarded: a living, unsplit companion a non-none
// [SCENE_CAST:] leaves out stayed behind. Fable's named clause: "drop the exclusion". Each clause removes one part of the rule
// and the matching "#481 B2" test must fail. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-b2-cast-omits.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 B2"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("memory.js", [
  { label: "drop the exclusion (Fable's named clause): every companion is stamped at every arrival again",
    find: "for(i=0;i<who.length;i++){if(omit&&omit[who[i]]){out.push(who[i]);continue;}", replace: "for(i=0;i<who.length;i++){if(false){out.push(who[i]);continue;}",
    mustFail: "the t213 shape" }
]);
prove("identity.js", [
  { label: "the hero is omitted too (the hero is exempt)",
    mustFail: "a full cast, [SCENE_CAST:none] and no cast change nothing",
    find: "  for(i=0;i<npcs.length;i++){var n=npcs[i];if(!n||!n.partyMember)continue;if(typeof npcIsDead===\"function\"&&npcIsDead(n))continue;",
    replace: "  if(worldState.character&&worldState.character.name&&!cast[resolveNpcName(worldState.character.name)]){names.push(worldState.character.name);set[worldState.character.name]=1;}\n  for(i=0;i<npcs.length;i++){var n=npcs[i];if(!n||!n.partyMember)continue;if(typeof npcIsDead===\"function\"&&npcIsDead(n))continue;",
  },
  { label: "a companion's own line from bed places them at the destination again",
    find: "if(labels.indexOf(canon+\" (spoke, not in cast)\")<0)labels.push(canon+\" (spoke, not in cast)\");return;/* #481 B2", replace: "/* #481 B2",
    mustFail: "is not placed by their own speech" }
]);
prove("tag_table.js", [
  { label: "the withheld stamps are silent",
    find: "  if(_held&&_held.length)R.muts.push(\"⚠ Cast omits \"+", replace: "  if(false)R.muts.push(\"⚠ Cast omits \"+",
    mustFail: "the t213 shape" },
  { label: "the ask re-arms every turn (no cooldown)",
    find: "if(!_ol||_ol.key!==_ok||R.turn-_ol.turn>=PRESENCE_AUDIT_TURNS){", replace: "if(true){",
    mustFail: "the ping keeps a cooldown" },
  { label: "the ask never arms",
    find: "worldState.castOmitPing={turn:R.turn,names:_omit.names.slice(0,6)};", replace: "void 0;",
    mustFail: "the t213 shape" },
  { label: "the doc line stops saying what none means",
    find: "emit [SCENE_CAST:none] -- none means the whole party is here and no one else; a companion who is elsewhere is left out of a named cast.", replace: "emit [SCENE_CAST:none].",
    mustFail: "the SCENE_CAST doc line says what none means" }
]);
process.exit(code);
