// mutants.js — in-memory mutation runner: a light copy of the tree (engine files + dev/), one mutant at a time,
// `find` must occur exactly once in the file; the atlas engine suite runs in a child process; survived = suite green.
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
  /* atlas.js — You are here */
  { f: "atlas.js", l: "adopt: twice-borne guard dropped in atlasResolve (absent for many)", find: "    if(m.many)return {hit:null,why:m.many+\" places on the map of \"+(A.zones[sheets[i]].name||sheets[i])+\" are called that\"};", rep: "    if(m.many)return {hit:null,why:m.many+\" places on the map of \"+(A.zones[sheets[i]].name||sheets[i])+\" are called that\",absent:true};" },
  { f: "atlas.js", l: "adopt: the loop guard allows unlimited additions in one reply", find: "A.adopt!==false&&guard++<3&&atlasAdopt", rep: "A.adopt!==false&&guard++<30&&atlasAdopt" },
  { f: "atlas.js", l: "adopt: A.adopt switch ignored (false still adds)", find: "while(A.off&&A.off.absent&&A.adopt!==false&&guard++<3", rep: "while(A.off&&A.off.absent&&guard++<3" },
  { f: "atlas.js", l: "atlasDeclFor: 'between' never read", find: "    if((m=/^between\\s+(.+?)\\s+and\\s+(.+)$/i.exec(d.where)))return {kind:\"between\",a:m[1].trim(),b:m[2].trim()};", rep: "    " },
  { f: "atlas.js", l: "atlasDeclFor: consumed declaration not spliced (answered twice)", find: "if(atlasNameKey(d.name)!==key)continue;decls.splice(i,1);", rep: "if(atlasNameKey(d.name)!==key)continue;" },
  { f: "atlas.js", l: "atlasDeclThing: a twice-borne declared name picks nothing but says nothing (told dropped)", find: "  told.push(\"Your [MAP_PLACE:] for \"+storyName+\" named \\\"\"+name+\"\\\", which is \"+(f&&f.many?f.many+\" places on this sheet\":\"no place on this sheet\")+\"; \"+storyName+\" was put beside the party.\");\n  return null;", rep: "  return null;" },
  { f: "atlas.js", l: "atlasDeclsLeft: a declaration for a place not moved to is applied silently (told dropped)", find: "    if(!isWorld&&!isSub){atlasTell(A,\"Your [MAP_PLACE:\"+d.name+\"|\"+d.where+\"] names no place the party went to this turn; nothing was placed.\");continue;}", rep: "    if(!isWorld&&!isSub){continue;}" },
  { f: "atlas.js", l: "atlasAddRemove: the zones under the addition are kept (dangling interior)", find: "  for(i=0;i<under.length;i++)delete A.zones[under[i]];", rep: "  " },
  { f: "atlas.js", l: "atlasAddRemove: a tie inside the addition does not keep it", find: "  if(tied){atlasSay(\"info\",\"the story's place stays on the map: the player placed something inside it\");return false;}", rep: "  " },
  { f: "atlas.js", l: "atlasAddRemove: rec.fp not reset after the edit is removed (stale fingerprint)", find: "  if(ed.length)rec.params.edits=ed;else delete rec.params.edits;\n  rec.fp=null;return true;", rep: "  if(ed.length)rec.params.edits=ed;else delete rec.params.edits;\n  return true;" },
  { f: "atlas.js", l: "atlasAddKind: a dwelling word is a catalogue kind lookup only (house program dropped)", find: "  if(hit&&Object.prototype.hasOwnProperty.call(programs,hit))return {custom:true,word:hit};", rep: "  " },
  { f: "atlas.js", l: "atlasRegionPoints: the frame margin check dropped", find: "    if(x<40||y<40||x>doc.frame.width-40||y>doc.frame.height-40)continue;", rep: "    " },
  { f: "atlas.js", l: "atlasRegionPoints: refused points kept (sea points offered)", find: "    try{TnDMaps.wild.fromRegion(doc,[x,y]);}catch(e){continue;}/* the sea, said in the library's words: skipped */", rep: "    " },
  { f: "atlas.js", l: "atlasAdopt: the region edit's kind is 'town' not 'village'", find: "e={op:\"add\",id:atlasAddId(rec,\"a\"),name:name,kind:\"village\"};", rep: "e={op:\"add\",id:atlasAddId(rec,\"a\"),name:name,kind:\"town\"};" },
  { f: "atlas.js", l: "atlasAdopt: the rollback on no hit keeps the failed edit", find: "    if(!hit){rec.params.edits=before;if(!before.length)delete rec.params.edits;rec.fp=fpWas;", rep: "    if(!hit){" },
  { f: "atlas.js", l: "atlasAdopt: the interior room is not put on the party's floor", find: "if(spotRoom){var rooms=doc.rooms||[];for(i=0;i<rooms.length;i++)if(rooms[i].id===spotRoom.id&&typeof rooms[i].floor===\"number\")e.floor=rooms[i].floor;}", rep: "" },
  { f: "atlas.js", l: "atlasAdopt: the dungeon chamber is dug at the sheet centre, not beside the party", find: "centre=spotRoom?[spotRoom.x,spotRoom.y]:centre;", rep: "" },
  { f: "atlas.js", l: "atlasAdopt: a thrown error is not caught (the turn breaks)", find: "  }catch(err){\n    if(rec&&before!==undefined){rec.params.edits=before;if(!before.length)delete rec.params.edits;rec.fp=fpWas;}", rep: "  }catch(err){throw err;\n    if(rec&&before!==undefined){rec.params.edits=before;if(!before.length)delete rec.params.edits;rec.fp=fpWas;}" },
  { f: "atlas.js", l: "atlasAdopt: the 'at' tie is recorded but the follow is not told (return false)", find: "atlasSay(\"info\",\"the story's \"+name+\" is at \"+thing.name+\" (the GM placed it)\");return true;}", rep: "atlasSay(\"info\",\"the story's \"+name+\" is at \"+thing.name+\" (the GM placed it)\");return false;}" },
  { f: "atlas.js", l: "atlasToldLines: told lines ride every later turn", find: "if(A.told[i].turn>=t-1)out.push(A.told[i].text);", rep: "out.push(A.told[i].text);" },
  { f: "atlas.js", l: "atlasTell: the told ring is unbounded", find: "while(A.told.length>4)A.told.shift();", rep: "" },
  /* #693 second-build review fixes */
  { f: "atlas.js", l: "atlasChildByTitle: an interior behind a door is peeked too (not only dungeons)", find: "||things[i].portal.to.generator!==\"dungeon\")continue;", rep: ")continue;" },
  { f: "atlas.js", l: "atlasKeyFromPosition: a known room in the middle is not passed through (always extends)", find: "      hit=true;/* a spot is passed through: the next segment is read from the same zone */", rep: "      hit=false;" },
  { f: "atlas.js", l: "atlasLeafAt: a way back deeper than the world's sheet is filed as itself", find: "        return i===0?atlasPathJoin(atlasChainPath(pos,0)):atlasPathJoin(atlasChainPath(pos,i-1).concat([above.name]));", rep: "        return i===0?atlasPathJoin(atlasChainPath(pos,0)):atlasPathJoin(atlasChainPath(pos,i).concat([f.thing.name]));" },
  { f: "atlas.js", l: "atlasFingerprint: asParams ignored (scheme 1 reproduced with today's echo)", find: "    if(this===doc&&k===\"params\"&&asParams)return asParams;", rep: "" },
  { f: "atlas.js", l: "atlasSettle: a settled old record is not re-stamped to scheme 2", find: "if(rec.lib!==d.lib||rec.fpv!==ATLAS_FP_SCHEME){rec.fp=d.fp;rec.lib=d.lib;rec.fpv=ATLAS_FP_SCHEME;}return null;}", rep: "return null;}" },
  { f: "atlas.js", l: "atlasSettle: a fresh record is stamped without fpv", find: "  if(!rec.fp){rec.fp=d.fp;rec.lib=d.lib;rec.fpv=ATLAS_FP_SCHEME;return null;}", rep: "  if(!rec.fp){rec.fp=d.fp;rec.lib=d.lib;return null;}" },
  { f: "atlas.js", l: "atlasFoldLeaf never folds", find: "  if(!nodes||typeof placeNameNorm!==\"function\")return leaf;", rep: "  return leaf;" },
  { f: "atlas.js", l: "atlasPlaceCanon: the stripped world-name pair is handed back raw when one segment is left", find: "      if(parts.length===1&&(atlasFind(pos.homeDoc,X)||!pos.chain.length))return {key:atlasLocKey(wk+\"|\"+atlasFoldLeaf(wk,X))};}", rep: "      }" },
  /* identity.js */
  { f: "identity.js", l: "resolvePlaceName: the carried building is not read as the position", find: "at?((at.sub==null&&at.carried!=null)?at.carried:at.sub):undefined", rep: "at?at.sub:undefined" },
  { f: "identity.js", l: "placeTimeline: a SUBLOCATION clears the carry only (carried kept after arrival)", find: "      ev.name=nmS;sub=nmS;subSeen=true;carried=null;}", rep: "      ev.name=nmS;sub=nmS;subSeen=true;}" },
  { f: "identity.js", l: "placeTimeline: SUBLOCATION_LEAVE keeps the carry", find: "    else{ev.kind=\"leave\";sub=null;carried=null;}", rep: "    else{ev.kind=\"leave\";sub=null;}" },
  { f: "identity.js", l: "placeResolvedByMap answers true for every resolution", find: "function placeResolvedByMap(rp){return !!(rp&&rp.via===\"atlas\");}", rep: "function placeResolvedByMap(rp){return !!rp;}" },
  /* tag_table.js */
  { f: "tag_table.js", l: "MAP_PLACE: declarations accumulate across replies (never reset)", find: "if(!mpTags.length)return;worldState.placeDecls=[];", rep: "if(!mpTags.length)return;worldState.placeDecls=worldState.placeDecls||[];" },
  { f: "tag_table.js", l: "MAP_PLACE: no receipt", find: "R.muts.push(\"Map place: \"+mpm[1].trim()+\" — \"+mpm[2].trim());", rep: "" },
  { f: "tag_table.js", l: "block rule: _liA0 read where the block ENDS (no difference ever)", find: "var _liA0=rPlaceAt(R,liOff[lii]);", rep: "var _liA0=_liAt;" },
  { f: "tag_table.js", l: "PARTY_SPLIT: the operand is resolved without the tag's position", find: "psRp=resolvePlaceName(psSub,psArg,(psAt&&psAt.world&&locSame(psAt.world,psArg))?{sub:psAt.sub}:undefined)", rep: "psRp=resolvePlaceName(psSub,psArg)" }
];
copyTree();
var results = [], i, m, src, idx, cnt, start = Date.now();
for (i = 0; i < M.length; i++) {
  if (ONLY !== null && i !== ONLY) continue;
  m = M[i]; src = fs.readFileSync(path.join(SRC, m.f), "utf8"); idx = src.indexOf(m.find); cnt = idx < 0 ? 0 : src.split(m.find).length - 1;
  if (cnt !== 1) { results.push({ i: i, l: m.l, verdict: "ANCHOR " + cnt }); console.log("#" + i + " ANCHOR x" + cnt + " — " + m.l); continue; }
  fs.writeFileSync(path.join(MUT, m.f), src.slice(0, idx) + m.rep + src.slice(idx + m.find.length));
  var r = cp.spawnSync(process.execPath, ["dev/tests-684-atlas-engine.js"], { cwd: MUT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 240000 });
  var outp = (r.stdout || "") + (r.stderr || ""), fails = outp.split("\n").filter(function (ln) { return /^FAIL #684/.test(ln); }).map(function (ln) { return ln.replace(/^FAIL #684 /, "").split(" — ")[0].slice(0, 110); });
  var verdict = r.status === 0 && !fails.length ? "SURVIVED" : "caught";
  if (r.status !== 0 && !fails.length) verdict = "caught(crash)";
  results.push({ i: i, l: m.l, f: m.f, verdict: verdict, by: fails.slice(0, 3) });
  console.log("#" + i + " " + verdict + " — " + m.l + (fails.length ? "  <- " + fails.slice(0, 2).join(" | ") : ""));
  fs.writeFileSync(path.join(MUT, m.f), src);
}
fs.writeFileSync(path.join(OUT, "mutants.json"), JSON.stringify(results, null, 1));
console.log("done in " + Math.round((Date.now() - start) / 1000) + "s; survived: " + results.filter(function (x) { return x.verdict === "SURVIVED"; }).length + " of " + results.length);
