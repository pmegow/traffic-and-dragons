// dev/sabotage-684-atlas.js — proves the #684 atlas guards guard. Each clause plants one regression in atlas.js, in a
// seam (game.js, state.js, helpers.js) or in the vendored library; the named test must then FAIL. A mutation that changes
// no bytes is a hard failure. Design record: DOC/DESIGN_684_atlas.md.
//   node dev/sabotage-684-atlas.js
var sabotage = require("./sabotage.js");
var ENGINE = ["node", ["dev/tests-684-atlas-engine.js"]];
var PIN = ["node", ["dev/tests-684-atlas.js"]];
var BROWSER = ["node", ["dev/tests-684-atlas-browser.js"]];
var rc = 0;

rc |= sabotage.prove({ file: "atlas.js", command: ENGINE, cases: [
  { label: "THE RULE is broken: of two things bearing one name, the first is picked",
    find: "  if(hits.length>1)return {many:hits.length};",
    replace: "  if(hits.length>1)return {thing:hits[0]};",
    mustFail: "THE RULE — the engine never guesses" },
  { label: "THE RULE is broken: part of a name finds the thing (a substring match)",
    find: "  hits=atlasThings(doc).filter(function(t){return atlasNameKey(t.name)===key;});",
    replace: "  hits=atlasThings(doc).filter(function(t){return atlasNameKey(t.name).indexOf(key)>=0;});",
    mustFail: "THE RULE — the engine never guesses" },
  { label: "a way in is guessed: of several doors back, the first is where the party stands",
    find: "  return back.length===1?back[0]:null;",
    replace: "  return back.length?back[0]:null;",
    mustFail: "entry by an exact world name" },
  { label: "a recipe that derives another zone's seed is drawn under this zone's id (the identity check dropped)",
    find: "  if(!params||params.seed!==zoneId)throw new Error(",
    replace: "  if(!params)throw new Error(",
    mustFail: "entry by an exact world name" },
  { label: "a READ writes the campaign: drawing a document stamps its recipe",
    find: "    _atlasDocs[key]=doc;_atlasDrawn[key]=",
    replace: "    _atlasDocs[key]=doc;A.zones[zoneId].lib=\"read\";_atlasDrawn[key]=",
    mustFail: "version drift: a zone that draws differently from its record" },
  { label: "a redraw is silent: the notice goes to the console only",
    find: "rec.fp=d.fp;rec.lib=d.lib;\n  atlasSay(\"warn\",",
    replace: "rec.fp=d.fp;rec.lib=d.lib;\n  atlasSay(\"info\",",
    mustFail: "version drift: a zone that draws differently from its record" },
  { label: "a failure escapes the follow and breaks the turn's commit",
    find: "  }catch(e){A.off={name:p.sub||p.world,why:\"the map could not follow the story there (\"+atlasProblem(\"following the party\",e)+\")\"};}",
    replace: "  }catch(e){throw e;}",
    mustFail: "a failure inside the atlas never escapes a writer" },
  { label: "a half-made zone stays in the store after its drawing failed",
    find: "  try{doc=atlasDoc(id);}catch(e){if(fresh)delete A.zones[id];throw e;}",
    replace: "  try{doc=atlasDoc(id);}catch(e){throw e;}",
    mustFail: "a failure inside the atlas never escapes a writer" },
  { label: "the fingerprint includes the caches the library writes onto a read document",
    find: "(this===doc&&(k===\"stats\"||k.charAt(0)===\"_\"))",
    replace: "(this===doc&&k===\"stats\")",
    mustFail: "the fingerprint ignores the timings and the caches" },
  { label: "the region recipe keeps only the seed: a changed library default would redraw the realm",
    find: "params:JSON.parse(JSON.stringify(doc.params)),name:",
    replace: "params:{seed:seed},name:",
    mustFail: "atlasCreate: the store, the region recipe with its resolved params" },
  { label: "an unreadable store is dropped without the evidence",
    find: "  if(why){worldState.atlasJunk={why:why,was:A,turn:atlasTurn()};delete worldState.atlas;atlasSay(\"warn\",\"this campaign's map could not be read",
    replace: "  if(why){delete worldState.atlas;atlasSay(\"warn\",\"this campaign's map could not be read",
    mustFail: "load: an unreadable store is set aside as evidence" },
  { label: "a tap places the sub-location in a town the map does not know (the world-first order dropped)",
    find: "  return (p.sub&&!worldOff)?{level:\"sub\",name:p.sub}:{level:\"world\",name:p.world};",
    replace: "  return p.sub?{level:\"sub\",name:p.sub}:{level:\"world\",name:p.world};",
    mustFail: "We are here: a tap ties the story's own name to a map place" },
  { label: "the documents held in memory are never dropped",
    find: "  while(_atlasDocOrder.length>ATLAS_DOC_CAP){",
    replace: "  while(false){",
    mustFail: "the documents held in memory are bounded" },
  { label: "the pane peeks: a card offers the sheet of a zone the party has not entered",
    find: "opens:(leads&&A.zones[leads]&&leads!==zoneId)?leads:null,unvisited:",
    replace: "opens:(leads&&leads!==zoneId)?leads:null,unvisited:",
    mustFail: "what the pane says" },
  { label: "a card draws and files the zone it names (a read that writes)",
    find: "    if(t.portal){try{leads=atlasPortalPeek(A,zoneId,t.portal);}catch(e){leads=null;}}",
    replace: "    if(t.portal){try{leads=(atlasPortalTarget(A,zoneId,t.portal,[])||{}).zone||null;}catch(e){leads=null;}}",
    mustFail: "what the pane says" },
  { label: "the fog lifts: every chamber of a dungeon is shown to the player",
    find: "if(up[r.id]||(r.portal&&up[r.portal])||r.id===spot)ids.push(r.id);",
    replace: "ids.push(r.id);",
    mustFail: "the fog of war" },
  { label: "a campaign without an atlas gets a MAP header in its prompt (its prompt is no longer byte-identical)",
    find: "  var A=atlasLive(),p=A?atlasPointer():null,where,zone,sheet;\n  if(!A)return \"\";",
    replace: "  var A=atlasLive(),p=A?atlasPointer():null,where,zone,sheet;\n  if(!A)return ATLAS_BRIEF_HEAD+\"\\n\\n\";",
    mustFail: "the MAP block: nothing without an atlas" },
  { label: "a pointer nothing followed is described: the GM is told the party is where it was",
    find: "    if(!p||A.ptr!==JSON.stringify([p.world,p.sub])){",
    replace: "    if(!p){",
    mustFail: "the MAP block is honest" },
  { label: "a party that left the mapped places is served the sheet it left as where it is",
    find: "    zone=(where.placed&&!(A.off&&!A.off.within))?A.at:A.seed;",
    replace: "    zone=where.placed?A.at:A.seed;",
    mustFail: "the MAP block is honest" },
  { label: "the cap cuts mid-word and does not say the sheet was cut",
    find: "  return text.slice(0,at>0?at+1:cap).replace(/\\s+$/,\"\")+ATLAS_BRIEF_CUT;",
    replace: "  return text.slice(0,cap);",
    mustFail: "the MAP block is honest" },
  { label: "a failure inside the MAP block breaks the prompt",
    find: "    if(atlasOnce(A,\"brief\"))atlasProblem(\"telling the GM what the map says\",e);",
    replace: "    if(atlasOnce(A,\"brief\"))throw e;",
    mustFail: "the MAP block never breaks a prompt" },
  { label: "a standing MAP block failure toasts and mails a report on every prompt",
    find: "    if(atlasOnce(A,\"brief\"))atlasProblem(\"telling the GM what the map says\",e);",
    replace: "    if(true)atlasProblem(\"telling the GM what the map says\",e);",
    mustFail: "the MAP block never breaks a prompt" },
  { label: "a name the story used is kept as a tie: the first inn's Common Room is every Common Room from then on",
    find: "    return {hit:{zone:sheets[i],id:m.thing?m.thing.id:null}};",
    replace: "    A.names[key]={zone:sheets[i],id:m.thing?m.thing.id:null};return {hit:A.names[key]};",
    mustFail: "THE RULE, where the party stands" },
  { label: "a sub-location is looked for on every sheet entered beneath the town, not only where the party stands",
    find: "        sheets=(prev&&prev!==home&&atlasChainUp(A,prev,null).indexOf(home)>=0)?atlasChainUp(A,prev,home):[home];",
    replace: "        sheets=Object.keys(A.zones).filter(function(zz){return atlasChainUp(A,zz,null).indexOf(home)>=0;}).reverse();",
    mustFail: "THE RULE, where the party stands" },
  { label: "a card the story has moved past is spent on the new place (the expectation ignored)",
    find: "  if(expect&&(expect.level!==pv.level||expect.name!==pv.name))return {ok:false,moved:true,",
    replace: "  if(false)return {ok:false,moved:true,",
    mustFail: "the player's ties" },
  { label: "a merged place loses the player's tie (the tie is read by its raw key only)",
    find: "  if(!t){ks=Object.keys(A.names);for(i=0;i<ks.length;i++)if(atlasLocKey(ks[i])===key){t=A.names[ks[i]];break;}}",
    replace: "  ks=null;i=0;",
    mustFail: "the player's ties" },
  { label: "a tap in a mapped town ties the WORLD place again instead of the sub-location",
    find: "  return (p.sub&&!worldOff)?{level:\"sub\",name:p.sub}:{level:\"world\",name:p.world};",
    replace: "  return {level:\"world\",name:p.world};",
    mustFail: "the player's ties" },
  { label: "a party that left the mapped places is drawn as standing in the place it left",
    find: "  last=!!(A.off&&!A.off.within);",
    replace: "  last=false;",
    mustFail: "a party that has left the mapped places is never drawn as being there" },
  { label: "the place the party left says \"The party is here\" and withholds We are here",
    find: "  gone=!!(A.off&&!A.off.within);",
    replace: "  gone=false;",
    mustFail: "a party that has left the mapped places is never drawn as being there" },
  { label: "the sheet above marks the FIRST way the party ever used, as an exact position",
    find: "    if(ways.length<=1){t=atlasThingById(doc,ways.length?ways[0]:rec.via);if(t)return mk(t.x,t.y,true,z);}",
    replace: "    t=atlasThingById(doc,rec.via);if(t)return mk(t.x,t.y,true,z);",
    mustFail: "the sheet above shows the way the party is AT" },
  { label: "a party standing at a second grate is not shown at it on the town",
    find: "    if(z===A.at&&A.spot!=null){ps=atlasDoc(z).portals||[];for(i=0;i<ps.length;i++)if(ps[i].id===A.spot&&ATLAS_WAYS_BACK[ps[i].way]&&ps[i].to){t=atlasThingById(doc,ps[i].to.id);if(t)return mk(t.x,t.y,true,z);}}",
    replace: "    ps=null;",
    mustFail: "the sheet above shows the way the party is AT" },
  { label: "walking north through a wild zone's edge arrives at the next zone's own north edge",
    find: "r.far?{to:atlasRecipe(A,zoneId).via}:{id:portal.id}",
    replace: "{id:portal.id}",
    mustFail: "the sheet above shows the way the party is AT" },
  { label: "a store whose zones loop is accepted at load",
    find: "  for(i=0;i<ids.length;i++){z=ids[i];n=0;while(z!==A.seed){",
    replace: "  for(i=0;i<0;i++){z=ids[i];n=0;while(z!==A.seed){",
    mustFail: "a store whose zones loop is set aside at load" },
  { label: "a failed follow is retried, toasted and reported on every turn (the pointer is not stamped)",
    find: "  A.ptr=sig;\n  return {changed:before!==JSON.stringify([A.at,A.spot,A.off]),at:A.at,spot:A.spot,off:A.off,entered:entered};",
    replace: "  if(!A.off||!/could not follow/.test(A.off.why))A.ptr=sig;\n  return {changed:before!==JSON.stringify([A.at,A.spot,A.off]),at:A.at,spot:A.spot,off:A.off,entered:entered};",
    mustFail: "a store whose zones loop is set aside at load" },
  { label: "one campaign's once-latch silences the next campaign's failure",
    find: "function atlasOnce(A,what){var k=String((A&&A.seed)||\"\")+\"\\n\"+what;",
    replace: "function atlasOnce(A,what){var k=what;",
    mustFail: "a store whose zones loop is set aside at load" }
] });

