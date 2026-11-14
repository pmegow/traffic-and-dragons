// dev/sabotage-741-enemy-card-portrait.js — proves the #741 and #742 guards: the enemy card draws the creature's authored
// portrait (the blueprint's image, kept on the bestiary record), above the facts, through the image-source gate; a
// disguised creature shows its ALTERNATE portrait, and until one exists the standard portrait marked ALTERNATE. Each
// clause plants one regression in ui-mobile.js; dev/tests-718-enemy-card.js must fail on its assertion.
//   node dev/sabotage-741-enemy-card-portrait.js
var sabotage = require("./sabotage.js");
process.exit(sabotage.prove({ file: "ui-mobile.js", command: ["node", ["dev/tests-718-enemy-card.js"]], cases: [
  { label: "the card draws no portrait again",
    find: "  if(portrait)h+=\"<div class='enemy-portrait'>",
    replace: "  if(0)h+=\"<div class='enemy-portrait'>", mustFail: "#741 the card draws the bestiary portrait" },
  { label: "the image source gate is skipped (any string becomes an image source)",
    find: "portrait=pic?safeImgSrc(pic):\"\";",
    replace: "portrait=pic?escHtml(pic):\"\";", mustFail: "#741 a source that is not an image is refused" },
  { label: "the image is labelled by the canonical name (a disguise is given away)",
    find: "' alt='\"+escHtml(foeLabel(foe))+\"'>\"+(standIn",
    replace: "' alt='\"+escHtml(foeLabel(foe,true))+\"'>\"+(standIn", mustFail: "#741 a disguised creature's image is labelled by its public name" },
  { label: "a disguised creature's true portrait is shown unmarked",
    find: "standIn=disguised&&!record.altPortrait,",
    replace: "standIn=false,", mustFail: "#742 a disguised creature without an alternate shows the standard portrait marked ALTERNATE" },
  { label: "a disguised creature ignores its alternate portrait (the true image is shown)",
    find: "(disguised&&record.altPortrait?record.altPortrait:record.portrait)",
    replace: "(record.portrait)", mustFail: "#742 a disguised creature shows its alternate portrait" },
  { label: "an alternate portrait is still marked ALTERNATE",
    find: "standIn=disguised&&!record.altPortrait,",
    replace: "standIn=disguised,", mustFail: "#742 a disguised creature shows its alternate portrait" },
  { label: "an undisguised creature shows the alternate portrait",
    find: "(disguised&&record.altPortrait?record.altPortrait:record.portrait)",
    replace: "(record.altPortrait?record.altPortrait:record.portrait)", mustFail: "#742 an undisguised creature shows its standard portrait, never the alternate" }
] }) ? 1 : 0);
