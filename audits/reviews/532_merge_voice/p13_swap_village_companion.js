// Player-character swap, village residents, and the REAL automatic companion sheet path (generateCompanionSheet with the
// model stubbed), each in both trees.
//   node p13_swap_village_companion.js <before|after>
require("./h.js");
function vmap(name) { return quiet(function () { return speakerVoiceMap({ n: 1, s: { 0: name } }, "\"Hold there.\""); }).r; }
function row(name, pron) { memory.npcs[name] = { attitude: "", knowledge: [], events: [], aliases: [], pronouns: pron }; var r = { name: name, status: "present", rel: "neutral", pronouns: pron, met: 1, partyMember: false, portrait: null, aliases: [] }; worldState.npcs.push(r); return r; }
function fullSheet(name, extra) { var s = { name: name, gender: "M", cls: "Rogue", level: 2, xp: 0, hp: 10, maxHp: 10, gold: 0, inventory: [], abilities: [], spells: [], relationships: [], conditions: [], saveModifiers: [], languages: [], storyBeats: [], coreMemories: [], stats: { STR: 10, DEX: 12, CON: 10, INT: 10, WIS: 10, CHA: 10 } }, k; for (k in extra) s[k] = extra[k]; return s; }

// (a) swap
makeWorld(); worldState.npcs = []; memory.npcs = {};
worldState.character.voiceId = "en_US-libritts_r-medium#9"; worldState.character.voiceDirection = "dry, amused"; worldState.character.voiceRate = 1.05;
var v = row("Vane", "he/him"); v.partyMember = true;
v.charSheet = fullSheet("Vane", { voiceId: "en_US-libritts_r-medium#7", speechifyVoiceId: "vane-actor", voiceDirection: "gruff and impatient", voiceRate: 0.9 });
v.voiceId = "stale-row-copy"; v.voiceDirection = "stale-row-direction";
out("(a) before the swap: hero / Vane", [vmap("Tess"), vmap("Vane")]);
var s = quiet(function () { return swapPlayerCharacter("Vane"); }).r;
out("(a) swap", { ok: s.ok, from: s.from, to: s.to });
out("(a) after the swap: the new hero Vane is read with", vmap("Vane"));
out("(a) after the swap: the demoted Tess is read with", vmap("Tess"));
out("(a) Tess's row / sheet pins", [pins(wsNpcByName("Tess")), pins(wsNpcByName("Tess").charSheet)]);
var s2 = quiet(function () { return swapPlayerCharacter("Tess"); }).r;
out("(a) swap back", { ok: s2.ok, to: s2.to });
out("(a) after swapping back: Tess / Vane", [vmap("Tess"), vmap("Vane")]);
out("(a) Vane's row / sheet pins after the round trip", [pins(wsNpcByName("Vane")), pins(wsNpcByName("Vane").charSheet)]);

// (b) village residents: the library sheet carries its own pins; a sheetless duplicate merged into a resident
villageEF();
quiet(function () { importVillageResidents([{ character: fullSheet("Orsik", { voiceId: "en_US-libritts_r-medium#7", voiceDirection: "slow, kindly" }), updatedAt: 1000 }]); });
out("(b) resident Orsik is read with", vmap("Orsik"));
var st = row("the old smith", "he/him"); st.speechifyVoiceId = "smith-actor"; st.voiceRate = 0.9; st.voiceId = "en_US-libritts_r-medium#3";
var m = run("The old smith is Orsik. [NPC_MERGE:Orsik|the old smith]");
out("(b) merge", m.muts);
var o = wsNpcByName("Orsik");
out("(b) Orsik row / sheet pins after the merge", [pins(o), pins(o.charSheet)]);
out("(b) Orsik is read with", vmap("Orsik"));
out("(b) still a resident, not in the party", [o.resident === true, !!o.partyMember]);

// (c) the automatic companion sheet (PARTY_MEMBER -> generateCompanionSheet -> attachCompanionSheet), model stubbed
makeWorld(); worldState.npcs = []; memory.npcs = {};
var k = row("Kessa", "she/her"); k.partyMember = true; k.sheetPending = true;
k.voiceId = "en_US-libritts_r-medium#9"; k.speechifyVoiceId = "kessa-actor"; k.voiceDirection = "bright, quick"; k.voiceRate = 1.2;
global.callGM = function () { return Promise.resolve(JSON.stringify({ gender: "F", cls: "Rogue", stats: { STR: 10, DEX: 14, CON: 10, INT: 10, WIS: 10, CHA: 12 }, hp: 9, maxHp: 9, abilities: [], spells: [], inventory: ["Dagger"], voiceId: "model-voice", speechifyVoiceId: "model-actor", voiceDirection: "model-direction", voiceRate: 1.3 })); };
var oc = console.warn, oi = console.info; console.warn = function () {}; console.info = function () {};
generateCompanionSheet("Kessa").then(function () {
  console.warn = oc; console.info = oi;
  var n = wsNpcByName("Kessa");
  out("(c) Kessa has a sheet", !!n.charSheet);
  out("(c) row / sheet pins", [pins(n), pins(n.charSheet)]);
  out("(c) Kessa is read with", vmap("Kessa"));
});
