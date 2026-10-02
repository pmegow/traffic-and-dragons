// dev/sabotage-104-debrand.js — proves the #104 guards are guarded (owner ruling 2026-10-02: no author or
// series name anywhere in the shipped prose voices; seven voices offered; a retired voice stays on the
// campaign that carries it). Two gates: the VOICE LAB CONTRACT at the top of run-tests.js (the shipping
// guarantee, the controls file kept out of the shell) and the #104 engine section (the one picker filter).
// Each mutation runs in a disposable clone.
//   node dev/sabotage-104-debrand.js
var sabotage = require("./sabotage.js"), rc = 0;
var GATE = ["node", ["dev/run-tests.js", "repairModelJson"]];
var ENGINE = ["node", ["dev/run-tests.js", "#104 the prose voices"]];
var SHIP = "an author or series name is shipping in the prose-voice table";

rc |= sabotage.prove({ file: "data.js", command: GATE, cases: [
  { label: "a research surname comes back in a shipped blurb",
    find: "blurb:\"Lean, brutal economy and dark wit.\"", replace: "blurb:\"Lean, brutal economy and dark wit, after Abercrombie.\"",
    mustFail: SHIP },
  { label: "a series title comes back at the head of a shipped directive",
    find: "vc:\"Fast, punchy, irreverent, and aggressively modern", replace: "vc:\"Dungeon Crawler Carl. Fast, punchy, irreverent, and aggressively modern",
    mustFail: SHIP },
  { label: "a signature character's name comes back inside the content DNA",
    find: "Companions are drawn into the protagonist's doom", replace: "Companions, like Elric's, are drawn into the protagonist's doom",
    mustFail: SHIP }
]});
rc |= sabotage.prove({ file: "index.html", command: GATE, cases: [
  { label: "the research names load with the app shell",
    /* single quotes on purpose: the DOC FACTS load-order contract parses double-quoted src tags and would
       catch a double-quoted one first; this proves ⑨ itself catches a tag that slips past it */
    find: "<script src=\"data.js\"></script>", replace: "<script src=\"data.js\"></script><script src='dev/author-controls.js'></script>",
    mustFail: "index.html loads dev/author-controls.js" }
]});
rc |= sabotage.prove({ file: "author_voice_lab.html", command: GATE, cases: [
  { label: "the lab stops loading the controls — its control arm has no directives",
    find: "<script src=\"dev/author-controls.js\"></script>", replace: "<script src=\"dev/author-controls-moved.js\"></script>",
    mustFail: "no longer loads dev/author-controls.js" }
]});
rc |= sabotage.prove({ file: "dev/author-controls.js", command: GATE, cases: [
  { label: "a controls entry names a voice that is not in the shipped table",
    find: "var AUTHOR_CONTROLS={", replace: "var AUTHOR_CONTROLS={\n  ghost:{nm:\"Ghost Writer\",marks:[\"Ghost\"],vc:\"a directive long enough to clear the fifty-character floor of the contract\"},",
    mustFail: "has no matching voice in data.js" },
  { label: "the research record thins out to a handful of entries — the forbidden-word source goes blind",
    find: /^  (gaiman|clines|cook|wells|abnett|rice|poe|howard|leguin):\{[^\n]*\n/gm, replace: "",
    mustFail: "the research record is the forbidden-word source and cannot be thin" }
]});

rc |= sabotage.prove({ file: "helpers.js", command: ENGINE, cases: [
  { label: "the campaign's own retired voice vanishes from its picker",
    find: "return a&&(!a.hidden||(selectedId!=null&&a.id===selectedId));", replace: "return a&&!a.hidden;",
    mustFail: "the campaign's own retired voice is shown in its place" },
  { label: "every retired voice is offered again",
    find: "return a&&(!a.hidden||(selectedId!=null&&a.id===selectedId));", replace: "return !!a;",
    mustFail: "a hidden voice is off the list" }
]});
rc |= sabotage.prove({ file: "ui-modals.js", command: ENGINE, cases: [
  { label: "the prose modal walks the whole table again",
    find: "radioRowsHTML(\"pr-row\",visibleAuthors(AUTHORS,sel),sel,", replace: "radioRowsHTML(\"pr-row\",AUTHORS,sel,",
    mustFail: "the prose modal must list visibleAuthors(AUTHORS,sel)" }
]});
rc |= sabotage.prove({ file: "data.js", command: ENGINE, cases: [
  { label: "an eighth voice is offered (a retired flag dropped)",
    find: "nm:\"Velvet Night\",blurb:\"Lush, sensual, immortal melancholy.\",hidden:true,", replace: "nm:\"Velvet Night\",blurb:\"Lush, sensual, immortal melancholy.\",",
    mustFail: "the owner's seven, in table order" }
]});
rc |= sabotage.prove({ file: "api.js", command: ENGINE, cases: [
  { label: "the STYLE sentence asks the reader to recognise the author again",
    find: "a reader should recognise the voice from rhythm", replace: "a reader should recognise the author from rhythm",
    mustFail: "the STYLE sentence lost its wording" }
]});
process.exit(rc ? 1 : 0);