rc |= sabotage.prove({ file: "api.js", command: ENGINE, cases: [
  { label: "the MAP block rides inside GEOGRAPHY: Table Talk is handed a dungeon's fogged chambers",
    find: "  return\"GEOGRAPHY (strict continuity \u2014 never contradict):\\n\"+lines.join(\"\\n\")+\"\\n\\n\";",
    replace: "  return\"GEOGRAPHY (strict continuity \u2014 never contradict):\\n\"+lines.join(\"\\n\")+\"\\n\\n\"+atlasMapBlock();",
    mustFail: "the MAP block in a town" },
  { label: "the MAP block is not in the prompt: the GM is never told what the map says",
    find: "    +((typeof atlasMapBlock===\"function\")?atlasMapBlock():\"\")",
    replace: "    ",
    mustFail: "the MAP block never breaks a prompt" }
] });

rc |= sabotage.prove({ file: "game.js", command: BROWSER, cases: [
  { label: "a turn is sent on a pointer nothing followed: the prompt withholds the map for a place the party is in",
    find: "  if(typeof atlasFollow===\"function\")atlasFollow();/* #684: a Sync edit or a restore",
    replace: "  /* #684: a Sync edit or a restore",
    mustFail: "⑪ a turn sent after the pointer moved" }
] });

