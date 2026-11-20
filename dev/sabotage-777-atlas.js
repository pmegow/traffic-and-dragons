// sabotage-777-atlas.js — retained proof for audit 2026-11-19 (TODO #777), section A, the rows first left for the map pane:
//   atlas.js, atlas-public.js   A1 notes on ways and places inside are kept by sheet and shown · A8 the place limit
//   atlas-knowledge.js   A2 only a clash this turn makes is refused · map-knowledge.js   A4 a read validates once a revision
//   atlas-directions.js   A5 the ask gives up · atlas-public-region.js   A6 kept spots are avoided
//   atlas-public-sheet.js   A7 overflow ways are listed; a cut list says so · atlas-public-places.js   A8
// Each clause runs ONE named case of dev/tests-777-atlas.js (the suite's own --only).
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/tests-777-atlas.js"]], ONLY = "FAIL #777 ";
var failed = 0;
function prove(file, cases) { failed += sabotage.prove({ file: file, command: CMD, only: ONLY, cases: cases }); }
var T = {
  WAY: "A1: a note on a way out is kept by ITS sheet and shown on its card",
  IN: "A1: a note on a place inside is kept and shown",
  A2: "A2: after a merge leaves two features with one name",
  A4: "A4: a read validates the store once per revision",
  A5: "A5: the directions ask gives up on a feature the model will not place",
  A6: "A6: the region never sets a place down on a spot another place already keeps",
  A7: "A7: a way past the sixteenth is listed, not dropped",
  A8: "A8: at the place limit the map says so once and mails nothing",
  R1: "A1 review: a note on a place inside stays with it when a feature comes to name that place",
  R2: "A1 review: a way's note survives a merge of the place it leads to",
  R5: "A5 review: three answers that cannot be used end the asking too",
  R7: "A7 review: past the sixteenth way a feature that names the way keeps its pin",
  R8: "A8 review: at the place limit the party is still followed back to a place that has a sheet"
};
prove("atlas-public.js", [
  { label: "A1: the way card never shows its note",
    find: "note:atlasNote(zoneId,w.id)};/* audit 2026-11-19, A1 */", replace: "note:null};/* audit 2026-11-19, A1 */", mustFail: ONLY + T.WAY },
  { label: "A1: the card of a place inside never shows its note",
    find: "the party has entered. Where it lies was never stated.\",opens:w.to,unvisited:false,partyHere:false,place:null,added:null,note:atlasNote(zoneId,w.id)};", replace: "the party has entered. Where it lies was never stated.\",opens:w.to,unvisited:false,partyHere:false,place:null,added:null,note:null};", mustFail: ONLY + T.IN },
  { label: "A1: a way's note is stored under the bare positional id (shared by every sheet)",
    find: "      if(w.id===id)return atlasPublicNoteStored([\"way\",here,atlasPublicPlaceKey(w.key)]).concat([id]);", replace: "      if(w.id===id)return [id];", mustFail: ONLY + T.WAY },
  { label: "A1: a way's note is filed under its sheet alone (every way of the sheet shares it)",
    find: "      if(w.id===id)return atlasPublicNoteStored([\"way\",here,atlasPublicPlaceKey(w.key)]).concat([id]);", replace: "      if(w.id===id)return atlasPublicNoteStored([\"way\",here,here]).concat([id]);", mustFail: ONLY + T.WAY },
  { label: "A1: a feature that is the way no longer reads the note the way had",
    find: "      if(w.feature===id)return [id].concat(atlasPublicNoteStored([\"way\",here,atlasPublicPlaceKey(w.key)]));", replace: "      if(w.feature===id)return [id];", mustFail: ONLY + T.WAY },
  { label: "A1: a note saved before this build is not read",
    find: "      if(w.id===id)return atlasPublicNoteStored([\"way\",here,atlasPublicPlaceKey(w.key)]).concat([id]);", replace: "      if(w.id===id)return atlasPublicNoteStored([\"way\",here,atlasPublicPlaceKey(w.key)]);", mustFail: ONLY + T.IN },
  { label: "A1: the note of a place inside is stored under the bare positional id",
    find: "if(sheet.inside[i].id===id)return atlasPublicNoteStored([\"in\",here,atlasPublicPlaceKey(sheet.inside[i].key)]).concat([id]);", replace: "if(sheet.inside[i].id===id)return [id];", mustFail: ONLY + T.IN },
  { label: "A1 review: a feature that names a place inside does not read the note that place had",
    find: "if(child)return [id].concat(atlasPublicNoteStored([\"in\",here,atlasPublicPlaceKey(child)]));", replace: "if(false)return [id];", mustFail: ONLY + T.R1 },
  { label: "A1 review: a note is not found after the place its way leads to was merged",
    find: "atlasPublicPlaceKey(p[1])===ref[1]&&atlasPublicPlaceKey(p[2])===ref[2])out.push(ks[i]);", replace: "atlasPublicPlaceKey(p[1])===ref[1]&&p[2]===ref[2])out.push(ks[i]);", mustFail: ONLY + T.R2 },
  { label: "A1 review: a note is not found after the place it was written in was merged",
    find: "atlasPublicPlaceKey(p[1])===ref[1]&&atlasPublicPlaceKey(p[2])===ref[2])out.push(ks[i]);", replace: "p[1]===ref[1]&&atlasPublicPlaceKey(p[2])===ref[2])out.push(ks[i]);", mustFail: ONLY + T.R2 },
  { label: "A8: the place limit is mailed as a fault on every follow",
    find: "    if(e&&e.atlasLimit){atlasPublicLimitSay(atlasLive(),e);return null;}\n", replace: "", mustFail: ONLY + T.A8 },
  { label: "A8: the follow that meets the limit says nothing",
    find: "    if(e&&e.atlasLimit){atlasPublicLimitSay(atlasLive(),e);return null;}", replace: "    if(e&&e.atlasLimit){return null;}", mustFail: ONLY + T.A8 },
  { label: "A8: an unexpected failure of the follow is not reported",
    find: "    atlasProblem(\"following the public map\",e);return null;\n  }", replace: "    return null;\n  }", mustFail: ONLY + T.A8 }
]);
prove("atlas.js", [
  { label: "A1: a note is read from its first key only (an older key is never seen)",
    find: "keys=atlasNoteKeys(zoneId,id);for(i=0;i<keys.length;i++){n=notes[keys[i]];if(typeof n===\"string\"&&n)return n;}return \"\";}", replace: "keys=atlasNoteKeys(zoneId,id);n=notes[keys[0]];return typeof n===\"string\"?n:\"\";}", mustFail: ONLY + T.IN },
  { label: "A1: a saved note leaves the older key it was read from behind",
    find: "  for(i=1;i<keys.length;i++)if(keys[i]!==legacy)delete notes[keys[i]];", replace: "  ", mustFail: ONLY + T.WAY },
  { label: "A1 review: saving a note removes the shared old note another sheet still shows",
    find: "  for(i=1;i<keys.length;i++)if(keys[i]!==legacy)delete notes[keys[i]];", replace: "  for(i=1;i<keys.length;i++)delete notes[keys[i]];", mustFail: ONLY + T.IN },
  { label: "A1 review: emptying a thing's own note removes the shared old note too",
    find: "if(keys[i]!==legacy&&notes[keys[i]]!==undefined){delete notes[keys[i]];own=true;}", replace: "if(notes[keys[i]]!==undefined){delete notes[keys[i]];own=true;}", mustFail: ONLY + T.IN },
  { label: "A1 review: the old note can never be emptied",
    find: "if(!own&&legacy)delete notes[legacy];", replace: "", mustFail: ONLY + T.IN },
  { label: "A7 review: the row that only counts is handed out as a thing",
    find: "function atlasListed(rows){return (rows||[]).filter(function(u){return typeof ATLAS_SHEET_MORE_ID===\"undefined\"||u.id!==ATLAS_SHEET_MORE_ID;});}", replace: "function atlasListed(rows){return (rows||[]);}", mustFail: ONLY + T.R7 },
  { label: "A1: a note is saved for a thing that is not on the sheet",
    find: "if(id==null||!(bucket===\"publicNotes\"?atlasCard(zoneId,{id:id}):atlasThingById(atlasDoc(zoneId),id)))return {ok:false,reason:\"that thing is not on the sheet\"};", replace: "if(id==null)return {ok:false,reason:\"that thing is not on the sheet\"};", mustFail: ONLY + T.IN }
]);
prove("atlas-knowledge.js", [
  { label: "A2: an old pair of one name refuses everything disclosed in its place",
    find: "{if(touched(f)||touched(labels[label]))return \"public label already identifies \"", replace: "{if(true)return \"public label already identifies \"", mustFail: ONLY + T.A2 },
  { label: "A2: a clash this turn makes is accepted",
    find: "{if(touched(f)||touched(labels[label]))return \"public label already identifies \"", replace: "{if(false)return \"public label already identifies \"", mustFail: ONLY + T.A2 },
  { label: "A2: the check is not told how the store stood before the turn",
    find: "problem=atlasKnowledgeCollision(s,groups,s0);", replace: "problem=atlasKnowledgeCollision(s,groups);", mustFail: ONLY + T.A2 },
  { label: "A2: a renamed feature is not counted as changed",
    find: "return !o||o.label!==x.label||o.container!==x.container;}", replace: "return !o;}", mustFail: ONLY + T.A2 }
]);
prove("map-knowledge.js", [
  { label: "A4: every read validates the whole store again",
    find: "    if(s&&s===_readState&&s.revision===_readRevision)return \"\";\n", replace: "", mustFail: ONLY + T.A4 },
  { label: "A4: a new revision of the same object is read unchecked",
    find: "    if(s&&s===_readState&&s.revision===_readRevision)return \"\";", replace: "    if(s&&s===_readState)return \"\";", mustFail: ONLY + T.A4 },
  { label: "A4: another store object is read unchecked once one passed",
    find: "    if(s&&s===_readState&&s.revision===_readRevision)return \"\";", replace: "    if(s&&_readState&&s.revision===_readRevision)return \"\";", mustFail: ONLY + T.A4 },
  { label: "A4: a writer trusts the read's memo",
    find: "  function prepare(s,events,ctx){\n    var p=problem(s),", replace: "  function prepare(s,events,ctx){\n    var p=readProblem(s),", mustFail: ONLY + T.A4 },
  { label: "A4: a store that failed its check is remembered as checked",
    find: "    if(!p){_readState=s;_readRevision=s.revision;}", replace: "    _readState=s;_readRevision=s.revision;", mustFail: ONLY + T.A4 }
]);
prove("atlas-directions.js", [
  { label: "A5: the ask is never given up",
    find: "o=atlasDirectionsOwed(atlasDirectionsGivenUp);", replace: "o=atlasDirectionsOwed();", mustFail: ONLY + T.A5 },
  { label: "A5: an answered ask is not counted",
    find: "    tried.forEach(function(x){_atlasDirectionsAsked[x.key]=(_atlasDirectionsAsked[x.key]||0)+1;});", replace: "    ", mustFail: ONLY + T.A5 },
  { label: "A5: a request that failed is counted as a try",
    find: "    text=await callGM(ask.user,ask.system,ATLAS_DIRECTIONS_TOKENS,null,options);\n    tried.forEach(function(x){_atlasDirectionsAsked[x.key]=(_atlasDirectionsAsked[x.key]||0)+1;});", replace: "    tried.forEach(function(x){_atlasDirectionsAsked[x.key]=(_atlasDirectionsAsked[x.key]||0)+1;});\n    text=await callGM(ask.user,ask.system,ATLAS_DIRECTIONS_TOKENS,null,options);", mustFail: ONLY + T.A5 },
  { label: "A5: giving up is not said",
    find: "    if(gone.length)atlasKnowledgeSay(", replace: "    if(false)atlasKnowledgeSay(", mustFail: ONLY + T.A5 },
  { label: "A5 review: the last unusable answer still promises another ask",
    find: "(gone.length&&gone.length===(tried||[]).length?", replace: "(false?", mustFail: ONLY + T.R5 }
]);
prove("atlas-public-region.js", [
  { label: "A6: a kept spot later in the order is not avoided",
    find: "kept[i]=atlasRegionStored(A,places[i].key);if(kept[i])taken.push(kept[i]);}", replace: "kept[i]=atlasRegionStored(A,places[i].key);}", mustFail: ONLY + T.A6 }
]);
prove("atlas-public-sheet.js", [
  { label: "A7: ways past the sixteenth are cut from the record again",
    find: "  for(i=0;i<out.length;i++)out[i].id=\"way-\"+(i+1);/* audit 2026-11-19, A7:", replace: "  out=out.slice(0,ATLAS_SHEET_EXIT_CAP);for(i=0;i<out.length;i++)out[i].id=\"way-\"+(i+1);/* audit 2026-11-19, A7:", mustFail: ONLY + T.A7 },
  { label: "A7: a way past the sixteenth is neither drawn nor listed",
    find: "if(exits.length>=ATLAS_SHEET_EXIT_CAP){if(!w.feature)atlasSheetListAdd(list,{id:w.id,name:atlasSheetCut(\"The way to \"+w.name,ATLAS_SHEET_LIST_NAME_MAX),mode:\"observed\"});continue;}", replace: "if(exits.length>=ATLAS_SHEET_EXIT_CAP){continue;}", mustFail: ONLY + T.A7 },
  { label: "A7 review: a feature that names a way past the sixteenth loses its pin",
    find: "if(named&&wi<ATLAS_SHEET_EXIT_CAP)isWay[named.id]=true;", replace: "if(named)isWay[named.id]=true;", mustFail: ONLY + T.R7 },
  { label: "A7 review: such a feature is drawn and listed as well",
    find: "if(exits.length>=ATLAS_SHEET_EXIT_CAP){if(!w.feature)atlasSheetListAdd(", replace: "if(exits.length>=ATLAS_SHEET_EXIT_CAP){atlasSheetListAdd(", mustFail: ONLY + T.R7 },
  { label: "A7 review: on a site such a feature is on the sheet twice",
    find: "if(i>=ATLAS_SHEET_EXIT_CAP&&ways[i].feature)continue;", replace: "", mustFail: ONLY + T.R7 },
  { label: "A7: a cut list says nothing",
    find: "  if(!list.cut)return list.rows;", replace: "  if(true)return list.rows;", mustFail: ONLY + T.A7 },
  { label: "A7: a cut list miscounts what it leaves out",
    find: "name:\"and \"+(list.cut+1)+\" more, not listed here\"", replace: "name:\"and \"+list.cut+\" more, not listed here\"", mustFail: ONLY + T.A7 },
  { label: "A7: the list outgrows what the map library takes",
    find: "function atlasSheetListAdd(list,row){if(list.rows.length<ATLAS_SHEET_LIST_CAP)list.rows.push(row);else list.cut++;}", replace: "function atlasSheetListAdd(list,row){list.rows.push(row);}", mustFail: ONLY + T.A7 }
]);
prove("atlas-public-places.js", [
  { label: "A8: the limit is thrown as an ordinary fault",
    find: "full.atlasLimit=true;throw full;}", replace: "throw full;}", mustFail: ONLY + T.A8 },
  { label: "A8 review: a place that cannot be recovered stops the follow",
    find: "catch(e){if(e&&e.atlasLimit&&!isNew){atlasPublicLimitSay(A,e);return id;}throw e;}", replace: "catch(e){throw e;}", mustFail: ONLY + T.R8 },
  { label: "A8 review: the limit first met in the recovery is not said",
    find: "if(e&&e.atlasLimit&&!isNew){atlasPublicLimitSay(A,e);return id;}", replace: "if(e&&e.atlasLimit&&!isNew){return id;}", mustFail: ONLY + T.R8 },
  { label: "A8: the place limit is said on every follow",
    find: "function atlasPublicLimitSay(A,e){if(atlasOnce(A,\"place-limit\"))atlasSay(\"warn\",e.message);}", replace: "function atlasPublicLimitSay(A,e){atlasSay(\"warn\",e.message);}", mustFail: ONLY + T.A8 },
  { label: "A8: the place limit is never said",
    find: "function atlasPublicLimitSay(A,e){if(atlasOnce(A,\"place-limit\"))atlasSay(\"warn\",e.message);}", replace: "function atlasPublicLimitSay(A,e){}", mustFail: ONLY + T.A8 }
]);

process.exit(failed ? 1 : 0);
