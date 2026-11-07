// dev/sabotage-684-atlas-rooms.js — proves the #693 guards guard: a room is filed under its building. The position is READ from the
// pointer's names through the map (atlasPosition / atlasPlaceCanon as step 0 of resolvePlaceName), a sub-location is a PATH, a same-world
// footer CARRIES its building, and every neighbour that compares a GM name passes the tag's position. Each clause plants one regression
// in atlas.js, identity.js, memory.js or tag_table.js; the named test must then FAIL. Design record: DOC/DESIGN_684_atlas.md.
//   node dev/sabotage-684-atlas-rooms.js
// One of the five atlas batteries (dev/sabotage-684-atlas*.js — the core, -rooms, -adopt, -pane, -doors): each a subject, so a change
// to any of their targets schedules them through run-sabotage-diff and battery-pool runs them side by side. Every ENGINE group carries
// `only: "FAIL #684 "` — a clause runs its own named test through the suite's --only filter (sabotage.js), not the 13 s file.
var sabotage = require("./sabotage.js");
var ENGINE = ["node", ["dev/tests-684-atlas-engine.js"]];
var rc = 0;

/* #693 (owner rulings 2026-11-06): a room is filed under its building — the second build. The position is READ from the
   pointer's names through the map; each clause names the one behaviour test that must catch it. */