rc |= sabotage.prove({ file: "ui-atlas.js", command: BROWSER, cases: [
  { label: "the location name is a door in a campaign that has no atlas",
    find: "  var on=typeof atlasHas===\"function\"&&atlasHas(),i,el;",
    replace: "  var on=true,i,el;",
    mustFail: "① without an atlas the location name is plain text" },
  { label: "We are here is not saved: the tie lives until the next turn's save",
    find: "  if(typeof saveAll===\"function\")saveAll();",
    replace: "  ",
    mustFail: "④ We are here ties the story place" },
  { label: "a click on the party's marker finds nothing: the town under the dagger cannot be tapped",
    find: "  if(hit&&P){t=atlasThingAt(P.zone,hit.x,hit.y);return t?{id:t.id}:{x:hit.x,y:hit.y};}",
    replace: "  if(hit&&P)return {id:hit.id};",
    mustFail: "⑤ the trail leads back to the region" },
  { label: "the fog is not handed to the view: a sewer is drawn whole",
    find: "    reveal=atlasReveal(zoneId);if(reveal)P.view.setReveal(reveal);",
    replace: "    reveal=null;",
    mustFail: "⑥ a sewer is fogged" },
  { label: "closing the pane leaves the view listening on the window",
    find: "try{_atlasPane.view.destroy();}",
    replace: "try{}",
    mustFail: "⑧ Escape closes the pane" }
] });

