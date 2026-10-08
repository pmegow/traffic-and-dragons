// REVIEW PROBE p16: a door neither commit lists (and #541 does not name): the model-written COMPANION SHEET
// (parseCompanionSheet -> normalizeCompanionSheet, game.js). Its item, ability and spell names are kept verbatim. argv: <tree>
var L = require("./lib.js");
console.log("tree: " + L.TREE);
L.world("plain");
var resp = JSON.stringify({ gender: "F", cls: "Rogue", stats: { STR: 10, DEX: 15, CON: 12, INT: 10, WIS: 10, CHA: 12 }, maxHp: 12,
  inventory: ["Constructor", "Rope"], abilities: [{ nm: "constructor", ds: "Raises a wall of stone." }], spells: [{ nm: "Constructor (ritual)", lvl: 1 }, { nm: "__proto__", lvl: 1 }] });
var sheet = quiet(function () { return parseCompanionSheet(resp, "Kira"); }).r;
console.log("sheet accepted: " + !!sheet + " | inventory " + JSON.stringify(sheet && sheet.inventory) + " | abilities " + JSON.stringify(sheet && sheet.abilities.map(function (a) { return a.nm; })) + " | spells " + JSON.stringify(sheet && sheet.spells.map(function (s) { return s.nm; })));
var k = wsNpcByName("Kira"); k.charSheet = sheet; sheet.partyMember = true;
console.log("built-ins after attach: " + JSON.stringify(L.poison()));
console.log("mana pool (reads the capability bible by spell name): max " + manaMax(sheet) + " | per spell " + JSON.stringify(sheet.spells.map(function (s) { return manaSpellCost(s); })) + " | lookup('Constructor (ritual)') is a " + typeof capabilityLookup("Constructor (ritual)") + " | lookup('__proto__') is " + (capabilityLookup("__proto__") === Object.prototype ? "Object.prototype itself" : typeof capabilityLookup("__proto__")));
var p = ""; try { quiet(function () { buildSysPrompt(); }); p = "builds"; } catch (e) { p = "THROWS " + e.message; }
console.log("next prompt: " + p + " | built-ins: " + JSON.stringify(L.poison()));
var r1 = run("Kira hands it over. [COMPANION_ITEM_LOST:Kira|Constructor]");
console.log("the GM takes the item back by tag -> " + JSON.stringify(r1.muts) + " | Kira's pack " + JSON.stringify(sheet.inventory));
var r2 = run("Kira casts. [COMPANION_SPELL_USED:Kira|Constructor]");
console.log("the GM books her spell by its base name -> " + JSON.stringify(r2.muts) + " | handler errors " + JSON.stringify((r2.r && r2.r.errors) || []));
