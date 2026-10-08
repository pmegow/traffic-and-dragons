// list distinct (class, tpl) -> decorations, excluding or only a decoration. argv: <file> [onlyDeco|-notDeco]
var fs = require("fs"), j = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), f = process.argv[3] || "";
var g = {};
j.results.forEach(function (r) {
  if (f && f.charAt(0) === "-" && r.deco === f.slice(1)) return;
  if (f && f.charAt(0) !== "-" && r.deco !== f) return;
  var k = r.cls + " | " + r.tpl; (g[k] = g[k] || {}); (g[k][r.word.slice(0, 3) + ":" + r.deco + "@" + r.mode.slice(0, 1)] = 1);
});
Object.keys(g).sort().forEach(function (k) { console.log(k + "\n      " + Object.keys(g[k]).join(", ")); });
console.log(Object.keys(g).length + " groups");
