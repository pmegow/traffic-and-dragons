// dev/sabotage-543-voice-keep.js — proves the #543 guards are guarded: a library replace (hero, companion, the Village
// refresh through the same adopters) keeps a voice field the copy lacks and takes the copy's own; the hero's keep runs
// before the cast; a kept voice of the known other sex is refused; a fallen companion's rejoin takes the live card's
// voice, a clear included. Each mutation runs in a disposable clone (sabotage.js proveScratch); nothing here touches
// the working tree.
//   node dev/sabotage-543-voice-keep.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "#543"]], cases: cases }); }
prove("game.js", [
  { label: "the hero adopter drops the live voices again",
    find: '  voicePinsFill(hero,[worldState.character],voicePinFitsGender(hero.gender));', replace: '',
    mustFail: "keeps the hero's voices" },
  { label: "the hero's keep runs after the cast, so every slot is cast again",
    find: '  voicePinsFill(hero,[worldState.character],voicePinFitsGender(hero.gender));/* #543: before the cast, so only a slot still empty is cast */\n  if(typeof TTS!=="undefined"&&TTS.assignCharacterVoices)TTS.assignCharacterVoices(hero);',
    replace: '  if(typeof TTS!=="undefined"&&TTS.assignCharacterVoices)TTS.assignCharacterVoices(hero);\n  voicePinsFill(hero,[worldState.character],voicePinFitsGender(hero.gender));',
    mustFail: "keeps the hero's voices" },
  { label: "the hero keeps a voice of the other sex",
    find: 'voicePinsFill(hero,[worldState.character],voicePinFitsGender(hero.gender));', replace: 'voicePinsFill(hero,[worldState.character]);',
    mustFail: "a kept voice of the known other sex" },
  { label: "the companion adopter drops the live voices again",
    find: '  if(n.charSheet)voicePinsFill(sheet,[n.charSheet],voicePinFitsGender(sheet.gender));', replace: '',
    mustFail: "Replace from library on a companion" },
  { label: "the rejoin puts the parked copy back with no voice handoff",
    find: 'if(n.charSheet)voicePinsMirror(rec.sheet,n.charSheet);/* #543 */', replace: '',
    mustFail: "fallen companion rejoins" }
]);
prove("helpers.js", [
  { label: "the fill overwrites the copy's own value with the live one",
    find: '    if(owner[f[i]])continue;\n', replace: '',
    mustFail: "Replace from library on a companion" },
  { label: "the rejoin's mirror never removes a field cleared on the card",
    find: 'else delete target[f[i]];}', replace: '}',
    mustFail: "fallen companion rejoins" },
  { label: "the sex check accepts every voice",
    find: 'return !vg||vg===gender;', replace: 'return true;',
    mustFail: "a kept voice of the known other sex" }
]);
prove("tts.js", [
  { label: "pinnedVoiceGender never reads the slot's catalog",
    find: 'if (v && v.id === id && (v.g === "M" || v.g === "F")) gender = v.g;', replace: '',
    mustFail: "a kept voice of the known other sex" }
]);
process.exit(code);