rc |= sabotage.prove({ file: "atlas.js", command: ENGINE, only: "FAIL #684 ", cases: [
  { label: "the building is taken from where the map last stood, not from the pointer in force at the tag (the first build's failure)",
    find: "    pos=atlasPosition(A,parent,sub===undefined?null:sub);",
    replace: "    pos=atlasPosition(A,parent,A.ptr?JSON.parse(A.ptr)[1]:null);",
    mustFail: "FAIL #684 #693 the building comes from the pointer" },
  { label: "rule (a) dropped: a thing on the town's own sheet named from inside a building is filed under the building",
    find: "    if(atlasFind(pos.homeDoc,X)&&!atlasChainBears(A,pos,X))return null;",
    replace: "    ",
    mustFail: "FAIL #684 #693 a room is filed under its building" },
  { label: "the map answers nothing: two inns' rooms of one name share one node again",
    find: "  if(!A||!A.zones[A.seed])return null;\n  X=String(name==null?\"\":name).trim();if(!X)return null;",
    replace: "  return null;",
    mustFail: "FAIL #684 #693 a room is filed under its building" },
  { label: "ruling 2 dropped: a place the building's sheet does not have is filed town-wide",
    find: "  return atlasPathJoin(atlasChainPath(pos,pos.chain.length-1).concat([String(name).trim()]));\n}",
    replace: "  return null;\n}",
    mustFail: "FAIL #684 #693 the building comes from the pointer" },
  { label: "a way back is a room of its own: the crypt stair named from the crypt is a second node",
    find: "      if(f.thing.portal&&ATLAS_WAYS_BACK[f.thing.portal.way]){",
    replace: "      if(false){",
    mustFail: "FAIL #684 #693 a way in and the room beneath it are one node" },
  { label: "a zone named by its own title is filed as a room of itself",
    find: "    if(atlasNameKey(c.name)===key||atlasNameKey(title)===key)return atlasPathJoin(atlasChainPath(pos,i));}",
    replace: "    if(false)return null;}",
    mustFail: "FAIL #684 #693 a zone named by its own title" },
  { label: "only the deepest sheet is asked: a room of the temple named from the crypt is filed under the crypt",
    find: "  for(i=pos.chain.length-1;i>=0;i--){c=pos.chain[i];f=atlasFind(c.doc,name);",
    replace: "  for(i=pos.chain.length-1;i>=pos.chain.length-1;i--){c=pos.chain[i];f=atlasFind(c.doc,name);",
    mustFail: "FAIL #684 #693 a zone named by its own title" },
  { label: "a tied building's rooms take the map's name (ruling 7 dropped)",
    find: "  if(lead.kind!==\"interior\")return title;\n  ways=atlasWaysIntoDoc(parentDoc,doc);\n  if(ways.length!==1)return title;",
    replace: "  return title;",
    mustFail: "FAIL #684 #693 a building the player tied under a story name" },
  { label: "a tie to one grate renames the whole sewer: its chambers are two nodes from two grates",
    find: "  if(lead.kind!==\"interior\")return title;\n  ways=atlasWaysIntoDoc(parentDoc,doc);\n  if(ways.length!==1)return title;",
    replace: "  ways=atlasWaysIntoDoc(parentDoc,doc);",
    mustFail: "FAIL #684 #693 a building the player tied under a story name" },
  { label: "the follow does not walk a path: the map loses the party in its own building",
    find: "  if(parts.length>=2&&!atlasTie(A,atlasSubKey(p))){atlasWalk(A,p,parts,home,entered);return;}",
    replace: "  if(false){atlasWalk(A,p,parts,home,entered);return;}",
    mustFail: "FAIL #684 #693 a room is filed under its building" },
  { label: "of two zones of one title beneath a sheet, the first is picked",
    find: "  return hits.length===1?{zone:hits[0]}:(hits.length>1?{many:hits.length}:null);",
    replace: "  return hits.length>=1?{zone:hits[0]}:null;",
    mustFail: "FAIL #684 #693 a failure while asking the map is reported once" },
  { label: "a READ writes the campaign: a sheet drawn for the look is recorded as entered",
    find: "  if(!doc){doc=TnDMaps.generate(lead.kind,lead.params);_atlasPeeks[lead.zone]=doc;}",
    replace: "  if(!doc){doc=TnDMaps.generate(lead.kind,lead.params);_atlasPeeks[lead.zone]=doc;A.zones[lead.zone]={kind:lead.kind,parent:lead.parent,via:lead.via,params:null,name:(doc.title&&doc.title.name)||null,lib:null,fp:null,turn:0};}",
    mustFail: "FAIL #684 #693 a world move with a building and its room in one reply" },
  { label: "a sheet the store has not recorded cannot be routed through: a building of an unentered town is no way in",
    find: "  know=function(z){return seen[z]||atlasRecipe(A,z);};",
    replace: "  know=function(z){return atlasRecipe(A,z);};",
    mustFail: "FAIL #684 #693 a world move with a building and its room in one reply" },
  { label: "a failure while asking the map breaks the turn",
    find: "    if(atlasOnce(A,\"canon\"))atlasProblem(\"asking the map where a place is\",e);",
    replace: "    if(true)throw e;",
    mustFail: "FAIL #684 #693 a failure while asking the map is reported once" },
  { label: "the GM is not told how a room is filed or how to name one from the street",
    find: " Inside a building or under the ground, a room's own name is enough: the game files it under the building and shows it as \\\"<building> — <room>\\\". From the street, name the building first, or write the pair ([SUBLOCATION:<building> — <room>]).",
    replace: "",
    mustFail: "FAIL #684 #693 the rule the GM reads is true" },
  { label: "the tie behind a room's building is no longer said on the where-line",
    find: "    for(i=1;i<parts.length;i++)add(\"sub\",atlasPathJoin(parts.slice(0,i)),atlasLocKey(atlasWorldKey(p)+\"|\"+atlasPathJoin(parts.slice(0,i))));",
    replace: "    ",
    mustFail: "FAIL #684 #693 a building the player tied under a story name" },
  { label: "a hyphen or an en dash does not read as the dash: the same room gets a twin node",
    find: "function atlasPathParts(s){return String(s==null?\"\":s).split(/\\s+[—–-]\\s+/)",
    replace: "function atlasPathParts(s){return String(s==null?\"\":s).split(\" — \")",
    mustFail: "FAIL #684 #693 the qualified form is accepted as written" },
  { label: "a zone's own title from the street is not followed into it",
    find: "  child=atlasChildByTitle(A,home,atlasDoc(home),p.sub);\n  if(child&&child.zone)atlasStand(",
    replace: "  child=null;\n  if(child&&child.zone)atlasStand(",
    mustFail: "FAIL #684 #693 a zone named by its own title" },
  /* the independent review of the second build (2026-11-06) */
  { label: "a zone's title is never looked behind a way in: the one-reply descent leaves the party above ground",
    find: "  if(c)return c.zone?{zone:c.zone,lead:null,thing:null}:c;",
    replace: "  return c;",
    mustFail: "FAIL #684 #693 a one-reply descent lands the party below" },
  { label: "a way back onto the world's sheet is a bare door node again: the next room fuses across inns",
    find: "        return i===0?atlasPathJoin(atlasChainPath(pos,0)):atlasPathJoin(atlasChainPath(pos,i-1).concat([above.name]));",
    replace: "        return i===0?null:atlasPathJoin(atlasChainPath(pos,i-1).concat([above.name]));",
    mustFail: "FAIL #684 #693 a door named as the sub-location is the building itself" },
  { label: "a partial path is not read from where the party stands: the pointer lands on a key with no node",
    find: "      if(pos.chain.length)return {key:atlasLocKey(wk+\"|\"+atlasFoldLeaf(wk,atlasKeyFromPosition(A,pos,parts)))};",
    replace: "      ",
    mustFail: "FAIL #684 #693 a partial path is read from where the party stands" },
  { label: "the world place's own name is not stripped from a pair: the cave's chamber gets a twin",
    find: "    while(parts.length>1&&(f=atlasFind(pos.homeDoc,parts[0]))&&(f.title||(f.thing&&!atlasLeads(A,pos.home,f.thing,pos.know,pos.sheet))))parts.shift();",
    replace: "    ",/* review 4 re-anchored */
    mustFail: "FAIL #684 #693 the cave pair" }
] });

