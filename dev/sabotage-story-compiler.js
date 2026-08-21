// sabotage-story-compiler.js — prove the TODO #5 story-compiler clauses are not decorative.
//
//   node dev/sabotage-story-compiler.js
//
// Each case removes exactly ONE load-bearing clause from story_compiler.html; the named
// assertion in dev/tests-5-story-compiler.js must turn red, and sabotage.js restores the file
// byte-identically after every case (a mutation that changes no bytes is a hard FAILURE).
// The suite is a co-changed working file, so it rides into the scratch clone via `also`.
var sabotage = require("./sabotage.js"), rc = 0;
var FILE = "story_compiler.html";
var ALSO = ["dev/tests-5-story-compiler.js"];
var CMD = ["node", ["dev/tests-5-story-compiler.js"]];

rc |= sabotage.prove({
  file: FILE, command: CMD, also: ALSO, cases: [

    // ── decision ③: the machine-readable block contract ────────────────────
    {
      label: "the .act class is renamed — every downstream fold/person pass goes blind",
      mustFail: ".act blocks = every player action",
      find: "out.push(\"<div class=\\\"act\\\" data-turn=\\\"\"+e.turn+\"\\\">\"+esc(e.text)+\"</div>\");",
      replace: "out.push(\"<div class=\\\"action\\\" data-turn=\\\"\"+e.turn+\"\\\">\"+esc(e.text)+\"</div>\");"
    },
    {
      label: "GM blocks lose their data-turn — a passage can no longer be traced to its turn",
      mustFail: "every act/gm block carries its own data-turn",
      find: "out.push(\"<div class=\\\"gm\\\" data-turn=\\\"\"+e.turn+\"\\\">\"",
      replace: "out.push(\"<div class=\\\"gm\\\">\""
    },

    // ── untrusted prose ────────────────────────────────────────────────────
    {
      label: "player prose stops being escaped — model/player text becomes live markup",
      mustFail: "player/model text is escaped",
      find: "\"\\\">\"+esc(e.text)+\"</div>\");",
      replace: "\"\\\">\"+e.text+\"</div>\");"
    },

    // ── what the book must not print ───────────────────────────────────────
    {
      label: "retconned passages print again — the book contradicts itself",
      mustFail: "stats count what was used AND what was left out",
      find: "    if(e.rc)return \"retconned\";",
      replace: ""
    },
    {
      label: "malformed entries are no longer recognised — a null entry throws mid-compile",
      mustFail: "null / non-object / role-less / blank entries are skipped and counted",
      find: "    if(!e||typeof e!==\"object\")return \"malformed\";",
      replace: ""
    },

    // ── segmentation ───────────────────────────────────────────────────────
    {
      label: "chapter advance removed — the whole campaign collapses into chapter one",
      mustFail: "chapters segment on the memory tier's own boundaries",
      find: "      while(ci<chapters.length-1&&t>chapters[ci].turn)ci++;",
      replace: ""
    },

    // ── the live-storage shape ─────────────────────────────────────────────
    {
      label: "the {__lz} inflate is bypassed — a live campaign compiles into an empty book",
      mustFail: "an {__lz} transcript inflates and compiles identically",
      find: "    if(isArr(tr))return {ok:true,note:\"\"};",
      replace: "    return {ok:true,note:\"\"};"
    },

    // ── read-only by construction ──────────────────────────────────────────
    {
      label: "the page starts writing localStorage — the read-only contract breaks",
      mustFail: "zero localStorage writes across boot",
      find: "    CUR={ws:ws,mem:mem||{},label:label,live:!!live};",
      replace: "    CUR={ws:ws,mem:mem||{},label:label,live:!!live};try{localStorage.setItem(\"tnd_story_last\",label);}catch(e){}"
    }
  ]
});

process.exit(rc);
