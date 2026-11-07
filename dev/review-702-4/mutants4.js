// mutants4.js — the fourth reviewer's mutation run over the NEW code of 288c8e6f and 6671e60a (v1.1364–v1.1365): a light
// copy of the tree, one mutant at a time, `find` must occur exactly once; the atlas engine suite runs whole in a child;
// SURVIVED = suite green.   node dev/review-702-4/mutants4.js <SRC tree> <OUT dir> [only index]
var fs = require("fs"), path = require("path"), cp = require("child_process");
var SRC = process.argv[2], OUT = process.argv[3], ONLY = process.argv[4] ? parseInt(process.argv[4], 10) : null;
var MUT = path.join(OUT, "mut-tree4");
function copyTree() {
  if (fs.existsSync(MUT)) fs.rmSync(MUT, { recursive: true, force: true });
  fs.mkdirSync(MUT, { recursive: true }); fs.mkdirSync(path.join(MUT, "dev"));
  fs.readdirSync(SRC).forEach(function (f) { var p = path.join(SRC, f); if (fs.statSync(p).isFile() && (/\.js$/.test(f) || f === "index.html" || f === "sw.js")) fs.copyFileSync(p, path.join(MUT, f)); });
  fs.readdirSync(path.join(SRC, "dev")).forEach(function (f) { var p = path.join(SRC, "dev", f); if (fs.statSync(p).isFile() && /\.(js|json|sha256|golden)$/.test(f)) fs.copyFileSync(p, path.join(MUT, "dev", f)); });
  if (fs.existsSync(path.join(SRC, "dev", "golden"))) { fs.mkdirSync(path.join(MUT, "dev", "golden")); fs.readdirSync(path.join(SRC, "dev", "golden")).forEach(function (f) { fs.copyFileSync(path.join(SRC, "dev", "golden", f), path.join(MUT, "dev", "golden", f)); }); }
}
var M = [
  /* ── atlasChainBetween (finding 2b) ── */
  { f: "atlas.js", l: "chainBetween: a tie to the HOME sheet itself returns null (the chain built so far is kept)", find: "  if(zone===home)return [];\n", rep: "  if(zone===home)return null;\n" },
  { f: "atlas.js", l: "chainBetween: a tie to a zone NOT beneath home resets the chain to [] instead of leaving it", find: "  if(!up.length||up[up.length-1]!==home)return null;", rep: "  if(!up.length||up[up.length-1]!==home)return [];" },
  { f: "atlas.js", l: "chainBetween: the loop includes the home sheet as the first chain entry", find: "  for(i=up.length-2;i>=0;i--){z=up[i];rec=A.zones[z];", rep: "  for(i=up.length-1;i>=0;i--){z=up[i];rec=A.zones[z];" },
  { f: "atlas.js", l: "chainBetween: the chain is APPENDED to the one built so far, not replaced", find: "if(between){pos.chain=between;pos.zone=tie.zone;", rep: "if(between){pos.chain=pos.chain.concat(between);pos.zone=tie.zone;" },
  { f: "atlas.js", l: "chainBetween: a zone's segment is its title, never the tied story name (atlasZoneSegment bypassed)", find: "    out.push({zone:z,name:atlasZoneSegment(A,rec.parent,pd,{zone:z,kind:rec.kind,parent:rec.parent,via:rec.via},d),doc:d,parentZone:rec.parent,parentDoc:pd});}", rep: "    out.push({zone:z,name:rec.name||z,doc:d,parentZone:rec.parent,parentDoc:pd});}" },
  { f: "atlas.js", l: "atlasPosition: the between branch does not move pos.zone to the tie's zone", find: "if(between){pos.chain=between;pos.zone=tie.zone;pos.doc=atlasDoc(tie.zone);pos.spot=null;}}", rep: "if(between){pos.chain=between;pos.spot=null;}}" },
  /* ── atlasAddHolds (finding 2a) ── */
  { f: "atlas.js", l: "addHolds: only a DIRECT child of the addition counts (no walk up)", find: "if(rec.parent===add.zone&&rec.via===add.id)return true;z=rec.parent;}", rep: "if(rec.parent===add.zone&&rec.via===add.id)return true;z=null;}" },
  { f: "atlas.js", l: "addHolds: the via is not compared (any zone beneath the addition's sheet 'holds')", find: "if(rec.parent===add.zone&&rec.via===add.id)return true;", rep: "if(rec.parent===add.zone)return true;" },
  { f: "atlas.js", l: "atlasPlace: the inside-tap check uses the tapped sheet rather than the tie's zone (equivalence probe)", find: "  if(add&&atlasAddHolds(A,add,tie.zone))return {ok:false,reason:", rep: "  if(add&&atlasAddHolds(A,add,zoneId))return {ok:false,reason:" },
  /* ── atlasDeclsOfTurn (finding 4) ── */
  { f: "atlas.js", l: "declsOfTurn: every declaration is kept (the filter is a no-op)", find: "keep=ws.placeDecls.filter(function(d){return !!d&&d.turn===t;});", rep: "keep=ws.placeDecls.filter(function(d){return !!d;});" },
  { f: "atlas.js", l: "declsOfTurn: the comparison inverted (this turn's declarations are the ones set aside)", find: "keep=ws.placeDecls.filter(function(d){return !!d&&d.turn===t;});", rep: "keep=ws.placeDecls.filter(function(d){return !!d&&d.turn!==t;});" },
  { f: "atlas.js", l: "declsOfTurn: said on the console but the declarations are NOT set aside", find: "if(gone){ws.placeDecls=keep;atlasSay(\"info\",", rep: "if(gone){atlasSay(\"info\"," },
  /* ── atlasRoomVariants (finding 6, #31) ── */
  { f: "atlas.js", l: "roomVariants: 'any floor' tried at 6 m² before 8", find: "out.push({m2:8},{m2:6});floors.forEach(", rep: "out.push({m2:6},{m2:8});floors.forEach(" },
  { f: "atlas.js", l: "roomVariants: the party's floor is tried AGAIN among the other floors", find: "floors.forEach(function(fl){if(fl!==pf)out.push({floor:fl,m2:6});});", rep: "floors.forEach(function(fl){out.push({floor:fl,m2:6});});" },
  /* ── atlasGrowHouse (finding 8) ── */
  { f: "atlas.js", l: "growHouse: the parent need not be a town", find: "if(!rec||!prec||prec.kind!==\"town\"||!prec.params||!prec.params.edits)return null;", rep: "if(!rec||!prec||!prec.params||!prec.params.edits)return null;" },
  { f: "atlas.js", l: "growHouse: a TRADE's edit grows too (kind==='custom' not required)", find: "if(eds[i].id===rec.via&&eds[i].kind===\"custom\")ed=eds[i];", rep: "if(eds[i].id===rec.via)ed=eds[i];" },
  { f: "atlas.js", l: "growHouse: a large place 'grows' again", find: "  if(!ed||ed.footprint===\"large\")return null;", rep: "  if(!ed)return null;" },
  { f: "atlas.js", l: "growHouse: the town's fingerprint is not cleared (a stale fp → 'redrawn' at the settle)", find: "  ed.footprint=\"large\";prec.fp=null;\n", rep: "  ed.footprint=\"large\";\n" },
  { f: "atlas.js", l: "growHouse: the town's loss check dropped", find: "try{pAfter=atlasDoc(rec.parent);lost=atlasLost(pBefore,pAfter);", rep: "try{pAfter=atlasDoc(rec.parent);lost=null;" },
  { f: "atlas.js", l: "growHouse: the house's own additions are not checked on the larger sheet", find: "    if(!lost){iDoc=atlasDoc(zone);mine=(rec.params&&rec.params.edits)||[];for(k=0;k<mine.length&&!lost;k++)if(!atlasThingById(iDoc,mine[k].id))lost=mine[k].name;}}", rep: "    if(!lost){iDoc=atlasDoc(zone);}}" },
  { f: "atlas.js", l: "growHouse: a non-refusal throw is rethrown WITHOUT undoing the footprint", find: "catch(err){if(!atlasIsRefusal(err)){undo();throw err;}lost=atlasReason(err);}", rep: "catch(err){if(!atlasIsRefusal(err)){throw err;}lost=atlasReason(err);}" },
  { f: "atlas.js", l: "growHouse: the undo handed back is a no-op (a room that still fits nowhere leaves the house large)", find: "  return {grew:true,was:was,undo:undo};", rep: "  return {grew:true,was:was,undo:function(){}};" },
  /* ── the lay() restructure in atlasAdopt ── */
  { f: "atlas.js", l: "adopt: the variants are NOT run again after the growth", find: "pts=atlasRoomVariants(doc,spotRoom);refusal=null;lay();\n      if(hit)grownNote=", rep: "pts=atlasRoomVariants(doc,spotRoom);refusal=null;\n      if(hit)grownNote=" },
  { f: "atlas.js", l: "adopt: a room that still finds no room does NOT undo the growth", find: "      if(hit)grownNote=\" — \"+(rec.name||\"the house\")+\" was drawn larger to hold it\";else grown.undo();", rep: "      if(hit)grownNote=\" — \"+(rec.name||\"the house\")+\" was drawn larger to hold it\";" },
  { f: "atlas.js", l: "adopt: a displacement in the medium house no longer stops the growth (!lostName dropped)", find: "    if(!hit&&!lostName&&rec.kind===\"interior\"&&(grown=atlasGrowHouse(A,zone))&&grown.grew){", rep: "    if(!hit&&rec.kind===\"interior\"&&(grown=atlasGrowHouse(A,zone))&&grown.grew){" },
  { f: "atlas.js", l: "adopt: the baseline for the second pass is the MEDIUM house's doc (doc not redrawn after the growth)", find: "      doc=atlasDoc(zone);spotRoom=atlasStoodAt(A,zone,doc,from);pts=atlasRoomVariants(doc,spotRoom);refusal=null;lay();", rep: "      spotRoom=atlasStoodAt(A,zone,doc,from);pts=atlasRoomVariants(doc,spotRoom);refusal=null;lay();" },
  { f: "atlas.js", l: "adopt: the told line does not say the house was drawn larger", find: "+(rec.kind===\"region\"?\", as a village\":\"\")+grownNote+\".\");", rep: "+(rec.kind===\"region\"?\", as a village\":\"\")+\".\");" },
  { f: "atlas.js", l: "adopt: the toast does not say the house was drawn larger", find: "showToast(\"Map: \"+name+\" added \"+where+grownNote+\".\",5000);", rep: "showToast(\"Map: \"+name+\" added \"+where+\".\",5000);" },
  { f: "atlas.js", l: "adopt: the growth runs for a dungeon chamber too (rec.kind check dropped)", find: "    if(!hit&&!lostName&&rec.kind===\"interior\"&&(grown=atlasGrowHouse(A,zone))&&grown.grew){", rep: "    if(!hit&&!lostName&&(grown=atlasGrowHouse(A,zone))&&grown.grew){" },
  /* ── the key rules (finding 1) ── */
  { f: "atlas.js", l: "fresh path: the LAST unknown segment is the container", find: "leaf=atlasPathJoin([pos.unknown[0],X]);/* review 3", rep: "leaf=atlasPathJoin([pos.unknown[pos.unknown.length-1],X]);/* review 3" },
  { f: "atlas.js", l: "fresh path: the re-statement guard compares the FIRST unknown segment (the reviewer's remedy — a control: should be green or reveal a pin)", find: "&&atlasNameKey(pos.unknown[pos.unknown.length-1])!==atlasNameKey(X))leaf=atlasPathJoin([pos.unknown[0],X]);", rep: "&&atlasNameKey(pos.unknown[0])!==atlasNameKey(X))leaf=atlasPathJoin([pos.unknown[0],X]);" },
  { f: "atlas.js", l: "three-pair: applies to a pair of TWO as well (parts.length>2 → >=2)", find: "      if(parts.length>2&&pre&&!pre.chain.length&&!pre.used&&pre.unknown&&pre.unknown.length&&!atlasFind(pos.homeDoc,parts[0]))", rep: "      if(parts.length>=2&&pre&&!pre.chain.length&&!pre.used&&pre.unknown&&pre.unknown.length&&!atlasFind(pos.homeDoc,parts[0]))" },
  { f: "atlas.js", l: "three-pair: the home-sheet check on the first segment dropped", find: "&&pre.unknown&&pre.unknown.length&&!atlasFind(pos.homeDoc,parts[0]))return {key:", rep: "&&pre.unknown&&pre.unknown.length)return {key:" },
  { f: "atlas.js", l: "three-pair: the !pre.used check dropped", find: "if(parts.length>2&&pre&&!pre.chain.length&&!pre.used&&pre.unknown", rep: "if(parts.length>2&&pre&&!pre.chain.length&&pre.unknown" },
  { f: "atlas.js", l: "three-pair: keyed as the building and the SECOND segment", find: "atlasPathJoin([parts[0],parts[parts.length-1]])))};", rep: "atlasPathJoin([parts[0],parts[1]])))};" },
  { f: "atlas.js", l: "keyFromPosition by-title: the chain is not extended (hit set, chain kept)", find: "chain=chain.slice(0,j+1).concat([{zone:child.zone,name:(A.zones[child.zone]&&A.zones[child.zone].name)||(doc.title&&doc.title.name)||child.zone,doc:doc,parentZone:c.zone,parentDoc:c.doc}]);hit=true;}}", rep: "hit=true;}}" },
  { f: "atlas.js", l: "keyFromPosition by-title: the shallowest chain sheet is asked first", find: "    for(j=chain.length-1;j>=0&&!hit;j--){c=chain[j];child=atlasChildByTitle(A,c.zone,c.doc,parts[i]);", rep: "    for(j=0;j<chain.length&&!hit;j++){c=chain[j];child=atlasChildByTitle(A,c.zone,c.doc,parts[i]);" },
  { f: "atlas.js", l: "keyFromPosition: the unknown tail keys the FIRST unknown segment, not the last", find: "    return atlasPathJoin(names(chain).concat([parts[parts.length-1]]));/* review 3, finding 1: the last segment", rep: "    return atlasPathJoin(names(chain).concat([parts[i]]));/* review 3, finding 1: the last segment" },
  { f: "atlas.js", l: "rule (b): the unknown tail keys the FIRST unknown segment under the zones reached", find: "if(pre.used<parts.length-1)leaf=atlasPathJoin(atlasChainPath(pre,pre.chain.length-1).concat([parts[parts.length-1]]));", rep: "if(pre.used<parts.length-1)leaf=atlasPathJoin(atlasChainPath(pre,pre.chain.length-1).concat([parts[pre.used]]));" },
  /* ── atlasCard's added (finding 2a) ── */
  { f: "atlas.js", l: "card: the addition is looked up under the WORLD key whatever the preview's level", find: "add=(pv&&p&&A.adds)?A.adds[pv.level===\"sub\"?atlasSubKey(p):atlasWorldKey(p)]:null;", rep: "add=(pv&&p&&A.adds)?A.adds[atlasWorldKey(p)]:null;" },
  { f: "atlas.js", l: "card: `added` is set but the button-hiding field is dropped from the card (added:null always)", find: "partyHere:!gone&&((A.at===zoneId&&A.spot===t.id)||!!(leads&&leads!==zoneId&&trail.indexOf(leads)>=0&&trail.indexOf(leads)>trail.indexOf(zoneId))),place:pv,added:added||null};", rep: "partyHere:!gone&&((A.at===zoneId&&A.spot===t.id)||!!(leads&&leads!==zoneId&&trail.indexOf(leads)>=0&&trail.indexOf(leads)>trail.indexOf(zoneId))),place:pv,added:null};" },
  /* ── atlasAddRemove's tie check (finding 2a) ── */
  { f: "atlas.js", l: "addRemove: the own tie ONTO the addition itself counts as tied (equivalence probe: atlasPlace refuses that tap first)", find: "if(under.indexOf(n.zone)>=0||(ks[k]!==storyKey&&n.zone===add.zone&&n.id===add.id))tied=true;}", rep: "if(under.indexOf(n.zone)>=0||(n.zone===add.zone&&n.id===add.id))tied=true;}" },
  /* ── the refusal routed through refuse() (finding 5) ── */
  { f: "atlas.js", l: "adopt: the 'added once already' refusal is info, not warn", find: "  if(A.adds[storyKey])return refuse(\"it was added to the map once already and has not been found since\");", rep: "  if(A.adds[storyKey]){A.off.why+=\" (it was added to the map once already and has not been found since)\";flush();atlasSay(\"info\",name+\" could not be added\");return false;}" }
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
  var t0 = Date.now(), r = cp.spawnSync(process.execPath, ["dev/tests-684-atlas-engine.js"], { cwd: MUT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
  var outp = (r.stdout || "") + (r.stderr || ""), fails = outp.split("\n").filter(function (ln) { return /^FAIL #684/.test(ln); }).map(function (ln) { return ln.replace(/^FAIL #684 /, "").split(" — ")[0].slice(0, 120); });
  var verdict = r.status === 0 && !fails.length ? "SURVIVED" : "caught";
  if (r.status !== 0 && !fails.length) verdict = "caught(crash)";
  results.push({ i: i, l: m.l, f: m.f, verdict: verdict, by: fails.slice(0, 3), s: Math.round((Date.now() - t0) / 1000) });
  console.log("#" + i + " " + verdict + " — " + m.l + (fails.length ? "  <- " + fails.slice(0, 2).join(" | ") : ""));
  fs.writeFileSync(path.join(MUT, m.f), src);
}
fs.writeFileSync(path.join(OUT, "mutants4.json"), JSON.stringify(results, null, 1));
console.log("done in " + Math.round((Date.now() - start) / 1000) + "s; survived: " + results.filter(function (x) { return x.verdict === "SURVIVED"; }).length + " of " + results.length);
