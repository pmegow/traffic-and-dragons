// mut8tree.js — a copy of the tree with mutant #8 of mutants5.js applied (the strip's atlasLeads without the position's
// adapters), to show whether the taught pair on a town entered THIS reply reaches the store through it.
//   node dev/review-702-5/mut8tree.js <SRC> <OUT>   → <OUT>/mut8
var fs = require("fs"), path = require("path");
var SRC = process.argv[2], OUT = path.join(process.argv[3], "mut8");
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(path.join(OUT, "dev"));
fs.readdirSync(SRC).forEach(function (f) { var p = path.join(SRC, f); if (fs.statSync(p).isFile() && (/\.js$/.test(f) || f === "index.html" || f === "sw.js")) fs.copyFileSync(p, path.join(OUT, f)); });
fs.readdirSync(path.join(SRC, "dev")).forEach(function (f) { var p = path.join(SRC, "dev", f); if (fs.statSync(p).isFile() && /\.(js|json|sha256|golden)$/.test(f)) fs.copyFileSync(p, path.join(OUT, "dev", f)); });
fs.mkdirSync(path.join(OUT, "dev", "review-702")); fs.readdirSync(path.join(SRC, "dev", "review-702")).forEach(function (f) { fs.copyFileSync(path.join(SRC, "dev", "review-702", f), path.join(OUT, "dev", "review-702", f)); });
var src = fs.readFileSync(path.join(SRC, "atlas.js"), "utf8"), find = "(f.title||(f.thing&&!atlasLeads(A,pos.home,f.thing,pos.know,pos.sheet))))parts.shift();", rep = "(f.title||(f.thing&&!atlasLeads(A,pos.home,f.thing))))parts.shift();";
if (src.split(find).length !== 2) throw new Error("anchor");
fs.writeFileSync(path.join(OUT, "atlas.js"), src.replace(find, rep));
console.log("mutant #8 applied -> " + OUT);
