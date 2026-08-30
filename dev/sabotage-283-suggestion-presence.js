// sabotage-283-suggestion-presence.js — mutation proof for the #283 suggestion-manifest presence
// seam (Sol brief 35, joint-review lineage). The guard: buildSceneManifest consumes ONLY
// structured presence (unsplit party membership, #194-sourced lastSeenAt at the current node, and
// the active scene frame's observed[] channel with its frame-node guard) — never a prose scan of
// the last GM entry, whose polarity-blind name match let "Ameiko remains in Sandpoint, miles
// away" authorize Ameiko and disable the local-cap/absent-address rejection rules. And the ask
// half of the suggestion call (SUGGESTION_ASK) must demand the #141 {present, actions} object —
// the old bare-array demand in the highest-authority channel erased the checking space.
// Each clause must make dev/run-tests.js FAIL; a mutation changing no bytes is a hard failure.
// Usage: node dev/sabotage-283-suggestion-presence.js
var sabotage=require("./sabotage.js"),rc=0;

rc|=sabotage.prove({
  file:"game.js",
  command:["node",["dev/run-tests.js"]],
  cases:[
    { label:"#283: the observed[] consultation dies — sourced [SAY:] presence stops authorizing and the manifest under-serves the scene",
      mustFail:"#283: the active frame's observed[] channel",
      find:"  var _frame=worldState.sceneRefs&&worldState.sceneRefs.active;",
      replace:"  var _frame=null;" },

    { label:"#283: the frame-node guard dies — a stale frame from the previous scene authorizes its cast at the new node",
      mustFail:"#283: the active frame's observed[] channel",
      find:"     &&_frame.node!=null&&locResolve(String(_frame.node))===locResolve(nodeKey)){",
      replace:"     ){" },

    { label:"#283: the prose scan returns — a polarity-blind mention re-authorizes remote NPCs (the #194 door reopens)",
      mustFail:"#283 (brief 35①): a NEGATIVE mention cannot authorize presence",
      find:"  var _frame=worldState.sceneRefs&&worldState.sceneRefs.active;",
      replace:"  var tr=worldState.transcript;\n  if(tr instanceof Array&&tr.length){var lastGm=null;for(i=tr.length-1;i>=0;i--){if(tr[i]&&tr[i].r!==\"player\"){lastGm=tr[i];break;}}\n    if(lastGm&&lastGm.x){for(i=0;i<npcs.length;i++){if(npcs[i].dead)continue;if(new RegExp(\"\\\\b\"+suggestionNameAlt(npcs[i].name)+\"\\\\b\",\"i\").test(lastGm.x))addNpc(npcs[i].name);}}}\n  var _frame=worldState.sceneRefs&&worldState.sceneRefs.active;" },

    { label:"#283: the ask message regresses to the bare-array demand — the user channel erases the #141 checking space again",
      mustFail:"#283 (brief 35②): the suggestion ask message demands the #141 scene-check OBJECT",
      find:"var SUGGESTION_ASK=\"Suggest exactly 3 short actions the player could take next. FIRST take stock of who and what is actually present, then write the actions. Output ONLY one valid JSON object: {\\\"present\\\":\\\"one line listing who and what is in the scene\\\",\\\"actions\\\":[\\\"...\\\",\\\"...\\\",\\\"...\\\"]} — exactly 3 actions, each under 10 words, no prose, no markdown, no backticks.\";",
      replace:"var SUGGESTION_ASK=\"Suggest exactly 3 short actions the player could take next. Output ONLY a JSON array of 3 strings, each under 10 words.\";" }
  ]
});

process.exit(rc?1:0);
