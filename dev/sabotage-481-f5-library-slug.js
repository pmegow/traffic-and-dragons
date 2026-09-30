// dev/sabotage-481-f5-library-slug.js — proves the #481 F5 client guards are guarded: one library slug contract trims BOTH
// edge underscores, the blueprint slug keeps the designer's 120-character cut, and the game's two slug sites delegate to it.
// (Any byte change to library-slug.js also trips the vendoring hash pin — by design: the server's copy must follow.)
// Each mutation runs in a disposable clone.
//   node dev/sabotage-481-f5-library-slug.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/tests-481-f5-library-slug.js"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("library-slug.js", [
  { label: "the server's bug: only one edge underscore is trimmed",
    find: ".replace(/^_|_$/g,\"\");}", replace: ".replace(/^_|_$/,\"\");}",
    mustFail: "the repro names" },
  { label: "the blueprint slug loses the designer's 120-character cut",
    find: "function blueprint(name){return library(name).slice(0,120);}", replace: "function blueprint(name){return library(name);}",
    mustFail: "the blueprint slug reproduces the designer's slice rule" }
]);
prove("helpers.js", [
  { label: "the party upload builds its own slug again",
    find: "function partyUploadSlug(name){return LibrarySlug.library(name);}", replace: "function partyUploadSlug(name){return String(name||\"\").toLowerCase().replace(/[^a-z0-9]+/g,\"_\").replace(/^_|_$/g,\"\");}",
    mustFail: "the game's two library slug sites" }
]);
prove("ui-browsers.js", [
  { label: "the character export builds its own slug again",
    find: "function _charLibSlug(name){return LibrarySlug.library(name);}", replace: "function _charLibSlug(name){return(name||\"\").toLowerCase().replace(/[^a-z0-9]+/g,\"_\").replace(/^_|_$/g,\"\");}",
    mustFail: "the game's two library slug sites" }
]);
process.exit(code);
