// REVIEW PROBE p11: forms that pass the #536 strip, taken through a REAL committed turn (commitGmTurn) and then through the
// derivations a turn cycle runs (engine notes, prompt, scene manifest, snapshots, the counter, retrieval, card rendering).
// Each is compared with the same reply carrying a one-letter-off control word. argv: <tree>
var L = require("./lib2.js");
var W = "constructor", C = L.controlOf(W);
function mk(word) {
  var cap = word.charAt(0).toUpperCase() + word.slice(1);
  return [
    ["item, plural", "You find them. [ITEM_GAINED:" + cap + "s]", "You hand them back. [ITEM_LOST:" + cap + "s]"],
    ["item, provenance", "You find it. [ITEM_GAINED:" + cap + " (from the smith)]", "You stow it. [ITEM_LOST:" + cap + " (from the smith)] [LOCATION_ITEM:" + cap + " (from the smith)|placed]"],
    ["companion item, plural", "Kira takes them. [COMPANION_ITEM_GAINED:Kira|" + cap + "s]", "Kira drops them. [COMPANION_ITEM_LOST:Kira|" + cap + "s]"],
    ["ability with a parenthetical", "A new trick. [ABILITY_GAINED:" + cap + " (lesser)|You raise a wall of stone.]", "Again. [ABILITY_GAINED:" + cap + " (greater)|You raise a tower.]"],
    ["companion ability with a parenthetical", "Kira learns. [COMPANION_ABILITY:Kira|" + cap + " (lesser)|She raises a wall.]", "Kira casts. [COMPANION_SPELL_USED:Kira|" + cap + "]"],
    ["spell definition with a parenthetical", "A working. [SPELL_DEF:" + cap + " (ritual)|range=30 ft|effect=raises a wall]", "Again. [SPELL_DEF:" + cap + " (ritual)|range=60 ft|effect=raises a tower]"],
    ["item definition with a parenthetical", "A thing. [ITEM_GAINED:Odd level] [ITEM_DEF:" + cap + " (old)|category=tool|effect=sets a true line]", "x [ITEM_DEF:" + cap + " (old)|category=tool|effect=sets a truer line]"],
    ["item left at the place, plural", "You leave them. [LOCATION_ITEM:" + cap + "s|placed]", "You take them. [LOCATION_ITEM:" + cap + "s|taken]"],
    ["wanted + wares, plural", "Bram wants some. [WANTED:" + cap + "s|5 gp|Bram] [WARES:" + cap + "s|5 gp|new]", "x [ITEM_GAINED:" + cap + "s]"],
    ["sub-location with an article", "You step in. [SUBLOCATION:The " + cap + "]", "You step out. [SUBLOCATION_LEAVE] [SUBLOCATION:the " + word + "]"],
    ["quest whose title carries display numbering", "A task. [QUEST:Arc 1: " + cap + "|active|do it]", "Done. [QUEST:Arc 1: " + cap + "|completed]"],
    ["scene handle that normalises to the word", "A figure. [SCENE_REF:" + word + "_|Bram]", "x [SCENE_REVEAL:-" + word + "-|Bram]"],
    ["party split, parenthetical place", "Kira goes. [PARTY_SPLIT:Kira|" + word + " (the yard)]", "Kira returns. [PARTY_SPLIT:Kira|rejoin]"],
    ["nested bracket hides an item", "x [TIME:dusk [ITEM_GAINED:" + word + "]", "y [ITEM_LOST:Rope]"]
  ];
}
function battery() {
  var out = [], c = worldState.character;
  function step(name, fn) { var v, t = ""; try { v = quiet(fn).r; } catch (e) { t = "THROWS " + String(e && e.message || e); } var s; try { s = t || JSON.stringify(v === undefined ? null : v); } catch (e2) { s = "unserialisable: " + e2.message; } var p = L.poison(); out.push({ name: name, out: String(s), poison: p }); }
  step("buildEngineNotes", function () { return buildEngineNotes(); });
  step("buildSysPrompt", function () { return buildSysPrompt(); });
  step("buildSceneManifest", function () { return buildSceneManifest(); });
  step("inventorySnapshot", function () { return inventorySnapshot(); });
  step("conditionSnapshot", function () { return conditionSnapshot(); });
  step("relationshipSnapshot", function () { return relationshipSnapshot(); });
  step("coreMemorySnapshot", function () { return coreMemorySnapshot(); });
  step("shopTradeCatalog", function () { return shopTradeCatalog(); });
  step("stashTradeCatalog", function () { return stashTradeCatalog(); });
  step("waysFromHere", function () { return waysFromHere(worldState, memory); });
  step("ragRetrieve", function () { return ragRetrieve("ask Bram about the bell and the forge"); });
  step("scanNpcNameVariants", function () { return scanNpcNameVariants(); });
  step("memoryTOC", function () { return memoryTOC(); });
  step("healAbilitySheets", function () { return healAbilitySheets(); });
  step("hereItemsLine", function () { return hereItemsLine(); });
  step("serializeWorldState", function () { return serializeWorldState(worldState); });
  step("abilityGroups(hero)", function () { return abilityGroups(c); });
  step("manaMax(hero)+costs", function () { return [manaMax(c)].concat((c.spells || []).map(function (s) { return manaSpellCost(s); })); });
  step("cards(hero abilities)", function () { return (c.abilities || []).map(function (a) { return bibleCardHTML(a.nm, capabilityLookup(a.nm)); }); });
  step("cards(Kira abilities)", function () { var k = findCompanionChar("Kira"); return ((k && k.abilities) || []).map(function (a) { return bibleCardHTML(a.nm, capabilityLookup(a.nm)); }); });
  step("itemLookup(pack)", function () { return (c.inventory || []).map(function (it) { var e = itemLookup(it); return e ? (typeof e) + ":" + JSON.stringify(e) : null; }); });
  step("buildItemBibleBlock", function () { return buildItemBibleBlock(); });
  step("itemDefAccept(pending)", function () { return (worldState.pendingItemDefs || []).map(function (p) { return itemDefAccept(p.key); }); });
  return out;
}
function scenario(reply1, reply2) {
  L.world("refs"); L.seed(5);
  var i; for (i = 1; i <= 4; i++) { logTranscript("player", "I ask Bram about the bell."); worldState.turn = i; logTranscript("gm", "Bram speaks of the bell and the forge, turn " + i + ".", "Bram speaks. [NPC:Bram|calm|ally]"); }
  worldState.turn = 9;
  var res = { t1: L.turn(reply1), b1: battery(), t2: L.turn(reply2), b2: battery(), state: "" };
  try { res.state = JSON.stringify({ ws: worldState, mem: memory }); } catch (e) { res.state = "serialise THROWS " + e.message; }
  res.scan = L.scanState(); L.unseed();
  return res;
}
console.log("tree: " + L.TREE);
var SW = mk(W), SC = mk(C), n, k;
for (n = 0; n < SW.length; n++) {
  var a = scenario(SW[n][1], SW[n][2]), b = scenario(SC[n][1], SC[n][2]), notes = [];
  function cmp(label, x, y) { var sx = L.subst(String(x), W, C); if (sx !== String(y)) { var d = L.firstDiff(sx, String(y)); notes.push(label + " differs @" + d.at + "\n         word   : " + JSON.stringify(d.a).slice(0, 260) + "\n         control: " + JSON.stringify(d.b).slice(0, 260)); } }
  ["t1", "t2"].forEach(function (t) {
    if (a[t].thrown) notes.push(t + " commitGmTurn THROWN: " + a[t].thrown.slice(0, 200));
    if (a[t].poison.length) notes.push(t + " wrote on built-ins: " + a[t].poison.join(", ").slice(0, 200));
    cmp(t + " summary", JSON.stringify(a[t].tag && a[t].tag.m), JSON.stringify(b[t].tag && b[t].tag.m));
    var thr = a[t].warns.filter(function (w) { return /threw/.test(w); }); if (thr.length) notes.push(t + " handler threw: " + thr.join(" ; ").slice(0, 200));
    cmp(t + " toasts", JSON.stringify(a[t].toasts), JSON.stringify(b[t].toasts));
  });
  ["b1", "b2"].forEach(function (bt) { for (k = 0; k < a[bt].length; k++) { if (a[bt][k].poison.length) notes.push(bt + " " + a[bt][k].name + " wrote on built-ins: " + a[bt][k].poison.join(", ").slice(0, 160)); cmp(bt + " " + a[bt][k].name, a[bt][k].out, b[bt][k].out); } });
  cmp("final state", a.state, b.state);
  if (a.scan.length) notes.push("state scan: " + a.scan.slice(0, 4).join(" | "));
  console.log((notes.length ? "!! " : "   ") + SW[n][0] + "\n     turn 1: " + SW[n][1] + "\n     turn 2: " + SW[n][2] + (notes.length ? "\n       " + notes.slice(0, 9).join("\n       ") + (notes.length > 9 ? "\n       (+" + (notes.length - 9) + " more differences)" : "") : "\n       same as the control in every step"));
}
