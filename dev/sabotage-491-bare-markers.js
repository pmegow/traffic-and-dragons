// dev/sabotage-491-bare-markers.js — proves the #491 guard is guarded (playtest v1.1078, the cache-on run, turn 2). The GM
// wrote a death's two transaction markers without brackets; the engine withheld the loot and printed the markers in the story.
// Now a marker LINE gets its brackets back before the parser (applyMuts) or the strip (cleanTxt) looks at the text, through one
// function (tagRestoreBareMarkers, tag_table.js). Each mutation runs in a disposable clone.
//   node dev/sabotage-491-bare-markers.js
var sabotage = require("./sabotage.js"), rc = 0;
var CMD = ["node", ["dev/run-tests.js", "class bible (#72)"]], T = "#491 a canon envelope whose two markers lost their brackets";
rc |= sabotage.prove({ file: "api.js", command: CMD, cases: [
  { label: "the parser never restores the markers (the death is refused and the loot withheld again)",
    find: "  text=tagRestoreBareMarkers(text);/* #491: before EVERYTHING", replace: "  /* #491: before EVERYTHING",
    mustFail: T },
  { label: "the strip never restores them (the markers print in the story)",
    find: "  t=tagRestoreBareMarkers(t,true);/* #491:", replace: "  /* #491:",
    mustFail: T },
  { label: "the strip warns on every repaint",
    find: "  t=tagRestoreBareMarkers(t,true);/* #491:", replace: "  t=tagRestoreBareMarkers(t);/* #491:",
    mustFail: T }
]});
rc |= sabotage.prove({ file: "tag_table.js", command: CMD, cases: [
  { label: "a marker inside a sentence is restored (prose is read as a tag)",
    find: "var TAG_BARE_MARKER_RE=/^([ \\t]*)(CANON_TXN_BEGIN:", replace: "var TAG_BARE_MARKER_RE=/([ \\t]*)(CANON_TXN_BEGIN:",
    mustFail: T },
  { label: "a marker followed by prose on its line is restored",
    find: "|CANON_TXN_END:[^\\s|\\[\\]]+)(?=[ \\t]*(?:\\[|$))/gm;", replace: "|CANON_TXN_END:[^\\s|\\[\\]]+)/gm;",
    mustFail: T },
  { label: "a three-field line counts as a BEGIN marker",
    find: "(CANON_TXN_BEGIN:(?:[^|\\[\\]\\r\\n]+\\|){4}", replace: "(CANON_TXN_BEGIN:(?:[^|\\[\\]\\r\\n]+\\|){2,4}",
    mustFail: T },
  { label: "the slip is silent (nobody learns the GM dropped its brackets)",
    find: "  if(n&&!quiet&&typeof console!==\"undefined\")console.warn(\"[tags] #491: \"", replace: "  if(false)console.warn(\"[tags] #491: \"",
    mustFail: T },
  { label: "a non-string input is coerced instead of passed through",
    find: "  if(typeof text!==\"string\"||text.indexOf(\"CANON_TXN_\")<0)return text;", replace: "  text=String(text==null?\"\":text);if(text.indexOf(\"CANON_TXN_\")<0)return text;",
    mustFail: T }
]});
process.exit(rc ? 1 : 0);
