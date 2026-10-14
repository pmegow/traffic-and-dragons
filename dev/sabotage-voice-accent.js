// dev/sabotage-voice-accent.js — proves the voice picker's ACCENT (owner 2026-10-14: the actor line reads name · gender ·
// accent) is guarded: the table loses a region the live catalog carries, the parser reads the language instead of the
// region, and the label drops the accent segment. Each mutation must turn its named "voice accent" assertion red.
//   node dev/sabotage-voice-accent.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "voice accent"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "the table loses Nigerian — Amara, Chioma and Folake read as the bare code NG",
    find: 'IN:"Indian",NG:"Nigerian",', replace: 'IN:"Indian",',
    mustFail: "voice accent: voiceAccentOf reads the region" },
  { label: "the parser reads the LANGUAGE instead of the region (EN_NG → EN, every voice reads as its language code)",
    find: "var region=parts[parts.length-1].toUpperCase();", replace: "var region=parts[0].toUpperCase();",
    mustFail: "voice accent: voiceAccentOf reads the region" }
]);
prove("ui-voice-settings.js", [
  { label: "the label drops the accent segment (name · gender · description again)",
    find: ' + (accent ? " · " + accent : "") + (age ? " · " + age : "") + (note ? " · " + note : "")', replace: ' + (age ? " · " + age : "") + (note ? " · " + note : "")',
    mustFail: "voice accent: the picker's actorLabel places the accent" },
  /* owner 2026-10-14, the second ask: the age group */
  { label: "the label drops the age segment (name · gender · accent · description)",
    find: ' + (age ? " · " + age : "") + (note ? " · " + note : "")', replace: ' + (note ? " · " + note : "")',
    mustFail: "voice age: the Inworld actor carries ageGroup" },
  /* owner 2026-10-14, the third ask: the usage pitch is dropped */
  { label: "the label serves the vendor's description untrimmed again (the usage pitch crowds the list)",
    find: '((typeof voiceNoteTrim === "function") ? voiceNoteTrim(v.note) : v.note)', replace: 'v.note',
    mustFail: "voice note: actorLabel reads the note through voiceNoteTrim" }
]);
prove("helpers.js", [
  { label: "the age mapping loses middle_aged — 193 of 275 Inworld voices read as the raw 'Middle aged'",
    find: 'middle_aged:"Middle-aged",', replace: '',
    mustFail: "voice age: voiceAgeLabel maps the vendor's groups" },
  { label: "the trimmer forgets the marker word and the comma ('…voice, ideal' is left on the line)",
    find: ",?[ ]*(?:(?:ideal|perfect|great|well[- ]suited|suited|suitable)[ ]+)?for(?![A-Za-z]).*$/i", replace: "[ ]for(?![A-Za-z]).*$/i",
    mustFail: "voice note: voiceNoteTrim drops the usage clause" }
]);
prove("tts.js", [
  { label: "the cached row drops the age (every reload loses it again — the label never shows one)",
    find: "      if (v.age) row.age = _voiceClip(v.age, 16);", replace: "",
    mustFail: "voice age: the Inworld actor carries ageGroup" },
  { label: "the Inworld actor normaliser stops carrying ageGroup",
    find: ', age: v.ageGroup || ""', replace: '',
    mustFail: "voice age: the Inworld actor carries ageGroup" }
]);
process.exit(code ? 1 : 0);
