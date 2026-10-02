// Class census (read-only): GM-written operands that are Object.prototype keys, through every common tag. argv: <tree>
process.env.ENGINE_ROOT = process.argv[2];
require("../thu/vtags/harness.js");
var WORDS = ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__", "isPrototypeOf", "Constructor", "The Constructor", "constructor Vale"];
var TAGS = ["[NPC:W|grim|neutral]", "[NPC_PRONOUN:W|he/him]", "[NPC_NOTE:W|a fact]", "[NPC_ALIAS:W|Other]", "[NPC_ALIAS:Bram|W]", "[SAY:W|Hello.]", "[SCENE_CAST:W]", "[SCENE_REF:h|W]",
  "[ITEM_GAINED:W]", "[ITEM_LOST:W]", "[LOCATION:W]", "[SUBLOCATION:W]", "[LOCATION_ITEM:W|here]", "[QUEST:W|active|do it]", "[QUEST_STEP:W|a step|true]", "[SPELL_USED:W]", "[ABILITY_GAINED:W]",
  "[CONDITION:W]", "[CONDITION_REMOVED:W]", "[FACTION:W|a group]", "[NPC_FACTION:Bram|W|member]", "[NPC_LINK:Bram|W|kin]", "[LORE:W|a thing]", "[LANGUAGE:W]", "[SKILL_SUCCESS:W]", "[RELATIONSHIP:W|ally]",
  "[PARTY_MEMBER:W|true]", "[COMPANION_HP:W|-1]", "[WARES:W|5]", "[ITEM_DEF:W|a thing]", "[SPELL_DEF:W|a thing]", "[FUTURE_EVENT:W|soon]", "[DECISION:W|chosen]", "[EXIT:W|north]", "[LOCATION_RESIDENT:W]",
  "[NPC_DEATH_REPORTED:W|a rider]", "[WORN:W]", "[SHOP_KEEPER:W]", "[COMBAT_START:W|10|12|3|1d6|steady]"];
var before = Object.getOwnPropertyNames(Object.prototype).join(","), beforeObj = Object.getOwnPropertyNames(Object).join(","), bad = [], n = 0;
WORDS.forEach(function (w) { TAGS.forEach(function (t) {
  makeWorld(); delete worldState.kind; worldState.turn = 9; worldState.npcs.push({ name: "Bram", status: "", rel: "ally", met: 1, partyMember: false, aliases: [] }); memory.npcs.Bram = { attitude: "", knowledge: [], events: [], aliases: [] };
  var tag = t.replace("W", w), res; n++;
  try { res = run("It happens. " + tag); if (res.r && res.r.errors && res.r.errors.length) bad.push(tag + " -> handler error: " + res.r.errors.join("; ")); }
  catch (e) { bad.push(tag + " -> THROW out of applyMuts: " + e.message); }
  try { buildSysPrompt(); } catch (e2) { bad.push(tag + " -> then buildSysPrompt THROWS: " + e2.message); }
  try { JSON.stringify(serializeWorldState ? serializeWorldState() : worldState); } catch (e3) { bad.push(tag + " -> then serialize THROWS: " + e3.message); }
}); });
console.log(n + " tag runs; problems: " + bad.length); bad.slice(0, 40).forEach(function (b) { console.log("  " + b); });
console.log("Object.prototype own names changed: " + (Object.getOwnPropertyNames(Object.prototype).join(",") !== before));
console.log("Object (constructor fn) gained properties: " + Object.getOwnPropertyNames(Object).filter(function (k) { return beforeObj.split(",").indexOf(k) < 0; }).join(", "));
