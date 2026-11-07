// dev/sabotage-684-atlas-pane.js — proves the atlas PANE's guards guard, in a real browser (dev/tests-684-atlas-browser.js): the door is
// the location name, the cards, We are here saved at once and refused once the story moved, the fog handed to the view, the tie said,
// the pane repainted under a landing turn, a turn played on the followed map. Each clause plants one regression in ui-atlas.js, atlas.js
// or game.js; the named check must then FAIL. Design record: DOC/DESIGN_684_atlas.md.
//   node dev/sabotage-684-atlas-pane.js
// One of the five atlas batteries (dev/sabotage-684-atlas*.js — the core, -rooms, -adopt, -pane, -doors): each a subject, so a change
// to any of their targets schedules them through run-sabotage-diff and battery-pool runs them side by side. Every ENGINE group carries
// `only: "FAIL #684 "` — a clause runs its own named test through the suite's --only filter (sabotage.js), not the 13 s file.
var sabotage = require("./sabotage.js");
var BROWSER = ["node", ["dev/tests-684-atlas-browser.js"]];
var rc = 0;

rc |= sabotage.prove({ file: "game.js", command: BROWSER, cases: [
  { label: "a turn is sent on a pointer nothing followed: the prompt withholds the map for a place the party is in",
    find: "  if(typeof atlasFollow===\"function\")atlasFollow();/* #684: a Sync edit or a restore",
    replace: "  /* #684: a Sync edit or a restore",
    mustFail: "FAIL ⑪ a turn sent after the pointer moved" }
] });

rc |= sabotage.prove({ file: "ui-atlas.js", command: BROWSER, cases: [
  { label: "the location name is a door in a campaign that has no atlas",
    find: "  var on=typeof atlasHas===\"function\"&&atlasHas(),i,el;",
    replace: "  var on=true,i,el;",
    mustFail: "FAIL ① without an atlas the location name is plain text" },
  { label: "We are here is not saved: the tie lives until the next turn's save",
    find: "  if(typeof saveAll===\"function\")saveAll();",
    replace: "  ",
    mustFail: "FAIL ④ We are here ties the story place" },
  { label: "a click on the party's marker finds nothing: the town under the dagger cannot be tapped",
    find: "  if(hit&&P){t=atlasThingAt(P.zone,hit.x,hit.y);return t?{id:t.id}:{x:hit.x,y:hit.y};}",
    replace: "  if(hit&&P)return {id:hit.id};",
    mustFail: "FAIL ⑤ the trail leads back to the region" },
  { label: "the fog is not handed to the view: a sewer is drawn whole",
    find: "    reveal=atlasReveal(zoneId);if(reveal)P.view.setReveal(reveal);",
    replace: "    reveal=null;",
    mustFail: "FAIL ⑥ a sewer is fogged" },
  { label: "closing the pane leaves the view listening on the window",
    find: "try{_atlasPane.view.destroy();}",
    replace: "try{}",
    mustFail: "FAIL ⑧ Escape closes the pane" }
] });

rc |= sabotage.prove({ file: "ui-atlas.js", command: BROWSER, cases: [
  { label: "We are here is spent on whatever the story names NOW, not on what the card showed",
    find: "  r=atlasPlace(P.zone,P.target,P.place);",
    replace: "  r=atlasPlace(P.zone,P.target);",
    mustFail: "FAIL ⑫ a card painted before the story moved" },
  { label: "a turn that lands under an open pane leaves its status and marker stale",
    find: "  atlasPaneRefresh();/* syncUI runs after every committed turn",
    replace: "  /* syncUI runs after every committed turn",
    mustFail: "FAIL ⑫ a card painted before the story moved" }
] });

rc |= sabotage.prove({ file: "atlas.js", command: BROWSER, cases: [
  { label: "the pane does not say the tie the tap made: the player cannot see what the GM is told (#692)",
    find: "    out.ties=atlasTiesHere(A);out.ties.forEach(function(x){said+=\" \"+atlasTieSay(x);});",
    replace: "    out.ties=atlasTiesHere(A);",
    mustFail: "FAIL ④ We are here ties the story place" }
] });

process.exit(rc);
