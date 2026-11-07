// mutants3.js — the third reviewer's mutation run over the NEW code of ed0b67a0 (v1.1363): a light copy of the tree, one
// mutant at a time, `find` must occur exactly once; the atlas engine suite runs whole in a child; SURVIVED = suite green.
//   node dev/review-702-3/mutants3.js <SRC tree> <OUT dir> [only index]
var fs = require("fs"), path = require("path"), cp = require("child_process");
var SRC = process.argv[2], OUT = process.argv[3], ONLY = process.argv[4] ? parseInt(process.argv[4], 10) : null;
var MUT = path.join(OUT, "mut-tree");
function copyTree() {
  if (fs.existsSync(MUT)) fs.rmSync(MUT, { recursive: true, force: true });
  fs.mkdirSync(MUT, { recursive: true }); fs.mkdirSync(path.join(MUT, "dev"));
  fs.readdirSync(SRC).forEach(function (f) { var p = path.join(SRC, f); if (fs.statSync(p).isFile() && (/\.js$/.test(f) || f === "index.html" || f === "sw.js")) fs.copyFileSync(p, path.join(MUT, f)); });
  fs.readdirSync(path.join(SRC, "dev")).forEach(function (f) { var p = path.join(SRC, "dev", f); if (fs.statSync(p).isFile() && /\.(js|json|sha256|golden)$/.test(f)) fs.copyFileSync(p, path.join(MUT, "dev", f)); });
  if (fs.existsSync(path.join(SRC, "dev", "golden"))) { fs.mkdirSync(path.join(MUT, "dev", "golden")); fs.readdirSync(path.join(SRC, "dev", "golden")).forEach(function (f) { fs.copyFileSync(path.join(SRC, "dev", "golden", f), path.join(MUT, "dev", "golden", f)); }); }
}
var M = [
  /* ── the two mutants the fix retired as EQUIVALENT ── */
  { f: "identity.js", l: "EQ-CLAIM A: placeTimeline — a SUBLOCATION does not clear the carry", find: "ev.name=nmS;sub=nmS;subSeen=true;subFresh=true;carried=null;}", rep: "ev.name=nmS;sub=nmS;subSeen=true;subFresh=true;}" },
  { f: "atlas.js", l: "EQ-CLAIM B: atlasRegionPoints — the frame margin check dropped", find: "    if(x<40||y<40||x>doc.frame.width-40||y>doc.frame.height-40)continue;\n", rep: "" },
  /* ── atlasChainBears ── */
  { f: "atlas.js", l: "chainBears: the way-back exception at i===0 dropped (the grate and its landing become two nodes)", find: "    if(i===0&&f.thing&&f.thing.portal&&ATLAS_WAYS_BACK[f.thing.portal.way])continue;\n", rep: "" },
  { f: "atlas.js", l: "chainBears: the way-back exception applies at ANY depth (i===0 dropped)", find: "    if(i===0&&f.thing&&f.thing.portal&&ATLAS_WAYS_BACK[f.thing.portal.way])continue;", rep: "    if(f.thing&&f.thing.portal&&ATLAS_WAYS_BACK[f.thing.portal.way])continue;" },
  { f: "atlas.js", l: "chainBears: a zone's own name/title never counts as bearing", find: "    if(atlasNameKey(c.name)===key||atlasNameKey(title)===key)return true;\n    f=atlasFind(c.doc,name);if(!f)continue;", rep: "    f=atlasFind(c.doc,name);if(!f)continue;" },
  { f: "atlas.js", l: "chainBears: a name a chain sheet bears TWICE does not count (rule (a) files it bare)", find: "    f=atlasFind(c.doc,name);if(!f)continue;\n    /* a way back onto", rep: "    f=atlasFind(c.doc,name);if(!f||f.many)continue;\n    /* a way back onto" },
  { f: "atlas.js", l: "rule (a) answers before the chain (the #693 fusion through an added street thing)", find: "    if(atlasFind(pos.homeDoc,X)&&!atlasChainBears(A,pos,X))return null;", rep: "    if(atlasFind(pos.homeDoc,X))return null;" },
  /* ── the fresh path ── */
  { f: "atlas.js", l: "fresh path: the !pos.chain.length guard dropped", find: "if(!leaf&&fresh&&!pos.chain.length&&pos.unknown&&pos.unknown.length&&", rep: "if(!leaf&&fresh&&pos.unknown&&pos.unknown.length&&" },
  { f: "atlas.js", l: "fresh path: the re-statement guard dropped (the invented building becomes a room of itself)", find: "&&atlasNameKey(pos.unknown[pos.unknown.length-1])!==atlasNameKey(X))leaf=atlasPathJoin(pos.unknown.concat([X]));", rep: ")leaf=atlasPathJoin(pos.unknown.concat([X]));" },
  { f: "atlas.js", l: "fresh path: `fresh` not required (a legacy bare pointer inside an unknown place files the next name under it)", find: "if(!leaf&&fresh&&!pos.chain.length&&pos.unknown&&", rep: "if(!leaf&&!pos.chain.length&&pos.unknown&&" },
  { f: "atlas.js", l: "atlasPosition: only the FIRST unknown segment is kept as the container (not the rest of the path)", find: "    pos.unknown=parts.slice(i);break;", rep: "    pos.unknown=[parts[i]];break;" },
  { f: "identity.js", l: "placeTimeline: fresh ignores subFresh (the sub in force at the reply's start counts as fresh)", find: "fresh:sub!=null&&subFresh}", rep: "fresh:sub!=null}" },
  { f: "identity.js", l: "placeTimeline: subFresh never set", find: "ev.name=nmS;sub=nmS;subSeen=true;subFresh=true;carried=null;}", rep: "ev.name=nmS;sub=nmS;subSeen=true;carried=null;}" },
  { f: "identity.js", l: "placeTimeline: subFresh not reset on a world move", find: "world=nm;sub=null;subFresh=false;}}", rep: "world=nm;sub=null;}}" },
  { f: "identity.js", l: "placeTimeline: subFresh not reset on a leave", find: "else{ev.kind=\"leave\";sub=null;carried=null;subFresh=false;}", rep: "else{ev.kind=\"leave\";sub=null;carried=null;}" },
  { f: "identity.js", l: "resolvePlaceName: fresh never handed to the map", find: ",!!(at&&at.fresh)):null;", rep: ",false):null;" },
  /* ── per-thing add keys ── */
  { f: "atlas.js", l: "atlasResolvePointer: the bare pointer's off record carries no path", find: "segment:p.sub,path:[p.sub]};", rep: "segment:p.sub};" },
  { f: "atlas.js", l: "atlasWalk: the off record carries the WHOLE path, not the path to the absent segment", find: "segment:parts[i],path:parts.slice(0,i+1)};return;", rep: "segment:parts[i],path:parts};return;" },
  { f: "atlas.js", l: "atlasAdopt: the add is indexed under the pointer's whole sub key", find: "  storyKey=isWorld?atlasWorldKey(p):atlasLocKey(atlasWorldKey(p)+\"|\"+atlasPathJoin(off.path||[name]));", rep: "  storyKey=isWorld?atlasWorldKey(p):atlasSubKey(p);" },
  /* ── atlasLost ── */
  { f: "atlas.js", l: "atlasLost: a renamed thing is no loss (name comparison dropped)", find: "if(!n||atlasNameKey(n.name)!==atlasNameKey(t[i].name))return t[i].name;}", rep: "if(!n)return t[i].name;}" },
  { f: "atlas.js", l: "atlasLost: a way that is gone is no loss while its room stands", find: "  for(i=0;i<ps.length;i++){found=false;for(j=0;j<qs.length&&!found;j++)if(qs[j].id===ps[i].id&&qs[j].way===ps[i].way)found=true;if(!found)return ps[i].name;}\n", rep: "" },
  { f: "atlas.js", l: "atlasLost: a portal's way is not compared", find: "if(qs[j].id===ps[i].id&&qs[j].way===ps[i].way)found=true;", rep: "if(qs[j].id===ps[i].id)found=true;" },
  { f: "atlas.js", l: "atlasAdopt: a drawing that lost a thing is kept", find: "      if(drawn){lost=atlasLost(doc,drawn);if(lost){lostName=lost;drawn=null;continue;}}\n", rep: "" },
  /* ── atlasRoomyHouse ── */
  { f: "atlas.js", l: "roomyHouse: the second radius (160) dropped", find: "radii=[80,160],r,i,b,d,best=-1,bestArea=0,area;", rep: "radii=[80],r,i,b,d,best=-1,bestArea=0,area;" },
  { f: "atlas.js", l: "roomyHouse: the SMALLEST house near the party is taken", find: "    area=areaOf(b.pts);if(area>bestArea){bestArea=area;best=i;}}", rep: "    area=areaOf(b.pts);if(best<0||area<bestArea){bestArea=area;best=i;}}" },
  { f: "atlas.js", l: "roomyHouse: a house already an establishment may be taken", find: "if(!b||b.est||!b.pts||!b.c)continue;", rep: "if(!b||!b.pts||!b.c)continue;" },
  { f: "atlas.js", l: "roomyHouse: a street trade takes a house too", find: "  if(cat[kind]&&cat[kind].site===\"street\")return -1;\n", rep: "" },
  { f: "atlas.js", l: "atlasAdopt: a trade takes no house (the library's nearest)", find: "if(house>=0)e.building=house;", rep: "if(false)e.building=house;" },
  /* ── atlasStoodAt and the interior/dungeon placement ── */
  { f: "atlas.js", l: "atlasStoodAt: the `from` fallback dropped (the walk cleared the spot)", find: "  if(from&&from.zone===zone&&from.spot!=null)return atlasThingById(doc,from.spot);\n", rep: "" },
  { f: "atlas.js", l: "atlasAdopt interior: the party's floor is not tried first", find: "pts=[];if(pf!==null)pts.push({floor:pf,m2:8},{floor:pf,m2:6});pts.push({m2:8},{m2:6});", rep: "pts=[];pts.push({m2:8},{m2:6});" },
  { f: "atlas.js", l: "atlasAdopt interior: the other floors are never tried", find: "floors.forEach(function(fl){if(fl!==pf)pts.push({floor:fl,m2:6});});", rep: "" },
  { f: "atlas.js", l: "atlasAdopt interior: 6 m2 is never tried", find: "pts=[];if(pf!==null)pts.push({floor:pf,m2:8},{floor:pf,m2:6});pts.push({m2:8},{m2:6});", rep: "pts=[];if(pf!==null)pts.push({floor:pf,m2:8});pts.push({m2:8});" },
  { f: "atlas.js", l: "atlasAdopt: the variant's keys are laid over the edit without clearing the last (floor sticks)", find: "else if(pts[i]){delete e.floor;delete e.m2;Object.keys(pts[i]).forEach(", rep: "else if(pts[i]){Object.keys(pts[i]).forEach(" },
  /* ── atlasAddRemove / atlasPlace ── */
  { f: "atlas.js", l: "addRemove: the tie just written counts as 'something placed at it' (a tap never removes an addition)", find: "if(ks[k]!==storyKey&&n&&((n.zone===add.zone&&n.id===add.id)||under.indexOf(n.zone)>=0))tied=true;", rep: "if(n&&((n.zone===add.zone&&n.id===add.id)||under.indexOf(n.zone)>=0))tied=true;" },
  { f: "atlas.js", l: "addRemove: a tie onto the addition itself does not keep it", find: "if(ks[k]!==storyKey&&n&&((n.zone===add.zone&&n.id===add.id)||under.indexOf(n.zone)>=0))tied=true;", rep: "if(ks[k]!==storyKey&&n&&under.indexOf(n.zone)>=0)tied=true;" },
  { f: "atlas.js", l: "addRemove: the party's position is not moved off a removed zone", find: "  if(under.indexOf(A.at)>=0){A.at=add.zone;A.spot=null;}\n", rep: "" },
  { f: "atlas.js", l: "addRemove: the index of additions inside removed zones is kept", find: "  ks=Object.keys(A.adds);for(k=0;k<ks.length;k++)if(A.adds[ks[k]]&&under.indexOf(A.adds[ks[k]].zone)>=0)delete A.adds[ks[k]];\n", rep: "" },
  { f: "atlas.js", l: "addRemove: the index is deleted before the tie check", find: "  if(tied){atlasSay(\"info\",\"the story's place stays on the map: the player placed something at it or inside it\");return false;}\n  delete A.adds[storyKey];", rep: "  delete A.adds[storyKey];\n  if(tied){atlasSay(\"info\",\"the story's place stays on the map: the player placed something at it or inside it\");return false;}" },
  { f: "atlas.js", l: "atlasPlace: the tap on the engine's own addition is not refused", find: "  if(add&&tie.id!=null&&add.zone===tie.zone&&add.id===tie.id)return {ok:false,reason:", rep: "  if(false)return {ok:false,reason:" },
  { f: "atlas.js", l: "atlasPlace: the tie.id!=null guard dropped", find: "  if(add&&tie.id!=null&&add.zone===tie.zone&&add.id===tie.id)return", rep: "  if(add&&add.zone===tie.zone&&add.id===tie.id)return" },
  { f: "atlas.js", l: "atlasPlace: the removal runs BEFORE the tie is written", find: "  A.names[storyKey]=tie;A.ptr=null;\n  atlasAddRemove(A,storyKey);", rep: "  atlasAddRemove(A,storyKey);\n  A.names[storyKey]=tie;A.ptr=null;" },
  /* ── told lines, declarations, ties ── */
  { f: "atlas.js", l: "atlasToldLines: a line rides two prompts", find: "if(A.told[i].turn===t)out.push", rep: "if(A.told[i].turn>=t-1)out.push" },
  { f: "atlas.js", l: "atlasDeclsLeft: only the whole sub is compared, never a segment", find: "    else for(j=0;j<parts.length&&!key;j++)if(dk===atlasNameKey(parts[j]))key=atlasLocKey(atlasWorldKey(p)+\"|\"+atlasPathJoin(parts.slice(0,j+1)));", rep: "    else if(p.sub&&dk===atlasNameKey(p.sub))key=atlasSubKey(p);" },
  { f: "atlas.js", l: "atlasDeclsLeft: a GM tie declared again is said as the player's", find: "atlasTell(A,tie.by===\"gm\"?\"You placed \"+d.name+\" at \"+at+\" earlier with [MAP_PLACE:]; that placing stands and your [MAP_PLACE:\"+d.name+\"|\"+d.where+\"] was not applied.\":", rep: "atlasTell(A,false?\"\":" },
  { f: "atlas.js", l: "atlasTie: `by` is dropped on the way out", find: "if(t.by)out.by=t.by;", rep: "" },
  { f: "atlas.js", l: "atlasAdopt 'at': the tie is not marked as the GM's", find: "A.names[storyKey]={zone:zone,id:thing.id,by:\"gm\"};", rep: "A.names[storyKey]={zone:zone,id:thing.id};" },
  { f: "atlas.js", l: "atlasTieSay: a GM tie is said as the player's", find: "(t.by===\"gm\"?\"the GM placed it there.\":\"the player placed it there.\")", rep: "\"the player placed it there.\"" },
  { f: "atlas.js", l: "atlasAdopt: the told lines gathered before the add are never flushed on success", find: "    A.adds[storyKey]={zone:zone,id:e.id,turn:atlasTurn()};\n    flush();", rep: "    A.adds[storyKey]={zone:zone,id:e.id,turn:atlasTurn()};" },
  { f: "atlas.js", l: "atlasAdopt: {where} is left in a told line", find: "String(t).replace(\"{where}\",w)", rep: "String(t)" },
  { f: "atlas.js", l: "atlasAdopt: the where says 'beside the party' though it is the last mapped place", find: "where=party.last?\"beside the party's last mapped place\":\"beside the party\";}", rep: "where=\"beside the party\";}" },
  { f: "atlas.js", l: "atlasAdopt: a 'last' party is not the centre (the capital is)", find: "      if(party){centre=[party.x,party.y];", rep: "      if(party&&!party.last){centre=[party.x,party.y];" },
  /* ── refusals ── */
  { f: "atlas.js", l: "atlasAdopt: a refusal is logged, never toasted", find: "atlasSay(\"warn\",name+\" could not be added — \"+why);", rep: "atlasSay(\"info\",name+\" could not be added — \"+why);" },
  { f: "atlas.js", l: "atlasAdopt: the library's refusal text is not kept", find: "drawn=null;refusal=atlasReason(err);}", rep: "drawn=null;}" },
  { f: "atlas.js", l: "atlasAdopt: the displacement is not named in the refusal", find: "return refuse(lostName?\"adding it would have displaced \"+lostName+\" from the map of \"+(rec.name||zone):", rep: "return refuse(false?\"\":" },
  { f: "atlas.js", l: "atlasAdopt: a settlement's name is added at the town's level too", find: "if(realm&&(realm.thing||realm.many))return refuse(", rep: "if(false)return refuse(" },
  { f: "atlas.js", l: "atlasAdopt: the realm check ignores a twice-borne settlement name", find: "if(realm&&(realm.thing||realm.many))return refuse(", rep: "if(realm&&realm.thing)return refuse(" },
  { f: "atlas.js", l: "atlasAdopt: a refused add leaves params={} where it was null", find: "rec.params=paramsWas;rec.fp=fpWas;\n      return refuse(", rep: "rec.fp=fpWas;\n      return refuse(" },
  { f: "atlas.js", l: "atlasAdopt: the catch does not restore params", find: "if(rec&&before!==undefined){if(before.length)rec.params.edits=before;else if(paramsWas)delete rec.params.edits;rec.params=paramsWas;rec.fp=fpWas;}", rep: "if(rec&&before!==undefined){if(before.length)rec.params.edits=before;else if(paramsWas)delete rec.params.edits;rec.fp=fpWas;}" },
  { f: "atlas.js", l: "atlasAdopt: the 'added once already' early return also toasts (louder, not a defect — a control)", find: "if(A.adds[storyKey]){A.off.why+=\" (it was added to the map once already and has not been found since)\";return false;}", rep: "if(A.adds[storyKey]){return refuse(\"it was added to the map once already and has not been found since\");}" },
  /* ── the follow ── */
  { f: "atlas.js", l: "atlasFollow: `from` is not handed to the adoption", find: "guard++<3&&atlasAdopt(A,p,entered,from))", rep: "guard++<3&&atlasAdopt(A,p,entered,null))" },
  { f: "atlas.js", l: "atlasFollow: `from` is read AFTER the pointer was resolved (the spot already cleared)", find: "    prev=(A.at&&A.zones[A.at])?A.at:null;from={zone:prev,spot:A.spot};/* where the party stood: the walk clears the spot a segment at a time, and an addition goes beside it */\n    atlasResolvePointer(A,p,prev,entered);", rep: "    prev=(A.at&&A.zones[A.at])?A.at:null;\n    atlasResolvePointer(A,p,prev,entered);from={zone:A.at,spot:A.spot};" }
];
copyTree();
var results = [], i, m, src, idx, cnt, start = Date.now();
for (i = 0; i < M.length; i++) {
  if (ONLY !== null && i !== ONLY) continue;
  m = M[i]; src = fs.readFileSync(path.join(SRC, m.f), "utf8");
  var find = m.find, rep = m.rep;
  if (src.indexOf(find) < 0 && find.indexOf("\n") >= 0 && src.indexOf("\r\n") >= 0) { find = find.replace(/\n/g, "\r\n"); rep = rep.replace(/\n/g, "\r\n"); }
  idx = src.indexOf(find); cnt = idx < 0 ? 0 : src.split(find).length - 1;
  if (cnt !== 1) { results.push({ i: i, l: m.l, verdict: "ANCHOR " + cnt }); console.log("#" + i + " ANCHOR x" + cnt + " — " + m.l); continue; }
  fs.writeFileSync(path.join(MUT, m.f), src.slice(0, idx) + rep + src.slice(idx + find.length));
  var r = cp.spawnSync(process.execPath, ["dev/tests-684-atlas-engine.js"], { cwd: MUT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
  var outp = (r.stdout || "") + (r.stderr || ""), fails = outp.split("\n").filter(function (ln) { return /^FAIL #684/.test(ln); }).map(function (ln) { return ln.replace(/^FAIL #684 /, "").split(" — ")[0].slice(0, 120); });
  var verdict = r.status === 0 && !fails.length ? "SURVIVED" : "caught";
  if (r.status !== 0 && !fails.length) verdict = "caught(crash)";
  results.push({ i: i, l: m.l, f: m.f, verdict: verdict, by: fails.slice(0, 3) });
  console.log("#" + i + " " + verdict + " — " + m.l + (fails.length ? "  <- " + fails.slice(0, 2).join(" | ") : ""));
  fs.writeFileSync(path.join(MUT, m.f), src);
}
fs.writeFileSync(path.join(OUT, "mutants3.json"), JSON.stringify(results, null, 1));
console.log("done in " + Math.round((Date.now() - start) / 1000) + "s; survived: " + results.filter(function (x) { return x.verdict === "SURVIVED"; }).length + " of " + results.length);
