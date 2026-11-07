// mutants5.js — the fifth reviewer's mutation run over the NEW code of 8e860273 (v1.1366): a light copy of the tree, one
// mutant at a time, `find` must occur exactly once; the atlas engine suite runs whole in a child; SURVIVED = suite green.
//   node dev/review-702-5/mutants5.js <SRC tree> <OUT dir> [only index]
var fs = require("fs"), path = require("path"), cp = require("child_process");
var SRC = process.argv[2], OUT = process.argv[3], ONLY = process.argv[4] ? parseInt(process.argv[4], 10) : null;
var MUT = path.join(OUT, "mut-tree5");
function copyTree() {
  if (fs.existsSync(MUT)) fs.rmSync(MUT, { recursive: true, force: true });
  fs.mkdirSync(MUT, { recursive: true }); fs.mkdirSync(path.join(MUT, "dev"));
  fs.readdirSync(SRC).forEach(function (f) { var p = path.join(SRC, f); if (fs.statSync(p).isFile() && (/\.js$/.test(f) || f === "index.html" || f === "sw.js")) fs.copyFileSync(p, path.join(MUT, f)); });
  fs.readdirSync(path.join(SRC, "dev")).forEach(function (f) { var p = path.join(SRC, "dev", f); if (fs.statSync(p).isFile() && /\.(js|json|sha256|golden)$/.test(f)) fs.copyFileSync(p, path.join(MUT, "dev", f)); });
  if (fs.existsSync(path.join(SRC, "dev", "golden"))) { fs.mkdirSync(path.join(MUT, "dev", "golden")); fs.readdirSync(path.join(SRC, "dev", "golden")).forEach(function (f) { fs.copyFileSync(path.join(SRC, "dev", "golden", f), path.join(MUT, "dev", "golden", f)); }); }
}
var M = [
  /* ── finding 1: the re-statement guard's index ── */
  { f: "atlas.js", l: "guard: compares the LAST unknown segment again (the shipped-before-fix index)", find: "&&atlasNameKey(pos.unknown[0])!==atlasNameKey(X))leaf=atlasPathJoin([pos.unknown[0],X]);", rep: "&&atlasNameKey(pos.unknown[pos.unknown.length-1])!==atlasNameKey(X))leaf=atlasPathJoin([pos.unknown[0],X]);" },
  { f: "atlas.js", l: "guard: dropped altogether (the container re-stated becomes a room of itself)", find: "&&atlasNameKey(pos.unknown[0])!==atlasNameKey(X))leaf=atlasPathJoin([pos.unknown[0],X]);", rep: ")leaf=atlasPathJoin([pos.unknown[0],X]);" },
  { f: "atlas.js", l: "guard: compares the container with the FIRST segment of X (the fifth reviewer's remedy for R1 — a control: equal → should fall to the bare/pair rules)", find: "&&atlasNameKey(pos.unknown[0])!==atlasNameKey(X))leaf=atlasPathJoin([pos.unknown[0],X]);", rep: "&&atlasNameKey(pos.unknown[0])!==atlasNameKey(atlasPathParts(X)[0]))leaf=atlasPathJoin([pos.unknown[0],X]);" },
  /* ── finding 2: the adapters on the position and their use ── */
  { f: "atlas.js", l: "adapters: not put on the position (know/sheet/enter undefined → the store is asked)", find: "pos={home:home,homeDoc:homeDoc,chain:[],zone:home,doc:homeDoc,spot:null,used:0,know:know,sheet:sheet,enter:enter};", rep: "pos={home:home,homeDoc:homeDoc,chain:[],zone:home,doc:homeDoc,spot:null,used:0};" },
  { f: "atlas.js", l: "adapters: the lead lookup in atlasKeyFromPosition without know/sheet", find: "      lead=atlasLeads(A,c.zone,f.thing,pos.know,pos.sheet);", rep: "      lead=atlasLeads(A,c.zone,f.thing);" },
  { f: "atlas.js", l: "adapters: the by-title lookup in atlasKeyFromPosition without know/sheet", find: "child=atlasChildByTitle(A,c.zone,c.doc,parts[i],pos.know,pos.sheet);", rep: "child=atlasChildByTitle(A,c.zone,c.doc,parts[i]);" },
  { f: "atlas.js", l: "adapters: the lead's sheet peeked without `enter` (the zone is not put in `seen`, so a route from it asks the store)", find: "if(lead){doc=pos.enter?pos.enter(lead):atlasPeekDoc(A,lead);chain=chain.slice(0,j+1)", rep: "if(lead){doc=atlasPeekDoc(A,lead);chain=chain.slice(0,j+1)" },
  { f: "atlas.js", l: "adapters: the by-title child's sheet peeked without `enter`", find: "doc=child.lead?(pos.enter?pos.enter(child.lead):atlasPeekDoc(A,child.lead)):atlasDoc(child.zone);chain=chain.slice(0,j+1)", rep: "doc=child.lead?atlasPeekDoc(A,child.lead):atlasDoc(child.zone);chain=chain.slice(0,j+1)" },
  { f: "atlas.js", l: "adapters: the strip's atlasLeads without know/sheet (a peeked HOME sheet — a village entered this reply — would ask the store)", find: "(f.title||(f.thing&&!atlasLeads(A,pos.home,f.thing,pos.know,pos.sheet))))parts.shift();", rep: "(f.title||(f.thing&&!atlasLeads(A,pos.home,f.thing))))parts.shift();" },
  /* ── finding 3: the spot pass-through and the strip ── */
  { f: "atlas.js", l: "pass-through: a spot with segments after it ends the walk (the pre-fix reader)", find: "pos.used=i+1;if(i<parts.length-1){pos.spot=null;continue;}", rep: "pos.used=i+1;if(false){pos.spot=null;continue;}" },
  { f: "atlas.js", l: "pass-through: the spot is KEPT on the position while passing (pos.spot=f.thing)", find: "pos.used=i+1;if(i<parts.length-1){pos.spot=null;continue;}", rep: "pos.used=i+1;if(i<parts.length-1){pos.spot=f.thing;continue;}" },
  { f: "atlas.js", l: "pass-through: `used` not advanced for a passed spot", find: "pos.used=i+1;if(i<parts.length-1){pos.spot=null;continue;}", rep: "if(i<parts.length-1){pos.spot=null;continue;}pos.used=i+1;" },
  { f: "atlas.js", l: "strip: the title only (a leading spot of the home sheet is keyed as written — the pre-fix strip)", find: "&&(f.title||(f.thing&&!atlasLeads(A,pos.home,f.thing,pos.know,pos.sheet))))parts.shift();", rep: "&&f.title)parts.shift();" },
  { f: "atlas.js", l: "strip: ANY leading thing of the home sheet, a way in too (the inn stripped from 'The Old Ram — Kitchen')", find: "&&(f.title||(f.thing&&!atlasLeads(A,pos.home,f.thing,pos.know,pos.sheet))))parts.shift();", rep: "&&(f.title||f.thing))parts.shift();" },
  { f: "atlas.js", l: "strip: the stripped remainder is a home-sheet name whatever the chain (the fifth reviewer's remedy for R2 — a control)", find: "if(parts.length===1&&(atlasFind(pos.homeDoc,X)||!pos.chain.length))return {key:atlasLocKey(wk+\"|\"+atlasFoldLeaf(wk,X))};}", rep: "if(parts.length===1)return {key:atlasLocKey(wk+\"|\"+atlasFoldLeaf(wk,X))};}" },
  /* ── finding 4/5/8: the growth after the restore, the reasons ── */
  { f: "atlas.js", l: "growth: the recipe is NOT restored before the growth is tried (the failed room stays in the baseline)", find: "      if(before.length)rec.params.edits=before;else delete rec.params.edits;rec.fp=null;/* review 4, finding 4:", rep: "      /* review 4, finding 4:" },
  { f: "atlas.js", l: "growth: the restore keeps rec.fp as lay() left it (rec.fp=null dropped from the restore line)", find: "      if(before.length)rec.params.edits=before;else delete rec.params.edits;rec.fp=null;/* review 4, finding 4:", rep: "      if(before.length)rec.params.edits=before;else delete rec.params.edits;/* review 4, finding 4:" },
  { f: "atlas.js", l: "growth: the restore puts back `before` even when it is empty (edits: [] instead of deleting the key)", find: "      if(before.length)rec.params.edits=before;else delete rec.params.edits;rec.fp=null;/* review 4, finding 4:", rep: "      rec.params.edits=before;rec.fp=null;/* review 4, finding 4:" },
  { f: "atlas.js", l: "grownWhy: a refused growth's reason dropped", find: "    else if(grown&&grown.grew===false)grownWhy=\"drawing \"+(rec.name||\"the house\")+\" larger was refused: \"+grown.why;", rep: "    else if(grown&&grown.grew===false)grownWhy=null;" },
  { f: "atlas.js", l: "grownWhy: the undone growth's reason dropped (the undo kept)", find: "else{grown.undo();grownWhy=\"even drawn larger it had no room for it\";}", rep: "else{grown.undo();}" },
  { f: "atlas.js", l: "grownWhy: the undo dropped (the house stays large)", find: "else{grown.undo();grownWhy=\"even drawn larger it had no room for it\";}", rep: "else{grownWhy=\"even drawn larger it had no room for it\";}" },
  { f: "atlas.js", l: "grownWhy: not appended to the refusal (the toast and the where-line lose it)", find: "+(refusal?\" — \"+refusal:\"\")+(grownWhy?\" (\"+grownWhy+\")\":\"\"));", rep: "+(refusal?\" — \"+refusal:\"\"));" },
  { f: "atlas.js", l: "told line: the redrawn-rooms note dropped", find: " was drawn larger to hold it; its rooms were redrawn, so places the story used inside it may have moved\";", rep: " was drawn larger to hold it\";" },
  /* ── finding 6: game.js ── */
  { f: "game.js", l: "game.js: the sheet-sync's parse keeps its declarations", find: "    delete worldState.placeDecls;/* #702 (review 4, finding 6):", rep: "    /* #702 (review 4, finding 6):" },
  /* ── finding 7: the tie refusal ── */
  { f: "atlas.js", l: "tie refusal: dropped", find: "  if(pv.level===\"sub\"){var wpos=atlasPosition(A,p.world,null),wup=wpos?atlasChainUp(A,tie.zone,wpos.home):[];if(wpos&&tie.zone!==wpos.home&&wup[wup.length-1]!==wpos.home)return {ok:false,reason:", rep: "  if(false){var wpos=atlasPosition(A,p.world,null),wup=wpos?atlasChainUp(A,tie.zone,wpos.home):[];if(wpos&&tie.zone!==wpos.home&&wup[wup.length-1]!==wpos.home)return {ok:false,reason:" },
  { f: "atlas.js", l: "tie refusal: the `tie.zone!==wpos.home` clause dropped (equivalence probe: chainUp(home,home) ends at home)", find: "if(wpos&&tie.zone!==wpos.home&&wup[wup.length-1]!==wpos.home)return {ok:false,reason:", rep: "if(wpos&&wup[wup.length-1]!==wpos.home)return {ok:false,reason:" },
  { f: "atlas.js", l: "tie refusal: the tapped zone must BE the home sheet (a room of the town's own inn refused)", find: "if(wpos&&tie.zone!==wpos.home&&wup[wup.length-1]!==wpos.home)return {ok:false,reason:", rep: "if(wpos&&tie.zone!==wpos.home)return {ok:false,reason:" },
  { f: "atlas.js", l: "tie refusal: applies to a WORLD tie too (pv.level check dropped)", find: "  if(pv.level===\"sub\"){var wpos=atlasPosition(A,p.world,null)", rep: "  if(true){var wpos=atlasPosition(A,p.world,null)" },
  { f: "atlas.js", l: "tie refusal: the home read from A.at instead of the world's position (equivalence probe)", find: "  if(pv.level===\"sub\"){var wpos=atlasPosition(A,p.world,null),wup=wpos?atlasChainUp(A,tie.zone,wpos.home):[];", rep: "  if(pv.level===\"sub\"){var wpos={home:A.at},wup=wpos?atlasChainUp(A,tie.zone,wpos.home):[];" }
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
fs.writeFileSync(path.join(OUT, "mutants5.json"), JSON.stringify(results, null, 1));
console.log("done in " + Math.round((Date.now() - start) / 1000) + "s; survived: " + results.filter(function (x) { return x.verdict === "SURVIVED"; }).length + " of " + results.length);
