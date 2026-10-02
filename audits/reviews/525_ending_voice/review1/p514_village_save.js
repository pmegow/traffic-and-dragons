require("./h.js");
// READ-ONLY: the owner's Village save in memory; a none reply, the scene manifest, the trade gate, the RESIDENTS ABOUT line.
var fs = require("fs");
var f = process.argv[2] || "C:/Projects/traffic-and-dragons/Campaigns/The_Village__Ammut_/saves/The_Village__Ammut__Ammut_t254.tnd";
var save = JSON.parse(fs.readFileSync(f, "utf8"));
worldState = inflateWorldStateSnapshot(save.worldState); memory = save.memory; sessionLog = save.sessionLog || [];
quiet(function () { migrateWorldState(); healMemory(); });
function st(label) {
  var man = buildSceneManifest();
  var tc = (typeof villageTradeContext === "function") ? quiet(function () { return villageTradeContext(); }).r : null;
  var geo = buildGeoBlock(), ra = (geo.match(/RESIDENTS ABOUT[^\n]*/) || [""])[0];
  var node = memory.map.nodes[locResolve(currentNodeKey())] || {};
  console.log("[" + label + "] t" + worldState.turn + " node=" + currentNodeKey() + " combat=" + !!worldState.combat +
    "\n   castLast=" + J(worldState.castLast) +
    "\n   frame=" + J(worldState.sceneRefs && worldState.sceneRefs.active && { node: worldState.sceneRefs.active.node, startTurn: worldState.sceneRefs.active.startTurn, observed: (worldState.sceneRefs.active.observed || []).map(function (o) { return o.entity + "@" + o.lastTurn; }) }) +
    "\n   man.local=" + J(man.local) + " man.seenHere=" + J(man.seenHere) +
    "\n   trade=" + J(tc && { ok: tc.ok, reason: tc.reason, keeper: tc.keeper, shop: tc.shop }) +
    "\n   node.keeper=" + J(node.keeper) + " node.hours=" + J(node.hours) + " shopOpenNow=" + (typeof shopOpenNow === "function" ? shopOpenNow(node) : "?") + " time=" + J(worldState.world.time) + " clock=" + (typeof clockTimeOfDay === "function" ? clockTimeOfDay() : "?") + " shopOpportunity=" + J(shopOpportunity()) +
    (process.argv[3] === "ra" ? "\n   " + ra.slice(0, 500) : ""));
}
console.log("hero " + worldState.character.name + ", party: " + livingPartyCompanions().map(function (n) { return n.name + (n.charSheet.splitLoc ? "(split)" : ""); }).join(", "));
st("as saved");
worldState.turn++;
var r = run("The tavern is quiet tonight. [SCENE_CAST:none]");
console.log("muts: " + J(r.muts));
st("after [SCENE_CAST:none]");
worldState.turn++;
r = run("[SAY:Thessa]\"Last call.\"");
console.log("muts: " + J(r.muts));
st("Thessa speaks");
