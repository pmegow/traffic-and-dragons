// dev/sabotage-741-enemy-card-portrait.js — proves the #741 and #742 guards: the enemy card draws the creature's authored
// portrait (the blueprint's image, kept on the bestiary record), above the facts, through the image-source gate; a
// disguised creature shows its ALTERNATE portrait, and until one exists the standard portrait marked ALTERNATE. Since
// #743 the choice of image is formView's (helpers.js); the card draws it. Each clause plants one regression;
// dev/tests-718-enemy-card.js must fail on its assertion.
//   node dev/sabotage-741-enemy-card-portrait.js
var sabotage = require("./sabotage.js"), CMD = ["node", ["dev/tests-718-enemy-card.js"]];
var failed = sabotage.prove({ file: "ui-mobile.js", command: CMD, cases: [
  { label: "the card draws no portrait again",
    find: "  if(portrait)h+=\"<div class='enemy-portrait'>",
    replace: "  if(0)h+=\"<div class='enemy-portrait'>", mustFail: "#741 the card draws the bestiary portrait" },
  { label: "the image source gate is skipped (any string becomes an image source)",
    find: "portrait=pic?safeImgSrc(pic):\"\";",
    replace: "portrait=pic?escHtml(pic):\"\";", mustFail: "#741 a source that is not an image is refused" },
  { label: "the image is labelled by the canonical name (a disguise is given away)",
    find: "' alt='\"+escHtml(foeLabel(foe))+\"'>\"+(standIn",
    replace: "' alt='\"+escHtml(foeLabel(foe,true))+\"'>\"+(standIn", mustFail: "#741 a disguised creature's image is labelled by its public name" },
  { label: "the stand-in mark is not drawn",
    find: "+(standIn?\"<span class='enemy-portrait-standin'>ALTERNATE</span>\":\"\")+",
    replace: "+", mustFail: "#742 a disguised creature without an alternate shows the standard portrait marked ALTERNATE" }
] });
if (!failed) failed = sabotage.prove({ file: "helpers.js", command: CMD, cases: [
  { label: "a disguised creature's true portrait is shown unmarked",
    find: "out.portrait=rec.portrait;out.standIn=true;}",
    replace: "out.portrait=rec.portrait;}", mustFail: "#742 a disguised creature without an alternate shows the standard portrait marked ALTERNATE" },
  { label: "a disguised creature ignores its alternate portrait (the true image is shown)",
    find: "if(rec.altPortrait)out.portrait=rec.altPortrait;else if(rec.portrait){",
    replace: "if(rec.portrait){", mustFail: "#742 a disguised creature shows its alternate portrait" },
  { label: "an alternate portrait is still marked ALTERNATE",
    find: "if(rec.altPortrait)out.portrait=rec.altPortrait;else if(rec.portrait){",
    replace: "if(rec.altPortrait){out.portrait=rec.altPortrait;out.standIn=true;}else if(rec.portrait){", mustFail: "#742 a disguised creature shows its alternate portrait" },
  { label: "an undisguised creature shows the alternate form",
    find: "return rec&&typeof rec.displayName===\"string\"&&rec.displayName.trim()?\"alternate\":\"true\";",
    replace: "return \"alternate\";", mustFail: "#718 public description retained" }
] });
process.exit(failed ? 1 : 0);
