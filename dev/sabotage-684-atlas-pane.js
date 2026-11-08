// dev/sabotage-684-atlas-pane.js — proves the atlas PANE's guards guard, in a real browser (dev/tests-684-atlas-browser.js): the door is
// the location name, the cards, Current location ("We are here" until #711) saved at once and refused once the story moved, the fog
// handed to the view, the tie said, the pane repainted under a landing turn, a turn played on the followed map; #711: the door opens the
// drawer's Map tab (the dock), the enlarge button lifts the ONE pane to full screen, Escape hands it back, the HUD is on, a drawer drag
// re-fits the dock, the tab goes without an atlas. Each clause plants one regression in ui-atlas.js, ui-mobile.js, mobile.css, atlas.js
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
  { label: "Current location is not saved: the tie lives until the next turn's save",
    find: "  if(typeof saveAll===\"function\")saveAll();",
    replace: "  ",
    mustFail: "FAIL ④ Current location ties the story place" },
  { label: "a click on the party's marker finds nothing: the town under the dagger cannot be tapped",
    find: "  if(hit&&P){t=atlasThingAt(P.zone,hit.x,hit.y);return t?{id:t.id}:{x:hit.x,y:hit.y};}",
    replace: "  if(hit&&P)return {id:hit.id};",
    mustFail: "FAIL ⑤ the trail leads back to the region" },
  { label: "the fog is not handed to the view: a sewer is drawn whole",
    find: "    reveal=atlasReveal(zoneId);if(reveal)P.view.setReveal(reveal);",
    replace: "    reveal=null;",
    mustFail: "FAIL ⑥ a sewer is fogged" },
  { label: "closing the pane leaves the view listening on the window",
    find: "if(P&&P.view){try{P.view.destroy();}",
    replace: "if(P&&P.view){try{}",
    mustFail: "FAIL ⑧ Escape closes the full pane" },
  /* #711 */
  { label: "the location name opens the full pane, never the drawer's Map tab",
    find: "  if(typeof mobileSelectPanel!==\"function\"||!document.getElementById(\"atlas-dock\"))return showAtlasFull(zoneId);",
    replace: "  return showAtlasFull(zoneId);",
    mustFail: "FAIL ② with an atlas the name is a button and opens the DOCK" },
  { label: "the HUD is off: the legend pans and zooms with the map, the scale bar means the sheet's own scale",
    find: "{style:\"ink\",hud:true}",
    replace: "{style:\"ink\"}",
    mustFail: "FAIL ② with an atlas the name is a button and opens the DOCK" },
  { label: "the enlarge button leaves the dock's pane alive beside the full one: two views, two canvases, one seam",
    find: "  if(_atlasPane)atlasPaneClose();\n  modal=modalShell(",
    replace: "  modal=modalShell(",
    mustFail: "FAIL ② with an atlas the name is a button and opens the DOCK" },
  { label: "a closed full pane leaves the Map tab empty",
    find: "  if(P&&P.host===\"full\")atlasDockSync();",
    replace: "  ",
    mustFail: "FAIL ⑧ Escape closes the full pane" },
  { label: "a drawer dragged wider keeps the view at its old fit",
    find: "  P.size=[w,h];P.view.fit();",
    replace: "  P.size=[w,h];",
    mustFail: "FAIL ⑭ the HUD and the drawer" },
  { label: "a campaign that loses its atlas keeps the drawer on a Map tab that is gone",
    find: "  if(!on&&typeof mobileUI!==\"undefined\"&&mobileUI.selected===\"map\"){",
    replace: "  if(false){",
    mustFail: "FAIL ⑭ the HUD and the drawer" }
] });

rc |= sabotage.prove({ file: "ui-mobile.js", command: BROWSER, cases: [
  { label: "the Map tab, clicked, shows an empty panel: only the door mounts the pane",
    find: "  if(key===\"map\"&&typeof atlasDockMount===\"function\")atlasDockMount();",
    replace: "  ",
    mustFail: "FAIL ⑧ Escape closes the full pane" }
] });

rc |= sabotage.prove({ file: "mobile.css", command: BROWSER, cases: [
  { label: "the Map tab shows in a campaign that has no atlas",
    find: "#mobile-tab-map{display:none}body.atlas-on #mobile-tab-map{display:block}",
    replace: "#mobile-tab-map{display:block}body.atlas-on #mobile-tab-map{display:block}",
    mustFail: "FAIL ① without an atlas the location name is plain text" }
] });

rc |= sabotage.prove({ file: "ui-atlas.js", command: BROWSER, cases: [
  { label: "Current location is spent on whatever the story names NOW, not on what the card showed",
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
    mustFail: "FAIL ④ Current location ties the story place" }
] });

process.exit(rc);
