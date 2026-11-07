// fixtree5.js — the fifth reviewer's remedy prototype: copy the tree to <OUT>/fix5 and apply two edits to atlas.js —
//   (R1) the fresh path reads X as a PATH: a leading segment that is the container is dropped, and the key is the container
//        and the LAST remaining segment (rooms do not nest); the container alone stays bare;
//   (R2) the leading-segment strip remembers that a SPOT of the home sheet was stripped, and a single remaining segment is
//        then a home-sheet name whatever the chain (the party is at the spot, on the home sheet, as the walk puts it).
//   node dev/review-702-5/fixtree5.js <SRC> <OUT>   → run the suite and the probes against <OUT>/fix5
var fs = require("fs"), path = require("path");
var SRC = process.argv[2], OUT = path.join(process.argv[3], "fix5");
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(path.join(OUT, "dev"));
fs.readdirSync(SRC).forEach(function (f) { var p = path.join(SRC, f); if (fs.statSync(p).isFile() && (/\.js$/.test(f) || f === "index.html" || f === "sw.js")) fs.copyFileSync(p, path.join(OUT, f)); });
fs.readdirSync(path.join(SRC, "dev")).forEach(function (f) { var p = path.join(SRC, "dev", f); if (fs.statSync(p).isFile() && /\.(js|json|sha256|golden)$/.test(f)) fs.copyFileSync(p, path.join(OUT, "dev", f)); });
fs.mkdirSync(path.join(OUT, "dev", "golden")); fs.readdirSync(path.join(SRC, "dev", "golden")).forEach(function (f) { fs.copyFileSync(path.join(SRC, "dev", "golden", f), path.join(OUT, "dev", "golden", f)); });
fs.mkdirSync(path.join(OUT, "dev", "review-702")); fs.readdirSync(path.join(SRC, "dev", "review-702")).forEach(function (f) { fs.copyFileSync(path.join(SRC, "dev", "review-702", f), path.join(OUT, "dev", "review-702", f)); });
var src = fs.readFileSync(path.join(SRC, "atlas.js"), "utf8"), n = 0;
function edit(find, rep) { var c = src.split(find).length - 1; if (c !== 1) throw new Error("anchor x" + c + ": " + find.slice(0, 80)); src = src.replace(find, rep); n++; }
/* R1 */
edit("if(!leaf&&fresh&&!pos.chain.length&&pos.unknown&&pos.unknown.length&&atlasNameKey(pos.unknown[0])!==atlasNameKey(X))leaf=atlasPathJoin([pos.unknown[0],X]);",
  "if(!leaf&&fresh&&!pos.chain.length&&pos.unknown&&pos.unknown.length){var xp=atlasPathParts(X);while(xp.length>1&&atlasNameKey(xp[0])===atlasNameKey(pos.unknown[0]))xp.shift();if(xp.length>1||atlasNameKey(xp[0])!==atlasNameKey(pos.unknown[0]))leaf=atlasPathJoin([pos.unknown[0],xp[xp.length-1]]);}");
/* R2 */
edit("while(parts.length>1&&(f=atlasFind(pos.homeDoc,parts[0]))&&(f.title||(f.thing&&!atlasLeads(A,pos.home,f.thing,pos.know,pos.sheet))))parts.shift();",
  "var spotStripped=false;while(parts.length>1&&(f=atlasFind(pos.homeDoc,parts[0]))&&(f.title||(f.thing&&!atlasLeads(A,pos.home,f.thing,pos.know,pos.sheet)))){if(f.thing)spotStripped=true;parts.shift();}");
edit("if(parts.length===1&&(atlasFind(pos.homeDoc,X)||!pos.chain.length))return {key:atlasLocKey(wk+\"|\"+atlasFoldLeaf(wk,X))};}",
  "if(parts.length===1&&(spotStripped||atlasFind(pos.homeDoc,X)||!pos.chain.length))return {key:atlasLocKey(wk+\"|\"+atlasFoldLeaf(wk,X))};}");
fs.writeFileSync(path.join(OUT, "atlas.js"), src);
console.log(n + " edits applied -> " + OUT);
