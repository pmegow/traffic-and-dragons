// dev/sabotage-488-soundscape-note.js — proves the #488 SOUNDSCAPE-note guard is guarded (playtest v1.1078; owner 2026-09-30,
// "sharpen the GM's instructions"). The GM wrote enclosure=indoor;setting=settlement for a tavern: the note listed its words
// bare. Now the note's field sentence derives from the ONE vocabulary (AUDIO_PROFILE_FIELDS) plus AUDIO_FIELD_GLOSS, the
// ambiguous words carry their meaning, a room inside a building is named as sealed + interior, and nothing says "indoor".
// Each mutation runs in a disposable clone.
//   node dev/sabotage-488-soundscape-note.js
var sabotage = require("./sabotage.js"), rc = 0;
var CMD = ["node", ["dev/run-tests.js", "L7 accent layer"]], T = "#488 SOUNDSCAPE note";
rc |= sabotage.prove({ file: "api.js", command: CMD, cases: [
  { label: "the note goes back to a hand-copied, bare word list",
    find: "Values, these exact words only: \"+audioFieldTeaching()+\". A room inside a building",
    replace: "Values, these exact words only: enclosure open/covered/sealed/unspecified; setting settlement/wilderness/interior/subterranean/coast/unspecified; biome temperate/arid/tropical/frozen/unspecified; quiet normal/hushed/silent. A room inside a building",
    mustFail: T },
  { label: "the note no longer says what a room inside a building is",
    find: " A room inside a building (a taproom, a shop, a house) is enclosure=sealed;setting=interior, wherever the building stands.", replace: "",
    mustFail: T }
]});
rc |= sabotage.prove({ file: "audio-profile.js", command: CMD, cases: [
  { label: "the teaching sentence drops the meanings",
    find: "return g&&g[v]?v+\" (\"+g[v]+\")\":v;", replace: "return v;",
    mustFail: T },
  { label: "sealed loses its meaning",
    find: ",sealed:\"walls and a roof\"}", replace: "}",
    mustFail: T },
  { label: "interior is glossed with the word the GM turned into a value",
    find: "interior:\"inside any building\"", replace: "interior:\"indoors\"",
    mustFail: T },
  { label: "a gloss is written for a word the parser refuses",
    find: "enclosure:{open:\"under the sky\",", replace: "enclosure:{indoor:\"inside\",open:\"under the sky\",",
    mustFail: T },
  { label: "the vocabulary grows to accept the invented word",
    find: "enclosure:[\"open\",\"covered\",\"sealed\",\"unspecified\"],", replace: "enclosure:[\"open\",\"covered\",\"sealed\",\"indoor\",\"unspecified\"],",
    mustFail: T }
]});
process.exit(rc ? 1 : 0);