rc |= sabotage.prove({ file: "game.js", command: BROWSER, cases: [
  { label: "the Begin switch is not consumed: it maps the next campaign too",
    find: "  var _wantAtlas=!!pendingAtlas;pendingAtlas=false;",
    replace: "  var _wantAtlas=!!pendingAtlas;",
    mustFail: "⑩ the opt-in" }
] });

rc |= sabotage.prove({ file: "index.html", command: BROWSER, cases: [
  { label: "the Begin switch is on by default: every new campaign is mapped",
    find: "<input type=\"checkbox\" id=\"rv-atlas\"/>",
    replace: "<input type=\"checkbox\" id=\"rv-atlas\" checked/>",
    mustFail: "⑩ the opt-in" }
] });

rc |= sabotage.prove({ file: "ui-atlas.js", command: BROWSER, cases: [
  { label: "We are here is spent on whatever the story names NOW, not on what the card showed",
    find: "  r=atlasPlace(P.zone,P.target,P.place);",
    replace: "  r=atlasPlace(P.zone,P.target);",
    mustFail: "⑫ a card painted before the story moved" },
  { label: "a turn that lands under an open pane leaves its status and marker stale",
    find: "  atlasPaneRefresh();/* syncUI runs after every committed turn",
    replace: "  /* syncUI runs after every committed turn",
    mustFail: "⑫ a card painted before the story moved" }
] });

