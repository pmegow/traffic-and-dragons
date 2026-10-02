// Another place that REPLACES a sheet without inheritVoicePins: adoptLibraryCompanion / adoptLibraryHero (game.js),
// reached by the village's refresh on entry (villageRefreshFromLibrary) and by "Replace from library" (libReplaceApply).
// A resident's voice, direction and speed set on their card in THIS campaign vs a newer library copy that carries none.
require("./h.js");
function vmap(name) { return quiet(function () { return speakerVoiceMap({ n: 1, s: { 0: name } }, '"Hold there."'); }).r; }
var LIB = { name: "Daeris", gender: "F", cls: "Cleric", level: 3, inventory: [], abilities: [], spells: [], relationships: [], stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 14, CHA: 12 }, hp: 20, maxHp: 20 };

// 1) the village refresh on entry
villageEF();
var d = wsNpcByName("Daeris");
out("village: Daeris has a sheet", !!d.charSheet);
quiet(function () { pinAutoCastVoices({ n: 1, s: { 0: "Daeris" } }); });
d.charSheet.speechifyVoiceId = "narrator-like-actor"; d.charSheet.voiceDirection = "warm, unhurried"; d.charSheet.voiceRate = 0.95;   // what the card's controls write (csWireVoice -> sheet)
var before = pins(d.charSheet);
out("village: her sheet pins before the refresh", before);
out("village: her line is read with", vmap("Daeris"));
var r = quiet(function () { return villageRefreshFromLibrary([{ character: LIB, updatedAt: Date.now() }]); }).r;
out("village: refresh result", { refreshed: r.refreshed, kept: r.kept });
d = wsNpcByName("Daeris");
out("village: her sheet pins after the refresh", pins(d.charSheet));
out("village: row pins after the refresh", pins(d));
quiet(function () { pinAutoCastVoices({ n: 1, s: { 0: "Daeris" } }); });
out("village: her next line is read with", vmap("Daeris"));

// 2) "Replace from library" on a companion in an adventure
makeWorld();
addComp("Bram", [], { gender: "M", voiceId: "en_US-libritts_r-medium#7", speechifyVoiceId: "picked-actor", voiceDirection: "gruff and impatient", voiceRate: 0.9 });
out("adventure: Bram's sheet pins before Replace", pins(wsNpcByName("Bram").charSheet));
var rr = quiet(function () { return libReplaceApply("Bram", { name: "Bram", gender: "M", cls: "Warrior", level: 5, inventory: [], relationships: [] }, Date.now()); }).r;
out("adventure: libReplaceApply", rr);
out("adventure: Bram's sheet pins after Replace", pins(wsNpcByName("Bram").charSheet));

// 3) the hero
makeWorld();
worldState.character.voiceId = "en_US-libritts_r-medium#9"; worldState.character.speechifyVoiceId = "hero-actor"; worldState.character.voiceDirection = "dry, amused"; worldState.character.voiceRate = 1.05;
out("hero: pins before Replace", pins(worldState.character));
var hr = quiet(function () { return libReplaceApply("Tess", { name: "Tess", gender: "F", cls: "Warrior", level: 2, inventory: [], relationships: [] }, Date.now()); }).r;
out("hero: libReplaceApply", hr);
out("hero: pins after Replace", pins(worldState.character));
