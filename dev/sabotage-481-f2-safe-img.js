// dev/sabotage-481-f2-safe-img.js — proves the #481 F2 guards are guarded: a portrait is an image, never markup. Fable's
// named clause: "safeImgSrc returns its input". The others remove one site from the gate (the IMAGE SRC CONTRACT must fail —
// ui-sheets.js, and character_editor.html, which the scan covers too) or keep a crafted portrait at the import boundary.
// Each mutation runs in a disposable clone.
//   node dev/sabotage-481-f2-safe-img.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 F2"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "safeImgSrc returns its input (Fable's named clause)",
    find: "function safeImgSrc(url){if(url==null||url===\"\")return \"\";var s=String(url);", replace: "function safeImgSrc(url){return url==null?\"\":String(url);var s=String(url);",
    mustFail: "safeImgSrc admits an image data URL" },
  { label: "the import boundary keeps a crafted portrait",
    find: "  if(typeof console!==\"undefined\")console.warn(\"[portrait] dropped a portrait that is not an image (\"+(where||\"import\")+\"): \"+(sheet.name||\"?\")+\" — \"+String(sheet.portrait).slice(0,60));delete sheet.portrait;return 1;}",
    replace: "  return 0;}",
    mustFail: "a crafted portrait never reaches the page" }
]);
prove("ui-sheets.js", [
  { label: "the NPC sheet's portrait leaves the gate",
    find: "<img id='npc-portrait-img' src='\"+safeImgSrc(portrait)+\"'", replace: "<img id='npc-portrait-img' src='\"+portrait+\"'",
    mustFail: "IMAGE SRC CONTRACT BROKEN" }
]);
prove("character_editor.html", [
  { label: "the character editor's portrait leaves the gate (the scan covers root *.html)",
    find: "<img src='\"+safeImgSrc(ch.portrait)+\"' alt='portrait'/>", replace: "<img src='\"+ch.portrait+\"' alt='portrait'/>",
    mustFail: "IMAGE SRC CONTRACT BROKEN" }
]);
process.exit(code);
