require("./h.js");
// #514 in an ADVENTURE with combat: a rostered hostile NPC (Garruk) and a bystander (Mira) at the party's node.
function world() {
  makeWorld(); delete worldState.kind; worldState.turn = 40; worldState.world.location = "Ashfen"; worldState.world.sublocation = "the mill";
  if (!memory.map) memory.map = { nodes: {}, edges: [], lastArrivalFrom: null };
  memory.map.nodes["Ashfen"] = { firstVisit: 1, visits: 3, description: null, parent: null, npcs: [], items: [], size: "small", travelMins: null };
  memory.map.nodes["Ashfen|the mill"] = { firstVisit: 1, visits: 2, description: null, parent: "Ashfen", npcs: [], items: [], size: "small", travelMins: null };
  ["Garruk", "Mira"].forEach(function (nm) { worldState.npcs.push({ name: nm, status: nm === "Garruk" ? "hostile, circling" : "watching", statusTurn: 39, rel: nm === "Garruk" ? "enemy" : "acquaintance", met: 1, partyMember: false, portrait: null, aliases: [] }); memory.npcs[nm] = { attitude: "", knowledge: [], events: [], aliases: [] }; });
  addComp("Bram", [], { cls: "Warrior", level: 3, hp: 20, maxHp: 20, abilities: [] }); memory.npcs.Bram = { attitude: "", knowledge: [], events: [], aliases: [] };
  worldState.turn = 38; sceneRefsEnsure(); worldState.turn = 40;
}
function st(label) {
  var man = buildSceneManifest();
  console.log("   [" + label + "] t" + worldState.turn + " combat=" + J(worldState.combat && { round: worldState.combat.round, enemies: (worldState.combat.enemies || []).map(function (e) { return e.name + ":" + e.hp; }) }) + " castLast=" + J(worldState.castLast) + "\n        local=" + J(man.local) + " npcs=" + J(man.npcs) + " antagonists=" + J(sceneAntagonists()) + " present: Garruk=" + scenePresentNow("Garruk") + " Mira=" + scenePresentNow("Mira"));
}
function turn(n, text) { worldState.turn = n; var r = run(text); console.log("   t" + n + " GM: " + J(text) + "\n        muts: " + J(r.muts.filter(function (m) { return /Present|Cast|cast|Combat|combat/.test(m); }))); return r; }
console.log("=== combat: a rostered foe, then a volunteered none mid-fight");
world();
turn(40, "[SCENE_CAST:Tess, Bram, Garruk, Mira]"); st("named cast");
turn(41, "Steel rings. [COMBAT_START:Garruk|30|14]"); st("combat starts");
turn(42, "You miss; he laughs. [SCENE_CAST:none]"); st("none mid-combat, no tag names Garruk");
turn(43, "[ENEMY_HP:Garruk|22]"); st("he is hit");
turn(44, "[SCENE_CAST:none] [ENEMY_HP:Garruk|15]"); st("none + hit in one reply");
turn(45, "[COMBAT_END]"); st("combat ends");
