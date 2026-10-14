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
    find: ' + (accent ? " · " + accent : "") + (!compact && v.note', replace: ' + (!compact && v.note',
    mustFail: "voice accent: the picker's actorLabel places the accent" }
]);
process.exit(code ? 1 : 0);
