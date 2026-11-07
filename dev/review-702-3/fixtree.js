// fixtree.js — a light copy of the tree with the third reviewer's PROTOTYPE of the P1 remedy applied to atlas.js (a key never
// carries a room in the middle), so the remedy can be run against the probes and the engine suite before it is recommended.
//   node dev/review-702-3/fixtree.js <SRC tree> <OUT tree>
var fs = require("fs"), path = require("path");
var SRC = process.argv[2], OUT = process.argv[3];
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(path.join(OUT, "dev"));
fs.readdirSync(SRC).forEach(function (f) { var p = path.join(SRC, f); if (fs.statSync(p).isFile() && (/\.js$/.test(f) || f === "index.html" || f === "sw.js")) fs.copyFileSync(p, path.join(OUT, f)); });
fs.readdirSync(path.join(SRC, "dev")).forEach(function (f) { var p = path.join(SRC, "dev", f); if (fs.statSync(p).isFile() && /\.(js|json|sha256|golden)$/.test(f)) fs.copyFileSync(p, path.join(OUT, "dev", f)); });
if (fs.existsSync(path.join(SRC, "dev", "golden"))) { fs.mkdirSync(path.join(OUT, "dev", "golden")); fs.readdirSync(path.join(SRC, "dev", "golden")).forEach(function (f) { fs.copyFileSync(path.join(SRC, "dev", "golden", f), path.join(OUT, "dev", "golden", f)); }); }
var A = fs.readFileSync(path.join(OUT, "atlas.js"), "utf8"), n = 0;
function sub(find, rep) { var i = A.indexOf(find); if (i < 0 || A.indexOf(find, i + 1) >= 0) throw new Error("anchor not unique: " + find.slice(0, 60)); A = A.slice(0, i) + rep + A.slice(i + find.length); n++; }
/* 1. the fresh path: the container is the FIRST unknown segment (the building), never the rest of the path (a room in the middle) */
sub("leaf=atlasPathJoin(pos.unknown.concat([X]));", "leaf=atlasPathJoin([pos.unknown[0],X]);");
/* 2. rule (b)'s unknown tail: the key is the zones reached plus the LAST segment; unknown middle segments are rooms, not zones */
sub("if(pre.used<parts.length-1)leaf=atlasPathJoin(atlasChainPath(pre,pre.chain.length-1).concat(parts.slice(pre.used)));", "if(pre.used<parts.length-1)leaf=atlasPathJoin(atlasChainPath(pre,pre.chain.length-1).concat([parts[parts.length-1]]));");
/* 3. a pair whose first segment is no thing anywhere (an invented building named from the street): first + last, never as written */
sub("      if(pos.chain.length)return {key:atlasLocKey(wk+\"|\"+atlasFoldLeaf(wk,atlasKeyFromPosition(A,pos,parts)))};\n    }",
    "      if(pos.chain.length)return {key:atlasLocKey(wk+\"|\"+atlasFoldLeaf(wk,atlasKeyFromPosition(A,pos,parts)))};\n      if(pre&&!pre.chain.length&&pre.unknown&&pre.unknown.length&&!pre.used&&!atlasFind(pos.homeDoc,parts[0]))return {key:atlasLocKey(wk+\"|\"+atlasFoldLeaf(wk,atlasPathJoin([parts[0],parts[parts.length-1]])))};\n    }");
fs.writeFileSync(path.join(OUT, "atlas.js"), A);
console.log("fixtree at " + OUT + " with " + n + " prototype edits to atlas.js");
