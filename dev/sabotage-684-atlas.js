// dev/sabotage-684-atlas.js — proves the #684 atlas guards guard. Each clause plants one regression in atlas.js, in a
// seam (game.js, state.js, helpers.js) or in the vendored library; the named test must then FAIL. A mutation that changes
// no bytes is a hard failure. Design record: DOC/DESIGN_684_atlas.md.
//   node dev/sabotage-684-atlas.js
var sabotage = require("./sabotage.js");
var ENGINE = ["node", ["dev/tests-684-atlas-engine.js"]];
var PIN = ["node", ["dev/tests-684-atlas.js"]];
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
    find: "  if(level==null)level=(p.sub&&wTie&&A.zones[wTie.zone])?\"sub\":\"world\";",
    replace: "  if(level==null)level=p.sub?\"sub\":\"world\";",
    mustFail: "We are here: a tap ties the story's own name to a map place" },
  { label: "the documents held in memory are never dropped",
    find: "  while(_atlasDocOrder.length>ATLAS_DOC_CAP){",
    replace: "  while(false){",
    mustFail: "the documents held in memory are bounded" }
] });

rc |= sabotage.prove({ file: "game.js", command: ENGINE, cases: [
  { label: "the turn's commit no longer follows the location pointer",
    find: "  if(typeof atlasFollow===\"function\")atlasFollow();",
    replace: "  ",
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
