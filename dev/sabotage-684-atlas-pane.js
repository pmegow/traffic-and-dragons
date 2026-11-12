// dev/sabotage-684-atlas-pane.js — proves the atlas PANE's guards guard, in a real browser (dev/tests-684-atlas-browser.js): the door is
// the location name, the cards, the player's note saved at once (round 4: in place of the retired hand tie), the trail on the plaque, the fog
// handed to the view, the tie said, the pane repainted under a landing turn, a turn played on the followed map; #711: the door opens the
// drawer's Map tab (the dock), the enlarge button lifts the ONE pane to full screen, Escape hands it back, the HUD is on, a drawer drag
// reveals the map without moving it, the tab goes without an atlas; round 3: the sheet opens on the party at four times its fit with
// the library's bounds keeping it filling the stage, full screen carries the dock's view, the tie a tap made is toasted. Each clause plants one regression in ui-atlas.js, ui-mobile.js, mobile.css, atlas.js
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
  { label: "the note is not saved: it lives until the next turn's save",
    find: "  if(typeof saveAll===\"function\")saveAll();\n  if(m)m.remove();",
    replace: "  if(m)m.remove();",
    mustFail: "FAIL ③ a real click on a town shows its card" },
  { label: "the note modal opens empty instead of with the note or the thing's word",
    find: "  box.value=card.note||card.word||\"\";",
    replace: "  box.value=\"\";",
    mustFail: "FAIL ③ a real click on a town shows its card" },
  { label: "the trail is not put on the plaque",
    find: "  try{P.view.setHudTrail(atlasTrailItems(zoneId));}catch(e4){atlasProblem(\"drawing the trail\",e4);}",
    replace: "  ",
    mustFail: "FAIL ④ the GM's [MAP_PLACE:|at] ties the story place" },
  { label: "a tier of the trail is clicked and nothing happens",
    find: "  _atlasPane.view.on(\"hudclick\",function(m){var B=atlasLive();if(m&&m.key!=null&&B&&B.zones[m.key])atlasPaneShow(m.key,true);});",
    replace: "  ",
    mustFail: "FAIL ④ the GM's [MAP_PLACE:|at] ties the story place" },
  { label: "#714: going up a level by the trail frames only the party's own sheet — the realm falls to the whole-sheet fit (the full pane)",
    find: "if(m&&m.key!=null&&B&&B.zones[m.key])atlasPaneShow(m.key,true);});",
    replace: "if(m&&m.key!=null&&B&&B.zones[m.key])atlasPaneShow(m.key,m.key===B.at);});",
    mustFail: "FAIL ⑤ the realm's tier leads back up" },
  { label: "#714: the same regression in the DOCK (the drawer map the owner reported): going up falls to the whole-sheet fit",
    find: "if(m&&m.key!=null&&B&&B.zones[m.key])atlasPaneShow(m.key,true);});",
    replace: "if(m&&m.key!=null&&B&&B.zones[m.key])atlasPaneShow(m.key,m.key===B.at);});",
    mustFail: "FAIL ⑭ the framing" },
  { label: "a click on the party's marker finds nothing: the town under the dagger cannot be tapped",
    find: "  if(hit&&P){t=atlasThingAt(P.zone,hit.x,hit.y);return t?{id:t.id}:{x:hit.x,y:hit.y};}",
    replace: "  if(hit&&P)return {id:hit.id};",
    mustFail: "FAIL ⑤ the realm's tier leads back up" },
  { label: "the fog is not handed to the view: a sewer is drawn whole",
    find: "      try{P.view.setReveal(reveal);}",
    replace: "      try{}",
    mustFail: "FAIL ⑥ a sewer is fogged" },
  { label: "#717: a null reveal is never handed over — with the campaign's fog switched off the sheet keeps the fog it wore",
    find: "    if(JSON.stringify(P.view.reveal())!==JSON.stringify(reveal)){",
    replace: "    if(reveal&&JSON.stringify(P.view.reveal())!==JSON.stringify(reveal)){",
    mustFail: "FAIL ⑮ the fog of war" },
  { label: "#717: the pane wears a stale fog — a move under the open pane does not widen it",
    find: "    if(JSON.stringify(P.view.reveal())!==JSON.stringify(reveal)){",
    replace: "    if(!P.view.reveal()){",
    mustFail: "FAIL ⑮ the fog of war" },
  { label: "#717 review, finding 5: the pane fails OPEN — the next sheet is handed to the view before its fog is read, and a failure draws it whole",
    find: "    doc=atlasDoc(zoneId);reveal=atlasReveal(zoneId);markers=atlasMarkers(zoneId);",
    replace: "    doc=atlasDoc(zoneId);P.view.setDoc(doc);reveal=atlasReveal(zoneId);markers=atlasMarkers(zoneId);",
    mustFail: "FAIL ⑯ the independent review of the fog" },
  { label: "#717 review, finding 5: a reveal the view refuses leaves the new sheet whole",
    find: "      catch(e2){P.view.setReveal(atlasRevealNone(zoneId));throw e2;}",
    replace: "      catch(e2){throw e2;}",
    mustFail: "FAIL ⑯ the independent review of the fog" },
  { label: "#717 review, finding 5: after a refused reveal the pane names the old sheet under the new drawing",
    find: "{P.view.setDoc(doc,P.zone===zoneId);P.zone=zoneId;}",
    replace: "{P.view.setDoc(doc,P.zone===zoneId);}",
    mustFail: "FAIL ⑯ the independent review of the fog" },
  { label: "#717 review: a place a turn adds to the sheet the pane shows is not drawn (the view keeps its old document)",
    find: "    if(P.zone!==zoneId||P.view.doc()!==doc){",
    replace: "    if(P.zone!==zoneId){",
    mustFail: "FAIL ⑯ the independent review of the fog" },
  { label: "#717 review, finding 2: a fogged sewer draws the town's walls and river above it",
    find: "    rooms=reveal instanceof Array;if(P.above!==!rooms){P.view.setLayerVisible(\"above\",!rooms);P.above=!rooms;}",
    replace: "    rooms=false;",
    mustFail: "FAIL ⑯ the independent review of the fog" },
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
    find: "{style:\"ink\",hud:true,bounds:true}",
    replace: "{style:\"ink\",bounds:true}",
    mustFail: "FAIL ② with an atlas the name is a button and opens the DOCK" },
  { label: "the enlarge button leaves the dock's pane alive beside the full one: two views, two canvases, one seam",
    find: "  if(_atlasPane)atlasPaneClose();\n  modal=modalShell(",
    replace: "  modal=modalShell(",
    mustFail: "FAIL ② with an atlas the name is a button and opens the DOCK" },
  { label: "a closed full pane leaves the Map tab empty",
    find: "  if(P&&P.host===\"full\")atlasDockSync();",
    replace: "  ",
    mustFail: "FAIL ⑧ Escape closes the full pane" },
  { label: "a drawer dragged wider re-fits the view: the player's zoom is lost and the map jumps (owner: reveal or cover)",
    find: "  if(P.size){P.view.pan(w-P.size[0],(h-P.size[1])/2);P.size=[w,h];return;}",
    replace: "  if(P.size){P.size=[w,h];P.view.fit();return;}",
    mustFail: "FAIL ⑭ the framing" },
  { label: "back from full screen the dock fits afresh: the player's zoom and pan are lost",
    find: "  P.restore=null;P.frame=null;P.view.center(r.cx,r.cy,r.k);",
    replace: "  P.restore=null;P.frame=null;",
    mustFail: "FAIL ⑭ the framing" },
  { label: "a sheet opens at its fit, not on the party at four times it",
    find: "  if(how.party){T=P.view.transform();P.view.center(how.party.x,how.party.y,T.k*ATLAS_HOME_ZOOM);}",
    replace: "  if(how.party){P.view.center(how.party.x,how.party.y);}",
    mustFail: "FAIL ⑭ the framing" },
  { label: "the view is created without the bounds: the party is centred with paper beside the sheet, and a drag can lose the sheet",
    find: "{style:\"ink\",hud:true,bounds:true}",
    replace: "{style:\"ink\",hud:true}",
    mustFail: "FAIL ⑭ the framing" },
  { label: "full screen fits afresh instead of carrying the dock's point and zoom",
    find: "  atlasPaneShow(z,true,(memo&&memo.zone===z)?memo:null);",
    replace: "  atlasPaneShow(z,true);",
    mustFail: "FAIL ⑭ the framing" },
  { label: "the card sits under the floating buttons",
    find: "<div id='atlas-card' aria-live='polite' style='display:none;position:absolute;z-index:3;",
    replace: "<div id='atlas-card' aria-live='polite' style='display:none;position:absolute;",
    mustFail: "FAIL ② with an atlas the name is a button and opens the DOCK" },
  { label: "the dagger is not beside the enlarge button",
    find: "style='bottom:8px;right:\"+(full?8:46)+\"px;'",
    replace: "style='bottom:58px;right:8px;'",
    mustFail: "FAIL ② with an atlas the name is a button and opens the DOCK" },
  { label: "a card offers no note button: the player's words have no door",
    find: "  if(card.id!=null)h+=\"<button type='button' class='qa' data-act='note'>\"+(card.note?\"Edit note\":\"Add note\")+\"</button>\";",
    replace: "  ",
    mustFail: "FAIL ② with an atlas the name is a button and opens the DOCK" },
  { label: "a campaign that loses its atlas keeps the drawer on a Map tab that is gone",
    find: "  if(!on&&typeof mobileUI!==\"undefined\"&&mobileUI.selected===\"map\"){",
    replace: "  if(false){",
    mustFail: "FAIL ⑭ the framing" }
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
  { label: "a turn that lands under an open pane leaves its marker stale",
    find: "  atlasPaneRefresh();/* syncUI runs after every committed turn",
    replace: "  /* syncUI runs after every committed turn",
    mustFail: "FAIL ⑫ a turn landing under an open pane repaints it" }
] });

