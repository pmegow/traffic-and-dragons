// dev/sabotage-481-b1-cast-presence.js — proves the #481 B1 cast rule is guarded: a non-none [SCENE_CAST:] decides who stands
// where the reply ends. Fable's named clause: "drop the R.castSet check". Each other clause removes one part of the rule and
// the matching "#481 B1" test must fail. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-b1-cast-presence.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 B1"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("identity.js", [
  { label: "drop the R.castSet check (Fable's named clause)",
    find: "var castCanon=null,ck;if(R&&R.castSet){", replace: "var castCanon=null,ck;if(false){",
    mustFail: "a speaker the cast leaves out gets no place" },
  { label: "[SCENE_CAST:none] withholds every speaker",
    find: "var p=m[1].trim();if(!p||/^none$/i.test(p))continue;if(!set)set={};", replace: "var p=m[1].trim();if(!p)continue;if(!set)set={};",
    mustFail: "no cast and [SCENE_CAST:none] keep today" },
  { label: "the out-of-cast speaker is not said",
    find: "wl.push(w);labels.push(w+\" (spoke, not in cast)\");", replace: "wl.push(w);",
    mustFail: "a speaker the cast leaves out gets no place" },
  { label: "the cast check is never armed",
    find: "  if(wl.length)worldState.castSpeakerPing=", replace: "  if(false)worldState.castSpeakerPing=",
    mustFail: "a speaker the cast leaves out gets no place" },
  { label: "a combatant is seen where the reply ends",
    find: "while((m=re.exec(text)))take(m[1],\"combat\",fightAt(m.index));\n  re=/\\[ENEMY_HP:", replace: "while((m=re.exec(text)))take(m[1],\"combat\");\n  re=/\\[ENEMY_HP:",
    mustFail: "a combatant is seen where the fight happened" }
]);
prove("memory.js", [
  { label: "the presence writer ignores the observed place",
    find: "  var key=atKey||currentNodeKey();/* UA9 */\n  if(typeof locResolve===\"function\")key=locResolve(key);/* #156B */\n  if(!memory.map.nodes[key])return false;\n  var _gbWs=",
    replace: "  var key=currentNodeKey();/* UA9 */\n  if(typeof locResolve===\"function\")key=locResolve(key);/* #156B */\n  if(!memory.map.nodes[key])return false;\n  var _gbWs=",
    mustFail: "a combatant is seen where the fight happened" }
]);
prove("api.js", [
  { label: "the cast check's registry row stops being combat-silent",
    find: "  buildCastSpeakerNote:{shape:\"one-shot-ask\",latch:[\"castSpeakerPing\"],combat:\"silent\",", replace: "  buildCastSpeakerNote:{shape:\"one-shot-ask\",latch:[\"castSpeakerPing\"],combat:\"fires\",",
    mustFail: "the cast note: one-shot" },
  { label: "the cast check is not one-shot (it never burns its latch)",
    find: "var buildCastSpeakerNote=oneShotPing(\"castSpeakerPing\",{name:\"buildCastSpeakerNote\",text:function(q){", replace: "var buildCastSpeakerNote=oneShotPing(\"castSpeakerPing\",{name:\"buildCastSpeakerNote\",text:function(q){worldState.castSpeakerPing=q;",
    mustFail: "the cast note: one-shot" },
  { label: "the volatile ask loses the wording",
    find: "naming every character standing where THIS reply ENDS, party members included", replace: "naming every character standing in the scene you are about to narrate",
    mustFail: "the doc line and the cast ask" }
]);
prove("tag_table.js", [
  { label: "the cast is never parsed",
    find: "  R.castSet=(typeof sceneCastSet===\"function\")?sceneCastSet(text):null;", replace: "  R.castSet=null;",
    mustFail: "a speaker the cast leaves out gets no place" },
  { label: "the doc line loses the wording",
    find: "the characters standing where THIS reply ENDS, party members included, close enough", replace: "the characters standing in the scene you are narrating, close enough",
    mustFail: "the doc line and the cast ask" }
]);
process.exit(code);