rc |= sabotage.prove({ file: "char-creation.js", command: BROWSER, cases: [
  { label: "the Review step's switch never reaches startGame",
    find: "var _atlasEl=document.getElementById(\"rv-atlas\");pendingAtlas=!!(_atlasEl&&_atlasEl.checked);",
    replace: "var _atlasEl=null;",
    mustFail: "⑩ the opt-in" }
] });

rc |= sabotage.prove({ file: "ui-browsers.js", command: BROWSER, cases: [
  { label: "the setup modal's switch never reaches startGame",
    find: "    pendingAtlas=!!document.getElementById(\"is-atlas\").checked;",
    replace: "    ",
    mustFail: "⑩ the opt-in" },
  { label: "the quick start keeps a switch an abandoned Review step left on",
    find: "  pendingAtlas=false;/* #684: the quick start has no",
    replace: "  /* #684: the quick start has no",
    mustFail: "⑩ the opt-in" }
] });

rc |= sabotage.prove({ file: "game.js", command: BROWSER, cases: [
  { label: "a village is begun with a drawn map (the kind's flag ignored)",
    find: "    if(!kindDef().atlas)showToast(",
    replace: "    if(false)showToast(",
    mustFail: "⑩ the opt-in" },
  { label: "a realm that fails to draw is swallowed: no toast, a half atlas left behind",
    find: "}catch(_ae){delete worldState.atlas;atlasProblem(\"drawing the realm\",_ae);}",
    replace: "}catch(_ae){}",
    mustFail: "⑩ the opt-in" }
] });

rc |= sabotage.prove({ file: "game.js", command: ENGINE, cases: [
  { label: "the turn's commit no longer follows the location pointer",
    find: "  if(typeof atlasFollow===\"function\")atlasFollow();/* #684: the atlas follows the committed location pointer",
    replace: "  /* #684: the atlas follows the committed location pointer",
    mustFail: "the turn's commit follows the committed pointer" }
] });

rc |= sabotage.prove({ file: "state.js", command: ENGINE, cases: [
  { label: "the load door no longer heals the atlas",
    find: "  if(typeof atlasHeal===\"function\"&&atlasHeal())_mig=true;",
    replace: "  ",
    mustFail: "the load door heals the atlas" }
] });

rc |= sabotage.prove({ file: "helpers.js", command: ENGINE, cases: [
  { label: "the atlas's dictionaries are plain objects after a load (the keyed-store registration dropped)",
    find: "\"atlas.zones\",\"atlas.names\",",
    replace: "",
    mustFail: "persistence: the store is recipes" }
] });

rc |= sabotage.prove({ file: "tndmaps.js", command: ENGINE, cases: [
  { label: "the vendored library draws a different realm from the same seed (a changed default)",
    find: "settlements: 12, caves: 3,",
    replace: "settlements: 11, caves: 3,",
    mustFail: "THE FIXTURE GATE" }
] });

rc |= sabotage.prove({ file: "tndmaps.js", command: PIN, cases: [
  { label: "the vendored library is edited in place (one byte off the pinned copy)",
    find: "settlements: 12, caves: 3,",
    replace: "settlements: 11, caves: 3,",
    mustFail: "SHA-256 pin" }
] });

process.exit(rc);
