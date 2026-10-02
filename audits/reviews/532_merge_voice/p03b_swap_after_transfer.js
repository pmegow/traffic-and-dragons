// Same root cause as p03 (the merge hands over charSheet without renaming charSheet.name), seen through the
// player-character swap: the adopted sheet becomes the hero under the OLD name, and neither name resolves to a speaker.
require("./h.js");
function vmap(name) { return quiet(function () { return speakerVoiceMap({ n: 1, s: { 0: name } }, '"Hold there."'); }).r; }
function row(name, pron) { memory.npcs[name] = { attitude: "", knowledge: [], events: [], aliases: [], pronouns: pron }; var r = { name: name, status: "present", rel: "neutral", pronouns: pron, met: 1, partyMember: false, portrait: null, aliases: [] }; worldState.npcs.push(r); return r; }
makeWorld(); worldState.npcs = []; memory.npcs = {};
var d = row("the hooded man", "he/him");
d.charSheet = { name: "the hooded man", gender: "M", cls: "Rogue", level: 1, hp: 8, maxHp: 8, inventory: [], abilities: [], spells: [], relationships: [], stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }, voiceId: "en_US-libritts_r-medium#7", voiceDirection: "low, unhurried" };
out("before: his line is read with", vmap("the hooded man"));
var m = run("He lowers the hood. [NPC_MERGE:Aldern Foxglove|the hooded man]");
out("merge", m.muts);
out("non-party survivor: Aldern's line is read with", vmap("Aldern Foxglove"));
var s = quiet(function () { return swapPlayerCharacter("Aldern Foxglove"); }).r;
out("swapPlayerCharacter('Aldern Foxglove')", s);
out("hero name after the swap", worldState.character.name);
out("hero line under 'Aldern Foxglove' is read with", vmap("Aldern Foxglove") || "(no speaker map -> narrator voice)");
out("hero line under 'the hooded man' is read with", vmap("the hooded man") || "(no speaker map -> narrator voice)");
