// REVIEW PROBE p07: the village counter (the ledger sends its own tags through applyMuts) with a ware or a pack item whose
// name is a reserved word. How such a name gets there in AFTER: the chained [WARES:] tail (the strip sees only the first
// bracket), or "[ITEM_GAINED:Constructor x2]" (the pack ends up holding the bare name, see p03). argv: <tree>
var L = require("./lib.js");
function shopWorld() {
  makeWorld(); worldState.kind = "village"; worldState.world.location = "The Village"; worldState.world.sublocation = null; worldState.character.name = "Silas"; worldState.character.gold = 25;
  if (!memory.map) memory.map = { nodes: {}, edges: [], lastArrivalFrom: null };
  memory.map.nodes["The Village"] = { firstVisit: 1, visits: 3, description: null, parent: null, npcs: [], items: [], size: "small", travelMins: null };
  memory.map.nodes["The Village|the tavern"] = { firstVisit: 1, visits: 2, description: null, parent: "The Village", npcs: [], items: [], size: "small", travelMins: null };
  importVillageResidents([{ name: "Frizwick", gender: "F", cls: "Rogue" }, { name: "Daeris", gender: "F", cls: "Cleric" }]);
  worldState.turn = 12; worldState.clock = { min: 12 * MIN_PER_DAY + 10 * 60, schedule: [] };
  worldState.world.sublocation = "the trading post";
  memory.map.nodes["The Village|the trading post"] = { firstVisit: 1, visits: 1, description: null, parent: "The Village", npcs: [], items: [], size: "small", travelMins: null, wares: [], wanted: [] };
  memory.npcs["Frizwick"].lastSeenAt = "The Village|the trading post"; memory.npcs["Frizwick"].lastSeenTurn = 12;
  worldState.character.inventory = ["Longsword", "Rope x3"];
}
function wares() { return JSON.stringify((memory.map.nodes["The Village|the trading post"].wares || []).map(function (w) { return w.item + "@" + w.price; })); }
console.log("tree: " + L.TREE);
["constructor", "__proto__", "construqtor"].forEach(function (w) {
  console.log("=== word: " + w + (w === "construqtor" ? "  (control)" : ""));
  // A. the chained WARES form files a ware under the word
  shopWorld();
  var r = run("Frizwick lays out her stock. [SAY:Frizwick]\"Have a look.\" [WARES:Ale|1 gp|fresh]|" + w + "|5 gp|odd]");
  console.log("  A. chained [WARES:Ale|1 gp|fresh]|" + w + "|5 gp|odd] -> summary " + JSON.stringify(r.muts).slice(0, 200) + " | shelf " + wares() + " | built-ins: " + JSON.stringify(L.poison()));
  var cat, catErr = ""; try { cat = quiet(function () { return shopTradeCatalog(); }).r; } catch (e) { catErr = e.message; }
  console.log("     the counter's catalog: " + (catErr ? "THROWS " + catErr : (cat.ok ? "buy rows " + JSON.stringify(cat.buy.map(function (b) { return b.name + ":" + b.buyGp; })) : "not open: " + cat.reason)) + " | built-ins: " + JSON.stringify(L.poison()));
  // B. the player buys it at the counter
  var gold0 = worldState.character.gold, res, err = "", marks = { sell: {}, buy: {} }; marks.buy[w.toLowerCase()] = 1;
  try { res = quiet(function () { return shopTradeApply(marks); }).r; } catch (e2) { err = e2.message; }
  console.log("  B. buy one '" + w + "' at the counter -> " + (err ? "THROWS " + err : JSON.stringify({ ok: res.ok, reason: res.reason, line: res.line }).slice(0, 260)) + "\n     gold " + gold0 + " -> " + worldState.character.gold + " | pack " + JSON.stringify(worldState.character.inventory) + " | shelf " + wares() + " | built-ins: " + JSON.stringify(L.poison()));
  // C. a pack that holds the bare word (AFTER: reachable by [ITEM_GAINED:<Word> x2], whose handler throws after the first unit)
  shopWorld(); var cap = w.charAt(0).toUpperCase() + w.slice(1);
  var g = run("A gift. [ITEM_GAINED:" + cap + " x2]");
  console.log("  C. [ITEM_GAINED:" + cap + " x2] -> summary " + JSON.stringify(g.muts).slice(0, 160) + " | pack " + JSON.stringify(worldState.character.inventory) + " | handler errors " + JSON.stringify((g.r && g.r.errors) || []) + " | built-ins: " + JSON.stringify(L.poison()));
  var cat2, c2Err = ""; try { cat2 = quiet(function () { return shopTradeCatalog(); }).r; } catch (e3) { c2Err = e3.message; }
  console.log("     the counter's catalog: " + (c2Err ? "THROWS " + c2Err : (cat2.ok ? "sell rows " + JSON.stringify(cat2.sell.map(function (s) { return s.name + " x" + s.qty; })) : "not open: " + cat2.reason)) + " | built-ins: " + JSON.stringify(L.poison()));
  var s = run("You hand it over. [ITEM_LOST:" + cap + "] [GOLD:3]");
  console.log("     GM sale [ITEM_LOST:" + cap + "] [GOLD:3] -> summary " + JSON.stringify(s.muts).slice(0, 220) + " | pack " + JSON.stringify(worldState.character.inventory) + " | gold " + worldState.character.gold);
});