rc |= sabotage.prove({ file: "identity.js", command: ENGINE, only: "FAIL #684 ", cases: [
  { label: "step 0 is gone: the story's bare node wins over the map and the second Kitchen lands on the first",
    find: "if(_m&&_m.key)return {key:_m.key,via:\"atlas\"};",
    replace: "",
    mustFail: "FAIL #684 #693 a room is filed under its building" },
  { label: "the place timeline does not say where a tag stands: no room is filed under its building",
    find: "resolvePlaceName(raw,world,{sub:sub!=null?sub:carried,fresh:sub!=null&&subFresh})",
    replace: "resolvePlaceName(raw,world)",
    mustFail: "FAIL #684 #693 a room is filed under its building" },
  { label: "a re-stated town carries nothing: the footer pair files the room on the street",
    find: "carried=(nm===world)?(sub!=null?sub:carried):null;world=nm;sub=null;",
    replace: "carried=null;world=nm;sub=null;",
    mustFail: "FAIL #684 #693 the building comes from the pointer" },
  { label: "a town re-stated twice loses the carry",
    find: "carried=(nm===world)?(sub!=null?sub:carried):null;world=nm;sub=null;",
    replace: "carried=(nm===world)?sub:null;world=nm;sub=null;",
    mustFail: "FAIL #684 #693 a town re-stated twice" },
  { label: "the carried building is not handed to the operands written after the footer",
    find: "carried:(sub==null&&carried!=null)?carried:null});",
    replace: "carried:null});",
    mustFail: "FAIL #684 #693 a town re-stated twice" },
  { label: "the world-twin guard compares bare leaves only: [LOCATION:Kitchen] inside a building mints a world",
    find: "    if(rp&&rp.via===\"atlas\"&&nodes[rp.key]&&nodes[rp.key].parent)return {requested:raw,child:rp.key,parent:current,leaf:locDisplayLeaf(rp.key)};}",
    replace: "    if(false)return null;}",
    mustFail: "FAIL #684 #693 the neighbours compare through the resolver" },
  { label: "the world-twin guard from the street ignores a room's last segment",
    find: "    if(mapped){lp=locDisplayLeaf(k).split(\" — \");",
    replace: "    if(false){lp=locDisplayLeaf(k).split(\" — \");",
    mustFail: "FAIL #684 #693 the neighbours compare through the resolver" }
] });

