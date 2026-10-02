// The library doors that skip the hero by name: legacy characters (checkLegacyCharacter) and village residents (importVillageResidents).
require("./common.js");
P("version", ver());
var h = world(); if (!memory.map) memory.map = { nodes: {}, edges: [], lastArrivalFrom: null };
legacyCharsOn = true; legacyChancePct = 100; legacyLibCache = [{ character: { name: h, gender: "F", cls: "Warrior" } }];
quiet(function () { checkLegacyCharacter(); }); P("legacy pool = only the hero's own library copy -> pendingLegacy", worldState.pendingLegacy ? worldState.pendingLegacy.name : null);
legacyLibCache = [{ character: { name: h, gender: "F", cls: "Warrior" } }, { character: { name: "Morwen Zethran", gender: "F", cls: "Cleric" } }];
quiet(function () { checkLegacyCharacter(); }); P("legacy pool = hero + Morwen -> pendingLegacy", worldState.pendingLegacy ? worldState.pendingLegacy.name : null);
h = world(); worldState.kind = "village"; if (!memory.map) memory.map = { nodes: {}, edges: [], lastArrivalFrom: null };
var r = quiet(function () { return importVillageResidents([{ name: h, gender: "F", cls: "Warrior" }, { name: "Daeris", gender: "F", cls: "Cleric" }]); }).r;
P("village import", r); P("rows named like the hero", worldState.npcs.filter(function (n) { return memoryNpcIsPlayer(n.name); }).map(function (n) { return n.name; })); P("memory keys named like the hero", Object.keys(memory.npcs).filter(function (k) { return memoryNpcIsPlayer(k); }));
legacyCharsOn = false;
