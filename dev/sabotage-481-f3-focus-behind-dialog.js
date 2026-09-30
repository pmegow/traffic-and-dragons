// dev/sabotage-481-f3-focus-behind-dialog.js — proves the #481 F3 guards are guarded: keyboard focus never lands on the story
// box behind an open dialog. The removal-observer restore acts only when focus was lost and never behind an open dialog, a
// same-id re-creation inherits the original opener, focusStoryBox yields while a dialog is open, and the end of sendAction
// goes through it. Each mutation runs in a disposable clone against the microtask-observer suite.
// The same-id re-creation also DISCONNECTS the old dialog's observer; that is belt-and-braces and has no clause here — with
// the restore rule in place the old observer's late restore finds focus live in the new dialog and does nothing, so removing
// the disconnect alone changes no observable behaviour (it saves one no-op callback).
// The real-browser check is dev/qa-481-f3-focus.js (at the pre-fix code a real Enter sent a turn from behind the sheet).
//   node dev/sabotage-481-f3-focus-behind-dialog.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/tests-481-f3-focus-behind-dialog.js"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("ui-shell.js", [
  { label: "the re-created dialog forgets the original opener",
    find: "  var opener=inherited||(typeof document", replace: "  var opener=(typeof document",
    mustFail: "the re-created dialog inherits the original opener" },
  { label: "the restore steals focus from a live element (the in-place re-render repro)",
    find: "    if(ae&&ae!==bd&&(!bd||!bd.contains||bd.contains(ae)))return;\n", replace: "",
    mustFail: "never steals focus" },
  { label: "the restore hands focus to an element behind an open dialog",
    find: "    var top=modalTopOpen();if(top&&!(top.contains&&top.contains(op)))return;\n", replace: "",
    mustFail: "never hands focus to the story box behind" },
  { label: "focusStoryBox ignores an open dialog",
    find: "function focusStoryBox(){if(modalTopOpen())return false;", replace: "function focusStoryBox(){",
    mustFail: "focusStoryBox yields" }
]);
prove("game.js", [
  { label: "the end of sendAction focuses the story box directly again",
    find: "if(typeof focusStoryBox===\"function\")focusStoryBox();/* #481 F3", replace: "document.getElementById(\"action-input\").focus();/* #481 F3",
    mustFail: "source: the end of sendAction" }
]);
process.exit(code);