rc |= sabotage.prove({ file: "memory.js", command: ENGINE, only: "FAIL #684 ", cases: [
  { label: "an item placed by a room's own name is resolved without the tag's position",
    find: "resolvePlaceName(String(place).trim(),_pw,(at&&at.sub!==undefined)?{sub:at.sub,carried:at.carried}:((at&&at.key)?undefined:{sub:(worldState.world&&worldState.world.sublocation)||null}))",
    replace: "resolvePlaceName(String(place).trim(),_pw)",
    mustFail: "FAIL #684 #693 a room is filed under its building" },
  { label: "the soundscape target is resolved without the party's position",
    find: "resolvePlaceName(v.target,undefined,{sub:(worldState.world&&worldState.world.sublocation)||null})",
    replace: "resolvePlaceName(v.target)",
    mustFail: "FAIL #684 #693 the soundscape target and an item filed outside the parser" },
  { label: "a door to a room on record under the building is filed as a new way",
    find: "  if(typeof placeResolvedByMap===\"function\"&&placeResolvedByMap(_xr)){",
    replace: "  if(false){",
    mustFail: "FAIL #684 #693 the neighbours compare through the resolver" },
  { label: "a door is never resolved by a room filed under its building",
    find: "    if(!hit&&typeof resolvePlaceName===\"function\"&&typeof placeResolvedByMap===\"function\"){var _xr=resolvePlaceName(ex.name,_xw,{sub:_xs});",
    replace: "    if(false){var _xr=null;",
    mustFail: "FAIL #684 #693 the neighbours compare through the resolver" }
] });

rc |= sabotage.prove({ file: "tag_table.js", command: ENGINE, only: "FAIL #684 ", cases: [
  { label: "a passed-through room is filed by its raw name: a bare ghost beside the room the party stands in",
    find: "var ptN=(typeof placeResolvedByMap===\"function\"&&placeResolvedByMap(e.rp))?e.name:e.raw;",
    replace: "var ptN=e.raw;",
    mustFail: "FAIL #684 #693 a passed-through room is filed by its qualified name" },
  { label: "a split member's room is stored raw: the party's return never folds them back",
    find: "if(placeResolvedByMap(psRp))psSub=placeKeyLeaf(psRp.key);",
    replace: "if(false)psSub=placeKeyLeaf(psRp.key);",
    mustFail: "FAIL #684 #693 the neighbours compare through the resolver" },
  { label: "a named place operand in a block that changes building lands in the new building",
    find: "      if(_liR0&&(placeResolvedByMap(_liR0)||placeResolvedByMap(_liR1))&&(!_liR1||_liR0.key!==_liR1.key)){_liAt=_liA0;",
    replace: "      if(false){_liAt=_liA0;",
    mustFail: "FAIL #684 #693 a named place operand in a tag block" },
  { label: "the block rule runs where the map answered nothing: a campaign without a map changes by a receipt",
    find: "(placeResolvedByMap(_liR0)||placeResolvedByMap(_liR1))&&",
    replace: "(true)&&",
    mustFail: "FAIL #684 #693 without a map, a named operand" },
  { label: "a state note's place is resolved without the tag's position",
    find: "resolvePlaceName(lsPl,lsW,lsAt)",
    replace: "resolvePlaceName(lsPl,lsW)",
    mustFail: "FAIL #684 #693 a room is filed under its building" }
] });

/* the second independent review of #702 (2026-11-06, audits/AUDIT_2026-11-06_702_review.md): the guards its findings added to the
   path model — the deepest sheet before rule (a), the way back, the one-reply building, the carry, the fold */
