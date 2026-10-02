// Census by SPELLING of the player identity: the author's census used the sheet name only.
// For every person tag and every way memoryNpcIsPlayer says "this is the player" (sheet name in any case/padding, "player", an earned epithet),
// run the tag on a fresh world and report only the runs that leave damage. argv: <tree> [refs]
require("./common.js");
P("version", ver());
var TAGS = ["[NPC:H|grim|ally]", "[NPC_NOTE:H|keeps a list of debts]", "[NPC_FORGET:H|forge]", "[NPC_SUPERSEDE:H|old|new]", "[NPC_PRONOUN:H|she/her]", "[NPC_LINK:H|Bram|kin]", "[NPC_LINK:Bram|H|kin]", "[NPC_FACTION:H|The Guild|member]",
  "[NPC_ALIAS:H|Red Hand]", "[NPC_ALIAS:H|Bram]", "[NPC_ALIAS:Bram|H]", "[NPC_MERGE:H|Bram]", "[NPC_MERGE:Bram|H]", "[MERGE:npc|H|Bram]", "[MERGE:npc|Bram|H]", "[ALIAS:npc|Bram|H]", "[ALIAS:npc|H|Red Hand]", "[ALIAS:npc|H|Bram]",
  "[LOCATION_RESIDENT:H]", "[NPC_DEATH_REPORTED:H|a rider]", "[SCENE_REF:h1|H]", "[SCENE_REF:h1|?] [SCENE_REVEAL:h1|H]", "[SCENE_CAST:H, Bram]", "[SAY:H] \"Hello.\"", "[PARTY_MEMBER:H|true]", "[PARTY_MEMBER:H|false]", "[SHOP_KEEPER:H]",
  "[COMBAT_START:H|10|12|3|1d6|steady] [ENEMY_SLAIN:H] [COMBAT_END:victory]", "[RELATIONSHIP:H|ally|trusted]", "[COMPANION_RELATIONSHIP:Frizwick|H|ally|trusted]", "[COMPANION_RELATIONSHIP:H|Bram|ally|trusted]", "[COMPANION_HP:H|-1]", "[COMPANION_ITEM_GAINED:H|a knife]", "[COMPANION_XP:H|10]", "[COMPANION_CONDITION:H|poisoned]",
  "[PARTY_SPLIT:H|Ashfen Docks]", "[COMPANION_AGENDA:H|find the forge]", "[CORE_MEMORY:H|a vow]", "[WANTED:a knife|2 gp|H]", "[OUTFIT:H|a grey cloak]", "[WORN:H|Longsword|on]"];
function spellings(h, ep) { return [["sheet", h], ["UPPER", h.toUpperCase()], ["lower", h.toLowerCase()], ["padded", "  " + h + " "], ["player", "player"], ["Player", "Player"], ["epithet", ep], ["EPITHET", ep.toUpperCase()]]; }
function snap(h, ep) {
  var out = [], fz = wsNpcByName("Frizwick"), bonds = fz && fz.charSheet ? fz.charSheet.relationships.map(function (r) { return r.entity + ":" + r.bond; }).sort().join(",") : "(Frizwick gone)";
  var mk = Object.keys(memory.npcs).filter(function (k) { return memoryNpcIsPlayer(k); }); if (mk.length) out.push("memory record " + JSON.stringify(mk));
  var rk = worldState.npcs.filter(function (n) { return n && memoryNpcIsPlayer(n.name); }).map(function (n) { return n.name + (n.partyMember ? "[party]" : ""); }); if (rk.length) out.push("roster row " + JSON.stringify(rk));
  Object.keys(memory.npcs).forEach(function (k) { (memory.npcs[k].aliases || []).forEach(function (a) { if (memoryNpcIsPlayer(a)) out.push("'" + a + "' is an alias of " + k); }); });
  worldState.npcs.forEach(function (n) { (n.aliases || []).forEach(function (a) { if (memoryNpcIsPlayer(a)) out.push("'" + a + "' is a row alias of " + n.name); }); });
  if (!memory.npcs.Bram || !wsNpcByName("Bram")) out.push("Bram gone");
  if (bonds !== "Bram:Friend," + h + ":Sworn") out.push("companion bonds now " + bonds);
  [h, ep, "player"].forEach(function (n) { var r = resolveNpcName(n); if (r !== n) out.push("'" + n + "' resolves to " + r); });
  var eps = (worldState.character.aliases || []).join("|"); if (eps !== ep) out.push("epithets now " + eps);
  (worldState.character.aliases || []).forEach(function (a) { var o = (typeof npcExactOnFile === "function") ? npcExactOnFile(a) : ""; if (!o) { Object.keys(memory.npcs).forEach(function (k) { if (k.toLowerCase() === String(a).toLowerCase()) o = k; }); worldState.npcs.forEach(function (n) { if (String(n.name).toLowerCase() === String(a).toLowerCase()) o = n.name; }); } if (o) out.push("epithet '" + a + "' is also the NPC " + o); });
  var heroRel = (worldState.character.relationships || []).filter(function (r) { return r && memoryNpcIsPlayer(r.entity); }).map(function (r) { return r.entity; }); if (heroRel.length) out.push("hero has a bond with themself " + JSON.stringify(heroRel));
  return out;
}
var refs = process.argv[3] === "refs", total = 0, bad = 0;
TAGS.forEach(function (t) {
  var h0 = "Tess", ep = "the Butcher";
  spellings(h0, ep).forEach(function (sp) {
    var h = world({ refs: refs }); worldState.character.aliases = [ep];
    if (!memory.map) memory.map = { nodes: {}, edges: [], lastArrivalFrom: null };
    var tag = t.split("H|").join(sp[1] + "|").split("|H]").join("|" + sp[1] + "]").split(":H]").join(":" + sp[1] + "]").split(":H,").join(":" + sp[1] + ","), r, err = "";
    try { r = run("It happens. " + tag); } catch (e) { err = " THROW " + e.message; }
    total++;
    var s = snap(h, ep);
    if (s.length || err) { bad++; console.log("!! [" + sp[0] + "] " + tag + " -> " + s.join("; ") + err + " | " + JSON.stringify((r ? r.muts : []).slice(0, 3))); }
  });
});
console.log(total + " runs; " + bad + " left damage (scene refs " + (refs ? "ON" : "off") + ")");
