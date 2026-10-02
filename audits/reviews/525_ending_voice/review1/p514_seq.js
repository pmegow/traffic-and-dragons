require("./h.js");
// #514 sequences. Fixture = the engine tests' b4Tavern/w514 (Village tavern, hero Silas, residents Frizwick/Daeris/Victor, companion Bram).
function tavern() {
  villageEF(); worldState.turn = 205; delete worldState.castLast; delete worldState.sceneRefs;
  importVillageResidents([{ name: "Victor Marlow", gender: "M", cls: "Fighter", trait: "Talks over everyone.", flaw: "Owes money." }]);
  memory.npcs["Victor Marlow"].lastSeenAt = "The Village|the tavern"; memory.npcs["Victor Marlow"].lastSeenTurn = 28;
  memory.npcs["Frizwick"].lastSeenAt = "The Village|the tavern"; memory.npcs["Frizwick"].lastSeenTurn = 205;
  worldState.turn = 200; sceneRefsEnsure(); worldState.turn = 205;
  worldState.world.sublocation = "the tavern";
  worldState.npcs.push({ name: "Bram", status: "steady", rel: "ally", partyMember: true, charSheet: { name: "Bram", cls: "Warrior", level: 3, inventory: [], abilities: [] } });
  memory.npcs.Bram = { attitude: "", knowledge: [], events: [], aliases: [] };
}
function state(label) {
  var man = buildSceneManifest();
  console.log("   [" + label + "] t" + worldState.turn + " node=" + currentNodeKey() + " castLast=" + J(worldState.castLast) + "\n        local=" + J(man.local) + " | present: Friz=" + scenePresentNow("Frizwick") + " Victor=" + scenePresentNow("Victor Marlow") + " Daeris=" + scenePresentNow("Daeris") + " Bram=" + scenePresentNow("Bram") + " | pings: speaker=" + J(worldState.castSpeakerPing) + " omit=" + J(worldState.castOmitPing));
}
function turn(n, text) { worldState.turn = n; var r = run(text); console.log("   t" + n + " GM: " + J(text) + "\n        muts: " + J(r.muts.filter(function (m) { return /Present|Cast|cast/.test(m); }))); return r; }
function scen(title, fn) { console.log("\n=== " + title); tavern(); fn(); }

scen("1. case/spacing variants of none (each after a named cast that placed Frizwick)", function () {
  ["[SCENE_CAST:none]", "[SCENE_CAST:None]", "[SCENE_CAST: NONE ]", "[SCENE_CAST:none.]", "[SCENE_CAST:nobody]", "[SCENE_CAST:no one]", "[SCENE_CAST:]", "[SCENE_CAST:none|]", "[SCENE_CAST:none, none]", "[SCENE_CAST:None (the party is alone)]", "[SCENE_CAST:—]", "[SCENE_CAST:none ]\n", "[SCENE_CAST:empty]", "[SCENE_CAST:the party]"].forEach(function (v) {
    tavern(); run("[SCENE_CAST:Silas, Bram, Frizwick]"); worldState.turn = 206; delete worldState.castOmitPing; delete worldState.castSpeakerPing;
    var r = run("The room empties. " + v);
    console.log("   " + J(v) + " -> Frizwick present=" + scenePresentNow("Frizwick") + " castLast=" + J(worldState.castLast) + " omitPing=" + J(worldState.castOmitPing) + " muts=" + J(r.muts.filter(function (m) { return /Present|Cast|cast/.test(m); })));
  });
});
scen("2. none + a second named cast in the same reply (both orders)", function () {
  turn(205, "[SCENE_CAST:Silas, Bram, Frizwick]"); turn(206, "[SCENE_CAST:none] ... [SCENE_CAST:Silas, Bram, Daeris]"); state("none then named");
  tavern(); turn(205, "[SCENE_CAST:Silas, Bram, Frizwick]"); turn(206, "[SCENE_CAST:Silas, Bram, Daeris] ... [SCENE_CAST:none]"); state("named then none");
});
scen("3. party split: Bram is elsewhere when the GM says none", function () {
  turn(205, "[SAY:Bram]\"I'll check the mill.\" [SCENE_CAST:Silas, Bram, Frizwick]"); state("before");
  turn(206, "[PARTY_SPLIT:Bram|The Village|the mill]"); state("after split");
  turn(207, "[SCENE_CAST:none]"); state("none while split");
  console.log("   Bram splitLoc=" + J(wsNpcByName("Bram").charSheet.splitLoc) + " in castLast.names=" + (worldState.castLast.names.indexOf("Bram") >= 0));
});
scen("4. a dead companion", function () {
  wsNpcByName("Bram").dead = 204; turn(205, "[SCENE_CAST:none]"); state("none with dead Bram");
});
scen("5. speaker in the none reply, then quiet turns, then another none", function () {
  turn(205, "[SCENE_CAST:Silas, Bram, Frizwick]");
  turn(206, "[SCENE_CAST:none]\nThe door bangs. [SAY:Victor Marlow]\"Any ale left?\""); state("none + Victor speaks");
  turn(207, "Rain on the shutters."); state("quiet turn after");
  turn(208, "[SCENE_CAST:none]"); state("second none");
});
scen("6. goodbye then none at the END of the reply (the row's known limit)", function () {
  turn(205, "[SAY:Frizwick]\"Goodnight, then.\" She leaves. [SCENE_CAST:none]"); state("goodbye + none");
});
scen("7. location change in the same reply as none", function () {
  turn(205, "[SCENE_CAST:Silas, Bram, Frizwick]"); state("tavern");
  turn(206, "You walk to the Hall. [SUBLOCATION:the Village Hall] [SCENE_CAST:none]"); state("arrived at the Hall with none");
  turn(207, "You walk back. [SUBLOCATION:the tavern]"); state("back in the tavern, no cast");
  turn(208, "[SAY:Frizwick]\"Back already?\""); state("she speaks");
});
scen("8. none at the tavern, leave, come back (the stale none must not hide a fresh sighting)", function () {
  turn(205, "[SCENE_CAST:none]"); state("none");
  turn(206, "[SUBLOCATION:the Village Hall]"); turn(207, "[SUBLOCATION:the tavern] [SAY:Frizwick]\"Evening.\""); state("back + she speaks");
  turn(208, "Quiet."); state("next turn");
});