rc |= sabotage.prove({ file: "atlas.js", command: ENGINE, only: "FAIL #684 ", cases: [
  { label: "rule (a) answers before the deepest sheet: a street thing bearing a room's name files every inn's room bare (the #693 fusion again)",
    find: "    if(atlasFind(pos.homeDoc,X)&&!atlasChainBears(A,pos,X))return null;",
    replace: "    if(atlasFind(pos.homeDoc,X))return null;",
    mustFail: "FAIL #684 #702 review: an added town-level thing bearing a room's name" },
  { label: "a way back onto the town's sheet is read as the deepest sheet's own thing: the grate and its landing are two nodes",
    find: "    if(i===0&&f.thing&&f.thing.portal&&ATLAS_WAYS_BACK[f.thing.portal.way])continue;\n",
    replace: "",
    mustFail: "FAIL #684 #702 review: an added town-level thing bearing a room's name" },
  { label: "a name inside a building this reply invented is filed town-wide: the room becomes a town-level place",
    find: "!==atlasNameKey(X))leaf=atlasPathJoin([pos.unknown[0],X]);/* review 3",
    replace: "!==atlasNameKey(X))leaf=null;/* review 3",/* review 3 re-anchored */
    mustFail: "FAIL #684 #702 review: a building and its room invented in ONE reply" },
  { label: "the fold never folds: a name differing in case or article mints a twin node",
    find: "  if(!nodes||typeof placeNameNorm!==\"function\")return leaf;",
    replace: "  return leaf;",
    mustFail: "FAIL #684 #702 review: the mutants the suite let live" }
] });

rc |= sabotage.prove({ file: "identity.js", command: ENGINE, only: "FAIL #684 ", cases: [
  { label: "the timeline never says a sub-location was set by this reply: the invented building's room is filed town-wide",
    find: ",!!(at&&at.fresh)):null;",
    replace: ",false):null;",
    mustFail: "FAIL #684 #702 review: a building and its room invented in ONE reply" },
  { label: "a leave keeps the carried building",
    find: "else{ev.kind=\"leave\";sub=null;carried=null;subFresh=false;}",
    replace: "else{ev.kind=\"leave\";sub=null;subFresh=false;}",
    mustFail: "FAIL #684 #702 review: the mutants the suite let live" }
] });

/* the third review (2026-11-07): a key never carries a room in the middle; a tie beneath the home sheet builds the chain; the gaps the mutants showed */
rc |= sabotage.prove({ file: "atlas.js", command: ENGINE, only: "FAIL #684 ", cases: [
  { label: "the fresh path keys the whole unknown rest of the pointer: a room in the middle, and the re-stated room lands on a twin node",
    find: "leaf=atlasPathJoin([pos.unknown[0],X]);/* review 3",
    replace: "leaf=atlasPathJoin(pos.unknown.concat([X]));/* review 3",
    mustFail: "FAIL #684 #702 review 3: a key never carries a room in the middle" },
  { label: "rule (b)'s unknown tail keeps the middle segments: the pair with an unknown middle mints a key with a room in it",
    find: ".concat([parts[parts.length-1]]));/* review 3, finding 1: the zones reached and the LAST segment",
    replace: ".concat(parts.slice(pre.used)));/* review 3, finding 1: the zones reached and the LAST segment",
    mustFail: "FAIL #684 #702 review 3: a key never carries a room in the middle" },
  { label: "a partial path's unknown tail is kept as written: the room passed through rides into the key",
    find: "    return atlasPathJoin(names(chain).concat([parts[parts.length-1]]));/* review 3, finding 1: the last segment",
    replace: "    return atlasPathJoin(names(chain).concat(parts.slice(i)));/* review 3, finding 1: the last segment",
    mustFail: "FAIL #684 #702 review 3: a key never carries a room in the middle" },
  { label: "a three-pair from the street with an invented building is minted as written",
    find: "      if(parts.length>2&&pre&&!pre.chain.length&&!pre.used&&pre.unknown&&pre.unknown.length&&!atlasFind(pos.homeDoc,parts[0]))return {key:atlasLocKey(wk+\"|\"+atlasFoldLeaf(wk,atlasPathJoin([parts[0],parts[parts.length-1]])))};\n",
    replace: "",
    mustFail: "FAIL #684 #702 review 3: a key never carries a room in the middle" },
  { label: "a partial path never looks behind a chain sheet's ways for a zone named by its title: the crypt from the nave is a room of the temple",
    find: "    for(j=chain.length-1;j>=0&&!hit;j--){c=chain[j];child=atlasChildByTitle(A,c.zone,c.doc,parts[i],pos.know,pos.sheet);\n",
    replace: "    for(j=-1;j>=0&&!hit;j--){c=chain[j];child=atlasChildByTitle(A,c.zone,c.doc,parts[i],pos.know,pos.sheet);\n",/* review 4 re-anchored */
    mustFail: "FAIL #684 #693 a one-reply descent lands the party below" },
  { label: "a tie that lands beneath the home sheet leaves the chain empty: the rooms named afterwards file town-wide",
    find: "      if(tie.zone!==pos.zone){between=atlasChainBetween(A,home,tie.zone);if(between){pos.chain=between;pos.zone=tie.zone;pos.doc=atlasDoc(tie.zone);pos.spot=null;}}\n",
    replace: "",
    mustFail: "FAIL #684 #702 review 3: a tap on a room inside the place the engine added" },
  { label: "a name a chain sheet bears twice does not count as borne: rule (a) files it under the street's thing of that name",
    find: "    f=atlasFind(c.doc,name);if(!f)continue;\n    /* a way back onto",
    replace: "    f=atlasFind(c.doc,name);if(!f||f.many)continue;\n    /* a way back onto",
    mustFail: "FAIL #684 #702 review 3: the gaps the mutants showed" },
  { label: "the re-statement guard dropped: an invented building re-stated in the same reply becomes a room of itself",
    find: "&&atlasNameKey(pos.unknown[0])!==atlasNameKey(X))leaf=atlasPathJoin([pos.unknown[0],X]);",
    replace: ")leaf=atlasPathJoin([pos.unknown[0],X]);",/* review 4 re-anchored */
    mustFail: "FAIL #684 #702 review 3: the gaps the mutants showed" }
] });

