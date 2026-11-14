// dev/sabotage-741-enemy-card-portrait.js — proves the #741 guards: the enemy card draws the creature's authored portrait
// (the blueprint's image, kept on the bestiary record), above the facts, through the image-source gate, labelled by the
// public name. Each clause plants one regression in ui-mobile.js; dev/tests-718-enemy-card.js must fail on its assertion.
//   node dev/sabotage-741-enemy-card-portrait.js
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({ file: "ui-mobile.js", command: ["node", ["dev/tests-718-enemy-card.js"]], cases: [
  { label: "the card draws no portrait again",
    find: "  if(portrait)h+=\"<img class='enemy-portrait' src='\"+safeImgSrc(record.portrait)+\"' alt='\"+escHtml(foeLabel(foe))+\"'>\";\n",
    replace: "", mustFail: "#741 the card draws the bestiary portrait" },
  { label: "the image source gate is skipped (any string becomes an image source)",
    find: "portrait=record&&record.portrait?safeImgSrc(record.portrait):\"\";",
    replace: "portrait=record&&record.portrait?escHtml(record.portrait):\"\";", mustFail: "#741 a source that is not an image is refused" },
  { label: "the image is labelled by the canonical name (a disguise is given away)",
    find: "alt='\"+escHtml(foeLabel(foe))+\"'>\";",
    replace: "alt='\"+escHtml(foeLabel(foe,true))+\"'>\";", mustFail: "#741 a disguised creature's image is labelled by its public name" }
] }) ? 1 : 0);
