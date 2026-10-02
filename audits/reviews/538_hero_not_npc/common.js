// Shared probe setup (reviewer). argv[2] = tree path. Loads the real engine from that tree through the author's harness.
var S = "C:/Users/hannu/AppData/Local/Temp/claude/C--Projects-traffic-and-dragons/0b524b92-af76-49d1-b6c9-f6ca4673077c/scratchpad";
process.env.ENGINE_ROOT = process.argv[2];
require(S + "/thu/vtags/harness.js");
global.TREE = process.argv[2];
// A world: hero Tess, NPC Bram (roster + memory), companion Frizwick with a bond to Bram and to the hero.
global.world = function (opts) {
  opts = opts || {};
  makeWorld(); delete worldState.kind; worldState.turn = 9;
  if (opts.hero) worldState.character.name = opts.hero;
  var h = worldState.character.name;
  worldState.npcs = [{ name: "Bram", status: "present", rel: "ally", met: 1, partyMember: false, pronouns: "he/him", portrait: null, aliases: [] }];
  memory.npcs = { Bram: { attitude: "", knowledge: [], events: [{ turn: 1, note: "met at the forge" }], aliases: [], pronouns: "he/him" } };
  worldState.npcs.push({ name: "Frizwick", status: "warm", rel: "companion", partyMember: true, met: 1, aliases: [], charSheet: { name: "Frizwick", hp: 9, maxHp: 9, inventory: [], conditions: [], relationships: [{ entity: "Bram", bond: "Friend", bondTurn: 1, dynamic: "", dynamicTurn: null }, { entity: h, bond: "Sworn", bondTurn: 1, dynamic: "", dynamicTurn: null }] } });
  memory.npcs["Frizwick"] = { attitude: "", knowledge: [], events: [], aliases: [], partyMember: true };
  if (opts.refs) { worldState.sceneRefs = { v: 1, refs: {}, turn: 9 }; if (typeof w2SceneRefsOn === "function") w2SceneRefsOn(); }
  return h;
};
// What the stores say about the player identity right now.
global.heroState = function () {
  var h = worldState.character.name, out = {};
  out.memKeysPlayer = Object.keys(memory.npcs).filter(function (k) { return memoryNpcIsPlayer(k); });
  out.rowsPlayer = worldState.npcs.filter(function (n) { return n && memoryNpcIsPlayer(n.name); }).map(function (n) { return n.name + (n.partyMember ? " [party]" : ""); });
  out.aliasPlayer = [];
  Object.keys(memory.npcs).forEach(function (k) { (memory.npcs[k].aliases || []).forEach(function (a) { if (memoryNpcIsPlayer(a)) out.aliasPlayer.push(k + " aka " + a); }); });
  worldState.npcs.forEach(function (n) { (n.aliases || []).forEach(function (a) { if (memoryNpcIsPlayer(a)) out.aliasPlayer.push("row " + n.name + " aka " + a); }); });
  out.heroResolves = resolveNpcName(h);
  out.epithets = (worldState.character.aliases || []).slice();
  var fz = wsNpcByName("Frizwick");
  out.frizBonds = fz && fz.charSheet ? fz.charSheet.relationships.map(function (r) { return r.entity + ":" + r.bond; }).join(",") : "(no Frizwick)";
  return out;
};
global.ver = function () { return APP_VERSION; };
global.P = function (label, v) { console.log(label + " " + (typeof v === "string" ? v : JSON.stringify(v))); };