/* the fourth review (2026-11-07): the re-statement guard compares the container; a partial path on a peeked sheet; a spot-first pair */
rc |= sabotage.prove({ file: "atlas.js", command: ENGINE, only: "FAIL #684 ", cases: [
  { label: "the re-statement guard compares the LAST unknown segment again: the building re-stated after its room becomes a room of itself, the room re-stated a town-level name",
    find: "&&atlasNameKey(pos.unknown[0])!==atlasNameKey(X))leaf=atlasPathJoin([pos.unknown[0],X]);",
    replace: "&&atlasNameKey(pos.unknown[pos.unknown.length-1])!==atlasNameKey(X))leaf=atlasPathJoin([pos.unknown[0],X]);",
    mustFail: "FAIL #684 #702 review 4: the fresh path's re-statement guard compares the container" },
  { label: "a partial path's lead lookup asks the store for a sheet this reply only peeked: the stair's pair in a temple entered this reply throws, and the key is minted raw",
    find: "      lead=atlasLeads(A,c.zone,f.thing,pos.know,pos.sheet);",
    replace: "      lead=atlasLeads(A,c.zone,f.thing);",
    mustFail: "FAIL #684 #702 review 4: a partial path on a sheet the SAME reply entered" },
  { label: "a partial path's by-title lookup asks the store for a peeked sheet: the one-reply descent to the crypt throws, and the crypt is added as a town-level house",
    find: "child=atlasChildByTitle(A,c.zone,c.doc,parts[i],pos.know,pos.sheet);",
    replace: "child=atlasChildByTitle(A,c.zone,c.doc,parts[i]);",
    mustFail: "FAIL #684 #702 review 4: a partial path on a sheet the SAME reply entered" },
  { label: "the position reader ends at a spot with segments after it: the raw pointer through the square puts the party on the square, not in the inn",
    find: "      pos.used=i+1;if(i<parts.length-1){pos.spot=null;continue;}/* review 4, finding 3:",
    replace: "      pos.used=i+1;if(false){pos.spot=null;continue;}/* review 4, finding 3:",
    mustFail: "FAIL #684 #702 review 4: a pair that opens with a spot of the home sheet" },
  { label: "a pair opening with a spot of the home sheet is keyed as written: the inn off the square is a twin of the inn",
    find: "&&(f.title||(f.thing&&!atlasLeads(A,pos.home,f.thing,pos.know,pos.sheet))))parts.shift();",
    replace: "&&f.title)parts.shift();",
    mustFail: "FAIL #684 #702 review 4: a pair that opens with a spot of the home sheet" }
] });

process.exit(rc);