rc |= sabotage.prove({ file: "atlas.js", command: BROWSER, cases: [
  { label: "an emptied note is kept as an empty string instead of removed",
    find: "  if(!text){delete A.notes[k];return {ok:true,text:\"\",removed:true};}",
    replace: "  if(!text){A.notes[k]=\"\";return {ok:true,text:\"\",removed:true};}",
    mustFail: "FAIL ③ a real click on a town shows its card" },
  { label: "the trail is the SHOWN sheet's chain, not the party's: going up loses the town",
    find: "chain=atlasTrail(A.at||A.seed);if(!chain.length)chain=[A.seed];for(i=0;i<chain.length;i++)out.push({key:chain[i],text:(A.zones[chain[i]]&&A.zones[chain[i]].name)||chain[i],current:chain[i]===shownZone});return out;}",
    replace: "chain=atlasTrail(shownZone||A.seed);if(!chain.length)chain=[A.seed];for(i=0;i<chain.length;i++)out.push({key:chain[i],text:(A.zones[chain[i]]&&A.zones[chain[i]].name)||chain[i],current:chain[i]===shownZone});return out;}",
    mustFail: "FAIL ⑤ the realm's tier leads back up" }
] });

/* #696: the keyboard's way to a place */
rc |= sabotage.prove({ file: "ui-atlas.js", command: BROWSER, cases: [
  { label: "the sheet no longer listens to the keyboard (a place is picked by a pointer only)",
    find: "  canvas.addEventListener(\"keydown\",atlasPaneKey);",
    replace: "",
    mustFail: "FAIL ⑰ the keyboard picks a place (#696)" },
  { label: "the keyboard steps through places the fog hides",
    find: "&&isFinite(t.y)&&atlasThingShown(zoneId,t))out.push(",
    replace: "&&isFinite(t.y))out.push(",
    mustFail: "FAIL ⑰ the keyboard picks a place (#696)" },
  { label: "a step opens the card and leaves the view where it was (the place may be off screen)",
    find: "  if(card)P.view.center(list[i].x,list[i].y,P.view.transform().k);",
    replace: "  if(card)P.view.transform();",
    mustFail: "FAIL ⑰ the keyboard picks a place (#696)" },
  { label: "Escape on a card closes the whole pane (the dialog takes it)",
    find: "{e.preventDefault();e.stopPropagation();atlasPaneTap(null);}",
    replace: "{e.preventDefault();atlasPaneTap(null);}",
    mustFail: "FAIL ⑰ the keyboard picks a place (#696)" },
  { label: "the sheet cannot take focus",
    find: "<canvas id='atlas-canvas' tabindex='0' ",
    replace: "<canvas id='atlas-canvas' ",
    mustFail: "FAIL ⑰ the keyboard picks a place (#696)" }
] });

process.exit(rc);
